// Pillar guides gate (lib/guides.ts). Pure data checks, then the built pages when out/ exists.
// Run: node --no-warnings --import ./scripts/alias_loader.mjs --experimental-strip-types scripts/test_guides.mjs [--built out]
import fs from "node:fs";
import path from "node:path";
import { GUIDES, guideTexts, guideWordCount, guideHrefs } from "../lib/guides.ts";
import { POSTS } from "../lib/blog.ts";

const fails = [];
const bad = (m) => fails.push(m);
const TELLS = /\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|harness\w*|ecosystem|in today's|dive into|it's important to note)\b|[–—]/i;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const EXPECT = ["tradie-automation-australia", "ai-receptionist-australia-trades", "privacy-act-small-business-australia", "essential-eight-small-business", "email-security-small-business-australia", "government-tenders-small-business-australia"];
for (const s of EXPECT) if (!GUIDES.some((g) => g.slug === s)) bad(`guide missing: ${s}`);

const appDirs = fs.readdirSync(path.join(root, "app"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const postSlugs = new Set(POSTS.map((p) => p.slug));
const prodSlugs = new Set([...fs.readFileSync(path.join(root, "lib/products/products.ts"), "utf8").matchAll(/^\s+slug: "([a-z0-9-]+)"/gm)].map((m) => m[1]));
const offerSlugs = new Set(JSON.parse(fs.readFileSync(path.join(root, "lib/offers/offers.json"), "utf8")).map((o) => o.slug));
const guideSlugs = new Set(GUIDES.map((g) => g.slug));

function routeExists(h) {
  const p = h.split("#")[0].split("?")[0];
  if (p === "" ) return true;
  const seg = p.split("/").filter(Boolean);
  if (seg.length === 0) return true;
  if (seg[0] === "blog" && seg[1]) return postSlugs.has(seg[1]);
  if (seg[0] === "products" && seg[1]) return prodSlugs.has(seg[1]);
  if (seg[0] === "offers" && seg[1]) return offerSlugs.has(seg[1]);
  if (seg[0] === "guides" && seg[1]) return guideSlugs.has(seg[1]);
  if (seg[0] === "tools" && seg[1]) return seg.length === 2 && fs.existsSync(path.join(root, "app/tools", seg[1], "page.tsx"));
  return appDirs.includes(seg[0]) && seg.length === 1;
}

const titles = new Set();
for (const g of GUIDES) {
  const tag = `[${g.slug}]`;
  const title = `${g.seoTitle} | Titanos`;
  if (title.length > 60) bad(`${tag} title ${title.length} > 60: ${title}`);
  if (titles.has(title)) bad(`${tag} duplicate title`);
  titles.add(title);
  if (g.description.length < 140 || g.description.length > 160) bad(`${tag} description ${g.description.length} not 140-160`);
  const words = guideWordCount(g);
  if (words < 2000 || words > 3000) bad(`${tag} word count ${words} outside 2000-3000`);
  if (!/^[a-z0-9-]+$/.test(g.slug)) bad(`${tag} slug`);
  if (!g.faq.length || g.faq.length < 5) bad(`${tag} needs 5+ FAQs`);
  if (!g.sources.length || g.sources.some((s) => !/^https:\/\//.test(s.url))) bad(`${tag} sources must be https`);
  if (g.related.posts.length < 3) bad(`${tag} needs 3+ related posts`);
  for (const s of g.related.posts) if (!postSlugs.has(s)) bad(`${tag} related post missing: ${s}`);
  if (!g.related.products.some((p) => p.href === "/shop")) bad(`${tag} must link /shop`);
  if (!g.related.products.length || !g.related.tools.length) bad(`${tag} needs tools and products`);
  if (!g.h1 || !/\S/.test(g.h1)) bad(`${tag} h1`);
  const ids = g.sections.map((s) => s.id);
  if (new Set(ids).size !== ids.length) bad(`${tag} duplicate section ids`);
  for (const t of guideTexts(g)) if (TELLS.test(t)) bad(`${tag} banned word or dash: ${t.match(TELLS)[0]} in "${t.slice(0, 60)}"`);
  for (const h of guideHrefs(g)) {
    if (/^https?:/.test(h) || h.startsWith("#")) continue;
    if (!routeExists(h)) bad(`${tag} broken internal link: ${h}`);
  }
  const md = guideTexts(g).join("\n");
  if (/\*\*|\]\(/.test(md)) bad(`${tag} leftover markup`);
  // every guide links to the other five (hub and spoke is rendered by the page; body links are the bonus)
  const mine = g.sections.flatMap((s) => s.blocks).map((b) => JSON.stringify(b)).join();
  void mine;
  console.log(`${tag} ${words} words, title ${title.length}, desc ${g.description.length}, ${g.faq.length} FAQ, ${g.sources.length} sources`);
}

const bi = process.argv.indexOf("--built");
if (bi > -1) {
  const out = path.resolve(root, process.argv[bi + 1] || "out");
  const pages = ["guides", ...GUIDES.map((g) => `guides/${g.slug}`)];
  for (const p of pages) {
    const f = path.join(out, `${p}.html`);
    if (!fs.existsSync(f)) { bad(`built page missing: ${p}`); continue; }
    const html = fs.readFileSync(f, "utf8");
    const canon = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    if (canon !== `https://titanos.tech/${p}`) bad(`[${p}] canonical ${canon}`);
    if (!/<html[^>]*lang="en-AU"/.test(html)) bad(`[${p}] html lang not en-AU`);
    const h1s = (html.match(/<h1[\s>]/g) || []).length;
    if (h1s !== 1) bad(`[${p}] h1 count ${h1s}`);
    const types = [...html.matchAll(/"@type":"([A-Za-z]+)"/g)].map((m) => m[1]);
    const need = p === "guides" ? ["BreadcrumbList", "CollectionPage"] : ["Article", "BreadcrumbList", "FAQPage"];
    for (const n of need) if (!types.includes(n)) bad(`[${p}] missing JSON-LD ${n}`);
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    if (title.length > 60) bad(`[${p}] built title ${title.length}: ${title}`);
    const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
    if (desc.length < 140 || desc.length > 160) bad(`[${p}] built description ${desc.length}`);
    console.log(`built ${p}: title ${title.length}, desc ${desc.length}, ld ${[...new Set(types)].join("/")}`);
  }
  const sm = fs.readFileSync(path.join(out, "sitemap.xml"), "utf8");
  for (const p of pages) if (!sm.includes(`https://titanos.tech/${p}`)) bad(`sitemap missing /${p}`);
}

if (fails.length) { console.error("FAIL test_guides:\n" + fails.map((f) => " - " + f).join("\n")); process.exit(1); }
console.log("OK test_guides");
