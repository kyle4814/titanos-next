// C9 (f395): figure_freshness_forecast predicts the exact day each figure turns STALE. Kill test: on a fixed fixture date the
// output is the known list; --within is exact at its boundaries (a figure turning STALE in exactly N days fires, N+1 does not);
// the date maths agrees with figure_freshness.mjs itself (day 30 FRESH, day 31 STALE); and a planted off-by-one in the forecast
// makes the test fail. Fixtures are synthetic, in a temp folder; --today is fixed so the test never drifts with the real date.
// Run: node scripts/test_figure_freshness_forecast.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { staleOn, forecast, within } from "./figure_freshness_forecast.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const HERE = fileURLToPath(new URL(".", import.meta.url));
const TODAY = "2026-11-10";

const tmp = mkdtempSync(join(tmpdir(), "figfc-"));
if (!tmp || !existsSync(tmp) || !tmp.includes("figfc-")) { console.log("FAIL no safe temp dir"); process.exit(1); }
const put = (root, rel, body) => { const f = join(root, rel); mkdirSync(join(f, ".."), { recursive: true }); writeFileSync(f, typeof body === "string" ? body : JSON.stringify(body, null, 1)); };

// Fixture repo: status.json components carry one date each, so one file gives several turn-over days.
const COMPONENTS = [
  { id: "c_a_day30", lastChecked: "2026-10-11", total: 1 },            // age 30 on TODAY: FRESH, turns STALE 2026-11-11
  { id: "c_b_day29", lastChecked: "2026-10-12", total: 1 },            // turns STALE 2026-11-12
  { id: "c_c_day31", lastChecked: "2026-10-10", total: 1 },            // age 31: already STALE since 2026-11-10
  { id: "c_d_far", lastChecked: "2026-12-01", total: 1 },              // turns STALE 2027-01-01
  { id: "c_e_time", lastChecked: "2026-10-12T08:00:00+10:00", total: 1 }, // time of day ignored: turns STALE 2026-11-12
];
function repo(name, comps) {
  const R = join(tmp, name);
  put(R, "public/data/status.json", { system: "Synthetic status", components: comps });
  put(R, "lib/site-data/status-sample.json", "{}");
  return R;
}
const cli = (args, script = join(HERE, "figure_freshness_forecast.mjs")) => spawnSync("node", [script, ...args], { encoding: "utf8" });
const R = repo("r1", COMPONENTS);

// 1. date maths
ok(staleOn("2026-10-11") === "2026-11-11", "staleOn: 2026-10-11 -> 2026-11-11 (31 days later)");
ok(staleOn("2026-01-31") === "2026-03-03", "staleOn: month end 2026-01-31 -> 2026-03-03");
ok(staleOn("2028-02-01") === "2028-03-03", "staleOn: leap year 2028-02-01 -> 2028-03-03");
ok(staleOn("2026-12-01") === "2027-01-01", "staleOn: year roll 2026-12-01 -> 2027-01-01");
ok(staleOn("2026-10-12T08:00:00+10:00") === "2026-11-12", "staleOn: time of day and offset are ignored (the day as written)");
ok(staleOn("not a date") === null && staleOn("2026-02-30") === null && staleOn(undefined) === null, "staleOn: bad dates give null, never a guess");

// 2. agreement with the gate itself: the forecast day is the first day figure_freshness says STALE
const stateOf = (rep, id) => rep.figures.find((f) => f.id === id)?.flags.includes("STALE");
{
  const g = (asOf) => JSON.parse(spawnSync("node", [join(HERE, "figure_freshness.mjs"), "--root", R, "--as-of", asOf, "--json"], { encoding: "utf8", maxBuffer: 1 << 26 }).stdout);
  const before = g("2026-11-10"), on = g("2026-11-11");
  ok(stateOf(before, "components.c_a_day30") === false && stateOf(on, "components.c_a_day30") === true, "gate agrees: the day-30 figure is FRESH on 2026-11-10 and STALE on its forecast day 2026-11-11");
  ok(stateOf(before, "components.c_c_day31") === true, "gate agrees: the day-31 figure is already STALE on 2026-11-10");
}

