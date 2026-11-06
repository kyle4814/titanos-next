// Flow "docs", /terms half (f53). Asserts the terms page against the SAME constants the portal billing code enforces
// (portal-api/src/catalogue.ts: PRODUCTS[*].minMonths, REFUND_WINDOW_DAYS, refundVerdict), never retyped numbers.
// Run: node --experimental-strip-types scripts/test_terms_flow.mjs [--built <out dir>]
// Source layer always runs. --built adds the rendered HTML layer (out/terms/index.html from a next build).
// Where the page and billing disagree, billing is NOT edited and the page is NOT edited here: the disagreement is
// pinned EXACTLY below (so it cannot silently change) and surfaced in the matrix as a finding.
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRODUCTS, REFUND_WINDOW_DAYS, refundVerdict } from "../portal-api/src/catalogue.ts";
import { PRICING, DISPLAY } from "../lib/pricing.ts";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const root = new URL("../", import.meta.url);
const R = (p) => readFileSync(new URL(p, root), "utf8");
const args = process.argv.slice(2);
const builtDir = args.includes("--built") ? args[args.indexOf("--built") + 1] : null;

// ---- visible text of /terms ----
const src = R("app/terms/page.tsx");
const entities = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;|&apos;/g, "'").replace(/&nbsp;/g, " ");
function sourceText() {
  let s = src.replace(/^import .*$/gm, "").replace(/\{" "\}/g, " ");
  s = s.replace(/\{(DISPLAY|PRICING)\.(\w+)\}/g, (_, o, k) => String((o === "DISPLAY" ? DISPLAY : PRICING)[k] ?? `<<UNRESOLVED ${o}.${k}>>`));
  s = s.replace(/\{ALL_OFFERS\.length\}|\{LIVE_OFFERS\}/g, "N");
  const body = s.slice(s.indexOf("return ("));
  return entities(body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}
function builtText(dir) {
  const f = join(dir, "terms", "index.html");
  if (!existsSync(f)) return null;
  const h = readFileSync(f, "utf8").replace(/<(script|style|header|nav|footer)[\s\S]*?<\/\1>/g, " ");
  return entities(h.replace(/<\/(p|h[1-6]|li|section|article)>/g, "\n\n").replace(/<[^>]*>/g, " ").replace(/[ \t]+/g, " ")).trim();
}
const text = sourceText();
const refundsSection = text.slice(text.indexOf("Refunds"), text.indexOf("Responsible disclosure"));

// ---- 1. it renders (source layer): default export, title, nine sections, nothing unresolved ----
ok(/export default function TermsPage\(/.test(src), "terms: page exports a TermsPage component");
ok(/title="Terms of Service"/.test(src), "terms: hero title is Terms of Service");
const sectionCount = Number((src.match(/const SECTION_COUNT = (\d+)/) || [])[1]);
const h2s = [...src.matchAll(/<H2>([^<]+)<\/H2>/g)].map((m) => m[1]);
ok(sectionCount === 9 && h2s.length === sectionCount, `terms: SECTION_COUNT (${sectionCount}) equals the H2 sections rendered (${h2s.length})`);
ok(!/UNRESOLVED/.test(text), "terms: every price token resolves from lib/pricing (no UNRESOLVED token)");
ok(h2s.includes("Refunds") && refundsSection.length > 200, "terms: Refunds section present and non-trivial");

// ---- 2. refund policy EXACTLY as the portal enforces it ----
const compliance = Object.values(PRODUCTS).find((p) => p.kind === "compliance");
const monitor = Object.values(PRODUCTS).find((p) => p.kind === "monitor");
const DAY = 86_400_000, t0 = 1_800_000_000_000;
const inside = refundVerdict(compliance, t0, t0 + REFUND_WINDOW_DAYS * DAY, false, false);
const after = refundVerdict(compliance, t0, t0 + REFUND_WINDOW_DAYS * DAY + 1, false, false);
const issued = refundVerdict(compliance, t0, t0 + DAY, true, false);
ok(inside.auto === true && after.auto === false && after.reason === "outside_14_days", "billing: compliance auto-refund on the last window day, not one ms after (refundVerdict)");
ok(issued.auto === false && issued.reason === "deliverable_issued", "billing: compliance refund is never automatic once a deliverable is issued");
ok(refundVerdict(monitor, t0, t0 + DAY, false, false).reason === "monitor_no_refund_current_period", "billing: monitor refund is never automatic (no refund for the current period)");
for (const k of ["ai", "leads"]) {
  const p = Object.values(PRODUCTS).find((x) => x.kind === k);
  ok(refundVerdict(p, t0, t0 + DAY, false, false).reason === "scope_terms_apply", `billing: ${k} refund is never automatic (scope terms apply)`);
}
ok(new RegExp(`full refund is available within ${REFUND_WINDOW_DAYS} days of payment`).test(refundsSection), `terms: compliance full refund window equals REFUND_WINDOW_DAYS (${REFUND_WINDOW_DAYS}) from catalogue.ts`);
ok(/provided no deliverable has been issued/.test(refundsSection), "terms: refund is conditional on no deliverable issued (matches deliverable_issued)");
ok(/Titanos Monitor: cancel any time; no refunds are issued for the current billing period/.test(refundsSection), "terms: monitor has no refund for the current billing period (matches monitor_no_refund_current_period)");
ok(/AI implementation and Leads engagements: refund terms are stated in the written scope/.test(refundsSection), "terms: AI and Leads refunds follow the written scope (matches scope_terms_apply)");
const days = [...refundsSection.matchAll(/(\d+)[ -]days?/gi)].map((m) => Number(m[1]));
ok(days.length > 0 && days.every((d) => d === REFUND_WINDOW_DAYS), `terms: every day-count in Refunds (${days.join(",")}) equals REFUND_WINDOW_DAYS`);

// ---- 3. retainer minimum term: billing enforces it; does the page say it? ----
const mins = [...new Set(Object.values(PRODUCTS).filter((p) => p.minMonths).map((p) => p.minMonths))];
ok(mins.length === 1 && mins[0] === PRICING.AI_RETAINER_MIN_MONTHS, `billing: every retainer minimum (${mins.join(",")}) equals PRICING.AI_RETAINER_MIN_MONTHS (${PRICING.AI_RETAINER_MIN_MONTHS})`);
const retainerNames = Object.values(PRODUCTS).filter((p) => p.minMonths).map((p) => p.id);
const statesMin = new RegExp(`${mins[0]}[- ]month minimum|minimum (term )?of ${mins[0]} months`, "i").test(text);
// FINDING F1: billing (portal-api/src/service.ts cancelSubscription + catalogue.ts minMonths) holds a retainer's cancel
// until the minimum term ends; app/terms/page.tsx never states a minimum. Pinned to the CURRENT state: when the page is
// fixed (a legal-wording change, Kyle's call, GATE3) this line flips and must become a positive assertion.
ok(statesMin === false, `FINDING F1 pinned: terms does NOT state the ${mins[0]}-month retainer minimum that billing enforces (${retainerNames.join(", ")}); flips when the page is corrected`);
// FINDING F2: page says monthly offers "cancel any time by email"; billing holds ai_* retainers to the minimum term.
ok(/Monthly offers cancel any time by email/.test(text) === true, "FINDING F2 pinned: terms says monthly offers 'cancel any time by email' while billing holds ai_* retainers to the minimum term; flips when corrected");

// ---- 4. punctuation and lint ----
ok(!/[–—]/.test(src), "terms: source has zero em or en dashes");
ok(!/[–—]/.test(text), "terms: visible text has zero em or en dashes");
const dir = mkdtempSync(join(tmpdir(), "termslint-"));
const lintOf = (label, t) => {
  const f = join(dir, label + ".txt");
  writeFileSync(f, t.split(/(?<=\.)\s+/).join("\n\n"));
  const r = spawnSync("python3", ["/home/tech2/klinge-kernel/bin/content_lint.py", "--no-cta", f], { encoding: "utf8" });
  ok(r.status === 0, (label === "source" ? "terms (source): content_lint --no-cta CLEAN" : "terms (built): content_lint --no-cta CLEAN") + (r.status ? " :: " + (r.stdout + r.stderr).trim().slice(0, 300) : ""));
};
lintOf("source", text);

// ---- 5. rendered HTML layer ----
if (builtDir) {
  const bt = builtText(builtDir);
  ok(bt !== null, `built: ${builtDir}/terms/index.html exists (the page renders)`);
  if (bt) {
    ok(/Terms of Service/.test(bt), "built: renders the Terms of Service title");
    ok(bt.includes(`full refund is available within ${REFUND_WINDOW_DAYS} days of payment`), "built: renders the refund window from REFUND_WINDOW_DAYS");
    ok(!/[–—]/.test(bt), "built: zero em or en dashes in rendered text");
    lintOf("built", bt);
  }
} else console.log("SKIP built layer (run with --built out)");
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
