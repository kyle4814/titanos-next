// F19: per-key spend caps, revoke. Synthetic data, MemoryStore, no provider.
import { test } from "node:test";
import assert from "node:assert/strict";
import { make, RECEIPT_SECRET } from "./harness.ts";
import { SCOPES } from "../src/agent/tools.ts";
import { DEFAULT_KEY_CAP_DAILY, DEFAULT_KEY_CAP_TOTAL, DAY_MS } from "../src/agent/caps.ts";
import { handle } from "../src/index.ts";

type H = ReturnType<typeof make>;
const COST = 5; // domain_check, prepaid credits per call
async function agent(h: H, o: { email?: string; capDaily?: number; capTotal?: number; credits?: number } = {}) {
  const s = await h.login(o.email ?? "bot@example.com.au");
  const k = await h.j(await h.req("POST", "/keys", { token: s.session, body: { scopes: [...SCOPES], capDaily: o.capDaily, capTotal: o.capTotal } }));
  if (o.credits) await h.store.creditApply(s.account.id, o.credits, "topup", "evt_fixture", h.clock.t);
  return { session: s.session, accountId: s.account.id as string, key: k.key as string, keyId: k.id as string, raw: k };
}
let rid = 0;
const rpc = (h: H, key: string | undefined, method: string, params?: unknown) => h.req("POST", "/mcp", { token: key, body: { jsonrpc: "2.0", id: ++rid, method, params } });
const check = async (h: H, key: string) => (await h.j(await rpc(h, key, "tools/call", { name: "domain_check", arguments: { domain: "good.example.com.au" } })));
// F176 moved a cap refusal to the F39 JSON-RPC error shape ({ error: { code: -32002, data: { error, cap, charged } } }); read either shape.
const sc = (r: any) => r.result?.structuredContent ?? r.error?.data;
const setDns = (h: H) => { h.dns.zone["good.example.com.au"] = ["v=spf1 include:_spf.google.com -all"]; h.dns.zone["_dmarc.good.example.com.au"] = ["v=DMARC1; p=reject; rua=mailto:d@good.example.com.au"]; };
const debits = (h: H, keyId: string) => h.store.ledger.filter((e) => e.keyId === keyId && e.reason === "debit").length;

