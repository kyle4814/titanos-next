#!/usr/bin/env node
// C8 f358 SSO start fairness mutation check. Plants each mutant, runs test/f358_sso_start_fairness.test.ts, expects FAIL (killed). Always restores the original bytes. Run: node scripts/mutate_sso_cap.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const S = "src/enterprise/service.ts", E = "src/enterprise/store.ts", T = ["test/f358_sso_start_fairness.test.ts"];
const api = join(dirname(fileURLToPath(import.meta.url)), "..", "portal-api");
const FAIR = 'if (own >= MAX_OPEN_SSO_STATES_PER_CLIENT || (own > 0 && total >= MAX_OPEN_SSO_STATES - SSO_NEWCOMER_RESERVE)) await c.store.evictOldestSsoState(t.id, clientKey, d.now());\n  else if (total >= MAX_OPEN_SSO_STATES) throw new HttpError(429, "too_many_requests");';
const M = [
  [S, "sub-cap and reserve removed (old behaviour: plain 429 at both caps)", FAIR, 'if (own >= MAX_OPEN_SSO_STATES_PER_CLIENT || total >= MAX_OPEN_SSO_STATES) throw new HttpError(429, "too_many_requests");'],
  [S, "newcomer reserve removed (established sources may fill the whole tenant cap)", "total >= MAX_OPEN_SSO_STATES - SSO_NEWCOMER_RESERVE", "total >= MAX_OPEN_SSO_STATES"],
  [S, "per-source sub-cap removed (one source can hold the tenant cap)", "if (own >= MAX_OPEN_SSO_STATES_PER_CLIENT || (own > 0", "if ((own > 0"],
  [E, "eviction ignores the source (evicts anyone's oldest)", "s.tenantId === t && s.clientKey === key && !s.used", "s.tenantId === t && !s.used"],
  [E, "eviction is newest-first", "s.expiresAt < oldest.expiresAt", "s.expiresAt >= oldest.expiresAt"],
];
const origs = new Map(); for (const f of new Set(M.map((m) => m[0]))) origs.set(f, readFileSync(join(api, f), "utf8"));
const restore = () => { for (const [f, s] of origs) writeFileSync(join(api, f), s); };
const run = () => spawnSync("node", ["--test", "--experimental-strip-types", ...T], { cwd: api, encoding: "utf8", timeout: 300000 });
let killed = 0; const survived = [], skipped = [];
try {
  if (run().status !== 0) { console.error("BASELINE FAILS"); process.exitCode = 2; throw new Error("baseline"); }
  for (const [f, name, from, to] of M) {
    const src = origs.get(f);
    if (!src.includes(from)) { skipped.push(name); console.log("SKIP (pattern not found)", name); continue; }
    writeFileSync(join(api, f), src.replace(from, to));
    const r = run(); restore();
    if (r.status !== 0) { killed++; console.log("killed  ", name); } else { survived.push(name); console.log("SURVIVED", name); }
  }
} catch (e) { if (e.message !== "baseline") throw e; } finally { restore(); }
console.log(`mutants: ${killed} killed, ${survived.length} survived, ${skipped.length} skipped of ${M.length}`);
if (survived.length || skipped.length) process.exitCode = 1;
