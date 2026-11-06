// f104: the migration lint. SYNTHETIC fixtures only (temp dirs under os.tmpdir, removed after).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, readdirSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-ignore plain mjs
import { lint, checkNames, tsUnion, ROOT } from "../scripts/migration_lint.mjs";

const mk = () => { const d = mkdtempSync(join(tmpdir(), "miglint-")); mkdirSync(join(d, "migrations")); mkdirSync(join(d, "src")); return d; };
const PAIR = [{ name: "job states", ts: { file: "src/t.ts", type: "S" }, sql: { table: "t", column: "status" } }];
const sql = (vals: string) => `CREATE TABLE t (id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK (status IN (${vals})));`;
const run = (d: string, extra: object = {}) => lint({ migDir: join(d, "migrations"), srcRoot: d, pairs: PAIR, declaredPath: join(d, "none.json"), ...extra });

test("the real tree is clean (declared 0003/0004 debt is a warning only)", () => {
  const r = lint();
  assert.deepEqual(r.failures, []);
  assert.ok(r.warnings.some((w: string) => w.includes("DECLARED DEBT duplicate prefix 0004")));
  assert.ok(r.files.length >= 9);
});

test("the declared debt is real: the real tree still has the clashes (stale declaration would fail)", () => {
  const f = readdirSync(join(ROOT, "migrations")).filter((x: string) => x.endsWith(".sql"));
  assert.equal(f.filter((x: string) => x.startsWith("0004_")).length, 2);
  assert.ok(checkNames(f, { duplicates: [] }).some((m: string) => m.includes("duplicate prefix 0004")));
  assert.ok(checkNames(["0001_a.sql"], { duplicates: [4] }).some((m: string) => m.includes("stale declaration")));
});

test("planted clash is caught, naming both files", () => {
  const out = checkNames(["0001_a.sql", "0002_b.sql", "0002_c.sql"]);
  assert.ok(out.some((m: string) => m.includes("duplicate prefix 0002") && m.includes("0002_b.sql") && m.includes("0002_c.sql")));
});

test("planted gap is caught, and a declared gap is allowed", () => {
  assert.ok(checkNames(["0001_a.sql", "0003_c.sql"]).some((m: string) => m.includes("gap: no migration numbered 0002")));
  assert.deepEqual(checkNames(["0001_a.sql", "0003_c.sql"], { gaps: [2] }), []);
  assert.ok(checkNames(["001_a.sql"]).some((m: string) => m.includes("bad filename")));
});

test("planted missing CHECK value is caught by name", () => {
  const d = mk();
  try {
    writeFileSync(join(d, "migrations/0001_t.sql"), sql("'open','paid'"));
    writeFileSync(join(d, "src/t.ts"), `export type S = "open" | "paid" | "refunded";`);
    const r = run(d);
    assert.equal(r.failures.length, 1);
    assert.match(r.failures[0], /'refunded' is in TS S but missing from CHECK on t\.status/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("covered union passes; extra SQL value is only a warning", () => {
  const d = mk();
  try {
    writeFileSync(join(d, "migrations/0001_t.sql"), sql("'open','paid','legacy'"));
    writeFileSync(join(d, "src/t.ts"), `export type S = "open" | "paid";`);
    const r = run(d);
    assert.deepEqual(r.failures, []);
    assert.ok(r.warnings.some((w: string) => w.includes("'legacy'")));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("a table rebuilt by a later migration is judged on its FINAL CHECK", () => {
  const d = mk();
  try {
    writeFileSync(join(d, "migrations/0001_t.sql"), sql("'open'"));
    writeFileSync(join(d, "migrations/0002_rebuild.sql"), `CREATE TABLE t_new (id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK (status IN ('open','paid')));\nDROP TABLE t;\nALTER TABLE t_new RENAME TO t;`);
    writeFileSync(join(d, "src/t.ts"), `export type S = "open" | "paid";`);
    assert.deepEqual(run(d).failures, []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("a migration that does not apply is caught; a missing union and a missing CHECK are caught", () => {
  const d = mk();
  try {
    writeFileSync(join(d, "migrations/0001_t.sql"), sql("'open'"));
    writeFileSync(join(d, "migrations/0002_bad.sql"), `ALTER TABLE nope ADD COLUMN x TEXT;`);
    writeFileSync(join(d, "src/t.ts"), `export type S = "open";`);
    assert.ok(run(d).failures.some((m: string) => m.includes("apply failed at 0002_bad.sql")));
    rmSync(join(d, "migrations/0002_bad.sql"));
    writeFileSync(join(d, "src/t.ts"), `export type Other = "open";`);
    assert.ok(run(d).failures.some((m: string) => m.includes("union not found")));
    writeFileSync(join(d, "src/t.ts"), `export type S = "open";`);
    writeFileSync(join(d, "migrations/0001_t.sql"), `CREATE TABLE t (id TEXT PRIMARY KEY, status TEXT);`);
    assert.ok(run(d).failures.some((m: string) => m.includes("no IN-list CHECK")));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("interface property unions parse (card kinds)", () => {
  assert.deepEqual(tsUnion(`export interface C { id: string; kind: "a" | "b"; x: number }`, { iface: "C", prop: "kind" }), ["a", "b"]);
});

test("mutation: real tree with a value dropped from the market_cards CHECK fails", () => {
  const d = mk();
  try {
    cpSync(join(ROOT, "migrations"), join(d, "migrations"), { recursive: true });
    cpSync(join(ROOT, "src"), join(d, "src"), { recursive: true });
    const p = join(d, "migrations/0004_market.sql");
    writeFileSync(p, readFileSync(p, "utf8").replace(",'clawback_review'", ""));
    const r = lint({ migDir: join(d, "migrations"), srcRoot: d });
    assert.ok(r.failures.some((m: string) => m.includes("'clawback_review'") && m.includes("market_cards.kind")), r.failures.join("\n"));
  } finally { rmSync(d, { recursive: true, force: true }); }
});
