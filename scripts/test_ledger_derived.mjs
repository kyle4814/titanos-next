// test_ledger_derived.mjs (f393): derived ledger rows + facts text follow the refreshed source rows.
//  1 faithful port: formulas at estate_ey 60.6 reproduce the retired exporter's own rows and methods (fixture from the pre-refresh ledger)
//  2 committed lib/ledger.json: one estate_ey / estate_sloc in rows AND facts text; derived rows == formula(rows)
//  3 MUTATION: change one input, every dependent derived row moves; a ledger with a stale derived row or stale fact text is caught by checkLedger
//  4 regen on a mixed ledger (old derived rows) fixes it, stamps MODELLED + source ts, is idempotent, kernel untouched; missing input stays UNKNOWN
//  5 --check CLI exit codes
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { deriveRows, factTexts, checkLedger, DERIVED_KEYS } from "./ledger_derive.mjs";
import { regen } from "./regen_ledger.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const LEDGER = path.join(HERE, "../lib/ledger.json");
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } else console.log("ok   " + m); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const rows = (n) => Object.fromEntries(Object.entries(n).map(([k, r]) => [k, { value: r.value }]));

// 1 faithful port
const fx = JSON.parse(fs.readFileSync(path.join(HERE, "fixtures/ledger_pre_refresh_60_6.json"), "utf8"));
const d60 = deriveRows(rows(fx.n));
ok(d60 && fx.n.estate_ey.value === 60.6, "fixture is the pre-refresh ledger (estate_ey 60.6)");
for (const k of DERIVED_KEYS) ok(d60[k].value === fx.n[k].value && d60[k].method === fx.n[k].method, `port reproduces exporter row ${k} = ${fx.n[k].value}`);
ok(d60._rate === fx.rate_note, "rate_note reproduced");

// 2 the committed ledger
const ledger = JSON.parse(fs.readFileSync(LEDGER, "utf8"));
const probs = checkLedger(ledger);
ok(probs.length === 0, "committed lib/ledger.json passes checkLedger" + (probs.length ? ": " + probs.slice(0, 3).join(" | ") : ""));
const ey = ledger.n.estate_ey.value, sloc = ledger.n.estate_sloc.value;
ok(!/60\.6 engineer-years|230,797|230\.8 KSLOC/.test(JSON.stringify(ledger)), "no old 60.6 / 230,797 / 230.8 KSLOC anywhere in ledger.json");
ok(ledger.facts.estate_ey.text.includes(`${ey} engineer-years`) && ledger.facts.estate.text.includes(sloc.toLocaleString("en-US")), "facts text carries the row values");
const dl = deriveRows(rows(ledger.n));
for (const k of DERIVED_KEYS) ok(ledger.n[k].value === dl[k].value && ledger.n[k].method === dl[k].method, `ledger ${k} == formula(rows)`);
for (const k of DERIVED_KEYS.filter((x) => x !== "elapsed_months" && x !== "compute_build_total_aud")) {
  const r = ledger.n[k];
  ok(r.label === "MODELLED" && r.as_of === ledger.n.estate_ey.as_of && r.measured === ledger.n.estate_ey.as_of.slice(0, 10) && r.formula_source?.includes("site_ledger_export.py"), `${k} stamped MODELLED, source ts ${ledger.n.estate_ey.as_of}, formula source named`);
}

