#!/usr/bin/env node
// C8 f360 mutation check for the D1 path of SSO start fairness. Plants each mutant, runs test/f360_sso_start_d1_parity.test.ts, expects FAIL.
// Always restores the original bytes. Run: node scripts/mutate_sso_cap_d1.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const S = "src/enterprise/service.ts", ST = "src/enterprise/store.ts", D = "src/enterprise/d1store.ts", T = ["test/f360_sso_start_d1_parity.test.ts"];
const api = join(dirname(fileURLToPath(import.meta.url)), "..", "portal-api");
const M = [
  [S, "legacy relief removed on the shared path (f365)", "const freedLegacy = own < MAX_OPEN_SSO_STATES_PER_CLIENT && total >= MAX_OPEN_SSO_STATES && await c.store.evictOldestLegacySsoState(t.id, d.now());", "const freedLegacy = false;"],
  [D, "D1 legacy eviction is a no-op (f365)", "const n = await this.run(`DELETE FROM sso_states WHERE hash = (SELECT hash FROM sso_states WHERE tenant_id = ? AND client_key IS NULL", "return false; const n = await this.run(`DELETE FROM sso_states WHERE hash = (SELECT hash FROM sso_states WHERE tenant_id = ? AND client_key IS NULL"],
  [D, "D1 legacy eviction newest-first (f365)", "client_key IS NULL AND used = 0 AND expires_at > ? ORDER BY COALESCE(created_at, expires_at - ?), rowid LIMIT 1", "client_key IS NULL AND used = 0 AND expires_at > ? ORDER BY COALESCE(created_at, expires_at - ?) DESC, rowid DESC LIMIT 1"],
  [D, "D1 legacy eviction crosses tenants (f365)", "WHERE tenant_id = ? AND client_key IS NULL AND used = 0 AND expires_at > ? ORDER BY", "WHERE ? IS NOT NULL AND client_key IS NULL AND used = 0 AND expires_at > ? ORDER BY"],
  [D, "D1 legacy eviction takes keyed rows too (f365)", "WHERE tenant_id = ? AND client_key IS NULL AND used = 0", "WHERE tenant_id = ? AND client_key IS NOT NULL AND used = 0"],
  [ST, "Memory legacy eviction is a no-op (f365)", "    if (oldest) this.states.delete(oldest.hash);\n    return !!oldest;", "    return false;"],
  [ST, "Memory legacy eviction crosses tenants (f365)", "s.tenantId === t && !s.clientKey && !s.used", "!s.clientKey && !s.used"],

  [S, "sub-cap + reserve removed on the shared path (plain 429)", "if (own >= MAX_OPEN_SSO_STATES_PER_CLIENT || (own > 0 && total >= MAX_OPEN_SSO_STATES - SSO_NEWCOMER_RESERVE)) await c.store.evictOldestSsoState(t.id, clientKey, d.now());\n  else if (total >= MAX_OPEN_SSO_STATES) throw new HttpError(429, \"too_many_requests\");", "if (own >= MAX_OPEN_SSO_STATES_PER_CLIENT || total >= MAX_OPEN_SSO_STATES) throw new HttpError(429, \"too_many_requests\");"],
  [D, "D1 eviction is a no-op (sub-cap removed on the D1 path)", "await this.run(`DELETE FROM sso_states WHERE hash = (SELECT hash FROM sso_states WHERE tenant_id = ? AND client_key = ?", "return; await this.run(`DELETE FROM sso_states WHERE hash = (SELECT hash FROM sso_states WHERE tenant_id = ? AND client_key = ?"],
  [D, "D1 eviction ignores the source (evicts anyone's oldest)", "WHERE tenant_id = ? AND client_key = ? AND used = 0 AND expires_at > ? ORDER BY", "WHERE tenant_id = ? AND ? IS NOT NULL AND used = 0 AND expires_at > ? ORDER BY"],
  [D, "D1 eviction is newest-first", "ORDER BY COALESCE(created_at, expires_at - ?), rowid LIMIT 1", "ORDER BY COALESCE(created_at, expires_at - ?) DESC, rowid DESC LIMIT 1"],
  [D, "D1 eviction also takes legacy NULL rows", "AND client_key = ? AND used = 0 AND expires_at > ?", "AND (client_key = ? OR client_key IS NULL) AND used = 0 AND expires_at > ?"],
  [D, "D1 per-source count ignores the source (tenant-wide)", 'await this.one<{ n: number }>("SELECT COUNT(*) AS n FROM sso_states WHERE tenant_id = ? AND client_key = ?", tenantId, clientKey)', 'await this.one<{ n: number }>("SELECT COUNT(*) AS n FROM sso_states WHERE tenant_id = ? AND ? IS NOT NULL", tenantId, clientKey)'],
  [D, "D1 put drops client_key (rows written NULL)", "s.hash, s.tenantId, s.clientKey, s.nonceHash", "s.hash, s.tenantId, null, s.nonceHash"],
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
