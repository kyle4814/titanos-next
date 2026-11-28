// End to end through the Worker's fetch handler: Buy -> Stripe Checkout (fake Stripe API) -> signed webhook -> emailed link ->
// download from a fake private R2 -> cap -> refund revokes. Stripe test-mode fixtures, real SQLite with the real migration, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../src/app.ts";
import { MockMailer } from "../src/mailer.ts";
import { ITEM, ITEM2, ZIP, completedEvent, disputeEvent, fakeStripeFetch, makeEnv, refundEvent, signedRequest } from "./helpers.ts";

const NOW = 1_800_000_000_000;

test("e2e: the whole sale path, no human in the loop", async () => {
  const { env, db, bucket } = makeEnv(); const stripe = fakeStripeFetch(); const mailer = new MockMailer(); const clock = { t: NOW };
  const worker = createWorker({ now: () => clock.t, fetchFn: stripe.fetchFn, mailer, items: [ITEM, ITEM2], log: () => {} });
  const go = (req: Request) => worker.fetch(req, env);

  // 1. buyer clicks Buy
  const co = await go(new Request("https://digital.test/digital/checkout", { method: "POST", headers: { "cf-connecting-ip": "203.0.113.5" }, body: JSON.stringify({ slug: "demo-pack" }) }));
  assert.equal(co.status, 201);
  const { id: sessionId } = (await co.json()) as any;
  assert.equal(stripe.calls[0].form.get("line_items[0][price_data][unit_amount]"), "4900");

  // thank-you page before the webhook: pending
  const pend = await go(new Request(`https://digital.test/digital/order?s=${sessionId}`));
  assert.deepEqual(await pend.json(), { state: "pending" });

  // 2. Stripe confirms payment by webhook
  const ev = completedEvent({ session: sessionId, pi: "pi_e2e", email: "customer@example.com" });
  const wh = await go(signedRequest(ev, { now: clock.t }));
  assert.equal(wh.status, 200); assert.deepEqual(await wh.json(), { result: "emailed" });
  const sent = await go(new Request(`https://digital.test/digital/order?s=${sessionId}`));
  const sentJ = (await sent.json()) as any; assert.equal(sentJ.state, "sent"); assert.equal(sentJ.title, "Demo Pack"); assert.match(sentJ.download_url, /\/digital\/download\?t=v1\./);

  // 3. the buyer got a private link by email
  assert.equal(mailer.outbox.length, 1); assert.equal(mailer.outbox[0].to, "customer@example.com");
  const link = /(https:\/\/digital\.test\/digital\/download\?t=\S+)/.exec(mailer.outbox[0].text)![1];

  // 4. the link streams the exact bytes from R2, five times
  const lastDl = async () => go(new Request(link));
  for (let i = 1; i <= 5; i++) {
    const r = await lastDl();
    assert.equal(r.status, 200, `download ${i}`);
    if (i === 1) {
      assert.equal(r.headers.get("content-type"), "application/zip");
      assert.match(r.headers.get("content-disposition")!, /attachment; filename="demo-pack\.zip"/);
      assert.equal(r.headers.get("cache-control"), "no-store, private");
      assert.equal(r.headers.get("x-content-type-options"), "nosniff");
      assert.deepEqual(new Uint8Array(await r.arrayBuffer()), ZIP, "the bytes are the zip");
    } else await r.arrayBuffer();
  }
  assert.equal((await lastDl()).status, 429, "sixth download refused");
  assert.equal(bucket.gets, 5, "the cap stops before R2 is touched");

  // HEAD (link scanners) never spends a download
  assert.equal((await go(new Request(link, { method: "HEAD" }))).status, 200);

  // 5. a refund revokes the link for good (fresh order so the cap is not the reason)
  const ev2 = completedEvent({ id: "evt_2", session: "cs_test_second01", pi: "pi_second", email: "two@example.com", slug: "other-pack", amount: 2900 });
  await go(signedRequest(ev2, { now: clock.t }));
  const link2 = /(https:\/\/digital\.test\/digital\/download\?t=\S+)/.exec(mailer.outbox[1].text)![1];
  assert.equal((await go(new Request(link2))).status, 200);
  const rf = await go(signedRequest(refundEvent({ id: "evt_r", pi: "pi_second", amount: 2900 }), { now: clock.t }));
  assert.deepEqual(await rf.json(), { result: "revoked" });
  const after = await go(new Request(link2));
  assert.equal(after.status, 410); assert.deepEqual(await after.json(), { error: "link_revoked" });
  assert.equal((await go(new Request(link2, { method: "HEAD" }))).status, 410);

  // 6. a dispute on the first order also revokes
  await go(signedRequest(disputeEvent({ id: "evt_d", pi: "pi_e2e" }), { now: clock.t }));
  assert.equal((await go(new Request(link))).status, 410);

  // the order log has both orders and the download trail
  assert.equal(Number((db.sql.prepare("SELECT COUNT(*) n FROM digital_orders").get() as any).n), 2);
  assert.ok(Number((db.sql.prepare("SELECT COUNT(*) n FROM digital_download_log").get() as any).n) >= 8);
});

