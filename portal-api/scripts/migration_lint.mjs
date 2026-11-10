// Migration lint (f104). SYNTHETIC-safe: reads files, applies migrations only to an in-memory SQLite. Applies NOTHING live (GATE5).
// Checks: (1) filename prefixes unique and gapless-or-declared; (2) TS string-literal unions covered by the matching SQL CHECK
// list (read from the schema AFTER all migrations, so table rebuilds and renames are honoured); (3) migrations apply in order.
// Declared debt: scripts/migration_lint_declared.json {"gaps":[7],"duplicates":[3,4]}. A declared dup is a WARN, and a declaration that
// no longer matches the tree is a FAIL (stale), so the debt cannot hide after a renumber.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "..");

// Each pair: a TS union (file + type alias name, or interface + property) against a SQL table.column CHECK (IN list).
export const PAIRS = [
  { name: "job states", ts: { file: "src/market/store.ts", type: "JobStatus" }, sql: { table: "market_jobs", column: "status" } },
  { name: "payout states", ts: { file: "src/enterprise/types.ts", type: "PayoutStatus" }, sql: { table: "payouts", column: "status" } },
  { name: "seat states", ts: { file: "src/market/entitlements.ts", type: "SubStatus" }, sql: { table: "seat_subscriptions", column: "status" } },
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


// ---- f178 auto-discovery: nothing about a status/kind union or a CHECK IN-list is hand-listed any more -------------------------
// Unions: (a) `type X = "a" | "b"` aliases (identifier members are resolved one alias deep), (b) properties/fields named
// status|kind|*Status|*Kind|*State carrying an inline literal union. CHECKs: every `CHECK (col IN (...))` in the final schema.
// A union must have an explicit PAIR, or exactly one-set-equal CHECK, or be allowlisted; a CHECK must be matched by a union or
// be allowlisted. Near-misses (Jaccard >= 0.5) are reported as "sets differ" naming the members on each side.
export const ALLOW_PATH = join(HERE, "migration_lint_allow.json");
const FIELD_RX = /^(status|kind|[a-z]\w*(Status|Kind|State))$/;
const sameSet = (a, b) => a.length === b.length && a.every((v) => b.includes(v));
const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; for (const v of A) if (B.has(v)) i++; return i / (A.size + B.size - i || 1); };

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out); else if (/\.ts$/.test(n) && !/\.d\.ts$/.test(n)) out.push(f);
  }
  return out;
}
// f184: union discovery uses the TypeScript compiler API (ts.createSourceFile, syntax only, no type-checker, no tsconfig).
// Shapes found: type aliases (any depth of alias-to-alias composition, multi-line, parenthesised), `as const` arrays and objects
// (and `typeof X[number]` / `typeof X[keyof typeof X]` aliases of them), string enums, and inline literal unions on fields.
const req = createRequire(import.meta.url);
let _ts;
function loadTs() {
  if (_ts) return _ts;
  const tries = ["typescript", join(HERE, "../../node_modules/typescript"), join(HERE, "../node_modules/typescript")];
  for (const t of tries) { try { return (_ts = req(t)); } catch { /* next */ } }
  throw new Error("migration_lint needs the 'typescript' package (devDependency); run npm install at the site root");
}
const NAME_RX = /(Status|Kind|State)$/;
const CONST_NAME_RX = /(status|kind|state)(es|s)?$/i;
const litText = (n, ts) => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : undefined;
const unwrap = (n, ts) => { while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression?.(n) || ts.isTypeAssertionExpression(n) || ts.isParenthesizedTypeNode(n))) n = n.expression ?? n.type; return n; };

const isAsConst = (n) => { const ts = loadTs(); while (ts.isParenthesizedExpression(n)) n = n.expression; return ts.isAsExpression(n) && ts.isTypeReferenceNode(n.type) && n.type.typeName.getText() === "const"; };

