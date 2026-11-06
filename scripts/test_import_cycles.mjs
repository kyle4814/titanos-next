// Import-cycle gate for portal-api/src. Plain regex scan, no AST. Run: node scripts/test_import_cycles.mjs
// Edges = RUNTIME relative imports only. `import type ...`, `export type ...` and import lists where every
// specifier is `type X` are erased by strip-types and never create a runtime cycle, so they are not edges.
// portal-api/import_cycles.allow must be EMPTY (one "a.ts -> b.ts" line per tolerated edge would go there).
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../portal-api/src");
const ALLOW = resolve(here, "../portal-api/import_cycles.allow");

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

export function edgesOf(src) {
  const out = [];
  const code = stripComments(src);
  const re = /\b(import|export)\s+(type\s+)?([^;'"]*?)\s*from\s*["'](\.{1,2}\/[^"']+)["']|\bimport\s*["'](\.{1,2}\/[^"']+)["']|\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;
  let m;
  while ((m = re.exec(code))) {
    if (m[4]) {
      if (m[2]) continue; // import type / export type
      const clause = m[3].trim();
      const braces = clause.match(/\{([\s\S]*)\}/);
      if (braces && !clause.replace(/\{[\s\S]*\}/, "").replace(/[,\s]/g, "")) {
        const specs = braces[1].split(",").map((x) => x.trim()).filter(Boolean);
        if (specs.length && specs.every((x) => /^type\s+/.test(x))) continue; // all-type list
      }
      out.push(m[4]);
    } else out.push(m[5] || m[6]); // side-effect import or dynamic import
  }
  return out;
}

export function buildGraph(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  const g = new Map();
  for (const f of files) {
    const deps = new Set();
    for (const spec of edgesOf(readFileSync(join(dir, f), "utf8"))) {
      const base = spec.replace(/^\.\//, "");
      const cand = [base, base + ".ts", base.replace(/\.js$/, ".ts")].find((c) => files.includes(c));
      if (cand && cand !== f) deps.add(cand);
      else if (cand === f) deps.add(f);
    }
    g.set(f, [...deps].sort());
  }
  return g;
}

export function findCycles(g, allowed = new Set()) {
  const cycles = [], state = new Map(), stack = [];
  const visit = (n) => {
    state.set(n, 1); stack.push(n);
    for (const d of g.get(n) || []) {
      if (allowed.has(`${n} -> ${d}`)) continue;
      if (state.get(d) === 1) cycles.push([...stack.slice(stack.indexOf(d)), d].join(" -> "));
      else if (!state.get(d)) visit(d);
    }
    stack.pop(); state.set(n, 2);
  };
  for (const n of [...g.keys()].sort()) if (!state.get(n)) visit(n);
  return cycles;
}

let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "ok" : "not ok"} - ${name}${ok ? "" : " " + detail}`); if (!ok) failed++; };

// 1. self-tests on planted fixtures (prove the detector can fail)
const tmp = mkdtempSync(join(tmpdir(), "cyc-"));
const { mkdirSync } = await import("node:fs");
const mk = (name, files) => { const d = join(tmp, name); mkdirSync(d); for (const [f, c] of Object.entries(files)) writeFileSync(join(d, f), c); return d; };
try {
  const two = mk("two", { "a.ts": 'import { y } from "./b.ts";\nexport const x = 1;\n', "b.ts": 'import { x } from "./a.ts";\nexport const y = 2;\n' });
  const c2 = findCycles(buildGraph(two));
  check("planted two-file cycle is detected", c2.length === 1 && /a\.ts -> b\.ts -> a\.ts/.test(c2[0]), JSON.stringify(c2));
  const three = mk("three", { "a.ts": 'import "./b.ts";', "b.ts": 'export * from "./c.ts";', "c.ts": 'const m = await import("./a.ts");' });
  check("three-file cycle via side-effect, export-from and dynamic import", findCycles(buildGraph(three)).length === 1);
  const typed = mk("typed", { "a.ts": 'import { b } from "./b.ts";', "b.ts": 'import type { A } from "./a.ts";\nimport { type A2, type A3 } from "./a.ts";' });
  check("type-only imports are not edges", findCycles(buildGraph(typed)).length === 0);
  const mixed = mk("mixed", { "a.ts": 'import { b } from "./b.ts";', "b.ts": 'import { type A, real } from "./a.ts";' });
  check("mixed type+value list IS an edge", findCycles(buildGraph(mixed)).length === 1);
  const allowed = findCycles(buildGraph(two), new Set(["b.ts -> a.ts"]));
  check("allow-list suppresses a named edge", allowed.length === 0);
  const self = mk("self", { "a.ts": 'import { x } from "./a.ts";' });
  check("self-import is a cycle", findCycles(buildGraph(self)).length === 1);
  const commented = mk("commented", { "a.ts": 'import { b } from "./b.ts";', "b.ts": '// import { a } from "./a.ts";\n/* import { a } from "./a.ts"; */' });
  check("commented-out import is ignored", findCycles(buildGraph(commented)).length === 0);
} finally { rmSync(tmp, { recursive: true, force: true }); }

// 2. the allow-list must be empty
const allowLines = existsSync(ALLOW) ? readFileSync(ALLOW, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")) : [];
check("allow-list file exists and is empty", existsSync(ALLOW) && allowLines.length === 0, JSON.stringify(allowLines));

// 3. the real tree
const g = buildGraph(SRC);
const real = findCycles(g, new Set(allowLines));
check(`portal-api/src has no import cycle (${g.size} modules, ${[...g.values()].reduce((a, b) => a + b.length, 0)} runtime edges)`, real.length === 0, real.join(" | "));
if (failed) { console.error(`CYCLE GATE FAILED: ${failed}`); process.exit(1); }
console.log("import cycle gate OK");
