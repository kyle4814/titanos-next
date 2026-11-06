import { test } from "node:test";
import assert from "node:assert/strict";
import { make, RECEIPT_SECRET } from "./harness.ts";
import { TOOLS, SCOPES } from "../src/agent/tools.ts";
import { verifyReceipt } from "../src/agent/receipt.ts";
import { agentCard, toolsJson } from "../src/agent/files.ts";
import { handle } from "../src/index.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
type H = ReturnType<typeof make>;

async function agent(h: H, email = "bot@example.com.au", scopes: string[] = [...SCOPES, "scan:read"]) {
  const s = await h.login(email);
  const k = await h.j(await h.req("POST", "/keys", { token: s.session, body: { scopes } }));
  return { session: s.session, accountId: s.account.id, key: k.key as string, keyId: k.id as string };
}
let rid = 0;
const rpc = (h: H, key: string | undefined, method: string, params?: unknown, headers: Record<string, string> = {}) =>
  h.req("POST", "/mcp", { token: key, body: { jsonrpc: "2.0", id: ++rid, method, params }, headers });
const call = async (h: H, key: string, name: string, args: unknown = {}, headers: Record<string, string> = {}) => h.j(await rpc(h, key, "tools/call", { name, arguments: args }, headers));
async function topup(h: H, a: { session: string; accountId: string }, pack = "credits_2000") {
  const t = await h.j(await h.req("POST", "/agent/credits/topup", { token: a.session, body: { pack } }));
  const order = [...h.store.creditOrders.values()].at(-1)!;
  const r = await h.webhook("checkout.session.completed", { id: order.checkoutId, payment_status: "paid" });
  return { t, r };
}
const setDns = (h: H) => { h.dns.zone["good.example.com.au"] = ["v=spf1 include:_spf.google.com -all"]; h.dns.zone["_dmarc.good.example.com.au"] = ["v=DMARC1; p=reject; rua=mailto:d@good.example.com.au"]; h.dns.zone["bad.example.com.au"] = ["v=spf1 +all"]; };

// ---------- auth and protocol ----------
test("mcp: no key, wrong key, revoked key, deleted account are all 401; GET is 405", async () => {
  const h = make();
  assert.equal((await rpc(h, undefined, "ping")).status, 401);
  assert.equal((await rpc(h, "tk_" + "0".repeat(48), "ping")).status, 401);
  assert.equal((await rpc(h, "ss_nothex", "ping")).status, 401, "a session token is not an API key");
  assert.equal((await h.req("GET", "/mcp")).status, 405);
  const a = await agent(h);
  assert.equal((await rpc(h, a.key, "ping")).status, 200);
  await h.req("DELETE", `/keys/${a.keyId}`, { token: a.session });
  assert.equal((await rpc(h, a.key, "ping")).status, 401);
  const b = await agent(h, "bot2@example.com.au");
  await h.req("DELETE", "/account", { token: b.session, body: { confirm: "DELETE" } });
  assert.equal((await rpc(h, b.key, "ping")).status, 401);
});
test("mcp: initialize, notifications get 202, unknown method -32601, batch and malformed refused", async () => {
  const h = make(); const a = await agent(h);
  const init = await h.j(await rpc(h, a.key, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } }));
  assert.equal(init.result.protocolVersion, "2025-03-26"); assert.equal(init.result.serverInfo.name, "titanos"); assert.ok(init.result.capabilities.tools);
  assert.equal((await rpc(h, a.key, "notifications/initialized")).status, 202);
  assert.equal((await h.j(await rpc(h, a.key, "nope"))).error.code, -32601);
  const batch = await h.j(await h.req("POST", "/mcp", { token: a.key, body: [{ jsonrpc: "2.0", id: 1, method: "ping" }] }));
  assert.equal(batch.error.code, -32600);
  const raw = await handle(new Request("https://api.test/mcp", { method: "POST", headers: { authorization: `Bearer ${a.key}` }, body: "{not json" }), {}, h.deps);
  assert.equal((await raw.json() as any).error.code, -32700); assert.equal(raw.status, 400);
});

