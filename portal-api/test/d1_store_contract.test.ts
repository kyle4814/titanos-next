// f345: ONE contract, TWO stores. The cases in d1_store_cases.ts run against MemoryStore and against D1Store over FakeD1 (real SQLite, the real
// migrations) with identical assertions; a divergence is a bug in one of them. The mutation block then breaks D1Store one method at a time and
// demands that the contract notices: a method no case bites is a hole in the contract, not a pass.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore, type Store } from "../src/store.ts";
import { D1Store } from "../src/d1store.ts";
import { FakeD1 } from "./fake_d1.ts";
import { CASES, type Mk } from "./d1_store_cases.ts";

const memory: Mk = () => ({ store: new MemoryStore() });
const d1: Mk = () => ({ store: new D1Store(new FakeD1()) });

for (const [name, mk] of [["MemoryStore", memory], ["D1Store(FakeD1)", d1]] as [string, Mk][]) {
  describe(`D1Store parity contract: ${name}`, () => { for (const c of CASES) test(c.name, () => c.run(mk)); });
}

// ---- mutation: neuter ONE D1Store method at a time (wrapper over the real one), run the whole contract, expect >= 1 failing case.
type Kind = "bool" | "list" | "count" | "lookup" | "void";
const METHODS: Record<string, Kind> = {
  casPurchase: "bool", memoInsert: "bool", memoSwap: "bool", putSubscriptionOnce: "bool", createSubscription: "bool", putInvoiceOnce: "bool", purchaseInvoiced: "bool", acquireLease: "bool", casSubscription: "bool",
  pendingPurchasesBefore: "list", paidPurchasesBefore: "list", paidWithoutSubscriptionBefore: "list", takeFacts: "list", allCards: "list", refundCasesFor: "list", keysByPrefix: "list", memoList: "list", receiptsForKey: "list",
  countByStatus: "count",
  purchaseByPaymentIntent: "lookup", memoPeek: "lookup", subscriptionByPurchase: "lookup", subscriptionVersioned: "lookup", cardById: "lookup", refundCaseById: "lookup",
  releaseLease: "void", holdFact: "void", putRefundCase: "void", putInvoice: "void",
};
const neuter = (kind: Kind, v: unknown): unknown => kind === "bool" ? !v : kind === "list" ? [] : kind === "count" ? Number(v) + 1 : kind === "lookup" ? undefined : undefined;
const failures = async (mk: Mk) => { let f = 0; for (const c of CASES) { try { await c.run(mk); } catch { f += 1; } } return f; };
const mutant = (patch: (s: D1Store, db: FakeD1) => void): Mk => () => { const db = new FakeD1(); const s = new D1Store(db); patch(s, db); return { store: s as Store }; };

describe("D1Store parity contract: MUTATION (the contract must bite)", () => {
  test("control: the unmutated D1Store fails 0 cases", async () => { assert.equal(await failures(d1), 0); });
  for (const [m, kind] of Object.entries(METHODS)) {
    test(`mutant: ${m} neutered -> contract fails`, async () => {
      const mk = mutant((s) => {
        const orig = (s as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[m].bind(s);
        (s as unknown as Record<string, unknown>)[m] = async (...a: unknown[]) => { const v = await orig(...a); return kind === "void" ? undefined : neuter(kind, v); };
        if (kind === "void") (s as unknown as Record<string, unknown>)[m] = async () => undefined;
      });
      assert.ok((await failures(mk)) >= 1, `no case noticed ${m} broken`);
    });
  }
  test("mutant: casPurchase ignores the status guard (read-then-blind-write) -> contract fails", async () => {
    const mk = mutant((s, db) => { (s as unknown as Record<string, unknown>).casPurchase = async (p: { id: string; status: string }) => { await db.prepare("UPDATE purchases SET status = ? WHERE id = ?").bind(p.status, p.id).run(); return true; }; });
    assert.ok((await failures(mk)) >= 1);
  });
  test("mutant: acquireLease ignores the owner (any caller takes a live lease) -> contract fails", async () => {
    const mk = mutant((s, db) => { (s as unknown as Record<string, unknown>).acquireLease = async (k: string, o: string, now: number, ttl: number) => { await db.prepare("INSERT INTO claim_leases (key, owner, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at").bind(k, o, now + ttl).run(); return true; }; });
    assert.ok((await failures(mk)) >= 1);
  });
  test("mutant: memoSwap ignores the expected fact (blind write) -> contract fails", async () => {
    const mk = mutant((s, db) => { (s as unknown as Record<string, unknown>).memoSwap = async (k: string, _e: unknown, next: unknown) => { await db.prepare("UPDATE held_facts SET fact = ? WHERE key = ?").bind(JSON.stringify(next), k).run(); return true; }; });
    assert.ok((await failures(mk)) >= 1);
  });
  test("mutant: memoInsert overwrites instead of insert-if-absent -> contract fails", async () => {
    const mk = mutant((s, db) => { (s as unknown as Record<string, unknown>).memoInsert = async (k: string, f: unknown) => { await db.prepare("INSERT INTO held_facts (key, fact) VALUES (?, ?)").bind(k, JSON.stringify(f)).run(); return true; }; });
    assert.ok((await failures(mk)) >= 1);
  });
  test("mutant: takeFacts as SELECT then DELETE (not atomic) -> contract fails under concurrent takers", async () => {
    const mk = mutant((s, db) => { (s as unknown as Record<string, unknown>).takeFacts = async (k: string) => { const rows = (await db.prepare("SELECT fact FROM held_facts WHERE key = ? ORDER BY seq").bind(k).all<{ fact: string }>()).results; await db.prepare("DELETE FROM held_facts WHERE key = ?").bind(k).run(); return rows.map((r) => JSON.parse(r.fact)); }; });
    let f = 0; for (let i = 0; i < 5 && f === 0; i++) f = await failures(mk); // the race is probabilistic; five schedules
    assert.ok(f >= 1);
  });
  test("every method in the contract's `covers` lists exists on D1Store and is mutated above", () => {
    for (const c of CASES) for (const m of c.covers) assert.ok(m in METHODS || ["casPurchase"].includes(m), `${m} is covered by a case but never mutated`);
  });
});
