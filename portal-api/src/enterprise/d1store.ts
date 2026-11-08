// D1EntStore + D1ApprovalStore: the D1 adapters for EntStore and ApprovalStore (C8 f315, ported from f16 and brought up to the f286/f313/f314 interface). Schema = migrations 0003_enterprise.sql + 0021_enterprise_d1.sql.
// RULES (from store.ts): (1) tenant_id / partner_id is bound in EVERY WHERE of a tenant-owned table, as a bound argument, never
// in the SQL text; upserts carry a tenant guard so an id owned by tenant B can never be overwritten by tenant A.
// (2) reservePayout and transitionPayout are single atomic steps (a batch of guarded statements / a compare-and-set UPDATE).
// (3) the 30-day hold lives in the ledger rows (available_at) and the available balance is computed in SQL with the same rule
// as availableCents(): negative rows always count, positive rows only once available_at <= now.
// (4) SSO client secrets arrive ALREADY SEALED by the service (f286 keyring + tenant-bound AAD); putSso refuses anything that is not a tsl1 envelope, so plaintext can never land in D1.
import type { D1Like, D1Statement } from "../env.ts";
import type { EntStore } from "./store.ts";
import { isSealed } from "./seal.ts";
import type { ApprovalRecord, ApprovalStore } from "./payout_decision.ts";
import type { Asset, AuditEntry, Invite, LedgerEntry, Member, Payout, Referral, Role, SsoConfig, SsoState, Tenant } from "./types.ts";

type Row = Record<string, any>;
const clean = <T extends object>(o: T): T => { for (const k of Object.keys(o)) if ((o as any)[k] === null || (o as any)[k] === undefined) delete (o as any)[k]; return o; };
const nul = (x: unknown) => (x === undefined ? null : x);
const changes = (r: unknown) => Number((r as { meta?: { changes?: number } } | undefined)?.meta?.changes ?? 0);
const MAX_RESERVE_TRIES = 6;

const tenantOf = (r: Row): Tenant => clean({
  id: r.id, slug: r.slug, name: r.name, kind: r.kind, parentId: r.parent_id, createdAt: Number(r.created_at), deletedAt: r.deleted_at == null ? null : Number(r.deleted_at),
  ssoEnforced: !!r.sso_enforced, partnerAccess: !!r.partner_access,
  brand: r.brand_name == null ? null : { name: r.brand_name, colour: r.brand_colour, tagline: r.brand_tagline },
  brandPublic: r.brand_name == null && !r.brand_public ? null : !!r.brand_public,
  refCode: r.ref_code, termsAcceptedAt: r.terms_accepted_at == null ? null : Number(r.terms_accepted_at), payoutAccount: r.payout_account,
}) as Tenant;
const memberOf_ = (r: Row): Member => ({ tenantId: r.tenant_id, accountId: r.account_id, role: r.role as Role, addedAt: Number(r.added_at) });
const inviteOf = (r: Row): Invite => ({ id: r.id, tenantId: r.tenant_id, email: r.email, role: r.role as Role, invitedBy: r.invited_by, createdAt: Number(r.created_at), expiresAt: Number(r.expires_at) });
const assetOf_ = (r: Row): Asset => clean({ id: r.id, tenantId: r.tenant_id, domain: r.domain, label: r.label, group: r.grp, token: r.token, verifiedAt: r.verified_at == null ? null : Number(r.verified_at) }) as Asset;
const ledgerOf_ = (r: Row): LedgerEntry => clean({
  id: r.id, uniq: r.uniq, partnerId: r.partner_id, kind: r.kind, amountCents: Number(r.amount_cents), at: Number(r.at), availableAt: Number(r.available_at),
  invoiceId: r.invoice_id, sourceKey: r.source_key, sourceLabel: r.source_label, rateBps: r.rate_bps == null ? null : Number(r.rate_bps), rateVersion: r.rate_version, payoutId: r.payout_id,
  held: r.held ? true : null, holdReasons: r.hold_reasons == null ? null : JSON.parse(r.hold_reasons),
}) as LedgerEntry;
const payoutOf = (r: Row): Payout => clean({ id: r.id, partnerId: r.partner_id, amountCents: Number(r.amount_cents), status: r.status, createdAt: Number(r.created_at), providerRef: r.provider_ref, reason: r.reason, sendingAt: r.sending_at == null ? null : Number(r.sending_at), attempts: r.attempts == null ? null : Number(r.attempts), heldAt: r.held_at == null ? null : Number(r.held_at) }) as Payout;

