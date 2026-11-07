import type { Account, Invoice } from "../store.ts";
import { HttpError, type Deps } from "../service.ts";
import { normaliseDomain, verifyRecordName, verifyRecordValue } from "../dns.ts";
import { normaliseEmail, randomToken, sha256Hex, timingSafeEqual } from "../util.ts";
import type { EntStore } from "./store.ts";
import { ROLES, ROLE_RANK, type Asset, type Brand, type IdpVerifier, type PayoutProvider, type RateTable, type Role, type ScanProvider, type Tenant, type TenantKind } from "./types.ts";
import { SsoError } from "./sso.ts";
import { APPROVAL_ABOVE_CENTS, MIN_PAYOUT_CENTS, balanceCents, clawback, recordCommission, statement, type SelfDealCheck } from "./share.ts";
import { grade, summarise } from "./estate.ts";
import { sealSecret, openSecret, isSealed, SealError, type SealKeyring } from "./seal.ts";
import { retryApprovedPayouts, listHeldPayouts } from "./payout_retry.ts";
import { sweepStuckPayouts, SWEEP_MAX_AGE_MS, type TransferLookup } from "./payout_sweep.ts";
import { decidePayoutRecorded, type ApprovalStore, type DecideReq } from "./payout_decision.ts";

// The context a Worker wires in. Hooks are what the C2 service calls (invoice, refund, deletion, export).
export interface EntContext {
  store: EntStore; idp: IdpVerifier; payouts: PayoutProvider; scan: ScanProvider; rates: RateTable; internalSecret?: string; selfDeal?: SelfDealCheck;
  sealKeys?: SealKeyring;   // C8 f286: SSO client secrets are sealed with this keyring before any store write; absent = putSso answers 503, never plaintext
  payoutLookup?: TransferLookup;   // C8 f50: provider lookup for the resume sweep; absent = the sweep route answers 503
  approvals: ApprovalStore;   // C8 f40: a payout above the card threshold reaches sending only through a record here
}
const DAY = 86_400_000;
export const SSO_STATE_TTL_MS = 10 * 60_000, INVITE_TTL_MS = 7 * DAY, MAX_ASSETS = 2000, MAX_OPEN_SSO_STATES = 1000, MAX_OPEN_SSO_STATES_PER_CLIENT = 20, MAX_PENDING_INVITES = 100;
const RESERVED_SLUGS = new Set(["app", "api", "admin", "www", "login", "sso", "enterprise", "partners", "pro", "agents", "shop", "trust", "investors", "internal", "portal", "static", "titanos"]);
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;
const ent = (d: Deps): EntContext => { if (!d.ent) throw new HttpError(503, "enterprise_unavailable"); return d.ent; };
const nf = () => new HttpError(404, "not_found");

async function audit(d: Deps, tenantId: string, actor: string, action: string, target: string) {
  await ent(d).store.addAudit({ id: randomToken("aud", 6), tenantId, actor, action, target, at: d.now() });
}

// ---- access: ONE gate every tenant route goes through ----
export interface Ctx { account: Account; sessionHash: string }
export async function authCtx(d: Deps, bearer: string | null, authenticate: (d: Deps, b: string | null) => Promise<Account>): Promise<Ctx> {
  const account = await authenticate(d, bearer);
  return { account, sessionHash: await sha256Hex(bearer!.slice(7)) };
}
// Non-members, deleted tenants and unknown ids all get the SAME 404: no existence leak across tenants.
export async function access(d: Deps, ctx: Ctx, tenantId: string, min: Role, kind?: TenantKind): Promise<{ tenant: Tenant; role: Role }> {
  const e = ent(d).store;
  const tenant = typeof tenantId === "string" ? await e.tenantById(tenantId) : undefined;
  const mem = tenant && !tenant.deletedAt ? await e.memberOf(tenant.id, ctx.account.id) : undefined;
  if (!tenant || !mem) throw nf();
  if (kind && tenant.kind !== kind) throw nf();
  if (tenant.ssoEnforced && !(await e.isSsoSession(ctx.sessionHash, tenant.id))) throw new HttpError(401, "sso_required");
  if (ROLE_RANK[mem.role] < ROLE_RANK[min]) throw new HttpError(403, "forbidden");
  return { tenant, role: mem.role };
}

const pub = (t: Tenant, role?: Role) => ({ id: t.id, slug: t.slug, name: t.name, kind: t.kind, parentId: t.parentId, role, ssoEnforced: t.ssoEnforced, partnerAccess: t.partnerAccess, brand: t.brand, refCode: t.kind === "partner" ? t.refCode : undefined, termsAccepted: t.kind === "partner" ? !!t.termsAcceptedAt : undefined });

