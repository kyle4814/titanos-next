// Mutation runner for f375. Each mutant re-introduces the rev bump (or removes the guard that makes a rejection free) for ONE branch; the suite
// test/f375_owner_rejected_remaining.test.ts MUST fail the test named in `expect` on BOTH stores. Files are restored byte-for-byte (finally + sha check).
// Usage: node test/mutate_owner_rejected_f375.mjs   (exit 1 if a mutant survives or the wrong test caught it)
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);
const SVC = "src/owner/service.ts", ENG = "src/owner/engine.ts", SUITE = "test/f375_owner_rejected_remaining.test.ts";
const UNDO_FLAG = `undoFix(c, s, fixId), (r) => !r.ok)`, UNDO_ALWAYS = `undoFix(c, s, fixId), () => false)`;
const FIX_FLAG = `(r) => !r.ok && (r.reason === "unknown_check" || r.reason === "not_open" || r.reason === "no_zone"))`;
const PRE = `if (!(await open(d, a, id)).s.fixes.some((x) => x.id === fixId)) throw new HttpError(404, "no_such_fix");`;
const VAL = `if (typeof check !== "string" || !/^[A-Z-]{2,8}$/.test(check)) throw new HttpError(400, "invalid_check");`;
const GAP = `throw new HttpError(429, "scan_too_soon");`;
const M = [
  { id: "N1 undo no_zone bumps (undo always writes)", edits: [[SVC, UNDO_FLAG, UNDO_ALWAYS]], expect: ["undo no_zone"] },
  { id: "N2 fix no_zone bumps (no_zone not flagged)", edits: [[SVC, FIX_FLAG, `(r) => !r.ok && (r.reason === "unknown_check" || r.reason === "not_open"))`]], expect: ["fix no_zone"] },
  { id: "N3 scan_too_soon guard removed (the scan runs and writes)", edits: [[SVC, GAP, `void 0;`]], expect: ["scan scan_too_soon"] },
  { id: "N4 undo no_such_fix bumps (pre-check gone, undo always writes)", edits: [[SVC, PRE, ``], [SVC, UNDO_FLAG, UNDO_ALWAYS]], expect: ["undo no_such_fix"] },
  { id: "N5 fix invalid_check bumps (validation gone, fix always writes)", edits: [[SVC, VAL, ``], [SVC, FIX_FLAG, `() => false)`]], expect: ["fix invalid_check"] },
  { id: "N6 casTx ignores write:false (every rejection that reaches tx bumps; no_such_fix and invalid_check return before tx)", edits: [[ENG, `if (r.write === false) return r;`, ``]], expect: ["undo no_zone", "fix no_zone"] },
];
let bad = 0;
for (const m of M) {
  const files = [...new Set(m.edits.map((e) => e[0]))], orig = Object.fromEntries(files.map((f) => [f, readFileSync(f, "utf8")])), h = Object.fromEntries(files.map((f) => [f, sha(orig[f])]));
  if (m.edits.some(([f, from]) => !orig[f].includes(from))) { console.log(`PATTERN GONE ${m.id}`); bad++; continue; }
  try {
    const cur = { ...orig }; for (const [f, from, to] of m.edits) cur[f] = cur[f].replace(from, to);
    for (const f of files) writeFileSync(f, cur[f]);
    const r = spawnSync("node", ["--test", "--experimental-strip-types", SUITE], { encoding: "utf8" });
    const failed = (r.stdout.match(/^not ok \d+ - f375 (memory|d1): (.+?) leaves/gm) ?? []).map((l) => l.replace(/^not ok \d+ - f375 /, ""));
    const missing = m.expect.flatMap((p) => ["memory", "d1"].filter((k) => !failed.some((l) => l.startsWith(`${k}: ${p} `))).map((k) => `${k}: ${p}`));
    const ok = r.status !== 0 && missing.length === 0;
    console.log(`${ok ? "KILLED  " : "SURVIVED"} ${m.id}${missing.length ? "  (not caught: " + missing.join("; ") + ")" : ""}`); if (!ok) bad++;
  } finally { for (const f of files) { writeFileSync(f, orig[f]); if (sha(readFileSync(f, "utf8")) !== h[f]) { console.log("RESTORE FAILED " + f); process.exit(2); } } }
}
console.log(bad ? `MUTATION FAILED ${bad} survived` : `MUTATION OK ${M.length}/${M.length} killed`);
process.exit(bad ? 1 : 0);
