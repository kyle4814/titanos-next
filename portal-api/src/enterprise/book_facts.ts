// C8 f313: the PRODUCTION BookFactsSource for the partner book (plan ch.6 C8 / D8).
// Reads PLAN + STATUS from the billing store, the last re-scan PROOF ID from the market store, and the domain from the tenant's
// estate assets (or the billing account's domains). Two adapters sit behind the one BookFactsSource interface:
//   BillingMarketBookFacts : in-memory/test adapter over EntStore + the billing Store + the MarketStore (the interfaces the Worker uses).
//   D1BookFacts            : D1-shaped adapter, plain SQL over the migrations' tables (tenants, tenant_members, tenant_assets,
//                            domains, subscriptions, purchases, market_jobs, referrals). Migration 0019 adds its indexes (NOT applied: GATE5).
// Both feed ONE pure derivation (deriveFacts), so the two adapters cannot disagree about what a plan, status or proof is.
// ISOLATION: every read starts from a client tenant that is a LIVE child of the named partner (or an account whose referral row
// names that partner). A proof counts only if the job's owner is one of THAT client's accounts AND the job's domain is the
// client's chosen domain. There is no global hash-to-domain or domain-to-client index anywhere in this file.
import type { EntStore } from "./store.ts";
import type { BookFacts, BookFactsSource, BookStatus } from "./partner_book.ts";
import type { D1Like } from "../env.ts";
import type { Store } from "../store.ts";
import type { MarketStore } from "../market/store.ts";

export interface SubFact { productId: string; startedAt: number; cancelledAt?: number; tier?: string; endedAt?: number }
export interface PurchaseFact { status: string; amountCents: number; refundedCents: number }
export interface ProofFact { scanId: string; at: number; domain: string }
export interface DomainFact { domain: string; verified: boolean }
export interface RawFacts { domains: DomainFact[]; subs: SubFact[]; purchases: PurchaseFact[]; proofs: ProofFact[] }

const norm = (d: string) => d.trim().toLowerCase();

/** The client tenant's estate consent (tenants.partner_access) gates the two ESTATE facts. Plan and status are the commercial relationship the partner already owns (the ledger shows them the share), so they stay. */
export function withConsent(f: BookFacts, consented: boolean): BookFacts {
  return consented ? { ...f, estateConsent: true } : { ...f, domain: null, lastRescanProofId: null, estateConsent: false };
}

/** THE derivation. Pure: no store, no clock. */
export function deriveFacts(raw: RawFacts): BookFacts {
  const ds = [...raw.domains].sort((a, b) => Number(b.verified) - Number(a.verified) || (a.domain < b.domain ? -1 : 1));
  const domain = ds[0]?.domain ?? null;
  const sub = [...raw.subs].sort((a, b) => b.startedAt - a.startedAt || (a.productId < b.productId ? -1 : 1))[0];
  let status: BookStatus = "unknown";
  if (sub) status = sub.cancelledAt !== undefined || sub.endedAt !== undefined ? "cancelled" : "active";
  else if (raw.purchases.length) {
    const paid = raw.purchases.filter((p) => p.status === "paid");
    if (raw.purchases.some((p) => p.status === "pending")) status = "pending";
    else if (!paid.length && raw.purchases.every((p) => p.status === "refunded" || (p.amountCents > 0 && p.refundedCents >= p.amountCents))) status = "refunded";
    else if (!paid.length) status = "cancelled";
  }
  const mine = domain === null ? [] : raw.proofs.filter((p) => norm(p.domain) === norm(domain));
  const proof = [...mine].sort((a, b) => b.at - a.at || (a.scanId < b.scanId ? -1 : 1))[0];
  return { domain, plan: sub ? sub.tier ?? sub.productId : null, status, lastRescanProofId: proof?.scanId ?? null };
}

// ---------- in-memory / test adapter ----------
export interface BookFactsDeps {
  ent: Pick<EntStore, "tenantById" | "membersOf" | "assetsOf" | "referralOf">;
  billing: Pick<Store, "subscriptionsFor" | "purchasesFor" | "domainsFor">;
  market: Pick<MarketStore, "jobsByOwner">;
}
export class BillingMarketBookFacts implements BookFactsSource {
  private d: BookFactsDeps;
  constructor(d: BookFactsDeps) { this.d = d; }
  private async collect(accounts: string[], assetDomains: DomainFact[]): Promise<BookFacts> {
    const { billing, market } = this.d;
    const raw: RawFacts = { domains: [...assetDomains], subs: [], purchases: [], proofs: [] };
    for (const a of new Set(accounts)) {
      for (const dm of await billing.domainsFor(a)) raw.domains.push({ domain: dm.domain, verified: dm.verifiedAt !== undefined });
      for (const s of await billing.subscriptionsFor(a)) raw.subs.push({ productId: s.productId, startedAt: s.startedAt, cancelledAt: s.cancelledAt, tier: s.plan?.tier, endedAt: s.plan?.endedAt });
      for (const p of await billing.purchasesFor(a)) raw.purchases.push({ status: p.status, amountCents: p.amountCents, refundedCents: p.refundedCents });
      for (const j of await market.jobsByOwner(a)) if (j.proof && (j.status === "reproved" || j.status === "paid")) raw.proofs.push({ scanId: j.proof.scanId, at: j.proof.at, domain: j.domain });
    }
    return deriveFacts(raw);
  }
  async factsFor(clientTenantId: string, partnerId?: string): Promise<BookFacts | undefined> {
    const { ent } = this.d;
    const t = await ent.tenantById(clientTenantId);
    if (!t || t.kind !== "client" || !t.parentId || (partnerId !== undefined && t.parentId !== partnerId)) return undefined;
    const accounts = (await ent.membersOf(t.id)).map((m) => m.accountId);
    const assets = (await ent.assetsOf(t.id)).map((x) => ({ domain: x.domain, verified: x.verifiedAt !== undefined }));
    return withConsent(await this.collect(accounts, assets), t.partnerAccess);
  }
  async factsForAccount(accountId: string, partnerId: string): Promise<BookFacts | undefined> {
    const r = await this.d.ent.referralOf(accountId);
    if (!r || r.partnerId !== partnerId) return undefined;
    return this.collect([accountId], []);
  }
}

