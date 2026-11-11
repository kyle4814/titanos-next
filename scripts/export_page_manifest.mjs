// C10 coverage truth (f416): the committed list of every .html page the static export produces.
//   node scripts/export_page_manifest.mjs --write   regenerate scripts/export_pages.json from out/ (after a local build)
//   node scripts/export_page_manifest.mjs --check   exit 1 if out/ differs from the committed file; names pages added and removed
//   node scripts/export_page_manifest.mjs           print the manifest JSON to stdout
// Options: --out DIR (default out), --manifest FILE (default scripts/export_pages.json)
// Exit codes: 0 ok, 1 drift, 2 harness error (no out/, zero pages, missing or unreadable manifest). An empty export fails closed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SCHEMA = "export-pages/1";
// Pages Next emits that are not user routes. 404.html is excluded from "routes" by every sweep (f373, f385);
// _not-found.html is excluded by the f407 sweep. Both stay in the manifest: it lists every exported .html.
export const SYSTEM_PAGES = ["404.html", "_not-found.html"];

export function listExportedPages(outDir) {
  const root = path.resolve(outDir);
  let st;
  try { st = fs.statSync(root); } catch { throw new Error(`no such directory ${outDir}`); }
  if (!st.isDirectory()) throw new Error(`not a directory ${outDir}`);
  const found = new Set();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.isFile() && e.name.endsWith(".html")) found.add(path.relative(root, f).split(path.sep).join("/").normalize("NFC"));
    }
  };
  walk(root);
  const pages = [...found].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)); // codepoint order, locale independent
  if (pages.length === 0) throw new Error(`no .html pages under ${outDir} (empty export fails closed)`);
  return pages;
}

export function buildManifest(pages) {
  return {
    schema: SCHEMA,
    count: pages.length,
    routes_count: pages.filter((p) => p !== "404.html").length,
    system_pages: SYSTEM_PAGES.filter((p) => pages.includes(p)),
    pages,
  };
}
export const serialise = (m) => JSON.stringify(m, null, 2) + "\n";

export function diffPages(committed, actual) {
  const a = new Set(committed), b = new Set(actual);
  return { added: actual.filter((p) => !a.has(p)), removed: committed.filter((p) => !b.has(p)) };
}

export function readManifest(file) {
  let m;
  try { m = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { throw new Error(`cannot read manifest ${file}: ${e.message}`); }
  if (m.schema !== SCHEMA || !Array.isArray(m.pages) || m.pages.length === 0) throw new Error(`bad manifest ${file}`);
  return m;
}

export function check(outDir, manifestFile) {
  const actual = listExportedPages(outDir);
  const m = readManifest(manifestFile);
  const { added, removed } = diffPages(m.pages, actual);
  const exact = serialise(buildManifest(actual)) === fs.readFileSync(manifestFile, "utf8");
  return { ok: added.length === 0 && removed.length === 0 && exact, added, removed, exact, count: actual.length };
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const known = new Set(["--out", "--manifest", "--check", "--write"]);
  for (const a of argv) if (a.startsWith("--") && !known.has(a)) { console.error("usage: export_page_manifest.mjs [--write|--check] [--out out] [--manifest scripts/export_pages.json]"); process.exit(2); }
  const outDir = arg("--out", "out"), file = arg("--manifest", path.join(here, "export_pages.json"));
  try {
    if (argv.includes("--check")) {
      const r = check(outDir, file);
      if (r.ok) { console.log(`EXPORT MANIFEST OK ${r.count} pages match ${path.relative(process.cwd(), file)}`); process.exit(0); }
      for (const p of r.added) console.error(`ADDED   ${p} (in ${outDir}, not in manifest)`);
      for (const p of r.removed) console.error(`REMOVED ${p} (in manifest, not in ${outDir})`);
      if (!r.added.length && !r.removed.length) console.error("manifest file bytes differ from regenerated output (count/system fields or formatting)");
      console.error(`EXPORT MANIFEST DRIFT ${r.added.length} added, ${r.removed.length} removed; run with --write and commit`);
      process.exit(1);
    }
    const text = serialise(buildManifest(listExportedPages(outDir)));
    if (argv.includes("--write")) { fs.writeFileSync(file, text); console.log(`wrote ${file}`); } else process.stdout.write(text);
  } catch (e) { console.error(`EXPORT MANIFEST FAILED ${e.message}`); process.exit(2); }
}
