// F17: exactly-once debit + receipt under the same Idempotency-Key, on BOTH adapters (MemoryStore, D1Store over real SQLite).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore, type Store } from "../src/store.ts";
import { D1Store } from "../src/d1store.ts";
import { FakeD1 } from "./fake_d1.ts";
import { make } from "./harness.ts";
import { SCOPES } from "../src/agent/tools.ts";
import { IDEM_TTL_MS } from "../src/agent/mcp.ts";

const ADAPTERS: [string, () => Store][] = [["MemoryStore", () => new MemoryStore()], ["D1Store(FakeD1)", () => new D1Store(new FakeD1())]];
type H = ReturnType<typeof make>;
async function agent(h: H) {
  const s = await h.login("bot@example.com.au");
  const k = await h.j(await h.req("POST", "/keys", { token: s.session, body: { scopes: [...SCOPES, "scan:read"] } }));
  return { accountId: s.account.id as string, key: k.key as string, keyId: k.id as string };
}
let rid = 0;
const call = async (h: H, key: string, headers: Record<string, string>, domain = "good.example.com.au") =>
  h.j(await h.req("POST", "/mcp", { token: key, headers, body: { jsonrpc: "2.0", id: ++rid, method: "tools/call", params: { name: "domain_check", arguments: { domain } } } }));
const setDns = (h: H) => { h.dns.zone["good.example.com.au"] = ["v=spf1 include:_spf.google.com -all"]; h.dns.zone["_dmarc.good.example.com.au"] = ["v=DMARC1; p=reject; rua=mailto:d@good.example.com.au"]; };
import { idemTiming } from "../src/agent/mcp.ts";
idemTiming.waitMs = 2000; // keep the in-progress case fast
const sc = (r: any) => r.result.structuredContent;
const debits = async (s: Store, acc: string) => (await s.creditEntries(acc)).filter((e) => e.reason === "debit");