// ---- provisioning (operator only, INTERNAL_API_SECRET): enterprise and partner seats are sold by a call, then switched on ----
export function checkInternal(d: Deps, header: string | null) {
  const s = ent(d).internalSecret;
  if (!s || !header || !timingSafeEqual(header, s)) throw new HttpError(404, "not_found");
}
// C8 f50: payout operator routes. Fail closed with distinct codes: 503 when no secret is configured, 401 on a missing or wrong one.
export function checkOperator(d: Deps, header: string | null) {
  const s = ent(d).internalSecret;
  if (!s) throw new HttpError(503, "operator_unavailable");
  if (!header || !timingSafeEqual(header, s)) throw new HttpError(401, "unauthorized");
}
const tenantParam = (v: unknown): string | undefined => (typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : undefined);
function boundedInt(v: unknown, dflt: number, lo: number, hi: number): number {
  if (v === undefined) return dflt;
  if (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi) return v;
  throw new HttpError(400, "invalid_input");
}
// Read-only. One tenant per call (tenantId required): the operator view never mixes tenants.
export async function opHeldPayouts(d: Deps, tenantId: string | null) {
  const tid = tenantParam(tenantId ?? undefined);
  if (!tid) throw new HttpError(400, "tenant_required");
  return { tenantId: tid, held: await listHeldPayouts(ent(d).store, tid, d.now()) };
}
// MOCK adapter only (whatever the Worker injected as `payouts`); an unconfigured adapter is 503 and nothing is sent.
export async function opRetryPayouts(d: Deps, b: Record<string, unknown>) {
  const c = ent(d);
  if (!c.payouts || typeof c.payouts.transfer !== "function") throw new HttpError(503, "transfer_adapter_unconfigured");
  if (b.tenantId !== undefined && !tenantParam(b.tenantId)) throw new HttpError(400, "invalid_input");
  const r = await retryApprovedPayouts(c.store, c.payouts, d.now(), boundedInt(b.maxAttempts, 3, 1, 10), tenantParam(b.tenantId));
  const count = (a: string) => r.items.filter((i) => i.action === a).length;
  return { examined: r.examined, paid: count("paid"), retrying: count("approved_retry"), held: count("held"), lostRace: count("lost_race"), items: r.items };
}
export async function opSweepPayouts(d: Deps, b: Record<string, unknown>) {
  const c = ent(d);
  if (!c.payoutLookup || typeof c.payoutLookup.lookup !== "function") throw new HttpError(503, "transfer_lookup_unconfigured");
  if (b.tenantId !== undefined && !tenantParam(b.tenantId)) throw new HttpError(400, "invalid_input");
  const r = await sweepStuckPayouts({ store: c.store, lookup: c.payoutLookup, now: d.now(), tenantId: tenantParam(b.tenantId) }, boundedInt(b.maxAgeMs, SWEEP_MAX_AGE_MS, 0, 7 * DAY));
  const count = (a: string) => r.items.filter((i) => i.action === a).length;
  return { examined: r.examined, skippedYoung: r.skippedYoung, paid: count("paid"), retrying: count("approved_retry"), held: count("held"), lostRace: count("lost_race"), items: r.items };
}
export async function provisionTenant(d: Deps, b: Record<string, unknown>) {
  const e = ent(d).store;
  const kind = b.kind;
  if (kind !== "enterprise" && kind !== "partner") throw new HttpError(400, "invalid_kind");
  const name = cleanText(b.name, 80), slug = cleanSlug(b.slug);
  const email = normaliseEmail(b.adminEmail);
  if (!name || !slug || !email) throw new HttpError(400, "invalid_input");
  if (await e.tenantBySlug(slug)) throw new HttpError(409, "slug_taken");
  const acct = await d.store.accountByEmail(email);
  if (!acct || acct.deletedAt) throw new HttpError(409, "admin_must_sign_in_first");
  const t: Tenant = { id: randomToken("ten", 8), slug, name, kind, createdAt: d.now(), ssoEnforced: false, partnerAccess: false };
  if (kind === "partner") {
    t.refCode = randomToken("pr", 6);
    if (b.termsAccepted === true) t.termsAcceptedAt = d.now();
    if (typeof b.payoutAccount === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(b.payoutAccount)) t.payoutAccount = b.payoutAccount;
  }
  await e.putTenant(t);
  await e.putMember({ tenantId: t.id, accountId: acct.id, role: "admin", addedAt: d.now() });
  if (acct.seat === "owner") await d.store.putAccount({ ...acct, seat: kind });
  await audit(d, t.id, "operator", "tenant.provision", t.id);
  return pub(t, "admin");
}
function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length >= 1 && s.length <= max && !/[<>"`\u0000-\u001f]/.test(s) ? s : null;
}
function cleanSlug(v: unknown): string | null {
  return typeof v === "string" && SLUG_RE.test(v) && !RESERVED_SLUGS.has(v) ? v : null;
}

// ---- my tenants and invites ----
export async function myTenants(d: Deps, ctx: Ctx) {
  const e = ent(d).store;
  const out = [];
  for (const m of await e.membershipsFor(ctx.account.id)) { const t = await e.tenantById(m.tenantId); if (t && !t.deletedAt) out.push(pub(t, m.role)); }
  return { tenants: out };
}
export async function myInvites(d: Deps, ctx: Ctx) {
  const e = ent(d).store;
  const out = [];
  for (const i of await e.invitesForEmail(ctx.account.email, d.now())) { const t = await e.tenantById(i.tenantId); if (t && !t.deletedAt) out.push({ id: i.id, tenant: t.name, role: i.role, expiresAt: i.expiresAt }); }
  return { invites: out };
}
export async function acceptInvite(d: Deps, ctx: Ctx, inviteId: string) {
  const e = ent(d).store;
  const i = await e.inviteById(inviteId);
  if (!i || i.email !== ctx.account.email || i.expiresAt <= d.now()) throw nf();   // an invite for another email looks like no invite
  const t = await e.tenantById(i.tenantId);
  if (!t || t.deletedAt) throw nf();
  if (!(await inviterEntitled(d, t, i.invitedBy))) { await e.deleteInvite(i.id); throw nf(); }   // the inviter must still be an admin (or the client's partner admin)
  await e.deleteInvite(i.id);                                                   // single use, consumed before the grant
  const cur = await e.memberOf(t.id, ctx.account.id);
  if (!cur || ROLE_RANK[cur.role] < ROLE_RANK[i.role]) await e.putMember({ tenantId: t.id, accountId: ctx.account.id, role: i.role, addedAt: d.now() });
  await audit(d, t.id, ctx.account.id, "member.join", ctx.account.id);
  return pub(t, (await e.memberOf(t.id, ctx.account.id))!.role);
}

