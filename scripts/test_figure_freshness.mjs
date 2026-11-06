// Gate for scripts/figure_freshness.mjs. Kill test: a figure with no date, a bad date, or a source that does not exist
// fails the run; day 30 is fresh and day 31 is stale; deleting a source file turns a figure ORPHAN.
// All fixtures are synthetic and live in a temp folder; the as-of date is fixed so the test never drifts.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { scan, parseIsoDay, classifyDate, checkSource, STALE_DAYS } from "./figure_freshness.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const ASOF = "2026-11-07";
const CLI = fileURLToPath(new URL("./figure_freshness.mjs", import.meta.url));
const DASH = /[–—]/;

const tmp = mkdtempSync(join(tmpdir(), "figfresh-"));
if (!tmp || !existsSync(tmp) || !tmp.includes("figfresh-")) { console.log("FAIL no safe temp dir"); process.exit(1); }
const put = (root, rel, body) => { const f = join(root, rel); mkdirSync(join(f, ".."), { recursive: true }); writeFileSync(f, typeof body === "string" ? body : JSON.stringify(body, null, 1)); };
const day = (n) => { const d = new Date(Date.UTC(2026, 10, 7) - n * 86400000); return d.toISOString().slice(0, 10); };
const run = (root, extra = []) => spawnSync("node", [CLI, "--root", root, "--as-of", ASOF, ...extra], { encoding: "utf8" });

// 1. date parsing
ok(parseIsoDay("2026-11-07") === Date.UTC(2026, 10, 7), "valid ISO day parses");
ok(parseIsoDay("2026-10-08T12:52:57") !== null && parseIsoDay("2026-11-06T08:00:00+10:00") !== null && parseIsoDay("2026-11-06T08:00:00Z") !== null, "ISO date-times with and without offset parse");
for (const bad of ["8 Oct 2026", "2026/10/08", "20261008", "2026-10-8", "2026-02-30", "2026-13-01", "2026-00-10", "2026-10-08T25:00:00", "2026-10-08T12:60:00", "2026-10-08T12:00:00+25:00", "yesterday", "", " ", "07-11-2026", 20261008, null, undefined, {}]) {
  const c = classifyDate(bad, parseIsoDay(ASOF));
  ok(c.flag === "UNDATED", `bad date ${JSON.stringify(bad)} is UNDATED`);
}
ok(parseIsoDay("2028-02-29") !== null && parseIsoDay("2027-02-29") === null, "leap day 2028 is real, 2027 is not");

// 2. the 30-day boundary
const asOfDay = parseIsoDay(ASOF);
ok(STALE_DAYS === 30, "stale threshold is 30 days");
ok(classifyDate(day(0), asOfDay).flag === null, "day 0 is fresh");
ok(classifyDate(day(29), asOfDay).flag === null, "day 29 is fresh");
ok(classifyDate(day(30), asOfDay).flag === null, "day 30 is FRESH");
ok(classifyDate(day(31), asOfDay).flag === "STALE", "day 31 is STALE");
ok(classifyDate(day(400), asOfDay).flag === "STALE", "day 400 is STALE");
ok(classifyDate(day(-1), asOfDay).flag === "FUTURE", "tomorrow is FUTURE");
ok(classifyDate("2026-11-07T23:59:59+10:00", asOfDay).flag === null, "later time on the as-of day is not future (calendar day as written)");
ok(classifyDate("2026-11-08T00:00:00", asOfDay).flag === "FUTURE", "next calendar day is FUTURE");

// 3. fixtures for each state, through the trust.json adapter (one shared system + asOf, a source per section)
function trustFixture(root, asOf, sections, system = "Synthetic test system") {
  put(root, "lib/site-data/trust.json", { asOf, system, sections });
}
const R = join(tmp, "repo"), RC = join(tmp, "receipts");
put(R, "app/real.txt", "x"); put(R, "docs/notes.md", "x"); put(RC, "state/numbers/NUMBERS.json", "{}");
const states = (r) => Object.fromEntries(r.figures.map((f) => [f.id.replace("sections.", ""), f.state]));

trustFixture(R, day(3), [
  { id: "fresh", source: "docs/notes.md" },
  { id: "orphan", source: "docs/missing.md" },
  { id: "nosource" },
  { id: "inreceipts", source: "state/numbers/NUMBERS.json" },
]);
let r = scan({ root: R, receipts: RC, asOf: ASOF, adapters: [{ file: "lib/site-data/trust.json", surface: "t", fn: (await import("./figure_freshness.mjs")).ADAPTERS.find((a) => a.file === "lib/site-data/trust.json").fn }] });
let st = states(r);
ok(st.fresh === "FRESH", "figure with existing repo source, date and system is FRESH");
ok(st.orphan === "ORPHAN", "source path that does not exist is ORPHAN");
ok(st.nosource === "ORPHAN", "no source at all is ORPHAN");
ok(st.inreceipts === "FRESH", "source found only in the --receipts folder is FRESH");
ok(r.exitCode === 1 && r.failing.length === 2, "exit 1 with exactly the two ORPHAN figures failing");
ok(scan({ root: R, asOf: ASOF }).figures.find((f) => f.id === "sections.inreceipts").state === "ORPHAN", "without --receipts the receipts-only source is ORPHAN");

