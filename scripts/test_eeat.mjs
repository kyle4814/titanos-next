// E-E-A-T lane tests (2026-11-29): bylines, published and reviewed dates on guides and blog,
// editorial policy page, About trust signals, author link in Article JSON-LD.
// Source checks always run; with an out/ build present the built HTML is checked too.
// Run: node --no-warnings scripts/test_eeat.mjs [outDir=out]
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] || "out";
let fail = 0;
const ok = (c, m) => { if (!c) { fail += 1; console.error("FAIL", m); } else console.log("ok  ", m); };
const read = (f) => fs.readFileSync(f, "utf8");

const ed = read("app/editorial-policy/page.tsx");
const title = ed.match(/title:\s*"([^"]+)"/)?.[1] ?? "";
const desc = ed.match(/description:\s*\n?\s*"([^"]+)"/)?.[1] ?? "";
ok(title.length > 0 && title.length <= 60, `editorial title ${title.length} chars (60 or fewer)`);
ok(desc.length >= 120 && desc.length <= 160, `editorial description ${desc.length} chars`);
ok(!/[–—]/.test(ed), "editorial page has no em or en dash");
ok(!/\b(delve|leverage|robust|holistic|landscape|cutting-edge|ecosystem|streamline|synergy)\b/i.test(ed), "editorial page has no AI-tell words");
for (const h of ["/authors/kyle-deligny", "/about", "/methodology", "/trust", "/guides", "/blog", "/glossary"]) ok(ed.includes(`href="${h}"`), `editorial page links ${h}`);
for (const k of ["Who writes and reviews it", "Where the facts come from", "Where AI is used", "Corrections", "last reviewed"]) ok(ed.toLowerCase().includes(k.toLowerCase()), `editorial page covers "${k}"`);
ok(/34 318 502 254/.test(ed) && ed.includes("abr.business.gov.au/ABN/View?id=34318502254"), "editorial page ABN matches the author page and links the ABR");

const about = read("app/about/page.tsx");
ok(about.includes('href="/editorial-policy"') && about.includes('href="/authors/kyle-deligny"'), "about page links editorial policy and author profile");

const blog = read("app/blog/[slug]/page.tsx");
ok(blog.includes('data-eeat="byline"') && blog.includes('rel="author"') && /Last reviewed/.test(blog) && /Published \{formatDate\(post\.date\)\}/.test(blog), "blog post shows byline, published and reviewed dates");
ok(blog.includes('authorPath: "/authors/kyle-deligny"'), "blog Article JSON-LD points at the author page");
const guide = read("app/guides/[slug]/page.tsx");
ok(guide.includes('href="/authors/kyle-deligny"') && /Published \{longDate\(g\.date\)\}/.test(guide) && /Last reviewed/.test(guide), "guide byline links author page with published and reviewed dates");
ok(guide.includes('authorPath: "/authors/kyle-deligny"'), "guide Article JSON-LD points at the author page");
ok(/authorPath \?\? "\/about"/.test(read("lib/jsonld.ts")), "article() keeps /about as the default author url");

// built output (optional)
const built = (r) => [path.join(out, r + ".html"), path.join(out, r, "index.html")].find(fs.existsSync);
if (fs.existsSync(out)) {
  const f = built("editorial-policy");
  ok(!!f, "editorial-policy built");
  if (f) {
    const html = read(f);
    ok((html.match(/<h1[ >]/g) || []).length === 1, "editorial-policy one h1");
    ok(html.includes('rel="canonical" href="https://titanos.tech/editorial-policy"'), "editorial-policy canonical");
  }
  const g = fs.existsSync(path.join(out, "guides")) ? fs.readdirSync(path.join(out, "guides")).find((x) => x.endsWith(".html") && x !== "index.html") : null;
  if (g) {
    const html = read(path.join(out, "guides", g));
    ok(/Last reviewed/.test(html) && html.includes('href="/authors/kyle-deligny"'), `built guide ${g} shows reviewed date and author link`);
  }
} else console.log("note: no out/ directory, built checks skipped");

if (fail) { console.error(`test_eeat: ${fail} failure(s)`); process.exit(1); }
console.log("test_eeat: all passed");