async function inviterEntitled(d: Deps, t: Tenant, inviterId: string): Promise<boolean> {
  const e = ent(d).store;
  if ((await e.memberOf(t.id, inviterId))?.role === "admin") return true;
  if (t.kind === "client" && t.parentId) { const p = await e.tenantById(t.parentId); return !!p && !p.deletedAt && (await e.memberOf(p.id, inviterId))?.role === "admin"; }
  return false;
}
export async function revokeInvite(d: Deps, ctx: Ctx, tid: string, inviteId: string) {
  await access(d, ctx, tid, "admin");
  const e = ent(d).store, i = await e.inviteById(inviteId);
  if (!i || i.tenantId !== tid) throw nf();
  await e.deleteInvite(inviteId);
  await audit(d, tid, ctx.account.id, "invite.revoke", i.email);
}
// ---- members ----
export async function listMembers(d: Deps, ctx: Ctx, tid: string) {
  await access(d, ctx, tid, "admin");
  const e = ent(d).store;
  const out = [];
  for (const m of await e.membersOf(tid)) { const a = await d.store.accountById(m.accountId); out.push({ accountId: m.accountId, email: a?.email, role: m.role }); }
  const invites = (await e.invitesOf(tid)).map((i) => ({ id: i.id, email: i.email, role: i.role }));
  return { members: out, invites };
}
export async function inviteMember(d: Deps, ctx: Ctx, tid: string, b: Record<string, unknown>) {
  const { tenant } = await access(d, ctx, tid, "admin");
  const email = normaliseEmail(b.email);
  if (!email) throw new HttpError(400, "invalid_email");
  if (typeof b.role !== "string" || !ROLES.includes(b.role as Role)) throw new HttpError(400, "invalid_role");
  if ((await ent(d).store.invitesOf(tenant.id)).filter((i) => i.expiresAt > d.now()).length >= MAX_PENDING_INVITES) throw new HttpError(429, "too_many_pending_invites");
  const id = randomToken("inv", 8);
  await ent(d).store.putInvite({ id, tenantId: tenant.id, email, role: b.role as Role, invitedBy: ctx.account.id, createdAt: d.now(), expiresAt: d.now() + INVITE_TTL_MS });
  await d.mailer.send(email, `You are invited to ${tenant.name} on TITANOS`, `Sign in at ${d.siteOrigin}/app/estate and accept the invite from ${tenant.name}.`);
  await audit(d, tenant.id, ctx.account.id, "member.invite", email);
  return { id, email, role: b.role };
}
async function adminCount(d: Deps, tid: string, except?: string) {
  return (await ent(d).store.membersOf(tid)).filter((m) => m.role === "admin" && m.accountId !== except).length;
}
export async function setRole(d: Deps, ctx: Ctx, tid: string, accountId: string, role: unknown) {
  await access(d, ctx, tid, "admin");
  if (typeof role !== "string" || !ROLES.includes(role as Role)) throw new HttpError(400, "invalid_role");
  const e = ent(d).store;
  const m = await e.memberOf(tid, accountId);
  if (!m) throw nf();
  if (m.role === "admin" && role !== "admin" && (await adminCount(d, tid, accountId)) === 0) throw new HttpError(409, "last_admin");
  await e.putMember({ ...m, role: role as Role });
  if (m.role === "admin" && role !== "admin") await e.deleteInvitesBy(accountId, tid);   // a demoted admin's open invites die with the role
  await audit(d, tid, ctx.account.id, "member.role", `${accountId}:${role}`);
  return { accountId, role };
}
export async function removeMember(d: Deps, ctx: Ctx, tid: string, accountId: string) {
  await access(d, ctx, tid, "admin");
  const e = ent(d).store;
  const m = await e.memberOf(tid, accountId);
  if (!m) throw nf();
  if (m.role === "admin" && (await adminCount(d, tid, accountId)) === 0) throw new HttpError(409, "last_admin");
  await e.removeMember(tid, accountId);
  await e.deleteInvitesBy(accountId, tid);
  await audit(d, tid, ctx.account.id, "member.remove", accountId);
}

