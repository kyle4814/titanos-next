// Fixture test for proof_feed_freshness_gate.mjs (f388). Synthetic data only. Includes a mutation: the compare disabled must go red.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const GATE = path.join(HERE, "proof_feed_freshness_gate.mjs");
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } else console.log("ok   " + m); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pff-"));
let n = 0;
function fixture({ kernel = "2026-11-10T13:19:51", proofTs = "2026-11-10T13:19:51", ledgerDate = "2026-11-10", rawKernel = null, rawProof = null }) {
  const d = path.join(tmp, "f" + n++);
  const kd = path.join(d, "kernel"), sr = path.join(d, "site");
  fs.mkdirSync(kd, { recursive: true }); fs.mkdirSync(path.join(sr, "lib/site-data"), { recursive: true });
  if (rawKernel !== null) fs.writeFileSync(path.join(kd, "BASELINE_2026-11-10.json"), rawKernel);
  else if (kernel) fs.writeFileSync(path.join(kd, "BASELINE_2026-11-10.json"), JSON.stringify({ ts: kernel, rows: [] }));
  fs.writeFileSync(path.join(sr, "lib/site-data/proof.json"), rawProof ?? JSON.stringify({ generated: { baselineTs: proofTs } }));
  fs.writeFileSync(path.join(sr, "lib/ledger.json"), JSON.stringify({ n: { a: { measured: ledgerDate }, b: { measured: "2026-01-01" } } }));
  return { kd, sr };
}
const run = (fx, extra = [], gate = GATE) => spawnSync("node", [gate, "--kernel-dir", fx.kd, "--site-root", fx.sr, "--today", "2026-11-12", ...extra], { encoding: "utf8" });

try {
  let r = run(fixture({}));
  ok(r.status === 0 && /RESULT=PASS/.test(r.stdout) && /age=2d/.test(r.stdout), "fresh: exit 0, PASS, ages printed");
  r = run(fixture({ proofTs: "2026-11-03T00:00:00" }));
  ok(r.status === 1 && /STALE-VS-KERNEL\s+proof\.json/.test(r.stdout), "site proof.json older than kernel: exit 1");
  r = run(fixture({ ledgerDate: "2026-11-02" }));
  ok(r.status === 1 && /STALE-VS-KERNEL\s+ledger\.json/.test(r.stdout), "site ledger.json older than kernel: exit 1");
  r = run(fixture({ kernel: "2026-09-01T00:00:00", proofTs: "2026-09-02T00:00:00", ledgerDate: "2026-09-02" }));
  ok(r.status === 1 && /PAST-MAX\s+proof\.json/.test(r.stdout), "site newer than kernel but past MAX_DAYS 30: exit 1");
  r = run(fixture({ proofTs: "2026-11-03T00:00:00" }), ["--mode", "warn"]);
  ok(r.status === 0 && /RESULT=WARN/.test(r.stdout), "warn mode: stale prints WARN, exit 0");
  r = run(fixture({ kernel: null }));
  ok(r.status === 0 && /UNKNOWN kernel baseline.*WARNING/.test(r.stdout) && /RESULT=UNKNOWN/.test(r.stdout) && !/RESULT=PASS/.test(r.stdout), "kernel file missing: UNKNOWN, warning, exit 0, never PASS");
  r = run(fixture({ rawKernel: "{not json" }));
  ok(r.status === 0 && /RESULT=UNKNOWN/.test(r.stdout), "malformed kernel JSON: UNKNOWN, exit 0");
  r = run(fixture({ rawProof: "{oops" }));
  ok(r.status === 2 && /malformed JSON/.test(r.stdout) && /RESULT=ERROR/.test(r.stdout), "malformed site JSON: exit 2");
  const fx = fixture({}); fs.rmSync(path.join(fx.sr, "lib/ledger.json"));
  r = run(fx);
  ok(r.status === 2 && /missing/.test(r.stdout), "missing site file: exit 2");
  r = run(fixture({ kernel: null }), ["--mode", "warn"]);
  ok(r.status === 0, "UNKNOWN in warn mode still exit 0");
  // MUTATION: disable the compare; the stale-vs-kernel case must now go wrong (exit 0), proving the test can see the compare.
  const mut = path.join(tmp, "mutant.mjs");
  const src = fs.readFileSync(GATE, "utf8");
  const mutated = src.replace("if (kernelTs != null && siteTs < kernelTs && days(kernelTs, siteTs) >= 1) return", "if (false) return");
  ok(mutated !== src, "mutation applied (compare line found)");
  fs.writeFileSync(mut, mutated);
  r = run(fixture({ proofTs: "2026-11-03T00:00:00", ledgerDate: "2026-11-03" }), [], mut);
  ok(r.status === 0, "MUTANT (compare disabled) lets a stale site through, so the real test above is red-capable");
  const real = run(fixture({ proofTs: "2026-11-03T00:00:00", ledgerDate: "2026-11-03" }));
  ok(real.status === 1, "unmutated gate on the same fixture exits 1 (mutant differs)");
  // wiring: run_built_gates carries the gate
  const rbg = fs.readFileSync(path.join(HERE, "run_built_gates.mjs"), "utf8");
  ok(/proof_feed_freshness_gate/.test(rbg), "gates:built (run_built_gates.mjs) wires the freshness gate");
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(bad ? `FAILED ${bad}` : "ALL OK");
process.exit(bad ? 1 : 0);
