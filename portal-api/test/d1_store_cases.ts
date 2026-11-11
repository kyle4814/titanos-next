// f345: the SHARED contract cases for the Store methods D1Store used to lack (see d1_store_parity.test.ts). One list of cases, run by
// d1_store_contract.test.ts against MemoryStore and against D1Store over FakeD1 with identical assertions, and again against mutants.
// Synthetic data only: ids, emails and amounts are invented.
import assert from "node:assert/strict";
import type { Store, Account, Purchase, Subscription, Invoice, ApiKey, AgentReceipt } from "../src/store.ts";

export type Mk = () => { store: Store };
export interface Case { name: string; covers: string[]; run: (mk: Mk) => Promise<void> }

const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const acct = (id: string): Account => ({ id, email: `${id}@ex.invalid`, seat: "owner", createdAt: 1_000 });
const pur = (id: string, accountId: string, x: Partial<Purchase> = {}): Purchase => ({ id, accountId, productId: "compliance_pack", checkoutId: `cs_${id}`, amountCents: 599700, deliverableIssued: false, refundedCents: 0, status: "pending", ...x });
const sub = (id: string, accountId: string, purchaseId: string, x: Partial<Subscription> = {}): Subscription => ({ id, accountId, purchaseId, productId: "monitor_monthly", startedAt: 5, ...x });
const inv = (id: string, accountId: string, purchaseId: string | undefined, x: Partial<Invoice> = {}): Invoice => ({ id, accountId, ...(purchaseId === undefined ? {} : { purchaseId }), number: `TT-${id}`, productId: "monitor_monthly", amountCents: 14900, issuedAt: 8, stripeEventId: `evt_${id}`, ...x });
const base = async (s: Store) => { await s.putAccount(acct("a1")); await s.putAccount(acct("a2")); };
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
const wins = (rs: unknown[]) => rs.filter(Boolean).length;

