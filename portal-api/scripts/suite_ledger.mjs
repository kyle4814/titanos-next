// C9/C10 suite ledger: run every test file as its OWN node process with a hard per-file cap, a bounded parallel
// pool, and write a JSON ledger plus a one-line summary. A timeout is UNKNOWN, never green.
//   node scripts/suite_ledger.mjs [--dir test] [--out ledger.json] [--match '\.test\.ts$']
// Env: SUITE_LEDGER_CAP_MS (per file, default 90000), SUITE_LEDGER_PAR (default 3, clamped to floor(cores/4), min 1),
//      SUITE_LEDGER_BUDGET_MS (whole-run budget, default 1200000; files not started by then are NOT RUN).
// Ledger row: {file, status: pass|fail|timeout|not_run, tests, pass, fail, ms, load, rerun}
// Summary: 'FILES n PASS p FAIL f TIMEOUT t UNKNOWN u' (u = timeout + not_run: every file we cannot vouch for).
import { spawn } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { cpus, loadavg } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function parallelCap(requested, cores = cpus().length) {
  const ceiling = Math.max(1, Math.floor(cores / 4));
  const want = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 3;
  return Math.max(1, Math.min(want, ceiling));
}

export function parseTap(out) {
  const num = (k) => {
    const m = out.match(new RegExp(`^# ${k} (\\d+)`, "m"));
    return m ? Number(m[1]) : 0;
  };
  return { tests: num("tests"), pass: num("pass"), fail: num("fail") };
}

// Run one file in its own process group so a hang (and its children) can be killed outright.
export function runOne(file, { cwd, capMs = 90000, nodeArgs = ["--experimental-strip-types"] } = {}) {
  return new Promise((resolveRun) => {
    const t0 = Date.now();
    const load = Number(loadavg()[0].toFixed(2));
    let out = "";
    // a ledger launched from inside node --test must not leak NODE_TEST_CONTEXT, or the child reports as a subtest
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
    let timedOut = false;
    const child = spawn(process.execPath, ["--test", "--test-reporter=tap", ...nodeArgs, file], {
      cwd, detached: true, env, stdio: ["ignore", "pipe", "pipe"],
    });
    const killGroup = () => { try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} } };
    const timer = setTimeout(() => { timedOut = true; killGroup(); }, capMs);
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    const done = (code) => {
      clearTimeout(timer);
      const ms = Date.now() - t0;
      if (timedOut) return resolveRun({ file, status: /*TIMEOUT_STATUS*/"timeout", tests: 0, pass: 0, fail: 0, ms, load });
      const c = parseTap(out);
      // exit 0 with zero tests ran is not a pass: nothing was proven
      const status = code === 0 && c.tests > 0 && c.fail === 0 ? "pass" : "fail";
      resolveRun({ file, status, ...c, ms, load });
    };
    child.on("error", () => done(1));
    child.on("close", (code) => done(code));
  });
}

export function summarise(rows) {
  const n = (s) => rows.filter((r) => r.status === s).length;
  const timeout = n("timeout"), notRun = n("not_run");
  return `FILES ${rows.length} PASS ${n("pass")} FAIL ${n("fail")} TIMEOUT ${timeout} UNKNOWN ${timeout + notRun}`;
}

export async function runLedger({ cwd, files, capMs = 90000, par = 3, budgetMs = 1200000, nodeArgs } = {}) {
  const width = parallelCap(par);
  const start = Date.now();
  const rows = new Array(files.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= files.length) return;
      if (Date.now() - start >= budgetMs) { rows[i] = { file: files[i], status: "not_run", tests: 0, pass: 0, fail: 0, ms: 0, load: 0 }; continue; }
      rows[i] = await runOne(files[i], { cwd, capMs, nodeArgs });
    }
  };
  await Promise.all(Array.from({ length: width }, worker));
  // Timed-out files are re-run singly, once, with nothing else competing for the CPU.
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].status !== "timeout") continue;
    if (Date.now() - start >= budgetMs) continue;
    const again = await runOne(rows[i].file, { cwd, capMs, nodeArgs });
    rows[i] = { ...again, rerun: true, first_ms: rows[i].ms };
  }
  return { rows, summary: summarise(rows), width, ms: Date.now() - start };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const dir = resolve(opt("--dir", "test"));
  const re = new RegExp(opt("--match", "\\.test\\.(ts|mjs|js)$"));
  const files = readdirSync(dir).filter((f) => re.test(f)).sort().map((f) => join(dir, f));
  const res = await runLedger({
    cwd: process.cwd(), files,
    capMs: Number(process.env.SUITE_LEDGER_CAP_MS) || 90000,
    par: Number(process.env.SUITE_LEDGER_PAR) || 3,
    budgetMs: Number(process.env.SUITE_LEDGER_BUDGET_MS) || 1200000,
  });
  const out = opt("--out", "suite_ledger.json");
  writeFileSync(out, JSON.stringify({ summary: res.summary, width: res.width, ms: res.ms, rows: res.rows }, null, 2));
  console.log(res.summary);
  process.exit(res.rows.every((r) => r.status === "pass") ? 0 : 1);
}
