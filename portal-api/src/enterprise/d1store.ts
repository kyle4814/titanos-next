// D1EntStore: the EntStore over D1 (migrations 0003_enterprise + 0006_d1_wire). Isolation rule from the migration header:
// every query on a tenant-owned table carries tenant_id in its WHERE clause. There is deliberately still no assetById(id).
import type { D1Like } from "../env.ts";
import { availableCents, type EntStore } from "./store.ts";
import { isSealed, openSecret, sealSecret, type SealKeyring } from "./seal.ts";
import type { Asset, AuditEntry, Invite, LedgerEntry, Member, Payout, Referral, SsoConfig, SsoState, Tenant } from "./types.ts";

type Batchable = D1Like & { batch?: (s: unknown[]) => Promise<unknown> };
const changes = (r: unknown) => Number((r as { meta?: { changes?: number } })?.meta?.changes ?? 0);
const num = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v));
type Row = Record<string, any>;

export class D1EntStore implements EntStore {
  db: Batchable; ring?: SealKeyring;
  // ring: the SSO client secret is AES-GCM sealed (context = tenant id) before it reaches the column. No ring = putSso refuses (fail closed).
  constructor(db: D1Like, ring?: SealKeyring) { this.db = db as Batchable; this.ring = ring; }
  private one(sql: string, ...a: unknown[]) { return this.db.prepare(sql).bind(...a).first<Row>(); }
  private many(sql: string, ...a: unknown[]) { return this.db.prepare(sql).bind(...a).all<Row>().then((r) => r.results); }
  private run(sql: string, ...a: unknown[]) { return this.db.prepare(sql).bind(...a).run(); }

  tenant = (r: Row): Tenant => ({
    id: r.id, slug: r.slug, name: r.name, kind: r.kind, parentId: r.parent_id ?? undefined, createdAt: Number(r.created_at), deletedAt: num(r.deleted_at),
    ssoEnforced: !!r.sso_enforced, partnerAccess: !!r.partner_access,
    brand: r.brand_name ? { name: r.brand_name, colour: r.brand_colour, tagline: r.brand_tagline } : undefined, brandPublic: r.brand_public ? true : undefined,
    refCode: r.ref_code ?? undefined, termsAcceptedAt: num(r.terms_accepted_at), payoutAccount: r.payout_account ?? undefined,
  });
  async putTenant(t: Tenant) {
    await this.run("INSERT INTO tenants (id, slug, name, kind, parent_id, created_at, deleted_at, sso_enforced, partner_access, brand_name, brand_colour, brand_tagline, brand_public, ref_code, terms_accepted_at, payout_account) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) " +
      "ON CONFLICT(id) DO UPDATE SET name=excluded.name, deleted_at=excluded.deleted_at, sso_enforced=excluded.sso_enforced, partner_access=excluded.partner_access, brand_name=excluded.brand_name, brand_colour=excluded.brand_colour, brand_tagline=excluded.brand_tagline, brand_public=excluded.brand_public, ref_code=excluded.ref_code, terms_accepted_at=excluded.terms_accepted_at, payout_account=excluded.payout_account",
      t.id, t.slug, t.name, t.kind, t.parentId ?? null, t.createdAt, t.deletedAt ?? null, t.ssoEnforced ? 1 : 0, t.partnerAccess ? 1 : 0, t.brand?.name ?? null, t.brand?.colour ?? null, t.brand?.tagline ?? null, t.brandPublic ? 1 : 0, t.refCode ?? null, t.termsAcceptedAt ?? null, t.payoutAccount ?? null);
  }
  async tenantById(id: string) { const r = await this.one("SELECT * FROM tenants WHERE id = ?", id); return r ? this.tenant(r) : undefined; }
  async tenantBySlug(slug: string) { const r = await this.one("SELECT * FROM tenants WHERE slug = ?", slug); return r ? this.tenant(r) : undefined; }
  async childrenOf(pid: string) { return (await this.many("SELECT * FROM tenants WHERE parent_id = ? AND deleted_at IS NULL ORDER BY rowid", pid)).map(this.tenant); }
  async partnerByRefCode(code: string) { const r = await this.one("SELECT * FROM tenants WHERE kind = 'partner' AND ref_code = ? AND deleted_at IS NULL", code); return r ? this.tenant(r) : undefined; }
  async setEnforcement(t: string, enabled: boolean) { await this.run("UPDATE tenants SET sso_enforced = ? WHERE id = ?", enabled ? 1 : 0, t); }

