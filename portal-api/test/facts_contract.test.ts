import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { MemoryStore, type Store } from "../src/store.ts";
import { D1PlanStore } from "../src/d1_plan_store.ts";
import { FakeD1, setFakeD1Rand } from "./fake_d1.ts";
import { make, STORE_KINDS } from "./harness.ts";

// Held webhook facts on D1 (f194). ONE contract (F1..F5) over MemoryStore (the reference) and D1PlanStore (FakeD1: real SQLite, real migration 0006),
// plus a seeded two-taker race schedule (200 seeds) asserting every fact is delivered exactly once. SYNTHETIC fixtures only.
// A "restart" or a second taker is a NEW store object over the SAME FakeD1 (memory: the same object, there is no other process).
type Factory = () => { open: () => Store; db?: FakeD1 };
const memory: Factory = () => { const s = new MemoryStore(); return { open: () => s }; };
const d1: Factory = () => { const db = new FakeD1(); return { open: () => new D1PlanStore(db), db }; };

export async function violations(fac: Factory): Promise<string[]> {
  const bad: string[] = [], { open } = fac(), s = open();
  const want = (c: string, ok: boolean, m: string) => { if (!ok) bad.push(`${c} ${m}`); };
  const ids = (xs: Record<string, unknown>[]) => xs.map((x) => String(x.id ?? x.kind)).join();
  // F1 round trip in hold order; the three real fact shapes (cancel, period with the create flag, refund cents); a restart sees them
  await s.holdFact("sub:s1", { kind: "cancel" });
  await s.holdFact("sub:s1", { kind: "period", start: 1_700_000_000_000, end: 1_702_592_000_000, create: false });
  await s.holdFact("sub:s1", { kind: "period", start: 1_702_592_000_000, end: 1_705_270_400_000, create: true });
  await s.holdFact("pi:p1", { kind: "refund", cents: 5000 });
  const got = await open().takeFacts("sub:s1");
  want("F1", JSON.stringify(got) === JSON.stringify([{ kind: "cancel" }, { kind: "period", start: 1_700_000_000_000, end: 1_702_592_000_000, create: false }, { kind: "period", start: 1_702_592_000_000, end: 1_705_270_400_000, create: true }]), `round trip or order differs: ${JSON.stringify(got)}`);
  // F2 take removes: a second take is empty, other keys untouched, an unknown key is []
  want("F2", (await s.takeFacts("sub:s1")).length === 0, "a second take of the same key must be empty");
  want("F2", (await s.takeFacts("sub:nope")).length === 0, "an unknown key must be []");
  want("F2", JSON.stringify(await open().takeFacts("pi:p1")) === JSON.stringify([{ kind: "refund", cents: 5000 }]), "another key must be untouched by a take");
  // F3 keys are exact: no prefix or LIKE leakage, and a % or _ in a key is literal
  await s.holdFact("sub:s_1", { kind: "cancel", id: "a" }); await s.holdFact("sub:sx1", { kind: "cancel", id: "b" }); await s.holdFact("sub:%", { kind: "cancel", id: "c" });
  want("F3", ids(await s.takeFacts("sub:s_1")) === "a", "key sub:s_1 must match only itself");
  want("F3", ids(await s.takeFacts("sub:%")) === "c", "key sub:% must be literal");
  want("F3", ids(await s.takeFacts("sub:sx1")) === "b", "the neighbour key must still hold its fact");
  // F4 hold after take starts a fresh list (a fact is never delivered twice, never lost); the returned list is a copy
  await s.holdFact("k", { kind: "cancel", id: "x" }); const t1 = await s.takeFacts("k"); t1[0].id = "mutated";
  await s.holdFact("k", { kind: "cancel", id: "y" });
  want("F4", ids(await s.takeFacts("k")) === "y", "after a take, only the newer fact may be delivered");
  const orig = { kind: "period", start: 1, end: 2 } as Record<string, unknown>; await s.holdFact("k2", orig); orig.start = 999;
  want("F4", (await s.takeFacts("k2"))[0].start === 1, "a held fact must be a copy of what was passed in");
  // F5 absent optionals stay absent; nested JSON survives
  await s.holdFact("k3", { kind: "period", start: 1, end: 2, create: false, nested: { a: [1, 2] } });
  const r5 = (await s.takeFacts("k3"))[0]; want("F5", !("note" in r5) && JSON.stringify(r5.nested) === '{"a":[1,2]}' && r5.create === false, `shape differs: ${JSON.stringify(r5)}`);
  // F6 a restart: facts held through one store object are taken through another
  await s.holdFact("rk", { kind: "cancel", id: "r1" }); await s.holdFact("rk", { kind: "cancel", id: "r2" });
  want("F6", ids(await open().takeFacts("rk")) === "r1,r2", "held facts must survive a restart, in order");
  return bad;
}
for (const [name, fac] of [["memory", memory], ["d1", d1]] as const) {
  test(`[${name}] held-facts contract F1..F6 holds`, async () => { assert.deepEqual(await violations(fac), []); });
}

