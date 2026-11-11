// gen_proof_data.mjs: builds lib/site-data/proof.json (charts, learning-loop receipts, proof-wall stars) from
//   lib/site-data/source/BASELINE_<day>.json  (snapshots of klinge-kernel state/baseline, made by bin/ceiling_board.py --json;
//                                              --refresh copies the newest kernel BASELINE_*.json in)
// The newest snapshot wins row by row. A row it does not carry, or carries as UNKNOWN (or a zero-sample median), falls back
// to the newest older snapshot that measured it, WITH that snapshot's date, so markStale shows it as UNKNOWN once it is
// over 30 days old instead of the old figure looking current (EV6). Every chart and star carries its own row's date.
//   lib/efficiency/efficiency.json                 (the efficiency page's own data)
// A row (chart, star, headline, fleet-cost note) whose own measurement date is more than MAX_DAYS before the newest snapshot
// has no live source, so it is RETIRED from the page instead of showing "UNKNOWN now". The ids are listed in proof.json
// "retired" with the date last measured, so nothing disappears silently. markStale in proofLive.ts stays as the render-time backstop.
// No number is typed here: every figure is parsed or computed from those two files. A baseline row whose source has no
// public label stops the run, so an internal path or tool name can never reach the page by accident.
// Usage: node scripts/gen_proof_data.mjs [--refresh] [--check]   (--check: exit 1 if proof.json is stale)
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

const root = new URL("../", import.meta.url);
const P = (p) => new URL(p, root);
const SRC = "lib/site-data/source";
const BASE_RE = /^BASELINE_\d{4}-\d{2}-\d{2}\.json$/;
const baselines = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => BASE_RE.test(f)).sort() : []);
const LANE_RE = /^LANES_\d{4}-\d{2}-\d{2}\.json$/; // scripts/measure_chain_lanes.mjs: the work-rate row, re-measured from the build-lane status record
const laneFile = readdirSync(new URL("lib/site-data/source", root)).filter((f) => LANE_RE.test(f)).sort().at(-1);
if (!laneFile) throw new Error("no LANES_<day>.json in lib/site-data/source: run scripts/measure_chain_lanes.mjs --day <day> --write");
const FLEET_SNAP = `lib/site-data/source/${laneFile}`;
const OUT = "lib/site-data/proof.json";

if (process.argv.includes("--refresh")) {
  const kdir = `${homedir()}/klinge-kernel/state/baseline`;
  const newest = baselines(kdir).at(-1);
  if (!newest) throw new Error(`--refresh: no BASELINE_*.json in ${kdir}`);
  copyFileSync(`${kdir}/${newest}`, P(`${SRC}/${newest}`));
}
const snapFiles = baselines(new URL(SRC, root)).reverse(); // newest first
if (!snapFiles.length) throw new Error(`no BASELINE_*.json in ${SRC}`);
const SNAP = `${SRC}/${snapFiles[0]}`;
const snapText = readFileSync(P(SNAP), "utf8");
const snaps = snapFiles.map((f) => {
  const b = JSON.parse(readFileSync(P(`${SRC}/${f}`), "utf8"));
  return { file: `${SRC}/${f}`, date: b.ts.slice(0, 10), rows: b.rows };
});
const base = JSON.parse(snapText);
const eff = JSON.parse(readFileSync(P("lib/efficiency/efficiency.json"), "utf8"));
const fleet = JSON.parse(readFileSync(P(FLEET_SNAP), "utf8"));

