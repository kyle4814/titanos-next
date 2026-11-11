// ledger_derive.mjs (f393): the derived-figure formulas of the retired kernel exporter bin/site_ledger_export.py,
// ported 1:1 from `git -C ~/klinge-kernel show b857355428:bin/site_ledger_export.py` (read-only recovery, lines "derived, MODELLED").
// Pure functions. No I/O. A derived row is only ever computed from rows already in the ledger; missing input = null (caller reports UNKNOWN).
//
// Inputs (ledger rows): estate_ey, span_days, compute_build_aud_month, compute_today_aud_month.
// Constants (published rate on /engineering, Hudson Australia Cyber Security Salary Guide contractor rate; not a system measurement):
export const DAY_RATE_AUD = 800;
export const DAYS_PER_YEAR = 220;
export const SOURCE_EXPORTER = "bin/site_ledger_export.py @ b857355428";

const COCOMO = "Basic COCOMO organic: effort = 2.4 x KSLOC^1.05 person-months, schedule = 2.5 x effort^0.38 months";
const nv = (n, k) => (n?.[k] && typeof n[k].value === "number" && Number.isFinite(n[k].value) ? n[k].value : null);
const roundTo = (x, digits) => { if (digits < 0) { const u = 10 ** -digits; return Math.round(x / u) * u; } const f = 10 ** digits; return Math.round(x * f) / f; }; // digits may be negative
const fmt = (x) => x.toLocaleString("en-US");

/** Keys this module derives, in dependency order. */
export const DERIVED_KEYS = [
  "model_effort_pm", "model_schedule_months", "model_team", "elapsed_months", "speed_x", "team_smaller_x",
  "build_cost_aud", "annual_ey", "annual_cost_aud", "annual_cost_10pct_aud", "annual_cost_2pct_aud",
  "compute_build_total_aud", "per_dollar_build_x", "per_dollar_today_x", "per_dollar_full_x", "per_dollar_full_today_x",
];

/** Returns {key: {value, method, source}} or null when an input row is missing/non-numeric. Formula text is the exporter's own. */
export function deriveRows(n) {
  const ey = nv(n, "estate_ey"), span = nv(n, "span_days");
  const cb = nv(n, "compute_build_aud_month"), ct = nv(n, "compute_today_aud_month");
  if (ey === null || span === null || cb === null || ct === null) return null;
  const monthsElapsed = span / 30.4375;
  const yearsElapsed = span / 365.0;
  const effortPm = ey * 12;
  const sched = 2.5 * effortPm ** 0.38;
  const team = effortPm / sched;
  const dayCost = DAY_RATE_AUD * DAYS_PER_YEAR; // AU$176,000 per engineer-year
  const buildCost = ey * dayCost;
  const annualEy = ey / yearsElapsed;
  const annualCost = annualEy * dayCost;
  const rate = `AU$${DAY_RATE_AUD} a day x ${DAYS_PER_YEAR} working days = AU$${fmt(dayCost)} per engineer-year`;
  const buildCompute = cb * monthsElapsed;
  const o = {};
  const put = (key, value, method, source) => { o[key] = { value, method, source }; };
  put("model_effort_pm", Math.round(effortPm), `${ey} engineer-years x 12`, "estate_ey");
  put("model_schedule_months", roundTo(sched, 1), COCOMO, "estate_ey");
  put("model_team", roundTo(team, 1), "effort person-months / schedule months", "estate_ey");
  put("elapsed_months", roundTo(monthsElapsed, 1), `${span} days from the first commit (4 May 2026) / 30.4375`, "parttime");
  put("speed_x", roundTo(sched / monthsElapsed, 1), "model schedule months / months elapsed", "estate_ey, parttime");
  put("team_smaller_x", Math.round(team), "model team / 1 engineer", "estate_ey");
  put("build_cost_aud", roundTo(buildCost, -4), `${ey} engineer-years x ${rate}`, "estate_ey; rate: Hudson Australia Cyber Security Salary Guide");
  put("annual_ey", Math.round(annualEy), `${ey} engineer-years / ${yearsElapsed.toFixed(3)} years elapsed`, "estate_ey, parttime");
  put("annual_cost_aud", roundTo(annualCost, -5), `${annualEy.toFixed(1)} engineer-years a year x AU$${fmt(dayCost)}`, "estate_ey, parttime");
  put("annual_cost_10pct_aud", roundTo(annualCost * 0.10, -4), "10% of annual_cost_aud", "annual_cost_aud");
  put("annual_cost_2pct_aud", roundTo(annualCost * 0.02, -3), "2% of annual_cost_aud", "annual_cost_aud");
  put("compute_build_total_aud", roundTo(buildCompute, -1), `AU$${cb} x ${roundTo(monthsElapsed, 1)} months elapsed`, "compute_build_aud_month");
  put("per_dollar_build_x", roundTo((annualCost * 0.10) / (cb * 12), -2), `10% annual value / (AU$${cb} x 12) on the build spend`, "annual_cost_10pct_aud, compute_build_aud_month");
  put("per_dollar_today_x", roundTo((annualCost * 0.10) / (ct * 12), -1), `10% annual value / (AU$${ct} x 12) at today's spend`, "annual_cost_10pct_aud, compute_today_aud_month");
  put("per_dollar_full_x", roundTo(buildCost / buildCompute, -2), "full-model build cost / build-stage compute", "build_cost_aud, compute_build_total_aud");
  put("per_dollar_full_today_x", roundTo(annualCost / (ct * 12), -1), `full-model annual value / (AU$${ct} x 12)`, "annual_cost_aud, compute_today_aud_month");
  o._rate = rate;
  return o;
}

