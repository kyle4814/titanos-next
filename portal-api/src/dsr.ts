// C2 data rights: exportAccount(accountId) and eraseAccount(accountId) over the Store interface (MemoryStore is the
// test adapter). No D1 adapter exists on this branch (stacked on web/obelisk-int-2026-11-06); a D1 adapter must
// implement DsrStore's four extra methods. Nothing here is wired to a route.
//
// EXPORT: every record keyed to the account as plain JSON. Never: key hashes, session or login-token hashes, domain
// verification tokens, receipt signatures, SSO secrets, or any row that belongs to another account or tenant.
// ERASE: personal fields go (email, domains, sessions, login state, invites, memberships, Connect ref, display
// name). Invoices, purchases, credit ledger and receipts stay, tied to the account id and a stable pseudonym only
// (tax law). Refuses while money or a tenant is still in play; safe to run twice.
import type { Store, Account, ApiKey, DomainRow, Purchase, Subscription, Invoice, ReviewCard, CreditEntry, CreditOrder, AgentReceipt } from "./store.ts";
import type { EntStore } from "./enterprise/store.ts";
import type { MarketStore, Job } from "./market/store.ts";
import { PRODUCTS, refundVerdict } from "./catalogue.ts";
import { sha256Hex } from "./util.ts";

export interface DsrStore extends Store {
  receiptsFor(accountId: string): Promise<AgentReceipt[]>;
  creditOrdersFor(accountId: string): Promise<CreditOrder[]>;
  cardsFor(accountId: string): Promise<ReviewCard[]>;
  purgeLoginStateFor(email: string): Promise<void>; // outstanding login links and the request log for that address
}
export interface DsrDeps { store: DsrStore; ent?: EntStore; market?: MarketStore; now: () => number; salt?: string }

export type Blocker =
  | "active_subscription" | "payout_held" | "order_refundable_in_policy" | "refund_review_open"
  | "market_job_active" | "last_admin_of_tenant";
export class DsrError extends Error {
  code: "not_found" | "erase_blocked"; blockers: Blocker[];
  constructor(code: "not_found" | "erase_blocked", blockers: Blocker[] = []) { super(code + (blockers.length ? ": " + blockers.join(",") : "")); this.code = code; this.blockers = blockers; }
}

const DEFAULT_SALT = "tt-dsr-v1";
export async function pseudonymFor(accountId: string, salt = DEFAULT_SALT): Promise<string> { return "erased_" + (await sha256Hex(`${salt}:${accountId}`)).slice(0, 16); }
export const erasedEmail = (pseudonym: string) => `${pseudonym}@deleted.invalid`;

const PAYOUT_SETTLED = new Set(["paid", "rejected", "refunded"]); // anything else (pending, sending, failed, held, retry, unknown) is still in play
const JOB_LIVE = ["open", "claimed", "delivered", "disputed", "awaiting_funds"];

async function partnerPayoutsInPlay(e: EntStore, accountId: string): Promise<boolean> {
  for (const m of await e.membershipsFor(accountId)) {
    if (m.role !== "admin") continue;
    const t = await e.tenantById(m.tenantId);
    if (!t || t.deletedAt || t.kind !== "partner") continue;
    if ((await e.payoutsOf(t.id)).some((p) => !PAYOUT_SETTLED.has(p.status))) return true;
  }
  return false;
}
async function soleAdminSomewhere(e: EntStore, accountId: string): Promise<boolean> {
  for (const m of await e.membershipsFor(accountId)) {
    const t = await e.tenantById(m.tenantId);
    if (!t || t.deletedAt || m.role !== "admin") continue;
    if (!(await e.membersOf(t.id)).some((x) => x.accountId !== accountId && x.role === "admin")) return true;
  }
  return false;
}
export async function eraseBlockers(d: DsrDeps, accountId: string): Promise<Blocker[]> {
  const out = new Set<Blocker>();
  const now = d.now();
  for (const s of await d.store.subscriptionsFor(accountId)) if (!s.cancelledAt) out.add("active_subscription");
  for (const p of await d.store.purchasesFor(accountId)) {
    const prod = PRODUCTS[p.productId];
    if (p.status === "paid" && p.paymentIntent && p.paidAt && p.refundedCents === 0 && prod &&
        refundVerdict(prod, p.paidAt, now, p.deliverableIssued, false).auto) out.add("order_refundable_in_policy");
  }
  if ((await d.store.cardsFor(accountId)).some((c) => !c.resolved)) out.add("refund_review_open");
  if (d.market && (await d.market.allJobs()).some((j) => (j.ownerAccountId === accountId || j.proAccountId === accountId) && JOB_LIVE.includes(j.status) || (j.proAccountId === accountId && j.status === "reproved"))) out.add("market_job_active");
  if (d.ent) {
    if (await partnerPayoutsInPlay(d.ent, accountId)) out.add("payout_held");
    if (await soleAdminSomewhere(d.ent, accountId)) out.add("last_admin_of_tenant");
  }
  return [...out].sort();
}