// ---- estate: assets, verification, findings ----
export async function addAsset(d: Deps, ctx: Ctx, tid: string, b: Record<string, unknown>) {
  const { tenant } = await access(d, ctx, tid, "admin");
  const e = ent(d).store;
  const domain = normaliseDomain(b.domain);
  if (!domain) throw new HttpError(400, "invalid_domain");
  const label = b.label === undefined ? domain : cleanText(b.label, 80), group = b.group === undefined ? "default" : cleanText(b.group, 40);
  if (!label || !group) throw new HttpError(400, "invalid_input");
  const have = await e.assetsOf(tenant.id);
  const dup = have.find((a) => a.domain === domain);
  if (dup) return presentAsset(dup);
  if (have.length >= MAX_ASSETS) throw new HttpError(409, "asset_limit");
  if (await e.verifiedAssetOwner(domain) || await d.store.verifiedOwnerOf(domain)) throw new HttpError(409, "domain_already_verified_by_another_account");
  const a: Asset = { id: randomToken("ast", 8), tenantId: tenant.id, domain, label, group, token: randomToken("v", 16) };
  await e.putAsset(a);
  await audit(d, tenant.id, ctx.account.id, "asset.add", domain);
  return presentAsset(a);
}
const presentAsset = (a: Asset) => ({ id: a.id, domain: a.domain, label: a.label, group: a.group, verified: !!a.verifiedAt, record: a.verifiedAt ? undefined : { type: "TXT", name: verifyRecordName(a.domain), value: verifyRecordValue(a.token) } });
export async function listAssets(d: Deps, ctx: Ctx, tid: string) {
  await access(d, ctx, tid, "viewer");
  return { assets: (await ent(d).store.assetsOf(tid)).map(presentAsset) };
}
export async function verifyAsset(d: Deps, ctx: Ctx, tid: string, aid: string) {
  await access(d, ctx, tid, "admin");
  const e = ent(d).store;
  const a = await e.assetOf(tid, aid);
  if (!a) throw nf();
  if (a.verifiedAt) return presentAsset(a);
  const other = await e.verifiedAssetOwner(a.domain);
  if ((other && other.tenantId !== tid) || (await d.store.verifiedOwnerOf(a.domain))) throw new HttpError(409, "domain_already_verified_by_another_account");
  let values: string[];
  try { values = await d.dns.txt(verifyRecordName(a.domain)); } catch { throw new HttpError(502, "dns_lookup_failed"); }
  if (!values.includes(verifyRecordValue(a.token))) throw new HttpError(422, "txt_record_not_found");
  a.verifiedAt = d.now();
  await e.putAsset(a);
  await audit(d, tid, ctx.account.id, "asset.verify", a.domain);
  return presentAsset(a);
}
export async function removeAsset(d: Deps, ctx: Ctx, tid: string, aid: string) {
  await access(d, ctx, tid, "admin");
  const e = ent(d).store;
  const a = await e.assetOf(tid, aid);
  if (!a) throw nf();
  await e.deleteAsset(tid, aid);
  const sso = await e.ssoOf(tid);                                                                 // SSO trust never outlives the domain proof
  if (sso?.allowedDomains.includes(a.domain)) {
    await e.putSso({ ...sso, allowedDomains: sso.allowedDomains.filter((x) => x !== a.domain) });
    if (!sso.allowedDomains.some((x) => x !== a.domain)) await e.setEnforcement(tid, false);
  }
  await audit(d, tid, ctx.account.id, "asset.remove", a.domain);
}
// Only verified assets are assessed (we never scan a domain the tenant has not proven it controls).
// Assessment concurrency is capped per estate view; an UNKNOWN assessment never carries a grade or a score.
export type EstateRow = {
  id: string; domain: string; label: string; group: string; verified: boolean;
  status: "NOT_VERIFIED" | "ASSESSED" | "UNKNOWN"; reason: string | null;
  grade: string | null; score: number | null; scannedAt: number | null; resolverSource: string | null;
  findings: { critical: number; high: number; medium: number; low: number };
};
const NO_FINDINGS = () => ({ critical: 0, high: 0, medium: 0, low: 0 });
export async function estate(d: Deps, tid: string) {
  const c = ent(d), tenant = (await c.store.tenantById(tid))!;
  const assets = await c.store.assetsOf(tid);
  const cap = Math.max(1, Math.floor(c.scan.concurrency ?? 25));
  const rows: EstateRow[] = new Array(assets.length);
  let next = 0;
  const one = async (i: number) => {
    const a = assets[i];
    const base = { id: a.id, domain: a.domain, label: a.label, group: a.group };
    if (!a.verifiedAt) { rows[i] = { ...base, verified: false, status: "NOT_VERIFIED", reason: null, grade: null, score: null, scannedAt: null, resolverSource: null, findings: NO_FINDINGS() }; return; }
    try {
      if (c.scan.assess) {
        const r = await c.scan.assess(a.domain);
        rows[i] = r.status === "ASSESSED"
          ? { ...base, verified: true, status: "ASSESSED", reason: null, grade: r.grade, score: r.score, scannedAt: r.scannedAt, resolverSource: r.resolverSource, findings: r.counts }
          : { ...base, verified: true, status: "UNKNOWN", reason: r.reason, grade: null, score: null, scannedAt: r.scannedAt, resolverSource: r.resolverSource, findings: NO_FINDINGS() };
      } else {
        const f = await c.scan.scan(a.domain), s = summarise(f);
        rows[i] = { ...base, verified: true, status: "ASSESSED", reason: null, grade: grade(s.score), score: s.score, scannedAt: d.now(), resolverSource: c.scan.source, findings: s.counts };
      }
    } catch { rows[i] = { ...base, verified: true, status: "UNKNOWN", reason: "scan_error", grade: null, score: null, scannedAt: d.now(), resolverSource: c.scan.source, findings: NO_FINDINGS() }; }
  };
  await Promise.all(Array.from({ length: Math.min(cap, assets.length) }, async () => { while (next < assets.length) await one(next++); }));
  const verified = rows.filter((r) => r.verified), assessed = rows.filter((r) => r.status === "ASSESSED");
  const totals = { assets: rows.length, verified: verified.length, unverified: rows.length - verified.length, assessed: assessed.length, unknown: verified.length - assessed.length, critical: 0, high: 0, medium: 0, low: 0, averageScore: assessed.length ? Math.round(assessed.reduce((n, r) => n + (r.score ?? 0), 0) / assessed.length) : null as number | null };
  for (const r of assessed) { totals.critical += r.findings.critical; totals.high += r.findings.high; totals.medium += r.findings.medium; totals.low += r.findings.low; }
  return { tenant: { id: tenant.id, name: tenant.name }, dataSource: c.scan.source, totals, assets: rows };
}
export async function estateView(d: Deps, ctx: Ctx, tid: string) { await access(d, ctx, tid, "viewer"); return estate(d, tid); }
// CSV with formula-injection neutralised: a cell starting = + - @ tab or CR is prefixed with an apostrophe.
export const csvCell = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export async function estateCsv(d: Deps, ctx: Ctx, tid: string) {
  await access(d, ctx, tid, "analyst");
  const v = await estate(d, tid);
  const lines = [["domain", "label", "group", "verified", "status", "grade", "score", "critical", "high", "medium", "low", "scanned_at", "resolver_source"].join(",")];
  for (const r of v.assets) lines.push([r.domain, r.label, r.group, r.verified, r.status, r.grade, r.score, r.findings.critical, r.findings.high, r.findings.medium, r.findings.low, r.scannedAt === null ? "" : new Date(r.scannedAt).toISOString(), r.resolverSource].map(csvCell).join(","));
  return lines.join("\n") + `\n# data source: ${v.dataSource}\n`;
}

