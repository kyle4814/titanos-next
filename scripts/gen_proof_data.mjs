// gen_proof_data.mjs: builds lib/site-data/proof.json (charts, learning-loop receipts, proof-wall stars) from
//   lib/site-data/source/BASELINE_<date>.json      (the NEWEST snapshot of klinge-kernel state/baseline; --refresh copies the kernel's newest in)
//   lib/efficiency/efficiency.json                 (the efficiency page's own data)
// No number is typed here: every figure is parsed or computed from those two files. A baseline row whose source has no
// public label stops the run, so an internal path or tool name can never reach the page by accident.
// Usage: node scripts/gen_proof_data.mjs [--refresh] [--check]   (--check: exit 1 if proof.json is stale)
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

const root = new URL("../", import.meta.url);
const P = (p) => new URL(p, root);
const newest = (dir) => readdirSync(dir).filter((f) => /^BASELINE_\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop();
const KDIR = process.env.KERNEL_BASELINE_DIR || `${homedir()}/klinge-kernel/state/baseline`; // READ ONLY
const SDIR = new URL("lib/site-data/source/", root);
if (process.argv.includes("--refresh")) {
  const k = newest(KDIR);
  if (!k) throw new Error(`no BASELINE_*.json in ${KDIR}`);
  copyFileSync(`${KDIR}/${k}`, new URL(k, SDIR));
}
const SNAP = `lib/site-data/source/${newest(SDIR.pathname)}`;
const OUT = "lib/site-data/proof.json";
const snapText = readFileSync(P(SNAP), "utf8");
const base = JSON.parse(snapText);
const eff = JSON.parse(readFileSync(P("lib/efficiency/efficiency.json"), "utf8"));
const date = base.ts.slice(0, 10);

const row = (vector, nth = 0) => {
  const r = base.rows.filter((x) => x.vector === vector)[nth];
  if (!r) throw new Error(`baseline row missing: ${vector}`);
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

// ---- baseline rows -------------------------------------------------------------------------------------------------
// Every row below carries sourceFile + sourceRow (where the figure came from) and a date (when it was measured: the date inside the
// reading if it has one, else the baseline snapshot date). A reading the baseline itself calls UNKNOWN stays UNKNOWN: no value invented.
const WIN = "since 2026-10-08T08:50:00+10:00"; // the long window of the weekly baseline (a stated average, not a live 24 h reading)
const T = (r) => ({ sourceFile: SNAP, sourceRow: r.vector });
const rowDate = (r) => (String(r.now).match(/\bat (\d{4}-\d{2}-\d{2})T/) || [])[1] ?? date;
const unknownNow = (r) => /^UNKNOWN/.test(r.now) || /^0 \(0 sessions/.test(r.now);
const UNK = "UNKNOWN";
const unkChart = ({ id, title, group, better, source, method, d, r, why }) => ({
  id, title, group, better, label: UNK, source, method: `${method} No reading in the latest baseline: ${why}.`, date: d,
  before: null, after: null, beforeText: UNK, afterText: UNK, improved: false, factorText: UNK, beforePct: 0, afterPct: 0,
  value: UNK, unknownReason: why, ...T(r),
});
const chartOrUnknown = (r, spec, build) => (unknownNow(r) ? unkChart({ ...spec, r, source: pubSource(r.source), d: rowDate(r), why: String(r.note || r.now).replace(/\.$/, "") }) : { ...build(), ...T(r) });

const ramRow = row("Linux RAM used / available (GB)");
const vmRow = row("vmmem MB");
const winRow = row("Windows available MB");
const cronH = row("cron job-hours/day (last 24 h)");
const jph = row(`fleet jobs/hour (${WIN})`);
const startTok = row("worker start tokens (median)");

const headline = { ...fromEff("cost_per_job", "Cost of one worker job"), sourceFile: "lib/efficiency/efficiency.json", sourceRow: "cost_per_job" };
const charts = [
  chartOrUnknown(ramRow, { id: "ram", title: "Memory in use, Linux side", group: "Machine", better: "lower", method: "Read from the memory counters before and after the optimisation pass." }, () =>
    mk({ id: "ram", title: "Memory in use, Linux side", group: "Machine", suffix: " GB", dp: 2, before: num(ramRow.baseline, /^([\d.]+) used/, "ram before"), after: num(ramRow.now, /^([\d.]+) used/, "ram now"), better: "lower", label: ramRow.kind, source: pubSource(ramRow.source), method: "Read from the memory counters before and after the optimisation pass.", date: rowDate(ramRow) })),
  chartOrUnknown(vmRow, { id: "vmmem", title: "Windows VM memory", group: "Machine", better: "lower", method: "Process memory counter, megabytes divided by 1024." }, () =>
    mk({ id: "vmmem", title: "Windows VM memory", group: "Machine", suffix: " GB", dp: 1, before: num(vmRow.baseline, /^([\d.]+) GB/, "vmmem before"), after: mbToGb(num(vmRow.now, /^([\d.]+)/, "vmmem now")), better: "lower", label: vmRow.kind, source: pubSource(vmRow.source), method: "Process memory counter, megabytes divided by 1024.", date: rowDate(vmRow) })),
  chartOrUnknown(winRow, { id: "win_free", title: "Windows memory free", group: "Machine", better: "higher", method: "Memory counter, megabytes divided by 1024." }, () =>
    mk({ id: "win_free", title: "Windows memory free", group: "Machine", suffix: " GB", dp: 1, before: num(winRow.baseline, /^([\d.]+) GB/, "win before"), after: mbToGb(num(winRow.now, /^([\d.]+)/, "win now")), better: "higher", label: winRow.kind, source: pubSource(winRow.source), method: "Memory counter, megabytes divided by 1024.", date: rowDate(winRow) })),
  chartOrUnknown(cronH, { id: "cron_hours", title: "Scheduled work per day", group: "Machine", better: "lower", method: "Sum of job run time over a 24 hour window." }, () =>
    mk({ id: "cron_hours", title: "Scheduled work per day", group: "Machine", suffix: " h", dp: 2, before: num(cronH.baseline, /^([\d.]+) h/, "cron before"), after: num(cronH.now, /^([\d.]+) h/, "cron now"), better: "lower", label: cronH.kind, source: pubSource(cronH.source), method: "Sum of job run time over a 24 hour window.", date: rowDate(cronH) })),
  chartOrUnknown(jph, { id: "jobs_per_hour", title: "Worker jobs finished per hour", group: "Fleet", better: "higher", method: "Finished jobs divided by hours in the window." }, () =>
    mk({ id: "jobs_per_hour", title: "Worker jobs finished per hour", group: "Fleet", dp: 2, before: num(jph.baseline, /\(([\d.]+)\/h\)/, "jph before"), after: num(jph.now, /^([\d.]+)/, "jph now"), better: "higher", label: jph.kind, source: pubSource(jph.source), method: `Finished jobs divided by hours in the window (${jph.note}). An average since 2026-10-08, not a live 24 hour reading.`, date: rowDate(jph) })),
  chartOrUnknown(startTok, { id: "worker_start", title: "Tokens a worker reads before its first action", group: "AI cost", better: "lower", method: "Median across worker sessions at start." }, () =>
    mk({ id: "worker_start", title: "Tokens a worker reads before its first action", group: "AI cost", dp: 0, suffix: " tokens", before: num(startTok.baseline, /~(\d+)k/, "tok before") * 1000, after: num(startTok.now, /^([\d,]+)/, "tok now"), better: "lower", label: startTok.kind, source: pubSource(startTok.source), method: "Median across worker sessions at start.", date: rowDate(startTok) })),
  ...[["cron_snapshot", "State snapshot, time per run"], ["cron_mirror", "Cloud mirror, time per run"], ["cron_ping", "Progress ping, time per run"], ["cron_bundle", "Repository bundle, time per run"], ["titanos_suite", "Main codebase test suite"], ["repo_size", "Kernel repository size"], ["daily_spend", "Daily spend ceiling (a model)"]]
    .map(([id, t]) => ({ ...fromEff(id, t), sourceFile: "lib/efficiency/efficiency.json", sourceRow: id })),
];

// The honest second look. The latest baseline prices workers only (the earlier 2026-10-08 figure also counted the orchestrator), so the two
// are different bases, shown side by side with that said, never as a drop. Today's spend is UNKNOWN when the baseline says so.
const usdRow = row(`US$/job, workers only (${WIN})`);
const usdDayRow = row("US$/job, workers only (last 24 h)");
const usdBefore = num(usdRow.baseline, /US\$([\d.]+)\/job/, "usd before");
const usdNow = num(usdRow.now, /US\$([\d.]+)\/job over/, "usd now");
const usdJobs = num(usdRow.now, /over (\d+) jobs/, "usd jobs");
const usdWorker = num(usdRow.now, /worker US\$([\d.]+)/, "usd worker spend");
const fleetCost = {
  before: usdBefore, after: usdNow, jobs: usdJobs, today: null,
  beforeText: `US$${fmt(usdBefore, 3)}`, afterText: `US$${fmt(usdNow, 3)}`, jobsText: fmt(usdJobs, 0), todayText: "UNKNOWN",
  workerSpendText: `US$${fmt(usdWorker, 2)}`,
  note: "workers only, average since 2026-10-08; the earlier figure also counted the orchestrator", label: usdRow.kind, source: pubSource(usdRow.source), date: rowDate(usdRow), ...T(usdRow),
};

// ---- stars --------------------------------------------------------------------------------------------------------
const stars = [];
const star = (s) => stars.push(s);
const baseStar = (id, group, r, display, caption, label = "MEASURED", method) =>
  star({ id, group, display, caption, label, source: pubSource(r.source), date: rowDate(r), method: method ?? (r.note || "Read from the source on the date shown."), ...T(r) });
const unkStar = (id, group, r, caption, why) =>
  star({ id, group, display: UNK, value: UNK, caption, label: UNK, source: pubSource(r.source), date: rowDate(r), method: `No reading in the latest baseline: ${why}. We show no figure.`, unknownReason: why, ...T(r) });

const loadRow = row("load 1m / 5m");
const cronF = row("cron failure rate (last 24 h)");
const fFail = row(`fleet fail rate (${WIN})`);
const fMed = row(`fleet median minutes/job (${WIN})`);
const gate = row("kernel gate wall (latest)");
const suite = row("titanos suite wall (latest)");
const bak = row("newest backup age (archive.log)");

const fleetNote = (r) => `${r.note || r.now}. A long-window average since 2026-10-08, read on ${rowDate(r)}, not a live 24 hour reading.`;
baseStar("s_jobs", "Fleet", jph, `${fmt(num(jph.now, /^([\d.]+)/, "jph"), 2)} jobs an hour`, `Worker jobs finished per hour, average since 2026-10-08 (${jph.note})`, jph.kind, fleetNote(jph));
baseStar("s_fail", "Fleet", fFail, `${num(fFail.now, /^(\d+) of/, "fail")} of ${fmt(num(fFail.now, / of (\d+)/, "of"), 0)}`, `Fleet jobs that failed since 2026-10-08, ${fFail.now.match(/\(([\d.]+%)\)/)[1]}`, fFail.kind, fleetNote(fFail));
baseStar("s_median", "Fleet", fMed, `${fmt(num(fMed.now, /^([\d.]+) min/, "med"), 1)} min`, `Median time per job across ${fmt(num(fMed.now, /n=(\d+)/, "n"), 0)} jobs since 2026-10-08`, fMed.kind, fleetNote(fMed));
baseStar("s_usd_job", "AI cost", usdRow, fleetCost.afterText, `Worker-only cost per job over ${fleetCost.jobsText} jobs (${fleetCost.workerSpendText} in all). It leaves out the orchestrator, so it is not a drop against the earlier fleet-wide figure.`, usdRow.kind, usdRow.note || fleetCost.note);
if (unknownNow(usdDayRow)) unkStar("s_usd_today", "AI cost", usdDayRow, "Spent in one day, API-equivalent pricing", String(usdDayRow.now).replace(/\.$/, ""));
else baseStar("s_usd_today", "AI cost", usdDayRow, `US$${fmt(num(usdDayRow.now, /worker US\$([\d.]+)/, "usd day"), 2)}`, "Worker spend in the last 24 hours, API-equivalent pricing", usdDayRow.kind, usdDayRow.note);
if (unknownNow(startTok)) unkStar("s_tokens", "AI cost", startTok, "Median a worker reads before acting", `${startTok.now.replace(/\.$/, "")}: no worker session was audited`);
else baseStar("s_tokens", "AI cost", startTok, `${fmt(num(startTok.now, /^([\d,]+)/, "t"), 0)} tokens`, `Median a worker reads before acting, ${startTok.now.match(/\((\d+) sessions/)[1]} sessions`, startTok.kind);
baseStar("s_ram", "Machine", ramRow, `${fmt(num(ramRow.now, /^([\d.]+) used/, "r"), 2)} GB`, "Linux memory in use", ramRow.kind);
baseStar("s_vm", "Machine", vmRow, `${fmt(mbToGb(num(vmRow.now, /^([\d.]+)/, "v")), 1)} GB`, "Windows VM memory", vmRow.kind);
baseStar("s_win", "Machine", winRow, `${fmt(mbToGb(num(winRow.now, /^([\d.]+)/, "w")), 1)} GB`, "Windows memory free", winRow.kind);
baseStar("s_load", "Machine", loadRow, `${loadRow.now.split(" / ")[0]} load`, `One-minute load average on ${loadRow.note}`, loadRow.kind);
baseStar("s_cronh", "Machine", cronH, `${fmt(num(cronH.now, /^([\d.]+)/, "c"), 2)} h`, `Scheduled work in 24 hours, ${cronH.note}`, cronH.kind);
baseStar("s_cronf", "Machine", cronF, cronF.now.match(/\(([\d.]+%)\)/)[1], `Scheduled runs that failed, ${cronF.now.replace(/ \(.*/, "")}. The 89 percent from before was one job, so we do not chart the two against each other.`, cronF.kind,
  "All scheduled jobs in 24 hours now, against one failing snapshot job before. Different bases, shown separately.");
baseStar("s_gate", "Build", gate, gate.now.match(/^(\d+ s)/)[1], `Full gate run, ${gate.now.match(/(\d+) suites/)[1]} suites, green`, "MEASURED", "Recorded by the gate runner at the time shown in the run record.");
baseStar("s_backup", "Safety", bak, bak.now.replace(" old", ""), "Age of the newest backup", bak.kind);
star({ id: "s_suite", group: "Build", display: "No number yet", caption: "Wall time of the main codebase suite", label: "UNKNOWN", source: pubSource(suite.source), date: rowDate(suite), method: "That suite does not log its own run time, so we show no figure. A recorder is the next fix.", ...T(suite) });

for (const id of ["cost_per_job", "daily_spend", "recall50", "heldout", "killtest", "cron_snapshot", "cron_mirror", "cron_bundle", "repo_size", "titanos_suite"]) {
  const m = E(id);
  const f = (v) => (typeof v === "number" ? `${m.prefix}${fmt(v, m.dp ?? 2)}${m.suffix}` : String(v));
  star({ id: `e_${id}`, sourceFile: "lib/efficiency/efficiency.json", sourceRow: id, group: m.group, display: id === "recall50" || id === "heldout" || id === "killtest" ? f(m.after) : `${f(m.before)} to ${f(m.after)}`, caption: m.label, label: m.status, source: m.source, date: m.date, method: m.method });
}

// ---- learning loop: each node opens a receipt (a star id) ------------------------------------------------------------
const loopSrc = readFileSync(P("app/learning-loop/page.tsx"), "utf8");
const stepBlock = loopSrc.match(/const STEPS = \[([\s\S]*?)\n\];/)[1];
const steps = [...stepBlock.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map((m) => ({ name: m[1], text: m[2] }));
const receiptIds = ["s_jobs", "s_median", "e_cron_snapshot", "s_gate", "e_cost_per_job", "e_cost_per_job", "s_jobs"];
if (steps.length !== receiptIds.length) throw new Error(`loop has ${steps.length} steps, receipts ${receiptIds.length}`);
const loop = steps.map((s, i) => ({ n: i + 1, ...s, receipt: receiptIds[i] }));

for (const x of [...charts, ...stars]) x.system ??= x.source;
const labelCounts = Object.fromEntries(Object.keys(LABELS).map((k) => [k, stars.filter((s) => s.label === k).length]));
const out = {
  generated: { from: [SNAP, "lib/efficiency/efficiency.json"], baselineTs: base.ts, sha256: createHash("sha256").update(snapText).digest("hex").slice(0, 16) },
  labels: LABELS,
  labelCounts,
  headline: { ...headline, titleText: eff.headline.title.replace("{factor}", fmt(headline.before / headline.after, 1)), analogy: eff.headline.analogy, caption: eff.headline.caption },
  fleetCost,
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