// ---------- export ----------
const pubKey = (k: ApiKey) => ({ id: k.id, scopes: k.scopes, createdAt: k.createdAt, revokedAt: k.revokedAt ?? null }); // NEVER hash
const pubDomain = (x: DomainRow) => ({ id: x.id, domain: x.domain, verifiedAt: x.verifiedAt ?? null }); // NEVER the DNS token
const pubReceipt = (r: AgentReceipt) => { const { sig: _sig, ...rest } = r; return rest; };
function pubJob(j: Job, me: string) {
  const mine = j.ownerAccountId === me;
  const { abandonedBy, dispute, ...rest } = j;
  return {
    ...rest, role: mine ? "owner" : "pro",
    ownerAccountId: mine ? me : "counterparty", proAccountId: j.proAccountId === me ? me : j.proAccountId ? "counterparty" : undefined,
    abandonedBy: abandonedBy.map((x) => (x === me ? me : "counterparty")),
    dispute: dispute ? { ...dispute, by: dispute.by === me ? me : "counterparty" } : undefined,
  };
}
export async function exportAccount(d: DsrDeps, accountId: string) {
  const a = await d.store.accountById(accountId);
  if (!a) throw new DsrError("not_found");
  const s = d.store;
  const out: Record<string, unknown> = {
    format: "titanos-account-export-v1", exportedAt: d.now(), accountId,
    account: { id: a.id, email: a.email, seat: a.seat, stripeCustomerId: a.stripeCustomerId ?? null, createdAt: a.createdAt, deletedAt: a.deletedAt ?? null },
    domains: (await s.domainsFor(accountId)).map(pubDomain),
    purchases: await s.purchasesFor(accountId), subscriptions: await s.subscriptionsFor(accountId), invoices: await s.invoicesFor(accountId),
    reviewCards: await s.cardsFor(accountId),
    apiKeys: (await s.keysFor(accountId)).map(pubKey),
    credits: { balance: await s.creditBalance(accountId), entries: await s.creditEntries(accountId), orders: await s.creditOrdersFor(accountId) },
    agentReceipts: (await s.receiptsFor(accountId)).map(pubReceipt),
  };
  if (d.market) {
    out.marketJobs = (await d.market.allJobs()).filter((j) => j.ownerAccountId === accountId || j.proAccountId === accountId).map((j) => pubJob(j, accountId));
    const pro = await d.market.getPro(accountId);
    out.proProfile = pro ?? null;
  }
  if (d.ent) {
    const e = d.ent, tenants = [];
    const audit = [];
    for (const m of await e.membershipsFor(accountId)) {
      const t = await e.tenantById(m.tenantId);
      if (t) tenants.push({ tenantId: t.id, name: t.name, kind: t.kind, role: m.role, addedAt: m.addedAt });
      audit.push(...(await e.auditOf(m.tenantId, 100000)).filter((x) => x.actor === accountId));
    }
    out.enterprise = {
      memberships: tenants, referral: (await e.referralOf(accountId)) ?? null, auditActions: audit,
      invitesToYou: (await e.invitesForEmail(a.email, 0)).map((i) => ({ id: i.id, tenantId: i.tenantId, role: i.role, expiresAt: i.expiresAt })),
    };
  }
  return JSON.parse(JSON.stringify(out)); // plain JSON, undefined dropped
}

// ---------- erase ----------
export interface EraseResult { status: "erased"; accountId: string; pseudonym: string; erasedAt: number; retained: string[] }
export async function eraseAccount(d: DsrDeps, accountId: string): Promise<EraseResult> {
  const a = await d.store.accountById(accountId);
  if (!a) throw new DsrError("not_found");
  const pseudonym = await pseudonymFor(accountId, d.salt);
  if (!a.deletedAt) { // first run only: a finished erase never starts refusing (idempotent)
    const blockers = await eraseBlockers(d, accountId);
    if (blockers.length) throw new DsrError("erase_blocked", blockers);
  }
  const s = d.store, at = a.deletedAt ?? d.now();
  const oldEmail = a.email;
  // Every step below is safe to repeat. The account row is flipped LAST, so a crash midway is finished by the next call.
  await s.deleteSessionsFor(accountId);
  if (!a.deletedAt) await s.purgeLoginStateFor(oldEmail);
  if (d.ent) {
    if (!a.deletedAt) for (const i of await d.ent.invitesForEmail(oldEmail, 0)) await d.ent.deleteInvite(i.id);
    await d.ent.removeAccount(accountId);
  }
  if (d.market) {
    const pro = await d.market.getPro(accountId);
    if (pro) await d.market.putPro({ ...pro, display: pseudonym, connectAccountId: undefined, onboarded: false });
  }
  await s.anonymiseAccount(accountId, at); // email, Stripe customer id, domains, keys revoked
  const b = await s.accountById(accountId);
  if (b) await s.putAccount({ ...b, email: erasedEmail(pseudonym), stripeCustomerId: undefined, deletedAt: at }); // stable pseudonym, not the adapter default
  return { status: "erased", accountId, pseudonym, erasedAt: at, retained: ["invoices", "purchases", "credit ledger", "agent receipts"] };
}
