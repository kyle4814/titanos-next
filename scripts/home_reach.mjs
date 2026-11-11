// Click-depth crawl over the static export (localhost-free: reads out/ from disk).
// Edges = <a href> in each exported page. Menu edges (the header drawer / More menu is client-rendered, so
// absent from the HTML) = every lib/navLinks.ts LINKS href, costing 2 clicks (open menu, click item).
import fs from "node:fs";
import { walk, routeOf, inspect } from "./seo_audit.mjs";
import { LINKS } from "../lib/navLinks.ts";

export function crawl(out) {
  const pages = new Map();
  for (const f of walk(out)) {
    const html = fs.readFileSync(f, "utf8");
    const hrefs = new Set();
    for (const m of html.matchAll(/<a\b[^>]*?\bhref="([^"]+)"/g)) {
      let h = m[1].split("#")[0].split("?")[0];
      if (!h.startsWith("/") || h.startsWith("//")) continue;
      hrefs.add(h.replace(/\/$/, "") || "/");
    }
    pages.set(routeOf(out, f), { hrefs, noindex: inspect(html).noindex });
  }
  const run = (withMenu) => {
    const depth = new Map([["/", 0]]);
    const pq = [["/", 0]];
    while (pq.length) {
      pq.sort((a, b) => a[1] - b[1]);
      const [r, d] = pq.shift();
      if (d > depth.get(r)) continue;
      const edges = [...(pages.get(r)?.hrefs ?? [])].map((h) => [h, 1]);
      if (withMenu) for (const l of LINKS) edges.push([l.href, 2]);
      for (const [h, c] of edges) {
        if (!pages.has(h)) continue;
        if (!depth.has(h) || depth.get(h) > d + c) { depth.set(h, d + c); pq.push([h, d + c]); }
      }
    }
    return depth;
  };
  return { pages, staticDepth: run(false), menuDepth: run(true) };
}

export const PRODUCT_PAGES = { scan: "/scan", shop: "/shop", pricing: "/pricing", account: "/app/login", portalEntry: "/app", ownerSeat: "/app", proSeat: "/pro", agentSeat: "/agents", enterpriseSeat: "/enterprise", partnerSeat: "/partners" };
export const MAX_DEPTH = 3;
export const MAX_PRODUCT_DEPTH = 2;

const matches = (pat, r) => (pat.endsWith("/*") ? r === pat.slice(0, -2) || r.startsWith(pat.slice(0, -1)) : r === pat);

// Returns a list of problems; [] means pass. allow = { orphans: {pattern: reason}, deep: {pattern: reason} }
export function evaluate(out, allow) {
  const { pages, staticDepth, menuDepth } = crawl(out);
  const bad = [];
  for (const k of ["orphans", "deep"]) for (const [p, why] of Object.entries(allow[k] ?? {})) if (!String(why).trim()) bad.push(`allowlist ${k} entry ${p} has no written reason`);
  const allowed = (k, r) => Object.keys(allow[k] ?? {}).some((p) => matches(p, r));
  const used = { orphans: new Set(), deep: new Set() };
  const note = (k, r) => Object.keys(allow[k] ?? {}).forEach((p) => matches(p, r) && used[k].add(p));
  const skip = (r) => r === "/404" || r === "/_not-found";
  for (const r of pages.keys()) {
    if (skip(r)) continue;
    if (!menuDepth.has(r)) { if (allowed("orphans", r)) note("orphans", r); else bad.push(`ORPHAN ${r} (unreachable from / even through the menu)`); }
    else if (menuDepth.get(r) > MAX_DEPTH) { if (allowed("deep", r)) note("deep", r); else bad.push(`DEEP ${r} at ${menuDepth.get(r)} clicks (max ${MAX_DEPTH})`); }
  }
  for (const k of ["orphans", "deep"]) for (const p of Object.keys(allow[k] ?? {})) if (!used[k].has(p)) bad.push(`STALE allowlist ${k} entry ${p} matches nothing: remove it`);
  for (const [name, r] of Object.entries(PRODUCT_PAGES)) {
    if (!pages.has(r)) bad.push(`PRODUCT ${name} ${r} is not exported`);
    else if (!(staticDepth.get(r) <= MAX_PRODUCT_DEPTH)) bad.push(`PRODUCT ${name} ${r} is ${staticDepth.get(r) ?? "unreachable"} clicks by visible link (max ${MAX_PRODUCT_DEPTH})`);
  }
  return { bad, pages, staticDepth, menuDepth };
}
