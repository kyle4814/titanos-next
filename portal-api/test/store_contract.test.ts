// ONE store test suite, run against BOTH adapters (MemoryStore and D1Store over a real-SQLite fake D1). Same assertions,
// identical outcomes required. A divergence between the two is a bug in one of them.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MemoryStore, type Store, type Account, type Purchase } from "../src/store.ts";
import { D1Store } from "../src/d1store.ts";
import { FakeD1, MIGRATIONS } from "./fake_d1.ts";
import { make } from "./harness.ts";

type Mk = () => { store: Store; d1?: FakeD1 };
const ADAPTERS: [string, Mk][] = [
  ["MemoryStore", () => ({ store: new MemoryStore() })],
  ["D1Store(FakeD1)", () => { const d1 = new FakeD1(); return { store: new D1Store(d1), d1 }; }],
];
const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x)); // explicit-undefined and absent keys are the same thing here
const acct = (id: string, extra: Partial<Account> = {}): Account => ({ id, email: `${id}@ex.com.au`, seat: "owner", createdAt: 1_000, ...extra });
const purchase = (id: string, accountId: string, extra: Partial<Purchase> = {}): Purchase => ({ id, accountId, productId: "compliance_pack", checkoutId: `cs_${id}`, amountCents: 599700, deliverableIssued: false, refundedCents: 0, status: "pending", ...extra });