test("e2e: expiry after 7 days, a forged or foreign token, and a missing R2 object", async () => {
  const { env, bucket } = makeEnv(); const mailer = new MockMailer(); const clock = { t: NOW };
  const worker = createWorker({ now: () => clock.t, mailer, items: [ITEM], log: () => {} });
  await worker.fetch(signedRequest(completedEvent({}), { now: clock.t }), env);
  const link = /(https:\/\/digital\.test\/digital\/download\?t=\S+)/.exec(mailer.outbox[0].text)![1];

  assert.equal((await worker.fetch(new Request(link.slice(0, -4) + "0000"), env)).status, 403, "tampered signature");
  assert.equal((await worker.fetch(new Request("https://digital.test/digital/download"), env)).status, 403, "no token");

  bucket.files.delete(ITEM.r2Key);
  const miss = await worker.fetch(new Request(link), env);
  assert.equal(miss.status, 502, "file missing in R2");
  bucket.files.set(ITEM.r2Key, ZIP);
  assert.equal((await worker.fetch(new Request(link), env)).status, 200, "the failed attempt did not spend a download");

  clock.t = NOW + 7 * 86400 * 1000 + 1000;
  const late = await worker.fetch(new Request(link), env);
  assert.equal(late.status, 410); assert.deepEqual(await late.json(), { error: "link_expired" });
});

test("e2e: a token signed with a different secret is refused", async () => {
  const a = makeEnv(); const b = makeEnv(undefined, undefined, { DIGITAL_TOKEN_SECRET: "a-completely-different-secret-value-123" });
  const mailer = new MockMailer();
  const wa = createWorker({ now: () => NOW, mailer, items: [ITEM], log: () => {} });
  await wa.fetch(signedRequest(completedEvent({}), { now: NOW }), a.env);
  const link = /(https:\/\/digital\.test\/digital\/download\?t=\S+)/.exec(mailer.outbox[0].text)![1];
  assert.equal((await wa.fetch(new Request(link), b.env)).status, 403);
});

test("e2e: /health reports booleans only and no secret value", async () => {
  const { env } = makeEnv();
  const r = await createWorker({ items: [ITEM] }).fetch(new Request("https://digital.test/health"), env);
  const txt = await r.text();
  assert.equal(r.status, 200);
  assert.doesNotMatch(txt, /sk_test|whsec|unit-test-token/);
  assert.equal(JSON.parse(txt).bindings.bucket, true);
});

test("e2e: with no D1 binding every digital route fails closed (503), /health still answers", async () => {
  const w = createWorker({ items: [ITEM], log: () => {} });
  assert.equal((await w.fetch(new Request("https://digital.test/digital/checkout", { method: "POST", body: "{}" }), {})).status, 503);
  assert.equal((await w.fetch(new Request("https://digital.test/health"), {})).status, 200);
});
