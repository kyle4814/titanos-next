// Internal linking gate (SEO lane internal-links, 2026-11-29).
// Every money page and every guide must have at least MIN distinct contextual inbound source routes (Nav and Footer excluded),
// every related-reading link must resolve to a real route with a descriptive anchor, and the block must be mounted.
// Run: node --no-warnings --import ./scripts/alias_loader.mjs --experimental-strip-types scripts/test_internal_links.mjs
import fs from "node:fs";
import path from "node:path";
import { GUIDES } from "../lib/guides.ts";
import { TOOLS } from "../lib/seo-links.ts";
import { RELATED_BLOCKS } from "../lib/seo-related.ts";
import { buildEdges, computeInbound, moneyRoutes, PRODUCT_SLUGS } from "./internal_link_graph.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MIN = 5;
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };

const edges = buildEdges();
const inbound = computeInbound(edges);

// 1. minimum inbound links
for (const r of moneyRoutes()) {
  const n = inbound.get(r)?.size ?? 0;
  ok(n >= MIN, `${r} has ${n} inbound source routes (min ${MIN})`);
}
// /services is a noindex meta-refresh stub that canonicals to /audit, so it is not a link target: /audit carries the weight.
const svc = fs.readFileSync(path.join(root, "app/services/page.tsx"), "utf8");
ok(/httpEquiv="refresh"[^>]*url=\/audit/.test(svc) && /canonical: "https:\/\/titanos\.tech\/audit"/.test(svc), "/services is a redirect stub to /audit (so /audit is counted instead)");
ok(fs.existsSync(path.join(root, "app/pricing/page.tsx")) && fs.existsSync(path.join(root, "app/contact/page.tsx")), "/pricing and /contact pages exist");

// 2. related-reading data is well formed
const guideSlugs = new Set(GUIDES.map((g) => g.slug));
const toolHrefs = new Set(TOOLS.map((t) => t.href));
const routeOk = (h) => {
  if (h.startsWith("/guides/")) return guideSlugs.has(h.slice(8));
  if (h.startsWith("/products/")) return PRODUCT_SLUGS.includes(h.slice(10));
  if (h.startsWith("/tools/")) return toolHrefs.has(h);
  return fs.existsSync(path.join(root, "app", h, "page.tsx"));
};
const GENERIC = /^(here|click here|read more|more|link|this|learn more|see more|page)$/i;
for (const [route, blocks] of Object.entries(RELATED_BLOCKS)) {
  const seen = new Set();
  let bad = [];
  for (const b of blocks) for (const l of b.links) {
    if (!routeOk(l.href)) bad.push(`unresolved ${l.href}`);
    if (l.href === route) bad.push(`self link ${l.href}`);
    if (seen.has(l.href)) bad.push(`duplicate ${l.href}`);
    seen.add(l.href);
    if (GENERIC.test(l.label.trim()) || l.label.trim().split(/\s+/).length < 2) bad.push(`weak anchor "${l.label}"`);
  }
  ok(bad.length === 0, `${route} related block clean (${seen.size} links)${bad.length ? ": " + bad.join("; ") : ""}`);
}
ok(Object.keys(RELATED_BLOCKS).filter((k) => k.startsWith("/guides/")).length === GUIDES.length, "every guide has a related block");
const covered = PRODUCT_SLUGS.filter((s) => RELATED_BLOCKS[`/products/${s}`]);
ok(covered.length === PRODUCT_SLUGS.length, `every product has a related block (${covered.length}/${PRODUCT_SLUGS.length})`);

// 3. mounted on the real pages
for (const f of ["app/guides/[slug]/page.tsx", "app/products/[slug]/page.tsx"]) {
  ok(fs.readFileSync(path.join(root, f), "utf8").includes("<RelatedReading"), `${f} renders RelatedReading`);
}

// 4. copy rules on the new data file
const copy = fs.readFileSync(path.join(root, "lib/seo-related.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
ok(!/[–—]/.test(copy), "no em or en dashes in related copy");
ok(!/\b(delve|leverage|robust|holistic|landscape|cutting-edge|ecosystem|streamline|synergy)\b/i.test(copy), "no banned words in related copy");
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