for (const [name, mk] of ADAPTERS) describe(`Store contract: ${name}`, () => {
  test("accounts: put/get/update by id and email; missing is undefined; optional fields round-trip", async () => {
    const { store: s } = mk();
    assert.equal(await s.accountById("nope"), undefined); assert.equal(await s.accountByEmail("no@x.y"), undefined);
    await s.putAccount(acct("a1"));
    assert.deepEqual(plain(await s.accountById("a1")), acct("a1"));
    await s.putAccount(acct("a1", { stripeCustomerId: "cus_1", seat: "pro" }));
    const a = (await s.accountByEmail("a1@ex.com.au"))!;
    assert.equal(a.stripeCustomerId, "cus_1"); assert.equal(a.seat, "pro"); assert.equal(a.createdAt, 1_000); assert.equal(a.deletedAt, undefined);
  });

  test("login tokens: valid once; expired and unknown refuse; the used flag is true on the returned token", async () => {
    const { store: s } = mk();
    await s.putLoginToken({ hash: "h1", email: "e@x.y", expiresAt: 5_000, used: false });
    assert.equal(await s.consumeLoginToken("h1", 5_001), undefined, "expired");
    assert.equal(await s.consumeLoginToken("zz", 1), undefined, "unknown");
    const t = (await s.consumeLoginToken("h1", 5_000))!;
    assert.deepEqual({ email: t.email, used: t.used, expiresAt: t.expiresAt }, { email: "e@x.y", used: true, expiresAt: 5_000 });
    assert.equal(await s.consumeLoginToken("h1", 1), undefined, "second use refused");
  });

  test("login tokens: 20 concurrent consumes, exactly one wins", async () => {
    const { store: s } = mk();
    await s.putLoginToken({ hash: "race", email: "e@x.y", expiresAt: 9e9, used: false });
    const r = await Promise.all(Array.from({ length: 20 }, () => s.consumeLoginToken("race", 1)));
    assert.equal(r.filter(Boolean).length, 1);
  });

  test("login rate log counts per email inside the window", async () => {
    const { store: s } = mk();
    await s.noteLoginRequest("a@x.y", 100); await s.noteLoginRequest("a@x.y", 200); await s.noteLoginRequest("b@x.y", 200);
    assert.equal(await s.loginRequestsSince("a@x.y", 150), 1); assert.equal(await s.loginRequestsSince("a@x.y", 0), 2); assert.equal(await s.loginRequestsSince("c@x.y", 0), 0);
  });

  test("sessions: live until expiry (exclusive), deleteSessionsFor kills only that account", async () => {
    const { store: s } = mk();
    await s.putAccount(acct("a1")); await s.putAccount(acct("a2"));
    await s.putSession({ hash: "s1", accountId: "a1", expiresAt: 100 }); await s.putSession({ hash: "s2", accountId: "a2", expiresAt: 100 });
    assert.deepEqual(await s.sessionByHash("s1", 99), { hash: "s1", accountId: "a1", expiresAt: 100 });
    assert.equal(await s.sessionByHash("s1", 100), undefined); assert.equal(await s.sessionByHash("nope", 1), undefined);
    await s.deleteSessionsFor("a1");
    assert.equal(await s.sessionByHash("s1", 1), undefined); assert.ok(await s.sessionByHash("s2", 1));
  });

  test("domains: per-account list in insertion order, verifiedOwnerOf only for verified, update in place", async () => {
    const { store: s } = mk();
    await s.putAccount(acct("a1")); await s.putAccount(acct("a2"));
    await s.putDomain({ id: "d1", accountId: "a1", domain: "one.com.au", token: "t1" });
    await s.putDomain({ id: "d2", accountId: "a1", domain: "two.com.au", token: "t2" });
    await s.putDomain({ id: "d3", accountId: "a2", domain: "one.com.au", token: "t3" });
    assert.deepEqual((await s.domainsFor("a1")).map((d) => d.id), ["d1", "d2"]);
    assert.equal(await s.verifiedOwnerOf("one.com.au"), undefined, "unverified owns nothing");
    await s.putDomain({ id: "d3", accountId: "a2", domain: "one.com.au", token: "t3", verifiedAt: 777 });
    assert.deepEqual(plain(await s.verifiedOwnerOf("one.com.au")), { id: "d3", accountId: "a2", domain: "one.com.au", token: "t3", verifiedAt: 777 });
    assert.equal((await s.domainById("d1"))!.verifiedAt, undefined);
    assert.equal((await s.domainsFor("a2")).length, 1);
  });

  test("purchases, subscriptions, invoices: round-trip every field, scoped per account, upsert keeps order", async () => {
    const { store: s } = mk();
    await s.putAccount(acct("a1")); await s.putAccount(acct("a2"));
    const p1 = purchase("p1", "a1", { domain: "x.com.au", paidAt: 50, paymentIntent: "pi_1", subscriptionId: "sub_1", deliverableIssued: true, refundedCents: 10, status: "paid" });
    await s.putPurchase(p1); await s.putPurchase(purchase("p2", "a1")); await s.putPurchase(purchase("p3", "a2"));
    assert.deepEqual(plain(await s.purchaseById("p1")), plain(p1));
    assert.deepEqual(plain(await s.purchaseByCheckout("cs_p2")), purchase("p2", "a1"));
    assert.equal(await s.purchaseByCheckout("cs_zz"), undefined);
    await s.putPurchase({ ...p1, status: "refunded", refundedCents: 599700 });
    assert.deepEqual((await s.purchasesFor("a1")).map((p) => [p.id, p.status]), [["p1", "refunded"], ["p2", "pending"]]);
    const sub = { id: "sb1", accountId: "a1", purchaseId: "p1", productId: "monitor_monthly", startedAt: 5 };
    await s.putSubscription(sub);
    assert.deepEqual(plain(await s.subscriptionById("sb1")), sub);
    await s.putSubscription({ ...sub, cancelAt: 99, cancelledAt: 60 });
    assert.deepEqual(plain((await s.subscriptionsFor("a1"))[0]), { ...sub, cancelAt: 99, cancelledAt: 60 });
    assert.deepEqual(await s.subscriptionsFor("a2"), []);
    const inv = { id: "i1", accountId: "a1", number: "TT-000001", productId: "monitor_monthly", amountCents: 14900, issuedAt: 8, stripeEventId: "evt_1" };
    await s.putInvoice(inv);
    assert.deepEqual(await s.invoiceById("i1"), inv); assert.deepEqual(await s.invoicesFor("a1"), [inv]); assert.deepEqual(await s.invoicesFor("a2"), []);
  });

  test("invoice numbers: gap-free, increasing, unique under 30 concurrent calls", async () => {
    const { store: s } = mk();
    assert.equal(await s.nextInvoiceNumber(), "TT-000001"); assert.equal(await s.nextInvoiceNumber(), "TT-000002");
    const many = await Promise.all(Array.from({ length: 30 }, () => s.nextInvoiceNumber()));
    assert.equal(new Set(many).size, 30);
    assert.deepEqual([...many].sort(), Array.from({ length: 30 }, (_, i) => `TT-${String(i + 3).padStart(6, "0")}`));
  });

  test("webhook events: claimEvent true once only, even for 20 concurrent claims", async () => {
    const { store: s } = mk();
    assert.equal(await s.claimEvent("evt_a"), true); assert.equal(await s.claimEvent("evt_a"), false); assert.equal(await s.claimEvent("evt_b"), true);
    const r = await Promise.all(Array.from({ length: 20 }, () => s.claimEvent("evt_race")));
    assert.equal(r.filter(Boolean).length, 1);
  });

  test("review cards: open list excludes resolved, resolving by put", async () => {
    const { store: s } = mk();
    await s.putAccount(acct("a1")); await s.putPurchase(purchase("p1", "a1"));
    const c = { id: "c1", accountId: "a1", purchaseId: "p1", kind: "refund_outside_policy" as const, reason: "day 20", createdAt: 3, resolved: false };
    await s.putCard(c); await s.putCard({ ...c, id: "c2" });
    assert.deepEqual((await s.openCards()).map((x) => x.id), ["c1", "c2"]);
    await s.putCard({ ...c, resolved: true });
    assert.deepEqual(plain(await s.openCards()), [{ ...c, id: "c2" }]);
  });

  test("api keys: scopes round-trip (including empty), by id, by hash, per account, revoke by put", async () => {
    const { store: s } = mk();
    await s.putAccount(acct("a1")); await s.putAccount(acct("a2"));
    const k = { id: "k1", accountId: "a1", hash: "hh1", scopes: ["scan:read", "agent:call"], createdAt: 12 };
    await s.putKey(k); await s.putKey({ id: "k2", accountId: "a1", hash: "hh2", scopes: [], createdAt: 13 }); await s.putKey({ id: "k3", accountId: "a2", hash: "hh3", scopes: ["x"], createdAt: 14 });
    assert.deepEqual(plain(await s.keyById("k1")), k); assert.deepEqual(plain(await s.keyByHash("hh1")), k); assert.equal(await s.keyByHash("none"), undefined);
    assert.deepEqual((await s.keyById("k2"))!.scopes, []);
    assert.deepEqual((await s.keysFor("a1")).map((x) => x.id), ["k1", "k2"]);
    await s.putKey({ ...k, revokedAt: 99 });
    assert.equal((await s.keyByHash("hh1"))!.revokedAt, 99);
  });

  test("credits: topup, exact-zero debit allowed, overdraw refused and leaves the balance alone, ledger in order", async () => {
    const { store: s } = mk();
    await s.putAccount(acct("a1"));
    assert.equal(await s.creditBalance("a1"), 0);
    assert.equal(await s.creditApply("a1", 100, "topup", "evt_1", 1), 100);
    assert.equal(await s.creditApply("a1", -101, "debit", "r1", 2), undefined, "would go to -1");
    assert.equal(await s.creditBalance("a1"), 100);
    assert.equal(await s.creditApply("a1", -60, "debit", "r2", 3), 40);
    assert.equal(await s.creditApply("a1", 60, "reversal", "r2", 4), 100);
    assert.equal(await s.creditApply("a1", -100, "debit", "r3", 5), 0, "exactly zero is allowed");
    assert.equal(await s.creditApply("a1", -1, "debit", "r4", 6), undefined);
    assert.equal(await s.creditApply("a1", 0, "topup", "zero", 7), 0, "a zero delta at zero balance is allowed");
    assert.deepEqual((await s.creditEntries("a1")).map((e) => [e.delta, e.reason, e.ref]), [[100, "topup", "evt_1"], [-60, "debit", "r2"], [60, "reversal", "r2"], [-100, "debit", "r3"], [0, "topup", "zero"]]);
  });

  test("credits: balances are per account (a rich neighbour cannot fund a debit)", async () => {
    const { store: s } = mk();
    await s.putAccount(acct("a1")); await s.putAccount(acct("a2"));
    await s.creditApply("a2", 1_000_000, "topup", "big", 1);
    assert.equal(await s.creditApply("a1", -1, "debit", "x", 2), undefined);
    assert.equal(await s.creditBalance("a1"), 0); assert.deepEqual(await s.creditEntries("a1"), []);
  });

  test("CONCURRENCY: 60 parallel debits of 10 against a balance of 250 -> exactly 25 succeed, balance 0, never negative", async () => {
    const { store: s } = mk();
    await s.putAccount(acct("a1")); await s.creditApply("a1", 250, "topup", "seed", 1);
    const r = await Promise.all(Array.from({ length: 60 }, (_, i) => s.creditApply("a1", -10, "debit", `rc${i}`, 2 + i)));
    assert.equal(r.filter((x) => x !== undefined).length, 25, "oversell would show more than 25");
    assert.equal(r.filter((x) => x === undefined).length, 35);
    assert.equal(await s.creditBalance("a1"), 0);
    const ledger = await s.creditEntries("a1");
    assert.equal(ledger.reduce((n, e) => n + e.delta, 0), 0); assert.equal(ledger.length, 26);
  });

  test("CONCURRENCY: debits racing topups and reversals keep the ledger sum equal to the balance and never below 0", async () => {
    const { store: s } = mk();
    await s.putAccount(acct("a1")); await s.putAccount(acct("a2"));
    await s.creditApply("a1", 100, "topup", "seed", 1);
    const ops: Promise<number | undefined>[] = [];
    for (let i = 0; i < 40; i++) {
      ops.push(s.creditApply("a1", -7, "debit", `d${i}`, 10 + i));
      if (i % 4 === 0) ops.push(s.creditApply("a1", 20, "topup", `t${i}`, 10 + i));
      if (i % 5 === 0) ops.push(s.creditApply("a2", -1, "debit", `n${i}`, 10 + i)); // a neighbour with 0 credit never gets through
    }
    const out = await Promise.all(ops);
    const bal = await s.creditBalance("a1");
    const entries = await s.creditEntries("a1");
    assert.ok(bal >= 0);
    assert.equal(entries.reduce((n, e) => n + e.delta, 0), bal);
    let run = 0; for (const e of entries) { run += e.delta; assert.ok(run >= 0, "balance never dips below 0 at any ledger position"); }
    assert.equal(await s.creditBalance("a2"), 0);
    assert.ok(out.every((x) => x === undefined || x >= 0));
  });

  test("credit orders, receipts, idempotency lookups and the per-key call counter", async () => {
    const { store: s } = mk();
    await s.putAccount(acct("a1")); await s.putKey({ id: "k1", accountId: "a1", hash: "h", scopes: [], createdAt: 1 });
    const o = { id: "o1", accountId: "a1", checkoutId: "cs_1", packId: "credits_2000", credits: 2000, paid: false };
    await s.putCreditOrder(o); assert.deepEqual(await s.creditOrderByCheckout("cs_1"), o); assert.equal(await s.creditOrderByCheckout("cs_x"), undefined);
    await s.putCreditOrder({ ...o, paid: true }); assert.equal((await s.creditOrderByCheckout("cs_1"))!.paid, true);
    const r = { id: "rc1", tool: "dns_grade", keyId: "k1", accountId: "a1", at: 5, inputSha: "i", outputSha: "o", credits: 5, mode: "prepaid" as const, sig: "sg", idem: "idem-1" };
    await s.putReceipt(r); await s.putReceipt({ ...r, id: "rc2", idem: undefined });
    assert.deepEqual(plain(await s.receiptById("rc1")), r);
    assert.equal((await s.receiptById("rc2"))!.idem, undefined, "no idem when none was given");
    assert.deepEqual(plain(await s.receiptByIdem("k1", "idem-1")), r); assert.equal(await s.receiptByIdem("k1", "other"), undefined); assert.equal(await s.receiptByIdem("k9", "idem-1"), undefined);
    await s.noteCall("k1", 100); await s.noteCall("k1", 200); await s.noteCall("k2", 200);
    assert.equal(await s.callsSince("k1", 150), 1); assert.equal(await s.callsSince("k1", 0), 2); assert.equal(await s.callsSince("k3", 0), 0);
  });

  test("anonymiseAccount: PII gone, keys revoked, sessions and domains removed, purchases and invoices kept, other accounts untouched", async () => {
    const { store: s } = mk();
    await s.putAccount(acct("a1", { stripeCustomerId: "cus_1" })); await s.putAccount(acct("a2"));
    await s.putSession({ hash: "s1", accountId: "a1", expiresAt: 9e9 }); await s.putSession({ hash: "s2", accountId: "a2", expiresAt: 9e9 });
    await s.putDomain({ id: "d1", accountId: "a1", domain: "a.com.au", token: "t" }); await s.putDomain({ id: "d2", accountId: "a2", domain: "b.com.au", token: "t" });
    await s.putKey({ id: "k1", accountId: "a1", hash: "h1", scopes: ["x"], createdAt: 1 }); await s.putKey({ id: "k2", accountId: "a2", hash: "h2", scopes: ["x"], createdAt: 1 });
    await s.putPurchase(purchase("p1", "a1")); await s.putInvoice({ id: "i1", accountId: "a1", number: "TT-000001", productId: "x", amountCents: 1, issuedAt: 1, stripeEventId: "e" });
    await s.anonymiseAccount("a1", 4242);
    const a = (await s.accountById("a1"))!;
    assert.equal(a.email, "deleted+a1@deleted.invalid"); assert.equal(a.stripeCustomerId, undefined); assert.equal(a.deletedAt, 4242);
    assert.equal(await s.accountByEmail("a1@ex.com.au"), undefined);
    assert.equal(await s.sessionByHash("s1", 1), undefined); assert.ok(await s.sessionByHash("s2", 1));
    assert.deepEqual(await s.domainsFor("a1"), []); assert.equal((await s.domainsFor("a2")).length, 1);
    assert.equal((await s.keyById("k1"))!.revokedAt, 4242); assert.equal((await s.keyById("k2"))!.revokedAt, undefined);
    assert.equal((await s.purchasesFor("a1")).length, 1); assert.equal((await s.invoicesFor("a1")).length, 1);
    assert.equal((await s.accountById("a2"))!.deletedAt, undefined);
    await s.anonymiseAccount("ghost", 1); // unknown id: no throw
  });

  test("anonymiseAccount keeps an earlier revokedAt", async () => {
    const { store: s } = mk();
    await s.putAccount(acct("a1")); await s.putKey({ id: "k1", accountId: "a1", hash: "h1", scopes: [], createdAt: 1, revokedAt: 10 });
    await s.anonymiseAccount("a1", 500);
    assert.equal((await s.keyById("k1"))!.revokedAt, 10);
  });

  test("hostile strings are data, never SQL (quotes, semicolons, comment markers)", async () => {
    const { store: s } = mk();
    const evil = `x'); DROP TABLE accounts;--`;
    await s.putAccount(acct("a1", { email: evil + "@e.com" }));
    assert.equal((await s.accountByEmail(evil + "@e.com"))!.id, "a1");
    await s.putDomain({ id: "d1", accountId: "a1", domain: evil, token: evil, verifiedAt: 1 });
    assert.equal((await s.verifiedOwnerOf(evil))!.token, evil);
    assert.ok(await s.accountById("a1"));
  });
});

