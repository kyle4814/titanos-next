// Missed call calculator gate: maths, then the built page (title/description limits, canonical, JSON-LD, one h1, links, no dashes).
// Usage: node --experimental-strip-types --no-warnings scripts/test_missed_call_calculator.mjs [outDir=out]
import fs from "node:fs";
import path from "node:path";
import { calculate, EXAMPLE } from "../app/tools/missed-call-calculator/calc.ts";
const out = process.argv[2] || "out";
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; };
const r = calculate(EXAMPLE);
ok(r.missedPerWeek === 6 && Math.abs(r.lostJobsPerWeek - 2.4) < 1e-9 && Math.abs(r.weekly - 1080) < 1e-6, "example weekly maths: 6 missed, 2.4 jobs, $1,080");
ok(Math.abs(r.yearly - 51840) < 1e-6 && Math.abs(r.monthly - 4320) < 1e-6, "example yearly $51,840, monthly $4,320");
const z = calculate({ ...EXAMPLE, missedPct: 0 });
ok(z.yearly === 0, "zero missed means zero at risk");
const bad = calculate({ callsPerWeek: NaN, missedPct: 500, jobValue: -5, closePct: 40, weeksPerYear: 99, recoverPct: 25 });
ok([bad.weekly, bad.monthly, bad.yearly].every(Number.isFinite) && bad.weekly === 0, "garbage input clamps and stays finite");
const f = path.join(out, "tools/missed-call-calculator.html");
if (!fs.existsSync(f)) { ok(false, "built page exists"); process.exit(1); }
const html = fs.readFileSync(f, "utf8");
const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? "";
ok(title.length > 0 && title.length <= 60, `title ${title.length} chars`);
ok(desc.length >= 140 && desc.length <= 160, `description ${desc.length} chars`);
ok(html.includes('rel="canonical" href="https://titanos.tech/tools/missed-call-calculator"'), "canonical");
ok((html.match(/<h1[ >]/g) || []).length === 1 && /missed call calculator/i.test(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? ""), "one h1 with the target term");
for (const t of ["WebApplication", "FAQPage", "BreadcrumbList"]) ok(html.includes(`"@type":"${t}"`), `JSON-LD ${t}`);
ok(/<html[^>]*lang="en-AU"/.test(html), "lang en-AU");
const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
ok(!/[–—]/.test(text), "no em or en dash in copy");
ok(text.includes("example numbers, not industry statistics"), "example inputs labelled");
for (const h of ["/shop", "/offers/job-flow", "/tradies"]) ok(html.includes(`href="${h}"`), `links to ${h}`);
process.exit(fail);
