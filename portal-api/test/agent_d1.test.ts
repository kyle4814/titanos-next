// F58: D1AgentStore over a fake D1 (real SQLite, real migrations). Synthetic data only (example.com.au).
import test from "node:test";
import assert from "node:assert/strict";
import { D1AgentStore } from "../src/agent/d1agent.ts";
import { FakeD1 } from "./fake_d1.ts";
import { D1ShadowStore } from "./d1_agent_store.ts";
import { make } from "./harness.ts";
import { SCOPES } from "../src/agent/tools.ts";
import type { AgentReceipt } from "../src/store.ts";

function world() {
  const d1 = new FakeD1(), s = new D1AgentStore(d1);
  for (const a of ["acct_A", "acct_B"]) d1.db.prepare("INSERT INTO accounts (id, email, created_at) VALUES (?, ?, ?)").run(a, `${a}@example.com.au`, "0");
  const key = (id: string, acct: string, hash = `h_${id}`) => s.putKey({ id, accountId: acct, hash, scopes: ["catalogue:read", "scan:read"], createdAt: 1000 });
  const rcpt = (id: string, keyId: string, acct: string, at: number, extra: Partial<AgentReceipt> = {}): AgentReceipt =>
    ({ id, tool: "catalogue_list", keyId, accountId: acct, at, inputSha: "i", outputSha: "o", credits: 0, mode: "free", sig: "s", kid: "k1", ...extra });
  return { d1, s, key, rcpt };
}
const all = (d1: FakeD1, sql: string, ...a: unknown[]) => d1.db.prepare(sql).all(...(a as never[])) as Record<string, unknown>[];

test("d1: keys round-trip; tenant and hash are immutable; revoke persists", async () => {
  const { s, key } = world();
  await key("key_aaaaaaaa1", "acct_A");
  assert.deepEqual((await s.keyById("key_aaaaaaaa1"))!.scopes, ["catalogue:read", "scan:read"]);
  assert.equal((await s.keyByHash("h_key_aaaaaaaa1"))!.accountId, "acct_A");
  // an upsert naming another tenant or another hash changes nothing
  await s.putKey({ id: "key_aaaaaaaa1", accountId: "acct_B", hash: "stolen", scopes: ["credits:read"], createdAt: 1, revokedAt: 5 });
  await s.putKey({ id: "key_aaaaaaaa1", accountId: "acct_A", hash: "rewritten_by_same_tenant", scopes: ["catalogue:read", "scan:read"], createdAt: 1 });
  assert.equal(await s.keyByHash("rewritten_by_same_tenant"), undefined, "the stored hash is never rewritten, even by its own tenant");
  const k = (await s.keyById("key_aaaaaaaa1"))!;
  assert.equal(k.accountId, "acct_A"); assert.equal(k.hash, "h_key_aaaaaaaa1"); assert.equal(k.revokedAt, undefined);
  await s.putKey({ ...k, revokedAt: 99 });
  assert.equal((await s.keyById("key_aaaaaaaa1"))!.revokedAt, 99);
  assert.equal((await s.keysFor("acct_B")).length, 0);
});

test("d1: f48 queries (prefix lookup, receipts newest first with LIMIT) and the indexes they use", async () => {
  const { d1, s, key, rcpt } = world();
  await key("key_abcdef12", "acct_A"); await key("key_abcdefzz", "acct_B"); await key("key_zzzzzzzz", "acct_A");
  assert.deepEqual((await s.keysByPrefix("key_abcd")).map((k) => k.id).sort(), ["key_abcdef12", "key_abcdefzz"], "8-char prefix");
  assert.deepEqual((await s.keysByPrefix("key_ab")).map((k) => k.id).sort(), ["key_abcdef12", "key_abcdefzz"], "6-char prefix (range scan)");
  assert.deepEqual((await s.keysByPrefix("key_abcd", "acct_A")).map((k) => k.id), ["key_abcdef12"], "tenant filter in the WHERE");
  assert.deepEqual(await s.keysByPrefix("nope_nop"), []);
  for (const [i, at] of [[1, 100], [2, 300], [3, 200], [4, 300]] as const) await s.putReceipt(rcpt(`r${i}`, "key_abcdef12", "acct_A", at));
  assert.deepEqual((await s.receiptsForKey("key_abcdef12", 3, "acct_A")).map((r) => r.id), ["r4", "r2", "r3"], "at DESC, ties newest-written first, LIMIT");
  assert.equal((await s.receiptsForKey("key_abcdef12", 0)).length, 0);
  const plan = (sql: string, ...a: unknown[]) => JSON.stringify(all(d1, "EXPLAIN QUERY PLAN " + sql, ...a));
  assert.match(plan("SELECT * FROM api_keys WHERE substr(id, 1, 8) = ? AND account_id = ? ORDER BY rowid", "key_abcd", "acct_A"), /api_keys_prefix/);
  assert.match(plan("SELECT * FROM agent_receipts WHERE key_id = ? AND account_id = ? ORDER BY at DESC, rowid DESC LIMIT ?", "k", "a", 3), /agent_receipts_key_at/);
});