// ---- the race schedule: seeded, replayable ----
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const yieldN = async (r: () => number) => { for (let i = Math.floor(r() * 4); i > 0; i--) await new Promise((x) => setImmediate(x)); };

// One schedule: a holder appends N facts across 1-2 keys, 2-3 takers (separate store objects) each take M times at random keys with random yields, then a final drain.
// Returns what broke: a fact delivered twice, a fact never delivered, a fact delivered out of hold order within one batch.
export async function race(seed: number, fac: Factory, mutate?: (db: FakeD1) => Store[]): Promise<string[]> {
  const r = mulberry32(seed); setFakeD1Rand(mulberry32(seed ^ 0x9e3779b9));
  try {
    const f = fac(), keys = r() < 0.5 ? ["sub:a"] : ["sub:a", "pi:b"], N = 4 + Math.floor(r() * 9), takers = 2 + Math.floor(r() * 2), M = 2 + Math.floor(r() * 4);
    const stores: Store[] = mutate && f.db ? mutate(f.db) : Array.from({ length: takers + 1 }, () => f.open());
    const holder = stores[0], seen = new Map<string, number>(), bad: string[] = [], seqOf = new Map<string, number>();
    const take = async (st: Store, key: string) => {
      const batch = await st.takeFacts(key); let last = -1;
      for (const x of batch) { const id = String(x.id); seen.set(id, (seen.get(id) ?? 0) + 1); const q = seqOf.get(id) ?? -1; if (q < last) bad.push(`seed ${seed}: ${id} out of hold order`); last = q; }
    };
    const actors: Promise<void>[] = [(async () => {
      for (let i = 0; i < N; i++) { await yieldN(r); const key = keys[Math.floor(r() * keys.length)]; seqOf.set(`f${i}`, i); await holder.holdFact(key, { kind: "cancel", id: `f${i}` }); }
    })()];
    for (let t = 0; t < takers; t++) actors.push((async () => { for (let m = 0; m < M; m++) { await yieldN(r); await take(stores[1 + t], keys[Math.floor(r() * keys.length)]); } })());
    await Promise.all(actors);
    for (const k of keys) await take(stores[0], k);                       // final drain: what is still held
    for (let i = 0; i < N; i++) { const c = seen.get(`f${i}`) ?? 0; if (c !== 1) bad.push(`seed ${seed}: f${i} delivered ${c} times (want exactly 1)`); }
    return bad;
  } finally { setFakeD1Rand(undefined); }
}
const SEEDS = 200;
for (const [name, fac] of [["memory", memory], ["d1", d1]] as const) {
  test(`[${name}] two-taker race schedule: ${SEEDS} seeds, every fact delivered exactly once`, async () => {
    const all: string[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) all.push(...(await race(seed, fac)));
    assert.deepEqual(all, []);
  });
}
test("the schedule is replayable: the same seed gives the same verdict, and different seeds really interleave differently", async () => {
  assert.deepEqual(await race(7, d1), await race(7, d1));
  const logs = new Set<string>();
  for (let seed = 1; seed <= 20; seed++) { setFakeD1Rand(mulberry32(seed)); const db = new FakeD1(); const a = new D1PlanStore(db), b = new D1PlanStore(db);
    await Promise.all([a.holdFact("k", { id: "1" }), b.holdFact("k", { id: "2" }), a.takeFacts("k"), b.takeFacts("k")]); logs.add(db.log.map((l) => l.sql.slice(0, 6)).join()); }
  setFakeD1Rand(undefined); assert.ok(logs.size > 1, "20 seeds must not all produce the same statement order");
});

// ---- the race has teeth: a read-then-delete taker (what one statement replaces) double-delivers on some seeds ----
class SelectThenDelete extends D1PlanStore {
  private d: FakeD1;
  constructor(db: FakeD1) { super(db); this.d = db; }
  override async takeFacts(key: string) {
    const rows = (await this.d.prepare("SELECT seq, fact FROM held_facts WHERE key = ? ORDER BY seq").bind(key).all<Record<string, unknown>>()).results;
    for (const r of rows) await this.d.prepare("DELETE FROM held_facts WHERE seq = ?").bind(r.seq).run();
    return rows.map((r) => JSON.parse(String(r.fact)) as Record<string, unknown>);
  }
}
test("mutant: SELECT then DELETE is caught by the race schedule (it double-delivers on at least one seed), the real adapter on none", async () => {
  let killed = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const bad = await race(seed, d1, (db) => Array.from({ length: 4 }, () => new SelectThenDelete(db)));
    if (bad.some((b) => /delivered [2-9]\d* times/.test(b))) killed++;
  }
  assert.ok(killed > 0, "the read-then-delete taker must double-deliver on some seed, or the schedule proves nothing");
  console.log(`# read-then-delete mutant double-delivered on ${killed} of ${SEEDS} seeds`);
});
test("the real taker is one statement: DELETE ... RETURNING, a single prepared call per take", async () => {
  const db = new FakeD1(), s = new D1PlanStore(db); await s.holdFact("k", { id: "1" }); db.log.length = 0; await s.takeFacts("k");
  assert.equal(db.log.length, 1); assert.match(db.log[0].sql, /^DELETE FROM held_facts WHERE key = \? RETURNING/);
});