// ---- SSO ----
const ssoSealCtx = (tenantId: string) => `sso:${tenantId}`;   // AAD: a sealed secret copied onto another tenant row fails to open
export async function putSso(d: Deps, ctx: Ctx, tid: string, b: Record<string, unknown>) {
  const { tenant } = await access(d, ctx, tid, "admin");
  const e = ent(d).store;
  const issuer = typeof b.issuer === "string" && /^https:\/\/[a-z0-9.-]{3,200}(\/[A-Za-z0-9._~\-/]{0,100})?$/i.test(b.issuer) ? b.issuer : null;
  const clientId = typeof b.clientId === "string" && /^[A-Za-z0-9._-]{3,100}$/.test(b.clientId) ? b.clientId : null;
  const secret = typeof b.secret === "string" && b.secret.length >= 16 && b.secret.length <= 200 ? b.secret : null;
  const role = b.defaultRole === undefined ? "viewer" : b.defaultRole;
  if (!issuer || !clientId || !secret) throw new HttpError(400, "invalid_sso_config");
  if (role !== "viewer" && role !== "analyst") throw new HttpError(400, "invalid_default_role");   // an IdP can never mint admins
  if (!Array.isArray(b.allowedDomains) || b.allowedDomains.length < 1 || b.allowedDomains.length > 20) throw new HttpError(400, "invalid_allowed_domains");
  const verified = new Set((await e.assetsOf(tenant.id)).filter((a) => a.verifiedAt).map((a) => a.domain));
  const allowed: string[] = [];
  for (const raw of b.allowedDomains) {
    const dom = normaliseDomain(raw);
    if (!dom || !verified.has(dom)) throw new HttpError(422, "allowed_domain_not_verified");     // an email domain must be one the tenant proved by TXT
    allowed.push(dom);
  }
  const ring = ent(d).sealKeys;
  if (!ring) throw new HttpError(503, "sso_seal_unavailable");                                     // fail closed: no keyring, no SSO config, no plaintext
  let sealed: string;
  try { sealed = await sealSecret(ring, secret, ssoSealCtx(tenant.id)); } catch (err) { if (err instanceof SealError) throw new HttpError(503, "sso_seal_unavailable"); throw err; }
  await e.putSso({ tenantId: tenant.id, issuer, clientId, secret: sealed, allowedDomains: allowed, defaultRole: role });
  if (tenant.ssoEnforced) await e.putTenant({ ...tenant, ssoEnforced: false });                   // a changed IdP resets enforcement
  await audit(d, tenant.id, ctx.account.id, "sso.config", issuer);
  return ssoView(await e.ssoOf(tenant.id));
}
const ssoView = (c?: { issuer: string; clientId: string; allowedDomains: string[]; defaultRole: string; lastSuccessAt?: number }) =>
  c ? { configured: true, issuer: c.issuer, clientId: c.clientId, allowedDomains: c.allowedDomains, defaultRole: c.defaultRole, hasSecret: true, lastSuccessAt: c.lastSuccessAt } : { configured: false };
