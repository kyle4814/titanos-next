import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore, type Store } from "../src/store.ts";
import { D1PlanStore } from "../src/d1_plan_store.ts";
import { FakeD1, setFakeD1Rand } from "./fake_d1.ts";
import { handleStripeEvent, MockMailer, type Deps } from "../src/service.ts";
import { MockBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { T0, SECRET } from "./harness.ts";

// Webhook event claim on D1 (f197). ONE contract (C1..C5) over MemoryStore (the reference) and D1PlanStore (FakeD1: real SQLite, real migrations),
// a seeded two-deliverer race (200 seeds): exactly one claim wins per event id, and a replay-after-crash case. SYNTHETIC ids only.
// A second deliverer / a restart is a NEW store object over the SAME FakeD1 (memory: the same object, there is no other process).
type Factory = () => { open: () => Store; db?: FakeD1 };
const memory: Factory = () => { const s = new MemoryStore(); return { open: () => s }; };
const d1: Factory = () => { const db = new FakeD1(); return { open: () => new D1PlanStore(db), db }; };

export async function violations(fac: Factory): Promise<string[]> {
  const bad: string[] = [], { open } = fac(), s = open();
  const want = (c: string, ok: boolean, m: string) => { if (!ok) bad.push(`${c} ${m}`); };
  // C1 first claim wins, every later claim of the same id loses
  want("C1", (await s.claimEvent("evt_1")) === true, "the first claim must win");
  want("C1", (await s.claimEvent("evt_1")) === false, "the second claim of one id must lose");
  want("C1", (await s.claimEvent("evt_1")) === false, "the third claim of one id must lose");
  // C2 ids are independent
  want("C2", (await s.claimEvent("evt_2")) === true, "a different id must win");
  // C3 ids are exact: no case folding, no LIKE leakage, % and _ literal, empty id is an id like any other
  for (const id of ["EVT_1", "evt_1 ", "evt%", "evt_", "evt_x", ""]) want("C3", (await s.claimEvent(id)) === true, `id ${JSON.stringify(id)} must be its own id`);
  want("C3", (await s.claimEvent("evt%")) === false, "evt% must lose the second time");
  // C4 a restart / second deliverer sees the claim
  want("C4", (await open().claimEvent("evt_2")) === false, "a claim must survive a restart");
  want("C4", (await open().claimEvent("evt_3")) === true && (await open().claimEvent("evt_3")) === false, "a fresh id claimed through one object must lose through another");
  // C5 a claim touches nothing else: held facts and invoices are unaffected
  await s.holdFact("sub:z", { kind: "cancel" });
  await s.claimEvent("evt_5");
  want("C5", (await open().takeFacts("sub:z")).length === 1, "a claim must not disturb held facts");
  return bad;
}
for (const [name, fac] of [["memory", memory], ["d1", d1]] as const) {
  test(`[${name}] claim contract C1..C5 holds`, async () => { assert.deepEqual(await violations(fac), []); });
}

test("[d1] claimEvent is ONE prepared statement per call (no read-then-write)", async () => {
  const db = new FakeD1(), s = new D1PlanStore(db);
  await s.claimEvent("evt_a"); await s.claimEvent("evt_a");
  const stripe = db.log.filter((l) => /stripe_events/.test(l.sql));
  assert.equal(stripe.length, 2); assert.ok(stripe.every((l) => /^INSERT OR IGNORE INTO stripe_events/.test(l.sql)));
  assert.equal(db.log.filter((l) => /^SELECT/.test(l.sql)).length, 0);
});

// ---- the race schedule: seeded, replayable ----
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const yieldN = async (r: () => number) => { for (let i = Math.floor(r() * 4); i > 0; i--) await new Promise((x) => setImmediate(x)); };

// K event ids; each is delivered by 2 deliverers (Stripe retry racing the original) plus occasional third, each deliverer a separate store object, random yields.
// Returns what broke: an id with zero or 2+ winners.
export async function race(seed: number, fac: Factory, mutate?: (db: FakeD1) => Store[]): Promise<string[]> {
  const r = mulberry32(seed); setFakeD1Rand(mulberry32(seed ^ 0x9e3779b9));
  try {
    const f = fac(), K = 3 + Math.floor(r() * 6), deliverers = 2 + Math.floor(r() * 2);
    const stores: Store[] = mutate && f.db ? mutate(f.db) : Array.from({ length: deliverers }, () => f.open());
    const wins = new Map<string, number>(), bad: string[] = [];
    await Promise.all(stores.map(async (st) => {
      const order = Array.from({ length: K }, (_, i) => `evt_${seed}_${i}`).sort(() => r() - 0.5);
      for (const id of order) { await yieldN(r); if (await st.claimEvent(id)) wins.set(id, (wins.get(id) ?? 0) + 1); }
    }));
    for (let i = 0; i < K; i++) { const c = wins.get(`evt_${seed}_${i}`) ?? 0; if (c !== 1) bad.push(`seed ${seed}: evt_${seed}_${i} had ${c} winners (want exactly 1)`); }
    return bad;
  } finally { setFakeD1Rand(undefined); }
}
const SEEDS = 200;
for (const [name, fac] of [["memory", memory], ["d1", d1]] as const) {
  test(`[${name}] ${SEEDS}-seed two-deliverer race: exactly one claim wins per event id`, async () => {
    const bad: string[] = []; for (let s = 1; s <= SEEDS; s++) bad.push(...(await race(s, fac)));
    assert.deepEqual(bad.slice(0, 5), []);
  });
}
test("[d1] the race is replayable (same seed, same verdict)", async () => { assert.deepEqual(await race(7, d1), await race(7, d1)); });

// ---- mutants: the schedule has teeth ----
class SelectThenInsert extends D1PlanStore { // the classic bug: read, then write
  d: FakeD1; constructor(d: FakeD1) { super(d); this.d = d; }
  override async claimEvent(id: string) {
    const seen = await this.d.prepare("SELECT id FROM stripe_events WHERE id = ?").bind(id).first();
    if (seen) return false;
    await this.d.prepare("INSERT OR IGNORE INTO stripe_events (id, at) VALUES (?, ?)").bind(id, 0).run(); return true;
  }
}
class AlwaysTrue extends D1PlanStore { override async claimEvent(_id: string) { return true; } }
class IgnoreIsWin extends D1PlanStore { override async claimEvent(id: string) { await (this as any).exec("INSERT OR IGNORE INTO stripe_events (id, at) VALUES (?, ?)", id, 0); return true; } }
class LowerCase extends D1PlanStore { override async claimEvent(id: string) { return super.claimEvent(id.toLowerCase()); } }
test("mutant SELECT-then-INSERT double-wins on many seeds of the race schedule", async () => {
  let caught = 0; for (let s = 1; s <= SEEDS; s++) if ((await race(s, d1, (db) => [new SelectThenInsert(db), new SelectThenInsert(db), new SelectThenInsert(db)])).length) caught++;
  assert.ok(caught >= 50, `only ${caught}/${SEEDS} seeds caught the read-then-write mutant`);
});
test("adapter mutants are killed by the contract", async () => {
  for (const [name, M] of [["always-true", AlwaysTrue], ["ignore-is-win", IgnoreIsWin], ["lowercase", LowerCase]] as const) {
    const fac: Factory = () => { const db = new FakeD1(); return { open: () => new M(db), db }; };
    assert.ok((await violations(fac)).length > 0, `mutant ${name} survived the contract`);
  }
});

// ---- replay after a crash: claim written, invoice not ----
// CHOSEN BEHAVIOUR: at-most-once. The claim is durable BEFORE the handler runs, so a crash between the claim and the invoice leaves the event claimed and Stripe's retry
// is answered "duplicate" (200): the invoice is NOT issued by replay. A hard crash cannot be told apart from a completed delivery by a claim table that carries no
// completion marker, and the handlers are not replay-safe mid-way (markPaid only runs while the purchase is pending, so a replay after the purchase row flips to paid
// would skip the invoice anyway). Recovery is a reconciler (paid purchase with no invoice), PENDING LIVE; this test pins the behaviour so a change is deliberate.
class CrashOnInvoice extends D1PlanStore { crashed = false; override async issueInvoiceNumbered(i: any, g: any) { if (!this.crashed) { this.crashed = true; throw new Error("isolate killed"); } return super.issueInvoiceNumbered(i, g); } }
for (const kind of ["memory", "d1"] as const) {
  test(`[${kind}] replay after crash (claim written, invoice not): the retry is a duplicate, no invoice, no double funding`, async () => {
    const db = new FakeD1(), a = kind === "d1" ? new CrashOnInvoice(db) : new (class extends MemoryStore { crashed = false; override async issueInvoiceNumbered(i: any, g: any) { if (!this.crashed) { this.crashed = true; throw new Error("isolate killed"); } return super.issueInvoiceNumbered(i, g); } })();
    const mk = (store: Store): Deps => ({ store, billing: new MockBilling(), dns: fakeResolver({}), mailer: new MockMailer(), now: () => T0, siteOrigin: "https://titanos.tech", webhookSecret: SECRET });
    await a.putAccount({ id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 });
    await a.putPurchase({ id: "pur1", accountId: "acc1", productId: "compliance_pack", checkoutId: "cs_1", amountCents: 0, deliverableIssued: false, refundedCents: 0, status: "pending" });
    const ev = { id: "evt_crash", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid", payment_intent: "pi_1" } } };
    await assert.rejects(handleStripeEvent(mk(a), ev), /isolate killed/);
    const retryStore: Store = kind === "d1" ? new D1PlanStore(db) : a;       // the next isolate (memory: the same object, nothing else exists)
    assert.equal(await handleStripeEvent(mk(retryStore), ev), "duplicate");
    assert.equal((await retryStore.invoicesFor("acc1")).length, 0, "replay must not issue the missing invoice (documented at-most-once)");
    assert.equal((await retryStore.purchaseById("pur1"))!.status, "paid", "the purchase write before the crash stands");
  });
}
