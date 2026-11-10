// hud_numbers_from_ledger.mjs (f394): lib/hud/numbers.json takes every SHARED figure from lib/ledger.json rows, so the site
// has one engineer-years / lines / cost figure. HUD-ONLY fields (snapshot_ms, snapshot_ts, facts_as_of, needle.method) are never touched.
//   node scripts/hud_numbers_from_ledger.mjs            write lib/hud/numbers.json (deterministic, idempotent)
//   node scripts/hud_numbers_from_ledger.mjs --check    exit 1 if any shared field differs from the ledger (reads only)
// Optional: --ledger <path> --hud <path> (tests use fixtures).
import fs from "node:fs";

const HERE = new URL(".", import.meta.url).pathname;
// HUD row -> ledger n.* row. Value, unit, label, method come from the ledger row.
export const ROW_MAP = {
  sloc: "estate_sloc",
  engineer_years: "estate_ey",
  engineer_years_per_day_7d: "pace_ey_per_day_7d",
  fleet_jobs_24h: "fleet_jobs_24h",
  fleet_fail_rate_24h: "fleet_fail_rate_24h",
  fleet_worker_hours_24h: "fleet_worker_hours_24h",
  fleet_median_job_min: "fleet_median_job_min",
  gate_suites: "gate_suites",
};
// replacement_cost_aud is a cost row derived from the ledger's estate_ey with the rate the ledger's own estate_cost method states.
export const COST_RATE = { aud: 23_000_000, ey: 44.1, note: "engineer-years x the engineering page's rate (44.1 ey ~ AU$23M); what a conventional team would charge, never revenue" };
// HUD fact -> ledger fact (same id). Text, label, method copied from the ledger.
export const FACT_IDS = ["capacity", "ceiling", "cost_job", "tokens", "tests", "estate", "estate_ey", "estate_cost"];

const num = (x) => x?.value;
export const toMs = (ts) => Date.parse(ts.length > 10 ? `${ts}+10:00` : `${ts}T00:00:00+10:00`);

/** Pure: (ledger, hud) -> new hud object. Missing ledger input = that field left alone (reported in `skipped`). */
export function derive(ledger, hud) {
  const n = ledger.n || {};
  const out = JSON.parse(JSON.stringify(hud));
  const skipped = [];
  for (const [h, k] of Object.entries(ROW_MAP)) {
    const r = n[k];
    if (!r || typeof r.value !== "number") { skipped.push(`rows.${h} (ledger n.${k} missing)`); continue; }
    out.rows[h] = { value: r.value, unit: r.unit, label: r.label, method: r.method };
  }
  const ey = num(n.estate_ey);
  if (typeof ey === "number") {
    out.rows.replacement_cost_aud = { value: Math.round((ey * COST_RATE.aud) / COST_RATE.ey), unit: "AU$", label: "MODELLED", method: COST_RATE.note };
    out.ledger_as_of = n.estate_ey.as_of;
    out.ledger_as_of_ms = toMs(n.estate_ey.as_of);
  } else skipped.push("rows.replacement_cost_aud (ledger n.estate_ey missing)");
  for (const id of FACT_IDS) {
    const f = ledger.facts?.[id];
    if (!f) { skipped.push(`facts.${id}`); continue; }
    out.facts[id] = { text: f.text, label: f.label, method: f.method };
  }
  const nf = ledger.facts?.needle;
  if (typeof num(n.realised_x) === "number" && typeof num(n.ceiling_x) === "number" && nf) {
    out.needle = { ...out.needle, realised: n.realised_x.value, ceiling: n.ceiling_x.value, label: n.realised_x.label, text: nf.text };
  } else skipped.push("needle");
  return { hud: out, skipped };
}

export const serialize = (h) => JSON.stringify(h, null, 1) + "\n";

/** Dotted paths of every shared field where `hud` differs from derive(ledger, hud). */
export function diffShared(ledger, hud) {
  const { hud: want } = derive(ledger, hud);
  const diffs = [];
  const walk = (a, b, p) => {
    if (a && b && typeof a === "object" && typeof b === "object") { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], p ? `${p}.${k}` : k); }
    else if (a !== b) diffs.push(`${p}: hud ${JSON.stringify(a)} vs ledger-derived ${JSON.stringify(b)}`);
  };
  walk(hud, want, "");
  return diffs;
}

function main() {
  const a = process.argv.slice(2);
  const v = (f, d) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : d; };
  const lp = v("--ledger", HERE + "../lib/ledger.json");
  const hp = v("--hud", HERE + "../lib/hud/numbers.json");
  let ledger, hud;
  try { ledger = JSON.parse(fs.readFileSync(lp, "utf8")); hud = JSON.parse(fs.readFileSync(hp, "utf8")); } catch (e) { console.error("ERROR " + e.message); process.exit(2); }
  if (a.includes("--check")) {
    const d = diffShared(ledger, hud);
    if (d.length) { for (const x of d) console.error("FAIL " + x); console.error(`HUD SINGLE-SOURCE RED (${d.length} shared field(s) differ from lib/ledger.json)`); process.exit(1); }
    console.log("HUD SINGLE-SOURCE GREEN: every shared HUD field equals the ledger");
    return;
  }
  const { hud: next, skipped } = derive(ledger, hud);
  for (const s of skipped) console.log("UNKNOWN left alone: " + s);
  const txt = serialize(next);
  if (txt === fs.readFileSync(hp, "utf8")) { console.log("UNMOVED: " + hp); return; }
  fs.writeFileSync(hp, txt);
  console.log("wrote " + hp);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