// ---------- scopes ----------
test("scopes: tools/list shows only what the key may call; a call outside scope is denied and not charged", async () => {
  const h = make(); const a = await agent(h, "narrow@example.com.au", ["catalogue:read"]);
  const list = await h.j(await rpc(h, a.key, "tools/list"));
  assert.deepEqual(list.result.tools.map((t: any) => t.name).sort(), ["catalogue_list", "price_quote"]);
  const denied = await call(h, a.key, "domain_check", { domain: "good.example.com.au" });
  assert.equal(denied.result.isError, true); assert.equal(denied.result.structuredContent.error, "scope_denied");
  assert.equal(h.store.receipts.size, 0, "no receipt for a denied call");
  assert.equal((await call(h, a.key, "no_such_tool")).error.code, -32602);
  const none = await agent(h, "none@example.com.au", []);
  assert.equal((await h.j(await rpc(h, none.key, "tools/list"))).result.tools.length, 0);
});

// ---------- receipt test for EVERY tool ----------
const FIXTURES: Record<string, { args: unknown; headers?: Record<string, string>; check(out: any): void; needsCredits?: boolean }> = {
  catalogue_list: { args: {}, check: (o) => assert.ok(o.products.length >= 10 && o.products.every((p: any) => p.currency === "aud")) },
  price_quote: { args: { product: "monitor_monthly" }, check: (o) => { assert.equal(o.amountCents, 14900); assert.equal(o.gstIncluded, false); } },
  domain_check: { args: { domain: "bad.example.com.au" }, needsCredits: true, check: (o) => { assert.deepEqual(o.findings.map((f: any) => f.id).sort(), ["dmarc_missing", "spf_allow_all"]); assert.equal(o.grade, "D"); } },
  my_domains: { args: {}, check: (o) => assert.ok(Array.isArray(o.domains)) },
  credits_balance: { args: {}, check: (o) => assert.equal(typeof o.balance, "number") },
  explain_finding: { args: { finding: "dmarc_missing" }, needsCredits: true, check: (o) => { assert.equal(o.explanation, "MOCK EXPLANATION"); assert.match(o.fix, /_dmarc/); } },
  receipt_verify: { args: { receipt_id: "PLACEHOLDER" }, check: (o) => assert.deepEqual(o, { found: true, valid: true, tool: "catalogue_list", at: o.at, credits: 0, mode: "free" }) },
};
test("receipt test: the fixture table covers EVERY tool in the catalogue (a new tool without a test fails here)", () => {
  assert.deepEqual(Object.keys(FIXTURES).sort(), TOOLS.map((t) => t.name).sort());
});
for (const t of TOOLS) {
  test(`receipt test: ${t.name} returns a valid signed receipt that matches the call`, async () => {
    const h = make(); setDns(h); const a = await agent(h);
    const fx = FIXTURES[t.name];
    if (fx.needsCredits) await topup(h, a);
    let args = fx.args as any;
    if (t.name === "receipt_verify") { const first = await call(h, a.key, "catalogue_list"); args = { receipt_id: first.result.structuredContent.receipt.id }; }
    const before = await h.store.creditBalance(a.accountId);
    const r = await call(h, a.key, t.name, args);
    const sc = r.result.structuredContent;
    assert.equal(r.result.isError, false, JSON.stringify(sc));
    fx.check(sc.result);
    const rc = sc.receipt;
    assert.equal(rc.tool, t.name); assert.equal(rc.keyId, a.keyId); assert.equal(rc.accountId, a.accountId);
    assert.equal(rc.credits, t.credits); assert.equal(rc.mode, t.credits === 0 ? "free" : "prepaid");
    assert.match(rc.id, /^rcpt_[0-9a-f]{24}$/); assert.match(rc.sig, /^[0-9a-f]{64}$/);
    assert.equal(await verifyReceipt(RECEIPT_SECRET, rc), true, "signature verifies");
    assert.equal(rc.inputSha, await (await import("../src/agent/receipt.ts")).hashOf(args));
    assert.equal(rc.outputSha, await (await import("../src/agent/receipt.ts")).hashOf(sc.result));
    assert.equal(await h.store.creditBalance(a.accountId), before - t.credits, "debit equals the tool's price");
    assert.deepEqual(await h.store.receiptById(rc.id), rc, "receipt persisted");
    // public stateless verify agrees, and a tampered copy fails
    assert.equal((await h.j(await h.req("POST", "/agent/receipts/verify", { body: { receipt: rc } }))).valid, true);
    assert.equal((await h.j(await h.req("POST", "/agent/receipts/verify", { body: { receipt: { ...rc, credits: 0, tool: "x", at: rc.at + 1 } } }))).valid, false);
    assert.equal((await h.j(await h.req("POST", "/agent/receipts/verify", { body: { receipt: { ...rc, sig: "0".repeat(64) } } }))).valid, false);
  });
}

