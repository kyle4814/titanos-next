// Mutation runner for the D1 enterprise stores (C8 f315). Each mutant drops ONE tenant predicate (or one CAS / hold / seal guard) in
// src/enterprise/d1store.ts or payout_decision.ts, runs the contract suite, MUST see a failure, then restores the file byte-for-byte
// (finally block + sha check). Usage: node test/mutate_ent_d1.mjs [id-prefix]   (exit 1 if any mutant survives or a pattern is gone)
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);
const D1 = "src/enterprise/d1store.ts", SUITE = ["test/ent_store_contract.test.ts"];
const T = (id, guard, from, to) => ({ id, guard, file: D1, from, to, suite: SUITE });
const M = [
  T("M01 memberOf", "tenant", `"SELECT * FROM tenant_members WHERE tenant_id = ? AND account_id = ?", tenantId, accountId`, `"SELECT * FROM tenant_members WHERE account_id = ?", accountId`),
  T("M02 membersOf", "tenant", `"SELECT * FROM tenant_members WHERE tenant_id = ? ORDER BY rowid", tenantId`, `"SELECT * FROM tenant_members ORDER BY rowid"`),
  T("M03 removeMember", "tenant", `"DELETE FROM tenant_members WHERE tenant_id = ? AND account_id = ?", tenantId, accountId`, `"DELETE FROM tenant_members WHERE account_id = ?", accountId`),
  T("M04 invitesOf", "tenant", `"SELECT * FROM tenant_invites WHERE tenant_id = ? ORDER BY rowid", tenantId`, `"SELECT * FROM tenant_invites ORDER BY rowid"`),
  T("M05 inviteById (scoped branch)", "tenant", `"SELECT * FROM tenant_invites WHERE id = ? AND tenant_id = ?", id, tenantId`, `"SELECT * FROM tenant_invites WHERE id = ?", id`),
  T("M06 deleteInvite (scoped branch)", "tenant", `"DELETE FROM tenant_invites WHERE id = ? AND tenant_id = ?", id, tenantId`, `"DELETE FROM tenant_invites WHERE id = ?", id`),
  T("M07 deleteInvitesBy (scoped branch)", "tenant", `"DELETE FROM tenant_invites WHERE invited_by = ? AND tenant_id = ?", accountId, tenantId`, `"DELETE FROM tenant_invites WHERE invited_by = ?", accountId`),
  T("M08 putInvite upsert guard", "tenant", `\n      WHERE tenant_invites.tenant_id = excluded.tenant_id`, ``),
  T("M09 assetsOf", "tenant", `"SELECT * FROM tenant_assets WHERE tenant_id = ? ORDER BY rowid", tenantId`, `"SELECT * FROM tenant_assets ORDER BY rowid"`),
  T("M10 assetOf", "tenant", `"SELECT * FROM tenant_assets WHERE tenant_id = ? AND id = ?", tenantId, id`, `"SELECT * FROM tenant_assets WHERE id = ?", id`),
  T("M11 deleteAsset", "tenant", `"DELETE FROM tenant_assets WHERE tenant_id = ? AND id = ?", tenantId, id`, `"DELETE FROM tenant_assets WHERE id = ?", id`),
  T("M12 putAsset upsert guard", "tenant", `\n      WHERE tenant_assets.tenant_id = excluded.tenant_id`, ``),
  T("M13 ssoOf", "tenant", `"SELECT * FROM sso_configs WHERE tenant_id = ?", tenantId`, `"SELECT * FROM sso_configs LIMIT 1"`),
  T("M14 putSsoState upsert guard", "tenant", ` WHERE sso_states.tenant_id = excluded.tenant_id`, ``),
  T("M15 openSsoStates purge", "tenant", `"DELETE FROM sso_states WHERE tenant_id = ? AND (used = 1 OR expires_at <= ?)", tenantId, now`, `"DELETE FROM sso_states WHERE (used = 1 OR expires_at <= ?)", now`),
  T("M16 openSsoStates count (all)", "tenant", `"SELECT COUNT(*) AS n FROM sso_states WHERE tenant_id = ?", tenantId`, `"SELECT COUNT(*) AS n FROM sso_states"`),
  T("M17 openSsoStates count (by client key)", "tenant", `"SELECT COUNT(*) AS n FROM sso_states WHERE tenant_id = ? AND client_key = ?", tenantId, clientKey`, `"SELECT COUNT(*) AS n FROM sso_states WHERE client_key = ?", clientKey`),
  T("M18 isSsoSession", "tenant", `"SELECT 1 AS x FROM sso_sessions WHERE session_hash = ? AND tenant_id = ?", sessionHash, tenantId`, `"SELECT 1 AS x FROM sso_sessions WHERE session_hash = ?", sessionHash`),
  T("M19 auditOf", "tenant", `"SELECT * FROM tenant_audit WHERE tenant_id = ? ORDER BY rowid DESC LIMIT ?", tenantId, `, `"SELECT * FROM tenant_audit ORDER BY rowid DESC LIMIT ?", `),
  T("M20 ledgerOf", "tenant", `"SELECT * FROM partner_ledger WHERE partner_id = ? ORDER BY at, rowid", partnerId`, `"SELECT * FROM partner_ledger ORDER BY at, rowid"`),
  T("M21 referralsOfPartner", "tenant", `"SELECT * FROM referrals WHERE partner_id = ? ORDER BY rowid", partnerId`, `"SELECT * FROM referrals ORDER BY rowid"`),
  T("M22 payoutsOf", "tenant", `"SELECT * FROM payouts WHERE partner_id = ? ORDER BY rowid", partnerId`, `"SELECT * FROM payouts ORDER BY rowid"`),
  T("M23 payoutsByStatus (scoped branch)", "tenant", `"SELECT * FROM payouts WHERE status = ? AND partner_id = ? ORDER BY rowid", status, partnerId`, `"SELECT * FROM payouts WHERE status = ? ORDER BY rowid", status`),
  T("M24 payoutById (scoped branch)", "tenant", `"SELECT * FROM payouts WHERE id = ? AND partner_id = ?", id, partnerId`, `"SELECT * FROM payouts WHERE id = ?", id`),
  T("M25 transitionPayout (scoped branch)", "tenant", `"UPDATE payouts SET status = ? WHERE id = ? AND status = ? AND partner_id = ? RETURNING *", to, id, from, partnerId`, `"UPDATE payouts SET status = ? WHERE id = ? AND status = ? RETURNING *", to, id, from`),
  T("M26 putPayout upsert guard", "tenant", ` WHERE payouts.partner_id = excluded.partner_id`, ``),
  T("M27 reservePayout balance partner predicate", "tenant", `WHERE partner_id = ? AND held = 0 AND`, `WHERE held = 0 AND`),
  T("M28 approvals.get (scoped branch)", "tenant", `"SELECT * FROM ent_payout_approvals WHERE payout_id = ? AND partner_id = ?").bind(payoutId, partnerId)`, `"SELECT * FROM ent_payout_approvals WHERE payout_id = ?").bind(payoutId)`),
  T("M29 approvals.decide (scoped branch)", "tenant", ` FROM payouts p WHERE p.id = ? AND p.partner_id = ? ON CONFLICT`, ` FROM payouts p WHERE p.id = ? ON CONFLICT`),
  T("M30 approvals partner copied from the payout, not the caller", "tenant", `SELECT p.id, p.partner_id, ?, ?, ?, ?, ? FROM payouts p WHERE p.id = ? ON CONFLICT`, `SELECT p.id, 'p1', ?, ?, ?, ?, ? FROM payouts p WHERE p.id = ? ON CONFLICT`),
  T("M31 CAS transitionPayout status check", "CAS", `"UPDATE payouts SET status = ? WHERE id = ? AND status = ? RETURNING *", to, id, from`, `"UPDATE payouts SET status = ? WHERE id = ? RETURNING *", to, id`),
  T("M32 CAS reservePayout balance compare-and-set", "CAS", `WHERE (\${AVAIL}) = ?\`, ...ledgerArgs(entry), partnerId, now, avail)`, `WHERE 1 = 1\`, ...ledgerArgs(entry))`),
  T("M33 CAS consumeSsoState used=0", "CAS", `WHERE hash = ? AND used = 0 AND expires_at >= ?`, `WHERE hash = ? AND expires_at >= ?`),
  T("M34 CAS ledger idempotency", "CAS", `ON CONFLICT(partner_id, uniq) DO NOTHING`, `ON CONFLICT(partner_id, uniq) DO UPDATE SET amount_cents = excluded.amount_cents`),
  T("M35 CAS approvals first-writer-wins (scoped branch)", "CAS", `ON CONFLICT(payout_id) DO NOTHING\`)\n          .bind(r.decision, r.cardId, r.decidedAt, r.expiresAt, nul(r.reason), r.payoutId, partnerId)`, `ON CONFLICT(payout_id) DO UPDATE SET decision = excluded.decision, card_id = excluded.card_id\`)\n          .bind(r.decision, r.cardId, r.decidedAt, r.expiresAt, nul(r.reason), r.payoutId, partnerId)`),
  T("M35b CAS approvals first-writer-wins (operator branch)", "CAS", `ON CONFLICT(payout_id) DO NOTHING\`)\n          .bind(r.decision, r.cardId, r.decidedAt, r.expiresAt, nul(r.reason), r.payoutId)\n      :`, `ON CONFLICT(payout_id) DO UPDATE SET decision = excluded.decision, card_id = excluded.card_id\`)\n          .bind(r.decision, r.cardId, r.decidedAt, r.expiresAt, nul(r.reason), r.payoutId)\n      :`),
  T("M36 hold: positive rows counted before available_at", "hold", `(amount_cents < 0 OR available_at <= ?)`, `(amount_cents < 0 OR available_at <= ? OR 1 = 1)`),
  T("M37 hold: SELF-DEAL held rows payable", "hold", ` AND held = 0 AND `, ` AND `),
  T("M38 seal: plaintext SSO secret accepted", "seal", `if (!isSealed(c.secret)) throw new Error("sso_secret_not_sealed");`, ``),
  T("M39 atomicity: reservation without batch fallback", "atomic", `if (!this.db.batch) throw new Error("d1_batch_unavailable");`, `if (!this.db.batch) return Promise.all(stmts.map((s) => s.run()));`),
];
const only = process.argv[2];
const out = []; let survived = 0, ran = 0;
for (const m of M.filter((x) => !only || x.id.startsWith(only))) {
  const orig = readFileSync(m.file, "utf8");
  ran++;
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
console.log(survived === 0 ? `MUTATIONS OK ${ran}/${ran} killed` : `MUTATIONS FAILED ${survived} of ${ran} survived or missing`);
process.exit(survived === 0 ? 0 : 1);
