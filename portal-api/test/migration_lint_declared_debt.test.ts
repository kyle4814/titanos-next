// f354: declared-debt contract for the migration lint. Real tree is read-only; mutations run on tmp copies (removed after).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, cpSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-ignore plain mjs
import { lint, checkNames, ROOT } from "../scripts/migration_lint.mjs";

const DECL = join(ROOT, "scripts/migration_lint_declared.json");
const declared = () => JSON.parse(readFileSync(DECL, "utf8"));
// Copy of the real tree (migrations + src + declared file) so a mutation never touches the real one.
const clone = () => {
  const d = mkdtempSync(join(tmpdir(), "migdebt-"));
  cpSync(join(ROOT, "migrations"), join(d, "migrations"), { recursive: true });
  cpSync(join(ROOT, "src"), join(d, "src"), { recursive: true });
  cpSync(DECL, join(d, "declared.json"));
  return d;
};
const run = (d: string) => lint({ migDir: join(d, "migrations"), srcRoot: d, declaredPath: join(d, "declared.json") });

test("the real tree is clean with the exact declared debt, every entry carries an owner", () => {
  const r = lint();
  assert.deepEqual(r.failures, []);
  const d = declared();
  assert.equal(d.duplicate_entries.length, 8);
  assert.deepEqual(d.gap_entries.map((e: any) => e.prefix), [9, 10, 11, 12, 13, 17]);
  assert.equal(d.check_debt.length, 0);
  for (const e of [...d.duplicate_entries, ...d.gap_entries, ...d.check_debt]) assert.ok(e.owner && e.owner.length > 3, JSON.stringify(e));
  for (const e of d.duplicate_entries) assert.ok(e.files.length >= 2);
  assert.ok(d.provenance.measured.includes("2026-11-10"));
  assert.equal(r.warnings.filter((w: string) => w.startsWith("DECLARED DEBT")).length, 8 + 6 + 0);
});

test("a NEW duplicate prefix (an undeclared one) FAILS, naming both files", () => {
  const d = clone();
  try {
    writeFileSync(join(d, "migrations/0001_extra_clash.sql"), "CREATE TABLE zz_clash (id TEXT PRIMARY KEY);");
    const r = run(d);
    assert.ok(r.failures.some((m: string) => m.includes("duplicate prefix 0001") && m.includes("0001_extra_clash.sql") && m.includes("0001_portal_core.sql")), r.failures.join("\n"));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("a new file joining an already-declared duplicate prefix FAILS (the declaration pins files, not numbers)", () => {
  const d = clone();
  try {
    writeFileSync(join(d, "migrations/0003_fifth.sql"), "CREATE TABLE zz_fifth (id TEXT PRIMARY KEY);");
    const r = run(d);
    assert.ok(r.failures.some((m: string) => m.includes("undeclared file in declared duplicate prefix 0003: 0003_fifth.sql")), r.failures.join("\n"));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("a NEW gap FAILS (a migration numbered past the tree leaves 0023..N-1 undeclared)", () => {
  const d = clone();
  try {
    writeFileSync(join(d, "migrations/0025_skips_two.sql"), "CREATE TABLE zz_skip (id TEXT PRIMARY KEY);");
    const r = run(d);
    assert.ok(r.failures.some((m: string) => m.includes("gap: no migration numbered 0023")), r.failures.join("\n"));
    assert.ok(r.failures.some((m: string) => m.includes("gap: no migration numbered 0024")));
    assert.ok(!r.failures.some((m: string) => m.includes("gap: no migration numbered 0009")), "declared gaps stay quiet");
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("a declared file that vanished is reported STALE", () => {
  const d = clone();
  try {
    rmSync(join(d, "migrations/0006_held_facts.sql"));
    const r = run(d);
    assert.ok(r.failures.some((m: string) => m.includes("stale declaration: declared file 0006_held_facts.sql")), r.failures.join("\n"));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("a declared gap that gets filled is reported STALE", () => {
  const d = clone();
  try {
    writeFileSync(join(d, "migrations/0009_fills_gap.sql"), "CREATE TABLE zz_fill (id TEXT PRIMARY KEY);");
    const r = run(d);
    assert.ok(r.failures.some((m: string) => m.includes("stale declaration: gap 0009")), r.failures.join("\n"));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("declared CHECK debt: a NEW TS value missing from a CHECK still FAILS, and a fixed CHECK makes its entry STALE", () => {
  const d = clone();
  try {
    const f = join(d, "src/market/store.ts");
    writeFileSync(f, readFileSync(f, "utf8").replace(/(export type JobStatus\s*=\s*)/, '$1"zz_new_state" | '));
    const r = run(d);
    assert.ok(r.failures.some((m: string) => m.includes("'zz_new_state'") && m.includes("market_jobs.status")), r.failures.join("\n"));
  } finally { rmSync(d, { recursive: true, force: true }); }
  const d2 = clone();
  try {
    const dec = JSON.parse(readFileSync(join(d2, "declared.json"), "utf8"));
    dec.check_debt.push({ pair: "job states", value: "pending", owner: "synthetic" });
    writeFileSync(join(d2, "declared.json"), JSON.stringify(dec));
    const r = run(d2);
    assert.ok(r.failures.some((m: string) => m.includes("stale declaration: check debt 'pending'")), r.failures.join("\n"));
  } finally { rmSync(d2, { recursive: true, force: true }); }
});

test("mutation: emptying the declared file turns the real tree red (the declaration is load-bearing)", () => {
  const d = clone();
  try {
    writeFileSync(join(d, "declared.json"), "{}");
    const r = run(d);
    assert.ok(r.failures.filter((m: string) => m.startsWith("duplicate prefix")).length === 8, r.failures.join("\n"));
    assert.ok(r.failures.filter((m: string) => m.startsWith("gap:")).length === 6);
    assert.equal(r.failures.length, 14);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("legacy numeric declarations still work (f104 shape)", () => {
  assert.deepEqual(checkNames(["0001_a.sql", "0002_b.sql", "0002_c.sql", "0004_d.sql"], { duplicates: [2], gaps: [3] }), []);
  assert.ok(checkNames(["0001_a.sql"], { duplicate_entries: [{ prefix: 2, files: ["0002_b.sql", "0002_c.sql"], owner: "x" }] }).some((m: string) => m.includes("stale declaration")));
  assert.ok(readdirSync(join(ROOT, "migrations")).length >= 24);
});