const LEDGER_INSERT_COLS = "id, uniq, partner_id, kind, amount_cents, at, available_at, invoice_id, source_key, source_label, rate_bps, rate_version, payout_id, held, hold_reasons";
const ledgerArgs = (e: LedgerEntry) => [e.id, e.uniq, e.partnerId, e.kind, e.amountCents, e.at, e.availableAt, nul(e.invoiceId), nul(e.sourceKey), nul(e.sourceLabel), nul(e.rateBps), nul(e.rateVersion), nul(e.payoutId), e.held ? 1 : 0, e.holdReasons ? JSON.stringify(e.holdReasons) : null];

export class D1EntStore implements EntStore {
  private db: D1Like;
  constructor(db: D1Like) {
    if (!db || typeof db.prepare !== "function") throw new Error("d1entstore_needs_db");
    this.db = db;
  }
  private q(sql: string, ...args: unknown[]): D1Statement { return this.db.prepare(sql).bind(...args); }
  private async all<T = Row>(sql: string, ...args: unknown[]): Promise<T[]> { return (await this.q(sql, ...args).all<T>()).results; }
  private async one<T = Row>(sql: string, ...args: unknown[]): Promise<T | undefined> { return (await this.q(sql, ...args).first<T>()) ?? undefined; }
  private async run(sql: string, ...args: unknown[]): Promise<number> { return changes(await this.q(sql, ...args).run()); }
  private async tx(stmts: D1Statement[]): Promise<unknown[]> {
    if (!this.db.batch) throw new Error("d1_batch_unavailable");   // fail closed: never fall back to non-atomic sequential writes
    return this.db.batch(stmts);
  }

  // ---- tenants (the boundary itself: keyed by its own id) ----
  async putTenant(t: Tenant) {
    await this.run(
      `INSERT INTO tenants (id, slug, name, kind, parent_id, created_at, deleted_at, sso_enforced, partner_access, brand_name, brand_colour, brand_tagline, brand_public, ref_code, terms_accepted_at, payout_account)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name=excluded.name, kind=excluded.kind, parent_id=excluded.parent_id, created_at=excluded.created_at, deleted_at=excluded.deleted_at,
         sso_enforced=excluded.sso_enforced, partner_access=excluded.partner_access, brand_name=excluded.brand_name, brand_colour=excluded.brand_colour, brand_tagline=excluded.brand_tagline,
         brand_public=excluded.brand_public, ref_code=excluded.ref_code, terms_accepted_at=excluded.terms_accepted_at, payout_account=excluded.payout_account`,
      t.id, t.slug, t.name, t.kind, nul(t.parentId), t.createdAt, nul(t.deletedAt), t.ssoEnforced ? 1 : 0, t.partnerAccess ? 1 : 0,
      nul(t.brand?.name), nul(t.brand?.colour), nul(t.brand?.tagline), t.brandPublic ? 1 : 0, nul(t.refCode), nul(t.termsAcceptedAt), nul(t.payoutAccount));
  }
  async tenantById(id: string) { const r = await this.one("SELECT * FROM tenants WHERE id = ?", id); return r && tenantOf(r); }
  async tenantBySlug(slug: string) { const r = await this.one("SELECT * FROM tenants WHERE slug = ?", slug); return r && tenantOf(r); }
  async childrenOf(parentId: string) { return (await this.all("SELECT * FROM tenants WHERE parent_id = ? AND deleted_at IS NULL ORDER BY rowid", parentId)).map(tenantOf); }
  async partnerByRefCode(code: string) { const r = await this.one("SELECT * FROM tenants WHERE kind = 'partner' AND ref_code = ? AND deleted_at IS NULL", code); return r && tenantOf(r); }
  async setEnforcement(tenantId: string, enabled: boolean) { await this.run("UPDATE tenants SET sso_enforced = ? WHERE id = ?", enabled ? 1 : 0, tenantId); }

