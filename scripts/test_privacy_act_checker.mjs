// Unit test for the Privacy Act coverage checker logic. Run: node --experimental-strip-types scripts/test_privacy_act_checker.mjs
import assert from "node:assert/strict";
import { assess, QUESTIONS } from "../app/tools/privacy-act-checker/logic.ts";

const all = (a) => Object.fromEntries(QUESTIONS.map((q) => [q.id, a]));
assert.equal(assess(all("no")).verdict, "exempt");
assert.equal(assess(all("unsure")).verdict, "check");
assert.equal(assess({}).verdict, "check", "missing answers are unsure, never exempt");
for (const id of ["turnover", "health", "trading", "contract", "reporting"]) {
  const r = assess({ ...all("no"), [id]: "yes" });
  assert.equal(r.verdict, "covered", id);
  assert.deepEqual(r.reasons, [id]);
}
for (const id of ["related", "other"]) assert.equal(assess({ ...all("no"), [id]: "yes" }).verdict, "check", id);
assert.equal(assess({ ...all("unsure"), health: "yes" }).verdict, "covered", "a definite yes beats unsure");
assert.equal(QUESTIONS.length, 7);
console.log("privacy-act-checker: all assertions passed");
