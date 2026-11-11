// f414_c10: shared "sweep EVERY exported page" helper for the rendered probes (f406 print+motion, f407 keyboard focus).
// No hand list: the page list is walked from the build output dir. The total is ALWAYS recomputed here, independently of
// whatever list a probe actually swept, so a probe that silently drops a page is caught (pages_swept < pages_total).
// A page that is deliberately not swept must be named with a reason in scripts/allpages_allowlist.json (and that file has a test).
// Zero network, zero model calls.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listExportedPages, readManifest, diffPages, SYSTEM_PAGES } from "../export_page_manifest.mjs";

export const DEFAULT_MANIFEST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "export_pages.json");
export const DEFAULT_ALLOWLIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "allpages_allowlist.json");

/** "about.html" -> "/about", "blog/index.html" -> "/blog", "index.html" -> "/". */
export function pageToRoute(rel) {
  const route = "/" + rel.replace(/(^|\/)index\.html$/, "").replace(/\.html$/, "");
  return route === "" || route === "/" ? "/" : route.replace(/\/$/, "");
}

/**
 * f420_c10: the page list for --all comes from the committed manifest (scripts/export_pages.json), with routes_count
 * semantics (every exported .html except 404.html). Fails closed with a named ManifestError (callers exit 4) when the
 * manifest is missing/unreadable, internally inconsistent, stale against the output dir, or disagrees with this
 * module's own walk of the output dir. Returns {routes, count, manifest}.
 */
export class ManifestError extends Error { constructor(kind, msg) { super(msg); this.kind = kind; } }
export function manifestRoutes(outDir, manifestFile = DEFAULT_MANIFEST) {
  let m;
  try { m = readManifest(manifestFile); } catch (e) { throw new ManifestError("MISSING", e.message); }
  const routesPages = m.pages.filter((p) => p !== "404.html");
  if (m.count !== m.pages.length || m.routes_count !== routesPages.length || new Set(m.pages).size !== m.pages.length)
    throw new ManifestError("INCONSISTENT", `manifest ${manifestFile} count=${m.count} routes_count=${m.routes_count} disagree with its own pages list (${m.pages.length} pages, ${routesPages.length} routes)`);
  let actual;
  try { actual = listExportedPages(outDir); } catch (e) { throw new ManifestError("OUTDIR", e.message); }
  const { added, removed } = diffPages(m.pages, actual);
  if (added.length || removed.length)
    throw new ManifestError("STALE", `manifest ${manifestFile} is stale against ${outDir}: ` + [...added.map((p) => "ADDED " + p), ...removed.map((p) => "REMOVED " + p)].join(", ") + " (run npm run export:manifest and commit)");
  const routes = routesPages.map(pageToRoute).sort();
  const walked = enumerateAllPages(outDir).filter((r) => r !== "/404");
  const a = new Set(routes), b = new Set(walked);
  const only = [...routes.filter((r) => !b.has(r)).map((r) => "manifest-only " + r), ...walked.filter((r) => !a.has(r)).map((r) => "walk-only " + r)];
  if (only.length || routes.length !== m.routes_count)
    throw new ManifestError("DISAGREES", `manifest routes disagree with the independent walk of ${outDir}: ${only.join(", ") || "count mismatch"}`);
  return { routes, count: m.routes_count, manifest: m };
}

/** Walk root for *.html and return sorted unique routes ("/", "/scan", "/blog/post"). */
export function enumerateAllPages(root) {
  const r = path.resolve(root);
  if (!fs.existsSync(r) || !fs.statSync(r).isDirectory()) throw new Error("out dir missing: " + r);
  const found = new Set();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith(".html")) {
        found.add(pageToRoute(path.relative(r, f).split(path.sep).join("/")));
      }
    }
  };
  walk(r);
  return [...found].sort();
}

/** Load + validate the allowlist: [{route, reason}], reason must be a real sentence, routes unique. */
export function loadAllowlist(file = DEFAULT_ALLOWLIST) {
  if (!fs.existsSync(file)) return { entries: [], problems: ["allowlist file missing: " + file] };
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return { entries: [], problems: ["allowlist is not valid JSON: " + e.message] }; }
  const list = Array.isArray(raw) ? raw : raw.skipped;
  const problems = [];
  if (!Array.isArray(list)) return { entries: [], problems: ["allowlist must be an array or {skipped: [...]}"] };
  const seen = new Set(); const entries = [];
  for (const [i, e] of list.entries()) {
    if (!e || typeof e.route !== "string" || !e.route.startsWith("/")) { problems.push(`entry ${i}: route must be a string starting with /`); continue; }
    if (typeof e.reason !== "string" || e.reason.trim().length < 15) problems.push(`entry ${e.route}: reason missing or under 15 characters`);
    if (seen.has(e.route)) problems.push(`entry ${e.route}: duplicate`);
    seen.add(e.route); entries.push({ route: e.route, reason: String(e.reason || "").trim() });
  }
  return { entries, problems };
}