  // ---- members ----
  async putMember(m: Member) {
    await this.run(`INSERT INTO tenant_members (tenant_id, account_id, role, added_at) VALUES (?,?,?,?)
      ON CONFLICT(tenant_id, account_id) DO UPDATE SET role=excluded.role, added_at=excluded.added_at`, m.tenantId, m.accountId, m.role, m.addedAt);
  }
  async memberOf(tenantId: string, accountId: string) { const r = await this.one("SELECT * FROM tenant_members WHERE tenant_id = ? AND account_id = ?", tenantId, accountId); return r && memberOf_(r); }
  async membersOf(tenantId: string) { return (await this.all("SELECT * FROM tenant_members WHERE tenant_id = ? ORDER BY rowid", tenantId)).map(memberOf_); }
  async membershipsFor(accountId: string) { return (await this.all("SELECT * FROM tenant_members WHERE account_id = ? ORDER BY rowid", accountId)).map(memberOf_); }
  async removeMember(tenantId: string, accountId: string) { await this.run("DELETE FROM tenant_members WHERE tenant_id = ? AND account_id = ?", tenantId, accountId); }
  // account-scoped erasure (privacy): touches only rows that belong to this ACCOUNT, in one transaction
  async removeAccount(accountId: string) {
    await this.tx([
      this.q("DELETE FROM tenant_members WHERE account_id = ?", accountId),
      this.q("DELETE FROM referrals WHERE account_id = ?", accountId),
      this.q("DELETE FROM tenant_invites WHERE invited_by = ?", accountId),
    ]);
  }

  // ---- invites ----
  async putInvite(i: Invite) {
    await this.run(`INSERT INTO tenant_invites (id, tenant_id, email, role, invited_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET email=excluded.email, role=excluded.role, invited_by=excluded.invited_by, created_at=excluded.created_at, expires_at=excluded.expires_at
      WHERE tenant_invites.tenant_id = excluded.tenant_id`, i.id, i.tenantId, i.email, i.role, i.invitedBy, i.createdAt, i.expiresAt);
  }
  async invitesForEmail(email: string, now: number) { return (await this.all("SELECT * FROM tenant_invites WHERE email = ? AND expires_at > ? ORDER BY rowid", email, now)).map(inviteOf); }
  async inviteById(id: string, tenantId?: string) {
    const r = tenantId ? await this.one("SELECT * FROM tenant_invites WHERE id = ? AND tenant_id = ?", id, tenantId) : await this.one("SELECT * FROM tenant_invites WHERE id = ?", id);
    return r && inviteOf(r);
  }
  async invitesOf(tenantId: string) { return (await this.all("SELECT * FROM tenant_invites WHERE tenant_id = ? ORDER BY rowid", tenantId)).map(inviteOf); }
  async deleteInvite(id: string, tenantId?: string) {
    if (tenantId) await this.run("DELETE FROM tenant_invites WHERE id = ? AND tenant_id = ?", id, tenantId); else await this.run("DELETE FROM tenant_invites WHERE id = ?", id);
  }
  async deleteInvitesBy(accountId: string, tenantId?: string) {
    if (tenantId) await this.run("DELETE FROM tenant_invites WHERE invited_by = ? AND tenant_id = ?", accountId, tenantId); else await this.run("DELETE FROM tenant_invites WHERE invited_by = ?", accountId);
  }