test("d1: a raw secret never appears in any stored column, in any table", async () => {
  const h = make({ d1: true }) as ReturnType<typeof make>;
  const store = h.store as D1ShadowStore;
  const s = await h.login("bot@example.com.au");
  const k = await h.j(await h.req("POST", "/keys", { token: s.session, body: { scopes: [...SCOPES] } }));
  const top = await h.j(await h.req("POST", "/agent/credits/topup", { token: s.session, body: { pack: "credits_2000" } }));
  const order = [...store.creditOrders.values()].at(-1)!;
  await h.webhook("checkout.session.completed", { id: order.checkoutId, payment_status: "paid" });
  const BYOK = "sk-user-model-key-zzz-1234567890";
  await h.req("POST", "/mcp", { token: k.key, headers: { "x-model-key": BYOK, "idempotency-key": "idem-1" }, body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "explain_finding", arguments: { finding: "spf_missing" } } } });
  await h.req("POST", "/mcp", { token: k.key, body: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "catalogue_list", arguments: {} } } });
  assert.ok(top.checkoutUrl);
  const dump = JSON.stringify(["api_keys", "agent_receipts", "credit_ledger", "credit_orders", "agent_calls", "idem_reservations"].map((t) => all(store.d1, `SELECT * FROM ${t}`)));
  assert.ok(all(store.d1, "SELECT * FROM agent_receipts").length >= 2 && all(store.d1, "SELECT * FROM credit_ledger").length >= 1, "the calls really landed in D1");
  const stored = all(store.d1, "SELECT key_hash FROM api_keys")[0].key_hash as string;
  assert.match(stored, /^[0-9a-f]{64}$/, "only a SHA-256 hash is stored");
  for (const bad of [k.key, k.key.slice(3), BYOK, "rcpt_test_fixture_secret", "whsec_test_fixture"]) assert.ok(!dump.includes(bad), `leaked ${bad.slice(0, 8)}`);
  // belt and braces: scan every column of every table, not just the agent ones
  const tables = all(store.d1, "SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => String(r.name));
  for (const t of tables) { const txt = JSON.stringify(all(store.d1, `SELECT * FROM "${t}"`)); assert.ok(!txt.includes(k.key.slice(3)) && !txt.includes(BYOK), `secret in table ${t}`); }
});

test("d1: credit_ledger is append-only (UPDATE and DELETE refused at the database), reversals are new rows", async () => {
  const { d1, s, key } = world();
  await key("key_ledger01", "acct_A");
  assert.equal(await s.creditApply("acct_A", 100, "topup", "evt_1", 1), 100);
  assert.equal(await s.creditApply("acct_A", -30, "debit", "rcpt_1", 2, "key_ledger01"), 70);
  assert.throws(() => d1.db.exec("UPDATE credit_ledger SET delta = 9999"), /append-only/);
  assert.throws(() => d1.db.exec("DELETE FROM credit_ledger"), /append-only/);
  assert.throws(() => d1.db.exec("UPDATE credit_ledger SET account_id = 'acct_B'"), /append-only/);
  assert.equal(await s.creditBalance("acct_A"), 70, "nothing changed");
  assert.equal(await s.creditApply("acct_A", 30, "reversal", "rcpt_1", 3, "key_ledger01"), 100);
  assert.deepEqual((await s.creditEntries("acct_A")).map((e) => e.reason), ["topup", "debit", "reversal"]);
  assert.equal(await s.creditApply("acct_A", 100, "topup", "evt_1", 4), undefined, "replayed idempotency key grants nothing");
  assert.equal(await s.creditApply("acct_A", -1000, "debit", "rcpt_big", 5), undefined, "never below zero");
  assert.equal(await s.creditBalance("acct_A"), 100);
});

