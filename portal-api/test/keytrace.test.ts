// F48: key-prefix abuse tracing and versioned receipt secrets. Synthetic accounts only (example.com.au).
import test from "node:test";
import assert from "node:assert/strict";
import { make } from "./harness.ts";
import { SCOPES } from "../src/agent/tools.ts";
import { rotate, signWithRing, verifyWithRing, ringOf, type ReceiptKeyring } from "../src/agent/receipt.ts";
import { sha256Hex } from "../src/util.ts";

type H = ReturnType<typeof make>;
const OP = "op_test_fixture_secret";
async function agent(h: H, email: string) {
  const s = await h.login(email);
  const k = await h.j(await h.req("POST", "/keys", { token: s.session, body: { scopes: [...SCOPES] } }));
  return { accountId: s.account.id as string, key: k.key as string, keyId: k.id as string };
}
let rid = 0;
const call = async (h: H, key: string, name: string, args: unknown = {}) =>
  h.j(await h.req("POST", "/mcp", { token: key, body: { jsonrpc: "2.0", id: ++rid, method: "tools/call", params: { name, arguments: args } } }));
const trace = (h: H, q: string, secret: string | null = OP) => h.req("GET", `/internal/keys/trace?${q}`, { headers: secret ? { "x-operator-secret": secret } : {} });
function withOp() { const h = make(); h.deps.operatorSecret = OP; const logs: string[] = []; h.deps.log = (l) => logs.push(l); return { h, logs }; }

test("lookup by prefix hits exactly one account and lists its recent calls", async () => {
  const { h } = withOp(); const a = await agent(h, "a@example.com.au"); const b = await agent(h, "b@example.com.au");
  await call(h, a.key, "catalogue_list"); await call(h, a.key, "price_quote", { product: "monitor_monthly" });
  const r = await h.j(await trace(h, `prefix=${a.keyId.slice(0, 8)}`));
  assert.equal(r.matches, 1); assert.equal(r.ambiguous, false);
  assert.equal(r.hits[0].accountId, a.accountId); assert.equal(r.hits[0].keyId, a.keyId);
  assert.deepEqual(r.hits[0].recentCalls.map((c: any) => c.tool).sort(), ["catalogue_list", "price_quote"]);
  assert.ok(!JSON.stringify(r).includes(b.accountId), "other tenant absent");
});
test("ambiguous prefix returns every match, still with no secret material", async () => {
  const { h } = withOp(); const a = await agent(h, "a@example.com.au"); const b = await agent(h, "b@example.com.au");
  const forced = { ...(await h.deps.store.keyById(b.keyId))!, id: a.keyId.slice(0, 8) + "ffffffff", hash: await sha256Hex("tk_forced_secret_zzz") };
  await h.deps.store.putKey(forced);
  const r = await h.j(await trace(h, `prefix=${a.keyId.slice(0, 8)}`));
  assert.equal(r.matches, 2); assert.equal(r.ambiguous, true);
  assert.deepEqual(r.hits.map((x: any) => x.accountId).sort(), [a.accountId, b.accountId].sort());
});
test("no secret, token or hash ever appears in the lookup output or the audit log", async () => {
  const { h, logs } = withOp(); const a = await agent(h, "a@example.com.au"); await call(h, a.key, "catalogue_list");
  const hash = (await h.deps.store.keyById(a.keyId))!.hash;
  const text = await (await trace(h, `prefix=${a.keyId.slice(0, 8)}`)).text();
  const all = text + logs.join("\n");
  for (const bad of [a.key, a.key.slice(3), hash, OP, "rcpt_test_fixture_secret", '"hash"', '"sig"']) assert.ok(!all.includes(bad), `leaked ${bad.slice(0, 6)}`);
  assert.ok(logs.length === 1 && logs[0].startsWith("keytrace prefix="));
});
test("account scope: a scoped lookup never reveals another tenant's key", async () => {
  const { h } = withOp(); const a = await agent(h, "a@example.com.au"); const b = await agent(h, "b@example.com.au");
  const r = await h.j(await trace(h, `prefix=${a.keyId.slice(0, 8)}&account=${b.accountId}`));
  assert.equal(r.matches, 0);
});
test("operator door fails closed: no header, wrong secret, or unset server secret = 401; short or odd prefix = 400", async () => {
  const { h } = withOp(); const a = await agent(h, "a@example.com.au"); const p = a.keyId.slice(0, 8);
  assert.equal((await trace(h, `prefix=${p}`, null)).status, 401);
  assert.equal((await trace(h, `prefix=${p}`, "wrong")).status, 401);
  assert.equal((await trace(h, `prefix=${a.key.slice(0, 8)}`, "")).status, 401);
  assert.equal((await trace(h, "prefix=key_", OP)).status, 400);
  assert.equal((await trace(h, "prefix=%25%25%25%25%25%25", OP)).status, 400);
  h.deps.operatorSecret = undefined;
  assert.equal((await trace(h, `prefix=${p}`, "")).status, 401);
  assert.equal((await h.req("GET", `/internal/keys/trace?prefix=${p}`, { token: a.key })).status, 401, "an agent key is not an operator");
});
test("the prefix is not a credential: calling with a key id as the bearer is refused (secret path unchanged)", async () => {
  const { h } = withOp(); const a = await agent(h, "a@example.com.au");
  assert.equal((await h.req("POST", "/mcp", { token: a.keyId, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } })).status, 401);
  assert.equal((await h.req("POST", "/mcp", { token: a.key, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } })).status, 200);
});