  // ---- assets ----
  async putAsset(a: Asset) {
    await this.run(`INSERT INTO tenant_assets (id, tenant_id, domain, label, grp, token, verified_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET domain=excluded.domain, label=excluded.label, grp=excluded.grp, token=excluded.token, verified_at=excluded.verified_at
      WHERE tenant_assets.tenant_id = excluded.tenant_id`, a.id, a.tenantId, a.domain, a.label, a.group, a.token, a.verifiedAt ? a.verifiedAt : null);
  }
  async assetsOf(tenantId: string) { return (await this.all("SELECT * FROM tenant_assets WHERE tenant_id = ? ORDER BY rowid", tenantId)).map(assetOf_); }
  async assetOf(tenantId: string, id: string) { const r = await this.one("SELECT * FROM tenant_assets WHERE tenant_id = ? AND id = ?", tenantId, id); return r && assetOf_(r); }
  // deliberately cross-tenant: "who owns this verified domain" is the uniqueness check; returns the asset so the caller can compare tenant ids
  async verifiedAssetOwner(domain: string) { const r = await this.one("SELECT * FROM tenant_assets WHERE domain = ? AND verified_at IS NOT NULL ORDER BY rowid LIMIT 1", domain); return r && assetOf_(r); }
  async deleteAsset(tenantId: string, id: string) { await this.run("DELETE FROM tenant_assets WHERE tenant_id = ? AND id = ?", tenantId, id); }

  // ---- SSO ----
  async putSso(c: SsoConfig) {
    if (!isSealed(c.secret)) throw new Error("sso_secret_not_sealed");   // fail closed: plaintext never lands in D1
    await this.run(`INSERT INTO sso_configs (tenant_id, issuer, client_id, secret_enc, allowed_domains, default_role, last_success_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(tenant_id) DO UPDATE SET issuer=excluded.issuer, client_id=excluded.client_id, secret_enc=excluded.secret_enc, allowed_domains=excluded.allowed_domains, default_role=excluded.default_role, last_success_at=excluded.last_success_at`,
      c.tenantId, c.issuer, c.clientId, c.secret, JSON.stringify(c.allowedDomains), c.defaultRole, nul(c.lastSuccessAt));
  }
  async ssoOf(tenantId: string) {
    const r = await this.one("SELECT * FROM sso_configs WHERE tenant_id = ?", tenantId);
    if (!r) return undefined;
    return clean({ tenantId: r.tenant_id, issuer: r.issuer, clientId: r.client_id, secret: r.secret_enc, allowedDomains: JSON.parse(r.allowed_domains), defaultRole: r.default_role, lastSuccessAt: r.last_success_at == null ? null : Number(r.last_success_at) }) as SsoConfig;
  }
  async putSsoState(s: SsoState) {
    await this.run(`INSERT INTO sso_states (hash, tenant_id, client_key, nonce_hash, expires_at, used) VALUES (?,?,?,?,?,?)
      ON CONFLICT(hash) DO UPDATE SET client_key=excluded.client_key, nonce_hash=excluded.nonce_hash, expires_at=excluded.expires_at, used=excluded.used WHERE sso_states.tenant_id = excluded.tenant_id`,
      s.hash, s.tenantId, s.clientKey, s.nonceHash, s.expiresAt, s.used ? 1 : 0);
  }
  async openSsoStates(tenantId: string, now: number, clientKey?: string) {
    await this.run("DELETE FROM sso_states WHERE tenant_id = ? AND (used = 1 OR expires_at <= ?)", tenantId, now);   // purges only THIS tenant's dead states
    const r = clientKey === undefined
      ? await this.one<{ n: number }>("SELECT COUNT(*) AS n FROM sso_states WHERE tenant_id = ?", tenantId)
      : await this.one<{ n: number }>("SELECT COUNT(*) AS n FROM sso_states WHERE tenant_id = ? AND client_key = ?", tenantId, clientKey);
    return Number(r?.n ?? 0);
  }
  // single use: ONE conditional UPDATE ... RETURNING, so two concurrent callbacks cannot both consume the state
  async consumeSsoState(hash: string, now: number) {
    const r = await this.one("UPDATE sso_states SET used = 1 WHERE hash = ? AND used = 0 AND expires_at >= ? RETURNING *", hash, now);
    return r && ({ hash: r.hash, tenantId: r.tenant_id, clientKey: r.client_key, nonceHash: r.nonce_hash, expiresAt: Number(r.expires_at), used: true } as SsoState);
  }
  async markSsoSession(sessionHash: string, tenantId: string) { await this.run("INSERT INTO sso_sessions (session_hash, tenant_id) VALUES (?,?) ON CONFLICT DO NOTHING", sessionHash, tenantId); }
  async isSsoSession(sessionHash: string, tenantId: string) { return !!(await this.one("SELECT 1 AS x FROM sso_sessions WHERE session_hash = ? AND tenant_id = ?", sessionHash, tenantId)); }

