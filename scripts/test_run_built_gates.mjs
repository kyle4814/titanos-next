// Fixture test for run_built_gates.mjs: fake out/ + fake gate scripts covering all four verdicts, plus mutation.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const RUNNER = path.join(path.dirname(new URL(import.meta.url).pathname), "run_built_gates.mjs");
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } else console.log("ok   " + m); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rbg-"));
const mk = (name, body) => { const d = path.join(tmp, name); fs.mkdirSync(d, { recursive: true }); return d; };
const run = (scripts, out, extra = []) => spawnSync("node", [RUNNER, "--root", tmp, "--scripts-dir", scripts, "--out", out, ...extra], { encoding: "utf8" });

try {
  const out = mk("out"); fs.writeFileSync(path.join(out, "index.html"), "<html></html>");
  const sc = mk("scripts");
  const w = (f, s) => fs.writeFileSync(path.join(sc, f), s);
  w("test_f262_anchors.mjs", 'console.log("anchors fine", process.argv.slice(2).join(" "));');          // PASS, checks args
  w("test_perf_budget.mjs", 'console.log("SKIPPED-NO-BUILD pretend");');                                   // exit 0 but says skipped
  w("test_no_hidden_tracking.mjs", 'console.log("tracker found"); process.exit(3);');                      // FAIL
  // doctrine leak + sitemap deliberately absent
  let r = run(sc, out);
  ok(/^PASS\s+exit=0\s+test_f262_anchors\.mjs .*--built /m.test(r.stdout) && r.stdout.includes(`--built ${out}`), "PASS row with exit 0 and --built arg");
  ok(/^SKIPPED-NO-BUILD\s+exit=0\s+test_perf_budget\.mjs/m.test(r.stdout), "gate exit 0 saying SKIPPED is SKIPPED, not PASS");
  ok(/^FAIL\s+exit=3\s+test_no_hidden_tracking\.mjs\s+tracker found/m.test(r.stdout), "FAIL row carries exit code and last line");
  ok(/^SKIPPED-GATE-ABSENT .*no_doctrine_leak/m.test(r.stdout) && /^SKIPPED-GATE-ABSENT .*sitemap/m.test(r.stdout), "absent gates reported, not assumed");
  ok(r.status === 1, "exit non-zero on FAIL");
  ok(/SUMMARY pass=1 fail=1 skipped=3 .*RESULT=FAIL/.test(r.stdout), "summary counts skips: " + r.stdout.split("\n").pop());
  // no out/ -> every present gate SKIPPED-NO-BUILD
  r = run(sc, path.join(tmp, "nope"));
  ok(!/^PASS/m.test(r.stdout) && (r.stdout.match(/^SKIPPED-NO-BUILD/gm) || []).length === 3, "missing out/ gives SKIPPED-NO-BUILD for each present gate");
  ok(/^FAIL/m.test(r.stdout) === false && r.status === 0 && /NOT-PROVEN/.test(r.stdout), "all-skipped is exit 0 but NOT-PROVEN, never PASS");
  // mutation: flip the failing gate to pass => exit flips to 0; flip a passing gate to fail => exit 1
  w("test_no_hidden_tracking.mjs", 'console.log("clean");');
  r = run(sc, out); ok(r.status === 0 && !/^FAIL/m.test(r.stdout), "mutation: fixed gate flips exit to 0");
  w("test_f262_anchors.mjs", "process.exit(1);");
  r = run(sc, out); ok(r.status === 1 && /^FAIL\s+exit=1\s+test_f262_anchors/m.test(r.stdout), "mutation: broken gate flips exit to 1 (no-output line handled)");
  // glob discovery: a differently named sitemap gate is found
  w("test_sitemap_built.sh", 'echo "sitemap ok $1"');
  r = run(sc, out); ok(/^PASS\s+exit=0\s+test_sitemap_built\.sh/m.test(r.stdout), "sitemap gate discovered by glob, bash runner");
  // --build failure path: a root with no package.json cannot npm ci -> FAIL row, gates skipped
  const emptyRoot = mk("root2");
  r = spawnSync("node", [RUNNER, "--root", emptyRoot, "--scripts-dir", sc, "--out", out, "--build"], { encoding: "utf8" });
  ok(r.status === 1 && /^FAIL .*build:npm ci/m.test(r.stdout) && !/^PASS/m.test(r.stdout), "failed --build is FAIL and nothing passes on a stale out/");
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(bad ? `${bad} FAILED` : "ALL OK");
process.exit(bad ? 1 : 0);
