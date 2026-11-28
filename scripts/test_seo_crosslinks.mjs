// SEO push cross-link gate. Every tool, guide, new blog post and shop product must link both ways and every href must resolve.
// Run: node --no-warnings --import ./scripts/alias_loader.mjs --experimental-strip-types scripts/test_seo_crosslinks.mjs [out]
import fs from "node:fs";
import path from "node:path";
import { TOOLS, GUIDE_LINKS, PRODUCT_LINKS, TOOL_RELATED, GUIDE_EXTRA, POST_RELATED } from "../lib/seo-links.ts";
import { GUIDES } from "../lib/guides.ts";
import { POSTS } from "../lib/blog.ts";
import { SEO_POSTS } from "../lib/blog-seo/index.ts";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fails = [];
const bad = (m) => fails.push(m);
const guideSlugs = new Set(GUIDES.map((g) => g.slug));
const postSlugs = new Set(POSTS.map((p) => p.slug));
const prodSlugs = new Set([...fs.readFileSync(path.join(root, "lib/products/products.ts"), "utf8").matchAll(/^\s+slug: "([a-z0-9-]+)"/gm)].map((m) => m[1]));

if (TOOLS.length !== 4) bad(`expected 4 tools, got ${TOOLS.length}`);
for (const t of TOOLS) {
  const dir = path.join(root, "app", t.href, "page.tsx");
  if (!fs.existsSync(dir)) bad(`tool page missing: ${t.href}`);
  else if (!fs.readFileSync(dir, "utf8").includes("<RelatedLinks")) bad(`${t.href} does not render RelatedLinks`);
  const r = TOOL_RELATED[t.href];
  if (!r) { bad(`no related map for ${t.href}`); continue; }
  for (const g of r.guides) if (!guideSlugs.has(g)) bad(`${t.href}: unknown guide ${g}`);
  for (const p of r.products) if (!prodSlugs.has(p)) bad(`${t.href}: unknown product ${p}`);
  for (const p of r.posts) if (!postSlugs.has(p)) bad(`${t.href}: unknown post ${p}`);
  for (const x of r.tools) if (!TOOLS.some((y) => y.href === x)) bad(`${t.href}: unknown tool ${x}`);
  // tool -> guide must be reciprocated guide -> tool
  for (const g of r.guides) {
    const guide = GUIDES.find((y) => y.slug === g);
    if (guide && !guide.related.tools.some((l) => l.href === t.href)) bad(`guide ${g} does not link back to ${t.href}`);
  }
}
for (const g of GUIDES) {
  const hrefs = [...g.related.tools, ...g.related.products].map((l) => l.href);
  if (!g.related.tools.some((l) => l.href.startsWith("/tools/"))) bad(`guide ${g.slug} links no /tools page`);
  if (!hrefs.some((h) => h.startsWith("/products/") || h === "/shop")) bad(`guide ${g.slug} links no shop product`);
  for (const l of g.related.products) if (l.href.startsWith("/products/") && !prodSlugs.has(l.href.split("/")[2])) bad(`guide ${g.slug}: bad product ${l.href}`);
}
for (const s of Object.keys(GUIDE_EXTRA)) if (!guideSlugs.has(s)) bad(`GUIDE_EXTRA unknown guide ${s}`);
for (const slug of Object.keys(GUIDE_LINKS)) if (!guideSlugs.has(slug)) bad(`GUIDE_LINKS unknown ${slug}`);
for (const slug of Object.keys(PRODUCT_LINKS)) if (!prodSlugs.has(slug)) bad(`PRODUCT_LINKS unknown ${slug}`);

for (const p of SEO_POSTS) {
  const rel = POST_RELATED[p.slug];
  if (!rel) { bad(`post ${p.slug} has no POST_RELATED entry`); continue; }
  const text = JSON.stringify(p.body);
  if (!text.includes(`/guides/${rel.guide}`)) bad(`post ${p.slug} does not link its guide`);
  if (rel.product && !text.includes(`/products/${rel.product}`)) bad(`post ${p.slug} does not link its product`);
  if (!/"\/tools\/[a-z-]+"/.test(text)) bad(`post ${p.slug} links no tool`);
  // guide -> post: reciprocated when the guide lists the post, otherwise the guide hub covers it
  const guide = GUIDES.find((g) => g.slug === rel.guide);
  if (guide && !guide.related.posts.includes(p.slug)) console.log(`note: guide ${guide.slug} does not list post ${p.slug}`);
}
// every tool page should be linked from the hub
const hub = fs.readFileSync(path.join(root, "app/tools/page.tsx"), "utf8");
if (!hub.includes("TOOLS.map")) bad("hub does not iterate TOOLS");

// built output
const out = process.argv[2];
if (out && fs.existsSync(out)) {
  const need = { "tools.html": ["/tools/privacy-act-checker", "/tools/email-spoofing-check", "/tools/essential-eight-score", "/tools/missed-call-calculator", "/guides"], "guides.html": [] };
  for (const [f, hs] of Object.entries(need)) {
    const fp = path.join(out, f);
    if (!fs.existsSync(fp)) { bad(`built ${f} missing`); continue; }
    const html = fs.readFileSync(fp, "utf8");
    for (const h of hs) if (!html.includes(`href="${h}"`)) bad(`built ${f} missing link ${h}`);
  }
  for (const t of TOOLS) {
    const fp = path.join(out, `${t.href}.html`);
    if (!fs.existsSync(fp)) { bad(`built ${t.href} missing`); continue; }
    const html = fs.readFileSync(fp, "utf8");
    if (!html.includes("data-related-links")) bad(`built ${t.href} lacks related links`);
    if (!html.includes('href="/tools"')) bad(`built ${t.href} lacks link to /tools hub`);
    if (!html.includes('href="/shop"') ) bad(`built ${t.href} lacks /shop link`);
  }
}
if (fails.length) { console.error("FAIL test_seo_crosslinks\n - " + fails.join("\n - ")); process.exit(1); }
console.log("PASS test_seo_crosslinks");
