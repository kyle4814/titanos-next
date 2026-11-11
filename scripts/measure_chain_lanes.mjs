// measure_chain_lanes.mjs: re-measures the "fleet" row from the build-lane status record (READ-ONLY on the kernel state) and
// writes lib/site-data/source/LANES_<day>.json, the snapshot gen_proof_data.mjs reads. The old worker job ledger stopped writing
// on 2026-10-13; work now runs as chain lanes. Each lane has <id>.status (DONE <ts> | FAILED <n> <ts> | RUNNING ...) and
// <id>.tries (one "<ts> try <n>" line per start). Definitions, kept parallel to the old ledger row:
//   finished = lanes whose final status (DONE or FAILED) is stamped on that calendar day (local clock, +10:00 as written)
//   lanes an hour = finished / 24;  fail rate = FAILED / finished;  median = latest start before the finish, to the finish, in minutes
// A lane that failed and was then re-run shows its final status only, so the fail rate is a floor. RUNNING lanes are not counted.
// Usage: node scripts/measure_chain_lanes.mjs --day 2026-11-10 [--root PATH] [--write]   (no --write: print only)
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const day = arg("--day");
if (!/^\d{4}-\d{2}-\d{2}$/.test(day || "")) throw new Error("--day YYYY-MM-DD is required (a complete past day)");
const root = arg("--root", `${homedir()}/klinge-kernel/state/charter`);
const DIRS = ["chain", "chains/enterprise", "chains/website"];
const TS = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2})?/;

let done = 0, failed = 0, running = 0, lanes = 0;
const mins = [], digest = [];
for (const d of DIRS) {
  const dir = `${root}/${d}`;
  if (!existsSync(dir)) throw new Error(`lane directory missing: ${dir}`);
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".status")).sort()) {
    lanes++;
    const line = readFileSync(`${dir}/${f}`, "utf8").split("\n")[0].trim();
    const word = line.split(/\s+/)[0];
    const ts = (line.match(TS) || [])[0];
    digest.push(`${d}/${f} ${word} ${ts ?? ""}`);
    if (word === "RUNNING") { running++; continue; }
    if (!ts || ts.slice(0, 10) !== day || (word !== "DONE" && word !== "FAILED")) continue;
    if (word === "DONE") done++; else failed++;
    const tf = `${dir}/${f.replace(/\.status$/, ".tries")}`;
    if (word === "DONE" && existsSync(tf)) {
      const fin = Date.parse(ts);
      const starts = readFileSync(tf, "utf8").split("\n").map((l) => (l.match(TS) || [])[0]).filter(Boolean).map(Date.parse).filter((t) => t <= fin);
      if (starts.length) mins.push((fin - Math.max(...starts)) / 60000);
    }
  }
}
mins.sort((a, b) => a - b);
const median = mins.length ? (mins.length % 2 ? mins[(mins.length - 1) / 2] : (mins[mins.length / 2 - 1] + mins[mins.length / 2]) / 2) : null;
const finished = done + failed;
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
const out = {
  system: "TitanOS build lanes (status record of every lane)",
  measuredAt: day,
  window: `${day} 00:00 to 23:59 local (one complete calendar day, 24 h)`,
  method: "Count lanes whose final status (done or failed) is stamped that day; lanes an hour = finished / 24; fail rate = failed / finished; median = latest start to finish, in minutes. A lane that failed and was re-run shows only its final status.",
  counts: { done, fail: failed, stuck: 0, finished, startToDonePairs: mins.length },
  jobsPerHour: r2(finished / 24),
  failRatePct: finished ? r1((100 * failed) / finished) : null,
  medianMinutes: median === null ? null : r1(median),
  record: { lanes, runningNow: running, sha256: createHash("sha256").update(digest.join("\n")).digest("hex").slice(0, 16) },
};
console.log(JSON.stringify(out, null, 1));
if (process.argv.includes("--write")) writeFileSync(new URL(`../lib/site-data/source/LANES_${day}.json`, import.meta.url), JSON.stringify(out, null, 1) + "\n");
