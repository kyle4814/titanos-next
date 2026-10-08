// SEO gate. Fails when any indexable route lacks title, description, canonical or OG/Twitter image,
// when a card file is missing, when headings are broken, when structured data is invalid or the
// sitemap / robots / llms.txt disagree with the pages, or when a page is an internal-link orphan.
// Builds first if out/ is absent. Run via `npm test`.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { audit, problems, SITE } from "./seo_audit.mjs";
import { linkMap } from "./link_map.mjs";

const OUT = "out";
if (!fs.existsSync(path.join(OUT, "sitemap.xml")) || !fs.existsSync(path.join(OUT, "og"))) {
  console.log("test_seo: out/ missing, building");
  execSync("npm run build", { stdio: "ignore" });
}

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log(`FAIL ${m}`); } else console.log(`PASS ${m}`); };

// the gate must actually fail: a route missing each required tag is reported
const good = { route: "/x", noindex: false, title: "T", description: "D", canonical: SITE + "/x", ogImage: "/og/x.png", twImage: "/og/x.png", headings: [1, 2], jsonld: [] };
ok(problems([good]).length === 0, "self-test: a complete route passes");
for (const k of ["title", "description", "canonical", "ogImage", "twImage"]) ok(problems([{ ...good, [k]: undefined }]).length === 1, `self-test: a route lacking ${k} fails`);
ok(problems([{ ...good, headings: [2, 2] }]).length === 1, "self-test: a route with no h1 fails");
ok(problems([{ ...good, headings: [1, 4] }]).length === 1, "self-test: a heading skip fails");

const rows = audit(OUT);
const indexable = rows.filter((r) => !r.noindex);
ok(indexable.length >= 100, `${indexable.length} indexable routes found`);

const bad = problems(rows);
ok(bad.length === 0, `every indexable route has title, description, canonical, og:image, twitter:image, one h1 and no heading skips${bad.length ? ": " + bad.slice(0, 8).map((b) => `${b.route} [${b.bad.join("; ")}]`).join(" | ") : ""}`);

const missingCards = indexable.filter((r) => {
  const file = (r.ogImage || "").replace(SITE, "");
  return !file.startsWith("/") || !fs.existsSync(path.join(OUT, file));
});
ok(missingCards.length === 0, `every og:image file exists in out/${missingCards.length ? ": " + missingCards.slice(0, 5).map((r) => r.route).join(", ") : ""}`);
ok(indexable.every((r) => (r.title || "").length <= 130), "titles under 130 characters");
const titles = new Map();
for (const r of indexable) titles.set(r.title, [...(titles.get(r.title) || []), r.route]);
const dup = [...titles].filter(([, v]) => v.length > 1);
ok(dup.length === 0, `no two indexable routes share a title${dup.length ? ": " + dup.slice(0, 3).map(([t, v]) => `${v.join(",")}`).join(" | ") : ""}`);

// structured data parses, and uses the types the spec names
const types = new Set();
let badLd = 0;
for (const r of rows) for (const j of r.jsonld) { try { const o = JSON.parse(j); types.add(o["@type"]); } catch { badLd++; } }
ok(badLd === 0, "every JSON-LD block parses");
for (const t of ["Organization", "WebSite", "Product", "FAQPage", "Article"]) ok(types.has(t), `JSON-LD ${t} emitted somewhere`);
const home = rows.find((r) => r.route === "/");
ok(home.jsonld.filter((j) => JSON.parse(j)["@type"] === "Organization").length === 1, "home has exactly one Organization block");

// sitemap = exactly the indexable routes
const sm = fs.readFileSync(path.join(OUT, "sitemap.xml"), "utf8");
const urls = new Set([...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/\/$/, "")));
const want = new Set(indexable.map((r) => SITE + (r.route === "/" ? "" : r.route)));
const missing = [...want].filter((u) => !urls.has(u));
const extra = [...urls].filter((u) => !want.has(u));
ok(missing.length === 0, `sitemap lists every indexable page${missing.length ? ": missing " + missing.slice(0, 5).join(", ") : ""}`);
ok(extra.length === 0, `sitemap lists no noindex or unknown page${extra.length ? ": " + extra.slice(0, 5).join(", ") : ""}`);

const robots = fs.readFileSync(path.join(OUT, "robots.txt"), "utf8");
ok(/Sitemap: https:\/\/titanos\.tech\/sitemap\.xml/.test(robots), "robots.txt points at the sitemap");
ok(/User-Agent: GPTBot/i.test(robots) && /User-Agent: ClaudeBot/i.test(robots), "robots.txt names the AI crawlers");

const llms = fs.readFileSync(path.join(OUT, "llms.txt"), "utf8");
ok(llms.startsWith("# TITANOS"), "llms.txt present");
const llmsLinks = [...llms.matchAll(/\]\((https:\/\/titanos\.tech[^)]*)\)/g)].map((m) => m[1].replace(/\/$/, ""));
const deadLlms = llmsLinks.filter((u) => u !== SITE + "/sitemap.xml" && !want.has(u));
ok(deadLlms.length === 0, `every llms.txt link is a real page${deadLlms.length ? ": " + deadLlms.join(", ") : ""}`);
ok(/MEASURED/.test(llms) && /MODELLED/.test(llms), "llms.txt receipts carry evidence labels");
ok(!/[–—]/.test(llms), "llms.txt has no em or en dashes");

const { orphans, broken } = linkMap(OUT);
ok(orphans.length === 0, `no orphan pages${orphans.length ? ": " + orphans.join(", ") : ""}`);
ok(broken.length === 0, `no broken internal links${broken.length ? ": " + broken.slice(0, 5).map((b) => b.join("->")).join(", ") : ""}`);

console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