// 3. fixed fixture date gives the known list, in turn-over order
const j = JSON.parse(cli(["--today", TODAY, "--root", R, "--json"]).stdout);
const key = (r) => `${r.id}@${r.staleOn}:${r.status}`;
const want = ["components.c_c_day31@2026-11-10:STALE", "components.c_a_day30@2026-11-11:FRESH", "components.c_b_day29@2026-11-12:FRESH", "components.c_e_time@2026-11-12:FRESH", "components.c_d_far@2027-01-01:FRESH"];
ok(JSON.stringify(j.rows.map(key)) === JSON.stringify(want), "known list at 2026-11-10 (ids, exact STALE day, status, sorted): " + j.rows.map(key).join(" | "));
ok(j.rows.every((r) => r.daysUntil === Math.round((Date.parse(r.staleOn) - Date.parse(TODAY)) / 86400000)), "daysUntil is staleOn minus today for every row");
const txt = cli(["--today", TODAY, "--root", R]).stdout;
ok(/TURNS STALE 2026-11-11 \(in 1 day\(s\)\): 1 figure/.test(txt) && /TURNS STALE 2026-11-12 \(in 2 day\(s\)\): 2 figure/.test(txt), "text summary groups the turn-over days");
ok(/WILL TURN STALE 2026-11-11 \(in 1d\) public\/data\/status\.json#components\.c_a_day30 dated 2026-10-11/.test(txt) && /ALREADY STALE since 2026-11-10 .*c_c_day31/.test(txt), "text lists each figure with its exact day, fresh and already-stale apart");

// 4. --within boundaries: fires on a figure turning STALE in exactly N days, not N+1; already-STALE never counts
const w = (n, root = R, today = TODAY) => cli(["--today", today, "--root", root, "--within", String(n), "--quiet"]);
ok(w(0).status === 0, "--within 0: exit 0 (nothing turns STALE in 0 days; the already-STALE figure is not a prediction)");
ok(w(1).status === 1 && /first: 2026-11-11/.test(w(1).stdout), "--within 1: exit 1, the day-30 figure turns STALE in exactly 1 day");
ok(w(2).status === 1, "--within 2: exit 1");
const R2 = repo("r2", COMPONENTS.filter((c) => c.id !== "c_a_day30"));
ok(w(1, R2).status === 0, "--within 1 with the 1-day figure removed: exit 0 (next turn-over is 2 days out)");
ok(w(2, R2).status === 1, "--within 2: exit 1 (a figure turning STALE in exactly 2 days fires)");
ok(w(56, R2).status === 1 && w(1, R2).status === 0, "--within is monotone");
const R3 = repo("r3", [{ id: "only_far", lastChecked: "2026-12-01", total: 1 }]);
// 2026-11-10 -> 2027-01-01 is 52 days: 51 does not reach it, 52 does
ok(w(51, R3).status === 0 && w(52, R3).status === 1, "far figure boundary: 51 days does not reach 2027-01-01 from 2026-11-10, 52 does");
ok(JSON.stringify(within(forecast([{ file: "f", id: "x", date: "2026-10-11" }], TODAY), 1).map((r) => r.id)) === '["x"]', "within() library call agrees with the CLI");

// 5. usage errors exit 2
ok(cli(["--today", "2026-13-40"]).status === 2, "bad --today: exit 2");
ok(cli(["--within", "soon"]).status === 2, "non-numeric --within: exit 2");
ok(cli(["--bogus"]).status === 2, "unknown argument: exit 2");

// 6. it changes nothing: no file under the fixture differs after a run
const before = readFileSync(join(R, "public/data/status.json"), "utf8");
cli(["--today", TODAY, "--root", R, "--within", "5"]);
ok(readFileSync(join(R, "public/data/status.json"), "utf8") === before, "read-only: the data file is untouched");

// 7. mutation: an off-by-one in the forecast (STALE_DAYS + 1 -> STALE_DAYS) must break the known-list check
const M = join(tmp, "mut"); mkdirSync(M, { recursive: true });
copyFileSync(join(HERE, "figure_freshness.mjs"), join(M, "figure_freshness.mjs"));
const src = readFileSync(join(HERE, "figure_freshness_forecast.mjs"), "utf8");
const mutated = src.replace("(STALE_DAYS + 1) * DAY_MS", "(STALE_DAYS + 0) * DAY_MS");
ok(mutated !== src, "mutation planted (31 days -> 30 days)");
writeFileSync(join(M, "figure_freshness_forecast.mjs"), mutated);
const mj = JSON.parse(cli(["--today", TODAY, "--root", R, "--json"], join(M, "figure_freshness_forecast.mjs")).stdout);
ok(JSON.stringify(mj.rows.map(key)) !== JSON.stringify(want), "MUTATION (off-by-one): the known-list check fails, so the test bites");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
