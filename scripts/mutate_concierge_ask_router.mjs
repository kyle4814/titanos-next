// Mutation check for the F-434 thin-evidence ask rule: copy the sources to a scratch dir, break the rule four ways (plus one constant), and require test_concierge_ask_router.mjs to FAIL each time.
// The unmutated copy must pass first. Nothing under the real tree is touched.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const real = new URL("..", import.meta.url).pathname;
const RULE = "const thin = !!second && !top.phrase && cover(top.d) <= THIN_MATCH && cover(top.d) < cover(second.d);";
const MUTANTS = [
  ["rule removed (never thin)", RULE, "const thin = false;"],
  ["phrase hit no longer exempts (clear phrase asks get asked)", RULE, "const thin = !!second && cover(top.d) <= THIN_MATCH && cover(top.d) < cover(second.d);"],
  ["coverage comparison dropped (every thin top asks)", RULE, "const thin = !!second && !top.phrase && cover(top.d) <= THIN_MATCH;"],
  ["thin limit removed (every top that covers less asks)", RULE, "const thin = !!second && !top.phrase && cover(top.d) < cover(second.d);"],
  ["band widened to 0.9 (clear asks get asked)", "export const ASK_MARGIN_THIN = 0.2;", "export const ASK_MARGIN_THIN = 0.9;"],
];
const copy = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "f434_mut_"));
  if (!d.startsWith(os.tmpdir() + "/f434_mut_")) throw new Error("unsafe scratch dir");
  for (const p of ["lib/concierge", "lib/offers", "scripts"]) { fs.mkdirSync(path.dirname(d + "/" + p), { recursive: true }); fs.cpSync(real + p, d + "/" + p, { recursive: true }); }
  return d;
};
const runTest = (d) => { try { execFileSync("node", ["--experimental-strip-types", d + "/scripts/test_concierge_ask_router.mjs"], { stdio: "pipe" }); return 0; } catch (e) { return e.status || 1; } };
let bad = 0;
const base = copy(); const baseCode = runTest(base); fs.rmSync(base, { recursive: true, force: true });
console.log("unmutated copy:", baseCode === 0 ? "PASS (required)" : "FAIL (BAD)"); if (baseCode !== 0) bad++;
for (const [name, from, to] of MUTANTS) {
  const d = copy(); const f = d + "/lib/concierge/router.ts"; const src = fs.readFileSync(f, "utf8");
  if (!src.includes(from)) { console.log("MUTANT NOT APPLIED (pattern missing):", name); bad++; fs.rmSync(d, { recursive: true, force: true }); continue; }
  fs.writeFileSync(f, src.replace(from, to));
  const code = runTest(d); fs.rmSync(d, { recursive: true, force: true });
  console.log((code !== 0 ? "KILLED  " : "SURVIVED ") + name); if (code === 0) bad++;
}
console.log(bad ? "MUTATION CHECK FAILED" : "all mutants killed"); process.exit(bad ? 1 : 0);
