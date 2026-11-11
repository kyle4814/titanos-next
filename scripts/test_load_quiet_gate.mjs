// Test for load_quiet_gate.mjs: injected fake loadavg + fake crash exits (synthetic, no real sweep, no real load).
// Env LQ_MODULE points the test at a mutated copy (used by the mutation run).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const modPath = process.env.LQ_MODULE || path.join(HERE, "load_quiet_gate.mjs");
const M = await import(pathToFileURL(modPath).href);
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } else console.log("ok   " + m); };

// fake clock + loadavg sequence; sleep advances the clock
const mkDeps = (loads, spawnSeq = [{ status: 0, stdout: "sweep ok", stderr: "" }]) => {
  let t = 0, i = 0; const calls = [];
  return {
    calls,
    loadavg: () => [loads[Math.min(i++, loads.length - 1)], 0, 0],
    cpus: () => 12,
    sleep: (ms) => { t += ms; },
    now: () => t,
    spawn: (cmd, args, opts) => { calls.push({ cmd, args, env: opts.env }); return spawnSeq[Math.min(calls.length - 1, spawnSeq.length - 1)]; },
  };
};
const env0 = {};

// 1. quiet from the start: no wait, unlabelled PASS, stamp present with quiet:true
let d = mkDeps([2.1]);
let r = M.runGuarded({ cmd: "sweep", args: ["a"] }, { env: env0, deps: d });
ok(r.verdict === "PASS" && !r.loadTainted && r.stamp.quiet === true && r.stamp.waitedMs === 0, "quiet pass is unlabelled PASS, no wait");
ok(r.stamp.load1 === 2.1 && r.stamp.cores === 12 && r.stamp.retry.retried === false, "stamp carries load1, cores, retried:false");
ok(!("verdict" in M.stampReport({ x: 1 }, r)) && M.stampReport({ x: 1 }, r).load.quiet === true, "quiet report carries load numbers but no LOAD-TAINTED label");

// 2. noisy then settles: waits, ends quiet, unlabelled
d = mkDeps([20, 15, 9, 6]);
r = M.runGuarded({ cmd: "sweep" }, { env: env0, deps: d });
ok(r.stamp.waitedMs === 15000 && r.stamp.quiet === true && r.verdict === "PASS", "waits 3 polls (15 s fake) then runs quiet: " + r.stamp.waitedMs);

// 3. never settles: bounded wait, proceeds, stamped quiet:false, LOAD-TAINTED on exit 0 and on exit 1
d = mkDeps([23]);
r = M.runGuarded({ cmd: "sweep" }, { env: { LOAD_QUIET_WAIT_MS: "30000" }, deps: d });
ok(r.stamp.quiet === false && r.stamp.waitedMs >= 30000 && r.stamp.waitedMs < 40000 && d.calls.length === 1, "timeout proceeds after the bounded wait and still runs the sweep");
ok(r.verdict === "LOAD-TAINTED" && r.loadTainted, "noisy pass is LOAD-TAINTED, not PASS");
const rep = M.stampReport({ cmd: "sweep" }, r);
ok(rep.verdict === "LOAD-TAINTED" && rep.load.quiet === false && rep.load.load1 === 23 && rep.load.cores === 12, "report JSON stamped {load1, cores, quiet:false} + LOAD-TAINTED");
d = mkDeps([14], [{ status: 1, stdout: "overflow", stderr: "" }]);
r = M.runGuarded({ cmd: "sweep" }, { env: { LOAD_QUIET_WAIT_MS: "0" }, deps: d });
ok(r.verdict === "LOAD-TAINTED" && r.status === 1, "noisy failure is LOAD-TAINTED, not a real-defect FAIL");
d = mkDeps([10]);
r = M.runGuarded({ cmd: "sweep" }, { env: { LOAD_QUIET_MAX: "12" }, deps: d });
ok(r.stamp.quiet === true && r.stamp.threshold === 12, "LOAD_QUIET_MAX override honoured");
d = mkDeps([1], [{ status: 1, stdout: "tap target 30px", stderr: "" }]);
r = M.runGuarded({ cmd: "sweep" }, { env: env0, deps: d });
ok(r.verdict === "FAIL" && !r.loadTainted, "quiet failure is a real FAIL");