// ---------- D1-shaped adapter ----------
type Row = Record<string, unknown>;
const marks = (n: number) => Array.from({ length: n }, () => "?").join(",");
export class D1BookFacts implements BookFactsSource {
  private db: D1Like;
  constructor(db: D1Like) { this.db = db; }
  private all(sql: string, ...a: unknown[]) { return this.db.prepare(sql).bind(...a).all<Row>().then((r) => r.results); }
  private first(sql: string, ...a: unknown[]) { return this.db.prepare(sql).bind(...a).first<Row>().then((r) => r ?? undefined); }
  private async collect(accounts: string[], assetDomains: DomainFact[]): Promise<BookFacts> {
    const raw: RawFacts = { domains: [...assetDomains], subs: [], purchases: [], proofs: [] };
    if (accounts.length) {
      const m = marks(accounts.length);
      for (const r of await this.all(`SELECT domain, verified_at FROM domains WHERE account_id IN (${m})`, ...accounts)) raw.domains.push({ domain: String(r.domain), verified: r.verified_at !== null && r.verified_at !== undefined });
      for (const r of await this.all(`SELECT product_id, started_at, cancelled_at, plan_json FROM subscriptions WHERE account_id IN (${m})`, ...accounts)) {
        let plan: { tier?: string; endedAt?: number } = {};
        if (r.plan_json !== null && r.plan_json !== undefined) { try { plan = JSON.parse(String(r.plan_json)); } catch { plan = {}; } }
        raw.subs.push({ productId: String(r.product_id), startedAt: Number(r.started_at), cancelledAt: r.cancelled_at === null || r.cancelled_at === undefined ? undefined : Number(r.cancelled_at), tier: plan.tier, endedAt: plan.endedAt });
      }
      for (const r of await this.all(`SELECT status, amount_cents, refunded_cents FROM purchases WHERE account_id IN (${m})`, ...accounts)) raw.purchases.push({ status: String(r.status), amountCents: Number(r.amount_cents), refundedCents: Number(r.refunded_cents) });
      for (const r of await this.all(`SELECT state_json FROM market_jobs WHERE owner_account_id IN (${m}) AND status IN ('reproved','paid')`, ...accounts)) {
        try { const j = JSON.parse(String(r.state_json)); if (j.proof && typeof j.proof.scanId === "string") raw.proofs.push({ scanId: j.proof.scanId, at: Number(j.proof.at), domain: String(j.domain) }); } catch { /* a corrupt row proves nothing */ }
      }
    }
    return deriveFacts(raw);
  }
  async factsFor(clientTenantId: string, partnerId?: string): Promise<BookFacts | undefined> {
    const t = await this.first("SELECT id, parent_id, partner_access FROM tenants WHERE id = ? AND kind = 'client' AND parent_id IS NOT NULL", clientTenantId);
    if (!t || (partnerId !== undefined && String(t.parent_id) !== partnerId)) return undefined;
    const accounts = (await this.all("SELECT account_id FROM tenant_members WHERE tenant_id = ?", clientTenantId)).map((r) => String(r.account_id));
    const assets = (await this.all("SELECT domain, verified_at FROM tenant_assets WHERE tenant_id = ?", clientTenantId)).map((r) => ({ domain: String(r.domain), verified: r.verified_at !== null && r.verified_at !== undefined }));
    return withConsent(await this.collect(accounts, assets), Number(t.partner_access) === 1);
  }
  async factsForAccount(accountId: string, partnerId: string): Promise<BookFacts | undefined> {
    if (!(await this.first("SELECT 1 AS x FROM referrals WHERE account_id = ? AND partner_id = ?", accountId, partnerId))) return undefined;
    return this.collect([accountId], []);
  }
}

/** The Worker's construction point: D1 present -> the D1 adapter; absent -> undefined, and the route keeps failing closed with 503 book_unavailable. */
export function makeBookFacts(env: { DB?: D1Like }): BookFactsSource | undefined { return env.DB ? new D1BookFacts(env.DB) : undefined; }
