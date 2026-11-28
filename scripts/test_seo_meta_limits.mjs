// Technical SEO regression gate (lane seo20/tech-audit, 2026-11-29).
// Source level, so it runs without a Next build: title <= 60, description <= 160, every indexable page goes through
// withSeo (canonical, Open Graph, Twitter, en_AU), the Demonblade Labs static pages carry the same tags, en-AU lang.
// With an `out` argument it also checks the built HTML of every indexable page.
// Run: node --no-warnings --import ./scripts/alias_loader.mjs --experimental-strip-types scripts/test_seo_meta_limits.mjs [out]
import fs from "node:fs";
import path from "node:path";
import { clipTitle, clipDescription, withSeo } from "../lib/seo.ts";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log(`FAIL ${m}`); } else console.log(`PASS ${m}`); };
const rd = (p) => fs.readFileSync(path.join(root, p), "utf8");

// 1. the clippers keep their promise on awkward input
const long = "Privacy Act small business deadline: what a sole trader with an annual turnover under three million needs to know now | Titanos";
ok(clipTitle(long).length <= 60, `clipTitle fits a very long title (${clipTitle(long).length})`);
ok(clipTitle("Short title | TITANOS") === "Short title | TITANOS", "clipTitle leaves a short title alone");
ok(clipTitle("Compliance Monitor for small business email security and DMARC checks | TITANOS").length <= 60, "clipTitle drops the brand suffix before cutting");
ok(!/[|·]\s*$/.test(clipTitle(long)) && !/[,:;-]\s*$/.test(clipTitle(long)), "clipTitle never ends on punctuation");
for (const n of [150, 159, 160, 161, 162, 170, 400]) {
  const d = ("word ".repeat(100)).slice(0, n);
  ok(clipDescription(d).length <= 160, `clipDescription(${n} chars) is at most 160`);
}
ok(clipDescription("A".repeat(10) + " " + "b".repeat(300)).length <= 160, "clipDescription handles one huge word");
const meta = withSeo("/x", { title: long, description: "word ".repeat(80) });
ok(typeof meta.title === "string" && meta.title.length <= 60, "withSeo clips the page title");
ok(meta.description.length <= 160, "withSeo clips the description");
ok(meta.alternates.canonical === "https://titanos.tech/x" && meta.openGraph.url === "https://titanos.tech/x" && meta.openGraph.locale === "en_AU", "withSeo sets canonical, og:url, en_AU");
ok(meta.twitter.card === "summary_large_image" && meta.twitter.title === meta.title, "withSeo sets the twitter card and title");