  member = (r: Row): Member => ({ tenantId: r.tenant_id, accountId: r.account_id, role: r.role, addedAt: Number(r.added_at) });
  async putMember(m: Member) { await this.run("INSERT INTO tenant_members (tenant_id, account_id, role, added_at) VALUES (?,?,?,?) ON CONFLICT(tenant_id, account_id) DO UPDATE SET role=excluded.role, added_at=excluded.added_at", m.tenantId, m.accountId, m.role, m.addedAt); }
  async memberOf(t: string, a: string) { const r = await this.one("SELECT * FROM tenant_members WHERE tenant_id = ? AND account_id = ?", t, a); return r ? this.member(r) : undefined; }
  async membersOf(t: string) { return (await this.many("SELECT * FROM tenant_members WHERE tenant_id = ? ORDER BY rowid", t)).map(this.member); }
  async membershipsFor(a: string) { return (await this.many("SELECT * FROM tenant_members WHERE account_id = ? ORDER BY rowid", a)).map(this.member); }
  async removeMember(t: string, a: string) { await this.run("DELETE FROM tenant_members WHERE tenant_id = ? AND account_id = ?", t, a); }
  async removeAccount(a: string) {
    await this.run("DELETE FROM tenant_members WHERE account_id = ?", a);
    await this.run("DELETE FROM referrals WHERE account_id = ?", a);
    await this.deleteInvitesBy(a);
  }

  invite = (r: Row): Invite => ({ id: r.id, tenantId: r.tenant_id, email: r.email, role: r.role, invitedBy: r.invited_by, createdAt: Number(r.created_at), expiresAt: Number(r.expires_at) });
  async putInvite(i: Invite) { await this.run("INSERT INTO tenant_invites (id, tenant_id, email, role, invited_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET role=excluded.role, expires_at=excluded.expires_at WHERE tenant_invites.tenant_id = excluded.tenant_id", i.id, i.tenantId, i.email, i.role, i.invitedBy, i.createdAt, i.expiresAt); }
  async invitesForEmail(e: string, now: number) { return (await this.many("SELECT * FROM tenant_invites WHERE email = ? AND expires_at > ? ORDER BY rowid", e, now)).map(this.invite); }
  async inviteById(id: string) { const r = await this.one("SELECT * FROM tenant_invites WHERE id = ?", id); return r ? this.invite(r) : undefined; }
  async invitesOf(t: string) { return (await this.many("SELECT * FROM tenant_invites WHERE tenant_id = ? ORDER BY rowid", t)).map(this.invite); }
  async deleteInvite(id: string) { await this.run("DELETE FROM tenant_invites WHERE id = ?", id); }
  async deleteInvitesBy(a: string, t?: string) { if (t) await this.run("DELETE FROM tenant_invites WHERE invited_by = ? AND tenant_id = ?", a, t); else await this.run("DELETE FROM tenant_invites WHERE invited_by = ?", a); }

  asset = (r: Row): Asset => ({ id: r.id, tenantId: r.tenant_id, domain: r.domain, label: r.label, group: r.grp, token: r.token, verifiedAt: num(r.verified_at) });
  async putAsset(a: Asset) { await this.run("INSERT INTO tenant_assets (id, tenant_id, domain, label, grp, token, verified_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label, grp=excluded.grp, token=excluded.token, verified_at=excluded.verified_at WHERE tenant_assets.tenant_id = excluded.tenant_id", a.id, a.tenantId, a.domain, a.label, a.group, a.token, a.verifiedAt ?? null); }
  async assetsOf(t: string) { return (await this.many("SELECT * FROM tenant_assets WHERE tenant_id = ? ORDER BY rowid", t)).map(this.asset); }
  async assetOf(t: string, id: string) { const r = await this.one("SELECT * FROM tenant_assets WHERE tenant_id = ? AND id = ?", t, id); return r ? this.asset(r) : undefined; }
  async verifiedAssetOwner(domain: string) { const r = await this.one("SELECT * FROM tenant_assets WHERE domain = ? AND verified_at IS NOT NULL ORDER BY rowid LIMIT 1", domain); return r ? this.asset(r) : undefined; }
  async deleteAsset(t: string, id: string) { await this.run("DELETE FROM tenant_assets WHERE tenant_id = ? AND id = ?", t, id); }

