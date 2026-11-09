// One command that runs every built-output gate that exists on this tree against out/.
// Usage: node scripts/run_built_gates.mjs [--out DIR] [--build] [--scripts-dir DIR] [--root DIR]
//   --build        run `npm ci && npx next build` in the current worktree (root) first, then gate out/
//   --out DIR      built export to gate (default <root>/out)
//   --scripts-dir  where to discover gate scripts (default this file's directory)
// Verdicts per gate: PASS / FAIL / SKIPPED-NO-BUILD / SKIPPED-GATE-ABSENT.
// Exit 1 on any FAIL (or a failed --build). SKIPPED is never PASS; the summary counts it.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };

export const GATES = [
  { name: "f262_anchors", glob: /^test_f262_anchors\.(mjs|sh|py)$/, args: (o) => ["--built", o] },
  { name: "perf_budget", glob: /^test_perf_budget\.(mjs|sh|py)$/, args: (o) => [o] },
  { name: "no_hidden_tracking", glob: /^test_no_hidden_tracking[\w-]*\.(mjs|sh|py)$/, args: (o) => [o] },
  { name: "no_doctrine_leak", glob: /^test_no_doctrine_leak\.(mjs|sh|py)$/, args: (o) => [o] },
  { name: "sitemap", glob: /^test_[\w-]*sitemap[\w-]*\.(mjs|sh|py)$/, args: (o) => [o] },
];

const runner = (f) => (f.endsWith(".mjs") ? ["node", [f]] : f.endsWith(".py") ? ["python3", ["-I", f]] : ["bash", [f]]);
const lastLine = (s) => (s.trim().split("\n").filter(Boolean).pop() || "(no output)").replace(/\s+/g, " ").slice(0, 160);

export function runAll({ root, scriptsDir, out, build }) {
  const rows = [];
  let buildFailed = false;
  if (build) {
    for (const cmd of [["npm", ["ci"]], ["npx", ["next", "build"]]]) {
      const r = spawnSync(cmd[0], cmd[1], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
      if (r.status !== 0) {
        buildFailed = true;
        rows.push({ gate: `build:${cmd.join(" ").replace(/,/g, " ")}`, verdict: "FAIL", code: r.status ?? "spawn", line: lastLine((r.stdout || "") + (r.stderr || "") + (r.error ? String(r.error) : "")) });
        break;
      }
    }
  }
  const haveOut = !buildFailed && fs.existsSync(out) && fs.statSync(out).isDirectory() && fs.readdirSync(out).length > 0;
  const files = fs.existsSync(scriptsDir) ? fs.readdirSync(scriptsDir).sort() : [];
  for (const g of GATES) {
    const found = files.filter((f) => g.glob.test(f));
    if (!found.length) { rows.push({ gate: g.name, verdict: "SKIPPED-GATE-ABSENT", code: "-", line: "no script matched on this tree" }); continue; }
    for (const f of found) {
      if (!haveOut) { rows.push({ gate: f, verdict: "SKIPPED-NO-BUILD", code: "-", line: buildFailed ? "build failed" : `no built export at ${out}` }); continue; }
      const [bin, pre] = runner(path.join(scriptsDir, f));
      const r = spawnSync(bin, [...pre, ...g.args(out)], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
      const text = (r.stdout || "") + (r.stderr || "");
      const line = lastLine(text);
      let verdict = r.status === 0 ? "PASS" : "FAIL";
      // a gate that exits 0 but says it did not check anything is a skip, never a pass
      if (r.status === 0 && /^SKIPPED-NO-BUILD\b/m.test(text)) verdict = "SKIPPED-NO-BUILD";
      rows.push({ gate: f, verdict, code: r.status ?? `signal:${r.signal ?? r.error}`, line });
    }
  }
  return rows;
}

export function render(rows) {
  const n = (v) => rows.filter((r) => r.verdict === v).length;
  const lines = rows.map((r) => `${r.verdict.padEnd(20)} exit=${String(r.code).padEnd(4)} ${r.gate.padEnd(34)} ${r.line}`);
  const skipped = n("SKIPPED-NO-BUILD") + n("SKIPPED-GATE-ABSENT");
  lines.push(`SUMMARY pass=${n("PASS")} fail=${n("FAIL")} skipped=${skipped} (no-build=${n("SKIPPED-NO-BUILD")}, gate-absent=${n("SKIPPED-GATE-ABSENT")}) ${n("FAIL") ? "RESULT=FAIL" : skipped ? "RESULT=NOT-PROVEN (skips are not passes)" : "RESULT=PASS"}`);
  return lines.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(val("--root") || path.join(HERE, ".."));
  const rows = runAll({ root, scriptsDir: path.resolve(val("--scripts-dir") || HERE), out: path.resolve(val("--out") || path.join(root, "out")), build: flag("--build") });
  console.log(render(rows));
  process.exit(rows.some((r) => r.verdict === "FAIL") ? 1 : 0);
}
