// Gate for /research/australian-email-domain-security-2026 (2026-11-29).
// Data checks always run (lib/research/emailDomainSecurity.ts); built-page checks run when an export exists.
// Usage: node --experimental-strip-types --no-warnings scripts/test_email_domain_study.mjs [outDir=out]
import fs from "node:fs";
import { BANDS, STUDY_PATH, STUDY_CSV, SECURITY_TXT_SURVEY, csvText, totals, wilson, surveyNoFilePct, pct1 } from "../lib/research/emailDomainSecurity.ts";
const out = process.argv[2] || "out";
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; return c; };
const dash = /[–—]/;
const tells = /\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|ecosystem)\b/i;

// arithmetic by hand
const T = totals();
ok(BANDS.length === 8, "eight bands");
ok(T.sampled === 325 && T.live === 318, `sampled 325, live 318 (got ${T.sampled}, ${T.live})`);
ok(T.doubleGap === 153 && T.dmarcGap === 227 && T.unknown === 73, "double gap 153, DMARC gap 227, unreadable 73");
ok(pct1(T.doubleGap, T.live) === "48.1%" && pct1(T.dmarcGap, T.live) === "71.4%", "pooled rates 48.1% and 71.4%");
for (const b of BANDS) {
  ok(b.live <= b.sampled && b.doubleGap + b.unknown <= b.dmarcGap + 1 && b.doubleGap <= b.dmarcGap && b.dmarcGap <= b.live, `${b.id} counts are consistent`);
  if (b.noRecord !== null) ok(b.noRecord + b.pNone + b.quarantine + b.reject === b.live && b.noRecord + b.pNone === b.dmarcGap, `${b.id} policy mix sums to live and gap`);
}
ok(T.mix.live === 238 && T.mix.noRecord + T.mix.pNone + T.mix.quarantine + T.mix.reject === 238, "policy mix pooled over 6 bands sums to 238");
const [lo, hi] = wilson(153, 318);
ok(lo > 42.6 && lo < 42.8 && hi > 53.5 && hi < 53.7, `Wilson interval 42.7 to 53.6 (got ${lo.toFixed(1)} to ${hi.toFixed(1)})`);
ok(SECURITY_TXT_SURVEY.scanned === 241285150 && SECURITY_TXT_SURVEY.withFile === 573123 && surveyNoFilePct().toFixed(2) === "99.76", "99.76% recomputes from 241,285,150 and 573,123");

// CSV on disk is the one the data produces
const csvFile = `public${STUDY_CSV}`;
ok(fs.existsSync(csvFile) && fs.readFileSync(csvFile, "utf8") === csvText(), "public CSV equals the generated CSV");
ok(csvText().trim().split("\n").length === 10, "CSV has header, 8 bands, 1 pooled row");

// copy rules on the page source
const src = fs.readFileSync("app/research/australian-email-domain-security-2026/page.tsx", "utf8");
ok(!dash.test(src) && !dash.test(fs.readFileSync("lib/research/emailDomainSecurity.ts", "utf8")), "no em or en dashes");
ok(!tells.test(src), "no AI-tell words");
const title = (src.match(/const META_TITLE = "([^"]+)"/) || [])[1] || "";
const desc = (src.match(/const META_DESC =\s*"([^"]+)"/) || [])[1] || "";
ok(title.length > 0 && title.length <= 60, `title <= 60 (${title.length})`);
ok(desc.length >= 140 && desc.length <= 160, `description 140-160 (${desc.length})`);
ok(desc.includes("318") && desc.includes("48.1%"), "description numbers match the computed totals");
ok(/<svg/.test(src) && (src.match(/role="img"/g) || []).length >= 2, "inline SVG charts carry role=img");

if (fs.existsSync(`${out}/index.html`)) {
  const f = [`${out}${STUDY_PATH}.html`, `${out}${STUDY_PATH}/index.html`].find((p) => fs.existsSync(p));
  if (ok(!!f, "page built")) {
    const html = fs.readFileSync(f, "utf8");
    ok((html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] === `https://titanos.tech${STUDY_PATH}`, "canonical is self");
    ok((html.match(/<h1/g) || []).length === 1, "one h1");
    ok(/application\/ld\+json/.test(html) && /"@type":"Dataset"/.test(html), "Dataset JSON-LD present");
    ok(html.includes("48.1%") && html.includes("318"), "built page carries the headline numbers");
  }
  ok(fs.existsSync(`${out}${STUDY_CSV}`), "CSV in export");
}
process.exit(fail);
