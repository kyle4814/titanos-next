// Internal link graph: which routes link to which, counted as DISTINCT SOURCE ROUTES (a page linking twice counts once).
// Contextual links only: the site-wide Nav, Footer and Concierge are excluded on purpose (they appear on every page, so they say nothing about relevance).
// Static source scan, no build needed. Sources, in order of what they render:
//   app/**/page.tsx             -> that route (hrefs in the page file itself)
//   guides (lib/guides.ts)      -> /guides/<slug>: every markup link, related list, next step, plus the "More guides" grid and crumbs
//   blog posts (lib/blog.ts)    -> /blog/<slug>: every p-link, cta and inline markup link, plus relatedSlugs
//   tools (TOOL_RELATED)        -> /tools/<x>: the RelatedLinks block
//   RELATED_BLOCKS (seo-links)  -> the "Related reading" block rendered by components/seo/RelatedReading.tsx
// Run as a library (computeInbound) or: node --no-warnings --import ./scripts/alias_loader.mjs --experimental-strip-types scripts/internal_link_graph.mjs [--json]
import fs from "node:fs";
import path from "node:path";
import { GUIDES } from "../lib/guides.ts";
import { POSTS } from "../lib/blog.ts";
import { TOOLS, TOOL_RELATED, GUIDE_LINKS, PRODUCT_LINKS, SHOP } from "../lib/seo-links.ts";
import { RELATED_BLOCKS } from "../lib/seo-related.ts";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
// lib/products uses extensionless imports Node cannot resolve, so product slugs are read the way test_seo_crosslinks.mjs reads them.
export const PRODUCT_SLUGS = [...fs.readFileSync(path.join(root, "lib/products/products.ts"), "utf8").matchAll(/^\s+slug: "([a-z0-9-]+)"/gm)].map((m) => m[1]);

const norm = (h) => {
  if (!h || !h.startsWith("/") || h.startsWith("//")) return null;
  const p = h.split("#")[0].split("?")[0].replace(/\/+$/, "");
  return p === "" ? "/" : p;
};
/** Every internal href in a blob of source or JSON text. */
export function hrefsIn(text) {
  const out = new Set();
  for (const m of text.matchAll(/\]\((\/[^)\s]*)\)/g)) out.add(norm(m[1]));
  for (const m of text.matchAll(/href\s*[:=]\s*\{?\s*["'`](\/[^"'`]*)["'`]/g)) out.add(norm(m[1]));
  for (const m of text.matchAll(/"href":"(\/[^"]*)"/g)) out.add(norm(m[1]));
  return [...out].filter(Boolean);
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name === "page.tsx") acc.push(p);
  }
  return acc;
}

/** edges: Map<sourceRoute, Set<targetRoute>> */
export function buildEdges() {
  const edges = new Map();
  const add = (src, targets) => {
    if (!edges.has(src)) edges.set(src, new Set());
    for (const t of targets) if (t && t !== src) edges.get(src).add(t);
  };
  // 1. static page files (dynamic [slug] pages are handled below)
  for (const f of walk(path.join(root, "app"))) {
    const rel = path.relative(path.join(root, "app"), path.dirname(f)).split(path.sep).join("/");
    if (rel.includes("[")) continue;
    const route = rel === "" ? "/" : "/" + rel;
    add(route, hrefsIn(fs.readFileSync(f, "utf8")));
  }
  // 2. guides
  for (const g of GUIDES) {
    const route = `/guides/${g.slug}`;
    add(route, hrefsIn(JSON.stringify(g)));
    add(route, ["/", "/guides", "/about", ...GUIDES.map((o) => `/guides/${o.slug}`), ...g.related.posts.map((s) => `/blog/${s}`)]);
  }
  // 3. blog posts
  for (const p of POSTS) {
    const route = `/blog/${p.slug}`;
    add(route, hrefsIn(JSON.stringify(p.body)));
    add(route, (p.relatedSlugs ?? []).map((s) => `/blog/${s}`));
  }
  // 4. tools (RelatedLinks block)
  for (const [route, r] of Object.entries(TOOL_RELATED)) {
    add(route, [...r.guides.map((s) => GUIDE_LINKS[s].href), ...r.products.map((s) => PRODUCT_LINKS[s].href), ...r.tools, ...r.posts.map((s) => `/blog/${s}`), SHOP.href, "/tools"]);
  }
  // 5. product pages: the page template links /scan, /products, /terms; plus the related block
  for (const s of PRODUCT_SLUGS) add(`/products/${s}`, ["/scan", "/products", "/terms"]);
  // 5b. hubs that list everything: /products grid, /guides grid, /tools grid
  add("/products", PRODUCT_SLUGS.map((s) => `/products/${s}`));
  add("/guides", GUIDES.map((g) => `/guides/${g.slug}`));
  add("/tools", TOOLS.map((t) => t.href));
  // 6. related-reading blocks (lib/seo-related.ts)
  for (const [route, blocks] of Object.entries(RELATED_BLOCKS)) add(route, blocks.flatMap((b) => b.links.map((l) => l.href)));
  return edges;
}

export function computeInbound(edges = buildEdges()) {
  const inbound = new Map();
  for (const [src, ts] of edges) for (const t of ts) {
    if (!inbound.has(t)) inbound.set(t, new Set());
    inbound.get(t).add(src);
  }
  return inbound;
}

export function moneyRoutes() {
  return [
    "/pricing", "/scan", "/audit", "/contact", "/products",
    ...PRODUCT_SLUGS.map((s) => `/products/${s}`),
    ...GUIDES.map((g) => `/guides/${g.slug}`),
  ];
}

if (process.argv[1] && process.argv[1].endsWith("internal_link_graph.mjs")) {
  const inbound = computeInbound();
  const rows = moneyRoutes().map((r) => [r, inbound.get(r)?.size ?? 0]);
  if (process.argv.includes("--json")) console.log(JSON.stringify(Object.fromEntries(rows), null, 2));
  else for (const [r, n] of rows) console.log(String(n).padStart(3), r);
}
