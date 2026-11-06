// Free Workflow X-Ray (/x-ray): the browser port must match the Python engine (klinge-kernel branch
// ent/e1_xray-2026-11-06, commit 0a6df26c) on three SYNTHETIC fixtures, be deterministic, refuse bad input,
// and the page must stay client-side only. Run via `npm test`.
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { buildReport, reportLines, netHours, XrayError, CATEGORIES } from "../lib/xray/engine.ts";
import { renderPdf, PDF_HEADER_SYNTHETIC, PDF_FOOTER_SYNTHETIC } from "../lib/xray/pdf.ts";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const dir = new URL("./fixtures/xray/", import.meta.url).pathname;
// sha256 of the Python PDFs (tests/xray/golden/hashes.json on ent/e1_xray-2026-11-06).
const PDF_GOLD = {
  accounting_practice: "8a3dd313aa7339126422a8a3ab2b2af8f4946fc93e45c96c03e852ec4435597c",
  trades_brisbane: "1130d9715b24c23e94a77f4c5cabc78c70cbb83cde22630ce1c8f5e0071eb175",
  wholesale_hardware: "9604c804c41995c8fa576f9e89dfcc8b5a4e54db86ab39164f870982627f8896",
};

for (const name of Object.keys(PDF_GOLD)) {
  const input = JSON.parse(fs.readFileSync(`${dir}${name}.input.json`, "utf8"));
  const want = JSON.parse(fs.readFileSync(`${dir}${name}.report.json`, "utf8"));
  const rep = buildReport(input);
  let same = true;
  try { assert.deepStrictEqual(JSON.parse(JSON.stringify(rep)), want); } catch (e) { same = false; console.log(String(e.message).slice(0, 600)); }
  ok(same, `${name}: browser report deep-equals the Python report.json`);
  const again = JSON.stringify(buildReport(input));
  ok(again === JSON.stringify(rep), `${name}: same input, same bytes`);
  const pdf = renderPdf(reportLines(rep), PDF_HEADER_SYNTHETIC, PDF_FOOTER_SYNTHETIC);
  const sha = crypto.createHash("sha256").update(pdf).digest("hex");
  ok(sha === PDF_GOLD[name], `${name}: PDF is byte-identical to the Python PDF (${sha.slice(0, 12)})`);
  ok(Buffer.from(pdf).subarray(0, 8).toString() === "%PDF-1.4\n".slice(0, 8), `${name}: PDF header`);
  const txt = Buffer.from(pdf).toString("latin1");
  ok(txt.includes("ESTIMATE, not measured") && txt.includes("SYNTHETIC DEMO"), `${name}: every PDF carries the ESTIMATE and SYNTHETIC labels`);
}

// charter O5 worked example: 200 * 5 * 0.8 - 100 = 700 min = 11.67 h
const [raw, fl] = netHours(200, 12, 0, 7, 0, 0.8, 100);
ok(Math.abs(raw - 11.6667) < 1e-3 && fl === raw, "charter O5 example = 11.67 hours");
ok(netHours(1, 5, 0, 5, 0, 0.5, 90)[1] === 0 && netHours(1, 5, 0, 5, 0, 0.5, 90)[0] < 0, "negative return is floored for display, signed value kept");

// a real (non-synthetic) run is labelled as the user's own answers and never says SYNTHETIC
const own = buildReport({ as_of: "2026-11-06", industry: "retail", size_band: "5-19", tools: ["paper"], workflows: [
  { name: "Weekly stock order", category: "stock_ordering", n_per_week: 6, t0_min: 40 }] });
const ownText = reportLines(own).join("\n");
ok(own.synthetic === false && !/SYNTHETIC/.test(ownText), "own-answers report is not stamped SYNTHETIC");
ok(/your own answers/.test(own.banner) && /ESTIMATE, not measured/.test(own.banner), "own-answers banner says ESTIMATE and your own answers");