/** Fact text templates that embed ledger rows. Each returns {text, method?} or null when an input is missing. */
export function factTexts(n, facts) {
  const out = {};
  const sloc = nv(n, "estate_sloc"), repos = nv(n, "estate_repos"), ey = nv(n, "estate_ey");
  if (sloc !== null && repos !== null && facts?.estate) {
    out.estate = { text: `${repos} code repositories built since 4 May 2026: ${fmt(sloc)} lines of production code.` };
  }
  if (sloc !== null && ey !== null && facts?.estate_ey) {
    out.estate_ey = {
      text: `Priced by the industry standard COCOMO model, that is ${ey} engineer-years of conventional engineering.`,
      method: `Basic COCOMO organic 2.4*KSLOC^1.05 person-months / 12 on ${(sloc / 1000).toFixed(1)} KSLOC`,
    };
  }
  if (ey !== null && facts?.estate_cost) {
    // curated method: "<ey> engineer-years x the engineering page's own rate (44.1 engineer-years ~ AU$23M)"
    const m = /\(([\d.]+) engineer-years ~ AU\$(\d+)M\)/.exec(facts.estate_cost.method || "");
    if (m) {
      const anchorEy = Number(m[1]), anchorM = Number(m[2]);
      out.estate_cost = {
        text: `A conventional team would charge about AU$${((ey * anchorM) / anchorEy).toFixed(1)} million to build it.`,
        method: `${ey} engineer-years x the engineering page's own rate (${m[1]} engineer-years ~ AU$${m[2]}M)`,
      };
    }
  }
  return out;
}

/** The exporter's own fact -> row parse table (site_ledger_export.py fact_num calls). Used to prove rows and fact text agree. */
export const FACT_ROWS = [
  ["estate_sloc", "estate", /([\d,]+) lines of production code/],
  ["estate_repos", "estate", /^(\d+) code repositories/],
  ["estate_ey", "estate_ey", /([\d.]+) engineer-years/],
  ["pace_x", "pace", /rose (\d+)x/],
  ["commits_day_before", "pace", /from ([\d.]+) commits a day/],
  ["commits_day_now", "pace", /to ([\d.]+) a day now/],
  ["commits_week_before", "weekly", /From (\d+) commits a week/],
  ["commits_week_now", "weekly", /to ([\d,]+) this week/],
  ["active_days", "parttime", /on (\d+) of \d+ days/],
  ["span_days", "parttime", /on \d+ of (\d+) days/],
  ["cost_job_x", "cost_job", /fell ([\d.]+)x/],
  ["cost_job_before", "cost_job", /from US\$([\d.]+) to/],
  ["cost_job_after", "cost_job", /to US\$([\d.]+),/],
  ["tokens_x", "tokens", /starts ([\d.]+)x leaner/],
  ["tokens_after", "tokens", /([\d,]+) tokens of context instead/],
  ["tokens_before", "tokens", /instead of ([\d,]+)/],
  ["tests_main", "tests", /to ([\d,]+) test cases/],
  ["tests_before", "tests", /from (\d+) tests/],
  ["suites_now", "tests", /to (\d+) automated safety suites/],
  ["capacity_x", "capacity", /is now (\d+)x/],
  ["ceiling_x", "ceiling", /up to (\d+)x/],
  ["realised_x", "needle", /output is (\d+)x so far/],
  ["fleet_share_pct", "fleet_share", /did (\d+)% of the work/],
];