// ---------- caps ----------
test("cap: default is conservative, never unlimited, and shown on create and list", async () => {
  const h = make(); const a = await agent(h);
  assert.equal(a.raw.capDaily, DEFAULT_KEY_CAP_DAILY); assert.equal(a.raw.capTotal, DEFAULT_KEY_CAP_TOTAL);
  assert.ok(DEFAULT_KEY_CAP_DAILY <= 1000 && DEFAULT_KEY_CAP_TOTAL <= 5000);
  const list = (await h.j(await h.req("GET", "/keys", { token: a.session }))).keys[0];
  assert.deepEqual([list.capDaily, list.capTotal, list.spentToday, list.spentTotal], [DEFAULT_KEY_CAP_DAILY, DEFAULT_KEY_CAP_TOTAL, 0, 0]);
  // a key stored before F19 (no caps) gets the defaults, not infinity
  const old = await h.store.keyById(a.keyId); delete old!.capDaily; delete old!.capTotal; await h.store.putKey(old!);
  const l2 = (await h.j(await h.req("GET", "/keys", { token: a.session }))).keys[0];
  assert.equal(l2.capDaily, DEFAULT_KEY_CAP_DAILY);
});
test("cap: daily cap exactly hit is allowed, one more is refused uncharged, next UTC day resets", async () => {
  const h = make(); setDns(h); const a = await agent(h, { capDaily: 3 * COST, credits: 1000 });
  for (let i = 0; i < 3; i++) assert.ok(sc(await check(h, a.key)).receipt, `call ${i + 1} within cap`);
  assert.equal(await h.store.creditBalance(a.accountId), 1000 - 3 * COST, "exactly at the cap: spent == cap");
  const over = sc(await check(h, a.key));
  assert.equal(over.error, "key_spend_cap"); assert.equal(over.cap, "daily"); assert.equal(over.charged, 0);
  assert.equal(await h.store.creditBalance(a.accountId), 1000 - 3 * COST, "refused call charged nothing");
  assert.equal(debits(h, a.keyId), 3);
  h.clock.t += DAY_MS; // next UTC day
  assert.ok(sc(await check(h, a.key)).receipt, "daily window reset");
});
test("cap: total cap is a lifetime limit that a new day does not reset", async () => {
  const h = make(); setDns(h); const a = await agent(h, { capDaily: 100, capTotal: 4 * COST, credits: 1000 });
  for (let i = 0; i < 4; i++) assert.ok(sc(await check(h, a.key)).receipt);
  h.clock.t += 3 * DAY_MS;
  const r = sc(await check(h, a.key)); assert.equal(r.error, "key_spend_cap"); assert.equal(r.cap, "total");
});
test("cap: a cap of 0 blocks all paid calls but free tools still work", async () => {
  const h = make(); setDns(h); const a = await agent(h, { capDaily: 0, credits: 100 });
  assert.equal(sc(await check(h, a.key)).error, "key_spend_cap");
  const free = await h.j(await rpc(h, a.key, "tools/call", { name: "catalogue_list", arguments: {} }));
  assert.ok(sc(free).receipt);
});
test("cap: a failed tool reverses the charge AND gives the cap back", async () => {
  const h = make(); setDns(h); const a = await agent(h, { capDaily: COST, credits: 100 });
  const bad = sc(await h.j(await rpc(h, a.key, "tools/call", { name: "domain_check", arguments: { domain: "not a domain" } })));
  assert.equal(bad.error, "invalid_domain"); assert.equal(bad.charged, 0);
  assert.equal(await h.store.creditBalance(a.accountId), 100);
  assert.equal((await h.store.keySpend(a.keyId, 0)).total, 0, "net key spend back to 0");
  assert.ok(sc(await check(h, a.key)).receipt, "cap was not burned by the failed call");
  assert.equal(sc(await check(h, a.key)).error, "key_spend_cap");
});
test("cap: 40 concurrent debits against a 10-call cap never pass the cap (and never overdraw the account)", async () => {
  const h = make(); setDns(h); const a = await agent(h, { capDaily: 10 * COST, capTotal: 10 * COST, credits: 1000 });
  const rs = await Promise.all(Array.from({ length: 40 }, () => check(h, a.key).then(sc)));
  assert.equal(rs.filter((r) => r.receipt).length, 10);
  assert.equal(rs.filter((r) => r.error === "key_spend_cap").length, 30);
  assert.equal((await h.store.keySpend(a.keyId, 0)).total, 10 * COST);
  assert.equal(await h.store.creditBalance(a.accountId), 1000 - 10 * COST);
});
test("cap: the store-level debit is atomic under direct concurrency (balance and cap together)", async () => {
  const h = make(); const acct = "acct_x";
  await h.store.creditApply(acct, 100, "topup", "e", 0);
  // F176 refuses a debit on a key that is not the account's (key_not_in_tenant), so the key row must exist.
  await h.store.putKey({ id: "key_x", accountId: acct, hash: "h_x", scopes: [], createdAt: 0 });
  const o = { accountId: acct, keyId: "key_x", amount: 7, at: 1, dayStart: 0, capDaily: 1000, capTotal: 1000 };
  const rs = await Promise.all(Array.from({ length: 30 }, (_, i) => h.store.creditDebitCapped({ ...o, ref: `r${i}` })));
  assert.equal(rs.filter((r) => r.ok).length, 14, "balance 100 / 7 = 14 debits, no more");
  assert.equal(await h.store.creditBalance(acct), 2);
  const rs2 = await Promise.all(Array.from({ length: 30 }, (_, i) => h.store.creditApply(acct, -1, "debit", `c${i}`, 1)));
  assert.equal(rs2.filter((x) => x !== undefined).length, 2, "plain creditApply is also race-free");
});
test("cap: caps are per key (a second key on the same account is unaffected), and shared balance still binds", async () => {
  const h = make(); setDns(h); const a = await agent(h, { capDaily: COST, credits: 1000 });
  const k2 = await h.j(await h.req("POST", "/keys", { token: a.session, body: { scopes: [...SCOPES], capDaily: 50 } }));
  assert.ok(sc(await check(h, a.key)).receipt); assert.equal(sc(await check(h, a.key)).error, "key_spend_cap");
  assert.ok(sc(await check(h, k2.key)).receipt, "key 2 has its own cap");
});
test("cap: validation. bad caps refused; owner session can lower and raise; an agent key cannot touch caps", async () => {
  const h = make(); const s = await h.login("o@example.com.au");
  for (const bad of [-1, 1.5, "10", 1e9]) {
    const r = await h.req("POST", "/keys", { token: s.session, body: { scopes: ["credits:read"], capDaily: bad } });
    assert.equal(r.status, 400, `capDaily ${String(bad)} refused`);
  }
  const k = await h.j(await h.req("POST", "/keys", { token: s.session, body: { scopes: ["credits:read"] } }));
  const up = await h.j(await h.req("PATCH", `/keys/${k.id}`, { token: s.session, body: { capDaily: 77, capTotal: 88 } }));
  assert.deepEqual([up.capDaily, up.capTotal], [77, 88]);
  assert.equal((await h.req("PATCH", `/keys/${k.id}`, { token: s.session, body: {} })).status, 400);
  assert.equal((await h.req("PATCH", `/keys/${k.id}`, { token: k.key, body: { capDaily: 99999 } })).status, 401, "a leaked key cannot raise its own cap");
  const other = await h.login("p@example.com.au");
  assert.equal((await h.req("PATCH", `/keys/${k.id}`, { token: other.session, body: { capDaily: 1 } })).status, 404, "tenant isolation");
});

