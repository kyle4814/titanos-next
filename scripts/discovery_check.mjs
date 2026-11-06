// Discovery-file checker (plan C7/C9). Reads an export dir (default out/), derives the route list from
// the exported HTML, and checks sitemap.xml, robots.txt, llms.txt and the agent card (if present)
// against it and against the catalogue/pricing sources in the repo.
//   MISSING = a file or a required entry is absent.   WRONG = present but disagrees with the site.
// A missing file is generated deterministically into a generated/ dir for review, never into the export.
// Usage: node scripts/discovery_check.mjs [--export out] [--repo .] [--gen generated/discovery] [--json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SITE = "https://titanos.tech";
// Paths that must never be advertised and must be disallowed. The first four are the plan's gated surfaces;
// the rest are this site's existing private areas (app/robots.ts PRIVATE).
export const PLAN_GATED = ["/account", "/seats", "/admin", "/api"];
export const SITE_PRIVATE = ["/app", "/d", "/v", "/welcome", "/order"];
export const GATED = [...PLAN_GATED, ...SITE_PRIVATE];
// API routes declared by the backend decision (w0) that a discovery file may link to on api.titanos.tech.
export const DECLARED_API = ["/", "/checkout/monitor", "/stripe/webhook", "/scan/request", "/order/submit", "/billing/portal", "/mcp"];
const API_HOST = "api.titanos.tech";

const isGated = (p) => GATED.some((g) => p === g || p.startsWith(g + "/"));

function walk(dir, rel = "") {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const r = rel + "/" + e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), r));
    else out.push(r);
  }
  return out;
}

// Every exported file as a URL path, plus the HTML routes (with noindex flag).
export function readExport(dir) {
  const files = new Set(walk(dir));
  const routes = [];
  for (const f of files) {
    if (!f.endsWith(".html")) continue;
    let r = f.slice(0, -5);
    if (r === "/404" || r === "/_not-found") continue;
    if (r === "/index") r = "/";
    else if (r.endsWith("/index")) r = r.slice(0, -6);
    const head = fs.readFileSync(path.join(dir, f), "utf8").slice(0, 20000);
    const noindex = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(head);
    routes.push({ path: r, noindex });
  }
  routes.sort((a, b) => (a.path < b.path ? -1 : 1));
  return { files, routes };
}

export const publicRoutes = (routes) => routes.filter((r) => !isGated(r.path) && !r.noindex).map((r) => r.path);

// Does a site URL path resolve to an exported file or route?
function resolves(p, ex) {
  if (ex.files.has(p)) return true;
  const norm = p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
  return ex.routes.some((r) => r.path === norm) || ex.files.has(norm + ".html");
}

function urlParts(u) {
  try { const x = new URL(u); return { host: x.host, path: x.pathname, ok: true }; } catch { return { ok: false }; }
}

export function parseSitemap(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
}

export function checkSitemap(xml, ex) {
  const missing = [], wrong = [];
  const locs = parseSitemap(xml);
  const listed = new Set();
  for (const u of locs) {
    const p = urlParts(u);
    if (!p.ok || p.host !== new URL(SITE).host) { wrong.push(`sitemap: ${u} is not on ${SITE}`); continue; }
    listed.add(p.path);
    if (isGated(p.path)) wrong.push(`sitemap: gated route listed ${p.path}`);
    else if (!resolves(p.path, ex)) wrong.push(`sitemap: ${p.path} does not resolve to an exported file`);
    else if (ex.routes.find((r) => r.path === p.path)?.noindex) wrong.push(`sitemap: noindex route listed ${p.path}`);
  }
  for (const r of publicRoutes(ex.routes)) if (!listed.has(r)) missing.push(`sitemap: public route not listed ${r}`);
  return { missing, wrong };
}

export function checkRobots(txt, ex) {
  const missing = [], wrong = [];
  const lines = txt.split(/\r?\n/).map((l) => l.trim());
  const disallow = new Set(lines.filter((l) => /^disallow:/i.test(l)).map((l) => l.replace(/^disallow:\s*/i, "")));
  for (const g of PLAN_GATED.concat(SITE_PRIVATE.filter((g) => ex.routes.some((r) => r.path === g || r.path.startsWith(g + "/"))))) {
    if (![g, g + "/"].some((d) => disallow.has(d))) missing.push(`robots: no Disallow for gated path ${g}`);
  }
  for (const d of disallow) if (d === "/" ) wrong.push("robots: Disallow: / blocks the whole site");
  const sm = lines.filter((l) => /^sitemap:/i.test(l)).map((l) => l.replace(/^sitemap:\s*/i, ""));
  if (!sm.includes(`${SITE}/sitemap.xml`)) missing.push(`robots: no Sitemap: ${SITE}/sitemap.xml line`);
  // a Disallow must not hide a public route we advertise
  for (const d of disallow) {
    if (!d || d === "/") continue;
    const hit = publicRoutes(ex.routes).filter((r) => r === d.replace(/\/$/, "") || r.startsWith(d.endsWith("/") ? d : d + "/"));
    for (const h of hit) wrong.push(`robots: Disallow ${d} hides public route ${h}`);
  }
  return { missing, wrong };
}

