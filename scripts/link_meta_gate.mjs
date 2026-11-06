// STATIC LINT over the exported HTML (out/): internal links and page metadata.
// Not a crawler and not a browser: it reads files only (no network, no dependency).
// Rules: link-unresolved, dup-title, dup-description, missing-title, missing-description,
//        missing-canonical, canonical-not-self, missing-og-title, og-image-tag-missing, og-image-file-missing.
// Usage: node scripts/link_meta_gate.mjs [outDir] [--public dir] [--baseline N] [--json]
// Exit 1 when total violations exceed the baseline (default BASELINE below).
import fs from "node:fs";
import path from "node:path";

export const SITE = "https://titanos.tech";
export const BASELINE = 90; // measured 2026-11-07 on the main-checkout out/ (252 routes); ratchet down only
export const RULES = [
  "link-unresolved", "dup-title", "dup-description", "missing-title", "missing-description",
  "missing-canonical", "canonical-not-self", "missing-og-title", "og-image-tag-missing", "og-image-file-missing",
];

const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|lt|gt|apos);/gi, (_, e) => {
  e = e.toLowerCase();
  if (e === "amp") return "&"; if (e === "quot") return '"'; if (e === "lt") return "<";
  if (e === "gt") return ">"; if (e === "apos") return "'";
  return String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
});

// Hand-written scanner: yields {name, attrs, text} for every start tag; title text captured.
export function parseHtml(html) {
  const tags = []; let i = 0; const n = html.length; let title;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt < 0) break;
    if (html.startsWith("<!--", lt)) { const e = html.indexOf("-->", lt + 4); i = e < 0 ? n : e + 3; continue; }
    if (html[lt + 1] === "/" || html[lt + 1] === "!" || html[lt + 1] === "?") { const e = html.indexOf(">", lt); i = e < 0 ? n : e + 1; continue; }
    let j = lt + 1; while (j < n && /[A-Za-z0-9:-]/.test(html[j])) j++;
    const name = html.slice(lt + 1, j).toLowerCase();
    if (!name) { i = lt + 1; continue; }
    const attrs = {};
    while (j < n) {
      while (j < n && /\s|\//.test(html[j])) j++;
      if (html[j] === ">") { j++; break; }
      let k = j; while (k < n && !/[\s=>\/]/.test(html[k])) k++;
      const an = html.slice(j, k).toLowerCase(); j = k;
      while (j < n && /\s/.test(html[j])) j++;
      let val = "";
      if (html[j] === "=") {
        j++; while (j < n && /\s/.test(html[j])) j++;
        if (html[j] === '"' || html[j] === "'") { const q = html[j]; const e = html.indexOf(q, j + 1); val = html.slice(j + 1, e < 0 ? n : e); j = e < 0 ? n : e + 1; }
        else { k = j; while (k < n && !/[\s>]/.test(html[k])) k++; val = html.slice(j, k); j = k; }
      }
      if (an && !(an in attrs)) attrs[an] = decode(val);
      if (j === k && !an) j++;
    }
    i = j;
    if (name === "script" || name === "style") { const e = html.toLowerCase().indexOf("</" + name, i); i = e < 0 ? n : e; }
    else if (name === "title") { const e = html.indexOf("</", i); if (title === undefined) title = decode(html.slice(i, e < 0 ? n : e)).trim(); i = e < 0 ? n : e; }
    tags.push({ name, attrs });
  }
  return { tags, title };
}

export function walkHtml(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "_next" && e.name !== "_not-found") walkHtml(p, acc); }
    else if (e.name.endsWith(".html") && e.name !== "404.html") acc.push(p);
  }
  return acc;
}

export function routeOf(out, file) {
  const r = "/" + path.relative(out, file).replace(/\\/g, "/").replace(/\.html$/, "");
  return r.replace(/\/index$/, "") || "/";
}

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

// An internal reference resolves to an exported file or an exported route.
export function resolves(out, ref, publicDir, knownRoutes = []) {
  const p = decodeURIComponent(ref.split("#")[0].split("?")[0]);
  if (p === "" || p === "/") return true;
  const rel = p.replace(/^\/+/, "");
  const base = path.join(out, rel);
  if (!path.resolve(base).startsWith(path.resolve(out))) return false;
  if (isFile(base) || isFile(base + ".html") || isFile(path.join(base, "index.html"))) return true;
  if (publicDir && isFile(path.join(publicDir, rel))) return true;
  const r = "/" + rel.replace(/\/$/, "");
  return knownRoutes.includes(r);
}

const LINK_ATTRS = { a: "href", link: "href", img: "src", script: "src", source: "src", iframe: "src", audio: "src", video: "src" };

