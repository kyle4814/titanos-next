// Fixture test for regen_ledger.mjs (f391). Synthetic kernel dir, synthetic numbers. Includes the mutation test: stamping today must go red.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SCRIPT = path.join(HERE, "regen_ledger.mjs");
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } else console.log("ok   " + m); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rl-"));
let n = 0;
const TS = "2026-10-13T04:05:02";
const row = (value, extra = {}) => ({ value, label: "MEASURED", method: "old method", source: "old source", unit: "u", as_of: "2026-10-09", measured: "2026-10-09", source_path: null, derived_from: [], traceable: false, ...extra });

function fixture({ ledgerN, numbersRows, ts = TS }) {
  const d = path.join(tmp, "f" + n++);
  fs.mkdirSync(path.join(d, "state/numbers"), { recursive: true }); fs.mkdirSync(path.join(d, "state/baseline"), { recursive: true });
  fs.writeFileSync(path.join(d, "state/numbers/NUMBERS.json"), JSON.stringify({ ts, rows: numbersRows }));
  fs.writeFileSync(path.join(d, "state/baseline/BASELINE_2026-11-10.json"), JSON.stringify({ ts: "2026-11-10T13:19:51", rows: [] }));
  const ledger = path.join(d, "ledger.json");
  fs.writeFileSync(ledger, JSON.stringify({ facts_as_of: "2026-10-09", numbers_as_of: "2026-10-09T04:07:49", n: ledgerN }, null, 2) + "\n");
  return { state: path.join(d, "state"), ledger, kernelBefore: fs.readFileSync(path.join(d, "state/numbers/NUMBERS.json"), "utf8") };
}
const run = (fx, extra = [], script = SCRIPT) => spawnSync("node", [script, "--kernel-state", fx.state, "--ledger", fx.ledger, ...extra], { encoding: "utf8" });
const load = (fx) => JSON.parse(fs.readFileSync(fx.ledger, "utf8"));
const krow = (key, value, extra = {}) => ({ key, value, unit: "u", label: "MEASURED", method: "new method", source: "new source", ...extra });

try {
  // 1 moved updates; 2 unmoved untouched; 3 missing source stays UNKNOWN; derived reported
  const fx = fixture({
    ledgerN: { estate_sloc: row(100), fleet_jobs_24h: row(50, { measured: "2026-10-01" }), fleet_median_job_min: row(3), annual_ey: row(7, { derived_from: ["estate_sloc"] }), loose: row(9) },
    numbersRows: [krow("sloc", 120), krow("fleet_jobs_24h", 50)],
  });
  const before = load(fx);
  const r = run(fx);
  const after = load(fx);
  ok(r.status === 0, "run exits 0");
  ok(after.n.estate_sloc.value === 120, "moved number updates");
  ok(after.n.estate_sloc.measured === "2026-10-13" && after.n.estate_sloc.as_of === TS, "stamp is the SOURCE file ts, not today");
  ok(after.n.estate_sloc.method === "new method" && after.n.estate_sloc.source === "new source", "method from kernel; source adopted when row had no source file");
  ok(JSON.stringify(after.n.fleet_jobs_24h) === JSON.stringify(before.n.fleet_jobs_24h), "unmoved number untouched (incl. its measured date)");
  ok(after.n.fleet_median_job_min.value === 3 && after.n.fleet_median_job_min.measured === "2026-10-09", "missing source: row kept, not restamped");
  ok(/fleet_median_job_min\s+3\s+-\s+UNKNOWN/.test(r.stdout), "missing source reported UNKNOWN in the diff table");
  ok(/estate_sloc\s+100\s+120\s+UPDATED\s+state\/numbers\/NUMBERS.json/.test(r.stdout), "diff table shows old, new and source path");
  ok(/annual_ey\s+7\s+7\s+DERIVED-STALE/.test(r.stdout) && after.n.annual_ey.value === 7, "derived row reported stale, value never invented");
  ok(JSON.stringify(after.n.loose) === JSON.stringify(before.n.loose), "unmapped row untouched");
  ok(after.numbers_as_of === TS, "numbers_as_of follows the source ts");
  ok(fs.readFileSync(path.join(fx.state, "numbers/NUMBERS.json"), "utf8") === fx.kernelBefore, "kernel file unchanged (read-only)");
  const dry = fixture({ ledgerN: { estate_sloc: row(100) }, numbersRows: [krow("sloc", 120)] });
  run(dry, ["--dry-run"]);
  ok(load(dry).n.estate_sloc.value === 100, "--dry-run writes nothing");

  // 4 fabricated row refused, nothing written
  const fab = fixture({ ledgerN: { estate_sloc: row(100), planted: { value: 999, label: "MEASURED", unit: "x" } }, numbersRows: [krow("sloc", 120)] });
  const rf = run(fab);
  ok(rf.status === 3 && /REFUSED.*planted/.test(rf.stderr), "planted fabricated row refused (exit 3)");
  ok(load(fab).n.estate_sloc.value === 100, "refusal writes nothing");

  // RED gate held; non-numeric kernel value UNKNOWN
  const red = fixture({ ledgerN: { gate_suites: row(189), core_ey: row(5) }, numbersRows: [krow("gate_suites", 198, { method: "last full kernel gate (RED, x)" }), krow("engineer_years", "n/a")] });
  const rr = run(red);
  ok(load(red).n.gate_suites.value === 189 && /gate_suites.*HELD/.test(rr.stdout), "RED kernel gate row HELD, not published");
  ok(load(red).n.core_ey.value === 5 && /core_ey.*UNKNOWN/.test(rr.stdout), "non-numeric kernel value stays UNKNOWN");

  // missing kernel file: exit 2, ledger untouched
  const nok = fixture({ ledgerN: { estate_sloc: row(100) }, numbersRows: [krow("sloc", 120)] });
  fs.rmSync(path.join(nok.state, "numbers/NUMBERS.json"));
  ok(run(nok).status === 2 && load(nok).n.estate_sloc.value === 100, "missing NUMBERS.json: exit 2, ledger untouched");

  // MUTATION: stamp today instead of source ts -> the stamp assertion must fail
  const src = fs.readFileSync(SCRIPT, "utf8");
  const mut = src.replace('srcTs.slice(0, 10) /*STAMP*/', 'new Date().toISOString().slice(0, 10)');
  ok(mut !== src, "mutation applied to a temp copy");
  const mpath = path.join(tmp, "mut_regen_ledger.mjs");
  fs.writeFileSync(mpath, mut);
  const mfx = fixture({ ledgerN: { estate_sloc: row(100) }, numbersRows: [krow("sloc", 120)] });
  run(mfx, [], mpath);
  ok(load(mfx).n.estate_sloc.measured !== "2026-10-13", "mutation (stamp today) is caught: the real stamp assertion would fail");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(bad ? `FAILED ${bad}` : "ALL PASS");
process.exit(bad ? 1 : 0);
