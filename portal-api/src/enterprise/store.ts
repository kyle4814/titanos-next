import type { Asset, AuditEntry, Invite, LedgerEntry, Member, Payout, Referral, SsoConfig, SsoState, Tenant } from "./types.ts";

// Every method that returns a tenant-owned object takes the tenant id. There is deliberately NO "assetById(id)".
export interface EntStore {
  putTenant(t: Tenant): Promise<void>;
  tenantById(id: string): Promise<Tenant | undefined>;
  tenantBySlug(slug: string): Promise<Tenant | undefined>;
  childrenOf(parentId: string): Promise<Tenant[]>;
  putMember(m: Member): Promise<void>;
  memberOf(tenantId: string, accountId: string): Promise<Member | undefined>;
  membersOf(tenantId: string): Promise<Member[]>;
  membershipsFor(accountId: string): Promise<Member[]>;
  removeMember(tenantId: string, accountId: string): Promise<void>;
  removeAccount(accountId: string): Promise<void>;
  putInvite(i: Invite): Promise<void>;
  invitesForEmail(email: string, now: number): Promise<Invite[]>;
  inviteById(id: string): Promise<Invite | undefined>;
  invitesOf(tenantId: string): Promise<Invite[]>;
  partnerByRefCode(code: string): Promise<Tenant | undefined>;
  deleteInvite(id: string): Promise<void>;
  deleteInvitesBy(accountId: string, tenantId?: string): Promise<void>;
  putAsset(a: Asset): Promise<void>;
  assetsOf(tenantId: string): Promise<Asset[]>;
  assetOf(tenantId: string, id: string): Promise<Asset | undefined>;
  verifiedAssetOwner(domain: string): Promise<Asset | undefined>;
  deleteAsset(tenantId: string, id: string): Promise<void>;
  putSso(c: SsoConfig): Promise<void>;
  ssoOf(tenantId: string): Promise<SsoConfig | undefined>;
  putSsoState(s: SsoState): Promise<void>;
  openSsoStates(tenantId: string, now: number, clientKey?: string): Promise<number>; // also purges expired states
  setEnforcement(tenantId: string, enabled: boolean): Promise<void>;
  consumeSsoState(hash: string, now: number): Promise<SsoState | undefined>;
  markSsoSession(sessionHash: string, tenantId: string): Promise<void>;
  isSsoSession(sessionHash: string, tenantId: string): Promise<boolean>;
  addAudit(a: AuditEntry): Promise<void>;
  auditOf(tenantId: string, limit: number): Promise<AuditEntry[]>;
  addLedger(e: LedgerEntry): Promise<boolean>;   // false when uniq already exists (idempotent)
  ledgerOf(partnerId: string): Promise<LedgerEntry[]>;
  ledgerForInvoice(invoiceId: string): Promise<LedgerEntry[]>; // across partners
  putReferral(r: Referral): Promise<boolean>;    // false when the account already has one
  referralOf(accountId: string): Promise<Referral | undefined>;
  // ATOMIC: compute the available balance and write the payout plus its negative ledger entry in one step. A D1
  // adapter must do this in one transaction (batch). Returns undefined when the balance is under `minCents`.
  reservePayout(partnerId: string, now: number, minCents: number, make: (amount: number) => { payout: Payout; entry: LedgerEntry }): Promise<Payout | undefined>;
  putPayout(p: Payout): Promise<void>;
  // ATOMIC compare-and-set on status; undefined when the payout is not in `from` (a D1 adapter: UPDATE ... WHERE status = ?)
  transitionPayout(id: string, from: Payout["status"], to: Payout["status"]): Promise<Payout | undefined>;
  payoutById(id: string): Promise<Payout | undefined>;
  payoutsOf(partnerId: string): Promise<Payout[]>;
  noteFailure(where: string, detail: string, at: number): Promise<void>;
  failures(): Promise<{ where: string; detail: string; at: number }[]>;
}

export function availableCents(entries: LedgerEntry[], now: number): number {
  let n = 0;
  for (const e of entries) if (e.amountCents < 0 || e.availableAt <= now) n += e.amountCents;
  return n;
}