export async function getSso(d: Deps, ctx: Ctx, tid: string) {
  const { tenant } = await access(d, ctx, tid, "admin");
  return { ...ssoView(await ent(d).store.ssoOf(tid)), enforced: tenant.ssoEnforced };
}
export async function enforceSso(d: Deps, ctx: Ctx, tid: string, enabled: unknown) {
  const { tenant } = await access(d, ctx, tid, "admin");
  const e = ent(d).store;
  if (typeof enabled !== "boolean") throw new HttpError(400, "invalid_input");
  if (enabled) {
    const cfg = await e.ssoOf(tid);
    if (!cfg?.lastSuccessAt) throw new HttpError(409, "sso_not_proven");                          // no lockout: at least one real SSO login first
    if (!(await e.isSsoSession(ctx.sessionHash, tid))) throw new HttpError(409, "sign_in_with_sso_first");
  }
  await e.putTenant({ ...tenant, ssoEnforced: enabled });
  await audit(d, tid, ctx.account.id, "sso.enforce", String(enabled));
  return { enforced: enabled };
}
export async function ssoStart(d: Deps, slug: string, clientKey = "unknown") {
  const c = ent(d), t = await c.store.tenantBySlug(slug), cfg = t && !t.deletedAt ? await c.store.ssoOf(t.id) : undefined;
  if (!t || !cfg) throw nf();
  if ((await c.store.openSsoStates(t.id, d.now(), clientKey)) >= MAX_OPEN_SSO_STATES_PER_CLIENT || (await c.store.openSsoStates(t.id, d.now())) >= MAX_OPEN_SSO_STATES) throw new HttpError(429, "too_many_requests");
  const state = randomToken("st", 16), nonce = randomToken("nn", 16);
  await c.store.putSsoState({ hash: await sha256Hex(state), tenantId: t.id, clientKey, nonceHash: await sha256Hex(nonce), expiresAt: d.now() + SSO_STATE_TTL_MS, used: false });
  const q = new URLSearchParams({ client_id: cfg.clientId, response_type: "id_token", scope: "openid email", state, nonce, redirect_uri: `${d.siteOrigin}/app/estate` });
  return { authorizeUrl: `${cfg.issuer}/authorize?${q}`, state, nonce };
}
// The tenant comes from the STATE we issued, never from the token or the caller. A tenant's IdP can only vouch for
// emails at domains that tenant verified, so tenant A's IdP cannot sign anyone in as an address at tenant B.
export async function ssoCallback(d: Deps, b: Record<string, unknown>) {
  const c = ent(d);
  if (typeof b.state !== "string" || typeof b.id_token !== "string") throw new HttpError(400, "invalid_input");
  const st = await c.store.consumeSsoState(await sha256Hex(b.state), d.now());
  if (!st) throw new HttpError(401, "sso_failed");
  const tenant = await c.store.tenantById(st.tenantId), cfg = await c.store.ssoOf(st.tenantId);
  if (!tenant || tenant.deletedAt || !cfg) throw new HttpError(401, "sso_failed");
  // the stored secret is sealed; open it for this call only. Unsealed legacy row, no keyring, unknown key id, tamper => fail closed.
  let open: string;
  try {
    if (!c.sealKeys || !isSealed(cfg.secret)) throw new SealError("unsealed");
    open = await openSecret(c.sealKeys, cfg.secret, ssoSealCtx(tenant.id));
  } catch (e) { if (e instanceof SealError) throw new HttpError(401, "sso_failed"); throw e; }
  let claims;
  try { claims = await c.idp.verify({ ...cfg, secret: open }, b.id_token, d.now()); } catch (e) { if (e instanceof SsoError) throw new HttpError(401, "sso_failed"); throw e; }
  if (typeof b.nonce !== "string" || (await sha256Hex(b.nonce)) !== st.nonceHash || claims.nonce !== b.nonce) throw new HttpError(401, "sso_failed");
  const email = normaliseEmail(claims.email);
  const emailDomain = email?.split("@")[1];
  if (!email || !emailDomain || !cfg.allowedDomains.includes(emailDomain)) throw new HttpError(403, "sso_email_domain_not_allowed");
  // checked at every login, not only when SSO was configured: the tenant must STILL hold a verified asset for the domain
  if (!(await c.store.assetsOf(tenant.id)).some((a) => a.verifiedAt && a.domain === emailDomain)) throw new HttpError(403, "sso_email_domain_not_allowed");
  let acct = await d.store.accountByEmail(email);
  if (acct?.deletedAt) acct = undefined;
  if (!acct) { acct = { id: randomToken("acc", 12), email, seat: "owner", createdAt: d.now() }; await d.store.putAccount(acct); }
  const cur = await c.store.memberOf(tenant.id, acct.id);
  if (!cur) await c.store.putMember({ tenantId: tenant.id, accountId: acct.id, role: cfg.defaultRole, addedAt: d.now() });   // JIT, never above the default role
  const session = randomToken("ss");
  const hash = await sha256Hex(session);
  await d.store.putSession({ hash, accountId: acct.id, expiresAt: d.now() + 8 * 3_600_000 });                                // SSO sessions are 8 hours, not 30 days
  await c.store.markSsoSession(hash, tenant.id);
  await c.store.putSso({ ...cfg, lastSuccessAt: d.now() });
  await audit(d, tenant.id, acct.id, "sso.login", email);
  return { session, tenantId: tenant.id, account: { id: acct.id, email: acct.email } };
}

export async function auditLog(d: Deps, ctx: Ctx, tid: string) {
  await access(d, ctx, tid, "admin");
  return { entries: await ent(d).store.auditOf(tid, 200) };
}

