// F176: the F19 per-key spend cap is enforced on the LIVE MCP path (callTool -> store.creditDebitCapped).
// Runs on both adapters: MemoryStore and the D1 agent store over a fake D1. Synthetic data only. domain_check costs 5 credits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { make } from "./harness.ts";
import { SCOPES } from "../src/agent/tools.ts";
import { DAY_MS, MAX_KEY_CAP_DAILY, MAX_KEY_CAP_TOTAL } from "../src/agent/caps.ts";

type H = ReturnType<typeof make>;
let rid = 0;
const call = async (h: H, key: string, args: unknown, headers: Record<string, string> = {}) =>
  h.j(await h.req("POST", "/mcp", { token: key, headers, body: { jsonrpc: "2.0", id: ++rid, method: "tools/call", params: { name: "domain_check", arguments: args } } }));
const D = { domain: "good.example.com.au" };

async function setup(d1: boolean, caps: { capDaily?: number; capTotal?: number }) {
  const h = make({ d1 });
  h.dns.zone["good.example.com.au"] = ["v=spf1 include:_spf.google.com -all"]; h.dns.zone["_dmarc.good.example.com.au"] = ["v=DMARC1; p=reject; rua=mailto:d@good.example.com.au"];
  const s = await h.login("cap@example.com.au");
  const k = await h.j(await h.req("POST", "/keys", { token: s.session, body: { scopes: [...SCOPES] } }));
  await h.req("POST", "/agent/credits/topup", { token: s.session, body: { pack: "credits_2000" } });
  const order = [...h.store.creditOrders.values()].at(-1)!;
  await h.webhook("checkout.session.completed", { id: order.checkoutId, payment_status: "paid" });
  const row = (await h.store.keyById(k.id))!;
  await h.store.putKey({ ...row, ...caps });
  const spend = async () => h.store.keySpend(k.id, Math.floor(h.clock.t / DAY_MS) * DAY_MS, s.account.id);
  return { h, key: k.key as string, keyId: k.id as string, accountId: s.account.id as string, spend };
}

for (const d1 of [false, true]) {
  const tag = d1 ? "d1" : "memory";

  test(`spendcap wire [${tag}]: cap hit mid-session is a JSON-RPC error in the F39 shape, charges nothing, writes no receipt`, async () => {
    const { h, key, keyId, accountId, spend } = await setup(d1, { capDaily: 10 });
    assert.ok((await call(h, key, D)).result.structuredContent.receipt, "call 1 ok");
    assert.ok((await call(h, key, D)).result.structuredContent.receipt, "call 2 ok: spend 10 is allowed at cap 10");
    const bal = await h.store.creditBalance(accountId), receipts = (await h.store.receiptsForKey(keyId, 100, accountId)).length;
    const r = await call(h, key, D);
    assert.equal(r.result, undefined, "a JSON-RPC error, not a tool result");
    assert.equal(r.jsonrpc, "2.0"); assert.equal(typeof r.id, "number");
    assert.equal(r.error.code, -32002); assert.equal(r.error.message, "key_spend_cap");
    assert.deepEqual(r.error.data, { status: 429, error: "key_spend_cap", cap: "daily", needed: 5, charged: 0 });
    assert.equal(await h.store.creditBalance(accountId), bal, "nothing debited");
    assert.equal((await h.store.receiptsForKey(keyId, 100, accountId)).length, receipts, "no receipt for a refused call");
    assert.deepEqual(await spend(), { day: 10, total: 10 });
  });

  test(`spendcap wire [${tag}]: daily cap resets on the next UTC day; the total cap does not`, async () => {
    const { h, key, spend } = await setup(d1, { capDaily: 5, capTotal: 10 });
    assert.ok((await call(h, key, D)).result);
    assert.equal((await call(h, key, D)).error.data.cap, "daily");
    h.clock.t += DAY_MS;
    assert.ok((await call(h, key, D)).result, "new day, daily cap free again");
    assert.equal((await spend()).day, 5);
    h.clock.t += DAY_MS;
    const r = await call(h, key, D);
    assert.equal(r.error.data.cap, "total", "lifetime spend 10 hit the total cap even on a fresh day");
  });

  test(`spendcap wire [${tag}]: a key with caps at the maximum behaves as before (balance is the only limit)`, async () => {
    const { h, key, accountId } = await setup(d1, { capDaily: MAX_KEY_CAP_DAILY, capTotal: MAX_KEY_CAP_TOTAL });
    for (let i = 0; i < 20; i++) assert.ok((await call(h, key, D)).result.structuredContent.receipt, `call ${i}`);
    assert.equal(await h.store.creditBalance(accountId), 2000 - 100);
    await h.store.creditApply(accountId, -1898, "debit", "drain", 0);
    const r = await call(h, key, D);
    assert.equal(r.result.structuredContent.error, "insufficient_credits"); assert.equal(r.result.isError, true);
  });

  test(`spendcap wire [${tag}]: an idempotent replay is not double counted, and a cap-refused call frees its Idempotency-Key`, async () => {
    const { h, key, spend } = await setup(d1, { capDaily: 5 });
    const a = await call(h, key, D, { "idempotency-key": "idem-1" });
    assert.ok(a.result.structuredContent.receipt);
    const b = await call(h, key, D, { "idempotency-key": "idem-1" });
    assert.equal(b.result.structuredContent.replayed, true, "replay served even though a fresh call would exceed the cap");
    assert.equal(b.result.structuredContent.receipt.id, a.result.structuredContent.receipt.id);
    assert.deepEqual(await spend(), { day: 5, total: 5 }, "spend counted once");
    const c = await call(h, key, D, { "idempotency-key": "idem-2" });
    assert.equal(c.error.message, "key_spend_cap");
    h.clock.t += DAY_MS;
    const e = await call(h, key, D, { "idempotency-key": "idem-2" });
    assert.ok(e.result.structuredContent.receipt && !e.result.structuredContent.replayed, "the refused key was released, so it can be used once the cap resets");
  });

  test(`spendcap wire [${tag}]: parallel calls cannot overshoot the cap`, async () => {
    const { h, key, spend } = await setup(d1, { capDaily: 20 });
    const rs = await Promise.all(Array.from({ length: 10 }, () => call(h, key, D)));
    assert.equal(rs.filter((r) => r.result?.structuredContent?.receipt).length, 4);
    assert.equal(rs.filter((r) => r.error?.message === "key_spend_cap").length, 6);
    assert.deepEqual(await spend(), { day: 20, total: 20 });
  });
}
