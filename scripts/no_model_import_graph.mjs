// F433 C1 gate: zero model calls on guest and owner paths, asserted over the whole static import graph.
// Walks the import graph from every request entry (app routes and pages, the portal-api worker, concierge,
// guestscan, shop libs) and fails if any reachable module imports a model SDK or holds a model-host URL
// in a string literal, unless scripts/no_model_allowlist.json carries a reviewed entry for that file.
// Prose is not scanned: JSX text, comments and non-URL strings (e.g. the "anthropic-ai" bot name in robots.ts) are ignored.
// Run: node --experimental-strip-types scripts/no_model_import_graph.mjs [--report out.json] [--root dir] [--allow file]
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MODEL_HOSTS, isModelHost, isModelSdk } from "../lib/modelhosts.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, "..");
const DENYLIST_FILE = "lib/modelhosts.ts"; // it IS the host list
const EXTS = [".ts", ".tsx", ".mjs", ".js", ".mts", ".jsx"];
const IMPORT_RE = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const STRING_RE = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
const URL_HOST_RE = /\b(?:https?|wss?):\/\/(?:[^\s/@"'`]*@)?([a-z0-9.-]+)/gi;

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\'"`])\/\/.*$/gm, "$1");

function walkDir(root, rel, pred, out = []) {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) return out;
  for (const n of readdirSync(abs)) {
    if (n === "node_modules" || n.startsWith(".")) continue;
    const r = path.join(rel, n);
    const st = statSync(path.join(root, r));
    if (st.isDirectory()) walkDir(root, r, pred, out); else if (pred(r)) out.push(r);
  }
  return out;
}

// Every request entry: app routes/pages/layouts, the worker, concierge, guestscan, shop, status libs.
export function findEntries(root) {
  const e = new Set();
  for (const f of walkDir(root, "app", (r) => /(^|\/)(page|layout|route|error|not-found|loading|template|robots|sitemap|middleware)\.(ts|tsx|js|mjs)$/.test(r))) e.add(f);
  for (const d of ["lib/concierge", "lib/guestscan", "lib/shop"]) for (const f of walkDir(root, d, (r) => EXTS.includes(path.extname(r)) && !/test/.test(r))) e.add(f);
  for (const f of ["portal-api/src/index.ts", "middleware.ts"]) if (existsSync(path.join(root, f))) e.add(f);
  for (const f of walkDir(root, "portal-api/src/shop", (r) => EXTS.includes(path.extname(r)))) e.add(f);
  return [...e].sort();
}

function resolveLocal(root, from, spec) {
  const base = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(path.join(root, from)), spec);
  const cands = [base, ...EXTS.map((x) => base + x), ...EXTS.map((x) => path.join(base, "index" + x))];
  // .js specifiers in ts source point at .ts files
  if (/\.m?js$/.test(base)) cands.push(base.replace(/\.m?js$/, ".ts"), base.replace(/\.m?js$/, ".tsx"));
  for (const c of cands) { try { if (statSync(c).isFile()) return path.relative(root, c); } catch {} }
  return null;
}

export function scanSource(src) {
  const code = stripComments(src);
  const sdk = [], hosts = [];
  for (const m of code.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (!spec.startsWith(".") && !spec.startsWith("@/") && isModelSdk(spec)) sdk.push(spec);
  }
  for (const m of code.matchAll(STRING_RE)) {
    const s = m[1] ?? m[2] ?? m[3] ?? "";
    for (const u of s.matchAll(URL_HOST_RE)) if (isModelHost(u[1])) hosts.push(u[1].toLowerCase());
    if (/^[a-z0-9.-]+(:\d+)?(\/.*)?$/i.test(s) && s.includes(".") && isModelHost(s.split("/")[0])) hosts.push(s.split("/")[0].toLowerCase());
  }
  return { sdk: [...new Set(sdk)], hosts: [...new Set(hosts)] };
}

export function loadAllow(file) {
  if (!existsSync(file)) return [];
  const j = JSON.parse(readFileSync(file, "utf8"));
  const bad = (j.entries || []).filter((x) => !x.path || !x.reason || !x.kind || !x.match);
  if (bad.length) throw new Error(`allowlist entries need path, kind, match and reason: ${JSON.stringify(bad)}`);
  return j.entries || [];
}

export function runGate({ root = DEFAULT_ROOT, allowFile = path.join(root, "scripts/no_model_allowlist.json"), entries } = {}) {
  const allow = loadAllow(allowFile);
  const ents = entries ?? findEntries(root);
  const seen = new Set(), violations = [], allowed = [], edges = []; const unresolved = [];
  const stack = ents.filter((e) => existsSync(path.join(root, e)));
  const parent = new Map(stack.map((e) => [e, null]));
  while (stack.length) {
    const f = stack.pop(); if (seen.has(f)) continue; seen.add(f);
    const src = readFileSync(path.join(root, f), "utf8");
    if (f !== DENYLIST_FILE) {
      const hit = scanSource(src);
      const chain = () => { const c = []; for (let x = f; x; x = parent.get(x)) c.unshift(x); return c; };
      for (const [kind, list] of [["sdk", hit.sdk], ["host", hit.hosts]]) for (const match of list) {
        const a = allow.find((x) => x.path === f && x.kind === kind && x.match === match);
        (a ? allowed : violations).push({ file: f, kind, match, chain: chain(), ...(a ? { reason: a.reason } : {}) });
      }
    }
    const code = stripComments(src);
    for (const m of code.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
      if (!(spec.startsWith(".") || spec.startsWith("@/"))) continue;
      const r = resolveLocal(root, f, spec);
      if (!r) { unresolved.push(`${f} -> ${spec}`); continue; }
      edges.push([f, r]);
      if (!seen.has(r)) { if (!parent.has(r)) parent.set(r, f); stack.push(r); }
    }
  }
  const used = new Set(allowed.map((a) => `${a.file}|${a.kind}|${a.match}`));
  const staleAllow = allow.filter((x) => !used.has(`${x.path}|${x.kind}|${x.match}`));
  return { ok: violations.length === 0, entries: ents, entriesWalked: ents.length, filesWalked: seen.size, edgesFollowed: edges.length, violations, allowed, staleAllow, unresolved, modelHostsChecked: MODEL_HOSTS.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  const root = arg("--root") ? path.resolve(arg("--root")) : DEFAULT_ROOT;
  const rep = runGate({ root, allowFile: arg("--allow") ? path.resolve(arg("--allow")) : path.join(root, "scripts/no_model_allowlist.json") });
  if (arg("--report")) writeFileSync(arg("--report"), JSON.stringify(rep, null, 2) + "\n");
  for (const v of rep.violations) console.error(`FAIL ${v.kind} ${v.match} in ${v.file} (via ${v.chain.join(" -> ")})`);
  for (const s of rep.staleAllow) console.error(`WARN stale allowlist entry ${s.path} ${s.kind} ${s.match}`);
  console.log(`no_model_import_graph: ${rep.ok ? "OK" : "FAILED"} entries=${rep.entriesWalked} files=${rep.filesWalked} edges=${rep.edgesFollowed} violations=${rep.violations.length} allowed=${rep.allowed.length}`);
  process.exit(rep.ok ? 0 : 1);
}