// ---------- metering ----------
test("credits: top-up through the mock checkout and signed webhook, idempotent, bad signature grants nothing", async () => {
  const h = make(); const a = await agent(h);
  const { t } = await topup(h, a, "credits_10000");
  assert.equal(t.credits, 10000); assert.match(t.checkoutUrl, /checkout\.mock\.invalid/);
  assert.equal(await h.store.creditBalance(a.accountId), 10000);
  const order = [...h.store.creditOrders.values()][0];
  await h.webhook("checkout.session.completed", { id: order.checkoutId, payment_status: "paid" }, { id: "evt_replay" });
  await h.webhook("checkout.session.completed", { id: order.checkoutId, payment_status: "paid" }, { id: "evt_replay2" });
  assert.equal(await h.store.creditBalance(a.accountId), 10000, "a second paid event for the same order grants nothing");
  const h2 = make(); const b = await agent(h2);
  await h2.j(await h2.req("POST", "/agent/credits/topup", { token: b.session, body: { pack: "credits_2000" } }));
  const o2 = [...h2.store.creditOrders.values()][0];
  const forged = await h2.webhook("checkout.session.completed", { id: o2.checkoutId, payment_status: "paid" }, { secret: "wrong" });
  assert.equal(forged.status, 400); assert.equal(await h2.store.creditBalance(b.accountId), 0);
  const unpaid = await h2.webhook("checkout.session.completed", { id: o2.checkoutId, payment_status: "unpaid" });
  assert.equal(await h2.store.creditBalance(b.accountId), 0, "unpaid session grants nothing");
  assert.equal((await h2.req("POST", "/agent/credits/topup", { token: b.session, body: { pack: "credits_999" } })).status, 400);
  assert.equal((await h2.req("POST", "/agent/credits/topup", { body: { pack: "credits_2000" } })).status, 401);
});
test("credits: a prepaid call with no balance is refused with the shortfall and runs nothing", async () => {
  const h = make(); setDns(h); const a = await agent(h);
  const r = await call(h, a.key, "domain_check", { domain: "good.example.com.au" });
  assert.equal(r.result.isError, true); assert.deepEqual({ ...r.result.structuredContent }, { error: "insufficient_credits", needed: 5, balance: 0 });
  await topup(h, a); await h.store.creditApply(a.accountId, -1996, "debit", "x", 0);
  assert.equal(await h.store.creditBalance(a.accountId), 4);
  assert.equal((await call(h, a.key, "domain_check", { domain: "good.example.com.au" })).result.structuredContent.error, "insufficient_credits");
  assert.equal(await h.store.creditBalance(a.accountId), 4, "balance never goes negative");
});
test("credits: 20 parallel calls on a 50-credit balance: exactly 10 succeed, balance ends at 0, never negative", async () => {
  const h = make(); setDns(h); const a = await agent(h);
  await h.store.creditApply(a.accountId, 50, "topup", "seed", 0);
  const rs = await Promise.all(Array.from({ length: 20 }, () => call(h, a.key, "domain_check", { domain: "good.example.com.au" })));
  assert.equal(rs.filter((r) => !r.result.structuredContent.error).length, 10);
  assert.equal(rs.filter((r) => r.result.structuredContent.error === "insufficient_credits").length, 10);
  assert.equal(await h.store.creditBalance(a.accountId), 0);
});
test("a failed tool call is not charged (reversal in the ledger) and gets no receipt", async () => {
  const h = make(); const a = await agent(h);
  await h.store.creditApply(a.accountId, 100, "topup", "seed", 0);
  const r = await call(h, a.key, "domain_check", { domain: "localhost.invalid" });
  assert.equal(r.result.structuredContent.error, "invalid_domain"); assert.equal(r.result.structuredContent.charged, 0);
  assert.equal(await h.store.creditBalance(a.accountId), 100);
  assert.deepEqual((await h.store.creditEntries(a.accountId)).map((e) => e.reason), ["topup", "debit", "reversal"]);
  assert.equal(h.store.receipts.size, 0);
});
test("idempotency: the same Idempotency-Key replays the first receipt and charges once", async () => {
  const h = make(); setDns(h); const a = await agent(h); await topup(h, a);
  const one = await call(h, a.key, "domain_check", { domain: "good.example.com.au" }, { "idempotency-key": "job-1" });
  const two = await call(h, a.key, "domain_check", { domain: "good.example.com.au" }, { "idempotency-key": "job-1" });
  assert.equal(two.result.structuredContent.replayed, true); assert.equal(two.result.structuredContent.receipt.id, one.result.structuredContent.receipt.id);
  assert.equal(await h.store.creditBalance(a.accountId), 2000 - 5);
});

