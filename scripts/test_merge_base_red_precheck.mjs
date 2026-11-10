// test_merge_base_red_precheck.mjs - classify() branches + mutation per branch, judge(), and a real throwaway-worktree run on a fixture repo.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { classify, judge, parseGates, run } from "./merge_base_red_precheck.mjs";
import { fileURLToPath } from "node:url";

let pass = 0, fail = 0;
const ok = (c, n, x = "") => { if (c) { pass++; console.log("PASS", n); } else { fail++; console.log("FAIL", n, x); } };
const V = (s) => ({ gates: { g: { status: s, evidence: "e" } } });
const c = (b, h) => classify(V(b), V(h)).g;

ok(c("red", "red") === "INHERITED", "base red + head red = INHERITED");
ok(c("red", "pass") === "INHERITED", "base red + head pass = INHERITED (still reported)");
ok(c("pass", "red") === "CAUSED", "base pass + head red = CAUSED");
ok(c("pass", "pass") === "CLEAN", "base pass + head pass = CLEAN");
ok(c("error", "pass") !== "CLEAN" && c("error", "red") !== "CLEAN" && c("error", "pass") === "UNKNOWN-BASE", "error on base is never CLEAN");
ok(classify({ gates: {} }, V("pass")).g === "UNKNOWN-BASE", "gate missing on base is UNKNOWN-BASE");
ok(c("pass", "error") === "UNKNOWN-HEAD", "error on head is UNKNOWN-HEAD, not CLEAN");

// Mutation test: each mutant of classify's branches must be caught by the table above.
const table = [["red", "red", "INHERITED"], ["red", "pass", "INHERITED"], ["pass", "red", "CAUSED"], ["pass", "pass", "CLEAN"], ["error", "pass", "UNKNOWN-BASE"], ["pass", "error", "UNKNOWN-HEAD"]];
const mutants = {
  "inherited-branch-dropped": (b, h) => (b === "red" ? "CAUSED" : (b === "pass" ? (h === "pass" ? "CLEAN" : h === "red" ? "CAUSED" : "UNKNOWN-HEAD") : "UNKNOWN-BASE")),
  "caused-branch-to-clean": (b, h) => (b === "red" ? "INHERITED" : b === "pass" ? (h === "error" ? "UNKNOWN-HEAD" : "CLEAN") : "UNKNOWN-BASE"),
  "clean-branch-to-caused": (b, h) => (b === "red" ? "INHERITED" : b === "pass" ? (h === "error" ? "UNKNOWN-HEAD" : "CAUSED") : "UNKNOWN-BASE"),
  "base-error-to-clean": (b, h) => (b === "red" ? "INHERITED" : b === "pass" ? (h === "pass" ? "CLEAN" : h === "red" ? "CAUSED" : "UNKNOWN-HEAD") : (h === "pass" ? "CLEAN" : "UNKNOWN-BASE")),
  "head-error-to-clean": (b, h) => (b === "red" ? "INHERITED" : b === "pass" ? (h === "red" ? "CAUSED" : "CLEAN") : "UNKNOWN-BASE"),
};
for (const [name, fn] of Object.entries(mutants)) ok(table.some(([b, h, want]) => fn(b, h) !== want), "mutant caught: " + name);

// judge()
ok(judge(0, "PASS a\nPASS b").status === "pass", "judge exit0 = pass");
ok(judge(1, "PASS a\nFAIL total JS 2649622 > 2540000").status === "red", "judge exit1 = red");
ok(judge(1, "FAIL x").evidence.startsWith("FAIL"), "judge evidence picks FAIL line");
ok(judge(0, "SKIPPED-NO-BUILD").status === "error", "judge no-build = error, never pass");
ok(judge(1, "FAIL built output not found: /x/out (run npm run build first)").status === "error", "judge missing out/ = error, not red");
ok(judge(null, "").status === "error", "judge no exit = error");
ok(judge(1, "Error: Cannot find module 'x'").status === "error", "judge missing module = error");
ok(parseGates("a=echo 1;b=exit 3").length === 2, "parseGates");

// real run on a fixture repo
const T = fs.mkdtempSync(path.join(os.tmpdir(), "brpc."));
if (!T.startsWith(os.tmpdir() + path.sep + "brpc.")) process.exit(97);
try {
  const g = (...a) => spawnSync("git", ["-C", T, "-c", "user.email=t@t", "-c", "user.name=t", ...a], { encoding: "utf8" });
  g("init", "-q"); fs.writeFileSync(path.join(T, "ok.txt"), "x"); g("add", "."); g("commit", "-qm", "base");
  const v = run({ baseRef: "HEAD", repo: T, gates: [["green", "test -f ok.txt"], ["redgate", "echo FAIL boom; exit 1"], ["errgate", "nonexistent_cmd_zz"]] });
  ok(v.gates.green.status === "pass", "fixture run: green gate pass");
  ok(v.gates.redgate.status === "red" && v.gates.redgate.evidence === "FAIL boom", "fixture run: red gate with evidence");
  ok(v.gates.errgate.status === "error", "fixture run: command-not-found = error");
  ok(g("worktree", "list").stdout.trim().split("\n").length === 1, "fixture run: throwaway worktree removed");
  let threw = false; try { run({ baseRef: "nope", repo: T, gates: [] }); } catch { threw = true; }
  ok(threw, "bad base ref throws");
} finally { fs.rmSync(T, { recursive: true, force: true }); }
console.log(`${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
