// F95 mutation run: each mutant breaks ONE invariant in the owner seat code; the property suite must go red.
// Usage (from portal-api): node scripts/mutate_undo_property.mjs   Restores every file in a finally block.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const T = ["test/owner_undo_property.test.ts", "test/owner_undo_property_d1.test.ts", "test/owner_undo_differential.test.ts"];
const M = [
  ["P1 undo restores exact prior zone", "src/owner/autofix.ts", "await z.setTxt(e.name, e.before);", "await z.setTxt(e.name, e.before.slice(0, -1));"],
  ["P1 rollback restores the zone", "src/owner/engine.ts", "await revertEdits(z, plan.edits); fix.status = \"rolled_back\";", "fix.status = \"rolled_back\";"],
  ["P2 undo twice is a no-op", "src/owner/engine.ts", "if (fix.status === \"undone\" || fix.status === \"rolled_back\") return", "if (fix.status === \"rolled_back\") return"],
  ["P3 re-scan after undo", "src/owner/engine.ts", "await scanNow(c, s, \"owner undo\"); return { ok: true };", "return { ok: true };"],
  ["P3 re-scan after fix", "src/owner/engine.ts", "observe(s, after, c.now(), \"post-fix re-scan\");", ""],
  ["P3 re-scan after rollback", "src/owner/engine.ts", "const restored = await runScan(s.domain, c.doh(s.domain), c.now); observe(s, restored, c.now(), \"rollback re-scan\");", ""],
  ["P4 badge dropped when fault returns", "src/owner/engine.ts", "} else if (want < have) {", "} else if (false) {"],
  ["P5 redirect= refused", "src/owner/autofix.ts", "if (infos.some((i) => i.redirect))", "if (false)"],
  ["P5 over 10 lookups refused", "src/owner/autofix.ts", "if (mergedLookups > SPF_LOOKUP_LIMIT)", "if (mergedLookups > 1000)"],
  // F173: store-level mutants (D1OwnerStore). The D1 run of the property suite and the differential must both go red.
  ["D1 put never updates state_json on conflict", "src/owner/d1ownerstore.ts", "ON CONFLICT(domain_id) DO UPDATE SET state_json = excluded.state_json", "ON CONFLICT(domain_id) DO UPDATE SET state_json = owner_state.state_json"],
  ["D1 get reads the wrong column state", "src/owner/d1ownerstore.ts", 'async get(domainId: string) { return this.parse(await this.db.prepare("SELECT state_json FROM owner_state WHERE domain_id = ?")', 'async get(domainId: string) { return this.parse(await this.db.prepare("SELECT state_json FROM owner_state WHERE domain_id = ? AND 1 = 0")'],
];
const run = () => { const r = spawnSync("node", ["--test", "--experimental-strip-types", ...T], { encoding: "utf8" }); const m = /# fail (\d+)/.exec(r.stdout); return m ? Number(m[1]) : -1; };
let bad = 0;
const base = run(); console.log(`clean tree: ${base} fail (must be 0)`); if (base !== 0) process.exit(1);
for (const [name, file, from, to] of M) {
  const orig = readFileSync(file, "utf8");
  if (!orig.includes(from)) { console.log(`MUTANT NOT APPLICABLE: ${name}`); bad++; continue; }
  try { writeFileSync(file, orig.replace(from, to)); const f = run(); console.log(`${f > 0 ? "KILLED " : "SURVIVED"} ${name}: ${f} fail`); if (f <= 0) bad++; }
  finally { writeFileSync(file, orig); }
}
console.log(bad ? `MUTATION FAILED: ${bad}` : `ALL ${M.length} MUTANTS KILLED`); process.exit(bad ? 1 : 0);
