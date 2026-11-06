// f102 mutation runner: one bug at a time into src/market/audit_anchor.ts (and the migration), require test/audit_anchor.test.ts to FAIL, restore.
// Usage: node test/mutate_audit_anchor.mjs (from portal-api). Synthetic only; sources restored in a finally block.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const SRC = new URL("../src/market/audit_anchor.ts", import.meta.url).pathname, MIG = new URL("../migrations/0006_audit_anchor.sql", import.meta.url).pathname;
const origSrc = readFileSync(SRC, "utf8"), origMig = readFileSync(MIG, "utf8");
const M = [
  [SRC, "A1 conflicting head overwrites (memory)", `return have.head === a.head ? { ok: true, replay: true } : { ok: false, reason: "anchor_conflict" };   // A1, A2`, `if (have.head === a.head) return { ok: true, replay: true }; l[a.seq - 1] = { ...a }; return { ok: true, replay: false };`],
  [SRC, "A1 conflict reported as replay (D1)", `return String(have.head) === a.head ? { ok: true, replay: true } : { ok: false, reason: "anchor_conflict" };`, `return { ok: true, replay: true };`],
  [SRC, "A2 replay is an error (memory)", `? { ok: true, replay: true } : { ok: false, reason: "anchor_conflict" };   // A1, A2`, `? { ok: false, reason: "anchor_conflict" } : { ok: false, reason: "anchor_conflict" };   // A1, A2`],
  [SRC, "A2 replay appends a second row (memory)", `if (have) return`, `if (false) return`],
  [SRC, "A3 gap allowed (memory)", `if (a.seq !== l.length + 1) return { ok: false, reason: "anchor_gap" };`, `if (a.seq < 1) return { ok: false, reason: "anchor_gap" };`],
  [SRC, "A3 gap allowed (D1)", `WHERE ? = (SELECT COALESCE(MAX(seq), 0) + 1 FROM audit_anchor WHERE job_id = ?)`, `WHERE ? >= (SELECT COALESCE(MAX(seq), 0) + 1 FROM audit_anchor WHERE job_id = ?)`],
  [SRC, "A4 head compare skipped", `if (e.hash !== a.head) return { ok: false, reason: "head_mismatch", seq: a.seq };`, ``],
  [SRC, "A4 only the latest anchor is checked", `for (const a of anchors) {\n    const e`, `for (const a of anchors.slice(-1)) {\n    const e`],
  [SRC, "A5 truncation ignored", `if (!e) return { ok: false, reason: "truncated", seq: a.seq };`, `if (!e) continue;`],
  [SRC, "A6 unanchored reported as verified", `if (anchors.length === 0) return { ok: false, reason: "unanchored" };`, `if (anchors.length === 0) return { ok: true, anchoredThrough: 0, unanchoredTail: c.audit.length };`],
  [SRC, "verifier skips internal chain check", `const broken = verifyAudit(c); if (broken !== null) return { ok: false, reason: "chain_broken", seq: broken };`, ``],
  [SRC, "anchorCase blesses a rewrite", `for (const a of have) { if (!c.audit[a.seq - 1] || c.audit[a.seq - 1].hash !== a.head) return { ok: false, reason: \`anchor_mismatch_at_\${a.seq}\` }; }`, ``],
  [SRC, "anchorCase anchors a broken chain", `const broken = verifyAudit(c); if (broken !== null) return { ok: false, reason: \`chain_broken_at_\${broken}\` };`, ``],
  [SRC, "anchorCase counts replays as new", `if (!r.replay) n++;`, `n++;`],
  [SRC, "anchor invalid head accepted", `/^[0-9a-f]{64}$/.test(a.head)`, `typeof a.head === "string"`],
  [SRC, "job isolation broken (list ignores job)", `.bind(jobId).all`, `.bind(jobId.slice(0, 0) + "j").all`],
  [MIG, "trigger: UPDATE allowed", `CREATE TRIGGER IF NOT EXISTS audit_anchor_no_update BEFORE UPDATE`, `CREATE TRIGGER IF NOT EXISTS audit_anchor_no_update BEFORE INSERT`],
  [MIG, "trigger: DELETE allowed", `BEFORE DELETE ON audit_anchor BEGIN SELECT RAISE(ABORT, 'audit_anchor_append_only'); END;`, `BEFORE DELETE ON audit_anchor WHEN 0 BEGIN SELECT RAISE(ABORT, 'x'); END;`],
];
let killed = 0; const survivors = [];
try {
  for (const [file, name, from, to] of M) {
    const orig = file === SRC ? origSrc : origMig;
    if (!orig.includes(from)) { console.log(`NOAPPLY  ${name}`); survivors.push(name + " (pattern did not apply)"); continue; }
    writeFileSync(file, orig.replace(from, to));
    const r = spawnSync("node", ["--test", "--experimental-strip-types", new URL("./audit_anchor.test.ts", import.meta.url).pathname], { encoding: "utf8" });
    writeFileSync(file, orig);
    if (r.status !== 0) { killed++; console.log(`KILLED   ${name}`); } else { survivors.push(name); console.log(`SURVIVED ${name}`); }
  }
} finally { writeFileSync(SRC, origSrc); writeFileSync(MIG, origMig); }
console.log(`MUTATIONS ${killed}/${M.length} killed; survivors: ${survivors.length ? survivors.join("; ") : "none"}`);
process.exit(survivors.length ? 1 : 0);