// ---------- F-C7 backfill (wA backlog): scope allow-list, idempotency-key reuse (synthetic accounts, example.com.au) ----------
test("POST /keys: an unknown scope string is a 400 and nothing is stored; known scopes still work", async () => {
  const h = make(); const s = await h.login("scope@example.com.au");
  for (const bad of [["admin"], ["scan:read", "admin"], ["<script>"], ["scan:read", 5], ["SCAN:READ"], "scan:read", { 0: "scan:read" }, new Array(11).fill("scan:read")]) {
    const r = await h.req("POST", "/keys", { token: s.session, body: { scopes: bad } });
    assert.equal(r.status, 400, JSON.stringify(bad)); assert.equal((await h.j(r)).error, "invalid_scope");
  }
  assert.equal(h.store.keys.size, 0, "no rejected request stored a key");
  const ok = await h.req("POST", "/keys", { token: s.session, body: { scopes: [...SCOPES] } });
  assert.equal(ok.status, 201); assert.deepEqual((await h.j(ok)).scopes, [...SCOPES]);
  assert.equal((await h.req("POST", "/keys", { token: s.session, body: {} })).status, 201, "omitted scopes still allowed");
});
test("idempotency: the same key with different arguments is 422 idempotency_key_reuse, charged nothing, and the first receipt is not replayed", async () => {
  const h = make(); setDns(h); const a = await agent(h); await topup(h, a);
  const hd = { "idempotency-key": "job-9" };
  const one = await call(h, a.key, "domain_check", { domain: "good.example.com.au" }, hd);
  const bal = await h.store.creditBalance(a.accountId);
  const r = await rpc(h, a.key, "tools/call", { name: "domain_check", arguments: { domain: "other.example.com.au" } }, hd);
  assert.equal(r.status, 422); const b = await h.j(r);
  assert.equal(b.error.message, "idempotency_key_reuse"); assert.equal(b.result, undefined);
  assert.equal(await h.store.creditBalance(a.accountId), bal, "a rejected reuse charges nothing");
  assert.equal(h.store.receipts.size, 1, "no second receipt");
  // a different TOOL on the same key is also a reuse
  const r2 = await rpc(h, a.key, "tools/call", { name: "catalogue_list", arguments: {} }, hd);
  assert.equal(r2.status, 422); assert.equal((await h.j(r2)).error.message, "idempotency_key_reuse");
  // same key, same arguments (key order irrelevant) still replays the first receipt
  const two = await call(h, a.key, "domain_check", { domain: "good.example.com.au" }, hd);
  assert.equal(two.result.structuredContent.replayed, true); assert.equal(two.result.structuredContent.receipt.id, one.result.structuredContent.receipt.id);
  assert.equal(await h.store.creditBalance(a.accountId), bal);
  // another key may use the same idempotency string freely (keys are scoped per API key)
  const other = await agent(h, "other@example.com.au"); await topup(h, other);
  const x = await call(h, other.key, "domain_check", { domain: "other.example.com.au" }, hd);
  assert.ok(x.result.structuredContent.receipt && !x.result.structuredContent.replayed);
});

