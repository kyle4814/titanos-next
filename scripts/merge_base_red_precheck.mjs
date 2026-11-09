// merge_base_red_precheck.mjs - base-red pre-landing check (f331_c10).
// Why: MERGE_m20 burned a whole run because the int3 base was already red on test_perf_budget before any candidate landed.
// Usage: node scripts/merge_base_red_precheck.mjs <baseRef> [--out verdict.json] [--out-dir <built out/>] [--gates "name=cmd;name=cmd"] [--repo <path>] [--build]
// Runs each gate on the base in a throwaway worktree under /tmp, writes {base, sha, gates:{name:{status,evidence}}}.
// status: pass | red | error. error = could not decide (never read as clean).
// classify(baseVerdict, headVerdict) -> per gate INHERITED (red on base) / CAUSED (green on base, red on head) / CLEAN.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// ONE list of the structural gates the merge briefs run (name, command). Edit here only.
export const DEFAULT_GATES = [
  ["test_no_orphan_scripts", "bash scripts/test_no_orphan_scripts.sh"],
  ["test_no_doctrine_leak", "node scripts/test_no_doctrine_leak.mjs"],
  ["test_nav_links", "node scripts/test_nav_links.mjs"],
  ["test_contrast_tokens", "node scripts/test_contrast_tokens.mjs"],
  ["test_offer_copy", "node scripts/test_offer_copy.mjs"],
  ["test_seo", "node scripts/test_seo.mjs"],
  ["test_perf_budget", "node scripts/test_perf_budget.mjs"],
];

// Pure. Per gate: INHERITED (base red), CAUSED (base pass, head red), CLEAN (base pass, head pass).
// A base that errored or is missing is never CLEAN: it is UNKNOWN-BASE (cannot attribute), reported, not trusted.
export function classify(baseVerdict, headVerdict) {
  const out = {};
  const b = (baseVerdict && baseVerdict.gates) || {};
  const h = (headVerdict && headVerdict.gates) || {};
  for (const name of new Set([...Object.keys(b), ...Object.keys(h)])) {
    const bs = b[name] && b[name].status, hs = h[name] && h[name].status;
    if (bs === "red") out[name] = "INHERITED";
    else if (bs === "pass") out[name] = hs === "pass" ? "CLEAN" : hs === "red" ? "CAUSED" : "UNKNOWN-HEAD";
    else out[name] = "UNKNOWN-BASE";
  }
  return out;
}

export function judge(code, output) {
  const lines = String(output).split("\n").map((l) => l.trim()).filter(Boolean);
  const evid = (lines.find((l) => /^(FAIL|ERROR)/.test(l)) || lines.filter((l) => !/^PASS/.test(l)).pop() || lines.pop() || "(no output)").slice(0, 200);
  if (code === null) return { status: "error", evidence: "gate did not exit: " + evid };
  if (/built output not found|run npm run build first/.test(output)) return { status: "error", evidence: "no built out/ on base (pass --build or --out-dir): " + evid };
  if (/SKIPPED-NO-BUILD/.test(output)) return { status: "error", evidence: "no built out/ on base (pass --out-dir): " + evid };
  if (code === 0) return { status: "pass", evidence: evid };
  if (code === 127 || /Cannot find module|command not found/.test(output)) return { status: "error", evidence: evid };
  return { status: "red", evidence: evid };
}

export function parseGates(spec) {
  return spec.split(";").map((s) => s.trim()).filter(Boolean).map((s) => { const i = s.indexOf("="); return [s.slice(0, i), s.slice(i + 1)]; });
}

function sh(cmd, args, opts = {}) { return spawnSync(cmd, args, { encoding: "utf8", ...opts }); }

export function run({ baseRef, repo, outDir, gates, build = false }) {
  const sha = sh("git", ["-C", repo, "rev-parse", baseRef]);
  if (sha.status !== 0) throw new Error("bad base ref " + baseRef + ": " + sha.stderr.trim());
  const T = fs.mkdtempSync(path.join("/tmp", "basered."));
  if (!T.startsWith("/tmp/basered.")) throw new Error("refusing path " + T);
  const wt = path.join(T, "wt");
  const verdict = { base: baseRef, sha: sha.stdout.trim(), when: new Date().toISOString(), gates: {} };
  try {
    const add = sh("git", ["-C", repo, "worktree", "add", "--detach", wt, verdict.sha]);
    if (add.status !== 0) throw new Error("worktree add failed: " + add.stderr.trim());
    const nm = path.join(repo, "node_modules");
    // build needs a real dir (Turbopack rejects a symlinked node_modules); hardlink copy is ~1.5 s and costs no disk
    if (fs.existsSync(nm) && !fs.existsSync(path.join(wt, "node_modules"))) {
      if (build) sh("cp", ["-al", nm, path.join(wt, "node_modules")]); else fs.symlinkSync(nm, path.join(wt, "node_modules"));
    }
    if (outDir) fs.cpSync(outDir, path.join(wt, "out"), { recursive: true });
    if (build) { // out/ is what perf gates measure; postbuild gates may fail the build itself, so only a missing out/ matters
      const b = sh("bash", ["-c", "npm run build 2>&1 | tail -5"], { cwd: wt, timeout: 1500000, maxBuffer: 1 << 26 });
      verdict.build = fs.existsSync(path.join(wt, "out", "index.html")) ? "out/ built: " + (b.stdout || "").trim().split("\n").pop() : "NO out/ after build";
    }
    for (const [name, cmd] of gates) {
      const r = sh("bash", ["-c", cmd], { cwd: wt, timeout: 600000, maxBuffer: 1 << 26 });
      verdict.gates[name] = judge(r.status, (r.stdout || "") + (r.stderr || ""));
    }
  } finally {
    sh("git", ["-C", repo, "worktree", "remove", "--force", wt]);
    fs.rmSync(T, { recursive: true, force: true });
  }
  return verdict;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const a = process.argv.slice(2);
  const opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const baseRef = a[0];
  if (!baseRef || baseRef.startsWith("--")) { console.error("usage: merge_base_red_precheck.mjs <baseRef> [--out f] [--out-dir d] [--gates spec] [--repo p]"); process.exit(2); }
  const repo = opt("--repo") || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const gates = opt("--gates") ? parseGates(opt("--gates")) : DEFAULT_GATES;
  const v = run({ baseRef, repo, outDir: opt("--out-dir"), gates, build: a.includes("--build") });
  const json = JSON.stringify(v, null, 2);
  if (opt("--out")) fs.writeFileSync(opt("--out"), json + "\n");
  console.log(json);
  const reds = Object.entries(v.gates).filter(([, g]) => g.status !== "pass");
  console.log(reds.length ? `BASE-RED ${reds.map(([n, g]) => n + ":" + g.status).join(" ")}` : "BASE-GREEN");
  process.exit(0);
}
