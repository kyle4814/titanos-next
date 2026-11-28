// Industry pages gate (SEO lane 20): 8 pages, each with title (60 or fewer), description (140 to 160),
// 600+ words of its own, no dashes, no banned words, no fear or urgency words, a free scan CTA, a source list,
// internal links that resolve to real routes, and no two pages sharing more than 40% of their sentences.
// Numeric claims are whitelisted: only figures traced to a repo file or a named public source may appear.
// Usage: node --experimental-strip-types --no-warnings scripts/test_industry_pages.mjs
import fs from "node:fs";
import { INDUSTRY_PAGES, pagePath } from "../lib/industryPages.ts";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; };

const WANT = ["accountants", "law-firms", "real-estate", "medical-and-allied-health", "plumbers", "electricians", "builders", "cleaners"];
ok(INDUSTRY_PAGES.map((p) => p.slug).join() === WANT.join(), "exactly the eight requested industries");
ok(new Set(INDUSTRY_PAGES.map((p) => p.title)).size === 8 && new Set(INDUSTRY_PAGES.map(pagePath)).size === 8, "titles and paths unique");

const BANNED = /\b(delve|leverage[sd]?|robust|holistic|landscape|cutting-edge|ecosystem|streamline[sd]?|synergy)\b/i;
const FEAR = /\b(urgent|act now|limited time|last chance|don't wait|before it's too late|devastat\w*|catastroph\w*)\b/i;
// Digits allowed anywhere in prose, each with its trace.
const NUM_OK = [
  /AU\$152\.6 million/, /66 percent/, // sectors.json fact (AFP release)
  /AU\$3 million/, /30 days/, /6D\(4\)\(b\)/, // lib/privacyObligations.ts
  /10 (DNS )?lookups?/, /10 or fewer/, /RFC 7208/, /RFC 7489/, /rule 9/, /Act 1988/, /Act 2003/, /APP [158]/, /2015/, /2024/,
  /2026/, /\b29 November\b/,
];

const files = new Set(fs.readdirSync("app", { recursive: true }).map(String).filter((f) => f.endsWith("page.tsx")).map((f) => "/" + f.replace(/\/?page\.tsx$/, "")));
const routeOk = (h) => {
  const parts = h.split("/");
  return [...files].some((f) => { const fp = f.split("/"); return fp.length === parts.length && fp.every((s, i) => /^\[.+\]$/.test(s) || s === parts[i]); }) || h === "/";
};

const sents = (t) => new Set(t.split(/(?<=[.!?])\s+/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 40));
const bodies = new Map();
for (const p of INDUSTRY_PAGES) {
  const r = pagePath(p);
  const text = [p.lede, ...p.why, p.risksHeading, ...p.risks.flatMap((x) => [x.t, x.b]), p.domainHeading, p.domainIntro, ...p.domainChecks, p.privacyHeading, ...p.privacy, p.automationHeading, ...p.automation, ...p.faq.flatMap((f) => [f.q, f.a])].join(" ");
  const all = [p.title, p.description, p.h1, text, ...p.sources.map((s) => s.label), ...p.links.map((l) => l.label + " " + l.note)].join(" ");
  ok(p.title.length <= 60, `${r} title ${p.title.length} chars`);
  ok(p.description.length >= 140 && p.description.length <= 160, `${r} description ${p.description.length} chars`);
  const words = text.split(/\s+/).filter(Boolean).length;
  ok(words >= 600, `${r} ${words} words`);
  ok(!/[–—]/.test(all), `${r} no em or en dash`);
  ok(!BANNED.test(all), `${r} no banned words`);
  ok(!FEAR.test(all), `${r} no fear or urgency words`);
  const stripped = NUM_OK.reduce((s, re) => s.replace(new RegExp(re.source, "g"), " "), all);
  const stray = stripped.match(/\b\d[\d,.]*\b/g) || [];
  ok(stray.length === 0, `${r} no unsourced numbers${stray.length ? " (" + stray.join(", ") + ")" : ""}`);
  ok(p.sources.length >= 5, `${r} ${p.sources.length} sources`);
  ok(p.sources.every((s) => !s.href || /^https:\/\//.test(s.href)), `${r} source links are https`);
  ok(p.links.some((l) => l.href === "/scan"), `${r} free scan CTA link`);
  ok(p.links.every((l) => routeOk(l.href)), `${r} internal links resolve to routes`);
  ok(p.faq.length >= 3 && p.risks.length === 4, `${r} 3+ FAQs and 4 risks`);
  ok(p.reviewed === "2026-11-29", `${r} reviewed date`);
  bodies.set(r, sents(text));
}
for (const [a, sa] of bodies) for (const [b, sb] of bodies) {
  if (a >= b) continue;
  const shared = [...sa].filter((s) => sb.has(s)).length;
  const pct = shared / Math.max(1, Math.min(sa.size, sb.size));
  ok(pct <= 0.4, `${a} vs ${b} share ${(pct * 100).toFixed(0)}% of sentences`);
}
// built output, when present
if (fs.existsSync("out")) {
  for (const p of INDUSTRY_PAGES) {
    const f = `out${pagePath(p)}.html`;
    if (!fs.existsSync(f)) { ok(false, `${pagePath(p)} built`); continue; }
    const html = fs.readFileSync(f, "utf8");
    ok(html.includes(`rel="canonical" href="https://titanos.tech${pagePath(p)}"`), `${pagePath(p)} canonical in build`);
    ok((html.match(/<h1[ >]/g) || []).length === 1, `${pagePath(p)} one h1 in build`);
    ok(html.includes('href="/scan"'), `${pagePath(p)} scan CTA in build`);
  }
}
process.exit(fail);