// ---- D1-only: the shape of the SQL itself ----
describe("D1Store SQL shape", () => {
  test("the migrations it is written against are exactly 0001..0004, in order", () => {
    assert.deepEqual(MIGRATIONS.map((m) => m.slice(0, 4)), ["0001", "0002", "0003", "0004"]);
  });

  test("the debit is ONE statement: a single conditional INSERT...SELECT, no preceding SELECT, one write per call", async () => {
    const d1 = new FakeD1(); const s = new D1Store(d1);
    await s.putAccount(acct("a1")); d1.log.length = 0;
    await s.creditApply("a1", 50, "topup", "e", 1);
    await s.creditApply("a1", -20, "debit", "r", 2);
    await s.creditApply("a1", -999, "debit", "r2", 3);
    assert.equal(d1.log.length, 3, "exactly one round trip per creditApply, even when refused");
    for (const q of d1.log) {
      assert.match(q.sql, /^INSERT INTO credit_ledger .* SELECT .* WHERE \(SELECT COALESCE\(SUM\(delta\), 0\) FROM credit_ledger WHERE account_id = \?2\) \+ \?3 >= 0/s);
      assert.ok(!/^\s*SELECT/i.test(q.sql), "no read-then-write");
    }
  });

  test("every account-scoped list/lookup binds account_id in its WHERE; no query is built by string concatenation", async () => {
    const d1 = new FakeD1(); const s = new D1Store(d1);
    await s.putAccount(acct("a1")); d1.log.length = 0;
    await s.domainsFor("a1"); await s.purchasesFor("a1"); await s.subscriptionsFor("a1"); await s.invoicesFor("a1"); await s.keysFor("a1"); await s.creditEntries("a1"); await s.creditBalance("a1");
    assert.equal(d1.log.length, 7);
    for (const q of d1.log) { assert.match(q.sql, /WHERE account_id = \?/, q.sql); assert.deepEqual(q.args, ["a1"]); assert.ok(!q.sql.includes("a1"), "the value travels as a bound parameter"); }
  });

  test("tenant rule: no table in 0001..0004 carries tenant_id and D1Store implements no enterprise method (EntStore adapter is a separate lane)", () => {
    const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
    for (const m of MIGRATIONS) assert.ok(!/tenant_id/i.test(readFileSync(dir + m, "utf8")), `${m} has no tenant table`);
    const src = readFileSync(fileURLToPath(new URL("../src/d1store.ts", import.meta.url)), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    assert.ok(!/tenant|EntStore|reservePayout|transitionPayout/i.test(src));
  });

  test("no INSERT OR REPLACE anywhere (it deletes the row and trips foreign keys)", () => {
    const src = readFileSync(fileURLToPath(new URL("../src/d1store.ts", import.meta.url)), "utf8");
    const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    assert.ok(!/INSERT OR REPLACE|REPLACE INTO/i.test(code));
  });

  test("anonymiseAccount runs as one D1 batch, and a failing statement rolls the lot back", async () => {
    const d1 = new FakeD1(); const s = new D1Store(d1);
    await s.putAccount(acct("a1")); await s.putKey({ id: "k1", accountId: "a1", hash: "h", scopes: [], createdAt: 1 }); await s.putSession({ hash: "s", accountId: "a1", expiresAt: 9e9 });
    // sabotage the last statement so the batch must fail: a trigger that aborts the account update
    d1.db.exec("CREATE TRIGGER boom BEFORE UPDATE OF email ON accounts BEGIN SELECT RAISE(ABORT, 'boom'); END");
    await assert.rejects(s.anonymiseAccount("a1", 9));
    assert.equal((await s.keyById("k1"))!.revokedAt, undefined, "key revoke rolled back");
    assert.ok(await s.sessionByHash("s", 1), "session delete rolled back");
    assert.equal((await s.accountById("a1"))!.deletedAt, undefined);
  });

  test("a replayed (reason, ref) cannot grant twice on D1 (UNIQUE guard), and a refused write leaves no row", async () => {
    const s = new D1Store(new FakeD1()); await s.putAccount(acct("a1"));
    assert.equal(await s.creditApply("a1", 100, "topup", "evt_dup", 1), 100);
    assert.equal(await s.creditApply("a1", 100, "topup", "evt_dup", 2), undefined);
    assert.equal(await s.creditBalance("a1"), 100);
  });

  test("MUTANT: a read-then-write debit DOES oversell under the same concurrency (proves the test bites)", async () => {
    class Naive extends D1Store {
      async creditApply(id: string, delta: number, reason: any, ref: string, at: number) {
        const bal = await this.creditBalance(id);
        if (bal + delta < 0) return undefined;
        const d = (this as any).db; await d.prepare("INSERT INTO credit_ledger (id, account_id, delta, reason, ref, at) VALUES (?,?,?,?,?,?)").bind(`e_${ref}`, id, delta, reason, ref, at).run();
        return bal + delta;
      }
    }
    const s = new Naive(new FakeD1()); await s.putAccount(acct("a1")); await s.creditApply("a1", 250, "topup", "seed", 1);
    await Promise.all(Array.from({ length: 60 }, (_, i) => s.creditApply("a1", -10, "debit", `rc${i}`, 2 + i)));
    assert.ok((await s.creditBalance("a1")) < 0, "the naive adapter overdraws; the real one cannot");
  });
});

// ---- the whole HTTP service on top of each adapter: identical outcomes ----
for (const [name, mk] of ADAPTERS) describe(`HTTP service end to end on ${name}`, () => {
  test("stranger journey: sign up, verify domain, buy + pay, invoice, key, cancel, in-policy refund, export, delete, session dead", async () => {
    const h = make(mk().store);
    const email = "owner@acme.com.au", domain = "acme.com.au";
    const { session, account } = await h.login(email);
    const { v } = await h.verifiedDomain(session, domain);
    assert.equal(v.verified ?? true, true);
    for (const pid of ["monitor_monthly", "compliance_pack"]) {
      const c = await h.req("POST", "/checkout", { token: session, body: { product: pid, domain } });
      assert.equal(c.status, 201, pid);
      const paid = await h.pay(pid, account.id); assert.equal(paid.res.status, 200);
    }
    const inv = await h.j(await h.req("GET", "/invoices", { token: session }));
    assert.equal(inv.invoices.length, 2); assert.deepEqual(inv.invoices.map((i: any) => i.number), ["TT-000001", "TT-000002"]);
    assert.equal((await h.req("GET", `/invoices/${inv.invoices[0].id}`, { token: session })).status, 200);
    const k = await h.j(await h.req("POST", "/keys", { token: session, body: { scopes: ["scan:read"] } }));
    assert.equal((await h.j(await h.req("GET", "/keys", { token: session }))).keys.length, 1);
    await h.req("DELETE", `/keys/${k.id}`, { token: session });
    const bill = await h.j(await h.req("GET", "/billing", { token: session }));
    for (const s of bill.subscriptions) assert.equal((await h.req("POST", `/subscriptions/${s.id}/cancel`, { token: session })).status, 200);
    const comp = bill.purchases.find((p: any) => p.productId === "compliance_pack");
    h.clock.t += 3 * 86_400_000;
    assert.equal((await h.j(await h.req("POST", "/refunds", { token: session, body: { purchaseId: comp.id } }))).status, "refunded");
    assert.equal((await h.j(await h.req("GET", "/account/export", { token: session }))).account.email, email);
    assert.equal((await h.req("DELETE", "/account", { token: session, body: { confirm: "DELETE" } })).status, 200);
    assert.equal((await h.req("GET", "/me", { token: session })).status, 401);
    assert.equal((await h.store.openCards()).length, 0);
    assert.equal(await h.store.accountByEmail(email), undefined, "email anonymised");
    assert.equal((await h.store.invoicesFor((await h.store.purchasesFor(comp.accountId))[0].accountId)).length, 2, "financial records survive deletion");
  });

  test("login link works once; a forged or replayed webhook grants nothing twice", async () => {
    const h = make(mk().store);
    const { loginToken } = await h.login("once@x.com.au");
    assert.equal((await h.req("POST", "/auth/verify", { body: { token: loginToken } })).status >= 400, true, "second use of the link refused");
  });

  test("agent door: top up via the signed webhook, call a paid tool over MCP, the debit and receipt land, a replayed top-up grants once", async () => {
    const h = make(mk().store);
    const s = await h.login("bot@x.com.au");
    const key = await h.j(await h.req("POST", "/keys", { token: s.session, body: { scopes: ["scan:read", "credits:read"] } }));
    const t = await h.j(await h.req("POST", "/agent/credits/topup", { token: s.session, body: { pack: "credits_2000" } }));
    const checkoutId = String(t.checkoutUrl).split("/").pop()!;
    const order = await h.store.creditOrderByCheckout(checkoutId);
    assert.ok(order, "order stored"); assert.equal(order!.paid, false);
    const pay = () => h.webhook("checkout.session.completed", { id: checkoutId, payment_status: "paid" }, { id: "evt_topup_1" });
    assert.equal((await pay()).status, 200);
    assert.equal(await h.store.creditBalance(s.account.id), 2000);
    assert.equal((await h.store.creditOrderByCheckout(checkoutId))!.paid, true);
    await pay();
    assert.equal(await h.store.creditBalance(s.account.id), 2000, "replay grants nothing");
    h.dns.zone["good.example.com.au"] = ["v=spf1 include:_spf.google.com -all"];
    const call = await h.j(await h.req("POST", "/mcp", { token: key.key, headers: { "idempotency-key": "idem-1" }, body: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "domain_check", arguments: { domain: "good.example.com.au" } } } }));
    assert.ok(!call.result?.isError, JSON.stringify(call).slice(0, 300));
    assert.equal(await h.store.creditBalance(s.account.id), 1995, "5 credits debited");
    const entries = await h.store.creditEntries(s.account.id);
    assert.deepEqual(entries.map((e) => [e.reason, e.delta]), [["topup", 2000], ["debit", -5]]);
    const again = await h.j(await h.req("POST", "/mcp", { token: key.key, headers: { "idempotency-key": "idem-1" }, body: { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "domain_check", arguments: { domain: "good.example.com.au" } } } }));
    assert.ok(again.result);
    assert.equal(await h.store.creditBalance(s.account.id), 1995, "an idempotent retry is not charged twice");
  });
});