const ring0: ReceiptKeyring = { current: { kid: "k1", secret: "secret_one_fixture" } };
const base = { id: "rcpt_x", tool: "t", keyId: "key_x", accountId: "acc_x", at: 1, inputSha: "i", outputSha: "o", credits: 0, mode: "free" as const };
test("receipts carry the kid; old receipts still verify after one rotation but not after two", async () => {
  const r1 = await signWithRing(ring0, base); assert.equal(r1.kid, "k1");
  assert.equal(await verifyWithRing(ring0, r1), true);
  const ring1 = rotate(ring0, { kid: "k2", secret: "secret_two_fixture" });
  assert.equal(await verifyWithRing(ring1, r1), true, "previous secret still accepted");
  const r2 = await signWithRing(ring1, base); assert.equal(r2.kid, "k2"); assert.equal(await verifyWithRing(ring1, r2), true);
  const ring2 = rotate(ring1, { kid: "k3", secret: "secret_three_fixture" });
  assert.equal(await verifyWithRing(ring2, r1), false, "oldest dropped after the second rotation");
  assert.equal(await verifyWithRing(ring2, r2), true);
});
test("unknown, missing and tampered kid are rejected", async () => {
  const ring1 = rotate(ring0, { kid: "k2", secret: "secret_two_fixture" });
  const r1 = await signWithRing(ring0, base), r2 = await signWithRing(ring1, base);
  assert.equal(await verifyWithRing(ring1, { ...r1, kid: "k9" }), false, "unknown kid");
  assert.equal(await verifyWithRing(ring1, { ...r1, kid: undefined }), false, "missing kid");
  assert.equal(await verifyWithRing(ring1, { ...r1, kid: "k2" }), false, "kid swapped to the current secret");
  assert.equal(await verifyWithRing(ring1, { ...r2, kid: "k1" }), false, "kid swapped to the previous secret");
  assert.equal(await verifyWithRing(ring1, { ...r2, credits: 5 }), false, "body tamper");
  assert.equal(await verifyWithRing(undefined, r2), false, "no ring fails closed");
  assert.throws(() => rotate(ring1, { kid: "k1", secret: "reuse" }), /kid already used/);
  assert.throws(() => rotate(ring0, { kid: "", secret: "x" }));
});
test("end to end: a receipt issued before rotation verifies over HTTP after one rotation, not after two", async () => {
  const { h } = withOp(); const a = await agent(h, "a@example.com.au");
  const rc = (await call(h, a.key, "catalogue_list")).result.structuredContent.receipt; assert.equal(rc.kid, "k1");
  const ver = async (r: unknown) => (await h.j(await h.req("POST", "/agent/receipts/verify", { body: { receipt: r } }))).valid;
  assert.equal(await ver(rc), true);
  h.deps.receiptKeyring = rotate(ringOf(h.deps)!, { kid: "k2", secret: "secret_two_fixture" });
  assert.equal(await ver(rc), true);
  const rc2 = (await call(h, a.key, "catalogue_list")).result.structuredContent.receipt; assert.equal(rc2.kid, "k2");
  assert.equal((await call(h, a.key, "receipt_verify", { receipt_id: rc.id })).result.structuredContent.result.valid, true);
  h.deps.receiptKeyring = rotate(h.deps.receiptKeyring, { kid: "k3", secret: "secret_three_fixture" });
  assert.equal(await ver(rc), false); assert.equal(await ver(rc2), true);
  assert.equal((await call(h, a.key, "receipt_verify", { receipt_id: rc.id })).result.structuredContent.result.valid, false);
});
test("the kid is inside the signature: relabelling a receipt fails even if two kids share a secret", async () => {
  const shared: ReceiptKeyring = { current: { kid: "k2", secret: "same_secret_fixture" }, previous: { kid: "k1", secret: "same_secret_fixture" } };
  const r = await signWithRing({ current: { kid: "k1", secret: "same_secret_fixture" } }, base);
  assert.equal(await verifyWithRing(shared, r), true);
  assert.equal(await verifyWithRing(shared, { ...r, kid: "k2" }), false);
});