// Links in llms.txt: markdown links and bare URLs. A link must resolve to an exported file/route on the site,
// or be a declared API route on api.titanos.tech.
export function linksIn(txt) {
  const set = new Set();
  for (const m of txt.matchAll(/https?:\/\/[^\s)\]>"'`]+/g)) set.add(m[0].replace(/[.,;:]+$/, ""));
  return [...set];
}

export function checkLinks(label, txt, ex, apiRoutes = DECLARED_API) {
  const wrong = [];
  for (const u of linksIn(txt)) {
    const p = urlParts(u);
    if (!p.ok) { wrong.push(`${label}: unparseable link ${u}`); continue; }
    if (p.host === API_HOST) { if (!apiRoutes.includes(p.path)) wrong.push(`${label}: ${u} is not a declared API route`); continue; }
    if (p.host !== new URL(SITE).host) continue; // external links are not ours to resolve
    if (isGated(p.path)) wrong.push(`${label}: links a gated route ${p.path}`);
    else if (!resolves(p.path, ex)) wrong.push(`${label}: dead link ${p.path}`);
  }
  return { missing: [], wrong };
}

// ---- figures ---------------------------------------------------------------------------------------
const numTokens = (s) => [...s.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,/g, "")).map((t) => String(Number(t)));

export function buildCorpus(repo) {
  const nums = new Set();
  const tools = new Set();
  const add = (s) => { for (const t of numTokens(s)) { nums.add(t); const n = Number(t); if (Number.isInteger(n) && n >= 100) nums.add(String(n / 100)); } };
  const sources = [];
  for (const f of ["lib/offers/offers.json", "lib/ledger.json", "lib/agentTools.generated.json"]) {
    const p = path.join(repo, f);
    if (fs.existsSync(p)) { add(fs.readFileSync(p, "utf8")); sources.push(f); }
  }
  for (const f of ["lib/products.ts", "lib/pricing.ts"]) {
    const p = path.join(repo, f);
    if (fs.existsSync(p)) { add(fs.readFileSync(p, "utf8")); sources.push(f); }
  }
  let offerCount = null;
  const op = path.join(repo, "lib/offers/offers.json");
  if (fs.existsSync(op)) {
    try { const j = JSON.parse(fs.readFileSync(op, "utf8")); const a = Array.isArray(j) ? j : j.offers || Object.values(j); offerCount = Array.isArray(a) ? a.length : null; } catch { /* leave null */ }
  }
  const tp = path.join(repo, "lib/agentTools.generated.json");
  if (fs.existsSync(tp)) {
    try { const j = JSON.parse(fs.readFileSync(tp, "utf8")); for (const t of Array.isArray(j) ? j : j.tools || []) if (t.name) tools.add(t.name); } catch { /* ignore */ }
  }
  return { nums, tools, offerCount, sources };
}

// Currency amounts must be in the catalogue/pricing/ledger sources; counts of offers must match the catalogue.
export function checkFigures(label, txt, corpus) {
  const wrong = [];
  for (const m of txt.matchAll(/(?:AU|US|A)?\$\s?(\d[\d,]*(?:\.\d+)?)/g)) {
    const n = String(Number(m[1].replace(/,/g, "")));
    if (!corpus.nums.has(n)) wrong.push(`${label}: price ${m[0]} not in the catalogue, pricing or ledger sources`);
  }
  for (const m of txt.matchAll(/(\d[\d,]*)\s+(?:productised\s+)?offers\b/gi)) {
    if (corpus.offerCount !== null && Number(m[1].replace(/,/g, "")) !== corpus.offerCount) wrong.push(`${label}: says ${m[1]} offers, catalogue has ${corpus.offerCount}`);
  }
  return { missing: [], wrong };
}

