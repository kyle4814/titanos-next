import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../src/app.ts";
import { MockMailer } from "../src/mailer.ts";
import { verifyStripeSignature } from "../../portal-api/src/stripe.ts";
import { ITEM, ITEM2, WEBHOOK_SECRET, completedEvent, disputeEvent, fakeStripeFetch, makeEnv, refundEvent, signedRequest, stripeSign } from "./helpers.ts";

const NOW = 1_800_000_000_000;
function rig(extra = {}) {
  const e = makeEnv(undefined, undefined, extra);
  const mailer = new MockMailer(); const clock = { t: NOW };
  const worker = createWorker({ now: () => clock.t, mailer, items: [ITEM, ITEM2], log: () => {} });
  const hook = (ev: unknown, o: { secret?: string; t?: number } = {}) => worker.fetch(signedRequest(ev, { now: clock.t, ...o }), e.env);
  return { ...e, mailer, clock, worker, hook };
}
const body = async (r: Response) => (await r.json()) as any;

// ---- signature, with Stripe's documented test signing and a FAKE secret ----
test("signature: a correctly signed payload verifies, any change fails", async () => {
  const payload = JSON.stringify({ id: "evt_1" }); const t = 1_800_000_000;
  const h = stripeSign(payload, WEBHOOK_SECRET, t);
  assert.equal(await verifyStripeSignature(payload, h, WEBHOOK_SECRET, t), true);
  assert.equal(await verifyStripeSignature(payload + " ", h, WEBHOOK_SECRET, t), false, "body changed");
  assert.equal(await verifyStripeSignature(payload, h, "whsec_other", t), false, "wrong secret");
  assert.equal(await verifyStripeSignature(payload, h, WEBHOOK_SECRET, t + 301), false, "outside the 300 s tolerance");
  assert.equal(await verifyStripeSignature(payload, null, WEBHOOK_SECRET, t), false, "no header");
  assert.equal(await verifyStripeSignature(payload, h, undefined, t), false, "no secret");
});

test("webhook: bad or missing signature is 400 and fulfils nothing", async () => {
  const r = rig();
  const ev = completedEvent({});
  assert.equal((await r.hook(ev, { secret: "whsec_wrong" })).status, 400);
  assert.equal((await r.hook(ev, { t: Math.floor(NOW / 1000) - 3600 })).status, 400, "stale timestamp (replay)");
  const unsigned = await r.worker.fetch(new Request("https://digital.test/digital/webhook", { method: "POST", body: JSON.stringify(ev) }), r.env);
  assert.equal(unsigned.status, 400);
  assert.equal(r.mailer.outbox.length, 0);
  assert.equal(Number((r.db.sql.prepare("SELECT COUNT(*) n FROM digital_orders").get() as any).n), 0);
});

test("webhook: no webhook secret configured fails closed (503)", async () => {
  const r = rig({ DIGITAL_WEBHOOK_SECRET: undefined });
  assert.equal((await r.hook(completedEvent({}))).status, 503);
});

// ---- fulfilment ----
test("webhook: completed + paid creates the order and emails one signed link", async () => {
  const r = rig();
  const res = await r.hook(completedEvent({}));
  assert.equal(res.status, 200); assert.deepEqual(await body(res), { result: "emailed" });
  assert.equal(r.mailer.outbox.length, 1);
  const m = r.mailer.outbox[0];
  assert.equal(m.to, "buyer@example.com", "email normalised");
  assert.match(m.text, /https:\/\/digital\.test\/digital\/download\?t=v1\.[\w-]+\.[0-9a-f]{64}/);
  assert.match(m.text, /up to 5 downloads/);
  assert.doesNotMatch(m.text, /[—–]/, "no em or en dashes in client copy");
  const o = r.db.sql.prepare("SELECT * FROM digital_orders").get() as any;
  assert.equal(o.status, "paid"); assert.equal(o.slug, "demo-pack"); assert.equal(o.amount_cents, 4900); assert.equal(o.currency, "aud");
  assert.equal(o.token_exp_sec, Math.floor(NOW / 1000) + 7 * 86400); assert.ok(o.emailed_at);
});