  // ---- audit ----
  async addAudit(a: AuditEntry) { await this.run("INSERT INTO tenant_audit (id, tenant_id, actor, action, target, at) VALUES (?,?,?,?,?,?)", a.id, a.tenantId, a.actor, a.action, a.target, a.at); }
  async auditOf(tenantId: string, limit: number) {
    return (await this.all("SELECT * FROM tenant_audit WHERE tenant_id = ? ORDER BY rowid DESC LIMIT ?", tenantId, Math.max(0, Math.floor(limit))))
      .map((r) => ({ id: r.id, tenantId: r.tenant_id, actor: r.actor, action: r.action, target: r.target, at: Number(r.at) }));
  }

  // ---- partner ledger and referrals ----
  async addLedger(e: LedgerEntry) {
    return (await this.run(`INSERT INTO partner_ledger (${LEDGER_INSERT_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(partner_id, uniq) DO NOTHING`, ...ledgerArgs(e))) === 1;
  }
  async ledgerOf(partnerId: string) { return (await this.all("SELECT * FROM partner_ledger WHERE partner_id = ? ORDER BY at, rowid", partnerId)).map(ledgerOf_); }
  // deliberately system-wide (clawback walks every partner's rows for one invoice); invoice ids belong to the payer, not to a tenant
  async ledgerForInvoice(invoiceId: string) { return (await this.all("SELECT * FROM partner_ledger WHERE invoice_id = ? ORDER BY rowid", invoiceId)).map(ledgerOf_); }
  async putReferral(r: Referral) { return (await this.run("INSERT INTO referrals (account_id, partner_id, claimed_at) VALUES (?,?,?) ON CONFLICT(account_id) DO NOTHING", r.accountId, r.partnerId, r.claimedAt)) === 1; }
  async referralsOfPartner(partnerId: string) { return (await this.all("SELECT * FROM referrals WHERE partner_id = ? ORDER BY rowid", partnerId)).map((r) => ({ accountId: r.account_id, partnerId: r.partner_id, claimedAt: Number(r.claimed_at) })); }
  // ledger ids are globally unique and only the operator's self-deal tap calls this; it only flips the hold fields
  async updateLedger(id: string, patch: Partial<Pick<LedgerEntry, "held" | "holdReasons">>) {
    const cur = await this.one("SELECT * FROM partner_ledger WHERE id = ?", id);
    if (!cur) return undefined;
    const held = "held" in patch ? !!patch.held : !!cur.held;
    const reasons = "holdReasons" in patch ? (patch.holdReasons ? JSON.stringify(patch.holdReasons) : null) : cur.hold_reasons;
    await this.run("UPDATE partner_ledger SET held = ?, hold_reasons = ? WHERE id = ?", held ? 1 : 0, reasons, id);
    const r = await this.one("SELECT * FROM partner_ledger WHERE id = ?", id);
    return r && ledgerOf_(r);
  }
  async referralOf(accountId: string) { const r = await this.one("SELECT * FROM referrals WHERE account_id = ?", accountId); return r ? { accountId: r.account_id, partnerId: r.partner_id, claimedAt: Number(r.claimed_at) } : undefined; }