// 2. every app page that is indexable goes through withSeo (a page that skips it loses og:url and the Twitter tags)
const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else if (e.name === "page.tsx") pages.push(p);
  }
})(path.join(root, "app"));
const skipped = [];
for (const f of pages) {
  const t = fs.readFileSync(f, "utf8");
  if (!/export (const metadata|async function generateMetadata)/.test(t)) continue;
  if (/index:\s*false/.test(t)) continue;
  // /hud writes the full canonical, Open Graph and Twitter set by hand around its own live card image
  if (!/withSeo\(/.test(t) && !(/canonical/.test(t) && /openGraph/.test(t) && /twitter:\s*\{/.test(t) && /url: "https:\/\/titanos\.tech\//.test(t))) skipped.push(path.relative(root, f));
}
ok(skipped.length === 0, `every indexable page with metadata uses withSeo${skipped.length ? ": " + skipped.join(", ") : ""}`);

// 3. no page.tsx emits more than one h1 in its own source (shared components carry the rest)
const multiH1 = pages.map((f) => [path.relative(root, f), (fs.readFileSync(f, "utf8").match(/<h1[\s>]/g) || []).length]).filter(([, n]) => n > 1);
ok(multiH1.length === 0, `no page.tsx renders two literal h1 elements${multiH1.length ? ": " + multiH1.map((x) => x[0]).join(", ") : ""}`);

// 4. Demonblade Labs static pages: en-AU, title <= 60, description <= 160, robots, canonical, Open Graph, Twitter
const labs = ["public/labs/index.html", "public/labs/issue-001/scorecard/index.html"];
for (const d of fs.readdirSync(path.join(root, "public/labs"))) if (d.startsWith("issue-")) labs.push(`public/labs/${d}/index.html`);
for (const f of labs) {
  const h = rd(f);
  const g = (re) => (h.match(re) || [])[1] || "";
  const title = g(/<title>([^<]*)<\/title>/), desc = g(/<meta name="description" content="([^"]*)"/);
  const bad = [];
  if (!/<html lang="en-AU"[ >]/.test(h)) bad.push("lang");
  if (!title || title.length > 60) bad.push(`title ${title.length}`);
  if (!desc || desc.length > 160) bad.push(`description ${desc.length}`);
  if (!/<meta name="robots" content="index, follow">/.test(h)) bad.push("robots");
  if (!/<link rel="canonical" href="https:\/\/titanos\.tech\/labs/.test(h)) bad.push("canonical");
  for (const k of ["og:title", "og:description", "og:url", "og:image"]) if (!new RegExp(`<meta property="${k}" content="[^"]+"`).test(h)) bad.push(k);
  for (const k of ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]) if (!new RegExp(`<meta name="${k}" content="[^"]+"`).test(h)) bad.push(k);
  if ((h.match(/<h1[\s>]/g) || []).length !== 1) bad.push("h1 count");
  if (/[–—]/.test(title + desc)) bad.push("dash in title or description");
  ok(bad.length === 0, `${f.replace("public/", "")} head tags${bad.length ? " [" + bad.join("; ") + "]" : ""}`);
}

// 5. built output, when given: every indexable page
const out = process.argv[2];
if (out && fs.existsSync(path.join(out, "sitemap.xml"))) {
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "_next" && e.name !== "_not-found") walk(p); } else if (e.name.endsWith(".html")) files.push(p);
    }
  })(out);
  const sm = fs.readFileSync(path.join(out, "sitemap.xml"), "utf8");
  const problems = [];
  let n = 0;
  for (const f of files) {
    const h = fs.readFileSync(f, "utf8");
    const g = (re) => (h.match(re) || [])[1] || "";
    if (/noindex/i.test(g(/<meta name="robots" content="([^"]*)"/))) continue;
    let route = "/" + path.relative(out, f).replace(/\\/g, "/").replace(/\.html$/, "").replace(/\/index$/, "");
    route = route === "/" || route === "/index" ? "/" : route.replace(/\/$/, "");
    n++;
    const bad = [];
    const dec = (x) => x.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    const title = dec(g(/<title>([^<]*)<\/title>/)), desc = dec(g(/<meta name="description" content="([^"]*)"/));
    if (title.length > 60) bad.push(`title ${title.length}`);
    if (desc.length > 160) bad.push(`description ${desc.length}`);
    if (!/<html[^>]*lang="en-AU"/.test(h)) bad.push("lang");
    for (const k of ["og:title", "og:description", "og:url"]) if (!g(new RegExp(`<meta property="${k}" content="([^"]*)"`))) bad.push(k);
    for (const k of ["twitter:card", "twitter:title", "twitter:description"]) if (!g(new RegExp(`<meta name="${k}" content="([^"]*)"`))) bad.push(k);
    if (!g(/<meta name="robots" content="([^"]*)"/)) bad.push("robots");
    if (!sm.includes(`<loc>https://titanos.tech${route === "/" ? "/" : route}</loc>`)) bad.push("not in sitemap");
    if (bad.length) problems.push(`${route} [${bad.join("; ")}]`);
  }
  ok(n >= 100 && problems.length === 0, `built: ${n} indexable pages carry limits, tags and sitemap entry${problems.length ? ": " + problems.slice(0, 8).join(" | ") : ""}`);
}

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
