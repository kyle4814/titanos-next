// Mutation check for the F-66 off-topic guard: copy the sources to a scratch dir, remove the guard (and each half of it), and require test_concierge_offtopic.mjs to FAIL.
// The unmutated copy must pass first. Nothing under the real tree is touched.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const real = new URL("..", import.meta.url).pathname;
const GUARD = 'if (!top.phrase && q.some((t) => OFFTOPIC_CUES.has(t))) return unmatched(raw, seat, "no_match");';
const MUTANTS = [
  ["whole guard removed", "lib/concierge/router.ts", GUARD, ""],
  ["guard fires even on a phrase hit", "lib/concierge/router.ts", GUARD, 'if (q.some((t) => OFFTOPIC_CUES.has(t))) return unmatched(raw, seat, "no_match");'],
  ["guard drops every ask (kills genuine)", "lib/concierge/router.ts", GUARD, 'if (!top.phrase) return unmatched(raw, seat, "no_match");'],
  ["cue list emptied", "lib/concierge/offtopic.ts", "new Set(RAW.split(/\\s+/).flatMap((w) => tokens(w)))", "new Set<string>()"],
  ["cue list polluted with a shelf word", "lib/concierge/offtopic.ts", "bitcoin crypto", "bitcoin price crypto"],
];
const copy = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "f66_mut_"));
  if (!d.startsWith(os.tmpdir() + "/f66_mut_")) throw new Error("unsafe scratch dir");
  for (const p of ["lib/concierge", "lib/offers", "scripts"]) { fs.mkdirSync(path.dirname(d + "/" + p), { recursive: true }); fs.cpSync(real + p, d + "/" + p, { recursive: true }); }
  return d;
};
const runTest = (d) => { try { execFileSync("node", ["--experimental-strip-types", d + "/scripts/test_concierge_offtopic.mjs"], { stdio: "pipe" }); return 0; } catch (e) { return e.status || 1; } };
let bad = 0;
const base = copy(); const baseCode = runTest(base); fs.rmSync(base, { recursive: true, force: true });
console.log("unmutated copy:", baseCode === 0 ? "PASS (required)" : "FAIL (BAD)"); if (baseCode !== 0) bad++;
for (const [name, file, from, to] of MUTANTS) {
  const d = copy(); const f = d + "/" + file; const src = fs.readFileSync(f, "utf8");
  if (!src.includes(from)) { console.log("MUTANT NOT APPLIED (pattern missing):", name); bad++; fs.rmSync(d, { recursive: true, force: true }); continue; }
  fs.writeFileSync(f, src.replace(from, to));
  const code = runTest(d); fs.rmSync(d, { recursive: true, force: true });
  console.log((code !== 0 ? "KILLED  " : "SURVIVED ") + name); if (code === 0) bad++;
}
console.log(bad ? "MUTATION CHECK FAILED" : "all mutants killed"); process.exit(bad ? 1 : 0);