export class MemoryEntStore implements EntStore {
  tenants = new Map<string, Tenant>(); members: Member[] = []; invites = new Map<string, Invite>(); assets = new Map<string, Asset>();
  sso = new Map<string, SsoConfig>(); states = new Map<string, SsoState>(); ssoSessions = new Set<string>(); audit: AuditEntry[] = [];
  ledger = new Map<string, LedgerEntry>(); referrals = new Map<string, Referral>(); payouts = new Map<string, Payout>(); fails: { where: string; detail: string; at: number }[] = [];
  async putTenant(t: Tenant) { this.tenants.set(t.id, t); }
  async tenantById(id: string) { return this.tenants.get(id); }
  async tenantBySlug(slug: string) { return [...this.tenants.values()].find((t) => t.slug === slug); }
  async childrenOf(pid: string) { return [...this.tenants.values()].filter((t) => t.parentId === pid && !t.deletedAt); }
  async putMember(m: Member) { const i = this.members.findIndex((x) => x.tenantId === m.tenantId && x.accountId === m.accountId); if (i >= 0) this.members[i] = m; else this.members.push(m); } // keeps join order
  async memberOf(t: string, a: string) { return this.members.find((m) => m.tenantId === t && m.accountId === a); }
  async membersOf(t: string) { return this.members.filter((m) => m.tenantId === t); }
  async membershipsFor(a: string) { return this.members.filter((m) => m.accountId === a); }
  async removeMember(t: string, a: string) { this.members = this.members.filter((m) => !(m.tenantId === t && m.accountId === a)); }
  async removeAccount(a: string) {
    this.members = this.members.filter((m) => m.accountId !== a); this.referrals.delete(a);
    await this.deleteInvitesBy(a);
  }
  async putInvite(i: Invite) { this.invites.set(i.id, i); }
  async invitesForEmail(e: string, now: number) { return [...this.invites.values()].filter((i) => i.email === e && i.expiresAt > now); }
  async inviteById(id: string) { return this.invites.get(id); }
  async invitesOf(t: string) { return [...this.invites.values()].filter((i) => i.tenantId === t); }
  async partnerByRefCode(code: string) { return [...this.tenants.values()].find((t) => t.kind === "partner" && t.refCode === code && !t.deletedAt); }
  async deleteInvite(id: string) { this.invites.delete(id); }
  async deleteInvitesBy(a: string, t?: string) { for (const [k, i] of this.invites) if (i.invitedBy === a && (!t || i.tenantId === t)) this.invites.delete(k); }
  async putAsset(a: Asset) { this.assets.set(a.id, a); }
  async assetsOf(t: string) { return [...this.assets.values()].filter((a) => a.tenantId === t); }
  async assetOf(t: string, id: string) { const a = this.assets.get(id); return a && a.tenantId === t ? a : undefined; }
  async verifiedAssetOwner(domain: string) { return [...this.assets.values()].find((a) => a.domain === domain && a.verifiedAt); }
  async deleteAsset(t: string, id: string) { const a = this.assets.get(id); if (a && a.tenantId === t) this.assets.delete(id); }
  async putSso(c: SsoConfig) { this.sso.set(c.tenantId, c); }
  async ssoOf(t: string) { return this.sso.get(t); }
  async putSsoState(s: SsoState) { this.states.set(s.hash, s); }
  async openSsoStates(t: string, now: number, key?: string) {
    for (const [k, s] of this.states) if (s.used || s.expiresAt <= now) this.states.delete(k);
    return [...this.states.values()].filter((s) => s.tenantId === t && (!key || s.clientKey === key)).length;
  }
  async setEnforcement(t: string, enabled: boolean) { const x = this.tenants.get(t); if (x) this.tenants.set(t, { ...x, ssoEnforced: enabled }); }
  async consumeSsoState(h: string, now: number) { const s = this.states.get(h); if (!s || s.used || s.expiresAt < now) return undefined; s.used = true; return s; }
  async markSsoSession(h: string, t: string) { this.ssoSessions.add(`${t}:${h}`); }
  async isSsoSession(h: string, t: string) { return this.ssoSessions.has(`${t}:${h}`); }
  async addAudit(a: AuditEntry) { this.audit.push(a); }
  async auditOf(t: string, limit: number) { return this.audit.filter((a) => a.tenantId === t).slice(-limit).reverse(); }
  async addLedger(e: LedgerEntry) { for (const x of this.ledger.values()) if (x.partnerId === e.partnerId && x.uniq === e.uniq) return false; this.ledger.set(e.id, e); return true; }
  async ledgerOf(p: string) { return [...this.ledger.values()].filter((e) => e.partnerId === p).sort((a, b) => a.at - b.at); }
  async ledgerForInvoice(id: string) { return [...this.ledger.values()].filter((e) => e.invoiceId === id); }
  async putReferral(r: Referral) { if (this.referrals.has(r.accountId)) return false; this.referrals.set(r.accountId, r); return true; }
  async referralOf(a: string) { return this.referrals.get(a); }
  async reservePayout(partnerId: string, now: number, minCents: number, make: (amount: number) => { payout: Payout; entry: LedgerEntry }) {
    // no await between the balance read and the writes: atomic in this single-threaded adapter
    const avail = availableCents([...this.ledger.values()].filter((e) => e.partnerId === partnerId), now);
    if (avail < minCents) return undefined;
    const { payout, entry } = make(avail);
    this.payouts.set(payout.id, payout); this.ledger.set(entry.id, entry);
    return payout;
  }
  async putPayout(p: Payout) { this.payouts.set(p.id, p); }
  async transitionPayout(id: string, from: Payout["status"], to: Payout["status"]) { const p = this.payouts.get(id); if (!p || p.status !== from) return undefined; p.status = to; return p; }
  async payoutById(id: string) { return this.payouts.get(id); }
  async payoutsOf(p: string) { return [...this.payouts.values()].filter((x) => x.partnerId === p); }
  async noteFailure(where: string, detail: string, at: number) { this.fails.push({ where, detail, at }); }
  async failures() { return this.fails; }
}