export function discoverUnions(srcRoot, srcDir = "src") {
  const ts = loadTs(), root = join(srcRoot, srcDir);
  const decls = new Map();   // name -> [{ rel, kind: "alias"|"const"|"enum", node }]
  const fields = [];         // { rel, owner, field, node (type node) }
  const add = (name, d) => (decls.get(name) ?? decls.set(name, []).get(name)).push(d);
  for (const f of walk(root)) {
    const rel = f.slice(srcRoot.length + 1).split("\\").join("/");
    const sf = ts.createSourceFile(f, readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (n) => {
      if (ts.isTypeAliasDeclaration(n)) add(n.name.text, { rel, kind: "alias", node: n.type });
      else if (ts.isEnumDeclaration(n)) add(n.name.text, { rel, kind: "enum", node: n });
      else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && isAsConst(n.initializer)) add(n.name.text, { rel, kind: "const", node: unwrap(n.initializer, ts) });   // only `as const` literals: a plain string[] is data, not a closed set
      else if ((ts.isPropertySignature(n) || ts.isPropertyDeclaration(n)) && n.type && n.name && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))) {
        let o = n.parent; while (o && !((ts.isInterfaceDeclaration(o) || ts.isTypeAliasDeclaration(o) || ts.isClassDeclaration(o)) && o.name)) o = o.parent;
        fields.push({ rel, owner: o?.name.text ?? "?", field: n.name.text, node: n.type });
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  // values of a type node / declaration; seen guards alias cycles. Non-literal members (string, undefined, null) are ignored.
  const lookup = (name, rel) => { const l = decls.get(name); return l && (l.find((d) => d.rel === rel) ?? l[0]); };
  const valuesOfDecl = (d, seen) => {
    if (d.kind === "enum") return d.node.members.map((m) => m.initializer && litText(m.initializer, ts)).filter((v) => v !== undefined);
    if (d.kind === "const") return ts.isArrayLiteralExpression(d.node) ? constValues(d.node, "values") : [];   // an as-const OBJECT is a union only when a type alias indexes it (below)
    return valuesOfType(d.node, d.rel, seen);
  };
  const constValues = (init, mode) => {
    if (!init) return [];
    if (ts.isArrayLiteralExpression(init)) return init.elements.map((e) => litText(unwrap(e, ts), ts)).filter((v) => v !== undefined);
    if (ts.isObjectLiteralExpression(init)) return init.properties.flatMap((p) => {
      if (mode === "keys") return p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? [p.name.text] : [];
      const v = ts.isPropertyAssignment(p) ? litText(unwrap(p.initializer, ts), ts) : undefined; return v === undefined ? [] : [v];
    });
    return [];
  };
  const valuesOfType = (t, rel, seen = new Set()) => {
    t = unwrap(t, ts);
    if (!t) return [];
    if (ts.isUnionTypeNode(t)) return t.types.flatMap((x) => valuesOfType(x, rel, seen));
    if (ts.isLiteralTypeNode(t)) { const v = litText(t.literal, ts); return v === undefined ? [] : [v]; }
    if (ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName)) {
      const name = t.typeName.text, d = lookup(name, rel);
      if (!d || seen.has(name)) return [];
      return valuesOfDecl(d, new Set(seen).add(name));
    }
    if (ts.isIndexedAccessTypeNode(t) && ts.isTypeQueryNode(t.objectType) && ts.isIdentifier(t.objectType.exprName)) {   // typeof X[number] / typeof X[keyof typeof X]
      const d = lookup(t.objectType.exprName.text, rel);
      return d?.kind === "const" ? constValues(d.node, "values") : [];
    }
    return [];
  };
  const uniq = (v) => [...new Set(v)];
  const fieldUnions = [], anyUnions = [];
  for (const [name, list] of decls) for (const d of list) {
    const values = uniq(valuesOfDecl(d, new Set([name])));
    if (values.length < 2) continue;
    const u = { key: `${d.rel}::${name}`, rel: d.rel, label: name, field: name, values };
    anyUnions.push(u);
    if (d.kind === "const" ? CONST_NAME_RX.test(name) : (NAME_RX.test(name) || name === "Kind")) fieldUnions.push(u);
  }
  for (const f of fields) {
    // only INLINE literal unions on a field; a field typed by a named alias is covered by that alias.
    if (!FIELD_RX.test(f.field) || ts.isTypeReferenceNode(unwrap(f.node, ts))) continue;
    const values = uniq(valuesOfType(f.node, f.rel));
    if (values.length >= 2) fieldUnions.push({ key: `${f.rel}::${f.owner}.${f.field}`, rel: f.rel, label: `${f.owner}.${f.field}`, field: f.field, values });
  }
  return { fieldUnions, anyUnions, aliasNames: new Set(decls.keys()) };
}