export const CASES: Case[] = [
  { name: "casPurchase: writes only while the status still matches; absent row and wrong status lose and write nothing; the whole row (createdAt too) is replaced", covers: ["casPurchase"], run: async (mk) => {
    const s = mk().store; await base(s);
    const p = pur("p1", "a1", { createdAt: 77 }); await s.putPurchase(p);
    assert.equal(await s.casPurchase(pur("zz", "a1", { status: "paid" }), "pending"), false, "absent row");
    assert.equal(await s.casPurchase({ ...p, status: "paid", paidAt: 9 }, "paid"), false, "wrong expected status");
    assert.deepEqual(plain(await s.purchaseById("p1")), plain(p), "a lost CAS writes nothing");
    assert.equal(await s.casPurchase({ ...p, status: "paid", paidAt: 9, paymentIntent: "pi_1", deliverableIssued: true }, "pending"), true);
    assert.deepEqual(plain(await s.purchaseById("p1")), plain({ ...p, status: "paid", paidAt: 9, paymentIntent: "pi_1", deliverableIssued: true }));
    assert.equal(await s.casPurchase({ ...p, status: "refunded" }, "pending"), false, "second transition from the old state loses");
    // the refunded_cents guard (f239) is part of the condition when given
    assert.equal(await s.casPurchase({ ...p, status: "paid", refundedCents: 500 }, "paid", 100), false, "stale refund total");
    assert.equal(await s.casPurchase({ ...p, status: "paid", paidAt: 9, refundedCents: 500 }, "paid", 0), true, "matching refund total");
    assert.equal((await s.purchaseById("p1"))!.refundedCents, 500);
    // a next row without createdAt replaces the stored one (full-row write on both stores)
    assert.equal(await s.casPurchase(pur("p1", "a1", { status: "refunded", paidAt: 9 }), "paid"), true);
    assert.equal((await s.purchaseById("p1"))!.createdAt, undefined);
  } },
  { name: "casPurchase: 20 concurrent callers racing one transition, exactly one wins", covers: ["casPurchase"], run: async (mk) => {
    const s = mk().store; await base(s); await s.putPurchase(pur("p1", "a1"));
    const r = await Promise.all(Array.from({ length: 20 }, (_, i) => s.casPurchase(pur("p1", "a1", { status: "paid", paidAt: i }), "pending")));
    assert.equal(wins(r), 1);
  } },
  { name: "purchaseByPaymentIntent: first inserted wins, unknown is undefined, createdAt round-trips", covers: ["purchaseByPaymentIntent"], run: async (mk) => {
    const s = mk().store; await base(s);
    await s.putPurchase(pur("p1", "a1", { paymentIntent: "pi_x", createdAt: 11 })); await s.putPurchase(pur("p2", "a2", { paymentIntent: "pi_x" })); await s.putPurchase(pur("p3", "a1", { paymentIntent: "pi_y" }));
    assert.equal((await s.purchaseByPaymentIntent("pi_x"))!.id, "p1");
    assert.equal((await s.purchaseByPaymentIntent("pi_y"))!.id, "p3");
    assert.equal(await s.purchaseByPaymentIntent("pi_none"), undefined);
    assert.equal((await s.purchaseById("p1"))!.createdAt, 11);
  } },
  { name: "pendingPurchasesBefore + countByStatus: inclusive cutoff, oldest first (id breaks ties), no createdAt counts as oldest, abandoned and cancelled counted apart", covers: ["pendingPurchasesBefore", "countByStatus"], run: async (mk) => {
    const s = mk().store; await base(s);
    await s.putPurchase(pur("pB", "a1", { createdAt: 100 })); await s.putPurchase(pur("pA", "a1", { createdAt: 100 })); await s.putPurchase(pur("pOld", "a1")); // no createdAt
    await s.putPurchase(pur("pNew", "a1", { createdAt: 500 })); await s.putPurchase(pur("pPaid", "a1", { status: "paid", createdAt: 1, paidAt: 2 }));
    await s.putPurchase(pur("pAb", "a1", { status: "abandoned", createdAt: 1 })); await s.putPurchase(pur("pCa", "a1", { status: "cancelled", createdAt: 1 })); await s.putPurchase(pur("pCa2", "a2", { status: "cancelled" }));
    assert.deepEqual(ids(await s.pendingPurchasesBefore(100)), ["pOld", "pA", "pB"]);
    assert.deepEqual(ids(await s.pendingPurchasesBefore(99)), ["pOld"]);
    assert.deepEqual(ids(await s.pendingPurchasesBefore(1000)), ["pOld", "pA", "pB", "pNew"]);
    assert.deepEqual([await s.countByStatus("pending"), await s.countByStatus("abandoned"), await s.countByStatus("cancelled"), await s.countByStatus("paid"), await s.countByStatus("refunded")], [4, 1, 2, 1, 0]);
  } },
  { name: "invoice reconciler: purchaseInvoiced, issueInvoiceNumbered (number taken atomically with the guarded insert; once per purchase; a loser consumes no number), paidPurchasesBefore", covers: ["purchaseInvoiced", "issueInvoiceNumbered", "paidPurchasesBefore", "putInvoice"], run: async (mk) => {
    const s = mk().store; await base(s);
    await s.putPurchase(pur("p2", "a1", { status: "paid", paidAt: 20 })); await s.putPurchase(pur("p1", "a1", { status: "paid", paidAt: 20 })); await s.putPurchase(pur("p3", "a1", { status: "refunded", paidAt: 10 }));
    await s.putPurchase(pur("p4", "a1", { status: "pending" })); await s.putPurchase(pur("p5", "a1", { status: "paid", paidAt: 99 })); await s.putPurchase(pur("p6", "a2", { status: "paid", paidAt: 5 }));
    assert.deepEqual(ids(await s.paidPurchasesBefore(20)), ["p6", "p3", "p1", "p2"], "paid or refunded, at or before cutoff, oldest first, id breaks ties");
    assert.equal(await s.purchaseInvoiced("p6"), false);
    const draft = (id: string, a: string, p: string, x: Partial<Invoice> = {}) => { const { number: _n, purchaseId: _p, ...d } = inv(id, a, p, x); return { ...d, purchaseId: p }; };
    const w6 = await s.issueInvoiceNumbered(draft("i6", "a2", "p6"), "purchase");
    assert.equal(w6?.number, "TT-000001", "the winner carries the first number");
    assert.equal(await s.issueInvoiceNumbered(draft("i6b", "a2", "p6", { stripeEventId: "evt_other" }), "purchase"), undefined, "second invoice for the purchase loses");
    assert.equal(await s.purchaseInvoiced("p6"), true);
    assert.deepEqual(plain(await s.invoicesFor("a2")), [inv("i6", "a2", "p6", { number: "TT-000001" })], "the loser wrote nothing; purchaseId round-trips");
    assert.deepEqual(ids(await s.paidPurchasesBefore(20)), ["p3", "p1", "p2"], "invoiced purchase drops out");
    // f366: the draft requires a purchase id, so the old no-purchase collision case is gone with the old API (the reconciler only ever issues for a purchase).
    const race = await Promise.all(["x1", "x2", "x3", "x4", "x5", "x6"].map((id) => s.issueInvoiceNumbered(draft(id, "a1", "p1"), "purchase")));
    assert.equal(wins(race), 1, "concurrent issueInvoiceNumbered: exactly one writer");
    assert.equal(await s.nextInvoiceNumber(), "TT-000003", "6 racers consumed exactly ONE number (TT-000002); the losers burned none");
    assert.equal(await s.purchaseInvoiced("zz"), false);
  } },
  { name: "putInvoice: purchaseId round-trips, upsert on id, duplicate number and duplicate (purchase, event) are refused and write nothing", covers: ["putInvoice"], run: async (mk) => {
    const s = mk().store; await base(s); await s.putPurchase(pur("p1", "a1"));
    const i1 = inv("i1", "a1", "p1"); await s.putInvoice(i1);
    assert.deepEqual(plain(await s.invoiceById("i1")), plain(i1));
    await s.putInvoice({ ...i1, amountCents: 1 }); assert.equal((await s.invoicesFor("a1")).length, 1); assert.equal((await s.invoiceById("i1"))!.amountCents, 1);
    await assert.rejects(s.putInvoice(inv("i2", "a1", undefined, { number: "TT-i1" })), "duplicate number");
    await assert.rejects(s.putInvoice(inv("i3", "a1", "p1", { stripeEventId: "evt_i1" })), "same purchase and event");
    assert.equal(await s.invoiceById("i2"), undefined); assert.equal(await s.invoiceById("i3"), undefined);
    await s.putInvoice(inv("i4", "a1", undefined)); assert.equal((await s.invoiceById("i4"))!.purchaseId, undefined);
  } },
  { name: "paidWithoutSubscriptionBefore: only status paid, product in the list, no subscription row, paidAt at or before cutoff, oldest first; empty list is empty", covers: ["paidWithoutSubscriptionBefore"], run: async (mk) => {
    const s = mk().store; await base(s);
    await s.putPurchase(pur("p1", "a1", { productId: "m", status: "paid", paidAt: 30 })); await s.putPurchase(pur("p0", "a1", { productId: "m", status: "paid", paidAt: 30 }));
    await s.putPurchase(pur("p2", "a1", { productId: "m", status: "paid", paidAt: 10 })); await s.putPurchase(pur("p3", "a1", { productId: "other", status: "paid", paidAt: 10 }));
    await s.putPurchase(pur("p4", "a1", { productId: "m", status: "refunded", paidAt: 10 })); await s.putPurchase(pur("p5", "a1", { productId: "m", status: "paid", paidAt: 99 }));
    await s.putPurchase(pur("p6", "a1", { productId: "m", status: "paid", paidAt: 10 })); await s.putSubscription(sub("s6", "a1", "p6"));
    assert.deepEqual(ids(await s.paidWithoutSubscriptionBefore(30, ["m"])), ["p2", "p0", "p1"]);
    assert.deepEqual(ids(await s.paidWithoutSubscriptionBefore(30, ["m", "other"])), ["p2", "p3", "p0", "p1"]);
    assert.deepEqual(await s.paidWithoutSubscriptionBefore(30, []), []);
    assert.deepEqual(ids(await s.paidWithoutSubscriptionBefore(9, ["m"])), []);
  } },
  { name: "subscriptions: putSubscriptionOnce keyed on purchase AND id, createSubscription insert-if-absent leaves the old row, subscriptionByPurchase, plan round-trips", covers: ["putSubscriptionOnce", "createSubscription", "subscriptionByPurchase"], run: async (mk) => {
    const s = mk().store; await base(s);
    for (const id of ["p1", "p2", "p3"]) await s.putPurchase(pur(id, "a1"));
    const plan = { tier: "pro", note: "synthetic" } as unknown as Subscription["plan"];
    const s1 = sub("s1", "a1", "p1", { plan });
    assert.equal(await s.putSubscriptionOnce(s1), true);
    assert.equal(await s.putSubscriptionOnce(sub("s1x", "a1", "p1")), false, "same purchase, new id");
    assert.equal(await s.putSubscriptionOnce(sub("s1", "a1", "p2")), false, "same id, other purchase");
    assert.deepEqual(plain(await s.subscriptionByPurchase("p1")), plain(s1), "plan JSON round-trips");
    assert.equal(await s.subscriptionByPurchase("p2"), undefined);
    assert.equal(await s.createSubscription(sub("s1", "a1", "p3", { startedAt: 999 })), false, "id exists: untouched");
    assert.equal((await s.subscriptionById("s1"))!.startedAt, 5); assert.equal((await s.subscriptionById("s1"))!.purchaseId, "p1");
    assert.equal(await s.createSubscription(sub("s3", "a1", "p3")), true);
    assert.deepEqual(plain(await s.subscriptionByPurchase("p3")), sub("s3", "a1", "p3"));
    const race = await Promise.all(["r1", "r2", "r3", "r4", "r5"].map((id) => s.putSubscriptionOnce(sub(id, "a1", "p2"))));
    assert.equal(wins(race), 1, "concurrent putSubscriptionOnce: one row per purchase");
  } },
  { name: "optimistic concurrency: version starts at 1, every write bumps it, a stale casSubscription loses and writes nothing, 8 racing casSubscription -> one winner", covers: ["subscriptionVersioned", "casSubscription"], run: async (mk) => {
    const s = mk().store; await base(s); await s.putPurchase(pur("p1", "a1"));
    assert.equal(await s.subscriptionVersioned("nope"), undefined);
    assert.equal(await s.casSubscription(sub("nope", "a1", "p1"), 0), false, "absent row");
    await s.createSubscription(sub("s1", "a1", "p1"));
    const v1 = (await s.subscriptionVersioned("s1"))!; assert.equal(v1.version, 1);
    assert.equal(await s.casSubscription({ ...v1.sub, cancelAt: 50 }, 0), false, "stale version");
    assert.equal((await s.subscriptionById("s1"))!.cancelAt, undefined);
    assert.equal(await s.casSubscription({ ...v1.sub, cancelAt: 50 }, 1), true);
    const v2 = (await s.subscriptionVersioned("s1"))!; assert.equal(v2.version, 2); assert.equal(v2.sub.cancelAt, 50);
    await s.putSubscription({ ...v2.sub, cancelledAt: 60 }); assert.equal((await s.subscriptionVersioned("s1"))!.version, 3, "put bumps too");
    const r = await Promise.all(Array.from({ length: 8 }, (_, i) => s.casSubscription({ ...v2.sub, cancelAt: 100 + i }, 3)));
    assert.equal(wins(r), 1); assert.equal((await s.subscriptionVersioned("s1"))!.version, 4);
  } },
  { name: "claim lease: take, renew own, other live owner refused, expired lease taken over (boundary: expiry == now is free), release only by owner", covers: ["acquireLease", "releaseLease"], run: async (mk) => {
    const s = mk().store;
    assert.equal(await s.acquireLease("claim:p1", "w1", 1000, 500), true);
    assert.equal(await s.acquireLease("claim:p1", "w2", 1200, 500), false, "live lease held by w1");
    assert.equal(await s.acquireLease("claim:p1", "w1", 1200, 500), true, "same owner renews (expires 1700)");
    assert.equal(await s.acquireLease("claim:p1", "w2", 1699, 500), false, "still live after the renewal");
    assert.equal(await s.acquireLease("claim:p1", "w2", 1700, 500), true, "expiry == now: free to take");
    await s.releaseLease("claim:p1", "w1"); // not the owner: no-op
    assert.equal(await s.acquireLease("claim:p1", "w1", 1800, 500), false, "w2 still holds it");
    await s.releaseLease("claim:p1", "w2");
    assert.equal(await s.acquireLease("claim:p1", "w1", 1800, 500), true, "freed by its owner");
    assert.equal(await s.acquireLease("claim:p2", "w2", 1800, 500), true, "other keys are independent");
    const race = await Promise.all(Array.from({ length: 12 }, (_, i) => s.acquireLease("claim:race", `w${i}`, 5000, 1000)));
    assert.equal(wins(race), 1, "12 owners, one lease");
  } },
  { name: "held facts: held in order, taken once (take removes), keys are independent, JSON shape round-trips", covers: ["holdFact", "takeFacts"], run: async (mk) => {
    const s = mk().store;
    assert.deepEqual(await s.takeFacts("k1"), []);
    await s.holdFact("k1", { kind: "cancel", at: 3 }); await s.holdFact("k2", { kind: "other" }); await s.holdFact("k1", { kind: "period", nested: { a: [1, 2] } });
    assert.deepEqual(await s.takeFacts("k1"), [{ kind: "cancel", at: 3 }, { kind: "period", nested: { a: [1, 2] } }]);
    assert.deepEqual(await s.takeFacts("k1"), [], "already taken");
    assert.deepEqual(await s.takeFacts("k2"), [{ kind: "other" }]);
    await s.holdFact("race", { n: 1 }); await s.holdFact("race", { n: 2 });
    const got = await Promise.all([s.takeFacts("race"), s.takeFacts("race"), s.takeFacts("race")]);
    assert.equal(got.flat().length, 2, "two takers never both receive a fact");
  } },
  { name: "refund memo: insert-if-absent, peek, CAS swap (stale expected loses), swap to null deletes, list by prefix in insert order, keys independent", covers: ["memoInsert", "memoPeek", "memoSwap", "memoList"], run: async (mk) => {
    const s = mk().store;
    assert.equal(await s.memoPeek("refund:p1"), undefined, "absent peek");
    assert.equal(await s.memoInsert("refund:p1", { at: 1, st: "pending" }), true, "first insert creates");
    assert.equal(await s.memoInsert("refund:p1", { at: 2, st: "other" }), false, "second insert loses");
    assert.deepEqual(await s.memoPeek("refund:p1"), { at: 1, st: "pending" }, "the loser wrote nothing");
    assert.equal(await s.memoSwap("refund:p1", { at: 9, st: "stale" }, { at: 3 }), false, "stale expected fails");
    assert.deepEqual(await s.memoPeek("refund:p1"), { at: 1, st: "pending" }, "a failed swap writes nothing");
    assert.equal(await s.memoSwap("refund:p1", { at: 1, st: "pending" }, { at: 3, st: "taken" }), true, "exact expected swaps");
    assert.deepEqual(await s.memoPeek("refund:p1"), { at: 3, st: "taken" });
    assert.equal(await s.memoSwap("refund:p1", { at: 1, st: "pending" }, { at: 4 }), false, "old expected now stale");
    await s.memoInsert("refund:p2", { at: 5 }); await s.memoInsert("other:x", { at: 6 });
    assert.deepEqual(await s.memoList("refund:"), [{ key: "refund:p1", fact: { at: 3, st: "taken" } }, { key: "refund:p2", fact: { at: 5 } }], "prefix only, insert order");
    assert.deepEqual(await s.memoList("none:"), []);
    assert.equal(await s.memoSwap("refund:p2", { at: 5 }, null), true, "swap to null deletes");
    assert.equal(await s.memoPeek("refund:p2"), undefined);
    assert.equal(await s.memoSwap("refund:p2", { at: 5 }, null), false, "delete of an absent memo loses");
    assert.equal(await s.memoInsert("refund:p2", { at: 7 }), true, "a deleted key can be inserted again");
    const ins = await Promise.all(Array.from({ length: 8 }, (_, i) => s.memoInsert("refund:race", { n: i })));
    assert.equal(wins(ins), 1, "8 inserts, one memo");
    const sw = await Promise.all(Array.from({ length: 8 }, (_, i) => s.memoSwap("refund:p1", { at: 3, st: "taken" }, { at: 10 + i })));
    assert.equal(wins(sw), 1, "8 swaps on one expected, one winner");
  } },
  { name: "review cards: cardById, allCards in insertion order including resolved, upsert keeps position", covers: ["cardById", "allCards"], run: async (mk) => {
    const s = mk().store;
    const c = (id: string, resolved = false) => ({ id, accountId: "a1", purchaseId: "p1", kind: "refund_outside_policy" as const, reason: "day 20", createdAt: 3, resolved });
    assert.equal(await s.cardById("c1"), undefined); assert.deepEqual(await s.allCards(), []);
    await s.putCard(c("c1")); await s.putCard(c("c2")); await s.putCard(c("c1", true));
    assert.deepEqual(plain(await s.cardById("c1")), c("c1", true));
    assert.deepEqual(plain(await s.allCards()), [c("c1", true), c("c2")]);
    assert.deepEqual(ids(await s.openCards()), ["c2"]);
  } },
  { name: "refund cases: round-trip with and without decidedAt, upsert in place, refundCasesFor scoped to the purchase in insertion order", covers: ["putRefundCase", "refundCaseById", "refundCasesFor"], run: async (mk) => {
    const s = mk().store;
    const r = (id: string, purchaseId: string, x: object = {}) => ({ id, accountId: "a1", purchaseId, productName: "Compliance Pack", amountCents: 599700, reason: "day_20", inPolicy: false, status: "pending_review" as const, createdAt: 4, ...x });
    assert.equal(await s.refundCaseById("r1"), undefined); assert.deepEqual(await s.refundCasesFor("p1"), []);
    await s.putRefundCase(r("r1", "p1")); await s.putRefundCase(r("r2", "p2")); await s.putRefundCase(r("r3", "p1", { inPolicy: true }));
    assert.deepEqual(plain(await s.refundCaseById("r1")), r("r1", "p1"));
    await s.putRefundCase(r("r1", "p1", { status: "approved", decidedAt: 9 }));
    assert.deepEqual(plain(await s.refundCaseById("r1")), r("r1", "p1", { status: "approved", decidedAt: 9 }));
    assert.deepEqual(plain((await s.refundCasesFor("p1")).map((x) => [x.id, x.inPolicy, x.status])), [["r1", false, "approved"], ["r3", true, "pending_review"]]);
  } },
  { name: "keysByPrefix: prefix match on the key id (8-char and shorter), insertion order, no match is empty, secrets not matched", covers: ["keysByPrefix"], run: async (mk) => {
    const s = mk().store; await base(s);
    const k = (id: string, accountId: string, hash: string): ApiKey => ({ id, accountId, hash, scopes: ["scan"], createdAt: 1 });
    await s.putKey(k("key_abcd1234zz", "a1", "h1")); await s.putKey(k("key_abcd1234yy", "a2", "h2")); await s.putKey(k("key_other0001", "a1", "h3"));
    assert.deepEqual(ids(await s.keysByPrefix("key_abcd")), ["key_abcd1234zz", "key_abcd1234yy"], "8 chars");
    assert.deepEqual(ids(await s.keysByPrefix("key_a")), ["key_abcd1234zz", "key_abcd1234yy"], "shorter prefix");
    assert.deepEqual(ids(await s.keysByPrefix("key_")), ["key_abcd1234zz", "key_abcd1234yy", "key_other0001"]);
    assert.deepEqual(await s.keysByPrefix("nokey_00"), []);
    assert.deepEqual(await s.keysByPrefix("h1"), [], "hash is never matched");
    assert.deepEqual(ids(await s.keysByPrefix("100%_or_")), [], "wildcards are data");
  } },
  { name: "receiptsForKey: newest first, ties keep insertion order, limit applied, other keys excluded, kid round-trips", covers: ["receiptsForKey"], run: async (mk) => {
    const s = mk().store; await base(s);
    for (const id of ["k1", "k2"]) await s.putKey({ id, accountId: "a1", hash: `h_${id}`, scopes: [], createdAt: 1 });
    const r = (id: string, keyId: string, at: number, x: Partial<AgentReceipt> = {}): AgentReceipt => ({ id, tool: "scan", keyId, accountId: "a1", at, inputSha: "i", outputSha: "o", credits: 1, mode: "prepaid", sig: "sig", ...x });
    await s.putReceipt(r("r1", "k1", 10)); await s.putReceipt(r("r2", "k1", 30, { kid: "v2" })); await s.putReceipt(r("r3", "k1", 30)); await s.putReceipt(r("r4", "k2", 99)); await s.putReceipt(r("r5", "k1", 20, { idem: "ix" }));
    assert.deepEqual(ids(await s.receiptsForKey("k1", 10)), ["r2", "r3", "r5", "r1"]);
    assert.deepEqual(ids(await s.receiptsForKey("k1", 2)), ["r2", "r3"]);
    assert.deepEqual(await s.receiptsForKey("k1", 0), []);
    assert.deepEqual(await s.receiptsForKey("nope", 5), []);
    assert.deepEqual(plain((await s.receiptsForKey("k1", 1))[0]), r("r2", "k1", 30, { kid: "v2" }));
    assert.equal((await s.receiptById("r5"))!.idem, "ix");
  } },
];