  // The client secret arrives already sealed (seal.ts); this column only ever holds the envelope.
  async putSso(c: SsoConfig) {
    if (!this.ring) throw new Error("seal_keyring_missing");
    const secret = await sealSecret(this.ring, c.secret, c.tenantId);
    await this.run("INSERT INTO sso_configs (tenant_id, issuer, client_id, secret_enc, allowed_domains, default_role, last_success_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET issuer=excluded.issuer, client_id=excluded.client_id, secret_enc=excluded.secret_enc, allowed_domains=excluded.allowed_domains, default_role=excluded.default_role, last_success_at=excluded.last_success_at", c.tenantId, c.issuer, c.clientId, secret, JSON.stringify(c.allowedDomains), c.defaultRole, c.lastSuccessAt ?? null);
  }
  async ssoOf(t: string): Promise<SsoConfig | undefined> { const r = await this.one("SELECT * FROM sso_configs WHERE tenant_id = ?", t); return r ? { tenantId: r.tenant_id, issuer: r.issuer, clientId: r.client_id, secret: isSealed(r.secret_enc) && this.ring ? await openSecret(this.ring, r.secret_enc, t) : r.secret_enc, allowedDomains: JSON.parse(r.allowed_domains), defaultRole: r.default_role, lastSuccessAt: num(r.last_success_at) } : undefined; }
  async putSsoState(s: SsoState) { await this.run("INSERT INTO sso_states (hash, tenant_id, client_key, nonce_hash, expires_at, used) VALUES (?,?,?,?,?,?) ON CONFLICT(hash) DO NOTHING", s.hash, s.tenantId, s.clientKey, s.nonceHash, s.expiresAt, s.used ? 1 : 0); }
  async openSsoStates(t: string, now: number, key?: string) {
    await this.run("DELETE FROM sso_states WHERE used = 1 OR expires_at <= ?", now);
    const r = key ? await this.one("SELECT COUNT(*) AS n FROM sso_states WHERE tenant_id = ? AND client_key = ?", t, key) : await this.one("SELECT COUNT(*) AS n FROM sso_states WHERE tenant_id = ?", t);
    return Number(r?.n ?? 0);
  }
  // Single use by construction: the flip to used = 1 is the claim.
  async consumeSsoState(hash: string, now: number): Promise<SsoState | undefined> {
    if (changes(await this.run("UPDATE sso_states SET used = 1 WHERE hash = ? AND used = 0 AND expires_at >= ?", hash, now)) !== 1) return undefined;
    const r = await this.one("SELECT * FROM sso_states WHERE hash = ?", hash);
    return r ? { hash: r.hash, tenantId: r.tenant_id, clientKey: r.client_key, nonceHash: r.nonce_hash, expiresAt: Number(r.expires_at), used: true } : undefined;
  }
  async markSsoSession(h: string, t: string) { await this.run("INSERT INTO sso_sessions (session_hash, tenant_id) VALUES (?,?) ON CONFLICT DO NOTHING", h, t); }
  async isSsoSession(h: string, t: string) { return !!(await this.one("SELECT 1 AS x FROM sso_sessions WHERE session_hash = ? AND tenant_id = ?", h, t)); }

  async addAudit(a: AuditEntry) { await this.run("INSERT INTO tenant_audit (id, tenant_id, actor, action, target, at) VALUES (?,?,?,?,?,?)", a.id, a.tenantId, a.actor, a.action, a.target, a.at); }
  async auditOf(t: string, limit: number): Promise<AuditEntry[]> { return (await this.many("SELECT * FROM tenant_audit WHERE tenant_id = ? ORDER BY rowid DESC LIMIT ?", t, Math.max(0, Math.floor(limit)))).map((r) => ({ id: r.id, tenantId: r.tenant_id, actor: r.actor, action: r.action, target: r.target, at: Number(r.at) })); }

  entry = (r: Row): LedgerEntry => ({
    id: r.id, uniq: r.uniq, partnerId: r.partner_id, kind: r.kind, amountCents: Number(r.amount_cents), at: Number(r.at), availableAt: Number(r.available_at),
    invoiceId: r.invoice_id ?? undefined, sourceKey: r.source_key ?? undefined, sourceLabel: r.source_label ?? undefined, rateBps: num(r.rate_bps), rateVersion: r.rate_version ?? undefined, payoutId: r.payout_id ?? undefined,
    held: r.held ? true : undefined, holdReasons: r.hold_reasons ? JSON.parse(r.hold_reasons) : undefined,
  });
  private entryArgs = (e: LedgerEntry) => [e.id, e.uniq, e.partnerId, e.kind, e.amountCents, e.at, e.availableAt, e.invoiceId ?? null, e.sourceKey ?? null, e.sourceLabel ?? null, e.rateBps ?? null, e.rateVersion ?? null, e.payoutId ?? null, e.held ? 1 : 0, e.holdReasons ? JSON.stringify(e.holdReasons) : null];
  private static INS = "INSERT INTO partner_ledger (id, uniq, partner_id, kind, amount_cents, at, available_at, invoice_id, source_key, source_label, rate_bps, rate_version, payout_id, held, hold_reasons)";
  async addLedger(e: LedgerEntry) { return changes(await this.run(`${D1EntStore.INS} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`, ...this.entryArgs(e))) === 1; }
  async updateLedger(id: string, patch: Partial<Pick<LedgerEntry, "held" | "holdReasons">>) {
    const cur = await this.one("SELECT * FROM partner_ledger WHERE id = ?", id); if (!cur) return undefined;
    const n = { ...this.entry(cur), ...patch };
    await this.run("UPDATE partner_ledger SET held = ?, hold_reasons = ? WHERE id = ?", n.held ? 1 : 0, n.holdReasons ? JSON.stringify(n.holdReasons) : null, id);
    return n;
  }
  async ledgerOf(p: string) { return (await this.many("SELECT * FROM partner_ledger WHERE partner_id = ? ORDER BY at, rowid", p)).map(this.entry); }
  async ledgerForInvoice(id: string) { return (await this.many("SELECT * FROM partner_ledger WHERE invoice_id = ? ORDER BY rowid", id)).map(this.entry); }

