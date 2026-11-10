// Mutation runner for f368. Each mutant re-introduces the rev bump on a rejected owner request, runs test/f368_owner_rejected_paths.test.ts,
// MUST see a failure, then restores the file byte-for-byte (finally + sha check). Usage: node test/mutate_owner_rejected.mjs   (exit 1 if a mutant survives)
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);
const SVC = "src/owner/service.ts", ENG = "src/owner/engine.ts", SUITE = "test/f368_owner_rejected_paths.test.ts";
const M = [
  { id: "M1 undo always writes", file: SVC, from: `undoFix(c, s, fixId), (r) => !r.ok)`, to: `undoFix(c, s, fixId), () => false)` },
  { id: "M2 fix always writes", file: SVC, from: `(r) => !r.ok && (r.reason === "unknown_check" || r.reason === "not_open" || r.reason === "no_zone"))`, to: `() => false)` },
  { id: "M3 casTx ignores write:false", file: ENG, from: `if (r.write === false) return r;`, to: `` },
  { id: "M4 tx drops the rejected flag", file: SVC, from: `write: !rejected(out)`, to: `write: true` },
];
let survived = 0;
for (const m of M) {
  const orig = readFileSync(m.file, "utf8"), h = sha(orig);
  if (!orig.includes(m.from)) { console.log(`PATTERN GONE ${m.id}`); survived++; continue; }
  try {
    writeFileSync(m.file, orig.replace(m.from, m.to));
    const r = spawnSync("node", ["--test", "--experimental-strip-types", SUITE], { encoding: "utf8" });
    console.log(`${r.status !== 0 ? "KILLED  " : "SURVIVED"} ${m.id}`); if (r.status === 0) survived++;
  } finally { writeFileSync(m.file, orig); if (sha(readFileSync(m.file, "utf8")) !== h) { console.log("RESTORE FAILED " + m.file); process.exit(2); } }
}
console.log(survived ? `MUTATION FAILED ${survived} survived` : `MUTATION OK ${M.length}/${M.length} killed`);
process.exit(survived ? 1 : 0);