// ---------- revoke ----------
test("revoke: a revoked key is refused at once on mcp, keeps its audit trail, and revoke is idempotent and owner-only", async () => {
  const h = make(); setDns(h); const a = await agent(h, { credits: 100 });
  assert.ok(sc(await check(h, a.key)).receipt);
  const other = await h.login("x@example.com.au");
  assert.equal((await h.req("DELETE", `/keys/${a.keyId}`, { token: other.session })).status, 404);
  assert.equal((await h.req("DELETE", `/keys/${a.keyId}`, { token: a.session })).status, 200);
  assert.equal((await rpc(h, a.key, "tools/call", { name: "domain_check", arguments: { domain: "good.example.com.au" } })).status, 401);
  const t0 = (await h.store.keyById(a.keyId))!.revokedAt; h.clock.t += 1000;
  assert.equal((await h.req("DELETE", `/keys/${a.keyId}`, { token: a.session })).status, 200);
  assert.equal((await h.store.keyById(a.keyId))!.revokedAt, t0, "revokedAt not rewritten");
  assert.equal(debits(h, a.keyId), 1, "ledger keeps the key's spend");
  assert.equal((await h.store.keysByPrefix(a.keyId.slice(0, 8))).length, 1, "prefix lookup still traces a revoked key");
});

// ---------- no secrets in logs ----------
test("no raw key, receipt secret or hash is logged, returned in errors or written to the ledger/receipts", async () => {
  const h = make(); setDns(h); const logged: string[] = [];
  const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
  for (const k of Object.keys(orig) as (keyof typeof orig)[]) (console as any)[k] = (...x: unknown[]) => logged.push(x.map(String).join(" "));
  const bodies: string[] = [];
  let a!: Awaited<ReturnType<typeof agent>>;
  try {
    a = await agent(h, { capDaily: COST, credits: 100 });
    for (let i = 0; i < 2; i++) bodies.push(JSON.stringify(await check(h, a.key)));
    bodies.push(await (await h.req("GET", "/keys", { token: a.session })).text());
    bodies.push(await (await h.req("PATCH", `/keys/${a.keyId}`, { token: a.session, body: { capDaily: -5 } })).text());
    bodies.push(await (await rpc(h, "tk_" + "f".repeat(48), "ping")).text());
    await h.req("DELETE", `/keys/${a.keyId}`, { token: a.session });
    bodies.push(await (await rpc(h, a.key, "ping")).text());
    bodies.push(await (await h.req("GET", "/account/export", { token: a.session })).text());
  } finally { Object.assign(console, orig); }
  const hash = [...h.store.keys.values()].find((k) => k.id === a.keyId)!.hash;
  const everything = logged.join("\n") + bodies.join("\n") + JSON.stringify([...h.store.receipts.values()]) + JSON.stringify(h.store.ledger);
  for (const secret of [a.key, a.key.slice(3), hash, RECEIPT_SECRET]) assert.ok(!everything.includes(secret), `leaked ${secret.slice(0, 8)}...`);
  assert.ok(!bodies[0].includes(hash));
});