  async putReferral(r: Referral) { return changes(await this.run("INSERT INTO referrals (account_id, partner_id, claimed_at) VALUES (?,?,?) ON CONFLICT(account_id) DO NOTHING", r.accountId, r.partnerId, r.claimedAt)) === 1; }
  async referralOf(a: string): Promise<Referral | undefined> { const r = await this.one("SELECT * FROM referrals WHERE account_id = ?", a); return r ? { accountId: r.account_id, partnerId: r.partner_id, claimedAt: Number(r.claimed_at) } : undefined; }

  // ATOMIC: the payout and its negative ledger entry go in one batch, each guarded on the balance still being the one `make` saw.
  // If another reserve got in first the guard fails (0 changes), nothing is written, and we re-read: at most 3 tries.
  async reservePayout(partnerId: string, now: number, minCents: number, make: (amount: number) => { payout: Payout; entry: LedgerEntry }) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const avail = availableCents(await this.ledgerOf(partnerId), now);
      if (avail < minCents) return undefined;
      const { payout, entry } = make(avail);
      const bal = "(SELECT COALESCE(SUM(amount_cents), 0) FROM partner_ledger WHERE partner_id = ? AND held = 0 AND (amount_cents < 0 OR available_at <= ?)) = ?";
      const stmts = [
        this.db.prepare(`INSERT INTO payouts (id, partner_id, amount_cents, status, created_at, provider_ref, reason) SELECT ?,?,?,?,?,?,? WHERE ${bal}`).bind(payout.id, payout.partnerId, payout.amountCents, payout.status, payout.createdAt, payout.providerRef ?? null, payout.reason ?? null, partnerId, now, avail),
        this.db.prepare(`${D1EntStore.INS} SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM payouts WHERE id = ?)`).bind(...this.entryArgs(entry), payout.id),
      ];
      if (this.db.batch) await this.db.batch(stmts); else for (const s of stmts) await s.run();
      if (await this.one("SELECT 1 AS x FROM payouts WHERE id = ?", payout.id)) return payout;
    }
    return undefined;
  }
  payout = (r: Row): Payout => ({ id: r.id, partnerId: r.partner_id, amountCents: Number(r.amount_cents), status: r.status, createdAt: Number(r.created_at), providerRef: r.provider_ref ?? undefined, reason: r.reason ?? undefined });
  async putPayout(p: Payout) { await this.run("INSERT INTO payouts (id, partner_id, amount_cents, status, created_at, provider_ref, reason) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, provider_ref=excluded.provider_ref, reason=excluded.reason WHERE payouts.partner_id = excluded.partner_id", p.id, p.partnerId, p.amountCents, p.status, p.createdAt, p.providerRef ?? null, p.reason ?? null); }
  async transitionPayout(id: string, from: Payout["status"], to: Payout["status"]) {
    if (changes(await this.run("UPDATE payouts SET status = ? WHERE id = ? AND status = ?", to, id, from)) !== 1) return undefined;
    return this.payoutById(id);
  }
  async payoutById(id: string) { const r = await this.one("SELECT * FROM payouts WHERE id = ?", id); return r ? this.payout(r) : undefined; }
  async payoutsOf(p: string) { return (await this.many("SELECT * FROM payouts WHERE partner_id = ? ORDER BY rowid", p)).map(this.payout); }
  async noteFailure(where: string, detail: string, at: number) { await this.run("INSERT INTO ent_failures (where_, detail, at) VALUES (?,?,?)", where, detail, at); }
  async failures() { return (await this.many("SELECT where_, detail, at FROM ent_failures ORDER BY id")).map((r) => ({ where: r.where_, detail: r.detail, at: Number(r.at) })); }
}
