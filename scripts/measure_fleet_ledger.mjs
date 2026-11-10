// measure_fleet_ledger.mjs: re-measures the fleet row from the worker job ledger (READ-ONLY on the kernel ledger) and writes
// lib/site-data/source/FLEET_LEDGER_<day>.json, the snapshot gen_proof_data.mjs reads. Same definitions as klinge-kernel
// bin/numbers_ledger.py fleet_rows(): finished = done + fail + stuck; fail rate = (fail + stuck) / finished; median = start->done.
// The ledger's own clock is naive local time (AEST); the window is one complete calendar day, so the denominator is exactly 24 h.
// Usage: node scripts/measure_fleet_ledger.mjs --day 2026-10-12 [--ledger PATH] [--write]   (no --write: print only)
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const day = arg("--day", "2026-10-12");
const path = arg("--ledger", `${homedir()}/klinge-kernel/state/fleet/ledger.jsonl`);
const text = readFileSync(path, "utf8");
const rows = text.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
const inDay = (r) => String(r.ts).slice(0, 10) === day;
const w = rows.filter(inDay);
const n = (ev) => w.filter((r) => r.event === ev).length;
const done = n("done"), fail = n("fail"), stuck = n("stuck");
const finished = done + fail + stuck;

const starts = new Map(), mins = [];
for (const r of rows) {
  const k = `${r.acct}|${r.name}`;
  if (r.event === "start") starts.set(k, r.ts);
  else if (r.event === "done" && starts.has(k) && inDay(r)) {
    const dt = (Date.parse(r.ts) - Date.parse(starts.get(k))) / 60000;
    starts.delete(k);
    if (Number.isFinite(dt)) mins.push(dt);
  }
}
mins.sort((a, b) => a - b);
const median = mins.length ? (mins.length % 2 ? mins[(mins.length - 1) / 2] : (mins[mins.length / 2 - 1] + mins[mins.length / 2]) / 2) : null;
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
const out = {
  system: "TitanOS worker fleet job ledger (two accounts)",
  measuredAt: day,
  window: `${day} 00:00 to 23:59 local (one complete calendar day, 24 h)`,
  method: "Count ledger events dated that day: finished = done + fail + stuck; jobs an hour = finished / 24; fail rate = (fail + stuck) / finished; median = start to done minutes (starts paired across days).",
  counts: { done, fail, stuck, finished, startToDonePairs: mins.length },
  jobsPerHour: r2(finished / 24),
  failRatePct: r1((100 * (fail + stuck)) / Math.max(1, finished)),
  medianMinutes: median === null ? null : r1(median),
  ledger: { lines: rows.length, firstTs: rows[0].ts, lastTs: rows[rows.length - 1].ts, sha256: createHash("sha256").update(text).digest("hex").slice(0, 16) },
  liveNow: `UNKNOWN: the ledger stopped writing at ${rows[rows.length - 1].ts}, so there is no current-day reading to quote`,
};
console.log(JSON.stringify(out, null, 1));
if (process.argv.includes("--write")) writeFileSync(new URL(`../lib/site-data/source/FLEET_LEDGER_${day}.json`, import.meta.url), JSON.stringify(out, null, 1) + "\n");
