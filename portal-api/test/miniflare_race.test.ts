import { test, after } from "node:test";
import assert from "node:assert/strict";
import { D1PlanStore } from "../src/d1_plan_store.ts";
import { MemoryStore } from "../src/store.ts";
import { miniflareAvailable, MiniflareD1, stopMiniflare } from "./miniflare_d1.ts";

// f213: the f183 / f197 / f203 WOULD-FLIP ("same suite on miniflare/test D1"). The SAME functions that run on FakeD1 (node:sqlite) run here on a real local
// miniflare D1 binding (workerd): f183 seeded subscription-CAS schedules, f197 two-deliverer claimEvent race, f203 reconciler contract incl. concurrent reconcilers.
// Skips cleanly when miniflare is absent (not a dependency). SYNTHETIC fixtures only; nothing leaves the machine.
// f369 budget: measured 517 s wall (5/5 pass, exit 0) at load 25/8 cores with the default 30 seeds; a harness limit under ~900 s will cut it off. Not a hang: after() disposes miniflare.
// Seeds: MF_SEEDS (default 30, minimum meaningful 20). Single isolate caveat in the receipt: this is NOT a cross-isolate real D1.
process.env.CONTRACT_LIB = "1";
const skip = miniflareAvailable() ? false : "miniflare not resolvable (set MINIFLARE_DIR to a dir holding node_modules/miniflare); skipped";
const SEEDS = Math.max(20, Number(process.env.MF_SEEDS ?? 30));
after(async () => { await stopMiniflare(); });

test(`miniflare f183: ${SEEDS} seeded subscription-CAS schedules: no stale write, version = seed + CAS wins, serial-order end state`, { skip, timeout: 600_000 }, async () => {
  const { base, runSchedule } = await import("./subcas.test.ts");
  const m = await base(); let lost = 0, raced = 0; const bad: string[] = [];
  for (let s = 1; s <= SEEDS; s++) { const r = await runSchedule(m, "mf", s); lost += r.lost; if (r.lost) raced++; for (const b of r.bad) bad.push(`mf seed ${s}: ${b}`); }
  console.log(`MF_SUBCAS_COUNTS schedules=${SEEDS} lost_cas=${lost} schedules_with_a_lost_cas=${raced}`);
  assert.deepEqual(bad, []);
  assert.ok(raced >= 3, `the miniflare schedules must actually race (only ${raced} had a lost CAS)`);
});

test("miniflare f197: claim contract C1..C5 holds on a real miniflare D1", { skip, timeout: 120_000 }, async () => {
  const { violations } = await import("./claim_contract.test.ts");
  assert.deepEqual(await violations(() => { const db = new MiniflareD1(); return { open: () => new D1PlanStore(db) }; }), []);
});

test(`miniflare f197: ${SEEDS}-seed two-deliverer race, exactly one claim wins per event id (separate store objects, one miniflare D1)`, { skip, timeout: 600_000 }, async () => {
  const { race } = await import("./claim_contract.test.ts");
  const bad: string[] = [];
  for (let s = 1; s <= SEEDS; s++) bad.push(...(await race(s, () => { const db = new MiniflareD1(); return { open: () => new D1PlanStore(db) }; })));
  assert.deepEqual(bad.slice(0, 5), []);
});

test("miniflare f197: the race is not vacuous on miniflare: a SELECT-then-INSERT claim double-wins on some seed", { skip, timeout: 600_000 }, async () => {
  const { race } = await import("./claim_contract.test.ts");
  class SelectThenInsert extends D1PlanStore {
    d: any; constructor(d: any) { super(d); this.d = d; }
    override async claimEvent(id: string) {
      const seen = await this.d.prepare("SELECT id FROM stripe_events WHERE id = ?").bind(id).first();
      if (seen) return false;
      await this.d.prepare("INSERT OR IGNORE INTO stripe_events (id, at) VALUES (?, ?)").bind(id, 0).run(); return true;
    }
  }
  let caught = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const fac = () => { const db = new MiniflareD1(); return { open: () => new D1PlanStore(db), db: db as any }; };
    if ((await race(s, fac, (db: any) => [new SelectThenInsert(db), new SelectThenInsert(db), new SelectThenInsert(db)])).length) caught++;
  }
  console.log(`MF_CLAIM_MUTANT caught=${caught}/${SEEDS}`);
  assert.ok(caught >= 1, "the read-then-write mutant must double-win on at least one miniflare seed, else the miniflare race proves nothing");
});

test("miniflare f203: reconciler contract R1..R10 (incl. 3 concurrent reconcilers x20 seeds, reconcile vs late delivery) holds on a real miniflare D1", { skip, timeout: 600_000 }, async () => {
  const { load, violations } = await import("./reconcile_contract.test.ts");
  assert.deepEqual(await violations(await load(), "mf"), []);
});
