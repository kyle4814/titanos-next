// Proof feed re-export gate (f382). Every tile that prints a figure traces to a named source file and row; a planted untraceable number
// fails; a planted stale date renders UNKNOWN; the two feeds regenerate byte-for-byte from their sources; the re-export never writes
// outside the worktree. Synthetic fixtures for the plants; the live check reads only files inside this worktree (kernel read optional).
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { traceRow, isUnknownRow } from "../lib/site-data/traceRow.mjs";
import { markStale, numericLeaks } from "../lib/site-data/markStale.mjs";
import { annotateLedger, untraceableKeys, assertInside } from "./reexport_proof_feed.mjs";

const root = new URL("../", import.meta.url);
const J = (p) => JSON.parse(readFileSync(new URL(p, root), "utf8"));
const load = (p) => J(p);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const today = process.env.PROOF_TODAY || new Date().toISOString().slice(0, 10);

// ---- synthetic fixtures (labelled) ----
const SRC = { ts: "2026-11-10T13:19:51", rows: [{ vector: "fixture RAM", baseline: "5.4 used", now: "10.65 used / 12.83 available of 23.47", kind: "MEASURED", source: "/proc/meminfo", note: "" },
  { vector: "fixture gate", baseline: "n/a", now: "7 s (GREEN, 7 suites) at 2026-11-07T04:14:55", kind: "RECORDED", source: "state/verify_runs.jsonl", note: "" }] };
const fixLoad = () => SRC;
const good = { id: "f_ram", display: "10.65 GB", afterText: "10.65 GB", beforeText: "5.4 GB", date: "2026-11-10", sourceFile: "fx.json", sourceRow: "fixture RAM", label: "MEASURED" };
ok(traceRow(good, fixLoad).length === 0, "fixture: a traceable tile passes");
ok(traceRow({ ...good, display: "99.9 GB", afterText: "99.9 GB" }, fixLoad).some((p) => /not in source row/.test(p)), "PLANT: an untraceable number (99.9 GB) fails");
ok(traceRow({ ...good, sourceFile: undefined }, fixLoad).some((p) => /no sourceFile/.test(p)), "PLANT: a figure with no source file fails");
ok(traceRow({ ...good, sourceRow: "no such row" }, fixLoad).some((p) => /not found/.test(p)), "PLANT: a source row that does not exist fails");
ok(traceRow({ ...good, date: "2026-11-01" }, fixLoad).some((p) => /not supported/.test(p)), "PLANT: a date the source row does not support fails");
ok(traceRow({ id: "g", display: "7 s", date: "2026-11-07", sourceFile: "fx.json", sourceRow: "fixture gate" }, fixLoad).length === 0, "fixture: a date taken from inside the reading is supported");
ok(traceRow({ id: "u", display: "UNKNOWN", value: "UNKNOWN" }, fixLoad).length === 0 && isUnknownRow({ label: "UNKNOWN" }), "an UNKNOWN tile has no figure to trace and passes");
const planted = markStale([{ ...good, before: 5.4, after: 10.65, beforePct: 50, afterPct: 100, date: "2026-09-01" }], "2026-11-10");
ok(planted[0].value === "UNKNOWN" && planted[0].display === "UNKNOWN" && planted[0].after === null && planted[0].lastMeasured === "2026-09-01" && numericLeaks(planted, "2026-11-10").length === 0, "PLANT: a stale date (2026-09-01) renders UNKNOWN with the last-measured date and no figure");

// ---- live feed ----
const proof = J("lib/site-data/proof.json");
const rows = [...proof.charts, ...proof.stars, proof.headline];
const bad = rows.flatMap((r) => traceRow(r, load));
ok(bad.length === 0, `every non-UNKNOWN proof.json tile (${rows.filter((r) => !isUnknownRow(r)).length} of ${rows.length}) traces to a source file, row, figure and date` + (bad.length ? " :: " + bad.join(" | ") : ""));
const rendered = markStale(rows, today);
const renderedBad = rendered.filter((r) => !isUnknownRow(r)).flatMap((r) => traceRow(r, load));
ok(renderedBad.length === 0, `after markStale on ${today}, every tile that still shows a figure traces to a file`);
ok(rows.every((r) => r.sourceFile && r.sourceRow && /^\d{4}-\d{2}-\d{2}$/.test(r.date)), "every tile, UNKNOWN or not, names its sourceFile, sourceRow and measured date");
ok(proof.charts.filter((c) => c.label === "UNKNOWN").every((c) => c.before === null && c.after === null && c.afterText === "UNKNOWN"), "a chart with no reading stays UNKNOWN: null figures, no value invented");
ok(proof.stars.find((s) => s.id === "s_tokens").display === "UNKNOWN" && proof.stars.find((s) => s.id === "s_usd_today").display === "UNKNOWN", "readings the baseline calls UNKNOWN (0 sessions, no jobs in window) stay UNKNOWN");
console.log(`REPORT ${rendered.filter((r) => r.value === "UNKNOWN").length} of ${rows.length} tiles render UNKNOWN on ${today}; ${rendered.filter((r) => !isUnknownRow(r)).length} show a traced figure`);

// ---- ledger.json ----
const ledger = J("lib/ledger.json");
const lrows = Object.entries(ledger.n);
ok(lrows.every(([, r]) => /^\d{4}-\d{2}-\d{2}$/.test(r.measured || "") && r.measured === String(r.as_of).slice(0, 10) && "source_path" in r && typeof r.traceable === "boolean"), `every ledger.json row (${lrows.length}) carries measured, source_path and traceable`);
const kernel = process.env.KERNEL_DIR || `${homedir()}/klinge-kernel`;
if (existsSync(kernel)) ok(lrows.filter(([, r]) => r.source_path).every(([, r]) => existsSync(`${kernel}/${r.source_path}`)), "every ledger.json source_path is a real kernel file"); else console.log("SKIP kernel not readable here, source_path existence not checked");
ok(untraceableKeys(ledger).length <= 9, `ledger rows with no source file are flagged traceable:false and capped (${untraceableKeys(ledger).length} of ${lrows.length}: ${untraceableKeys(ledger).join(", ")})`);
const fx = annotateLedger({ n: { a: { value: 1, source: "state/x.json (n)", as_of: "2026-11-10T01:02:03" }, b: { value: 2, source: "a; nothing", as_of: "2026-11-10" }, c: { value: 3, source: "typed by hand", as_of: "2026-11-10" } } }, "/k", (p) => p === "/k/state/x.json");
ok(fx.n.a.source_path === "state/x.json" && fx.n.a.traceable && fx.n.b.derived_from[0] === "a" && fx.n.b.traceable && fx.n.c.traceable === false && fx.n.a.value === 1 && fx.n.c.value === 3, "annotateLedger: finds a real file, follows derivation, flags a hand-typed row untraceable, never changes a value");

// ---- write guard + determinism ----
let threw = false; try { assertInside("/tmp/outside.json"); } catch { threw = true; }
ok(threw && assertInside(new URL("lib/ledger.json", root).pathname).endsWith("lib/ledger.json"), "assertInside refuses a write outside the worktree");
const run = (s, a) => spawnSync("node", [`scripts/${s}`, ...a], { cwd: root.pathname, encoding: "utf8" });
ok(run("gen_proof_data.mjs", ["--check"]).status === 0, "proof.json regenerates byte-for-byte from the newest baseline snapshot (gen_proof_data --check)");
const rc = run("reexport_proof_feed.mjs", ["--check"]);
ok(rc.status === 0, "both feeds are current (reexport_proof_feed --check)" + (rc.status ? " :: " + rc.stderr : ""));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
