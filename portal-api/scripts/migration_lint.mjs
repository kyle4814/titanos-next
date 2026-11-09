// Migration lint (f104). SYNTHETIC-safe: reads files, applies migrations only to an in-memory SQLite. Applies NOTHING live (GATE5).
// Checks: (1) filename prefixes unique and gapless-or-declared; (2) TS string-literal unions covered by the matching SQL CHECK
// list (read from the schema AFTER all migrations, so table rebuilds and renames are honoured); (3) migrations apply in order.
// Declared debt: scripts/migration_lint_declared.json {"gaps":[7],"duplicates":[3,4]}. A declared dup is a WARN, and a declaration that
// no longer matches the tree is a FAIL (stale), so the debt cannot hide after a renumber.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "..");

// Each pair: a TS union (file + type alias name, or interface + property) against a SQL table.column CHECK (IN list).
export const PAIRS = [
  { name: "job states", ts: { file: "src/market/store.ts", type: "JobStatus" }, sql: { table: "market_jobs", column: "status" } },
  { name: "payout states", ts: { file: "src/enterprise/types.ts", type: "PayoutStatus" }, sql: { table: "payouts", column: "status" } },
  { name: "card kinds", ts: { file: "src/market/store.ts", iface: "MarketCard", prop: "kind" }, sql: { table: "market_cards", column: "kind" } },
  { name: "ledger kinds", ts: { file: "src/enterprise/types.ts", type: "LedgerKind" }, sql: { table: "partner_ledger", column: "kind" } },
  { name: "tenant kinds", ts: { file: "src/enterprise/types.ts", type: "TenantKind" }, sql: { table: "tenants", column: "kind" } },
];

const strLits = (s) => [...s.matchAll(/"([^"\\]*)"|'([^'\\]*)'/g)].map((m) => m[1] ?? m[2]);

export function checkNames(files, declared = {}, warn = []) {
  const out = [];
  const pre = new Map();
  for (const f of files) {
    const m = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(f);
    if (!m) { out.push(`bad filename (want NNNN_name.sql): ${f}`); continue; }
    (pre.get(+m[1]) ?? pre.set(+m[1], []).get(+m[1])).push(f);
  }
  // Declared debt, two shapes. Legacy: {"duplicates":[3],"gaps":[7]} (prefix numbers). Exact (f354): {"duplicate_entries":
  // [{"prefix":3,"files":[...],"owner":"fNNN"}], "gap_entries":[{"prefix":9,"owner":"fNNN"}]}. An exact entry pins the FILES, so a
  // new file joining a declared prefix FAILS, and a declared file that vanished is STALE.
  const dupOk = new Set((declared.duplicates ?? []).map(Number)), gapOk = new Set((declared.gaps ?? []).map(Number));
  const dupEntries = new Map((declared.duplicate_entries ?? []).map((e) => [Number(e.prefix), e]));
  const pad = (n) => String(n).padStart(4, "0");
  for (const [n, fs] of pre) if (fs.length > 1 && !dupOk.has(n) && !dupEntries.has(n)) out.push(`duplicate prefix ${pad(n)}: ${fs.join(", ")}`);
  for (const n of dupOk) if ((pre.get(n)?.length ?? 0) > 1) warn.push(`DECLARED DEBT duplicate prefix ${pad(n)}: ${pre.get(n).join(", ")}`);
  for (const n of dupOk) if ((pre.get(n)?.length ?? 0) < 2) out.push(`stale declaration: duplicate ${n} is declared but not present, remove it from the declared file`);
  for (const [n, e] of dupEntries) {
    const have = pre.get(n) ?? [], want = e.files ?? [];
    for (const f of want) if (!have.includes(f)) out.push(`stale declaration: declared file ${f} (duplicate ${pad(n)}, owner ${e.owner ?? "?"}) is not in the tree, remove it from the declared file`);
    for (const f of have) if (!want.includes(f)) out.push(`undeclared file in declared duplicate prefix ${pad(n)}: ${f}`);
    if (want.length < 2) out.push(`bad declaration: duplicate ${pad(n)} must list at least two files`);
    else if (have.length > 1 && want.every((f) => have.includes(f))) warn.push(`DECLARED DEBT duplicate prefix ${pad(n)} (owner ${e.owner ?? "?"}): ${have.join(", ")}`);
  }
  for (const e of declared.gap_entries ?? []) {
    const n = Number(e.prefix);
    if (pre.has(n)) out.push(`stale declaration: gap ${pad(n)} is declared but a migration with that number now exists (${pre.get(n).join(", ")}), remove it from the declared file`);
    else { gapOk.add(n); warn.push(`DECLARED DEBT gap ${pad(n)} (owner ${e.owner ?? "?"})`); }
  }
  const nums = [...pre.keys()].sort((a, b) => a - b);
  for (let i = nums[0] ?? 1; i < (nums.at(-1) ?? 0); i++) if (!pre.has(i) && !gapOk.has(i)) out.push(`gap: no migration numbered ${String(i).padStart(4, "0")}`);
  if (nums.length && nums[0] !== 1) out.push(`first migration is ${nums[0]}, not 1`);
  return out;
}