/** Consistency check. Returns an array of problem strings (empty = green). */
export function checkLedger(ledger) {
  const bad = [];
  const n = ledger.n || {};
  // 1. every fact-parsed row equals the number in its fact text (one estate_ey, one estate_sloc, everywhere)
  for (const [key, fid, rx] of FACT_ROWS) {
    const f = ledger.facts?.[fid], r = n[key];
    if (!f || !r) continue;
    const m = rx.exec(f.text);
    if (!m) { bad.push(`fact ${fid}: cannot parse ${key} from text`); continue; }
    const v = Number(m[1].replace(/,/g, ""));
    if (v !== r.value) bad.push(`${key}: row ${r.value} but facts.${fid}.text says ${v}`);
  }
  // 2. every other place the engineer-years / lines figures are written in fact text or method must be the row value
  const ey = nv(n, "estate_ey"), sloc = nv(n, "estate_sloc");
  const eyRx = /(\d+(?:\.\d+)?) engineer-years(?! ~)/g;
  for (const [fid, f] of Object.entries(ledger.facts || {})) {
    for (const field of ["text", "method"]) {
      const s = f[field] || "";
      if (ey !== null && (fid === "estate_ey" || fid === "estate_cost")) {
        for (const m of s.matchAll(eyRx)) if (Number(m[1]) !== ey) bad.push(`facts.${fid}.${field}: ${m[1]} engineer-years vs estate_ey row ${ey}`);
      }
      if (sloc !== null && fid === "estate_ey" && field === "method") {
        const k = /on ([\d.]+) KSLOC/.exec(s);
        if (k && k[1] !== (sloc / 1000).toFixed(1)) bad.push(`facts.estate_ey.method: ${k[1]} KSLOC vs estate_sloc row ${sloc}`);
      }
    }
  }
  const ft = factTexts(n, ledger.facts);
  for (const [fid, t] of Object.entries(ft)) {
    if (ledger.facts[fid].text !== t.text) bad.push(`facts.${fid}.text is not the regenerated text: "${ledger.facts[fid].text}" vs "${t.text}"`);
    if (t.method && ledger.facts[fid].method !== t.method) bad.push(`facts.${fid}.method is not the regenerated method`);
  }
  // 3. derived rows equal the recovered formula applied to the rows
  const d = deriveRows(n);
  if (d) {
    for (const k of DERIVED_KEYS) {
      const r = n[k];
      if (!r) { bad.push(`derived row ${k} missing from ledger`); continue; }
      if (r.value !== d[k].value) bad.push(`${k}: ledger ${r.value} vs formula ${d[k].value}`);
      if (r.method !== d[k].method) bad.push(`${k}: method text not the formula's`);
      if (k !== "elapsed_months" && k !== "compute_build_total_aud" && r.label !== "MODELLED") bad.push(`${k}: label ${r.label}, expected MODELLED`);
    }
    if (ledger.rate_note !== d._rate) bad.push(`rate_note ${JSON.stringify(ledger.rate_note)} vs ${JSON.stringify(d._rate)}`);
  } else bad.push("derived rows: an input row (estate_ey, span_days, compute_*_aud_month) is missing: UNKNOWN");
  return bad;
}