/**
 * The independent coverage verdict.
 *   enumerated  every exported route (fresh walk of the output dir)
 *   allowlisted routes skipped on purpose (must exist in enumerated, else the allowlist is stale = problem)
 *   total       enumerated minus allowlisted: every one of these MUST be swept
 *   swept       the routes the probe actually swept (set of route strings)
 */
export function coverage({ outDir, swept, allowlistFile = DEFAULT_ALLOWLIST, shard = null, routes = null }) {
  const enumerated = enumerateAllPages(outDir);
  const { entries, problems } = loadAllowlist(allowlistFile);
  const allow = new Map(entries.map((e) => [e.route, e.reason]));
  const exists = new Set(enumerated);
  const stale = entries.filter((e) => !exists.has(e.route)).map((e) => e.route);
  for (const s of stale) problems.push(`allowlist entry ${s} is not an exported page (stale)`);
  const total = shardOf((routes || enumerated).filter((p) => !allow.has(p)), shard); // routes = manifest routes (f420); null = legacy walk
  const sweptSet = new Set(swept);
  const notSwept = total.filter((p) => !sweptSet.has(p));
  const allowlisted = enumerated.filter((p) => allow.has(p)).map((p) => ({ route: p, reason: allow.get(p) }));
  return {
    pages_enumerated: enumerated.length,
    pages_allowlisted: allowlisted.length,
    pages_total: total.length,
    pages_swept: total.length - notSwept.length,
    not_swept: notSwept,
    allowlisted,
    problems,
    shard,
    source: routes ? "manifest" : "walk",
    manifest_routes_count: routes ? routes.length : null,
    ok: notSwept.length === 0 && problems.length === 0,
  };
}

/** --shard K/N: every Nth page starting at K (0-based) of the sorted list. Lets a 10-minute foreground limit cover a big site in N runs. */
export function shardOf(list, shard) { return shard ? list.filter((_, i) => i % shard.n === shard.k) : list; }
export function parseShard(v) {
  if (!v) return null;
  const m = /^(\d+)\/(\d+)$/.exec(v);
  if (!m || +m[2] < 1 || +m[1] >= +m[2]) throw new Error("bad --shard " + v + " (want K/N, 0 <= K < N)");
  return { k: +m[1], n: +m[2] };
}

/** Bounded-concurrency map: at most `limit` fn() in flight; results in input order; worker index passed as 2nd arg. */
export async function mapLimit(items, limit, fn) {
  const n = Math.max(1, Math.min(limit | 0 || 1, items.length || 1));
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: n }, async (_, w) => {
    for (;;) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i], w, i); }
  }));
  return out;
}

/** Common CLI flags for the --all mode. Returns {all, concurrency, report, allowlist, dropForMutation}. */
export function allFlags(argv) {
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  return {
    all: argv.includes("--all"),
    concurrency: Math.max(1, parseInt(arg("--concurrency", "3"), 10) || 3),
    report: arg("--report", ""),
    allowlist: arg("--allowlist", DEFAULT_ALLOWLIST),
    // TEST HOOK ONLY: drops this route from the sweep list (not from the independent total) so the mutation test can prove it is caught.
    drop: arg("--mutate-drop", ""),
    shard: parseShard(arg("--shard", "")),
    manifest: arg("--manifest", DEFAULT_MANIFEST),
  };
}

export const ALLFLAGS = ["--all", "--concurrency", "--report", "--allowlist", "--mutate-drop", "--shard", "--manifest"];

/** Write the one JSON the task asks for: pages_total / pages_swept / per-page defects. */
export function writeReport(file, { probe, cov, perPage }) {
  const doc = {
    probe, generated: new Date().toISOString(),
    pages_enumerated: cov.pages_enumerated, pages_allowlisted: cov.pages_allowlisted,
    shard: cov.shard || null, source: cov.source || "walk", manifest_routes_count: cov.manifest_routes_count ?? null, pages_total: cov.pages_total, pages_swept: cov.pages_swept,
    not_swept: cov.not_swept, allowlisted: cov.allowlisted, problems: cov.problems,
    pages_with_defects: perPage.filter((p) => p.defects.length).length,
    pages: perPage,
  };
  fs.writeFileSync(file, JSON.stringify(doc, null, 1));
  return doc;
}