  // ---- payouts ----
  // ATOMIC. Read the available balance (negative rows always, positive rows only past the hold), ask the caller for the rows, then
  // ONE batch (one transaction): the ledger row goes in only if the partner's available balance is STILL exactly what was read
  // (compare-and-set on the balance), and the payout row goes in only if that ledger row landed. Of N parallel callers exactly one
  // lands; a loser re-reads, sees the spent balance, and returns undefined (or retries if an unrelated credit moved the balance).
  async reservePayout(partnerId: string, now: number, minCents: number, make: (amount: number) => { payout: Payout; entry: LedgerEntry }) {
    const AVAIL = "SELECT COALESCE(SUM(amount_cents), 0) FROM partner_ledger WHERE partner_id = ? AND held = 0 AND (amount_cents < 0 OR available_at <= ?)";
    for (let attempt = 0; attempt < MAX_RESERVE_TRIES; attempt++) {
      const avail = Number((await this.one<{ a: number }>(`SELECT (${AVAIL}) AS a`, partnerId, now))?.a ?? 0);
      if (avail < minCents || avail <= 0) return undefined;
      const { payout, entry } = make(avail);
      if (payout.partnerId !== partnerId || entry.partnerId !== partnerId || entry.amountCents !== -payout.amountCents || payout.amountCents !== avail || entry.payoutId !== payout.id || entry.held) throw new Error("reserve_mismatch");
      const res = await this.tx([
        this.q(`INSERT INTO partner_ledger (${LEDGER_INSERT_COLS}) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (${AVAIL}) = ?`, ...ledgerArgs(entry), partnerId, now, avail),
        this.q(`INSERT INTO payouts (id, partner_id, amount_cents, status, created_at, provider_ref, reason, sending_at, attempts, held_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM partner_ledger WHERE id = ? AND partner_id = ? AND payout_id = ?)`,
          payout.id, partnerId, payout.amountCents, payout.status, payout.createdAt, nul(payout.providerRef), nul(payout.reason), nul(payout.sendingAt), nul(payout.attempts), nul(payout.heldAt), entry.id, partnerId, payout.id),
      ]);
      if (changes(res[0]) === 1 && changes(res[1]) === 1) return payout;
      // balance moved between read and write: loop and re-read
    }
    return undefined;
  }
  async putPayout(p: Payout) {
    await this.run(`INSERT INTO payouts (id, partner_id, amount_cents, status, created_at, provider_ref, reason, sending_at, attempts, held_at) VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status, provider_ref=excluded.provider_ref, reason=excluded.reason, sending_at=excluded.sending_at, attempts=excluded.attempts, held_at=excluded.held_at WHERE payouts.partner_id = excluded.partner_id`,
      p.id, p.partnerId, p.amountCents, p.status, p.createdAt, nul(p.providerRef), nul(p.reason), nul(p.sendingAt), nul(p.attempts), nul(p.heldAt));
  }
  // compare-and-set on status in ONE UPDATE ... RETURNING: of two concurrent decisions exactly one sees the row in `from`
  async transitionPayout(id: string, from: Payout["status"], to: Payout["status"], partnerId?: string) {
    const r = partnerId
      ? await this.one("UPDATE payouts SET status = ? WHERE id = ? AND status = ? AND partner_id = ? RETURNING *", to, id, from, partnerId)
      : await this.one("UPDATE payouts SET status = ? WHERE id = ? AND status = ? RETURNING *", to, id, from);
    return r && payoutOf(r);
  }
  async payoutById(id: string, partnerId?: string) {
    const r = partnerId ? await this.one("SELECT * FROM payouts WHERE id = ? AND partner_id = ?", id, partnerId) : await this.one("SELECT * FROM payouts WHERE id = ?", id);
    return r && payoutOf(r);
  }
  async payoutsOf(partnerId: string) { return (await this.all("SELECT * FROM payouts WHERE partner_id = ? ORDER BY rowid", partnerId)).map(payoutOf); }
  // partnerId omitted = the sweep's deliberate system-wide read of stuck rows; given = one partner only
  async payoutsByStatus(status: Payout["status"], partnerId?: string) {
    const rows = partnerId === undefined ? await this.all("SELECT * FROM payouts WHERE status = ? ORDER BY rowid", status) : await this.all("SELECT * FROM payouts WHERE status = ? AND partner_id = ? ORDER BY rowid", status, partnerId);
    return rows.map(payoutOf);
  }

