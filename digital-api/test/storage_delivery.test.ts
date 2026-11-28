// KV storage, the checkout master switch, the Stripe success-page path and the kernel-mailer hand-off (no Worker mail transport).
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createWorker } from "../src/app.ts";
import { KvStorage, kvKey, storageFor } from "../src/storage.ts";
import { ITEM, ZIP, completedEvent, makeEnv, signedRequest, FakeBucket } from "./helpers.ts";

const NOW = 1_800_000_000_000;
class FakeKV { store = new Map<string, Uint8Array>(); async get(k: string, _t: "arrayBuffer") { const b = this.store.get(k); return b ? (b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer) : null; } }
const stripeSession = (o: Record<string, unknown> = {}) => ({ id: "cs_test_kvsession01", payment_status: "paid", livemode: false, payment_intent: "pi_kv", amount_total: 4900, currency: "aud", customer_details: { email: "Kv@Example.com" }, metadata: { kind: "digital", slug: "demo-pack" }, ...o });
const stripeGet = (sess: unknown, status = 200) => (async (url: string) => { assert.match(String(url), /^https:\/\/api\.stripe\.com\/v1\/checkout\/sessions\/cs_/); return new Response(JSON.stringify(sess), { status }); }) as unknown as typeof fetch;

test("storage: the catalogue key maps to products/<slug>.zip in KV and the bytes round-trip with the same sha256", async () => {
  assert.equal(kvKey("products/demo-pack/demo-pack.zip"), "products/demo-pack.zip");
  const kv = new FakeKV(); kv.store.set("products/demo-pack.zip", ZIP);
  const got = await new KvStorage(kv).get(ITEM.r2Key);
  assert.ok(got); assert.equal(got!.size, ZIP.length);
  const bytes = new Uint8Array(await new Response(got!.body).arrayBuffer());
  assert.equal(createHash("sha256").update(bytes).digest("hex"), createHash("sha256").update(ZIP).digest("hex"));
  assert.equal(await new KvStorage(kv).get("products/nope/nope.zip"), null);
});

test("storage: R2 binding wins when present, KV is used otherwise, none is none", () => {
  const kv = new FakeKV(), b = new FakeBucket();
  assert.equal(storageFor({ DIGITAL_BUCKET: b, DIGITAL_FILES: kv }), b);
  assert.ok(storageFor({ DIGITAL_FILES: kv }) instanceof KvStorage);
  assert.equal(storageFor({}), undefined);
});

test("download: served from KV end to end after a webhook-recorded order", async () => {
  const kv = new FakeKV(); kv.store.set("products/demo-pack.zip", ZIP);
  const { env } = makeEnv(); delete env.DIGITAL_BUCKET; env.DIGITAL_FILES = kv;
  const w = createWorker({ now: () => NOW, items: [ITEM], log: () => {} });
  const r = await w.fetch(signedRequest(completedEvent({ session: "cs_test_kvsession01" }), { now: NOW }), env);
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { result: "queued_for_kernel_mailer" });
  const st = (await (await w.fetch(new Request("https://digital.test/digital/order?s=cs_test_kvsession01"), env)).json()) as any;
  assert.equal(st.state, "processing");
  const dl = await w.fetch(new Request(st.download_url), env);
  assert.equal(dl.status, 200);
  assert.deepEqual(new Uint8Array(await dl.arrayBuffer()), ZIP);
  const h = (await (await w.fetch(new Request("https://digital.test/health"), env)).json()) as any;
  assert.equal(h.bindings.storage, "kv");
});

test("checkout: disabled unless DIGITAL_CHECKOUT_ENABLED is exactly true, and Stripe is never called", async () => {
  for (const v of [undefined, "false", "1", "TRUE"]) {
    const { env } = makeEnv(); if (v === undefined) delete env.DIGITAL_CHECKOUT_ENABLED; else env.DIGITAL_CHECKOUT_ENABLED = v;
    let called = 0; const fetchFn = (async () => { called++; return new Response("{}"); }) as unknown as typeof fetch;
    const w = createWorker({ now: () => NOW, items: [ITEM], fetchFn, log: () => {} });
    const r = await w.fetch(new Request("https://digital.test/digital/checkout", { method: "POST", body: JSON.stringify({ slug: "demo-pack" }) }), env);
    assert.equal(r.status, 503); assert.deepEqual(await r.json(), { error: "checkout_disabled" }); assert.equal(called, 0);
  }
});

