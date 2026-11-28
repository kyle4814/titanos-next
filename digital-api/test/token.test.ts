import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_DOWNLOADS, TOKEN_TTL_SEC, mintToken, verifyToken } from "../src/token.ts";
import { DigitalStore } from "../src/store.ts";
import { FakeD1, TOKEN_SECRET } from "./helpers.ts";

const NOW = 1_800_000_000;
const P = { o: "dp_order1", s: "demo-pack", e: NOW + TOKEN_TTL_SEC };

test("token: constants are 7 days and 5 downloads", () => { assert.equal(TOKEN_TTL_SEC, 7 * 86400); assert.equal(MAX_DOWNLOADS, 5); });

test("token: mint then verify round-trips the payload", async () => {
  const t = await mintToken(P, TOKEN_SECRET);
  const v = await verifyToken(t, TOKEN_SECRET, NOW);
  assert.deepEqual(v, { ok: true, payload: P });
  assert.match(t, /^v1\.[A-Za-z0-9_-]+\.[0-9a-f]{64}$/);
});

test("token: minting is deterministic (a retried webhook re-sends the same link)", async () => {
  assert.equal(await mintToken(P, TOKEN_SECRET), await mintToken(P, TOKEN_SECRET));
});

test("token: expiry is enforced at the boundary", async () => {
  const t = await mintToken(P, TOKEN_SECRET);
  assert.equal((await verifyToken(t, TOKEN_SECRET, P.e - 1)).ok, true);
  assert.deepEqual(await verifyToken(t, TOKEN_SECRET, P.e), { ok: false, reason: "expired" });
  assert.deepEqual(await verifyToken(t, TOKEN_SECRET, P.e + 86400), { ok: false, reason: "expired" });
});

test("token: wrong secret and tampered payload are rejected", async () => {
  const t = await mintToken(P, TOKEN_SECRET);
  assert.deepEqual(await verifyToken(t, "another-secret-0123456789abcdef", NOW), { ok: false, reason: "bad_signature" });
  const [v, body, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ ...P, e: P.e + 999999 })).toString("base64url");
  assert.deepEqual(await verifyToken(`${v}.${forged}.${sig}`, TOKEN_SECRET, NOW), { ok: false, reason: "bad_signature" });
  const swapped = Buffer.from(JSON.stringify({ ...P, s: "other-pack" })).toString("base64url");
  assert.equal((await verifyToken(`${v}.${swapped}.${sig}`, TOKEN_SECRET, NOW)).ok, false);
  assert.equal(body.length > 0, true);
});

test("token: malformed input never throws", async () => {
  for (const bad of [undefined, null, 42, "", "abc", "v1.x", "v2.a.b", "v1..", `v1.${"a".repeat(700)}.${"0".repeat(64)}`, "v1.a b.0000000000000000000000000000000000000000000000000000000000000000"])
    assert.equal((await verifyToken(bad, TOKEN_SECRET, NOW)).ok, false, String(bad).slice(0, 20));
  assert.equal((await verifyToken(await mintToken(P, TOKEN_SECRET), undefined, NOW)).ok, false);
});

test("token: a short secret refuses to mint", async () => { await assert.rejects(() => mintToken(P, "short"), /token_secret_too_short/); });

// ---- revoke and the download cap live in the order row (a token cannot be recalled) ----
async function order(store: DigitalStore, o: Partial<{ pi: string; exp: number }> = {}) {
  return store.createOrder({ id: "dp_order1", sessionId: "cs_test_abc12345", paymentIntent: o.pi ?? "pi_1", slug: "demo-pack", email: "a@b.co", amountCents: 4900, currency: "aud", livemode: false, tokenExpSec: o.exp ?? NOW + TOKEN_TTL_SEC, maxDownloads: MAX_DOWNLOADS, now: NOW * 1000 });
}

test("revoke: consumeDownload allows exactly 5, then refuses", async () => {
  const store = new DigitalStore(new FakeD1()); await order(store);
  for (let i = 0; i < 5; i++) assert.equal(await store.consumeDownload("dp_order1", NOW), "ok", `download ${i + 1}`);
  assert.equal(await store.consumeDownload("dp_order1", NOW), "limit");
  assert.equal((await store.orderById("dp_order1"))!.downloads, 5);
});

test("revoke: a refund or dispute revokes; later downloads are refused", async () => {
  const store = new DigitalStore(new FakeD1()); await order(store);
  assert.equal(await store.consumeDownload("dp_order1", NOW), "ok");
  assert.equal(await store.revokeByPaymentIntent("pi_1", "refunded", NOW * 1000), 1);
  assert.equal(await store.consumeDownload("dp_order1", NOW), "revoked");
  assert.equal(await store.revokeByPaymentIntent("pi_1", "refunded", NOW * 1000), 0, "second revoke changes nothing");
  assert.equal((await store.orderById("dp_order1"))!.revoke_reason, "refunded");
});

test("revoke: expiry is enforced by the order row too, and an unknown order is missing", async () => {
  const store = new DigitalStore(new FakeD1()); await order(store, { exp: NOW + 10 });
  assert.equal(await store.consumeDownload("dp_order1", NOW + 10), "expired");
  assert.equal(await store.consumeDownload("dp_nope", NOW), "missing");
});

test("store: createOrder is idempotent on the Stripe session id", async () => {
  const store = new DigitalStore(new FakeD1());
  const a = await order(store);
  const b = await store.createOrder({ id: "dp_other", sessionId: "cs_test_abc12345", paymentIntent: "pi_1", slug: "demo-pack", email: "z@z.co", amountCents: 1, currency: "aud", livemode: false, tokenExpSec: 1, maxDownloads: 5, now: 1 });
  assert.equal(b.id, a.id); assert.equal(b.email, "a@b.co");
});

test("store: the email lease allows one sender and never after the email went out", async () => {
  const store = new DigitalStore(new FakeD1()); await order(store);
  assert.equal(await store.leaseEmail("dp_order1", 1000), true);
  assert.equal(await store.leaseEmail("dp_order1", 2000), false, "held");
  assert.equal(await store.leaseEmail("dp_order1", 62_000), true, "lease expired");
  await store.markEmailed("dp_order1", 63_000);
  assert.equal(await store.leaseEmail("dp_order1", 500_000), false, "already emailed");
});
