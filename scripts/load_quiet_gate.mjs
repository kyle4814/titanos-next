// Load-quiet gate for rendered (Chromium) sweeps: viewport overflow, tap targets, kbfocus, print motion.
// Why: f405 FAILED at load 12-23/8 and f424/f428 hit a Bun crash under load; a noisy-box result is neither a pass nor a defect.
// waitQuiet: poll os.loadavg()[0] until it is below the threshold (env LOAD_QUIET_MAX, default 8) or LOAD_QUIET_WAIT_MS (default 120000) runs out.
// runGuarded: wait, run the sweep, on a Bun/Chromium crash retry ONCE serially with fewer workers. Every report is stamped
//   {load1, cores, quiet, threshold, waitedMs, retry}. quiet:false => verdict LOAD-TAINTED (never PASS, never FAIL).
// CLI: node scripts/load_quiet_gate.mjs [--report FILE.json] [--workers-arg --workers] [--workers N] -- cmd args...
import os from "node:os";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const num = (v, d) => { const n = Number(v); return v !== undefined && v !== "" && Number.isFinite(n) ? n : d; };

export const realDeps = () => ({
  loadavg: () => os.loadavg(),
  cpus: () => os.cpus().length,
  sleep: (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms),
  now: () => Date.now(),
  spawn: (cmd, args, opts) => spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28, ...opts }),
});

export function waitQuiet({ threshold, maxWaitMs, pollMs = 5000, env = process.env, deps = realDeps() } = {}) {
  threshold = threshold ?? num(env.LOAD_QUIET_MAX, 8);
  maxWaitMs = maxWaitMs ?? num(env.LOAD_QUIET_WAIT_MS, 120000);
  const t0 = deps.now();
  let load1 = deps.loadavg()[0];
  while (!(load1 < threshold) && deps.now() - t0 < maxWaitMs) {
    deps.sleep(pollMs);
    load1 = deps.loadavg()[0];
  }
  return { load1: Math.round(load1 * 100) / 100, cores: deps.cpus(), threshold, quiet: load1 < threshold, waitedMs: deps.now() - t0 };
}

const CRASH_SIGNALS = new Set(["SIGSEGV", "SIGABRT", "SIGILL", "SIGBUS", "SIGTRAP"]);
const CRASH_TEXT = /Bun has crashed|oh no: Bun|panic\(main thread\)|Bun v[\d.]+.*(crash|panic)|Target (page, context or )?browser has been closed|browser has crashed|Page crashed|Chromium .*crash|Segmentation fault/i;
export function isCrash(r) {
  if (!r) return false;
  if (r.signal && CRASH_SIGNALS.has(r.signal)) return true;
  if ([132, 133, 134, 139].includes(r.status)) return true;
  return r.status !== 0 && CRASH_TEXT.test(`${r.stdout || ""}\n${r.stderr || ""}`);
}

// spec: {cmd, args[], workers?: N, workersArg?: "--workers"}  (workers go as workersArg N, or env WORKERS)
export function runGuarded(spec, { env = process.env, deps = realDeps(), waitOpts = {} } = {}) {
  const load = waitQuiet({ env, deps, ...waitOpts });
  const launch = (workers) => {
    const args = [...(spec.args || [])];
    const e = { ...env };
    if (workers != null) { if (spec.workersArg) args.push(spec.workersArg, String(workers)); e.WORKERS = String(workers); }
    return deps.spawn(spec.cmd, args, { env: e, cwd: spec.cwd });
  };
  let r = launch(spec.workers ?? null);
  let retry = { retried: false };
  if (isCrash(r)) {
    const from = spec.workers ?? num(env.WORKERS, 4);
    const to = Math.max(1, Math.floor(from / 2));
    const first = { exit: r.status ?? null, signal: r.signal ?? null };
    r = launch(to);
    retry = { retried: true, workersFrom: from, workersTo: to, serial: true, first, retryExit: r.status ?? null, retrySignal: r.signal ?? null };
  }
  const status = r.status ?? (r.signal ? 128 : 1);
  const verdict = !load.quiet ? "LOAD-TAINTED" : status === 0 ? "PASS" : "FAIL";
  return { status, stdout: r.stdout || "", stderr: r.stderr || "", verdict, stamp: { ...load, retry }, loadTainted: !load.quiet };
}

// Stamp a sweep report JSON object. A quiet pass still carries the numbers but never the label.
export function stampReport(report, result) {
  return { ...report, load: { ...result.stamp }, ...(result.loadTainted ? { verdict: "LOAD-TAINTED" } : {}) };
}

export function writeStamped(file, report, result) {
  fs.writeFileSync(file, JSON.stringify(stampReport(report, result), null, 1));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2);
  const sep = a.indexOf("--");
  const opt = sep >= 0 ? a.slice(0, sep) : [];
  const cmdv = sep >= 0 ? a.slice(sep + 1) : [];
  const val = (n) => { const i = opt.indexOf(n); return i >= 0 ? opt[i + 1] : null; };
  if (!cmdv.length) { console.error("usage: load_quiet_gate.mjs [--report F] [--workers N] [--workers-arg --workers] -- cmd args"); process.exit(2); }
  const res = runGuarded({ cmd: cmdv[0], args: cmdv.slice(1), workers: val("--workers") ? Number(val("--workers")) : undefined, workersArg: val("--workers-arg") || undefined });
  process.stdout.write(res.stdout); process.stderr.write(res.stderr);
  const rep = { cmd: cmdv.join(" "), exit: res.status, verdict: res.verdict };
  if (val("--report")) writeStamped(val("--report"), rep, res);
  console.log(`LOADQUIET ${res.verdict} load1=${res.stamp.load1} cores=${res.stamp.cores} quiet=${res.stamp.quiet} retried=${res.stamp.retry.retried}`);
  process.exit(res.loadTainted ? 3 : res.status);
}
