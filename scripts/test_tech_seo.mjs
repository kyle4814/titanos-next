// Technical SEO gate (lane seo/tech-seo-2026-11-28). Reads the static export in out/ (build first).
// Checks: org entity, offers indexing rule, sector noindex, sitemap lastmod on every URL, 404 robots,
// feed autodiscovery, title length on offer pages.
import fs from "node:fs";
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log(`FAIL ${m}`); } else console.log(`PASS ${m}`); };
const rd = (p) => fs.readFileSync(p, "utf8");
const robotsOf = (h) => (h.match(/<meta name="robots" content="([^"]*)"/) || [])[1] || "";
const ld = (h) => [...h.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

// organization entity
const home = rd("out/index.html");
const org = ld(home).find((j) => Array.isArray(j["@type"]) ? j["@type"].includes("ProfessionalService") : j["@type"] === "ProfessionalService");
ok(!!org, "home emits an Organization + ProfessionalService node");
ok(org && org.areaServed && org.areaServed.name === "Australia", "areaServed is Australia");
ok(org && Array.isArray(org.sameAs) && org.sameAs.length >= 1 && org.sameAs.every((u) => /^https:\/\//.test(u)), "sameAs lists https profiles");
ok(org && !("streetAddress" in (org.address || {})), "no street address published");

// offers: indexable iff BUYABLE (offers JSON-LD carries an Offer exactly then)
const dirs = fs.readdirSync("out/offers", { withFileTypes: true }).filter((d) => d.isDirectory() || fs.existsSync(`out/offers/${d.name}`)).map((d) => d.name.replace(/\.html$/, ""));
const slugs = [...new Set(dirs)].filter((s) => fs.existsSync(`out/offers/${s}.html`) || fs.existsSync(`out/offers/${s}/index.html`));
let indexable = 0, bad = 0, longTitle = 0;
const sm = rd("out/sitemap.xml");
for (const s of slugs) {
  const h = rd(fs.existsSync(`out/offers/${s}.html`) ? `out/offers/${s}.html` : `out/offers/${s}/index.html`);
  const idx = !/noindex/.test(robotsOf(h));
  const hasOffer = ld(h).some((j) => j["@type"] === "Product" && j.offers && j.offers.priceCurrency === "AUD");
  const inMap = sm.includes(`<loc>https://titanos.tech/offers/${s}</loc>`);
  if (idx) indexable++;
  if (idx !== hasOffer || idx !== inMap) bad++;
  if (((h.match(/<title>([^<]*)<\/title>/) || [])[1] || "").length > 60) longTitle++;
}
ok(slugs.length > 90, `${slugs.length} offer pages built`);
ok(bad === 0, `indexable offers = offers with a Product Offer = offers in sitemap (${indexable} indexable)`);
ok(indexable >= 20 && indexable <= 40, `${indexable} offers indexable (expected about 29 with live checkout)`);
ok(longTitle === 0, "every offer title is 60 characters or fewer");

// sectors
const secs = fs.readdirSync("out/sectors").filter((f) => f.endsWith(".html") && f !== "index.html");
ok(secs.length >= 10 && secs.every((f) => /noindex/.test(robotsOf(rd(`out/sectors/${f}`)))), "every /sectors/<slug> page is noindex");
ok(!/\/sectors\/[a-z-]+<\/loc>/.test(sm), "no /sectors/<slug> in the sitemap");
ok(/<loc>https:\/\/titanos.tech\/sectors<\/loc>/.test(sm), "the /sectors hub stays in the sitemap");

// sitemap lastmod on every url
const urls = [...sm.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
ok(urls.length > 100 && urls.every((u) => /<lastmod>\d{4}-\d\d-\d\d/.test(u)), `lastmod on all ${urls.length} sitemap URLs`);

// 404: every robots tag says noindex (Next adds its own noindex for not-found; none may say index)
const nf = rd("out/404.html");
const tags = [...nf.matchAll(/<meta name="robots" content="([^"]*)"/g)].map((m) => m[1]);
ok(tags.length >= 1 && tags.every((t) => /noindex/.test(t) && !/(^|,\s*)index(,|$)/.test(t)), `404 robots tags agree on noindex (${tags.join(" | ")})`);

// feed autodiscovery on pages built with withSeo
const faq = rd("out/pricing.html");
ok(/<link rel="alternate" type="application\/rss\+xml"[^>]*href="https:\/\/titanos.tech\/rss.xml"/.test(faq), "feed autodiscovery link on a withSeo page");

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