export function tsUnion(src, spec) {
  let body;
  if (spec.type) {
    const m = new RegExp(`export\\s+type\\s+${spec.type}\\s*=([^;]+);`).exec(src);
    body = m?.[1];
  } else {
    const blk = new RegExp(`interface\\s+${spec.iface}\\s*\\{([\\s\\S]*?)\\n?\\}`).exec(src)?.[1];
    body = blk && new RegExp(`\\b${spec.prop}\\??\\s*:\\s*([^;]+);`).exec(blk)?.[1];
  }
  return body === undefined ? null : strLits(body);
}

export function applyAll(dir, files) {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys = ON");
  const errs = [];
  for (const f of files) { try { db.exec(readFileSync(join(dir, f), "utf8")); } catch (e) { errs.push(`apply failed at ${f}: ${e.message}`); break; } }
  return { db, errs };
}

// The IN (...) list of the CHECK that constrains `column`, from the final schema text of `table`.
export function sqlCheck(db, table, column) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table);
  if (!row) return { missingTable: true };
  const m = new RegExp(`\\b${column}\\b[^,()]*(?:\\([^)]*\\)[^,()]*)*?CHECK\\s*\\(\\s*${column}\\s+IN\\s*\\(([^)]*)\\)`, "i").exec(row.sql)
    ?? new RegExp(`CHECK\\s*\\(\\s*${column}\\s+IN\\s*\\(([^)]*)\\)`, "i").exec(row.sql);
  return m ? { values: strLits(m[1]) } : { noCheck: true };
}

export function lint({ migDir = join(ROOT, "migrations"), srcRoot = ROOT, pairs = PAIRS, declaredPath = join(HERE, "migration_lint_declared.json") } = {}) {
  const files = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
  const declared = existsSync(declaredPath) ? JSON.parse(readFileSync(declaredPath, "utf8")) : {};
  const warnings = [], failures = [...checkNames(files, declared, warnings)];
  const checkDebt = declared.check_debt ?? [], seenDebt = new Set();
  const { db, errs } = applyAll(migDir, files);
  failures.push(...errs);
  if (!errs.length) for (const p of pairs) {
    const fp = join(srcRoot, p.ts.file);
    if (!existsSync(fp)) { failures.push(`${p.name}: TS file missing ${p.ts.file}`); continue; }
    const ts = tsUnion(readFileSync(fp, "utf8"), p.ts);
    if (!ts) { failures.push(`${p.name}: union not found in ${p.ts.file} (${p.ts.type ?? p.ts.iface + "." + p.ts.prop})`); continue; }
    const c = sqlCheck(db, p.sql.table, p.sql.column);
    if (c.missingTable) { failures.push(`${p.name}: table ${p.sql.table} not created by any migration`); continue; }
    if (c.noCheck) { failures.push(`${p.name}: ${p.sql.table}.${p.sql.column} has no IN-list CHECK`); continue; }
    for (const v of ts) if (!c.values.includes(v)) {
      const msg = `${p.name}: '${v}' is in TS ${p.ts.type ?? p.ts.prop} but missing from CHECK on ${p.sql.table}.${p.sql.column}`;
      const d = checkDebt.find((e) => e.pair === p.name && e.value === v);
      if (d) { seenDebt.add(d); warnings.push(`DECLARED DEBT ${msg} (owner ${d.owner ?? "?"})`); } else failures.push(msg);
    }
    for (const v of c.values) if (!ts.includes(v)) warnings.push(`${p.name}: '${v}' is in CHECK on ${p.sql.table}.${p.sql.column} but not in the TS union (harmless, tidy later)`);
  }
  // A check_debt entry that no longer fires (CHECK widened, or the TS value removed) is stale: it must be deleted.
  if (!errs.length) for (const d of checkDebt) if (!seenDebt.has(d)) failures.push(`stale declaration: check debt '${d.value}' on pair '${d.pair}' no longer fails, remove it from the declared file`);
  return { files, failures, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = lint();
  for (const w of r.warnings) console.log("WARN " + w);
  for (const f of r.failures) console.log("FAIL " + f);
  console.log(r.failures.length ? `MIGRATION LINT FAILED (${r.failures.length})` : `MIGRATION LINT OK (${r.files.length} migrations)`);
  process.exit(r.failures.length ? 1 : 0);
}
