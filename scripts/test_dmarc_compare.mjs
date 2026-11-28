// Gate for /email-security/compare, 2026-11-29. Data checks always run; built-page checks run when an export exists.
// Usage: node --experimental-strip-types --no-warnings scripts/test_dmarc_compare.mjs [outDir=out]
import fs from "node:fs";
import { COMPARE, COMPARE_PATH, COMPARE_REVIEWED, TOOLS, FREE_OPTIONS, DIY_VS_MANAGED, FAQ, SOURCES } from "../lib/dmarcCompare.ts";
const out = process.argv[2] || "out";
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; return c; };
const dash = /[–—]/;
const tells = /\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|ecosystem)\b/i;
const fear = /\b(urgent|act now|limited time|hurry|don't miss|devastating|catastrophic)\b/i;
const all = JSON.stringify([COMPARE, TOOLS, FREE_OPTIONS, DIY_VS_MANAGED, FAQ, SOURCES]);

ok(COMPARE.title.length <= 60, `title <= 60 (${COMPARE.title.length})`);
ok(COMPARE.description.length >= 140 && COMPARE.description.length <= 160, `description 140-160 (${COMPARE.description.length})`);
ok(/^\d{4}-\d{2}-\d{2}$/.test(COMPARE_REVIEWED), "review date is ISO");
ok(!dash.test(all), "no em or en dashes");
ok(!tells.test(all), "no AI-tell words");
ok(!fear.test(all), "no fear or fake urgency words");
for (const name of ["dmarcian", "Valimail", "EasyDMARC", "PowerDMARC"]) ok(TOOLS.some((t) => t.name === name), `compares ${name}`);
ok(FREE_OPTIONS.length >= 2, "free options listed");
ok(DIY_VS_MANAGED.length >= 4, "do it yourself vs managed rows");
for (const t of TOOLS) {
  ok(/^https:\/\//.test(t.source.url), `${t.slug} cites an https source`);
  ok(/29 November 2026/.test(t.priceChecked), `${t.slug} price check is dated`);
  ok(/US\$|USD|contact|custom/i.test(t.pricing), `${t.slug} pricing states currency or says not public`);
}
const val = TOOLS.find((t) => t.slug === "valimail");
ok(!/US\$\d/.test(val.pricing), "Valimail paid prices are not invented");
ok(/could not|error|Confirm/i.test(TOOLS.find((t) => t.slug === "powerdmarc").priceChecked), "PowerDMARC secondhand reading is disclosed");
ok(FAQ.every((f) => f.q && f.a) && FAQ.length >= 4, "FAQ complete");
ok(SOURCES.every((x) => /^https:\/\//.test(x.url)), "all sources https");

const page = fs.readFileSync(new URL("../app/email-security/compare/page.tsx", import.meta.url), "utf8");
ok(/robots: \{ index: true/.test(page) && page.includes("COMPARE_PATH"), "page indexable with self canonical");
ok(!dash.test(page), "no dashes in page source");

if (fs.existsSync(`${out}/index.html`)) {
  const f = [`${out}${COMPARE_PATH}.html`, `${out}${COMPARE_PATH}/index.html`].find(fs.existsSync);
  if (ok(!!f, "built page exists")) {
    const html = fs.readFileSync(f, "utf8");
    ok(html.includes(`<link rel="canonical" href="https://titanos.tech${COMPARE_PATH}"`), "canonical is self");
    ok((html.match(/<h1[ >]/g) || []).length === 1, "one h1");
    ok(/Last reviewed/.test(html) && /Kyle Deligny/.test(html), "author and review date");
    ok(!/[–—]/.test(html.replace(/<script[\s\S]*?<\/script>/g, "")), "no dashes in built text");
  }
} else console.log("SKIP built-page checks (no export at " + out + ")");
process.exit(fail);