test("idempotency: the same key and identical (empty) arguments on a different tool is 422, not a replay", async () => {
  const h = make(); const a = await agent(h);
  const hd = { "idempotency-key": "job-10" };
  const one = await call(h, a.key, "catalogue_list", {}, hd);
  assert.ok(one.result.structuredContent.receipt);
  const r = await rpc(h, a.key, "tools/call", { name: "credits_balance", arguments: {} }, hd);
  assert.equal(r.status, 422); assert.equal((await h.j(r)).error.message, "idempotency_key_reuse");
});

// F39: every 422 on the MCP route is a valid JSON-RPC 2.0 error envelope; the REST route body is unchanged.
const envelope = (b: any, id: unknown) => {
  assert.deepEqual(Object.keys(b).sort(), ["error", "id", "jsonrpc"]);
  assert.equal(b.jsonrpc, "2.0"); assert.strictEqual(b.id, id);
  assert.equal(b.error.code, -32602); assert.equal(typeof b.error.message, "string");
  const flat = JSON.stringify(b);
  assert.ok(!/\bat \S+:\d+|stack|Error:|tk_|sk_|whsec|secret/i.test(flat), "no secret or stack text: " + flat);
};
test("mcp 422: idempotency reuse yields a JSON-RPC error with code -32602 and the request id echoed (number and string)", async () => {
  const h = make(); const a = await agent(h);
  const hd = { "idempotency-key": "job-f39" };
  await call(h, a.key, "catalogue_list", {}, hd);
  const r = await h.req("POST", "/mcp", { token: a.key, body: { jsonrpc: "2.0", id: 4242, method: "tools/call", params: { name: "credits_balance", arguments: {} } }, headers: hd });
  assert.equal(r.status, 422); envelope(await h.j(r), 4242);
  const r2 = await h.req("POST", "/mcp", { token: a.key, body: { jsonrpc: "2.0", id: "abc-1", method: "tools/call", params: { name: "credits_balance", arguments: {} } }, headers: hd });
  assert.equal(r2.status, 422); envelope(await h.j(r2), "abc-1");
});
test("mcp 422: an id that is not a string or number (object, boolean) is echoed as null, never reflected", async () => {
  const h = make(); const a = await agent(h);
  const hd = { "idempotency-key": "job-f39b" };
  await call(h, a.key, "catalogue_list", {}, hd);
  for (const bad of [{ x: 1 }, true, [1]]) {
    const r = await h.req("POST", "/mcp", { token: a.key, body: { jsonrpc: "2.0", id: bad, method: "tools/call", params: { name: "credits_balance", arguments: {} } }, headers: hd });
    assert.equal(r.status, 422); envelope(await h.j(r), null);
  }
});
test("mcp 422: a request with no id (notification-shaped call) gets id null; an unparseable body is -32700 with id null", async () => {
  const h = make(); const a = await agent(h);
  const hd = { "idempotency-key": "job-f39c" };
  await call(h, a.key, "catalogue_list", {}, hd);
  const r = await h.req("POST", "/mcp", { token: a.key, body: { jsonrpc: "2.0", method: "tools/call", params: { name: "credits_balance", arguments: {} } }, headers: hd });
  assert.equal(r.status, 422); envelope(await h.j(r), null);
  const raw = await handle(new Request("https://api.test/mcp", { method: "POST", headers: { authorization: `Bearer ${a.key}` }, body: "{not json" }), {}, h.deps);
  const b = await raw.json() as any;
  assert.equal(raw.status, 400); assert.equal(b.jsonrpc, "2.0"); assert.strictEqual(b.id, null); assert.equal(b.error.code, -32700);
});
test("rest 422 body is unchanged: POST /domains/verify with no TXT record is still plain {error}", async () => {
  const h = make(); const s = await h.login("rest@example.com.au");
  const d = await h.j(await h.req("POST", "/domains", { token: s.session, body: { domain: "norecord.example.com.au" } }));
  const r = await h.req("POST", `/domains/${d.id}/verify`, { token: s.session, body: {} });
  assert.equal(r.status, 422); assert.deepEqual(await h.j(r), { error: "txt_record_not_found" });
});

