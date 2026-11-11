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
  return { ledger: out, report, srcTs, baselineTs };
}

export function table(report, srcPath) {
  const rows = report.filter((r) => r.status !== "UNMAPPED" && r.status !== "UNMOVED");
  const w = (s, n) => String(s).padEnd(n);
  const lines = [w("ROW", 26) + w("OLD", 12) + w("NEW", 12) + w("STATUS", 30) + "SOURCE"];
  for (const r of rows) lines.push(w(r.key, 26) + w(r.old, 12) + w(r.new ?? "-", 12) + w(r.status, 30) + srcPath + (r.note ? ` (${r.note})` : ""));
  const c = (p) => report.filter((r) => r.status.startsWith(p)).length;
  lines.push(`UPDATED ${c("UPDATED")}  UNMOVED ${c("UNMOVED")}  UNKNOWN ${c("UNKNOWN")}  HELD ${c("HELD")}  DERIVED-STALE ${c("DERIVED")}  UNMAPPED ${c("UNMAPPED")}`);
  return lines.join("\n");
}

function main() {
  const a = process.argv.slice(2);
  const v = (f, d) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : d; };
  const state = v("--kernel-state", `${homedir()}/klinge-kernel/state`);
  const ledgerPath = v("--ledger", new URL("../lib/ledger.json", import.meta.url).pathname);
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
}
if (process.argv[1] && process.argv[1].endsWith("regen_ledger.mjs")) main();