for (const [name, mk] of ADAPTERS) describe(`idempotency reserve: ${name}`, () => {
  test("20 parallel calls, same key and Idempotency-Key, balance for ONE call: exactly one debit, one receipt, identical replays", async () => {
    const h = make(mk()); setDns(h); const a = await agent(h);
    await h.store.creditApply(a.accountId, 5, "topup", "seed", 0); // domain_check costs 5
    const rs = await Promise.all(Array.from({ length: 20 }, () => call(h, a.key, { "idempotency-key": "job-race" })));
    assert.equal(rs.filter((r) => sc(r).error).length, 0, "no caller sees an error: " + JSON.stringify(rs.map(sc).filter((x) => x.error)));
    assert.equal((await debits(h.store, a.accountId)).length, 1, "exactly one debit");
    assert.equal(await h.store.creditBalance(a.accountId), 0);
    const ids = new Set(rs.map((r) => sc(r).receipt.id));
    assert.equal(ids.size, 1, "every caller holds the same receipt");
    assert.equal(rs.filter((r) => sc(r).replayed).length, 19, "one winner, 19 replays");
    const winner = rs.map(sc).find((x) => !x.replayed)!;
    for (const r of rs.map(sc).filter((x) => x.replayed)) assert.deepEqual(r.receipt, winner.receipt, "replay is byte-identical to the winner's receipt");
    assert.deepEqual(await h.store.receiptByIdem(a.keyId, "job-race"), winner.receipt);
  });

  test("20 parallel calls with ample balance (so insufficient_credits cannot hide a double charge): still exactly one debit", async () => {
    const h = make(mk()); setDns(h); const a = await agent(h);
    await h.store.creditApply(a.accountId, 1000, "topup", "seed", 0);
    const rs = await Promise.all(Array.from({ length: 20 }, () => call(h, a.key, { "idempotency-key": "job-rich" })));
    assert.equal((await debits(h.store, a.accountId)).length, 1); assert.equal(await h.store.creditBalance(a.accountId), 995);
    assert.equal(new Set(rs.map((r) => sc(r).receipt.id)).size, 1);
  });

  test("different Idempotency-Keys are independent; no key means no reservation", async () => {
    const h = make(mk()); setDns(h); const a = await agent(h);
    await h.store.creditApply(a.accountId, 100, "topup", "seed", 0);
    await Promise.all([call(h, a.key, { "idempotency-key": "k1" }), call(h, a.key, { "idempotency-key": "k2" }), call(h, a.key, {}), call(h, a.key, {})]);
    assert.equal((await debits(h.store, a.accountId)).length, 4);
  });

  test("crash AFTER reserve, BEFORE debit: a live reservation answers idempotency_in_progress and charges nothing; once it expires the retry runs exactly once", async () => {
    const h = make(mk()); setDns(h); const a = await agent(h);
    await h.store.creditApply(a.accountId, 50, "topup", "seed", 0);
    const t0 = h.clock.t;
    const r0 = await h.store.idemReserve(a.keyId, "job-crash", "rcpt_dead", "owner_dead", t0, IDEM_TTL_MS); // the dead worker's claim
    assert.equal(r0.won, true);
    const blocked = sc(await call(h, a.key, { "idempotency-key": "job-crash" }));
    assert.equal(blocked.error, "idempotency_in_progress"); assert.ok(blocked.retryAfterMs > 0);
    assert.equal((await debits(h.store, a.accountId)).length, 0, "nothing charged while pending");
    h.clock.t = t0 + IDEM_TTL_MS + 1;
    const rs = await Promise.all(Array.from({ length: 10 }, () => call(h, a.key, { "idempotency-key": "job-crash" })));
    assert.equal(rs.filter((r) => sc(r).error).length, 0);
    assert.equal((await debits(h.store, a.accountId)).length, 1, "recovered, charged once");
    assert.equal(new Set(rs.map((r) => sc(r).receipt.id)).size, 1);
  });

  test("crash AFTER debit, BEFORE receipt: the takeover does not debit a second time and signs a receipt for the original debit", async () => {
    const h = make(mk()); setDns(h); const a = await agent(h);
    await h.store.creditApply(a.accountId, 50, "topup", "seed", 0);
    const t0 = h.clock.t;
    await h.store.idemReserve(a.keyId, "job-crash2", "rcpt_dead2", "owner_dead", t0, IDEM_TTL_MS);
    assert.notEqual(await h.store.creditApply(a.accountId, -5, "debit", "rcpt_dead2", t0), undefined); // the dead worker got this far
    h.clock.t = t0 + IDEM_TTL_MS + 1;
    const r = sc(await call(h, a.key, { "idempotency-key": "job-crash2" }));
    assert.equal(r.error, undefined); assert.equal(r.receipt.id, "rcpt_dead2"); assert.equal(r.receipt.credits, 5);
    assert.equal((await debits(h.store, a.accountId)).length, 1, "still exactly one debit");
    assert.equal(await h.store.creditBalance(a.accountId), 45);
  });

  test("crash after debit AND reversal but before release: takeover charges again under a fresh ref (net one charge, never free)", async () => {
    const h = make(mk()); setDns(h); const a = await agent(h);
    await h.store.creditApply(a.accountId, 50, "topup", "seed", 0);
    const t0 = h.clock.t;
    await h.store.idemReserve(a.keyId, "job-crash3", "rcpt_dead3", "owner_dead", t0, IDEM_TTL_MS);
    await h.store.creditApply(a.accountId, -5, "debit", "rcpt_dead3", t0); await h.store.creditApply(a.accountId, 5, "reversal", "rcpt_dead3", t0);
    h.clock.t = t0 + IDEM_TTL_MS + 1;
    const r = sc(await call(h, a.key, { "idempotency-key": "job-crash3" }));
    assert.equal(r.error, undefined);
    assert.equal(await h.store.creditBalance(a.accountId), 45, "one real charge net");
  });

  test("a failed tool call releases the reservation: the same Idempotency-Key can be retried, charged once, failures cost nothing", async () => {
    const h = make(mk()); setDns(h); const a = await agent(h);
    await h.store.creditApply(a.accountId, 50, "topup", "seed", 0);
    const bad = sc(await call(h, a.key, { "idempotency-key": "job-fail" }, "localhost.invalid"));
    assert.equal(bad.error, "invalid_domain"); assert.equal(await h.store.creditBalance(a.accountId), 50);
    const good = sc(await call(h, a.key, { "idempotency-key": "job-fail" }));
    assert.equal(good.error, undefined); assert.equal(await h.store.creditBalance(a.accountId), 45);
    const again = sc(await call(h, a.key, { "idempotency-key": "job-fail" }));
    assert.equal(again.replayed, true); assert.equal(await h.store.creditBalance(a.accountId), 45);
  });

  test("insufficient credits releases the reservation too (a top-up then lets the same key through)", async () => {
    const h = make(mk()); setDns(h); const a = await agent(h);
    assert.equal(sc(await call(h, a.key, { "idempotency-key": "job-poor" })).error, "insufficient_credits");
    await h.store.creditApply(a.accountId, 50, "topup", "seed", 0);
    assert.equal(sc(await call(h, a.key, { "idempotency-key": "job-poor" })).error, undefined);
    assert.equal(await h.store.creditBalance(a.accountId), 45);
  });

  test("store contract: reserve is first-wins, a live reservation is not stolen, an expired one is taken over keeping its rid, release is owner-only", async () => {
    const h = make(mk()); const a = await agent(h); const s = h.store;
    const x = await s.idemReserve(a.keyId, "i", "rcpt_1", "o1", 1000, 100); assert.deepEqual({ won: x.won, rid: x.rid }, { won: true, rid: "rcpt_1" });
    assert.equal((await s.idemReserve(a.keyId, "i", "rcpt_2", "o2", 1050, 100)).won, false, "live: not stolen");
    assert.equal((await s.idemReserve(a.keyId, "i", "rcpt_2", "o2", 1099, 100)).won, false, "still live one ms before expiry");
    const t = await s.idemReserve(a.keyId, "i", "rcpt_3", "o3", 1100, 100); assert.deepEqual({ won: t.won, rid: t.rid }, { won: true, rid: "rcpt_1" }); // expiry boundary inclusive, rid kept
    await s.idemRelease(a.keyId, "i", "o2"); assert.equal((await s.idemReserve(a.keyId, "i", "rcpt_4", "o4", 1150, 100)).won, false, "non-owner release is a no-op");
    await s.idemRelease(a.keyId, "i", "o3"); assert.equal((await s.idemReserve(a.keyId, "i", "rcpt_5", "o5", 1150, 100)).rid, "rcpt_5", "released: fresh rid");
  });
});
