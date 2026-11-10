// regen_ledger.mjs (f391): refresh lib/ledger.json rows whose source number moved in the kernel. READ-ONLY on the kernel.
//   node scripts/regen_ledger.mjs [--kernel-state DIR] [--ledger FILE] [--dry-run]
//   --kernel-state default ~/klinge-kernel/state. Reads state/numbers/NUMBERS.json (ts + rows) and the newest baseline/BASELINE_<date>.json (ts only:
//   its vectors carry windows that match no ledger key, so it supplies a reference date and no values).
// Rules: a mapped row whose kernel value differs gets value/as_of/measured/method (and source when the row had no source file) from the kernel row,
//   stamped with the SOURCE file's own ts (never today). Unmoved = untouched. Mapped row missing in the kernel or non-numeric = UNKNOWN, row kept.
//   Kernel row whose method says RED (a failed gate) = HELD, row kept. Unmapped rows stay (derived rows are reported DERIVED-STALE when an input moved).
//   A ledger row with no source, method or label, or a non-numeric value, is a fabricated row: REFUSED, exit 3, nothing written.
// Writes only the --ledger file. No network.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { diffShared, derive as deriveHud, serialize as serializeHud } from "./hud_numbers_from_ledger.mjs";
import { deriveRows, factTexts, checkLedger, DERIVED_KEYS, SOURCE_EXPORTER } from "./ledger_derive.mjs";

// ledger key -> NUMBERS.json key. Explicit on purpose: nothing is matched by guesswork.
export const MAP = {
  estate_sloc: "sloc", core_sloc: "sloc",
  estate_ey: "engineer_years", core_ey: "engineer_years",
  pace_ey_per_day_1d: "engineer_years_per_day_1d", pace_ey_per_day_7d: "engineer_years_per_day_7d",
  fleet_jobs_24h: "fleet_jobs_24h", fleet_fail_rate_24h: "fleet_fail_rate_24h",
  fleet_worker_hours_24h: "fleet_worker_hours_24h", fleet_median_job_min: "fleet_median_job_min",
  gate_suites: "gate_suites", spend_today_usd: "spend_today_usd",
};

const rd = (p) => { try { return { v: JSON.parse(readFileSync(p, "utf8")) }; } catch (e) { return { err: `${p}: ${e.code || e.message.slice(0, 50)}` }; } };
const okTs = (s) => typeof s === "string" && !Number.isNaN(Date.parse(s));

export function fabricated(ledger) {
  return Object.entries(ledger.n || {}).filter(([, r]) => !r || !r.source || !r.method || !r.label || typeof r.value !== "number" || !Number.isFinite(r.value)).map(([k]) => k);
}