test("success page: no webhook yet, Stripe says paid -> order recorded, link shown, emailed_at stays NULL for the kernel mailer", async () => {
  const { env, db } = makeEnv();
  const w = createWorker({ now: () => NOW, items: [ITEM], fetchFn: stripeGet(stripeSession()), log: () => {} });
  const j = (await (await w.fetch(new Request("https://digital.test/digital/order?s=cs_test_kvsession01"), env)).json()) as any;
  assert.equal(j.state, "processing"); assert.match(j.download_url, /digital\/download\?t=/);
  const row = db.sql.prepare("SELECT email, emailed_at, status FROM digital_orders").get() as any;
  assert.deepEqual({ ...row }, { email: "kv@example.com", emailed_at: null, status: "paid" });
  // the webhook arriving afterwards reuses the same order (idempotent on session id), no second row
  await w.fetch(signedRequest(completedEvent({ session: "cs_test_kvsession01", pi: "pi_kv" }), { now: NOW }), env);
  assert.equal((db.sql.prepare("SELECT COUNT(*) AS n FROM digital_orders").get() as any).n, 1);
});

test("success page: unpaid, wrong mode, non-digital, Stripe error or fake id all stay pending and record nothing", async () => {
  for (const [sess, status] of [[stripeSession({ payment_status: "unpaid" }), 200], [stripeSession({ livemode: true }), 200], [stripeSession({ metadata: { kind: "other" } }), 200], [{ error: {} }, 404], [stripeSession({ id: "cs_test_someoneelse1" }), 200]] as const) {
    const { env, db } = makeEnv();
    const w = createWorker({ now: () => NOW, items: [ITEM], fetchFn: stripeGet(sess, status), log: () => {} });
    const r = await w.fetch(new Request("https://digital.test/digital/order?s=cs_test_kvsession01"), env);
    assert.deepEqual(await r.json(), { state: "pending" });
    assert.equal((db.sql.prepare("SELECT COUNT(*) AS n FROM digital_orders").get() as any).n, 0);
  }
  const { env } = makeEnv();
  const w = createWorker({ now: () => NOW, items: [ITEM], log: () => {} });
  assert.equal((await w.fetch(new Request("https://digital.test/digital/order?s=not-a-session"), env)).status, 400);
});

test("unknown or revoked download token: 403 / 410, never a file; /digital/get answers 404 for a missing order", async () => {
  const { env } = makeEnv();
  const w = createWorker({ now: () => NOW, items: [ITEM], log: () => {} });
  const bad = await w.fetch(new Request("https://digital.test/digital/download?t=v1.nope.nope"), env);
  assert.ok([403, 404, 410].includes(bad.status));
  assert.equal((await w.fetch(new Request("https://digital.test/digital/get?s=cs_test_doesnotexist1"), env)).status, 404);
});

test("/digital/get: paid order 302s to a signed download that streams; revoked order is 410", async () => {
  const { env } = makeEnv();
  const w = createWorker({ now: () => NOW, items: [ITEM], log: () => {} });
  await w.fetch(signedRequest(completedEvent({ session: "cs_test_kvsession01", pi: "pi_kv" }), { now: NOW }), env);
  const g = await w.fetch(new Request("https://digital.test/digital/get?s=cs_test_kvsession01", { redirect: "manual" }), env);
  assert.equal(g.status, 302);
  const dl = await w.fetch(new Request(g.headers.get("location")!), env);
  assert.equal(dl.status, 200);
  await w.fetch(signedRequest({ id: "evt_ref", type: "charge.refunded", livemode: false, data: { object: { payment_intent: "pi_kv", refunded: true, amount: 4900, amount_refunded: 4900 } } }, { now: NOW }), env);
  assert.equal((await w.fetch(new Request("https://digital.test/digital/get?s=cs_test_kvsession01"), env)).status, 410);
  assert.equal((await w.fetch(new Request(g.headers.get("location")!), env)).status, 410);
});

test("NO WEBHOOK SECRET at all: a paid buyer still gets the download link from the success page (session retrieved from Stripe) and the file streams", async () => {
  const kv = new FakeKV(); kv.store.set("products/demo-pack.zip", ZIP);
  const { env } = makeEnv(); delete env.DIGITAL_WEBHOOK_SECRET; delete env.DIGITAL_BUCKET; env.DIGITAL_FILES = kv;
  const w = createWorker({ now: () => NOW, items: [ITEM], fetchFn: stripeGet(stripeSession()), log: () => {} });
  const j = (await (await w.fetch(new Request("https://digital.test/digital/order?s=cs_test_kvsession01"), env)).json()) as any;
  assert.match(j.download_url, /digital\/download\?t=/);
  const dl = await w.fetch(new Request(j.download_url), env);
  assert.equal(dl.status, 200); assert.deepEqual(new Uint8Array(await dl.arrayBuffer()), ZIP);
  // and the webhook route answers 503 (Stripe retries) rather than pretending
  assert.equal((await w.fetch(signedRequest(completedEvent({}), { now: NOW }), env)).status, 503);
});
