// Gate for /privacy-act and /privacy-act/[obligation]. Source checks always run; built-HTML checks run when out/ exists
// (pass --built out to require it). Run: node --experimental-strip-types scripts/test_privacy_act_pages.mjs [--built out]
import fs from "node:fs";
import path from "node:path";
import { OBLIGATIONS, HUB } from "../lib/privacyObligations.ts";

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log(`FAIL ${m}`); } else console.log(`PASS ${m}`); };
const words = (s) => s.split(/\s+/).filter(Boolean).length;
const bodyText = (o) => [o.answer, ...o.appliesTo, ...o.requires.flatMap((r) => [r.heading, r.body]), o.example.scenario, ...o.example.walk, o.example.takeaway, ...o.checklist, ...o.traps, ...o.faq.flatMap((f) => [f.q, f.a])].join(" ");

ok(OBLIGATIONS.length === 6, "six obligations");
const titles = new Set(), descs = new Set();
for (const o of OBLIGATIONS) {
  const t = bodyText(o);
  ok(o.title.length <= 60, `${o.slug}: title ${o.title.length} chars (<=60)`);
  ok(o.description.length >= 140 && o.description.length <= 160, `${o.slug}: description ${o.description.length} chars (140-160)`);
  ok(words(t) >= 600, `${o.slug}: ${words(t)} words (>=600)`);
  ok(!/[–—]/.test(JSON.stringify(o)), `${o.slug}: no em or en dashes`);
  ok(o.sources.length >= 2 && o.sources.every((s) => /^https:\/\/www\.(legislation|oaic)\.gov\.au\//.test(s.url)), `${o.slug}: primary sources only`);
  ok(o.faq.length >= 3 && o.checklist.length >= 6, `${o.slug}: faq and checklist present`);
  titles.add(o.title); descs.add(o.description);
}
ok(titles.size === 6 && descs.size === 6, "titles and descriptions unique");
// at least 40% of each body differs from every sibling: share of 6-word shingles not found in any sibling
const sh = (s) => { const w = s.toLowerCase().replace(/[^a-z0-9$ ]/g, " ").split(/\s+/).filter(Boolean); const r = new Set(); for (let i = 0; i + 6 <= w.length; i++) r.add(w.slice(i, i + 6).join(" ")); return r; };
const sets = OBLIGATIONS.map((o) => sh(bodyText(o)));
sets.forEach((a, i) => { const others = new Set(); sets.forEach((b, j) => j !== i && b.forEach((x) => others.add(x))); let uniq = 0; a.forEach((x) => { if (!others.has(x)) uniq++; }); ok(uniq / a.size >= 0.9, `${OBLIGATIONS[i].slug}: ${(100 * uniq / a.size).toFixed(0)}% unique 6-word shingles (>=90%, bar is 40%)`); });
ok(HUB.title.length <= 60 && HUB.description.length >= 140 && HUB.description.length <= 160, "hub title and description lengths");

const argI = process.argv.indexOf("--built");
const OUT = argI > 0 ? process.argv[argI + 1] : "out";
const pf = (r) => [path.join(OUT, r, "index.html"), path.join(OUT, `${r}.html`)].find((f) => fs.existsSync(f));
if (pf("privacy-act")) {
  const routes = [["privacy-act", HUB.title], ...OBLIGATIONS.map((o) => [`privacy-act/${o.slug}`, o.title])];
  for (const [r, title] of routes) {
    const f = pf(r);
    ok(!!f, `built: ${r}`);
    if (!f) continue;
    const h = fs.readFileSync(f, "utf8");
    ok(h.includes(`<title>${title.replace(/&/g, "&amp;")}</title>`), `built ${r}: title`);
    ok(/<meta name="description" content="[^"]{140,160}"/.test(h), `built ${r}: description 140-160`);
    ok(h.includes(`<link rel="canonical" href="https://titanos.tech/${r}"`), `built ${r}: canonical`);
    ok((h.match(/<h1[ >]/g) || []).length === 1, `built ${r}: exactly one h1`);
    const ld = [...h.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });
    ok(ld.length >= 3 && ld.every(Boolean), `built ${r}: ${ld.length} JSON-LD blocks parse`);
    const types = ld.filter(Boolean).map((x) => x["@type"]);
    ok(["Article", "BreadcrumbList", "FAQPage"].every((t) => types.includes(t)), `built ${r}: Article, BreadcrumbList, FAQPage`);
    ok(/href="\/tools\/privacy-act-checker"/.test(h) && /href="\/shop"/.test(h) && /href="\/compliance"/.test(h), `built ${r}: checker, shop and compliance links`);
    ok(/lang="en-AU"|lang="en"/.test(h), `built ${r}: lang attribute`);
  }
} else if (argI > 0) ok(false, "built output required but missing");
else console.log("SKIP built checks (no out/privacy-act)");
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