test("d1: cross-tenant reads return nothing and cross-tenant writes are refused", async () => {
  const { d1, s, key, rcpt } = world();
  await key("key_tenantA01", "acct_A");
  await s.putReceipt(rcpt("rcpt_A1", "key_tenantA01", "acct_A", 10, { idem: "i1" }));
  await s.creditApply("acct_A", 500, "topup", "evt_A", 1);
  assert.equal(await s.keyById("key_tenantA01", "acct_B"), undefined);
  assert.deepEqual(await s.keysByPrefix("key_tena", "acct_B"), []);
  assert.deepEqual(await s.receiptsForKey("key_tenantA01", 10, "acct_B"), []);
  assert.equal(await s.receiptById("rcpt_A1", "acct_B"), undefined);
  assert.equal(await s.receiptByIdem("key_tenantA01", "i1", "acct_B"), undefined);
  assert.equal((await s.receiptById("rcpt_A1", "acct_A"))!.id, "rcpt_A1");
  assert.equal(await s.creditBalance("acct_B"), 0); assert.deepEqual(await s.creditEntries("acct_B"), []);
  // B cannot book a debit or a ledger row against A's key, nor spend A's credits
  assert.deepEqual(await s.creditDebitCapped({ accountId: "acct_B", keyId: "key_tenantA01", amount: 1, ref: "x1", at: 5, dayStart: 0, capDaily: 99, capTotal: 99 }), { ok: false, reason: "key_not_in_tenant" });
  assert.equal(await s.creditApply("acct_B", 5, "topup", "evt_B", 1, "key_tenantA01"), undefined, "ledger row naming another tenant's key is refused");
  assert.equal(await s.creditBalance("acct_A"), 500);
  // every tenant-scoped statement the adapter issued carries account_id in its WHERE
  d1.log.length = 0;
  await s.keyById("k", "acct_A"); await s.keysByPrefix("key_tena", "acct_A"); await s.receiptsForKey("k", 5, "acct_A"); await s.receiptById("r", "acct_A"); await s.receiptByIdem("k", "i", "acct_A"); await s.keysFor("acct_A"); await s.creditBalance("acct_A");
  assert.equal(d1.log.length, 7); for (const l of d1.log) assert.match(l.sql, /account_id = \?/, l.sql);
});

test("d1 f17: idempotency reserve is one atomic statement: one winner under 25 racers, live claim kept, expiry takeover keeps rid", async () => {
  const { s, key } = world(); await key("key_idem0001", "acct_A");
  const racers = await Promise.all(Array.from({ length: 25 }, (_, i) => s.idemReserve("key_idem0001", "same", `rid_${i}`, `owner_${i}`, 1000, 5000)));
  assert.equal(racers.filter((r) => r.won).length, 1);
  const win = racers.find((r) => r.won)!; assert.ok(racers.every((r) => r.rid === win.rid), "losers learn the winner's rid");
  assert.deepEqual(await s.idemReserve("key_idem0001", "same", "rid_x", "late", 5999, 5000), { won: false, rid: win.rid }, "live claim not stolen");
  assert.deepEqual(await s.idemReserve("key_idem0001", "same", "rid_new", "taker", 6000, 5000), { won: true, rid: win.rid }, "takeover keeps the original rid");
  await s.idemRelease("key_idem0001", "same", "someone_else");
  assert.equal((await s.idemReserve("key_idem0001", "same", "r", "o", 6001, 5000)).won, false, "release is owner-only");
  await s.idemRelease("key_idem0001", "same", "taker");
  assert.equal((await s.idemReserve("key_idem0001", "same", "rid_fresh", "o2", 6002, 5000)).won, true, "freed after a failed call");
});