export function lintSite(out, { publicDir, knownRoutes = [], disable = [] } = {}) {
  const off = new Set(disable);
  const routes = {}; // route -> [{rule, selector, detail}]
  const titles = new Map(); const descs = new Map();
  const add = (route, rule, selector, detail = "") => { if (!off.has(rule)) routes[route].push({ rule, selector, detail }); };
  for (const f of walkHtml(out)) {
    const route = routeOf(out, f); routes[route] = [];
    const { tags, title } = parseHtml(fs.readFileSync(f, "utf8"));
    const meta = (k, v) => tags.find((t) => t.name === "meta" && (t.attrs[k] === v));
    const desc = meta("name", "description")?.attrs.content;
    const canon = tags.find((t) => t.name === "link" && (t.attrs.rel || "").toLowerCase().split(/\s+/).includes("canonical"))?.attrs.href;
    const ogT = meta("property", "og:title")?.attrs.content;
    const ogI = meta("property", "og:image")?.attrs.content;
    if (!title) add(route, "missing-title", "title"); else titles.set(title, [...(titles.get(title) || []), route]);
    if (!desc) add(route, "missing-description", 'meta[name="description"]'); else descs.set(desc, [...(descs.get(desc) || []), route]);
    if (!canon) add(route, "missing-canonical", 'link[rel="canonical"]');
    else if (canon.replace(/\/$/, "") !== SITE + (route === "/" ? "" : route)) add(route, "canonical-not-self", 'link[rel="canonical"]', canon);
    if (!ogT) add(route, "missing-og-title", 'meta[property="og:title"]');
    if (!ogI) add(route, "og-image-tag-missing", 'meta[property="og:image"]');
    else {
      const rel = ogI.startsWith(SITE) ? ogI.slice(SITE.length) : ogI;
      const q = decodeURIComponent(rel.split("?")[0]).replace(/^\/+/, "");
      const ok = ogI.startsWith("/") || ogI.startsWith(SITE) ? (publicDir && isFile(path.join(publicDir, q))) || isFile(path.join(out, q)) : false;
      if (!ok) add(route, "og-image-file-missing", 'meta[property="og:image"]', ogI);
    }
    const seen = new Set();
    for (const t of tags) {
      const attr = LINK_ATTRS[t.name]; const v = attr && t.attrs[attr];
      if (!v || !v.startsWith("/") || v.startsWith("//")) continue;
      if (t.name === "link" && !/stylesheet|icon|preload|manifest|alternate/.test(t.attrs.rel || "")) continue;
      if (seen.has(v)) continue; seen.add(v);
      if (!resolves(out, v, publicDir, knownRoutes)) add(route, "link-unresolved", `${t.name}[${attr}="${v}"]`, v);
    }
  }
  for (const [map, rule] of [[titles, "dup-title"], [descs, "dup-description"]])
    for (const [val, rs] of map) if (rs.length > 1) for (const r of rs) add(r, rule, rule === "dup-title" ? "title" : 'meta[name="description"]', `shared with ${rs.filter((x) => x !== r).join(", ")}`);
  return routes;
}

export function summarise(routes) {
  const byRule = Object.fromEntries(RULES.map((r) => [r, 0]));
  let total = 0;
  const counts = Object.entries(routes).map(([route, v]) => { for (const x of v) { byRule[x.rule]++; total++; } return [route, v.length]; });
  const worst = counts.filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  return { total, byRule, worst, routeCount: counts.length, routesWithViolations: counts.filter(([, c]) => c).length };
}

if (process.argv[1] && path.basename(process.argv[1]) === "link_meta_gate.mjs") {
  const a = process.argv.slice(2);
  const flag = (k) => { const i = a.indexOf(k); return i < 0 ? undefined : a[i + 1]; };
  const out = a.find((x, i) => !x.startsWith("--") && !["--public", "--baseline"].includes(a[i - 1])) || "out";
  const publicDir = flag("--public") || "public";
  const baseline = flag("--baseline") !== undefined ? +flag("--baseline") : BASELINE;
  if (!fs.existsSync(out)) { console.error(`link_meta_gate: ${out} missing; run "npx next build" first (static lint needs the export)`); process.exit(2); }
  const routes = lintSite(out, { publicDir });
  const s = summarise(routes);
  if (a.includes("--json")) console.log(JSON.stringify({ ...s, routes }, null, 1));
  else {
    console.log(`link_meta_gate (STATIC LINT, files only, no network): ${s.routeCount} routes, ${s.routesWithViolations} with violations, ${s.total} total, baseline ${baseline}`);
    for (const [r, c] of Object.entries(s.byRule)) console.log(`  ${r}: ${c}`);
    console.log("worst 5 routes:"); for (const [r, c] of s.worst) console.log(`  ${c}\t${r}`);
  }
  if (s.total > baseline) { console.error(`LINKMETA FAIL: ${s.total} > baseline ${baseline}`); process.exit(1); }
  console.log("LINKMETA PASS");
}