// ---------- BYOK ----------
test("BYOK: with x-model-key the model tool costs 0 credits, uses the caller's key, and the key is never stored or returned", async () => {
  const h = make(); const a = await agent(h);
  const SECRETKEY = "sk-ant-api03-SUPERSECRET-byok-key";
  const r = await call(h, a.key, "explain_finding", { finding: "spf_missing" }, { "x-model-key": SECRETKEY });
  const rc = r.result.structuredContent.receipt;
  assert.equal(rc.mode, "byok"); assert.equal(rc.credits, 0);
  assert.equal(h.model.calls[0].apiKey, SECRETKEY, "the caller's own key is the one used");
  const dump = JSON.stringify([r, [...h.store.receipts.values()], h.store.ledger, [...h.store.keys.values()], h.store.callLog]);
  assert.ok(!dump.includes("SUPERSECRET"), "the BYOK key appears nowhere in responses or stored data");
});
test("prepaid model call uses the platform key, not a caller key, and debits 25", async () => {
  const h = make(); const a = await agent(h); await topup(h, a);
  const r = await call(h, a.key, "explain_finding", { finding: "spf_missing" });
  assert.equal(r.result.structuredContent.receipt.mode, "prepaid");
  assert.equal(h.model.calls[0].apiKey, "platform"); assert.equal(await h.store.creditBalance(a.accountId), 1975);
  const none = await agent(h, "nocredit@example.com.au");
  assert.equal((await call(h, none.key, "explain_finding", { finding: "spf_missing" })).result.structuredContent.error, "insufficient_credits");
  assert.equal(h.model.calls.length, 1, "no model call without payment or a key (no cost fronted)");
});
test("BYOK header on a code-only tool does nothing: still free or prepaid, key never forwarded", async () => {
  const h = make(); setDns(h); const a = await agent(h);
  const r = await call(h, a.key, "domain_check", { domain: "good.example.com.au" }, { "x-model-key": "sk-x" });
  assert.equal(r.result.structuredContent.error, "insufficient_credits");
});
test("a failing model leaves the prepaid caller uncharged", async () => {
  const h = make(); const a = await agent(h); await topup(h, a); h.model.fail = true;
  const r = await call(h, a.key, "explain_finding", { finding: "spf_missing" });
  assert.equal(r.result.structuredContent.error, "tool_failed"); assert.equal(await h.store.creditBalance(a.accountId), 2000);
});