// 3 mutation: one input moves, derived rows move; stale rows/text are caught
const m1 = rows(ledger.n); m1.estate_ey.value = ey + 10;
const dm = deriveRows(m1);
const moved = DERIVED_KEYS.filter((k) => dm[k].value !== dl[k].value);
const mustMove = ["model_effort_pm", "model_schedule_months", "model_team", "speed_x", "team_smaller_x", "build_cost_aud", "annual_ey", "annual_cost_aud", "annual_cost_10pct_aud", "annual_cost_2pct_aud", "per_dollar_build_x", "per_dollar_today_x", "per_dollar_full_x", "per_dollar_full_today_x"];
ok(mustMove.every((k) => moved.includes(k)), "MUTATION estate_ey+10: all 14 dependent derived rows move (" + moved.length + " moved)");
ok(!moved.includes("elapsed_months") && !moved.includes("compute_build_total_aud"), "MUTATION estate_ey+10: span-only rows do not move");
const m2 = rows(ledger.n); m2.span_days.value = 100;
const dm2 = deriveRows(m2);
ok(["elapsed_months", "speed_x", "annual_ey", "annual_cost_aud", "compute_build_total_aud"].every((k) => dm2[k].value !== dl[k].value) && dm2.model_team.value === dl.model_team.value, "MUTATION span_days: time-based rows move, model_team does not");
const stale = clone(ledger); stale.n.build_cost_aud.value += 10000;
ok(checkLedger(stale).some((p) => p.startsWith("build_cost_aud")), "a hand-edited derived row is caught");
const staleEy = clone(ledger); staleEy.n.estate_ey.value = 60.6;
ok(checkLedger(staleEy).length > 3, "estate_ey row moved without derived rows/facts: caught");
const staleFact = clone(ledger); staleFact.facts.estate_cost.text = "A conventional team would charge about AU$31.6 million to build it.";
ok(checkLedger(staleFact).some((p) => p.includes("estate_cost")), "stale estate_cost fact text caught");
const miss = clone(ledger); delete miss.n.span_days;
ok(deriveRows(rows(miss.n)) === null && checkLedger(miss).some((p) => /UNKNOWN/.test(p)), "missing input: derivation null, check reports UNKNOWN (never invented)");

// 4 regen on the mixed (pre-fix) ledger
const mixed = clone(ledger);
for (const k of DERIVED_KEYS) { mixed.n[k] = clone(fx.n[k] ? { ...ledger.n[k], value: fx.n[k].value, method: fx.n[k].method, as_of: "2026-10-09", measured: "2026-10-09" } : ledger.n[k]); delete mixed.n[k].formula_source; delete mixed.n[k].inputs_as_of; }
mixed.rate_note = fx.rate_note;
mixed.facts.estate.text = mixed.facts.estate.text.replace(sloc.toLocaleString("en-US"), "230,797");
mixed.facts.estate_ey.text = mixed.facts.estate_ey.text.replace(`${ey}`, "60.6");
mixed.facts.estate_ey.method = mixed.facts.estate_ey.method.replace(/on [\d.]+ KSLOC/, "on 230.8 KSLOC");
mixed.facts.estate_cost.text = "A conventional team would charge about AU$31.6 million to build it.";
mixed.facts.estate_cost.method = mixed.facts.estate_cost.method.replace(`${ey}`, "60.6");
ok(checkLedger(mixed).length > 10, "mixed ledger (new rows, old derived + old facts) is RED before regen");
const numbers = { ts: ledger.n.estate_ey.as_of, rows: [] };
const r1 = regen(mixed, numbers, null);
ok(checkLedger(r1.ledger).length === 0, "regen turns the mixed ledger GREEN");
ok(r1.report.filter((r) => r.status === "DERIVED-UPDATED").length === 14, "14 derived rows reported DERIVED-UPDATED");
ok(r1.report.filter((r) => r.status === "FACT-REGEN").length === 3, "3 fact texts regenerated");
ok(JSON.stringify(r1.ledger.n.build_cost_aud) === JSON.stringify(ledger.n.build_cost_aud), "regen result equals committed derived row (build_cost_aud)");
const r2 = regen(r1.ledger, numbers, null);
ok(JSON.stringify(r2.ledger) === JSON.stringify(r1.ledger), "idempotent: second regen changes nothing");
const noSpan = clone(mixed); delete noSpan.n.span_days;
const r3 = regen(noSpan, numbers, null);
ok(r3.ledger.n.build_cost_aud.value === 10670000, "missing span_days: derived rows left as they were (UNKNOWN, not invented)");

// 5 CLI
const run = (args) => spawnSync("node", [path.join(HERE, "regen_ledger.mjs"), ...args], { encoding: "utf8" });
ok(run(["--check"]).status === 0 && /LEDGER CHECK GREEN/.test(run(["--check"]).stdout), "regen_ledger.mjs --check exits 0 on the committed ledger");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ld-"));
try {
  const p = path.join(tmp, "l.json"); fs.writeFileSync(p, JSON.stringify(mixed));
  const rc = run(["--check", "--ledger", p]);
  ok(rc.status === 1 && /LEDGER CHECK RED/.test(rc.stderr), "--check exits 1 on the mixed ledger");
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

console.log(bad ? `FAILED ${bad}` : "ALL PASS");
process.exit(bad ? 1 : 0);