// every CHECK (col IN (...)) in every table of the final schema.
export function discoverChecks(db) {
  const out = [];
  for (const { name, sql } of db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all())
    for (const m of sql.matchAll(/CHECK\s*\(\s*(\w+)\s+IN\s*\(([^)]*)\)/gi)) out.push({ key: `${name}.${m[1]}`, table: name, column: m[1], values: strLits(m[2]) });
  return out;
}

export function discoveryFindings({ unions, anyUnions = unions, checks, pairs, allow, warnings = [] }) {
  const fails = [], usedAllow = new Set();
  const allowU = new Map((allow.unions ?? []).map((e) => [e.key, e])), allowC = new Map((allow.checks ?? []).map((e) => [e.key, e]));
  const pairKeys = new Set(pairs.map((p) => p.ts.file + "::" + (p.ts.type ?? `${p.ts.iface}.${p.ts.prop}`)));
  const pairChecks = new Set(pairs.map((p) => `${p.sql.table}.${p.sql.column}`));
  const matchedChecks = new Set(pairChecks);
  for (const u of unions) {
    if (pairKeys.has(u.key)) continue;
    const eq = checks.filter((c) => sameSet(c.values, u.values));
    if (allowU.has(u.key)) { usedAllow.add("u:" + u.key); if (eq.length) fails.push(`stale allowlist: union ${u.key} now matches CHECK ${eq[0].key}, remove it from migration_lint_allow.json`); continue; }
    if (eq.length) { eq.forEach((c) => matchedChecks.add(c.key)); continue; }
    const near = checks.map((c) => ({ c, j: jaccard(c.values, u.values) })).filter((x) => x.j >= 0.5).sort((a, b) => b.j - a.j)[0];
    if (near) {
      const onlyTs = u.values.filter((v) => !near.c.values.includes(v)), onlySql = near.c.values.filter((v) => !u.values.includes(v));
      fails.push(`${u.key}: sets differ from CHECK ${near.c.key}: only in TS [${onlyTs.join(",")}], only in SQL [${onlySql.join(",")}]`);
      matchedChecks.add(near.c.key);
    } else fails.push(`${u.key}: union [${u.values.join(",")}] has no matching CHECK mapping (add a PAIR, a CHECK, or an allowlist entry with a reason)`);
  }
  for (const c of checks) {
    if (matchedChecks.has(c.key) || anyUnions.some((u) => sameSet(u.values, c.values))) continue;
    if (allowC.has(c.key)) { usedAllow.add("c:" + c.key); continue; }
    fails.push(`CHECK ${c.key} IN [${c.values.join(",")}] has no TS union with the same members (add a union, a PAIR, or an allowlist entry with a reason)`);
  }
  for (const e of allow.unions ?? []) if (!usedAllow.has("u:" + e.key) && !unions.some((u) => u.key === e.key)) fails.push(`stale allowlist: union ${e.key} no longer exists`);
  for (const e of allow.checks ?? []) if (!usedAllow.has("c:" + e.key) && !checks.some((c) => c.key === e.key)) fails.push(`stale allowlist: CHECK ${e.key} no longer exists`);
  for (const e of [...(allow.unions ?? []), ...(allow.checks ?? [])]) if (!e.reason || e.reason.length < 10) fails.push(`allowlist entry ${e.key} needs a written reason`);
  return fails;
}

export function lint({ migDir = join(ROOT, "migrations"), srcRoot = ROOT, pairs = PAIRS, declaredPath = join(HERE, "migration_lint_declared.json"), allowPath = ALLOW_PATH, discover = true } = {}) {
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
  if (!errs.length) for (const d of checkDebt) if (!seenDebt.has(d) && pairs.some((p) => p.name === d.pair)) failures.push(`stale declaration: check debt '${d.value}' on pair '${d.pair}' no longer fails, remove it from the declared file`);
  if (!errs.length && discover) {
    const allow = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, "utf8")) : {};
    const { fieldUnions, anyUnions } = discoverUnions(srcRoot);
    failures.push(...discoveryFindings({ unions: fieldUnions, anyUnions: [...fieldUnions, ...anyUnions], checks: discoverChecks(db), pairs, allow, warnings }));
  }
  return { files, failures, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = lint();
  for (const w of r.warnings) console.log("WARN " + w);
  for (const f of r.failures) console.log("FAIL " + f);
  console.log(r.failures.length ? `MIGRATION LINT FAILED (${r.failures.length})` : `MIGRATION LINT OK (${r.files.length} migrations)`);
  process.exit(r.failures.length ? 1 : 0);
}