// ---------- hardening ----------
test("input validation: unknown argument, wrong type, too long, bad enum, missing required are all -32602 and uncharged", async () => {
  const h = make(); const a = await agent(h); await topup(h, a);
  for (const [name, args] of [["domain_check", { domain: "a.com", extra: 1 }], ["domain_check", { domain: 5 }], ["domain_check", { domain: "a".repeat(300) + ".com" }], ["explain_finding", { finding: "../etc/passwd" }], ["price_quote", {}], ["domain_check", []]] as const) {
    const r = await call(h, a.key, name, args); assert.equal(r.error?.code, -32602, `${name} ${JSON.stringify(args).slice(0, 40)}`);
  }
  assert.equal(await h.store.creditBalance(a.accountId), 2000); assert.equal(h.store.receipts.size, 0);
});
test("rate limit: the 61st call inside a minute is refused, then allowed again after the window", async () => {
  const h = make(); const a = await agent(h);
  for (let i = 0; i < 60; i++) assert.equal((await call(h, a.key, "price_quote", { product: "monitor_monthly" })).result.isError, false);
  assert.equal((await call(h, a.key, "price_quote", { product: "monitor_monthly" })).result.structuredContent.error, "rate_limited");
  h.clock.t += 61_000;
  assert.equal((await call(h, a.key, "price_quote", { product: "monitor_monthly" })).result.isError, false);
});
test("tenant isolation: my_domains and receipt_verify never show another account's data", async () => {
  const h = make(); const a = await agent(h, "a@example.com.au"); const b = await agent(h, "b@example.com.au");
  await h.verifiedDomain(a.session, "mine-only.example.com.au");
  assert.deepEqual((await call(h, b.key, "my_domains")).result.structuredContent.result.domains, []);
  const ra = (await call(h, a.key, "catalogue_list")).result.structuredContent.receipt.id;
  assert.deepEqual((await call(h, b.key, "receipt_verify", { receipt_id: ra })).result.structuredContent.result, { found: false });
});
test("fail closed: with no receipt secret configured every tool call is refused", async () => {
  const h = make(); const a = await agent(h); h.deps.receiptSecret = undefined;
  assert.equal((await call(h, a.key, "price_quote", { product: "monitor_monthly" })).error.code, -32603);
  assert.equal((await h.j(await h.req("POST", "/agent/receipts/verify", { body: { receipt: { id: "a", tool: "a", keyId: "a", accountId: "a", inputSha: "a", outputSha: "a", mode: "a", sig: "a", at: 1, credits: 0 } } }))).valid, false);
});
test("domain_check is passive: only TXT lookups of the domain and _dmarc.<domain>", async () => {
  const h = make(); setDns(h); const seen: string[] = [];
  const orig = h.dns.txt.bind(h.dns); h.dns.txt = async (n: string) => { seen.push(n); return orig(n); };
  const a = await agent(h); await topup(h, a);
  const r = await call(h, a.key, "domain_check", { domain: "https://GOOD.example.com.au/path" });
  assert.deepEqual(seen.sort(), ["_dmarc.good.example.com.au", "good.example.com.au"]);
  assert.equal(r.result.structuredContent.result.grade, "A");
  const ip = await call(h, a.key, "domain_check", { domain: "10.0.0.1" }); assert.equal(ip.result.structuredContent.error, "invalid_domain");
});
test("domain_check says so when DNS fails instead of reporting a clean A", async () => {
  const h = make(); h.dns.txt = async () => { throw new Error("down"); };
  const a = await agent(h); await h.store.creditApply(a.accountId, 10, "topup", "s", 0);
  const o = (await call(h, a.key, "domain_check", { domain: "x.example.com.au" })).result.structuredContent.result;
  assert.deepEqual(o.findings.map((f: any) => f.id), ["dns_lookup_failed"]);
});

// ---------- machine door ----------
test("public machine door: /agent/tools and the Worker's agent card list exactly the tool set", async () => {
  const h = make();
  const t = await h.j(await h.req("GET", "/agent/tools"));
  assert.deepEqual(t.tools.map((x: any) => x.name), TOOLS.map((x) => x.name));
  const c = await h.j(await h.req("GET", "/.well-known/agent.json"));
  assert.deepEqual(c.tools.map((x: any) => x.name), TOOLS.map((x) => x.name)); assert.equal(c.status, "preview");
});
test("site files are generated from the tool list and have not drifted (run scripts/gen_agent_files.ts to refresh)", () => {
  assert.equal(readFileSync(ROOT + "public/.well-known/agent.json", "utf8"), JSON.stringify(agentCard(), null, 2) + "\n");
  assert.equal(readFileSync(ROOT + "lib/agentTools.generated.json", "utf8"), JSON.stringify(toolsJson(), null, 2) + "\n");
});
test("copy hygiene: card and tool text have no em or en dashes and no AI-tell words", () => {
  const all = JSON.stringify([agentCard(), toolsJson()]);
  assert.ok(!/[–—]/.test(all));
  for (const w of ["delve", "leverage", "robust", "holistic", "landscape", "cutting-edge", "synergy", "ecosystem", "streamline", "seamless"]) assert.ok(!new RegExp(w, "i").test(all), w);
});
test("worker default export still fails closed without deps (no store yet)", async () => {
  const r = await handle(new Request("https://api.test/mcp", { method: "POST", body: "{}" }), {});
  assert.equal(r.status, 503);
});