/** Pure. Returns {ledger, report[]}; throws {refused:[keys]} on a fabricated row, {fatal:msg} on an unreadable kernel ts. */
export function regen(ledger, numbers, baselineTs) {
  const bad = fabricated(ledger);
  if (bad.length) throw { refused: bad };
  if (!numbers || !okTs(numbers.ts)) throw { fatal: "NUMBERS.json has no readable ts" };
  const srcTs = numbers.ts;
  const kr = Object.fromEntries((numbers.rows || []).map((r) => [r.key, r]));
  const n = { ...ledger.n };
  const report = [];
  const moved = new Set();
  for (const [k, row] of Object.entries(ledger.n)) {
    const sk = MAP[k];
    if (!sk) { report.push({ key: k, status: "UNMAPPED", old: row.value, new: row.value }); continue; }
    const s = kr[sk];
    if (!s || typeof s.value !== "number" || !Number.isFinite(s.value)) { report.push({ key: k, status: "UNKNOWN", old: row.value, new: null, note: `no numeric ${sk} in NUMBERS.json` }); continue; }
    if (/\bRED\b/.test(String(s.method))) { report.push({ key: k, status: "HELD", old: row.value, new: s.value, note: "kernel method says RED" }); continue; }
    if (s.value === row.value) { report.push({ key: k, status: "UNMOVED", old: row.value, new: s.value }); continue; }
    const next = { ...row, value: s.value, as_of: srcTs, method: s.method, measured: srcTs.slice(0, 10) /*STAMP*/ };
    if (!row.source_path) next.source = s.source;
    n[k] = next; moved.add(k);
    report.push({ key: k, status: "UPDATED", old: row.value, new: s.value, measured: next.measured });
  }
  for (const [k, row] of Object.entries(ledger.n)) {
    if (MAP[k] || !row.derived_from?.length) continue;
    const dep = row.derived_from.filter((d) => moved.has(d));
    if (dep.length) report.find((r) => r.key === k).status = `DERIVED-STALE (inputs moved: ${dep.join(",")})`;
  }
  const out = { ...ledger, n };
  if (moved.size) out.numbers_as_of = srcTs;
  // f393: derived rows recompute from the (refreshed) source rows by the formulas recovered from bin/site_ledger_export.py @ b857355428,
  // stamped MODELLED with the formula text and the source ts of estate_ey (the input that moves them); inputs_as_of lists every input's own date.
  // Any input missing = the DERIVED-STALE report above stands and the rows are left alone (UNKNOWN, never invented).
  const d = deriveRows(n);
  if (d) {
    const stampTs = n.estate_ey.as_of;
    const rep = (k) => report.find((r) => r.key === k);
    for (const k of DERIVED_KEYS) {
      const cur = n[k]; if (!cur) continue;
      const nx = d[k];
      if (cur.value === nx.value && cur.method === nx.method) { rep(k).status = "UNMOVED"; continue; }
      n[k] = { ...cur, value: nx.value, method: nx.method, as_of: stampTs, measured: stampTs.slice(0, 10), inputs_as_of: Object.fromEntries(["estate_ey", "span_days"].filter((x) => n[x]).map((x) => [x, n[x].as_of])), formula_source: SOURCE_EXPORTER };
      if (k !== "elapsed_months" && k !== "compute_build_total_aud") n[k].label = "MODELLED";
      const r = rep(k); r.status = "DERIVED-UPDATED"; r.old = cur.value; r.new = nx.value;
    }
    out.rate_note = d._rate;
    const ft = factTexts(n, ledger.facts);
    if (Object.keys(ft).length) {
      out.facts = { ...ledger.facts };
      for (const [fid, t] of Object.entries(ft)) {
        const cur = ledger.facts[fid];
        if (cur.text === t.text && (!t.method || cur.method === t.method)) continue;
        out.facts[fid] = { ...cur, text: t.text, ...(t.method ? { method: t.method } : {}), as_of: stampTs };
        report.push({ key: `facts.${fid}`, status: "FACT-REGEN", old: cur.text, new: t.text });
      }
    }
  }
  return { ledger: out, report, srcTs, baselineTs };
}

export function table(report, srcPath) {
  const rows = report.filter((r) => r.status !== "UNMAPPED" && r.status !== "UNMOVED");
  const w = (s, n) => String(s).padEnd(n);
  const lines = [w("ROW", 26) + w("OLD", 12) + w("NEW", 12) + w("STATUS", 30) + "SOURCE"];
  for (const r of rows) lines.push(w(r.key, 26) + w(r.old, 12) + w(r.new ?? "-", 12) + w(r.status, 30) + srcPath + (r.note ? ` (${r.note})` : ""));
  const c = (p) => report.filter((r) => r.status.startsWith(p)).length;
  lines.push(`UPDATED ${c("UPDATED")}  UNMOVED ${c("UNMOVED")}  UNKNOWN ${c("UNKNOWN")}  HELD ${c("HELD")}  DERIVED-UPDATED ${c("DERIVED-UPDATED")}  DERIVED-STALE ${c("DERIVED-STALE")}  FACT-REGEN ${c("FACT-REGEN")}  UNMAPPED ${c("UNMAPPED")}`);
  return lines.join("\n");
}

