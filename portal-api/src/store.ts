// Persistence interface for the portal. MemoryStore is the test/local adapter. A D1 adapter is NOT BUILT yet
// (migration 0002 defines the tables); until it exists the Worker fails closed on every route except /health.
export interface Account { id: string; email: string; seat: string; stripeCustomerId?: string; createdAt: number; deletedAt?: number }
export interface Session { hash: string; accountId: string; expiresAt: number }
export interface LoginToken { hash: string; email: string; expiresAt: number; used: boolean }
export interface DomainRow { id: string; accountId: string; domain: string; token: string; verifiedAt?: number }
export interface Purchase { id: string; accountId: string; productId: string; domain?: string; checkoutId: string; paymentIntent?: string; subscriptionId?: string; paidAt?: number; amountCents: number; deliverableIssued: boolean; refundedCents: number; status: "pending" | "paid" | "refunded" | "cancelled" }
import type { PlanState } from "./plan_change.ts";
export interface Subscription { id: string; accountId: string; purchaseId: string; productId: string; startedAt: number; cancelAt?: number; cancelledAt?: number; plan?: PlanState }
export interface Invoice { id: string; accountId: string; purchaseId?: string; number: string; productId: string; amountCents: number; issuedAt: number; stripeEventId: string }
export interface ReviewCard { id: string; accountId: string; purchaseId: string; kind: "refund_outside_policy"; reason: string; createdAt: number; resolved: boolean }
export type { RefundCase } from "./refund_card.ts";
import type { RefundCase } from "./refund_card.ts";
export interface ApiKey { id: string; accountId: string; hash: string; scopes: string[]; createdAt: number; revokedAt?: number }

export interface CreditEntry { id: string; accountId: string; delta: number; reason: "topup" | "debit" | "reversal"; ref: string; at: number }
export interface CreditOrder { id: string; accountId: string; checkoutId: string; packId: string; credits: number; paid: boolean }
export interface AgentReceipt { id: string; tool: string; keyId: string; accountId: string; at: number; inputSha: string; outputSha: string; credits: number; mode: "free" | "prepaid" | "byok"; sig: string; idem?: string }

export interface Store {
  // agent door (C7). creditApply must be atomic: a D1 adapter does it with one conditional UPDATE, never read-then-write.
  keyByHash(hash: string): Promise<ApiKey | undefined>;
  creditBalance(accountId: string): Promise<number>;
  creditApply(accountId: string, delta: number, reason: CreditEntry["reason"], ref: string, at: number): Promise<number | undefined>; // new balance, or undefined if it would go below 0
  creditEntries(accountId: string): Promise<CreditEntry[]>;
  putCreditOrder(o: CreditOrder): Promise<void>;
  creditOrderByCheckout(checkoutId: string): Promise<CreditOrder | undefined>;
  putReceipt(r: AgentReceipt): Promise<void>;
  receiptById(id: string): Promise<AgentReceipt | undefined>;
  receiptByIdem(keyId: string, idem: string): Promise<AgentReceipt | undefined>;
  callsSince(keyId: string, sinceMs: number): Promise<number>;
  noteCall(keyId: string, at: number): Promise<void>;
  accountByEmail(email: string): Promise<Account | undefined>;
  accountById(id: string): Promise<Account | undefined>;
  putAccount(a: Account): Promise<void>;
  putLoginToken(t: LoginToken): Promise<void>;
  consumeLoginToken(hash: string, now: number): Promise<LoginToken | undefined>;
  loginRequestsSince(email: string, sinceMs: number): Promise<number>;
  noteLoginRequest(email: string, at: number): Promise<void>;
  putSession(s: Session): Promise<void>;
  sessionByHash(hash: string, now: number): Promise<Session | undefined>;
  deleteSessionsFor(accountId: string): Promise<void>;
  domainsFor(accountId: string): Promise<DomainRow[]>;
  domainById(id: string): Promise<DomainRow | undefined>;
  verifiedOwnerOf(domain: string): Promise<DomainRow | undefined>;
  putDomain(d: DomainRow): Promise<void>;
  putPurchase(p: Purchase): Promise<void>;
  purchaseById(id: string): Promise<Purchase | undefined>;
  purchaseByCheckout(checkoutId: string): Promise<Purchase | undefined>;
  purchaseByPaymentIntent(pi: string): Promise<Purchase | undefined>;
  purchasesFor(accountId: string): Promise<Purchase[]>;
  putSubscription(s: Subscription): Promise<void>;
  subscriptionById(id: string): Promise<Subscription | undefined>;
  subscriptionsFor(accountId: string): Promise<Subscription[]>;
  putInvoice(i: Invoice): Promise<void>;
  invoicesFor(accountId: string): Promise<Invoice[]>;
  invoiceById(id: string): Promise<Invoice | undefined>;
  nextInvoiceNumber(): Promise<string>;
  claimEvent(eventId: string): Promise<boolean>; // true the first time only (webhook idempotency)
  holdFact(key: string, fact: Record<string, unknown>): Promise<void>;   // an out-of-order webhook fact waiting for its payment
  takeFacts(key: string): Promise<Record<string, unknown>[]>;            // removes and returns them
  putCard(c: ReviewCard): Promise<void>;
  cardById(id: string): Promise<ReviewCard | undefined>;
  allCards(): Promise<ReviewCard[]>;
  putRefundCase(r: RefundCase): Promise<void>;
  refundCaseById(id: string): Promise<RefundCase | undefined>;
  refundCasesFor(purchaseId: string): Promise<RefundCase[]>;
  openCards(): Promise<ReviewCard[]>;
  putKey(k: ApiKey): Promise<void>;
  keysFor(accountId: string): Promise<ApiKey[]>;
  keyById(id: string): Promise<ApiKey | undefined>;
  anonymiseAccount(id: string, at: number): Promise<void>;
}