// Operator break-glass: an enforced tenant that cannot sign in (IdP down, flood) is released by the operator secret.
export async function operatorSetEnforcement(d: Deps, tid: string, enabled: unknown) {
  const e = ent(d).store, t = await e.tenantById(tid);
  if (!t || typeof enabled !== "boolean") throw new HttpError(400, "invalid_input");
  await e.setEnforcement(tid, enabled);
  await audit(d, tid, "operator", "sso.enforce.operator", String(enabled));
  return { enforced: enabled };
}
// ---- partners: sub-portals, brand, consent ----
export async function createPortal(d: Deps, ctx: Ctx, pid: string, b: Record<string, unknown>) {
  const { tenant: partner } = await access(d, ctx, pid, "admin", "partner");
  const e = ent(d).store;
  if (!partner.termsAcceptedAt) throw new HttpError(409, "partner_terms_not_accepted");
  const name = cleanText(b.name, 80), slug = cleanSlug(b.slug), adminEmail = normaliseEmail(b.clientAdminEmail), brand = parseBrand(b.brand ?? { name, colour: "#c9a24b", tagline: "" });
  if (!name || !slug || !adminEmail || !brand) throw new HttpError(400, "invalid_input");
  if (await e.tenantBySlug(slug)) throw new HttpError(409, "slug_taken");
  if ((await e.childrenOf(pid)).length >= 500) throw new HttpError(409, "portal_limit");
  const t: Tenant = { id: randomToken("ten", 8), slug, name, kind: "client", parentId: pid, createdAt: d.now(), ssoEnforced: false, partnerAccess: false, brand };
  await e.putTenant(t);
  const id = randomToken("inv", 8);
  await e.putInvite({ id, tenantId: t.id, email: adminEmail, role: "admin", invitedBy: ctx.account.id, createdAt: d.now(), expiresAt: d.now() + INVITE_TTL_MS });
  await d.mailer.send(adminEmail, `${partner.brand?.name ?? partner.name} has set up your portal`, `Sign in at ${d.siteOrigin}/app/estate to accept. ${partner.name} sees nothing of your estate until you allow it.`);
  await audit(d, pid, ctx.account.id, "portal.create", t.id);
  return pub(t);
}
export async function listPortals(d: Deps, ctx: Ctx, pid: string) {
  await access(d, ctx, pid, "viewer", "partner");
  return { portals: (await ent(d).store.childrenOf(pid)).map((t) => ({ id: t.id, slug: t.slug, name: t.name, sharing: t.partnerAccess })) };   // metadata only
}
export async function portalEstate(d: Deps, ctx: Ctx, pid: string, cid: string) {
  await access(d, ctx, pid, "analyst", "partner");
  const child = await ent(d).store.tenantById(cid);
  if (!child || child.deletedAt || child.parentId !== pid || !child.partnerAccess) throw nf();    // no consent = not found, same as another partner's client
  return estate(d, cid);
}
export async function setPartnerAccess(d: Deps, ctx: Ctx, tid: string, enabled: unknown) {
  const { tenant } = await access(d, ctx, tid, "admin", "client");
  if (typeof enabled !== "boolean") throw new HttpError(400, "invalid_input");
  await ent(d).store.putTenant({ ...tenant, partnerAccess: enabled });
  await audit(d, tid, ctx.account.id, "partner_access", String(enabled));
  return { partnerAccess: enabled };
}
export function parseBrand(v: unknown): Brand | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const name = cleanText(b.name, 60), tagline = b.tagline === undefined || b.tagline === "" ? "" : cleanText(b.tagline, 120);
  if (!name || tagline === null || typeof b.colour !== "string" || !/^#[0-9a-fA-F]{6}$/.test(b.colour)) return null;
  return { name, colour: b.colour.toLowerCase(), tagline };
}
export async function publishPortal(d: Deps, ctx: Ctx, pid: string, cid: string, enabled: unknown) {
  await access(d, ctx, pid, "admin", "partner");
  const e = ent(d).store, child = await e.tenantById(cid);
  if (!child || child.deletedAt || child.parentId !== pid || typeof enabled !== "boolean") throw nf();
  await e.putTenant({ ...child, brandPublic: enabled });
  await audit(d, pid, ctx.account.id, "portal.publish", `${cid}:${enabled}`);
  return { published: enabled };
}
export async function setBrand(d: Deps, ctx: Ctx, pid: string, b: unknown) {
  const { tenant } = await access(d, ctx, pid, "admin", "partner");
  const brand = parseBrand(b);
  if (!brand) throw new HttpError(400, "invalid_brand");
  await ent(d).store.putTenant({ ...tenant, brand });
  await audit(d, pid, ctx.account.id, "brand.set", brand.name);
  return brand;
}
// Public: the brand only. Nothing else about a tenant is ever served without a session.
export async function publicBrand(d: Deps, slug: string) {
  const t = await ent(d).store.tenantBySlug(slug);
  if (!t || t.deletedAt || !t.brand || t.kind === "enterprise" || (t.kind === "client" && !t.brandPublic)) throw nf();
  return { slug: t.slug, brand: t.brand, whiteLabel: "preview (V2)", sso: !!(await ent(d).store.ssoOf(t.id)) };
}

// ---- referral and revenue share ----
export async function claimReferral(d: Deps, ctx: Ctx, codeIn: unknown) {
  const e = ent(d).store;
  if (typeof codeIn !== "string") throw new HttpError(400, "invalid_input");
  const partner = await e.partnerByRefCode(codeIn);
  if (!partner || !partner.termsAcceptedAt) throw new HttpError(404, "unknown_code");
  if ((await e.memberOf(partner.id, ctx.account.id))) throw new HttpError(409, "self_referral");
  if ((await d.store.invoicesFor(ctx.account.id)).length > 0) throw new HttpError(409, "referral_after_purchase");   // paid on new customers only
  if (!(await e.putReferral({ accountId: ctx.account.id, partnerId: partner.id, claimedAt: d.now() }))) throw new HttpError(409, "already_referred");
  return { ok: true };
}
export async function ledger(d: Deps, ctx: Ctx, pid: string) {
  await access(d, ctx, pid, "analyst", "partner");
  const e = ent(d).store, entries = await e.ledgerOf(pid), now = d.now();
  return {
    rateNote: "EXAMPLE terms until the partner terms are signed off", availableCents: await balanceCents(e, pid, now),
    entries: entries.map((x) => ({ id: x.id, kind: x.kind, amountCents: x.amountCents, at: x.at, availableAt: x.availableAt, source: x.sourceLabel, rateBps: x.rateBps, rateVersion: x.rateVersion, invoiceId: x.invoiceId })),
  };
}
export async function partnerStatement(d: Deps, ctx: Ctx, pid: string, month: unknown) {
  const { tenant } = await access(d, ctx, pid, "analyst", "partner");
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(400, "invalid_month");
  return statement(tenant, await ent(d).store.ledgerOf(pid), month);
}
// Payout: available balance only (past the hold), partner terms accepted, a payout account set by the operator. Above the
// approval threshold it waits for Kyle (GATE1); below it goes straight to the provider.
export async function requestPayout(d: Deps, ctx: Ctx, pid: string) {
  const { tenant } = await access(d, ctx, pid, "admin", "partner");
  const c = ent(d);
  if (!tenant.termsAcceptedAt) throw new HttpError(409, "partner_terms_not_accepted");
  if (!tenant.payoutAccount) throw new HttpError(409, "payout_account_missing");
  const now = d.now();
  const p = await c.store.reservePayout(pid, now, MIN_PAYOUT_CENTS, (amount) => {
    const id = randomToken("pay", 8);
    return {
      payout: { id, partnerId: pid, amountCents: amount, status: amount > APPROVAL_ABOVE_CENTS ? "pending_approval" : "sending", createdAt: now },
      entry: { id: randomToken("led", 8), uniq: `payout:${id}`, partnerId: pid, kind: "payout", amountCents: -amount, at: now, availableAt: now, payoutId: id },
    };
  });
  if (!p) throw new HttpError(409, "below_minimum");
  await audit(d, pid, ctx.account.id, "payout.request", p.id);
  if (p.status === "sending") await transfer(d, p.id, tenant.payoutAccount);
  return (await c.store.payoutById(p.id))!;
}
async function transfer(d: Deps, payoutId: string, account: string) {
  const c = ent(d), p = (await c.store.payoutById(payoutId))!;
  try {
    const r = await c.payouts.transfer({ partnerId: p.partnerId, accountRef: account, amountCents: p.amountCents, idempotencyKey: p.id });
    await c.store.putPayout({ ...p, status: "paid", providerRef: r.ref });
  } catch {
    await c.store.putPayout({ ...p, status: "failed", reason: "provider_error" });
    await c.store.addLedger({ id: randomToken("led", 8), uniq: `payout_reversal:${p.id}`, partnerId: p.partnerId, kind: "payout_reversal", amountCents: p.amountCents, at: d.now(), availableAt: d.now(), payoutId: p.id });
  }
}
export async function listPayouts(d: Deps, ctx: Ctx, pid: string) {
  await access(d, ctx, pid, "analyst", "partner");
  return { payouts: (await ent(d).store.payoutsOf(pid)).map((p) => ({ id: p.id, amountCents: p.amountCents, status: p.status, createdAt: p.createdAt })) };
}
// The internal approve/reject route and the card tap share ONE core (payout_decision.ts). Legacy contract kept: a second tap is 409 not_pending.
export async function decidePayout(d: Deps, id: string, approve: boolean) {
  const r = await decideCard(d, { payoutId: id, decision: approve ? "approve" : "deny", reason: approve ? undefined : "rejected by operator" });
  if (!r.ok) throw new HttpError(409, r.refused === "payout_account_missing" ? "payout_account_missing" : r.refused === "expired" ? "card_expired" : "not_pending");
  if (r.outcome === "replayed") throw new HttpError(409, "not_pending");
  return { status: r.decision === "deny" ? "rejected" : r.state };
}
// The card tap (f31 card id, tenant-scoped). Mock transfer adapter only in this tree; idempotent on repeat taps.
export async function decideCard(d: Deps, req: DecideReq) {
  const c = ent(d);
  return decidePayoutRecorded({ store: c.store, approvals: c.approvals, transfer: c.payouts, now: d.now(), newId: () => randomToken("led", 8) }, req);
}

