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
const run = (d: string, extra: object = {}) => lint({ migDir: join(d, "migrations"), srcRoot: d, pairs: PAIR, declaredPath: join(d, "none.json"), discover: false, ...extra });

test("the real tree is clean (declared 0003/0004 debt is a warning only)", () => {
  const r = lint();
  assert.deepEqual(r.failures, []);
  assert.ok(r.warnings.some((w: string) => w.includes("DECLARED DEBT duplicate prefix 0004")));
  assert.ok(r.files.length >= 9);
});

test("the declared debt is real: the real tree still has the clashes (stale declaration would fail)", () => {
  const f = readdirSync(join(ROOT, "migrations")).filter((x: string) => x.endsWith(".sql"));
  assert.equal(f.filter((x: string) => x.startsWith("0004_")).length, 3); // int3 head: market, store_counters, subscription_plan (f354 widened the declaration)
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

test("mutation: real tree with a value dropped from the market_jobs CHECK fails", () => {
  const d = mk();
  try {
    cpSync(join(ROOT, "migrations"), join(d, "migrations"), { recursive: true });
    cpSync(join(ROOT, "src"), join(d, "src"), { recursive: true });
    const p = join(d, "migrations/0004_market.sql");
    writeFileSync(p, readFileSync(p, "utf8").replace(",'refunded')", ")"));
    const r = lint({ migDir: join(d, "migrations"), srcRoot: d });
    assert.ok(r.failures.some((m: string) => m.includes("'refunded'") && m.includes("market_jobs.status")), r.failures.join("\n"));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ---- f178: auto-discovery of status/kind unions against CHECK IN-lists, with an allowlist ----
const ts = (body: string) => `export type JobState = ${body};\n`;
const fx = (tsBody: string, checkVals: string) => { const d = mk(); writeFileSync(join(d, "migrations", "0001_a.sql"), sql(checkVals)); writeFileSync(join(d, "src", "t.ts"), ts(tsBody)); return d; };
const disc = (d: string, extra: object = {}) => lint({ migDir: join(d, "migrations"), srcRoot: d, pairs: [], declaredPath: join(d, "none.json"), allowPath: join(d, "allow.json"), ...extra });

test("discovery: a matching union and CHECK pass with NO hand-listed pair", () => {
  const d = fx(`"a" | "b" | "c"`, `'a','b','c'`);
  try { assert.deepEqual(disc(d).failures, []); } finally { rmSync(d, { recursive: true, force: true }); }
});

test("SEEDED DRIFT 1: a union member added in TS (not in the CHECK) is caught, naming the member", () => {
  const d = fx(`"a" | "b" | "c" | "d"`, `'a','b','c'`);
  try { const f = disc(d).failures; assert.ok(f.some((m: string) => m.includes("sets differ") && m.includes("only in TS [d]")), f.join("|")); } finally { rmSync(d, { recursive: true, force: true }); }
});

test("SEEDED DRIFT 2: a CHECK value dropped is caught, naming the member", () => {
  const d = fx(`"a" | "b" | "c"`, `'a','b'`);
  try { const f = disc(d).failures; assert.ok(f.some((m: string) => m.includes("sets differ") && m.includes("only in TS [c]")), f.join("|")); } finally { rmSync(d, { recursive: true, force: true }); }
});

test("a CHECK member with no TS side (extra SQL value) is also a difference", () => {
  const d = fx(`"a" | "b"`, `'a','b','z'`);
  try { assert.ok(disc(d).failures.some((m: string) => m.includes("only in SQL [z]"))); } finally { rmSync(d, { recursive: true, force: true }); }
});

test("a new status union with no CHECK at all fails as 'no matching CHECK mapping'", () => {
  const d = fx(`"a" | "b"`, `'a','b'`);
  writeFileSync(join(d, "src", "u.ts"), `export interface Thing { id: string; status: "new" | "gone" }\n`);
  try { assert.ok(disc(d).failures.some((m: string) => m.includes("src/u.ts::Thing.status") && m.includes("no matching CHECK mapping"))); } finally { rmSync(d, { recursive: true, force: true }); }
});

test("a new CHECK with no TS union fails", () => {
  const d = fx(`"a" | "b"`, `'a','b'`);
  writeFileSync(join(d, "migrations", "0002_b.sql"), `CREATE TABLE u (id TEXT PRIMARY KEY, kind TEXT CHECK (kind IN ('x','y')));`);
  try { assert.ok(disc(d).failures.some((m: string) => m.includes("CHECK u.kind") && m.includes("no TS union"))); } finally { rmSync(d, { recursive: true, force: true }); }
});

test("allowlist: justified exception passes; no reason fails; stale entry fails", () => {
  const d = fx(`"a" | "b"`, `'a','b'`);
  writeFileSync(join(d, "src", "u.ts"), `export interface Thing { status: "new" | "gone" }\n`);
  try {
    writeFileSync(join(d, "allow.json"), JSON.stringify({ unions: [{ key: "src/u.ts::Thing.status", reason: "in-memory record only, never persisted" }] }));
    assert.deepEqual(disc(d).failures, []);
    writeFileSync(join(d, "allow.json"), JSON.stringify({ unions: [{ key: "src/u.ts::Thing.status", reason: "" }] }));
    assert.ok(disc(d).failures.some((m: string) => m.includes("needs a written reason")));
    writeFileSync(join(d, "allow.json"), JSON.stringify({ unions: [{ key: "src/u.ts::Thing.status", reason: "in-memory record only, never persisted" }, { key: "src/zzz.ts::Gone.kind", reason: "long gone but listed" }] }));
    assert.ok(disc(d).failures.some((m: string) => m.includes("stale allowlist") && m.includes("Gone.kind")));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("inline property unions and identifier-composed aliases are discovered", () => {
  const d = fx(`"a" | "b"`, `'a','b'`);
  writeFileSync(join(d, "src", "v.ts"), `type Base = "p" | "q";\nexport type WideStatus = Base | "r";\nexport interface R { kind?: "k1" | "k2" }\n`);
  try {
    const f = disc(d).failures.join("|");
    assert.ok(f.includes("v.ts::WideStatus") && f.includes("r"), f);
    assert.ok(f.includes("v.ts::R.kind"), f);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("MUTATION on the real tree: add a member to JobStatus in a temp copy of src -> discovery lint fails; drop a CHECK value -> fails", () => {
  const d = mkdtempSync(join(tmpdir(), "miglint-real-"));
  try {
    cpSync(join(ROOT, "src"), join(d, "src"), { recursive: true });
    cpSync(join(ROOT, "migrations"), join(d, "migrations"), { recursive: true });
    const base = { migDir: join(d, "migrations"), srcRoot: d, pairs: [], declaredPath: join(ROOT, "scripts", "migration_lint_declared.json") };
    // with no explicit PAIRS, the discovery alone must still hold the real tree green
    // int3 head (f354): with pairs: [] discovery alone sees three CHECK findings: two are the declared check_debt (unmerged migrations),
    // the third (partner_ledger.kind) is only visible without the explicit LedgerKind PAIR. Migration_lint_declared.json
    // carries as check_debt (the explicit-PAIR path downgrades them to warnings; with pairs: [] they surface here). Pinned exactly.
    const known = lint(base).failures;
    assert.equal(known.length, 3, known.join("\n"));
    assert.ok(known.some((m: string) => m.includes("MarketCard.kind") && m.includes("clawback_review")));
    assert.ok(known.some((m: string) => m.includes("PayoutStatus") && m.includes("sending,approved_retry,held")));
    assert.ok(known.some((m: string) => m.includes("partner_ledger.kind")));
    const sp = join(d, "src", "market", "store.ts");
    writeFileSync(sp, readFileSync(sp, "utf8").replace('"refunded";', '"refunded" | "chargeback";'));
    assert.ok(lint(base).failures.some((m: string) => m.includes("chargeback")), "added union member must be caught");
    writeFileSync(sp, readFileSync(join(ROOT, "src", "market", "store.ts"), "utf8"));
    const mp = join(d, "migrations", "0004_market.sql");
    writeFileSync(mp, readFileSync(mp, "utf8").replace("'payout_review'", "'zzz_other'"));
    assert.ok(lint(base).failures.some((m: string) => m.includes("payout_review") || m.includes("zzz_other")), "changed CHECK must be caught");
  } finally { rmSync(d, { recursive: true, force: true }); }
});