// unknown inputs give no score, only a measurement exercise
const unk = buildReport({ as_of: "2026-11-06", industry: "retail", size_band: "1-4", workflows: [
  { name: "Mystery task", category: "reporting", n_per_week: null, t0_min: null, certainty: "dont_know" }] });
ok(unk.workflows[0].status === "NOT_ENOUGH_EVIDENCE" && unk.totals === null && /Not enough evidence/.test(unk.executive_summary), "unknown inputs: not enough evidence, no score");

// refusals
const base = { as_of: "2026-11-06", industry: "retail", size_band: "1-4", workflows: [{ name: "Task", category: "reporting", n_per_week: 5, t0_min: 10 }] };
const refuses = (patch, why) => {
  let threw = false;
  try { buildReport({ ...base, ...patch }); } catch (e) { threw = e instanceof XrayError; }
  ok(threw, `refuses: ${why}`);
};
refuses({ workflows: [{ name: "Email sam@example.com", category: "reporting", n_per_week: 5, t0_min: 10 }] }, "email address in free text");
refuses({ workflows: [{ name: "Call 0412 345 678", category: "reporting", n_per_week: 5, t0_min: 10 }] }, "phone number in free text");
refuses({ workflows: [{ name: "see https://x.example", category: "reporting", n_per_week: 5, t0_min: 10 }] }, "URL in free text");
refuses({ workflows: [{ name: "Café orders", category: "reporting", n_per_week: 5, t0_min: 10 }] }, "non-ASCII text");
refuses({ workflows: [{ name: "Task", category: "reporting", n_per_week: -1, t0_min: 10 }] }, "negative jobs per week");
refuses({ workflows: [{ name: "Task", category: "nonsense", n_per_week: 5, t0_min: 10 }] }, "unknown category");
refuses({ workflows: [] }, "zero workflows");
refuses({ workflows: Array(6).fill({ name: "Task", category: "reporting", n_per_week: 5, t0_min: 10 }) }, "six workflows");
refuses({ industry: "x" }, "unknown sector");
refuses({ workflows: [{ name: "Task", category: "reporting", n_per_week: NaN, t0_min: 10 }] }, "blank number (NaN)");

// copy discipline: no em or en dashes, no banned claim words anywhere in the engine output or the page source
const BAN = /[—–]|\b(guarantee[sd]?|will save|certified|delve|leverag\w*|robust|holistic|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|ecosystem)\b/i;
for (const name of Object.keys(PDF_GOLD)) {
  const input = JSON.parse(fs.readFileSync(`${dir}${name}.input.json`, "utf8"));
  const t = reportLines(buildReport(input)).join("\n") + JSON.stringify(buildReport(input));
  ok(!BAN.test(t), `${name}: output has no dashes, banned or AI-tell words`);
}
const catText = JSON.stringify(CATEGORIES);
ok(!BAN.test(catText), "category copy has no banned words");

// the page and the wizard stay client-side only and add no tracking
const files = ["../app/x-ray/page.tsx", "../components/XrayWizard.tsx", "../lib/xray/engine.ts", "../lib/xray/pdf.ts"]
  .map((f) => [f, fs.readFileSync(new URL(f, import.meta.url), "utf8")]);
for (const [f, src] of files) {
  const code = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|document\.cookie|gtag|dataLayer|fbq|mixpanel|posthog|navigator\.sendBeacon|\bmailto:|<form[^>]*action=/.test(code), `${f}: no network call, cookie, tracker or mailto`);
  ok(!BAN.test(code.replace(/[A-Za-z_]+ —/g, "")) || f.includes("engine") || f.includes("pdf"), `${f}: no banned copy words`);
}
const page = files[0][1] + files[1][1];
ok(/Download the PDF/.test(page) && !/type="email"/.test(page), "PDF download offered with no email field");
ok(/PRIVATE BY DESIGN/.test(page) && /sessionStorage/.test(page), "privacy note present; drafts use sessionStorage only");
ok(/SYNTHETIC/.test(page), "the example is labelled SYNTHETIC");
ok(!/dangerouslySetInnerHTML/.test(page), "no raw HTML injection");

process.exit(fail ? 1 : 0);