// ---- hooks the C2 service calls ----
export async function onInvoice(d: Deps, inv: Invoice) {
  const c = d.ent; if (!c) return;
  try { await recordCommission(c.store, c.rates, inv, d.now(), c.selfDeal); }
  catch (e) { await c.store.noteFailure("commission", `${inv.id}: ${(e as Error).message}`.slice(0, 200), d.now()); }   // never hide: recorded for the operator
}
export async function onRefund(d: Deps, purchaseId: string, refundedCents: number) {
  const c = d.ent; if (!c) return;
  try {
    const pur = await d.store.purchaseById(purchaseId);
    if (!pur) return;
    const invs = (await d.store.invoicesFor(pur.accountId)).filter((i) => i.purchaseId === purchaseId);
    await clawback(c.store, invs, refundedCents, d.now());
  } catch (e) { await c.store.noteFailure("clawback", `${purchaseId}: ${(e as Error).message}`.slice(0, 200), d.now()); }
}
export async function assertCanDelete(d: Deps, accountId: string) {
  const c = d.ent; if (!c) return;
  for (const m of await c.store.membershipsFor(accountId)) {
    const t = await c.store.tenantById(m.tenantId);
    if (t && !t.deletedAt && m.role === "admin" && (await adminCount(d, t.id, accountId)) === 0) throw new HttpError(409, "last_admin_of_tenant");
  }
}
export async function onAccountDeleted(d: Deps, accountId: string) {
  const c = d.ent; if (!c) return;
  await c.store.removeAccount(accountId);
}
export async function exportFor(d: Deps, accountId: string) {
  const c = d.ent; if (!c) return undefined;
  const out = [];
  for (const m of await c.store.membershipsFor(accountId)) { const t = await c.store.tenantById(m.tenantId); if (t) out.push({ tenant: t.name, role: m.role }); }
  return { tenants: out, referral: (await c.store.referralOf(accountId))?.claimedAt };
}

// ---- savings calculator: arithmetic on the visitor's own inputs, nothing assumed ----
export function savings(b: Record<string, unknown>) {
  const num = (k: string, lo: number, hi: number) => { const v = b[k]; if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) throw new HttpError(400, `invalid_${k}`); return v; };
  const hours = num("manualHoursPerWeek", 0, 5000), rate = num("hourlyRateAud", 0, 2000), share = num("automatedSharePct", 0, 100), incidents = num("incidentsPerYear", 0, 1000), cost = num("avgIncidentCostAud", 0, 1e9), cut = num("incidentReductionPct", 0, 100);
  const hoursBack = Math.round(hours * 52 * (share / 100));
  return {
    label: "MODELLED from your own inputs. Not a quote, not a promise, not a measured result.",
    inputs: { manualHoursPerWeek: hours, hourlyRateAud: rate, automatedSharePct: share, incidentsPerYear: incidents, avgIncidentCostAud: cost, incidentReductionPct: cut },
    hoursGivenBackPerYear: hoursBack, labourValueAud: Math.round(hoursBack * rate), incidentCostAvoidedAud: Math.round(incidents * cost * (cut / 100)),
  };
}
