// Mutation runner for the EntD1 guards. Each mutant edits ONE guard in place, runs the suites, MUST see a failure, then restores
// the file byte-for-byte (finally block + sha check). Usage: node test/mutate_ent_d1.mjs   (exit 1 if any mutant survives)
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);
const D1 = "src/enterprise/d1store.ts", SHARE = "src/enterprise/share.ts";
const CONTRACT = ["test/ent_store_contract.test.ts"], ENT_D1 = ["test/enterprise.test.ts", "test/tenant_isolation.test.ts"];
const M = [
  { id: "M1 tenant filter: assetOf", guard: "tenant filter", file: D1, from: `"SELECT * FROM tenant_assets WHERE tenant_id = ? AND id = ?", tenantId, id`, to: `"SELECT * FROM tenant_assets WHERE id = ?", id`, suite: CONTRACT },
  { id: "M2 tenant filter: membersOf", guard: "tenant filter", file: D1, from: `"SELECT * FROM tenant_members WHERE tenant_id = ? ORDER BY rowid", tenantId`, to: `"SELECT * FROM tenant_members ORDER BY rowid"`, suite: CONTRACT },
  { id: "M3 tenant filter: auditOf", guard: "tenant filter", file: D1, from: `"SELECT * FROM tenant_audit WHERE tenant_id = ? ORDER BY rowid DESC LIMIT ?", tenantId, `, to: `"SELECT * FROM tenant_audit ORDER BY rowid DESC LIMIT ?", `, suite: CONTRACT },
  { id: "M4 upsert tenant guard: putAsset", guard: "tenant filter", file: D1, from: `\n      WHERE tenant_assets.tenant_id = excluded.tenant_id`, to: ``, suite: CONTRACT },
  { id: "M5 purge scoped to tenant: openSsoStates", guard: "tenant filter", file: D1, from: `"DELETE FROM sso_states WHERE tenant_id = ? AND (used = 1 OR expires_at <= ?)", tenantId, now`, to: `"DELETE FROM sso_states WHERE (used = 1 OR expires_at <= ?)", now`, suite: CONTRACT },
  { id: "M6 CAS: transitionPayout status check", guard: "CAS", file: D1, from: `"UPDATE payouts SET status = ? WHERE id = ? AND status = ? RETURNING *", to, id, from`, to: `"UPDATE payouts SET status = ? WHERE id = ? RETURNING *", to, id`, suite: CONTRACT },
  { id: "M7 CAS: reservePayout balance compare-and-set", guard: "CAS", file: D1, from: `WHERE (\${AVAIL}) = ?\`, ...ledgerArgs(entry), partnerId, now, avail)`, to: `WHERE 1 = 1\`, ...ledgerArgs(entry))`, suite: CONTRACT },
  { id: "M8 CAS: consumeSsoState used=0", guard: "CAS", file: D1, from: `WHERE hash = ? AND used = 0 AND expires_at >= ?`, to: `WHERE hash = ? AND expires_at >= ?`, suite: CONTRACT },
  { id: "M9 hold (adapter): positive rows counted before available_at", guard: "hold", file: D1, from: `(amount_cents < 0 OR available_at <= ?)`, to: `(amount_cents < 0 OR available_at <= ? OR 1 = 1)`, suite: CONTRACT },
  { id: "M10 hold (service): HOLD_DAYS 30 -> 0", guard: "hold", file: SHARE, from: `export const HOLD_DAYS = 30;`, to: `export const HOLD_DAYS = 0;`, suite: ENT_D1, env: { ENT_STORE: "d1" } },
  { id: "M11 self-dealing block removed", guard: "self-dealing block", file: SHARE, from: `    if (own.has(p.id)) continue;\n    return { partner: p, sourceKey: \`tenant:`, to: `    return { partner: p, sourceKey: \`tenant:`, suite: ENT_D1, env: { ENT_STORE: "d1" } },
  { id: "M12 self-dealing block removed (referral path)", guard: "self-dealing block", file: SHARE, from: `p.termsAcceptedAt && !own.has(p.id)) {`, to: `p.termsAcceptedAt) {`, suite: ENT_D1, env: { ENT_STORE: "d1" } },
  { id: "M13 secret sealed before D1: stored in the clear", guard: "sealer", file: D1, from: `const sealed = await this.sealer.seal(c.secret);`, to: `const sealed = c.secret;`, suite: CONTRACT },
  { id: "M14 ledger idempotency: (partner, uniq) conflict overwrites", guard: "CAS", file: D1, from: `ON CONFLICT(partner_id, uniq) DO NOTHING\`, ...ledgerArgs(e)`, to: `ON CONFLICT(partner_id, uniq) DO UPDATE SET amount_cents = excluded.amount_cents\`, ...ledgerArgs(e)`, suite: CONTRACT },
];
const out = []; let survived = 0;
for (const m of M) {
  const orig = readFileSync(m.file, "utf8");
  if (!orig.includes(m.from)) { out.push(`${m.id}: PATTERN NOT FOUND`); survived++; continue; }
  const before = sha(orig);
  writeFileSync(m.file, orig.replace(m.from, m.to));
  let killed = false, detail = "";
  try {
    const r = spawnSync("node", ["--test", "--experimental-strip-types", ...m.suite], { env: { ...process.env, ...(m.env ?? {}) }, encoding: "utf8" });
    killed = r.status !== 0;
    detail = (r.stdout.match(/^# fail (\d+)/m) || [])[1] ?? "?";
  } finally { writeFileSync(m.file, orig); }
  if (sha(readFileSync(m.file, "utf8")) !== before) throw new Error("restore failed " + m.file);
  if (!killed) survived++;
  out.push(`${m.id} [${m.guard}]: ${killed ? "KILLED (" + detail + " failing)" : "SURVIVED"}`);
}
console.log(out.join("\n"));
console.log(survived === 0 ? `MUTATIONS OK ${M.length}/${M.length} killed` : `MUTATIONS FAILED ${survived} survived`);
process.exit(survived === 0 ? 0 : 1);
