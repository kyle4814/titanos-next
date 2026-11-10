// f381 mutation runner: one bug at a time into the dispute-trail D1 wiring (src/build_deps.ts); test/f381_dispute_trail_d1_wiring.test.ts must FAIL; restore.
// Usage: node test/mutate_f381_dispute_wiring.mjs (from portal-api). Synthetic only; source restored in a finally block.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const B = new URL("../src/build_deps.ts", import.meta.url).pathname, orig = readFileSync(B, "utf8");
const TEST = new URL("./f381_dispute_trail_d1_wiring.test.ts", import.meta.url).pathname;
const M = [
  ["wiring dropped (no disputes passed: service falls to memoryTrail)", `, internalSecret, disputes: disputeTrailFor(db, marketStore) }`, `, internalSecret }`],
  ["cases left in memory", `cases: new D1DisputeCaseStore(db, async`, `cases: new MemoryTenantCaseStore(async`],
  ["anchors left in memory", `anchors: new D1AnchorStore(db) }`, `anchors: new MemoryAnchorStore() }`],
  ["tenant resolved to a constant (cross-tenant bleed)", `(await market.getJob(jobId))?.ownerAccountId`, `"acc_owner"`],
  ["tenant resolves nothing (every write refused)", `(await market.getJob(jobId))?.ownerAccountId`, `undefined`],
];
let survived = 0;
try {
  for (const [name, from, to] of M) {
    if (!orig.includes(from)) { console.log(`SKIP (anchor missing): ${name}`); survived++; continue; }
    let src = orig.replace(from, to);
    if (to.includes("MemoryTenantCaseStore")) src = src.replace(`import { D1DisputeCaseStore }`, `import { MemoryTenantCaseStore } from "./market/dispute_case_store.ts";\nimport { D1DisputeCaseStore }`);
    if (to.includes("MemoryAnchorStore")) src = src.replace(`import { D1AnchorStore }`, `import { MemoryAnchorStore } from "./market/audit_anchor.ts";\nimport { D1AnchorStore }`);
    writeFileSync(B, src);
    const r = spawnSync("node", ["--experimental-strip-types", "--test", TEST], { encoding: "utf8" });
    const killed = r.status !== 0; if (!killed) survived++;
    console.log(`${killed ? "KILLED  " : "SURVIVED"} ${name}`);
  }
} finally { writeFileSync(B, orig); }
console.log(survived === 0 ? `ALL ${M.length} MUTANTS KILLED` : `${survived} SURVIVED`);
process.exit(survived === 0 ? 0 : 1);