export class MemoryStore implements Store {
  accounts = new Map<string, Account>(); loginTokens = new Map<string, LoginToken>(); loginLog = new Map<string, number[]>();
  sessions = new Map<string, Session>(); domains = new Map<string, DomainRow>(); purchases = new Map<string, Purchase>();
  subs = new Map<string, Subscription>(); invoices = new Map<string, Invoice>(); events = new Set<string>(); held = new Map<string, Record<string, unknown>[]>();
  cards = new Map<string, ReviewCard>(); refundCases = new Map<string, RefundCase>(); keys = new Map<string, ApiKey>(); private inv = 0;
  async accountByEmail(e: string) { return [...this.accounts.values()].find((a) => a.email === e); }
  async accountById(id: string) { return this.accounts.get(id); }
  async putAccount(a: Account) { this.accounts.set(a.id, a); }
  async putLoginToken(t: LoginToken) { this.loginTokens.set(t.hash, t); }
  async consumeLoginToken(h: string, now: number) { const t = this.loginTokens.get(h); if (!t || t.used || t.expiresAt < now) return undefined; t.used = true; return t; }
  async loginRequestsSince(e: string, since: number) { return (this.loginLog.get(e) ?? []).filter((x) => x >= since).length; }
  async noteLoginRequest(e: string, at: number) { this.loginLog.set(e, [...(this.loginLog.get(e) ?? []), at]); }
  async putSession(s: Session) { this.sessions.set(s.hash, s); }
  async sessionByHash(h: string, now: number) { const s = this.sessions.get(h); return s && s.expiresAt > now ? s : undefined; }
  async deleteSessionsFor(id: string) { for (const [k, s] of this.sessions) if (s.accountId === id) this.sessions.delete(k); }
  async domainsFor(id: string) { return [...this.domains.values()].filter((d) => d.accountId === id); }
  async domainById(id: string) { return this.domains.get(id); }
  async verifiedOwnerOf(domain: string) { return [...this.domains.values()].find((d) => d.domain === domain && d.verifiedAt); }
  async putDomain(d: DomainRow) { this.domains.set(d.id, d); }
  async putPurchase(p: Purchase) { this.purchases.set(p.id, p); }
  async purchaseById(id: string) { return this.purchases.get(id); }
  async purchaseByCheckout(c: string) { return [...this.purchases.values()].find((p) => p.checkoutId === c); }
  async purchaseByPaymentIntent(pi: string) { return [...this.purchases.values()].find((p) => p.paymentIntent === pi); }
  async holdFact(k: string, f: Record<string, unknown>) { this.held.set(k, [...(this.held.get(k) ?? []), f]); }
  async takeFacts(k: string) { const f = this.held.get(k) ?? []; this.held.delete(k); return f; }
  async purchasesFor(id: string) { return [...this.purchases.values()].filter((p) => p.accountId === id); }
  async putSubscription(s: Subscription) { this.subs.set(s.id, s); }
  async subscriptionById(id: string) { return this.subs.get(id); }
  async subscriptionsFor(id: string) { return [...this.subs.values()].filter((s) => s.accountId === id); }
  async putInvoice(i: Invoice) { this.invoices.set(i.id, i); }
  async invoicesFor(id: string) { return [...this.invoices.values()].filter((i) => i.accountId === id); }
  async invoiceById(id: string) { return this.invoices.get(id); }
  async nextInvoiceNumber() { this.inv += 1; return `TT-${String(this.inv).padStart(6, "0")}`; }
  async claimEvent(id: string) { if (this.events.has(id)) return false; this.events.add(id); return true; }
  async putCard(c: ReviewCard) { this.cards.set(c.id, c); }
  async cardById(id: string) { return this.cards.get(id); }
  async allCards() { return [...this.cards.values()]; }
  async putRefundCase(r: RefundCase) { this.refundCases.set(r.id, r); }
  async refundCaseById(id: string) { return this.refundCases.get(id); }
  async refundCasesFor(p: string) { return [...this.refundCases.values()].filter((r) => r.purchaseId === p); }
  async openCards() { return [...this.cards.values()].filter((c) => !c.resolved); }
  ledger: CreditEntry[] = []; creditOrders = new Map<string, CreditOrder>(); receipts = new Map<string, AgentReceipt>(); callLog = new Map<string, number[]>(); private ent = 0;
  async keyByHash(h: string) { return [...this.keys.values()].find((k) => k.hash === h); }
  async creditBalance(id: string) { return this.ledger.filter((e) => e.accountId === id).reduce((n, e) => n + e.delta, 0); }
  async creditApply(id: string, delta: number, reason: CreditEntry["reason"], ref: string, at: number) {
    const bal = await this.creditBalance(id);
    if (bal + delta < 0) return undefined;
    this.ledger.push({ id: `ent_${++this.ent}`, accountId: id, delta, reason, ref, at });
    return bal + delta;
  }
  async creditEntries(id: string) { return this.ledger.filter((e) => e.accountId === id); }
  async putCreditOrder(o: CreditOrder) { this.creditOrders.set(o.id, o); }
  async creditOrderByCheckout(c: string) { return [...this.creditOrders.values()].find((o) => o.checkoutId === c); }
  async putReceipt(r: AgentReceipt) { this.receipts.set(r.id, r); }
  async receiptById(id: string) { return this.receipts.get(id); }
  async receiptByIdem(keyId: string, idem: string) { return [...this.receipts.values()].find((r) => r.keyId === keyId && r.idem === idem); }
  async callsSince(k: string, since: number) { return (this.callLog.get(k) ?? []).filter((x) => x >= since).length; }
  async noteCall(k: string, at: number) { this.callLog.set(k, [...(this.callLog.get(k) ?? []), at]); }
  async putKey(k: ApiKey) { this.keys.set(k.id, k); }
  async keysFor(id: string) { return [...this.keys.values()].filter((k) => k.accountId === id); }
  async keyById(id: string) { return this.keys.get(id); }
  // Account deletion: PII goes, financial records stay (tax law), tied to an opaque id only.
  async anonymiseAccount(id: string, at: number) {
    const a = this.accounts.get(id); if (!a) return;
    this.accounts.set(id, { ...a, email: `deleted+${id}@deleted.invalid`, stripeCustomerId: undefined, deletedAt: at });
    for (const [k, d] of this.domains) if (d.accountId === id) this.domains.delete(k);
    for (const [k, key] of this.keys) if (key.accountId === id) this.keys.set(k, { ...key, revokedAt: key.revokedAt ?? at });
    await this.deleteSessionsFor(id);
  }
}