  // ---- operator failure log (system-wide by design, never returned to a tenant) ----
  async noteFailure(where: string, detail: string, at: number) { await this.run("INSERT INTO ent_failures (where_, detail, at) VALUES (?,?,?)", where, detail, at); }
  async failures() { return (await this.all("SELECT where_, detail, at FROM ent_failures ORDER BY id")).map((r) => ({ where: r.where_, detail: r.detail, at: Number(r.at) })); }
}

// First-writer-wins decision record for a payout. The partner is copied from the PAYOUT row at insert time, never from the caller, so a
// record can only ever belong to the payout's own partner. `partnerId` (optional) scopes a read or a decide to one partner: another
// partner's payout id is then invisible (decide cannot create, get cannot read). Omitted = the operator path.
export class D1ApprovalStore implements ApprovalStore {
  private db: D1Like;
  constructor(db: D1Like) { if (!db || typeof db.prepare !== "function") throw new Error("d1approvalstore_needs_db"); this.db = db; }
  private row(r: Row): ApprovalRecord { return clean({ payoutId: r.payout_id, decision: r.decision, cardId: r.card_id, decidedAt: Number(r.decided_at), expiresAt: Number(r.expires_at), reason: r.reason }) as ApprovalRecord; }
  async get(payoutId: string, partnerId?: string) {
    const st = partnerId === undefined
      ? this.db.prepare("SELECT * FROM ent_payout_approvals WHERE payout_id = ?").bind(payoutId)
      : this.db.prepare("SELECT * FROM ent_payout_approvals WHERE payout_id = ? AND partner_id = ?").bind(payoutId, partnerId);
    const r = await st.first<Row>();
    return r ? this.row(r) : undefined;
  }
  async decide(r: ApprovalRecord, partnerId?: string) {
    const ins = partnerId === undefined
      ? this.db.prepare(`INSERT INTO ent_payout_approvals (payout_id, partner_id, decision, card_id, decided_at, expires_at, reason) SELECT p.id, p.partner_id, ?, ?, ?, ?, ? FROM payouts p WHERE p.id = ? ON CONFLICT(payout_id) DO NOTHING`)
          .bind(r.decision, r.cardId, r.decidedAt, r.expiresAt, nul(r.reason), r.payoutId)
      : this.db.prepare(`INSERT INTO ent_payout_approvals (payout_id, partner_id, decision, card_id, decided_at, expires_at, reason) SELECT p.id, p.partner_id, ?, ?, ?, ?, ? FROM payouts p WHERE p.id = ? AND p.partner_id = ? ON CONFLICT(payout_id) DO NOTHING`)
          .bind(r.decision, r.cardId, r.decidedAt, r.expiresAt, nul(r.reason), r.payoutId, partnerId);
    const created = changes(await ins.run()) === 1;
    const rec = await this.get(r.payoutId, partnerId);
    if (!rec) throw new Error("approval_payout_unknown");   // no such payout (for this partner): fail closed, never invent a record
    return { record: rec, created };
  }
}

// The seam values for buildEnterpriseDeps(env, { storeFactory, approvals }). Both are pure D1 adapters: no secret, no network, no key.
export const d1EntStoreFactory = (db: D1Like): EntStore => new D1EntStore(db);
export const d1ApprovalFactory = (db: D1Like): ApprovalStore => new D1ApprovalStore(db);