test("webhook: idempotent on event id (a duplicate delivery sends nothing)", async () => {
  const r = rig();
  await r.hook(completedEvent({}));
  const again = await r.hook(completedEvent({}));
  assert.deepEqual(await body(again), { result: "duplicate" });
  assert.equal(r.mailer.outbox.length, 1);
  assert.equal(Number((r.db.sql.prepare("SELECT COUNT(*) n FROM digital_orders").get() as any).n), 1);
});

test("webhook: a second event for the same session (async_payment_succeeded) never double-sends", async () => {
  const r = rig();
  await r.hook(completedEvent({ id: "evt_a" }));
  const res = await r.hook(completedEvent({ id: "evt_b", type: "checkout.session.async_payment_succeeded" }));
  assert.deepEqual(await body(res), { result: "already_emailed" });
  assert.equal(r.mailer.outbox.length, 1);
});

test("webhook: unpaid sessions, other kinds of checkout and unknown event types are ignored without burning the event id", async () => {
  const r = rig();
  assert.deepEqual(await body(await r.hook(completedEvent({ paid: false }))), { result: "ignored_unpaid" });
  assert.deepEqual(await body(await r.hook(completedEvent({ id: "evt_k", kind: "monitor" }))), { result: "ignored_not_digital" });
  assert.deepEqual(await body(await r.hook({ id: "evt_x", type: "customer.created", data: { object: {} } })), { result: "ignored" });
  assert.equal(r.mailer.outbox.length, 0);
  assert.equal(Number((r.db.sql.prepare("SELECT COUNT(*) n FROM digital_events").get() as any).n), 0);
  assert.deepEqual(await body(await r.hook(completedEvent({ id: "evt_unpaid", paid: false }))), { result: "ignored_unpaid" });
  assert.equal((await r.hook(completedEvent({ id: "evt_unpaid" }))).status, 200, "the paid event with the same id is still processed");
  assert.equal(r.mailer.outbox.length, 1);
});

test("webhook: a test event never fulfils a live shop (and the reverse)", async () => {
  const r = rig({ DIGITAL_STRIPE_MODE: "live" });
  assert.deepEqual(await body(await r.hook(completedEvent({ livemode: false }))), { result: "ignored_mode_mismatch" });
  assert.equal(r.mailer.outbox.length, 0);
});

test("webhook: if the mail fails the webhook is 500 (Stripe retries), no event is recorded, and the retry sends exactly one email", async () => {
  const r = rig();
  r.mailer.failNext = 1;
  assert.equal((await r.hook(completedEvent({}))).status, 500);
  assert.equal(r.mailer.outbox.length, 0);
  assert.equal(Number((r.db.sql.prepare("SELECT COUNT(*) n FROM digital_events").get() as any).n), 0);
  const retry = await r.hook(completedEvent({}));
  assert.deepEqual(await body(retry), { result: "emailed" });
  assert.equal(r.mailer.outbox.length, 1);
  assert.equal(Number((r.db.sql.prepare("SELECT COUNT(*) n FROM digital_orders").get() as any).n), 1, "still one order");
});

test("webhook: a paid session for a product that no longer exists is logged for a human, never emailed", async () => {
  const r = rig();
  const res = await r.hook(completedEvent({ slug: "gone-pack" }));
  assert.deepEqual(await body(res), { result: "order_logged_unknown_product" });
  assert.equal(r.mailer.outbox.length, 0);
  assert.equal((r.db.sql.prepare("SELECT slug FROM digital_orders").get() as any).slug, "gone-pack");
});

// ---- revocation ----
test("webhook: charge.refunded revokes; a partial refund keeps access", async () => {
  const r = rig();
  await r.hook(completedEvent({}));
  assert.deepEqual(await body(await r.hook(refundEvent({ id: "evt_p", refunded: false, amountRefunded: 1000 }))), { result: "partial_refund_kept" });
  assert.equal((r.db.sql.prepare("SELECT status FROM digital_orders").get() as any).status, "paid");
  assert.deepEqual(await body(await r.hook(refundEvent({}))), { result: "revoked" });
  const o = r.db.sql.prepare("SELECT status, revoke_reason FROM digital_orders").get() as any;
  assert.equal(o.status, "revoked"); assert.equal(o.revoke_reason, "refunded");
});