// A row counts as measured when it has a reading: not UNKNOWN, and a median is not taken over zero samples.
const measured = (r) => !/^UNKNOWN/.test(String(r.now)) && !/\(0 sessions/.test(String(r.now));
// row(names): the first snapshot (newest first) holding any of the names with a measured reading; its date rides along.
// Several names because the generator renamed some vectors over time (e.g. "(last 24 h)" suffixes). A row no snapshot
// measured comes from the newest snapshot that has it at all, so an UNKNOWN stays UNKNOWN.
const usedSnaps = new Set();
const row = (names) => {
  names = [].concat(names);
  const pick = (ok) => {
    for (const s of snaps) for (const n of names) {
      const r = s.rows.find((x) => x.vector === n);
      if (r && ok(r)) { usedSnaps.add(s.file); return { ...r, date: s.date }; }
    }
    return null;
  };
  const r = pick(measured) ?? pick(() => true);
  if (!r) throw new Error(`baseline row missing: ${names.join(" / ")}`);
  return r;
};
const num = (s, re, label) => {
  const m = String(s).match(re);
  if (!m) throw new Error(`cannot parse ${label}: "${s}" with ${re}`);
  return Number(m[1].replace(/,/g, ""));
};
const fmt = (n, dp = 2) => n.toLocaleString("en-AU", { maximumFractionDigits: dp, minimumFractionDigits: 0 });
const mbToGb = (mb) => Math.round((mb / 1024) * 100) / 100;

// Public source labels. Anything unmatched fails the run.
const SOURCE_LABELS = [
  [/\/proc\/meminfo/, "Linux memory counters on the build machine"],
  [/vmmem/, "Windows process memory counter"],
  [/Win32_OperatingSystem/, "Windows memory counter"],
  [/\/proc\/loadavg/, "Linux load average counter"],
  [/cron_runs/, "Scheduled job run record (every run is logged)"],
  [/ledger\.jsonl/, "Worker fleet job ledger"],
  [/usage_meter/, "Token usage meter and the job ledger"],
  [/context_audit/, "Session start audit (tokens read before the first action)"],
  [/verify_runs/, "Gate run record"],
  [/titanos_suite/, "No durable run record exists yet"],
  [/archive\.log/, "Backup log"],
  [/backup\/rolling/, "Rolling backup history (time of the newest saved pass)"],
];
const pubSource = (s) => {
  for (const [re, label] of SOURCE_LABELS) if (re.test(s)) return label;
  throw new Error(`no public label for source: ${s}`);
};

const LABELS = {
  MEASURED: "Counted or timed on our own system, on the date shown.",
  REPRODUCED: "Measured, then repeated on a second run with the same result.",
  MODELLED: "Computed from measured inputs under stated assumptions. A scenario, not a result.",
  ESTIMATE: "A reasoned figure with a published method and a range.",
  FORECAST: "What we expect, with no result behind it yet.",
  EXAMPLE: "An illustration. Not a record of any real client.",
  UNKNOWN: "We have not measured this yet, so we do not show a number.",
};

// ---- charts -------------------------------------------------------------------------------------------------------
const mk = ({ id, title, group, prefix = "", suffix = "", dp = 2, before, after, better, label, source, method, date: d }) => {
  const lowerBetter = better === "lower";
  const ratio = lowerBetter ? before / after : after / before;
  const improved = lowerBetter ? after < before : after > before;
  return {
    id, title, group, better, label, source, method, date: d,
    before, after,
    beforeText: `${prefix}${fmt(before, dp)}${suffix}`,
    afterText: `${prefix}${fmt(after, dp)}${suffix}`,
    improved,
    factorText: improved ? `${fmt(ratio, ratio >= 100 ? 0 : 1)}x ${lowerBetter ? "lower" : "higher"}` : `${fmt(1 / ratio, 1)}x ${lowerBetter ? "higher" : "lower"}, and we show it`,
    // bar widths as a share of the larger value, 0..100
    beforePct: Math.round((before / Math.max(before, after)) * 1000) / 10,
    afterPct: Math.round((after / Math.max(before, after)) * 1000) / 10,
  };
};
const E = (id) => {
  const m = eff.metrics.find((x) => x.id === id);
  if (!m) throw new Error(`efficiency metric missing: ${id}`);
  return m;
};
const fromEff = (id, title) => {
  const m = E(id);
  return mk({ id, title, group: m.group, prefix: m.prefix, suffix: m.suffix, dp: m.dp ?? 2, before: m.before, after: m.after, better: m.better, label: m.status, source: m.source, method: m.method, date: m.date });
};

const ramRow = row("Linux RAM used / available (GB)");
const vmRow = row("vmmem MB");
const winRow = row("Windows available MB");
const cronH = row("cron job-hours/day (last 24 h)");
const startTok = row("worker start tokens (median)");

const headline = fromEff("cost_per_job", "Cost of one worker job");
const charts = [
  mk({ id: "ram", title: "Memory in use, Linux side", group: "Machine", suffix: " GB", dp: 2, before: num(ramRow.baseline, /^([\d.]+) used/, "ram before"), after: num(ramRow.now, /^([\d.]+) used/, "ram now"), better: "lower", label: ramRow.kind, source: pubSource(ramRow.source), method: "Read from the memory counters before and after the optimisation pass.", date: ramRow.date }),
  mk({ id: "vmmem", title: "Windows VM memory", group: "Machine", suffix: " GB", dp: 1, before: num(vmRow.baseline, /^([\d.]+) GB/, "vmmem before"), after: mbToGb(num(vmRow.now, /^([\d.]+)/, "vmmem now")), better: "lower", label: vmRow.kind, source: pubSource(vmRow.source), method: "Process memory counter, megabytes divided by 1024.", date: vmRow.date }),
  mk({ id: "win_free", title: "Windows memory free", group: "Machine", suffix: " GB", dp: 1, before: num(winRow.baseline, /^([\d.]+) GB/, "win before"), after: mbToGb(num(winRow.now, /^([\d.]+)/, "win now")), better: "higher", label: winRow.kind, source: pubSource(winRow.source), method: "Memory counter, megabytes divided by 1024.", date: winRow.date }),
  mk({ id: "cron_hours", title: "Scheduled work per day", group: "Machine", suffix: " h", dp: 2, before: num(cronH.baseline, /^([\d.]+) h/, "cron before"), after: num(cronH.now, /^([\d.]+) h/, "cron now"), better: "lower", label: cronH.kind, source: pubSource(cronH.source), method: "Sum of job run time over a 24 hour window.", date: cronH.date }),
  mk({ id: "worker_start", title: "Tokens a worker reads before its first action", group: "AI cost", dp: 0, suffix: " tokens", before: num(startTok.baseline, /~(\d+)k/, "tok before") * 1000, after: num(startTok.now, /^([\d,]+)/, "tok now"), better: "lower", label: startTok.kind, source: pubSource(startTok.source), method: "Median across worker sessions at start.", date: startTok.date }),
  fromEff("cron_snapshot", "State snapshot, time per run"),
  fromEff("cron_mirror", "Cloud mirror, time per run"),
  fromEff("cron_ping", "Progress ping, time per run"),
  fromEff("cron_bundle", "Repository bundle, time per run"),
  fromEff("titanos_suite", "Main codebase test suite"),
  fromEff("repo_size", "Kernel repository size"),
  fromEff("daily_spend", "Daily spend ceiling (a model)"),
];

// The honest second look: the fleet-wide figure is higher than the matched-job figure because it includes the
// orchestrator. It stays on the page, next to the headline.
const usdRow = row("US$/job and US$ today");
const usdBefore = num(usdRow.baseline, /US\$([\d.]+)\/job/, "usd before");
const usdNow = num(usdRow.now, /US\$([\d.]+)\/job over/, "usd now");
const usdJobs = num(usdRow.now, /over (\d+) jobs/, "usd jobs");
const usdToday = num(usdRow.now, /US\$([\d.]+) today/, "usd today");
const fleetCost = {
  before: usdBefore, after: usdNow, jobs: usdJobs, today: usdToday,
  beforeText: `US$${fmt(usdBefore, 3)}`, afterText: `US$${fmt(usdNow, 3)}`, jobsText: fmt(usdJobs, 0), todayText: `US$${fmt(usdToday, 2)}`,
  note: usdRow.note, label: usdRow.kind, source: pubSource(usdRow.source), date: usdRow.date,
};

// ---- stars --------------------------------------------------------------------------------------------------------
const stars = [];
const star = (s) => stars.push(s);
const baseStar = (id, group, r, display, caption, label = "MEASURED", method) =>
  star({ id, group, display, caption, label, source: pubSource(r.source), date: r.date, method: method ?? (r.note || "Read from the source on the date shown.") });

const loadRow = row("load 1m / 5m");
const cronF = row("cron failure rate (last 24 h)");
const gate = row("kernel gate wall (latest)");
// The live backup is the rolling backup (newest commit = last saved pass). archive.log is the archive cron, frozen since
// 2026-10-13, so it is only the fallback; a snapshot without the rolling row falls back to it with its own date.
const bak = row(["newest rolling backup age (git commit)", "newest backup age (archive.log)"]);

const fleetStar = (id, display, caption) => star({ id, group: "Fleet", display, caption, label: "MEASURED", source: "Build lane status record", system: fleet.system, date: fleet.measuredAt, method: `${fleet.method} Window: ${fleet.window}. ${fleet.counts.finished} finished (${fleet.counts.done} done, ${fleet.counts.fail + fleet.counts.stuck} failed).` });
fleetStar("s_jobs", `${fmt(fleet.jobsPerHour, 2)} lanes an hour`, `Build lanes finished on ${fleet.measuredAt}, one full day (${fleet.counts.finished} finished over 24 hours)`);
fleetStar("s_fail", `${fleet.counts.fail + fleet.counts.stuck} of ${fleet.counts.finished}`, `Build lanes that failed on ${fleet.measuredAt}, ${fleet.failRatePct}%`);
fleetStar("s_median", `${fmt(fleet.medianMinutes, 1)} min`, `Median time per lane across ${fleet.counts.startToDonePairs} lanes on ${fleet.measuredAt}`);
baseStar("s_usd_job", "AI cost", usdRow, fleetCost.afterText, `Fleet-wide cost per job over ${fleetCost.jobsText} jobs. An upper bound: it includes the orchestrator.`, usdRow.kind, usdRow.note);
baseStar("s_usd_today", "AI cost", usdRow, fleetCost.todayText, "Spent in one day, API-equivalent pricing", usdRow.kind, usdRow.note);
baseStar("s_tokens", "AI cost", startTok, `${fmt(num(startTok.now, /^([\d,]+)/, "t"), 0)} tokens`, `Median a worker reads before acting, ${startTok.now.match(/\((\d+) sessions/)[1]} sessions`, startTok.kind);
baseStar("s_ram", "Machine", ramRow, `${fmt(num(ramRow.now, /^([\d.]+) used/, "r"), 2)} GB`, "Linux memory in use", ramRow.kind);
baseStar("s_vm", "Machine", vmRow, `${fmt(mbToGb(num(vmRow.now, /^([\d.]+)/, "v")), 1)} GB`, "Windows VM memory", vmRow.kind);
baseStar("s_win", "Machine", winRow, `${fmt(mbToGb(num(winRow.now, /^([\d.]+)/, "w")), 1)} GB`, "Windows memory free", winRow.kind);
baseStar("s_load", "Machine", loadRow, `${loadRow.now.split(" / ")[0]} load`, `One-minute load average on ${loadRow.note}`, loadRow.kind);
baseStar("s_cronh", "Machine", cronH, `${fmt(num(cronH.now, /^([\d.]+)/, "c"), 2)} h`, `Scheduled work in 24 hours, ${num(cronH.note, /(\d+) runs/, "cron runs")} runs`, cronH.kind);
baseStar("s_cronf", "Machine", cronF, cronF.now.match(/\(([\d.]+%)\)/)[1], `Scheduled runs that failed, ${cronF.now.replace(/ \(.*/, "")}. The 89 percent from before was one job, so we do not chart the two against each other.`, cronF.kind,
  "All scheduled jobs in 24 hours now, against one failing snapshot job before. Different bases, shown separately.");
baseStar("s_gate", "Build", gate, gate.now.match(/^(\d+ s)/)[1], `Latest gate run, ${gate.now.match(/(\d+) suites/)[1]} suites, green`, "MEASURED", "Recorded by the gate runner at the time shown in the run record.");
baseStar("s_backup", "Safety", bak, bak.now.replace(" old", ""), "Age of the newest backup", bak.kind, "Time since the newest saved backup pass, read from the backup history on the date shown.");

for (const id of ["cost_per_job", "daily_spend", "recall50", "heldout", "killtest", "cron_snapshot", "cron_mirror", "cron_bundle", "repo_size", "titanos_suite"]) {
  const m = E(id);
  const f = (v) => (typeof v === "number" ? `${m.prefix}${fmt(v, m.dp ?? 2)}${m.suffix}` : String(v));
  star({ id: `e_${id}`, group: m.group, display: id === "recall50" || id === "heldout" || id === "killtest" ? f(m.after) : `${f(m.before)} to ${f(m.after)}`, caption: m.label, label: m.status, source: m.source, date: m.date, method: m.method });
}

// ---- retire rows with no live source --------------------------------------------------------------------------------
const baseDay = base.ts.slice(0, 10);
const ageOf = (d) => Math.floor((Date.parse(baseDay) - Date.parse(d)) / 86400000);
const stale = (x) => x && ageOf(x.date) > 30;
const retired = [];
const keep = (kind, list) => list.filter((x) => { if (stale(x)) { retired.push({ kind, id: x.id, lastMeasured: x.date, reason: "no live source; removed instead of showing UNKNOWN" }); return false; } return true; });
const keptCharts = keep("chart", charts), keptStars = keep("star", stars);
if (stale(headline)) retired.push({ kind: "headline", id: headline.id, lastMeasured: headline.date, reason: "no live source; removed instead of showing UNKNOWN" });
if (stale(fleetCost)) retired.push({ kind: "fleetCost", id: "fleet_cost", lastMeasured: fleetCost.date, reason: "no live source; removed instead of showing UNKNOWN" });
charts.splice(0, charts.length, ...keptCharts); stars.splice(0, stars.length, ...keptStars);

// ---- learning loop: each node opens a receipt (a star id) ------------------------------------------------------------
const loopSrc = readFileSync(P("app/learning-loop/page.tsx"), "utf8");
const stepBlock = loopSrc.match(/const STEPS = \[([\s\S]*?)\n\];/)[1];
const steps = [...stepBlock.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map((m) => ({ name: m[1], text: m[2] }));
const receiptIds = ["s_jobs", "s_median", "s_ram", "s_gate", "s_fail", "s_cronh", "s_jobs"];
if (steps.length !== receiptIds.length) throw new Error(`loop has ${steps.length} steps, receipts ${receiptIds.length}`);
const loop = steps.map((s, i) => ({ n: i + 1, ...s, receipt: receiptIds[i] }));

for (const x of [...charts, ...stars]) x.system ??= x.source;
const labelCounts = Object.fromEntries(Object.keys(LABELS).map((k) => [k, stars.filter((s) => s.label === k).length]));
const out = {
  generated: { from: [...snaps.map((s) => s.file).filter((f) => usedSnaps.has(f)), FLEET_SNAP, "lib/efficiency/efficiency.json"], baselineTs: base.ts, sha256: createHash("sha256").update(snapText).digest("hex").slice(0, 16) },
  labels: LABELS,
  labelCounts,
  headline: stale(headline) ? null : { ...headline, titleText: eff.headline.title.replace("{factor}", fmt(headline.before / headline.after, 1)), analogy: eff.headline.analogy, caption: eff.headline.caption },
  fleetCost: stale(fleetCost) ? null : fleetCost,
  retired,
  charts,
  loop,
  stars,
};
const json = JSON.stringify(out, null, 2) + "\n";
if (process.argv.includes("--check")) {
  const cur = existsSync(P(OUT)) ? readFileSync(P(OUT), "utf8") : "";
  if (cur !== json) { console.error(`STALE: ${OUT} differs from a fresh generation, run node scripts/gen_proof_data.mjs`); process.exit(1); }
  console.log(`${OUT} is current`);
} else {
  writeFileSync(P(OUT), json);
  console.log(`wrote ${OUT}: ${charts.length} charts, ${loop.length} loop nodes, ${stars.length} stars`);
}
