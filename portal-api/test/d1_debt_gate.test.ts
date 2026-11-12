// f379: Memory-only store debt gate. Real tree is read-only; every mutation runs on a tmp copy (removed after). SYNTHETIC stores only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, cpSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-ignore plain mjs
import { gate, ROOT, DEBT_PATH, STAGES_FIXTURE, stageIds } from "../scripts/d1_debt_gate.mjs";

const realDebt = () => JSON.parse(readFileSync(DEBT_PATH, "utf8"));
// Copy of src + the harness composition roots + the debt file + the STAGES fixture.
const clone = () => {
  const d = mkdtempSync(join(tmpdir(), "d1debt-"));
  cpSync(join(ROOT, "src"), join(d, "src"), { recursive: true });
  mkdirSync(join(d, "test"));
  for (const n of readdirSync(join(ROOT, "test"))) if (/harness.*\.ts$/.test(n)) cpSync(join(ROOT, "test", n), join(d, "test", n));
  cpSync(DEBT_PATH, join(d, "debt.json"));
  cpSync(STAGES_FIXTURE, join(d, "stages.tsv"));
  return d;
};
const run = (d: string) => gate({ root: d, debtPath: join(d, "debt.json"), stagesPath: join(d, "stages.tsv") });
const setDebt = (d: string, f: (j: any) => void) => { const j = realDebt(); f(j); writeFileSync(join(d, "debt.json"), JSON.stringify(j)); };
const plant = (d: string) => {   // a service entrypoint constructing a brand new Memory-only store (no durable adapter)
  mkdirSync(join(d, "src/widgets"), { recursive: true });
  writeFileSync(join(d, "src/widgets/service.ts"), "export interface WidgetStore { get(id: string): string | undefined }\nexport class MemoryWidgetStore implements WidgetStore { get(id: string) { return id; } }\nexport const build = () => ({ store: new MemoryWidgetStore() });\n");
};
const withTmp = (f: (d: string) => void) => { const d = clone(); try { f(d); } finally { rmSync(d, { recursive: true, force: true }); } };

test("the real tree is clean: every Memory-only store is declared, owners are real stage ids, adapters' stores carry no debt", () => {
  const r = gate();
  assert.deepEqual(r.failures, []);
  const debt = realDebt().debt, stages = stageIds();
  assert.deepEqual(debt.map((e: any) => e.store).sort(), ["MemoryZone"]);
  for (const e of debt) { assert.ok(stages.has(e.owner), e.owner); assert.ok(e.reason.length > 20 && e.would_flip.length > 20, e.store); }
  assert.equal(r.warnings.filter((w: string) => w.startsWith("DECLARED DEBT")).length, 1);
});

test("a planted UNDECLARED Memory-only store in a service entrypoint FAILS, naming store and site", () => withTmp((d) => {
  plant(d);
  const r = run(d);
  assert.equal(r.failures.length, 1, r.failures.join("\n"));
  assert.ok(r.failures[0].includes("undeclared Memory-only store MemoryWidgetStore") && r.failures[0].includes("src/widgets/service.ts:3"), r.failures[0]);
}));

test("the same planted store, once DECLARED with reason, owner stage and would_flip, PASSES", () => withTmp((d) => {
  plant(d);
  setDebt(d, (j) => j.debt.push({ store: "MemoryWidgetStore", reason: "synthetic widget store for the gate test", owner: "f378_c3_owner_market_store_d1_inventory", would_flip: "land a D1WidgetStore implementing WidgetStore" }));
  const r = run(d);
  assert.deepEqual(r.failures, []);
  assert.ok(r.warnings.some((w: string) => w.startsWith("DECLARED DEBT MemoryWidgetStore")));
}));

test("STALE debt: the declared store gains a D1 adapter, the entry must go (gate FAILS until removed)", () => withTmp((d) => {
  plant(d);
  setDebt(d, (j) => j.debt.push({ store: "MemoryWidgetStore", reason: "synthetic widget store for the gate test", owner: "f378_c3_owner_market_store_d1_inventory", would_flip: "land a D1WidgetStore implementing WidgetStore" }));
  assert.deepEqual(run(d).failures, []);
  writeFileSync(join(d, "src/widgets/d1widget.ts"), "import type { WidgetStore } from \"./service.ts\";\nexport class D1WidgetStore implements WidgetStore { get(id: string) { return id; } }\n");
  const r = run(d);
  assert.equal(r.failures.length, 1, r.failures.join("\n"));
  assert.ok(r.failures[0].includes("stale debt: MemoryWidgetStore has gained a durable adapter (D1WidgetStore)"), r.failures[0]);
  setDebt(d, () => {});   // entry removed (real debt only): clean again
  assert.deepEqual(run(d).failures, []);
}));

test("STALE debt: a declared store no longer constructed anywhere FAILS", () => withTmp((d) => {
  setDebt(d, (j) => j.debt.push({ store: "MemoryGhostStore", reason: "synthetic ghost entry for the gate test", owner: "f378_c3_owner_market_store_d1_inventory", would_flip: "delete this entry" }));
  const r = run(d);
  assert.ok(r.failures.some((m: string) => m.includes("stale debt: MemoryGhostStore is declared but no longer constructed")), r.failures.join("\n"));
}));

test("a debt owner that is not a stage id FAILS; a missing field FAILS", () => withTmp((d) => {
  setDebt(d, (j) => { j.debt[0].owner = "f9999_not_a_stage"; delete j.debt[0].would_flip; });
  const r = run(d);
  assert.ok(r.failures.some((m: string) => m.includes("owner \"f9999_not_a_stage\" is not a stage id")), r.failures.join("\n"));
  assert.ok(r.failures.some((m: string) => m.includes("missing would_flip")), r.failures.join("\n"));
}));

test("mutation: dropping each real debt entry in turn FAILS naming exactly that store; the STORE=d1 harness site is what the gate reads", () => {
  for (const e of realDebt().debt) withTmp((d) => {
    setDebt(d, (j) => { j.debt = j.debt.filter((x: any) => x.store !== e.store); });
    const r = run(d);
    assert.equal(r.failures.length, 1, `${e.store}: ${r.failures.join("\n")}`);
    assert.ok(r.failures[0].includes(`undeclared Memory-only store ${e.store}`), r.failures[0]);
  });
});

test("mutation: removing the structural alias makes MemoryThrottleStore Memory-only (the alias is load-bearing, not decoration)", () => withTmp((d) => {
  setDebt(d, (j) => { delete j.adapter_aliases; });
  const r = run(d);
  assert.ok(r.failures.some((m: string) => m.includes("undeclared Memory-only store MemoryThrottleStore")), r.failures.join("\n"));
}));

test("a stage-id fixture is the one passed in: an empty fixture fails every owner", () => withTmp((d) => {
  writeFileSync(join(d, "stages.tsv"), "# id\n");
  assert.equal(run(d).failures.filter((m: string) => m.includes("is not a stage id")).length, 1);
}));
