// reexport_proof_feed.mjs: deterministic, READ-ONLY on the kernel, re-export of the two Proof Wall feeds.
//   lib/site-data/proof.json  <- newest klinge-kernel state/baseline/BASELINE_<date>.json (the weekly baseline_remeasure output), via gen_proof_data.mjs
//   lib/ledger.json           <- same values, each row annotated with source_path (a kernel file that exists) and measured (ISO date)
//   public/data/claims-ledger.{json,csv} <- gen_open_data.mjs (derived from proof.json)
// Writes ONLY inside this titanos-next worktree (assertInside guards every write). No network, no live pulls, no value invented:
// a row whose source reading is UNKNOWN stays UNKNOWN, and a ledger row with no source file is flagged traceable:false, never repaired.
// Usage: node scripts/reexport_proof_feed.mjs [--check]     env KERNEL_DIR (default ~/klinge-kernel), KERNEL_BASELINE_DIR
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";

const ROOT = resolve(new URL("../", import.meta.url).pathname);
export function assertInside(path, root = ROOT) {
  const p = resolve(path);
  if (p !== root && !p.startsWith(root + sep)) throw new Error(`refusing to write outside the worktree: ${p}`);
  return p;
}

const KEY_RE = /^[a-z][a-z0-9_]*$/;
const PATH_RE = /((?:state|bin|corpus)\/[\w./-]+?\.(?:jsonl|json|md|py|sh|log)(?![\w]))/;

/** Pure: annotate each ledger row with source_path/measured/derived_from/traceable. Never changes a value. */
export function annotateLedger(ledger, kernelDir, exists = existsSync) {
  const keys = new Set(Object.keys(ledger.n));
  const n = {};
  for (const [k, row] of Object.entries(ledger.n)) {
    const text = String(row.source);
    const m = text.match(PATH_RE);
    const sourcePath = m && exists(`${kernelDir}/${m[1]}`) ? m[1] : null;
    const derivedFrom = text.split(/[;,\s()]+/).filter((t) => t !== k && keys.has(t));
    const measured = String(row.as_of).slice(0, 10);
    n[k] = { ...row, source_path: sourcePath, derived_from: derivedFrom, measured, traceable: Boolean(sourcePath) || derivedFrom.length > 0 };
  }
  return { ...ledger, n };
}

export function untraceableKeys(ledger) {
  return Object.entries(ledger.n).filter(([, r]) => !r.traceable).map(([k]) => k);
}

function main() {
  const check = process.argv.includes("--check");
  const kernel = process.env.KERNEL_DIR || `${homedir()}/klinge-kernel`;
  const run = (script, args) => {
    const r = spawnSync("node", [`scripts/${script}`, ...args], { cwd: ROOT, encoding: "utf8" });
    process.stdout.write(r.stdout);
    if (r.status !== 0) { process.stderr.write(r.stderr); process.exit(r.status || 1); }
  };
  if (check) {
    run("gen_proof_data.mjs", ["--check"]);
  } else {
    run("gen_proof_data.mjs", ["--refresh"]);
    run("gen_open_data.mjs", []);
  }
  const path = assertInside(`${ROOT}/lib/ledger.json`);
  const cur = readFileSync(path, "utf8");
  const next = JSON.stringify(annotateLedger(JSON.parse(cur), kernel), null, 2) + "\n";
  if (check) {
    if (cur !== next) { console.error("STALE: lib/ledger.json differs from a fresh export, run node scripts/reexport_proof_feed.mjs"); process.exit(1); }
    console.log("lib/ledger.json is current");
  } else {
    writeFileSync(path, next);
    const bad = untraceableKeys(JSON.parse(next));
    console.log(`wrote lib/ledger.json: ${Object.keys(JSON.parse(next).n).length} rows, ${bad.length} with no source file (${bad.join(", ") || "none"})`);
  }
}
if (process.argv[1] && process.argv[1].endsWith("reexport_proof_feed.mjs")) main();