/** --check: internal consistency of the ledger file only (no kernel read). Exit 0 green, 1 red. */
function check(ledgerPath) {
  const lr = rd(ledgerPath);
  if (lr.err) { console.error(`ERROR ledger: ${lr.err}`); process.exit(2); }
  const bad = checkLedger(lr.v);
  // f394: the HUD feed shares figures with the ledger; any shared field that differs is a FAILURE (was a WARN in f393).
  const hud = rd(new URL("../lib/hud/numbers.json", import.meta.url).pathname);
  if (hud.err) bad.push(`lib/hud/numbers.json: ${hud.err}`);
  else for (const d of diffShared(lr.v, hud.v)) bad.push(`HUD single-source (run node scripts/hud_numbers_from_ledger.mjs): ${d}`);
  if (bad.length) { for (const b of bad) console.error("FAIL " + b); console.error(`LEDGER CHECK RED (${bad.length})`); process.exit(1); }
  console.log("LEDGER CHECK GREEN: one estate_ey/estate_sloc in rows and facts text; derived rows equal the recovered formula");
}

function main() {
  const a = process.argv.slice(2);
  const v = (f, d) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : d; };
  const state = v("--kernel-state", `${homedir()}/klinge-kernel/state`);
  const ledgerPath = v("--ledger", new URL("../lib/ledger.json", import.meta.url).pathname);
  if (a.includes("--check")) return check(ledgerPath);
  const nr = rd(`${state}/numbers/NUMBERS.json`);
  if (nr.err) { console.error(`UNKNOWN kernel numbers: ${nr.err}; ledger untouched`); process.exit(2); }
  const bdir = `${state}/baseline`;
  const bf = existsSync(bdir) ? readdirSync(bdir).filter((n) => /^BASELINE_\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().pop() : null;
  const bts = bf ? rd(`${bdir}/${bf}`).v?.ts ?? null : null;
  const lr = rd(ledgerPath);
  if (lr.err) { console.error(`ERROR ledger: ${lr.err}`); process.exit(2); }
  let res;
  try { res = regen(lr.v, nr.v, bts); } catch (e) {
    if (e.refused) { console.error(`REFUSED fabricated ledger row(s) with no source/method/label or non-numeric value: ${e.refused.join(", ")}; nothing written`); process.exit(3); }
    console.error(`ERROR ${e.fatal || e}`); process.exit(2);
  }
  console.log(`kernel numbers ${state}/numbers/NUMBERS.json ts=${nr.v.ts}  baseline ${bf ?? "none"} ts=${bts ?? "-"}`);
  console.log(table(res.report, "state/numbers/NUMBERS.json"));
  if (a.includes("--dry-run")) { console.log("DRY RUN: nothing written"); return; }
  writeFileSync(ledgerPath, JSON.stringify(res.ledger, null, 2) + "\n");
  console.log(`wrote ${ledgerPath}`);
  // f394: the HUD feed follows the ledger in the same run (HUD-only fields untouched).
  // Only for the real ledger (or an explicit --hud): a fixture ledger (--ledger <tmp>) must never rewrite the committed HUD feed.
  const hudPath = v("--hud", a.includes("--ledger") ? null : new URL("../lib/hud/numbers.json", import.meta.url).pathname);
  const hudNow = hudPath ? rd(hudPath) : { err: "skipped" };
  if (!hudNow.err) {
    const { hud: hudNext } = deriveHud(res.ledger, hudNow.v);
    if (serializeHud(hudNext) !== readFileSync(hudPath, "utf8")) { writeFileSync(hudPath, serializeHud(hudNext)); console.log(`wrote ${hudPath}`); }
  }
}
if (process.argv[1] && process.argv[1].endsWith("regen_ledger.mjs")) main();
