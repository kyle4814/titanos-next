// Trade x problem guides gate: every page in the family has a title (60 or fewer), description (140 to 160),
// canonical, one h1, en-AU, Article + FAQPage + BreadcrumbList JSON-LD that parses, 600+ words, no dashes,
// the Spam Act / ACMA note, links to the calculator, the kit and the hub, and the example is labelled.
// Also checks that no two pages share more than 60% of their body sentences.
// Usage: node --experimental-strip-types --no-warnings scripts/test_trade_problems.mjs [outDir=out]
import fs from "node:fs";
import path from "node:path";
import { TRADE_PROBLEMS, pagePath, computeExample } from "../lib/tradeProblems.ts";

const out = process.argv[2] || "out";
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; };

ok(TRADE_PROBLEMS.length === 5, "batch 1 is exactly 5 pages (PLAN_90D cap: 5 programmatic pages a week)");
ok(new Set(TRADE_PROBLEMS.map(pagePath)).size === TRADE_PROBLEMS.length, "paths are unique");
ok(new Set(TRADE_PROBLEMS.map((p) => p.title)).size === TRADE_PROBLEMS.length, "titles are unique");

// the arithmetic is computed, so check one by hand
const plumber = computeExample(TRADE_PROBLEMS[0].example);
ok(plumber.headline === "$21,888", `plumber example yearly = $21,888 (got ${plumber.headline})`);
const inv = computeExample(TRADE_PROBLEMS[3].example);
ok(inv.headline === "$930", `invoice example cash difference = $930 (got ${inv.headline})`);

const sentences = (t) => new Set(t.split(/(?<=[.!?])\s+/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 40));
const bodies = new Map();
const pages = [...TRADE_PROBLEMS.map((p) => ({ route: pagePath(p), p })), { route: "/automation", p: null }];
for (const { route, p } of pages) {
  const f = path.join(out, route.replace(/^\//, "") + ".html");
  if (!fs.existsSync(f)) { ok(false, `${route} built`); continue; }
  const html = fs.readFileSync(f, "utf8");
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
  const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? "";
  ok(title.length > 0 && title.length <= 60, `${route} title ${title.length} chars`);
  ok(desc.length >= 140 && desc.length <= 160, `${route} description ${desc.length} chars`);
  ok(html.includes(`rel="canonical" href="https://titanos.tech${route}"`), `${route} canonical`);
  ok((html.match(/<h1[ >]/g) || []).length === 1, `${route} one h1`);
  ok(/<html[^>]*lang="en-AU"/.test(html), `${route} lang en-AU`);
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });
  ok(ld.every(Boolean), `${route} JSON-LD parses`);
  const types = ld.filter(Boolean).map((o) => o["@type"]);
  ok(types.includes("BreadcrumbList"), `${route} BreadcrumbList`);
  const body = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
  ok(!/[–—]/.test(body), `${route} no em or en dash`);
  if (!p) continue;
  ok(types.includes("Article") && types.includes("FAQPage"), `${route} Article and FAQPage`);
  const art = ld.find((o) => o && o["@type"] === "Article");
  ok(art?.author?.name === "Kyle Deligny" && art.author.url === "https://titanos.tech/about", `${route} named author linking to /about`);
  ok(art?.dateModified === p.reviewed, `${route} last-reviewed date in JSON-LD`);
  const words = body.split(" ").filter(Boolean).length;
  ok(words >= 600, `${route} ${words} words`);
  ok(/Spam Act 2003/.test(body) && html.includes('href="https://www.acma.gov.au/avoid-sending-spam"'), `${route} Spam Act note cites ACMA`);
  ok(body.includes("Example numbers, not data"), `${route} worked example labelled`);
  for (const h of ["/tools/missed-call-calculator", `/shop/digital/${p.kit.slug}`, "/automation", "/about"]) ok(html.includes(`href="${h}"`), `${route} links to ${h}`);
  if (p.demo) ok(html.includes(`href="${p.demo.href}"`), `${route} links to ${p.demo.href}`);
  ok(TRADE_PROBLEMS.filter((s) => s !== p && html.includes(`href="${pagePath(s)}"`)).length >= 3, `${route} links to 3 siblings`);
  bodies.set(route, sentences(body));
}
for (const [a, sa] of bodies) for (const [b, sb] of bodies) {
  if (a >= b) continue;
  const shared = [...sa].filter((s) => sb.has(s)).length;
  const pct = Math.round((100 * shared) / Math.min(sa.size, sb.size));
  ok(pct <= 40, `${a} vs ${b}: ${pct}% shared sentences (limit 40%)`);
}
process.exit(fail);
