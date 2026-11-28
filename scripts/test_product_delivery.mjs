// Paid-product delivery gate. Run via `npm test`; with --built out it also checks the built site.
//  - every product has a staged download entry; dir is 32 random hex; files exist, sizes match, PDFs start %PDF, zips start PK
//  - delivery files are linked only from the welcome page (page source reads downloads.json) and never from the sitemap or llms files
//  - welcome pages for products are noindex; robots disallows /dl/ and /welcome/
import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import { PRODUCTS } from "../lib/products/products.ts";
import dl from "../lib/products/downloads.json" with { type: "json" };

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };

ok(PRODUCTS.every((p) => dl[p.slug]?.files?.length > 0), "every product has staged download files");
ok(Object.keys(dl).every((s) => PRODUCTS.some((p) => p.slug === s)), "no download entry without a product");
const dirs = Object.values(dl).map((d) => d.dir);
ok(dirs.every((d) => /^[0-9a-f]{32}$/.test(d)) && new Set(dirs).size === dirs.length, "dirs are unique 32-hex");
ok(Object.entries(dl).every(([s]) => !dl[s].dir.includes(s)), "dir does not contain the product slug (unguessable)");
let filesOk = true;
for (const [slug, d] of Object.entries(dl)) {
  for (const f of d.files) {
    const path = `public/dl/${d.dir}/${f.name}`;
    if (!existsSync(path) || statSync(path).size !== f.bytes || f.bytes < 100) { filesOk = false; console.log(`  bad file ${slug} ${f.name}`); continue; }
    const head = readFileSync(path).subarray(0, 4).toString("latin1");
    if (f.name.endsWith(".pdf") && !head.startsWith("%PDF")) { filesOk = false; console.log(`  not a pdf ${f.name}`); }
    if (/\.(zip|docx|xlsx)$/.test(f.name) && !head.startsWith("PK")) { filesOk = false; console.log(`  not a zip container ${f.name}`); }
  }
}
ok(filesOk, "all staged files exist, match recorded size, and have the right magic bytes");
ok(readdirSync("public/dl").every((d) => dirs.includes(d)), "public/dl holds only staged directories (no strays)");
ok(Object.values(dl).every((d) => d.files.every((f) => !/[—–]/.test(f.label))), "no em or en dashes in labels");

const welcome = readFileSync("app/welcome/[slug]/page.tsx", "utf8");
ok(/downloads\.json/.test(welcome) && /index: false/.test(welcome), "welcome page reads downloads.json and is noindex");
const robots = readFileSync("app/robots.ts", "utf8");
ok(robots.includes('"/dl/"') && robots.includes('"/welcome/"'), "robots disallows /dl/ and /welcome/");
const others = ["lib/routes.ts", "app/llms.txt/route.ts", "app/llms-full.txt/route.ts", "app/sitemap.ts", "lib/llmsFacts.ts"].map((f) => readFileSync(f, "utf8")).join("\n");
ok(!/downloads\.json|\/dl\//.test(others), "sitemap, routes and llms sources never reference downloads");

const bi = process.argv.indexOf("--built");
if (bi > 0) {
  const out = process.argv[bi + 1];
  const leaks = ["sitemap.xml", "llms.txt", "llms-full.txt"].filter((f) => existsSync(`${out}/${f}`) && readFileSync(`${out}/${f}`, "utf8").includes("/dl/"));
  ok(leaks.length === 0, `built sitemap and llms files do not list /dl/ (${leaks.join(",") || "clean"})`);
  const missing = Object.entries(dl).filter(([s, d]) => {
    const h = `${out}/welcome/${s}.html`;
    if (!existsSync(h)) return true;
    const t = readFileSync(h, "utf8");
    return !t.includes(`/dl/${d.dir}/`) || !/noindex/.test(t);
  });
  ok(missing.length === 0, `built welcome pages carry links and noindex (${missing.map((m) => m[0]).join(",") || "all 14"})`);
}
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