// 4. Bun crash: retry once, serially, fewer workers, recorded
d = mkDeps([1], [{ status: 134, stdout: "", stderr: "Bun has crashed" }, { status: 0, stdout: "ok", stderr: "" }]);
r = M.runGuarded({ cmd: "sweep", args: ["x"], workers: 4, workersArg: "--workers" }, { env: env0, deps: d });
ok(d.calls.length === 2, "crash triggers exactly one retry");
ok(d.calls[0].args.join(" ") === "x --workers 4" && d.calls[1].args.join(" ") === "x --workers 2" && d.calls[1].env.WORKERS === "2", "retry uses fewer workers: " + d.calls[1].args.join(" "));
ok(r.stamp.retry.retried && r.stamp.retry.workersFrom === 4 && r.stamp.retry.workersTo === 2 && r.stamp.retry.first.exit === 134 && r.stamp.retry.retryExit === 0, "retry recorded in stamp");
ok(r.verdict === "PASS", "recovered quiet run after retry is PASS");
d = mkDeps([1], [{ status: null, signal: "SIGSEGV", stdout: "", stderr: "" }]);
r = M.runGuarded({ cmd: "sweep", workers: 1 }, { env: env0, deps: d });
ok(d.calls.length === 2 && r.stamp.retry.workersTo === 1 && r.verdict === "FAIL", "persistent crash: retry once only, workers floor 1, then FAIL");
ok(M.isCrash({ status: 1, stdout: "", stderr: "browserContext: Target page, context or browser has been closed" }), "Chromium closed text is a crash");
ok(!M.isCrash({ status: 1, stdout: "overflow 12px", stderr: "" }) && !M.isCrash({ status: 0, stdout: "Bun has crashed", stderr: "" }), "plain failure and exit-0 are not crashes");
d = mkDeps([1], [{ status: 1, stdout: "real defect", stderr: "" }]);
M.runGuarded({ cmd: "sweep" }, { env: env0, deps: d });
ok(d.calls.length === 1, "real defect is not retried");

// 5. wired into run_built_gates: noisy rendered sweep is LOAD-TAINTED, summary NOT-PROVEN
const G = await import(pathToFileURL(path.join(HERE, "run_built_gates.mjs")).href);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lq-"));
try {
  const out = path.join(tmp, "out"), sc = path.join(tmp, "scripts"); fs.mkdirSync(out); fs.mkdirSync(sc);
  fs.writeFileSync(path.join(out, "index.html"), "x");
  fs.writeFileSync(path.join(sc, "test_viewport_overflow.mjs"), 'console.log("overflow ok");');
  const real = (cmd, args, o) => spawnSync(cmd, args, { encoding: "utf8", cwd: o.cwd, env: o.env });
  const noisy = mkDeps([30]); noisy.spawn = real;
  let rows = G.runAll({ root: tmp, scriptsDir: sc, out, guard: { env: { LOAD_QUIET_WAIT_MS: "0" }, deps: noisy } });
  const row = rows.find((x) => x.gate === "test_viewport_overflow.mjs");
  ok(row && row.verdict === "LOAD-TAINTED" && row.stamp.quiet === false, "run_built_gates labels a noisy sweep LOAD-TAINTED");
  ok(/load-tainted=1 .*NOT-PROVEN/.test(G.render(rows).split("\n").pop()), "summary is NOT-PROVEN, not PASS or FAIL");
  const quiet = mkDeps([1]); quiet.spawn = real;
  rows = G.runAll({ root: tmp, scriptsDir: sc, out, guard: { env: {}, deps: quiet } });
  ok(rows.find((x) => x.gate === "test_viewport_overflow.mjs").verdict === "PASS", "same sweep on a quiet box is an unlabelled PASS");
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

console.log(bad ? `${bad} FAILED` : "ALL OK");
process.exit(bad ? 1 : 0);