test("d1 f19: spend cap is one atomic statement: 40 racing debits stop exactly at the daily cap, total cap and balance hold", async () => {
  const { s, key } = world(); await key("key_cap00001", "acct_A"); await key("key_cap00002", "acct_A");
  await s.creditApply("acct_A", 1000, "topup", "evt_cap", 0);
  const deb = (keyId: string, i: number, over: object = {}) => s.creditDebitCapped({ accountId: "acct_A", keyId, amount: 5, ref: `d_${keyId}_${i}`, at: 100, dayStart: 50, capDaily: 50, capTotal: 1000, ...over });
  const rs = await Promise.all(Array.from({ length: 40 }, (_, i) => deb("key_cap00001", i)));
  assert.equal(rs.filter((r) => r.ok).length, 10, "cap 50 / 5 = exactly 10 allowed, up to and including the cap");
  assert.ok(rs.filter((r) => !r.ok).every((r) => !r.ok && r.reason === "key_cap_daily"));
  assert.deepEqual(await s.keySpend("key_cap00001", 50), { day: 50, total: 50 });
  assert.equal(await s.creditBalance("acct_A"), 950);
  // yesterday's spend does not count against today's cap but does count against the total cap
  assert.deepEqual(await s.creditDebitCapped({ accountId: "acct_A", keyId: "key_cap00001", amount: 5, ref: "old", at: 10, dayStart: 50, capDaily: 50, capTotal: 1000 }), { ok: false, reason: "key_cap_daily" }, "today is full");
  const t = await s.creditDebitCapped({ accountId: "acct_A", keyId: "key_cap00001", amount: 5, ref: "old", at: 10, dayStart: 5, capDaily: 1000, capTotal: 1000 });
  assert.equal(t.ok, true);
  assert.deepEqual(await deb("key_cap00001", 99, { dayStart: 200, capTotal: 55 }), { ok: false, reason: "key_cap_total" });
  // a reversal carrying the key gives the spend back
  await s.creditApply("acct_A", 5, "reversal", "d_key_cap00001_0", 101, "key_cap00001");
  assert.equal((await s.keySpend("key_cap00001", 50)).total, 50);
  // balance guard and duplicate ref, on a fresh key
  assert.deepEqual(await deb("key_cap00002", 0, { amount: 100000, capDaily: 1e9, capTotal: 1e9 }), { ok: false, reason: "insufficient_credits" });
  const first = await deb("key_cap00002", 1); assert.equal(first.ok, true);
  assert.deepEqual(await deb("key_cap00002", 1), { ok: false, reason: "duplicate_ref" });
  assert.equal(await s.setKeyCaps("acct_B", "key_cap00002", 1, 1), false, "another tenant cannot set caps");
  assert.equal(await s.setKeyCaps("acct_A", "key_cap00002", 7, 70), true);
  assert.deepEqual(await s.keyCaps("acct_A", "key_cap00002"), { capDaily: 7, capTotal: 70 });
});

test("d1: concurrent plain debits never oversell the balance", async () => {
  const { s } = world(); await s.creditApply("acct_A", 100, "topup", "evt_o", 0);
  const rs = await Promise.all(Array.from({ length: 30 }, (_, i) => s.creditApply("acct_A", -10, "debit", `o_${i}`, 1)));
  assert.equal(rs.filter((r) => r !== undefined).length, 10); assert.equal(await s.creditBalance("acct_A"), 0);
});

test("d1: account deletion revokes the account's keys in D1 and the ledger rows stay", async () => {
  const h = make({ d1: true }); const store = h.store as D1ShadowStore;
  const s = await h.login("gone@example.com.au");
  const k = await h.j(await h.req("POST", "/keys", { token: s.session, body: { scopes: ["catalogue:read"] } }));
  await store.creditApply(s.account.id, 50, "topup", "evt_gone", 1);
  await h.req("DELETE", "/account", { token: s.session, body: { confirm: "DELETE" } });
  assert.ok((await store.agent.keyById(k.id))!.revokedAt, "revoked in D1");
  assert.equal(await store.agent.creditBalance(s.account.id), 50, "financial record kept");
});