// stale / undated / future / nosystem at file level
const cases = [
  [day(30), "FRESH", 0], [day(31), "STALE", 0], ["8 Oct 2026", "UNDATED", 1], [undefined, "UNDATED", 1], [day(-2), "FUTURE", 0],
];
for (const [asOf, want, code] of cases) {
  trustFixture(R, asOf, [{ id: "a", source: "docs/notes.md" }]);
  const o = run(R);
  ok(o.status === code && scan({ root: R, asOf: ASOF }).figures[0].state === want, `file date ${JSON.stringify(asOf)} gives ${want}, exit ${code}`);
}
trustFixture(R, day(1), [{ id: "a", source: "docs/notes.md" }], "");
ok(run(R).status === 1 && scan({ root: R, asOf: ASOF }).figures[0].state === "NOSYSTEM", "missing system name is NOSYSTEM and fails");
trustFixture(R, undefined, [{ id: "a", source: "docs/missing.md" }]);
{ const f = scan({ root: R, asOf: ASOF }).figures[0]; ok(f.state === "UNDATED" && f.flags.includes("ORPHAN"), "UNDATED and ORPHAN together: primary UNDATED, both flags kept"); }

// STALE is a warning only: exit 0 and listed
trustFixture(R, day(45), [{ id: "a", source: "docs/notes.md" }]);
{ const o = run(R); ok(o.status === 0 && /WARN STALE/.test(o.stdout) && /STALE 1/.test(o.stdout), "STALE only: exit 0, listed as a WARN"); }
trustFixture(R, day(-5), [{ id: "a", source: "docs/notes.md" }]);
{ const o = run(R); ok(o.status === 0 && /WARN FUTURE/.test(o.stdout), "FUTURE only: exit 0, listed as a WARN"); }

// 4. mutation test: delete a source file, the figure turns ORPHAN and the run fails
put(R, "docs/victim.md", "x");
trustFixture(R, day(2), [{ id: "v", source: "docs/victim.md" }]);
{ const a = run(R); rmSync(join(R, "docs/victim.md")); const b = run(R);
  ok(a.status === 0 && b.status === 1 && /ORPHAN/.test(b.stdout), "mutation: deleting the source file turns FRESH into ORPHAN and exit 0 into exit 1"); }
// mutation on a receipts-only source
trustFixture(R, day(2), [{ id: "v", source: "state/numbers/NUMBERS.json" }]);
{ const a = run(R, ["--receipts", RC]); rmSync(join(RC, "state/numbers/NUMBERS.json")); const b = run(R, ["--receipts", RC]);
  ok(a.status === 0 && b.status === 1, "mutation: deleting the receipts-folder source also turns it ORPHAN"); }

// 5. Proof Wall shape: generated.from paths, per-figure date and source as system
put(R, "lib/site-data/source/B.json", "{}");
put(R, "lib/site-data/proof.json", { generated: { from: ["lib/site-data/source/B.json"] }, headline: { id: "h", source: "Sys A", date: day(5) }, charts: [{ id: "c1", source: "Sys B", date: day(40) }, { id: "c2", source: "Sys C" }], stars: [] });
rmSync(join(R, "lib/site-data/trust.json"));
{ const x = scan({ root: R, asOf: ASOF }); const s = Object.fromEntries(x.figures.map((f) => [f.id, f.state]));
  ok(s.headline === "FRESH" && s["charts.c1"] === "STALE" && s["charts.c2"] === "UNDATED" && x.exitCode === 1, "proof.json: fresh, stale and undated figures classified, exit 1 on the undated one");
  rmSync(join(R, "lib/site-data/source/B.json"));
  const y = scan({ root: R, asOf: ASOF }); ok(y.figures.find((f) => f.id === "headline").state === "ORPHAN", "proof.json: deleting a generated.from source orphans every figure"); }

// 6. investor ledger: derived sources, brackets, URLs, bare tool names
put(R, "bin/tool.py", "x");
put(R, "lib/ledger.json", { generated_by: "synthetic exporter", facts_as_of: day(2), n: {
  base: { as_of: day(2), source: "bin/tool.py (extra words, other.py)", value: 1 },
  derived: { as_of: day(2), source: "base", value: 2 },
  chain: { as_of: day(2), source: "base, derived", value: 3 },
  ext: { as_of: day(2), source: "support.example.com/en/articles/1", value: 4 },
  loopa: { as_of: day(2), source: "loopb", value: 5 }, loopb: { as_of: day(2), source: "loopa", value: 6 },
  prose: { as_of: day(2), source: "git archive at both dates", value: 7 },
  badparent: { as_of: day(2), source: "prose", value: 8 } }, facts: {} });
