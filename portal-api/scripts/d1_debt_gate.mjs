// f379 C10: Memory-only store debt gate. STATIC, read-only: reads source text, applies nothing, touches no network.
// Finds every store class constructed (`new MemoryX(`) in a service entrypoint (src/**, minus tests, plus the test/*harness*.ts
// composition roots that choose the store under STORE=d1). A store is MEMORY-ONLY when no durable adapter exists for it: a class that
// is NOT named Memory*, is named D1*/Kv*, and implements or extends the same interface/base (or extends the Memory class itself).
// Rules (all FAIL): (1) a constructed Memory-only store not named in the declared-debt JSON; (2) a debt entry missing store, reason,
// owner or would_flip; (3) a debt owner that is not a stage id in the STAGES list; (4) a STALE entry: the store has since gained a
// durable adapter, or is no longer constructed anywhere. WARN only: a store WITH an adapter constructed with no d1 branch (UNWIRED).
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "..");
export const DEBT_PATH = join(ROOT, "scripts/d1_debt_declared.json");
export const STAGES_FIXTURE = join(ROOT, "test/fixtures/website_stage_ids.tsv");

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n), s = statSync(p);
    if (s.isDirectory()) { if (n !== "node_modules") walk(p, out); } else if (n.endsWith(".ts")) out.push(p);
  }
  return out;
};
const stripComments = (src) => src.split("\n").map((l) => l.replace(/\/\/.*$/, (m, off) => (l.slice(0, off).split(/["'`]/).length % 2 === 1 ? "" : m))).join("\n");

export function stageIds(path = STAGES_FIXTURE) {
  return new Set(readFileSync(path, "utf8").split("\n").map((l) => l.split("\t")[0].trim()).filter((s) => s && !s.startsWith("#")));
}

// Entrypoint scan set: every non-test source file, plus the harness composition roots.
export function entryFiles(root = ROOT) {
  const src = walk(join(root, "src"));
  const harness = existsSync(join(root, "test")) ? readdirSync(join(root, "test")).filter((n) => /harness.*\.ts$/.test(n)).map((n) => join(root, "test", n)) : [];
  return [...src, ...harness];
}

export function scan(root = ROOT, aliases = {}) {
  const files = entryFiles(root).map((f) => ({ f, rel: relative(root, f), text: stripComments(readFileSync(f, "utf8")) }));
  // type table: class or interface name -> direct parents (extends/implements), merged across duplicate declarations
  const classes = new Map();
  const add = (name, parents) => classes.set(name, [...new Set([...(classes.get(name) ?? []), ...parents])]);
  for (const { text } of files) {
    for (const m of text.matchAll(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+?))?\s*\{/g))
      add(m[1], [...(m[2] ? [m[2]] : []), ...(m[3] ?? "").split(",").map((x) => x.trim()).filter(Boolean)]);
    for (const m of text.matchAll(/(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+([\w,\s]+?))?\s*\{/g))
      add(m[1], (m[2] ?? "").split(",").map((x) => x.trim()).filter(Boolean));
  }
  const closure = (name, seen = new Set()) => { for (const p of classes.get(name) ?? []) if (!seen.has(p)) { seen.add(p); closure(p, seen); } return seen; };
  const adaptersOf = (mem) => {
    const mk = closure(mem);
    const out = [];
    for (const [name] of classes) {
      if (name === mem || /^Memory/.test(name) || !/^(D1|Kv)/.test(name)) continue;
      const ck = closure(name);
      if (ck.has(mem) || [...ck].some((k) => mk.has(k) || (classes.has(k) && mk.has(k)))) out.push(name);
    }
    for (const a of aliases[mem] ?? []) if (classes.has(a) && !out.includes(a)) out.push(a);
    return out.sort();
  };
  const sites = new Map(); // store -> [{file,line,switched}]
  for (const { rel, text } of files) {
    text.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/new\s+(Memory\w+)\s*\(/g)) {
        const store = m[1];
        const switched = /d1|D1/.test(line) || /kind\s*[!=]==?\s*["']d1["']/.test(text.split("\n").slice(Math.max(0, i - 2), i + 1).join("\n"));
        (sites.get(store) ?? sites.set(store, []).get(store)).push({ file: rel, line: i + 1, switched });
      }
    });
  }
  const stores = [...sites.keys()].sort().map((store) => ({ store, adapters: adaptersOf(store), sites: sites.get(store), memoryOnly: adaptersOf(store).length === 0 }));
  return { stores, knownClasses: [...classes.keys()].filter((n) => /^Memory/.test(n)).sort() };
}

export function gate({ root = ROOT, debtPath = DEBT_PATH, stagesPath = STAGES_FIXTURE } = {}) {
  const failures = [], warnings = [];
  const decl = existsSync(debtPath) ? JSON.parse(readFileSync(debtPath, "utf8")) : {};
  const debt = decl.debt ?? [];
  // adapter_aliases: structural pairs the type graph cannot see (e.g. two unrelated interfaces). The alias target must be a real class.
  const { stores } = scan(root, decl.adapter_aliases ?? {});
  const stages = stageIds(stagesPath);
  const byStore = new Map(debt.map((d) => [d.store, d]));
  for (const d of debt) {
    for (const k of ["store", "reason", "owner", "would_flip"]) if (!d[k] || String(d[k]).trim().length < 4) failures.push(`bad debt entry ${JSON.stringify(d.store ?? d)}: missing ${k}`);
    if (d.owner && !stages.has(d.owner)) failures.push(`bad debt entry ${d.store}: owner "${d.owner}" is not a stage id in STAGES`);
  }
  const seen = new Set(stores.map((s) => s.store));
  for (const s of stores) {
    const where = s.sites.map((x) => `${x.file}:${x.line}`).join(", ");
    if (s.memoryOnly) {
      if (byStore.has(s.store)) warnings.push(`DECLARED DEBT ${s.store} (owner ${byStore.get(s.store).owner}) at ${where}`);
      else failures.push(`undeclared Memory-only store ${s.store} constructed at ${where}: no durable (D1/Kv) adapter and not in the declared-debt file`);
    } else {
      if (byStore.has(s.store)) failures.push(`stale debt: ${s.store} has gained a durable adapter (${s.adapters.join(", ")}), remove it from the declared-debt file`);
      for (const x of s.sites) if (!x.switched && x.file.startsWith("src/")) warnings.push(`UNWIRED ${s.store} constructed at ${x.file}:${x.line} with no d1 branch (adapter ${s.adapters.join(", ")} exists)`);
      for (const x of s.sites) if (!x.switched && x.file.startsWith("test/")) warnings.push(`UNWIRED ${s.store} constructed at ${x.file}:${x.line} with no d1 branch (adapter ${s.adapters.join(", ")} exists)`);
    }
  }
  for (const d of debt) if (!seen.has(d.store)) failures.push(`stale debt: ${d.store} is declared but no longer constructed in any scanned entrypoint, remove it from the declared-debt file`);
  return { failures, warnings, stores };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = process.argv.slice(2), arg = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const r = gate({ debtPath: arg("--debt") ?? DEBT_PATH, stagesPath: arg("--stages") ?? STAGES_FIXTURE });
  for (const w of r.warnings) console.log("WARN " + w);
  if (a.includes("--json")) console.log(JSON.stringify(r.stores, null, 1));
  if (r.failures.length) { for (const f of r.failures) console.error("FAIL " + f); process.exit(1); }
  console.log(`D1 DEBT GATE OK (${r.stores.length} constructed Memory stores, ${r.stores.filter((s) => s.memoryOnly).length} memory-only, all declared)`);
}