// ---- adapter mutants killed by the named contract check ----
class Wrong extends D1PlanStore {
  private d: FakeD1; private mode: string;
  constructor(db: FakeD1, mode: string) { super(db); this.d = db; this.mode = mode; }
  override async holdFact(key: string, fact: Record<string, unknown>) { await this.d.prepare("INSERT INTO held_facts (key, fact) VALUES (?, ?)").bind(key, JSON.stringify(fact)).run(); }
  override async takeFacts(key: string) {
    const m = this.mode;
    const sql = m === "like" ? "DELETE FROM held_facts WHERE key LIKE ? RETURNING seq, fact" : m === "keep" ? "SELECT seq, fact FROM held_facts WHERE key = ?" : "DELETE FROM held_facts WHERE key = ? RETURNING seq, fact";
    const rows = (await this.d.prepare(sql).bind(key).all<Record<string, unknown>>()).results;
    if (m !== "unsorted") rows.sort((a, b) => Number(a.seq) - Number(b.seq)); else rows.sort((a, b) => Number(b.seq) - Number(a.seq));
    return rows.map((r) => JSON.parse(String(r.fact)) as Record<string, unknown>);
  }
}
for (const [mode, check] of [["like", "F3"], ["keep", "F2"], ["unsorted", "F1"]] as const) {
  test(`adapter mutant "${mode}" is killed by ${check}`, async () => {
    const bad = await violations(() => { const db = new FakeD1(); return { open: () => new Wrong(db, mode), db }; });
    assert.ok(bad.some((b) => b.startsWith(check)), `${check} must fail for ${mode}: ${JSON.stringify(bad)}`);
  });
}

// ---- migration shape, and the service flow on both stores ----
test("migration 0006 is additive, the next free number on this base, and NOT APPLIED", () => {
  const dir = resolve(import.meta.dirname, "../migrations"), files = readdirSync(dir).sort();
  assert.ok(files.includes("0006_held_facts.sql")); assert.equal(files.filter((f) => f.startsWith("0006_held")).length, 1); // f245: 0006_owner_state_rev shares the number on the merged line; wrangler orders by full filename
  const sql = readFileSync(join(dir, "0006_held_facts.sql"), "utf8"), code = sql.replace(/--.*$/gm, "");
  assert.ok(/NOT applied/.test(sql)); assert.ok(!/\b(DROP|DELETE|UPDATE|ALTER)\b/i.test(code));
  // merge-order rule (f194 finding): web/f171 0006_webhook_held_facts.sql creates the SAME table; the DDL must stay byte-identical so a merge of both is a no-op (IF NOT EXISTS)
  const ddl = code.split("\n").map((l) => l.trim()).filter((l) => /held_facts/.test(l));
  assert.deepEqual(ddl, ["CREATE TABLE IF NOT EXISTS held_facts (seq INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, fact TEXT NOT NULL);", "CREATE INDEX IF NOT EXISTS idx_held_facts_key ON held_facts (key);"]);
});
for (const kind of STORE_KINDS) {
  test(`[${kind}] a cancel that arrives before its payment is held, taken once by markPaid, and the subscription ends up cancelled`, async () => {
    const h = make(kind), u = await h.login("facts@example.invalid");
    await h.req("POST", "/checkout", { token: u.session, body: { product: "ai_growth" } });
    const pending = (await (await import("./harness.ts")).allPurchases(h.store)).filter((p) => p.status === "pending").at(-1)!;
    await h.webhook("customer.subscription.deleted", { id: `sub_${pending.id}` });
    await h.pay("ai_growth");
    assert.deepEqual(await h.store.takeFacts(`sub:sub_${pending.id}`), [], "markPaid must have taken the held cancel exactly once");
    const subs = await h.store.subscriptionsFor(u.account.id as string);
    assert.equal(subs.length, 1); assert.ok(subs[0].cancelAt !== undefined || subs[0].cancelledAt !== undefined, "the held cancel must have been applied");
  });
}