rmSync(join(R, "lib/site-data/proof.json"));
{ const x = scan({ root: R, asOf: ASOF }); const s = Object.fromEntries(x.figures.map((f) => [f.id, f.state]));
  ok(s["n.base"] === "FRESH", "ledger: bracketed commentary is not treated as a source path");
  ok(s["n.derived"] === "FRESH" && s["n.chain"] === "FRESH", "ledger: a figure derived from a sourced figure is FRESH");
  ok(s["n.ext"] === "FRESH" && x.externalSources === 1, "ledger: external URL source passes and is counted separately");
  ok(s["n.loopa"] === "ORPHAN" && s["n.loopb"] === "ORPHAN", "ledger: derivation loop is ORPHAN, not an infinite recursion");
  ok(s["n.prose"] === "ORPHAN" && s["n.badparent"] === "ORPHAN", "ledger: prose source is ORPHAN and so is anything derived from it");
  rmSync(join(R, "bin/tool.py")); const y = scan({ root: R, asOf: ASOF });
  ok(y.figures.find((f) => f.id === "n.base").state === "ORPHAN" && y.figures.find((f) => f.id === "n.chain").state === "ORPHAN", "mutation: deleting bin/tool.py orphans the base figure and everything derived from it"); }

// 7. status data: components with no checks are skipped, checked ones need a date
put(R, "lib/site-data/status-sample.json", "{}");
put(R, "public/data/status.json", { system: "Synthetic status", components: [{ id: "ok", total: 10, lastChecked: day(1) }, { id: "none", total: 0, lastChecked: null }, { id: "nodate", total: 5, lastChecked: null }] });
rmSync(join(R, "lib/ledger.json"));
{ const x = scan({ root: R, asOf: ASOF }); const s = Object.fromEntries(x.figures.map((f) => [f.id, f.state]));
  ok(s["components.ok"] === "FRESH" && s["components.nodate"] === "UNDATED" && !("components.none" in s) && x.skippedNoNumber.length === 1, "status: zero-check component is skipped (no figure), a checked one without a date is UNDATED"); }

// 8. globs, empty tree, bad CLI usage, copy hygiene
put(R, "public/proof/a.log", "x");
put(R, "lib/site-data/provenance.json", { _note: "x", "/proof": { system: "S", date: day(1), source: "public/proof/*.log" }, "/gone": { system: "S", date: day(1), source: "public/nothing/*.log" } });
rmSync(join(R, "public/data/status.json"));
{ const x = scan({ root: R, asOf: ASOF }); const s = Object.fromEntries(x.figures.map((f) => [f.id, f.state])); ok(s["/proof"] === "FRESH" && s["/gone"] === "ORPHAN", "glob sources: a match is FRESH, no match is ORPHAN"); }
{ const E = join(tmp, "empty"); mkdirSync(E); const x = scan({ root: E, asOf: ASOF }); ok(x.figures.length === 0 && x.scanned.length === 0 && x.exitCode === 0 && x.notPresent.length > 0, "empty tree: nothing scanned, nothing flagged, absent files listed"); }
ok(spawnSync("node", [CLI, "--root", R, "--as-of", "07/11/2026"], { encoding: "utf8" }).status === 2, "bad --as-of exits 2");
ok(spawnSync("node", [CLI, "--root", R, "--as-of", ASOF, "--receipts", join(tmp, "nope")], { encoding: "utf8" }).status === 2, "missing --receipts folder exits 2");
ok(spawnSync("node", [CLI, "--bogus"], { encoding: "utf8" }).status === 2, "unknown flag exits 2");
{ const o = spawnSync("node", [CLI, "--root", R, "--as-of", ASOF, "--json"], { encoding: "utf8" }); let j; try { j = JSON.parse(o.stdout); } catch { j = null; } ok(j && j.asOf === ASOF && Array.isArray(j.figures), "--json emits parseable JSON"); }
ok(!DASH.test(run(R).stdout) && !DASH.test(await (await import("node:fs/promises")).readFile(CLI, "utf8")), "no em or en dashes in the script or its output");

// 9. real repo data: the scan runs, scans the known files and every figure carries a state (counts are reported by the CLI, not asserted)
{ const root = fileURLToPath(new URL("../", import.meta.url)); const x = scan({ root, asOf: ASOF });
  ok(x.scanned.includes("lib/site-data/proof.json") && x.scanned.includes("lib/ledger.json") && x.figures.length > 50, `real repo: ${x.scanned.length} data files, ${x.figures.length} figures scanned`);
  ok(x.figures.every((f) => ["FRESH", "STALE", "UNDATED", "ORPHAN", "NOSYSTEM", "FUTURE"].includes(f.state)), "real repo: every figure has a state"); }

rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