test("webhook: charge.dispute.created revokes", async () => {
  const r = rig();
  await r.hook(completedEvent({}));
  assert.deepEqual(await body(await r.hook(disputeEvent({}))), { result: "revoked" });
  assert.equal((r.db.sql.prepare("SELECT revoke_reason FROM digital_orders").get() as any).revoke_reason, "disputed");
});

test("webhook: a refund that arrives BEFORE its payment is held, and the order is born revoked with no email", async () => {
  const r = rig();
  assert.deepEqual(await body(await r.hook(refundEvent({}))), { result: "held_until_payment" });
  const res = await r.hook(completedEvent({}));
  assert.deepEqual(await body(res), { result: "revoked" });
  assert.equal(r.mailer.outbox.length, 0);
  assert.equal((r.db.sql.prepare("SELECT status FROM digital_orders").get() as any).status, "revoked");
});

// ---- checkout ----
test("checkout: price comes from the catalogue, never the client", async () => {
  const r = rig(); const s = fakeStripeFetch();
  const worker = createWorker({ now: () => NOW, fetchFn: s.fetchFn, items: [ITEM, ITEM2], log: () => {} });
  const res = await worker.fetch(new Request("https://digital.test/digital/checkout", { method: "POST", headers: { "cf-connecting-ip": "203.0.113.9" }, body: JSON.stringify({ slug: "demo-pack", priceAud: 0.01, amount: 1, unit_amount: 1, price: 1, currency: "usd" }) }), r.env);
  assert.equal(res.status, 201);
  assert.match((await body(res)).url, /^https:\/\/checkout\.stripe\.test\//);
  const f = s.calls[0].form;
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), "4900");
  assert.equal(f.get("line_items[0][price_data][currency]"), "aud");
  assert.equal(f.get("metadata[slug]"), "demo-pack"); assert.equal(f.get("metadata[kind]"), "digital");
  assert.equal(f.get("success_url"), "https://titanos.tech/order/digital/thanks?s={CHECKOUT_SESSION_ID}");
  assert.equal(s.calls[0].headers.authorization, "Bearer sk_test_fake_key_for_unit_tests");
});

test("checkout: unknown or malformed slug is 404, bad email is 400, no key is 503, a live key in test mode is refused", async () => {
  const s = fakeStripeFetch();
  const call = async (env: any, b: unknown) => createWorker({ now: () => NOW, fetchFn: s.fetchFn, items: [ITEM], log: () => {} }).fetch(new Request("https://digital.test/digital/checkout", { method: "POST", body: JSON.stringify(b) }), env);
  const { env } = makeEnv();
  assert.equal((await call(env, { slug: "nope" })).status, 404);
  assert.equal((await call(env, { slug: "../../etc" })).status, 404);
  assert.equal((await call(env, { slug: "demo-pack", email: "not-an-email" })).status, 400);
  assert.equal((await call({ ...env, DIGITAL_STRIPE_SECRET_KEY: undefined }, { slug: "demo-pack" })).status, 503);
  assert.equal((await call({ ...env, DIGITAL_STRIPE_SECRET_KEY: "sk_live_fake" }, { slug: "demo-pack" })).status, 502, "mode mismatch refuses");
  assert.equal(s.calls.length, 0, "nothing reached Stripe");
});

test("checkout: per-IP hourly limit", async () => {
  const s = fakeStripeFetch(); const { env } = makeEnv();
  const w = createWorker({ now: () => NOW, fetchFn: s.fetchFn, items: [ITEM], log: () => {} });
  const go = () => w.fetch(new Request("https://digital.test/digital/checkout", { method: "POST", headers: { "cf-connecting-ip": "198.51.100.7" }, body: JSON.stringify({ slug: "demo-pack" }) }), env);
  for (let i = 0; i < 20; i++) assert.equal((await go()).status, 201);
  assert.equal((await go()).status, 429);
});

test("cors: only the two browser routes carry the site origin; the webhook and download do not", async () => {
  const r = rig();
  const pre = await r.worker.fetch(new Request("https://digital.test/digital/checkout", { method: "OPTIONS" }), r.env);
  assert.equal(pre.status, 204); assert.equal(pre.headers.get("access-control-allow-origin"), "https://titanos.tech");
  const dl = await r.worker.fetch(new Request("https://digital.test/digital/download?t=x"), r.env);
  assert.equal(dl.headers.get("access-control-allow-origin"), null);
});
