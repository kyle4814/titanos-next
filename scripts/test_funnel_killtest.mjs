// Tests for scripts/funnel_killtest.mjs. ALL DATA IS SYNTHETIC (ids SYN-*), generated here or in scripts/fixtures/funnel_synthetic.ndjson.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { funnelKillTest as run } from "./funnel_killtest.mjs";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`ok - ${name}`); };
const scan = (k, extra = {}) => JSON.stringify({ event: "scan-instant-run", path: "/scan", scanId: `SYN-${k}`, ts: 1_000_000 + k * 1000, ...extra });
const press = (k, extra = {}) => JSON.stringify({ event: "scan-get-fixed", path: "/scan", scanId: `SYN-${k}`, ts: 1_000_000 + k * 1000 + 1, ...extra });
const build = (scans, pressed) => [...Array.from({ length: scans }, (_, k) => scan(k)), ...Array.from({ length: pressed }, (_, k) => press(k))];

t("exactly 30/1000 PASSES", () => { const r = run(build(1000, 30)); assert.equal(r.verdict, "PASS"); assert.equal(r.first1000_rate, 0.03); assert.equal(r.scans, 1000); assert.equal(r.presses, 30); });
t("29/1000 FAILS", () => { const r = run(build(1000, 29)); assert.equal(r.verdict, "FAIL"); assert.equal(r.first1000_rate, 0.029); });
t("999 scans is PENDING_LIVE even at 100% presses", () => { const r = run(build(999, 999)); assert.equal(r.verdict, "PENDING_LIVE"); assert.equal(r.scans, 999); });
t("duplicate presses count once and are reported", () => {
  const ev = [...build(1000, 29), press(0), press(0), press(5)];
  const r = run(ev); assert.equal(r.presses, 29); assert.equal(r.duplicatePresses, 3); assert.equal(r.verdict, "FAIL");
});
t("orphan presses (no scan, no scanId) are ignored and counted", () => {
  const ev = [...build(1000, 29), press(5000), JSON.stringify({ event: "scan-get-fixed", ts: 5 })];
  const r = run(ev); assert.equal(r.presses, 29); assert.equal(r.orphanPresses, 2); assert.equal(r.verdict, "FAIL");
});
t("out-of-order timestamps: first 1,000 chosen by ts, not arrival", () => {
  const ev = build(1010, 0);
  // press only scans 1000..1009 (the LAST ten by time); they must not count toward the first 1,000
  for (let k = 1000; k < 1010; k++) ev.push(press(k));
  for (let k = 0; k < 30; k++) ev.push(press(k));
  const shuffled = ev.slice().reverse();
  const r = run(shuffled);
  assert.equal(r.first1000_scans, 1000); assert.equal(r.first1000_presses, 30); assert.equal(r.verdict, "PASS"); assert.equal(r.presses, 40);
  assert.deepEqual(run(ev), r, "arrival order must not change the result");
});
t("press arriving before its scan still matches", () => {
  const ev = [press(0), ...build(1000, 0)]; // press line first; ts after scan 0
  assert.equal(run(ev).presses, 1);
});
t("empty input never throws and is PENDING_LIVE with null rates", () => {
  for (const x of ["", "\n\n", [], null, undefined]) { const r = run(x); assert.equal(r.verdict, "PENDING_LIVE"); assert.equal(r.rate, null); assert.equal(r.first1000_rate, null); assert.equal(r.scans, 0); }
});
t("malformed lines are counted and never crash", () => {
  const bad = ["{nope", "[]", "42", "null", '"str"', JSON.stringify({ path: "/" }), JSON.stringify({ event: 5 }),
    JSON.stringify({ event: "scan-instant-run", ts: "not a date" }), JSON.stringify({ event: "scan-instant-run", scanId: 7 }),
    JSON.stringify({ event: "scan-instant-run", scanId: "x", bot: "yes" })];
  const r = run([...bad, ...build(1000, 30)]); assert.equal(r.malformed, bad.length); assert.equal(r.verdict, "PASS");
});
t("bots flagged by the counter reader are excluded (scan and its press)", () => {
  const ev = [...build(1000, 29), scan("BOT1", { bot: true }), press("BOT1"), press("BOT1", { bot: true })];
  const r = run(ev); assert.equal(r.scans, 1000); assert.equal(r.presses, 29); assert.equal(r.verdict, "FAIL"); assert.equal(r.botExcluded, 3);
  assert.equal(r.orphanPresses, 0);
});
t("duplicate scan ids count once", () => {
  const r = run([...build(1000, 30), scan(0), scan(1)]); assert.equal(r.scans, 1000); assert.equal(r.duplicateScans, 2);
});
t("other events (pageview) are ignored, not malformed", () => {
  const r = run([JSON.stringify({ event: "pageview", path: "/" }), ...build(1000, 30)]); assert.equal(r.ignoredOther, 1); assert.equal(r.malformed, 0);
});
t("ISO string timestamps accepted", () => {
  const r = run([JSON.stringify({ event: "scan-instant-run", scanId: "a", ts: "2026-11-01T00:00:00Z" })]); assert.equal(r.scans, 1); assert.equal(r.malformed, 0);
});
t("CLI: fixture file and stdin give the same answer, verdict PASS at 31/1000", () => {
  const f = new URL("./fixtures/funnel_synthetic.ndjson", import.meta.url).pathname;
  const cli = new URL("./funnel_killtest.mjs", import.meta.url).pathname;
  const a = JSON.parse(execFileSync("node", [cli, f]).toString());
  const text = execFileSync("cat", [f]).toString();
  const b = JSON.parse(execFileSync("node", [cli], { input: text }).toString());
  assert.deepEqual(a, b);
  assert.equal(a.verdict, "PASS"); assert.equal(a.first1000_presses, 31); assert.equal(a.scans, 1050); assert.equal(a.presses, 32);
  assert.equal(a.duplicatePresses, 1); assert.equal(a.orphanPresses, 1); assert.equal(a.botExcluded, 1); assert.equal(a.malformed, 1);
  assert.equal(spawnSync("node", [cli, "/nonexistent/x.ndjson"]).status, 2);
});
t("mutation: a 2% bar would wrongly pass 29/1000 (the 3% bar bites)", () => {
  assert.equal(run(build(1000, 29)).verdict, "FAIL");
  assert.ok(29 * 100 >= 2 * 1000);
});
console.log(`${n} passed, 0 failed`);