export function checkAgentCard(json, ex, corpus) {
  const missing = [], wrong = [];
  let card;
  try { card = JSON.parse(json); } catch (e) { return { missing, wrong: [`agent card: not valid JSON (${e.message})`] }; }
  for (const k of ["name", "description", "url", "protocols", "authentication", "tools"]) if (card[k] === undefined) missing.push(`agent card: field ${k} absent`);
  const text = JSON.stringify(card);
  const l = checkLinks("agent card", text, ex);
  wrong.push(...l.wrong);
  wrong.push(...checkFigures("agent card", [card.description, card.billing && card.billing.unit, card.billing && card.billing.prepaid, ...(card.guarantees || []), ...(card.tools || []).map((t) => t.description)].filter(Boolean).join("\n"), corpus).wrong);
  for (const t of card.tools || []) {
    if (corpus.tools.size && !corpus.tools.has(t.name)) wrong.push(`agent card: tool ${t.name} is not in the tool catalogue`);
  }
  return { missing, wrong };
}

// ---- generation (deterministic: sorted, no timestamps) ---------------------------------------------
export function genSitemap(ex) {
  const rows = publicRoutes(ex.routes).map((r) => `<url>\n<loc>${SITE}${r === "/" ? "/" : r}</loc>\n</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
}
export function genRobots() {
  const dis = [...new Set(GATED)].sort().map((g) => `Disallow: ${g}/`);
  return ["User-Agent: *", "Allow: /", ...dis, "", `Host: ${SITE}`, `Sitemap: ${SITE}/sitemap.xml`, ""].join("\n");
}
export function genLlms(ex) {
  const pages = publicRoutes(ex.routes).filter((r) => r !== "/" && r.split("/").length === 2);
  return ["# TITANOS", "", "> Generated from the exported route list for review. Replace the summary with the approved wording before use.", "", "## Key pages", "", ...pages.map((p) => `- [${p}](${SITE}${p})`), "", `Sitemap: ${SITE}/sitemap.xml`, ""].join("\n");
}

// ---- driver ----------------------------------------------------------------------------------------
export function run({ exportDir, repo, genDir }) {
  const ex = readExport(exportDir);
  const corpus = buildCorpus(repo);
  const missing = [], wrong = [];
  const files = {};
  const read = (rel) => { const p = path.join(exportDir, rel); return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null; };
  const gen = [];
  const merge = (r) => { missing.push(...r.missing); wrong.push(...r.wrong); };

  const sm = read("sitemap.xml");
  if (sm === null) { missing.push("file: sitemap.xml absent"); gen.push(["sitemap.xml", genSitemap(ex)]); } else { files.sitemap = true; merge(checkSitemap(sm, ex)); }
  const rb = read("robots.txt");
  if (rb === null) { missing.push("file: robots.txt absent"); gen.push(["robots.txt", genRobots()]); } else { files.robots = true; merge(checkRobots(rb, ex)); }
  const ll = read("llms.txt");
  if (ll === null) { missing.push("file: llms.txt absent"); gen.push(["llms.txt", genLlms(ex)]); } else { files.llms = true; merge(checkLinks("llms.txt", ll, ex)); merge(checkFigures("llms.txt", ll, corpus)); }
  const ac = read(".well-known/agent.json");
  const notes = [];
  if (ac === null) notes.push("agent card absent (optional until web/w7_c7agent merges); not counted");
  else { files.agentCard = true; merge(checkAgentCard(ac, ex, corpus)); }

  if (genDir && gen.length) {
    fs.mkdirSync(genDir, { recursive: true });
    for (const [n, c] of gen) fs.writeFileSync(path.join(genDir, n), c);
  }
  return { routes: ex.routes.length, publicRoutes: publicRoutes(ex.routes).length, files, generated: gen.map(([n]) => n), missing, wrong, notes, corpusSources: corpus.sources };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const res = run({ exportDir: path.resolve(opt("--export", "out")), repo: path.resolve(opt("--repo", ".")), genDir: path.resolve(opt("--gen", "generated/discovery")) });
  if (a.includes("--json")) console.log(JSON.stringify(res, null, 2));
  else {
    console.log(`routes ${res.routes} (public ${res.publicRoutes}); files ${JSON.stringify(res.files)}; generated ${JSON.stringify(res.generated)}`);
    for (const m of res.missing) console.log("MISSING " + m);
    for (const w of res.wrong) console.log("WRONG   " + w);
    for (const n of res.notes) console.log("NOTE    " + n);
    console.log(`MISSING ${res.missing.length} WRONG ${res.wrong.length}`);
  }
  process.exit(res.missing.length || res.wrong.length ? 1 : 0);
}
