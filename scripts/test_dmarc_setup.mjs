// Gate for /email-security/setup (hub + 9 provider pages), 2026-11-28.
// Data checks always run (lib/dmarcSetup.ts); built-page checks run when an export exists.
// Usage: node --experimental-strip-types scripts/test_dmarc_setup.mjs [outDir=out]
import fs from "node:fs";
import { PROVIDERS, HUB, ROLLOUT, providerPath, DMARC_SETUP_BASE } from "../lib/dmarcSetup.ts";
const out = process.argv[2] || "out";
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; return c; };
const dash = /[–—]/;
const tells = /\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|ecosystem)\b/i;

ok(PROVIDERS.length === 9, "nine providers");
ok(ROLLOUT.length === 4, "four rollout stages");
const metas = [{ slug: "(hub)", title: HUB.title, description: HUB.description }, ...PROVIDERS];
for (const m of metas) {
  ok(m.title.length <= 60, `${m.slug} title <= 60 (${m.title.length})`);
  ok(m.description.length >= 140 && m.description.length <= 160, `${m.slug} description 140-160 (${m.description.length})`);
}
ok(new Set(metas.map((m) => m.title)).size === metas.length, "unique titles");
ok(new Set(metas.map((m) => m.description)).size === metas.length, "unique descriptions");
ok(!dash.test(JSON.stringify([PROVIDERS, HUB, ROLLOUT])), "no em or en dashes in copy");
ok(!tells.test(JSON.stringify([PROVIDERS, HUB, ROLLOUT])), "no AI-tell words");
for (const p of PROVIDERS) {
  ok(p.sources.length >= 2 && p.sources.every((s) => /^https:\/\//.test(s.url)), `${p.slug} cites at least 2 https sources`);
  ok(p.related.length === 3 && p.related.every((r) => PROVIDERS.some((q) => q.slug === r && q.slug !== p.slug)), `${p.slug} links 3 valid siblings`);
  ok(p.faq.length >= 3, `${p.slug} has FAQ`);
}

if (fs.existsSync(`${out}/index.html`)) {
  const pages = [[DMARC_SETUP_BASE, "(hub)"], ...PROVIDERS.map((p) => [providerPath(p.slug), p.slug])];
  const bodies = [];
  for (const [path, label] of pages) {
    const file = `${out}${path}.html`;
    const alt = `${out}${path}/index.html`;
    const f = fs.existsSync(file) ? file : alt;
    if (!ok(fs.existsSync(f), `${label} built`)) continue;
    const html = fs.readFileSync(f, "utf8");
    const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    ok(canon === `https://titanos.tech${path}`, `${label} canonical is self (${canon})`);
    ok(/<title>[^<]{10,}<\/title>/.test(html), `${label} has a title`);
    ok(/<meta name="description" content="[^"]{120,}"/.test(html), `${label} has a description`);
    ok(/<html[^>]*lang="en-AU"/.test(html), `${label} lang en-AU`);
    ok((html.match(/<h1[ >]/g) || []).length === 1, `${label} one h1`);
    const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });
    ok(lds.every(Boolean), `${label} all JSON-LD parses`);
    const types = lds.filter(Boolean).map((l) => l["@type"]);
    for (const t of ["Article", "FAQPage", "BreadcrumbList"]) ok(types.includes(t), `${label} JSON-LD has ${t}`);
    if (label !== "(hub)") ok(types.includes("HowTo"), `${label} JSON-LD has HowTo`);
    const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
    const words = text.split(" ").length;
    ok(words >= 600, `${label} at least 600 words (${words})`);
    ok(html.includes('href="/tools/email-spoofing-check"') && html.includes('href="/shop"') && html.includes('href="/audit"') && html.includes('href="/about"'), `${label} links check tool, shop, audit, about`);
    ok(/Last reviewed/.test(text) && /Kyle Deligny/.test(text), `${label} named author and review date`);
    bodies.push([label, new Set(text.toLowerCase().split(/(?<=[.!?])\s+/).filter((x) => x.length > 40))]);
  }
  // uniqueness: share of each page's sentences that appear on no sibling page
  for (const [label, set] of bodies) {
    if (label === "(hub)") continue;
    let unique = 0;
    for (const sent of set) if (!bodies.some(([l2, s2]) => l2 !== label && s2.has(sent))) unique++;
    const share = set.size ? unique / set.size : 0;
    ok(share >= 0.4, `${label} at least 40% of sentences unique to the page (${(share * 100).toFixed(0)}%)`);
  }
} else {
  console.log("SKIP built-page checks (no export at " + out + ")");
}
process.exit(fail);
