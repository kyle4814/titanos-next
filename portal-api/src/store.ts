// Persistence interface for the portal. MemoryStore is the test/local adapter. A D1 adapter is NOT BUILT yet
// (migration 0002 defines the tables; 0016 adds purchases.refunded_at, NULL until a refund is recorded); until it exists the Worker fails closed on every route except /health.
export interface Account { id: string; email: string; seat: string; stripeCustomerId?: string; createdAt: number; deletedAt?: number }
export interface Session { hash: string; accountId: string; expiresAt: number }
export interface LoginToken { hash: string; email: string; expiresAt: number; used: boolean }
export interface DomainRow { id: string; accountId: string; domain: string; token: string; verifiedAt?: number }
export interface Purchase { id: string; accountId: string; productId: string; domain?: string; checkoutId: string; paymentIntent?: string; subscriptionId?: string; paidAt?: number; amountCents: number; deliverableIssued: boolean; refundedCents: number; refundedAt?: number; status: "pending" | "paid" | "refunded" | "cancelled" | "abandoned"; createdAt?: number }
import type { PlanState } from "./plan_change.ts";
export interface Subscription { id: string; accountId: string; purchaseId: string; productId: string; startedAt: number; cancelAt?: number; cancelledAt?: number; plan?: PlanState }
export interface Invoice { id: string; accountId: string; purchaseId?: string; number: string; productId: string; amountCents: number; issuedAt: number; stripeEventId: string }
export interface ReviewCard { id: string; accountId: string; purchaseId: string; kind: "refund_outside_policy"; reason: string; createdAt: number; resolved: boolean }
export type { RefundCase } from "./refund_card.ts";
import type { RefundCase } from "./refund_card.ts";
export interface ApiKey { id: string; accountId: string; hash: string; scopes: string[]; createdAt: number; revokedAt?: number }

export interface CreditEntry { id: string; accountId: string; delta: number; reason: "topup" | "debit" | "reversal"; ref: string; at: number }
export interface CreditOrder { id: string; accountId: string; checkoutId: string; packId: string; credits: number; paid: boolean }
export interface AgentReceipt { id: string; tool: string; keyId: string; accountId: string; at: number; inputSha: string; outputSha: string; credits: number; mode: "free" | "prepaid" | "byok"; sig: string; idem?: string; kid?: string }

export interface Store {
  // agent door (C7). creditApply must be atomic: a D1 adapter does it with one conditional UPDATE, never read-then-write.
  // F48 abuse tracing. prefix = first 8 chars of the key ID (never the secret token, never the hash). A D1 adapter indexes substr(id,1,8) (migration 0005).
  keysByPrefix(prefix: string): Promise<ApiKey[]>;
  receiptsForKey(keyId: string, limit: number): Promise<AgentReceipt[]>; // newest first
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
  // f236: compare-and-set. Writes `next` over the stored purchase ONLY IF its status is still `expected`; true = THIS call made the transition, false = lost (row moved on or is absent), nothing written.
  casPurchase(next: Purchase, expected: Purchase["status"], expectedRefundedCents?: number): Promise<boolean>;
  purchaseById(id: string): Promise<Purchase | undefined>;
  purchaseByCheckout(checkoutId: string): Promise<Purchase | undefined>;
  purchaseByPaymentIntent(pi: string): Promise<Purchase | undefined>;
  purchasesFor(accountId: string): Promise<Purchase[]>;
  putSubscription(s: Subscription): Promise<void>;
  // f237: write the subscription ONLY IF the purchase has none (keyed on purchase id), atomically; false = one already exists, nothing written.
  putSubscriptionOnce(s: Subscription): Promise<boolean>;
  subscriptionByPurchase(purchaseId: string): Promise<Subscription | undefined>;
  // f237: purchases with status exactly 'paid', paid at or before `cutoff`, of a subscription-mode product, that have NO subscription row. Oldest first.
  paidWithoutSubscriptionBefore(cutoff: number, subscriptionProductIds: string[]): Promise<Purchase[]>;
  createSubscription(s: Subscription): Promise<boolean>; // insert-if-absent by id (f183); false = a row already exists and is left untouched. markPaid itself uses putSubscriptionOnce (keyed on purchase id, f237)
  subscriptionById(id: string): Promise<Subscription | undefined>;
  // Optimistic concurrency (f175). Read a COPY plus its version; write it back only if the version is unchanged (false = lost the race, re-read and retry).
  subscriptionVersioned(id: string): Promise<{ sub: Subscription; version: number } | undefined>;
  casSubscription(s: Subscription, expectedVersion: number): Promise<boolean>;
  subscriptionsFor(accountId: string): Promise<Subscription[]>;
  putInvoice(i: Invoice): Promise<void>;
  invoicesFor(accountId: string): Promise<Invoice[]>;
  invoiceById(id: string): Promise<Invoice | undefined>;
  nextInvoiceNumber(): Promise<string>;
  // f203 reconciler. purchaseInvoiced: the purchase has at least one invoice. putInvoiceOnce: write the invoice ONLY IF the purchase has none, atomically (false = lost the race, nothing written).
  // paidPurchasesBefore: purchases paid at or before `cutoff` (status paid or refunded) that carry no invoice, oldest first.
  purchaseInvoiced(purchaseId: string): Promise<boolean>;
  putInvoiceOnce(i: Invoice): Promise<boolean>;
  paidPurchasesBefore(cutoff: number): Promise<Purchase[]>;
  // f210 pending reconciler. pendingPurchasesBefore: status pending, created at or before `cutoff` (a row with no createdAt predates the column and counts as oldest), oldest first.
  pendingPurchasesBefore(cutoff: number): Promise<Purchase[]>;
  // f234: how many purchases sit in each terminal-not-paid state, so a customer cancel and an abandoned checkout are counted apart.
  countByStatus(status: Purchase["status"]): Promise<number>;
  // f242: a claim LEASE (owner token + expiry). acquireLease is true when no OTHER owner holds an unexpired lease on `key` (it then takes or renews it); false = a live lease is held by someone else.
  // An expired lease is free to take (the holder died). releaseLease frees it only for the same owner. TEST ADAPTER ONLY (in memory, inherited by the D1 test store): a real D1 lease needs a table, a gated card.
  acquireLease(key: string, owner: string, now: number, ttlMs: number): Promise<boolean>;
  releaseLease(key: string, owner: string): Promise<void>;
  // f243: refund MEMO, an atomic one-row-per-key record (fact carries `at`). memoInsert is ONE conditional insert (true = THIS call created it); memoSwap is a compare-and-set on the exact stored fact (next null = conditional delete).
  // The f240 take-then-hold pair is gone: there is no window between reading and writing the memo, so a crash or a rival cannot lose it or re-run Stripe.
  memoInsert(key: string, fact: Record<string, unknown>): Promise<boolean>;
  memoPeek(key: string): Promise<Record<string, unknown> | undefined>;
  memoSwap(key: string, expected: Record<string, unknown>, next: Record<string, unknown> | null): Promise<boolean>;
  memoList(prefix: string): Promise<{ key: string; fact: Record<string, unknown> }[]>;
  claimEvent(eventId: string): Promise<boolean>; // true the first time only (webhook idempotency)
  holdFact(key: string, fact: Record<string, unknown>): Promise<void>;   // an out-of-order webhook fact waiting for its payment
  takeFacts(key: string): Promise<Record<string, unknown>[]>;            // removes and returns them
  // f356: the distinct held-fact keys that start with `prefix` and sort strictly after `after` (a cursor), ascending, at most `limit`. READ-ONLY: it never takes a fact (takeFacts is the only reader that removes).
  heldFactKeys(prefix: string, after: string | undefined, limit: number): Promise<string[]>;
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
  async casPurchase(next: Purchase, expected: Purchase["status"], expectedRefundedCents?: number) { // check and write in one synchronous step: no await between them, so two callers cannot both pass
    const cur = this.purchases.get(next.id); if (!cur || cur.status !== expected || (expectedRefundedCents !== undefined && cur.refundedCents !== expectedRefundedCents)) return false; // f239: refunded_cents is part of the guard when given
    this.purchases.set(next.id, { ...next }); return true;
  }
  async purchaseById(id: string) { return this.purchases.get(id); }
  async purchaseByCheckout(c: string) { return [...this.purchases.values()].find((p) => p.checkoutId === c); }
  async purchaseByPaymentIntent(pi: string) { return [...this.purchases.values()].find((p) => p.paymentIntent === pi); }
  leases = new Map<string, { owner: string; expiresAt: number }>();
  async acquireLease(key: string, owner: string, now: number, ttlMs: number) { // no await between check and write
    const cur = this.leases.get(key); if (cur && cur.owner !== owner && cur.expiresAt > now) return false;
    this.leases.set(key, { owner, expiresAt: now + ttlMs }); return true;
  }
  async releaseLease(key: string, owner: string) { if (this.leases.get(key)?.owner === owner) this.leases.delete(key); }
  memos = new Map<string, string>(); // key -> JSON; no await between check and write, so each op is atomic on one thread
  async memoInsert(k: string, f: Record<string, unknown>) { if (this.memos.has(k)) return false; this.memos.set(k, JSON.stringify(f)); return true; }
  async memoPeek(k: string) { const v = this.memos.get(k); return v === undefined ? undefined : (JSON.parse(v) as Record<string, unknown>); }
  async memoSwap(k: string, expected: Record<string, unknown>, next: Record<string, unknown> | null) {
    if (this.memos.get(k) !== JSON.stringify(expected)) return false;
    if (next === null) this.memos.delete(k); else this.memos.set(k, JSON.stringify(next)); return true;
  }
  async memoList(prefix: string) { return [...this.memos].filter(([k]) => k.startsWith(prefix)).map(([key, v]) => ({ key, fact: JSON.parse(v) as Record<string, unknown> })); }
  async holdFact(k: string, f: Record<string, unknown>) { this.held.set(k, [...(this.held.get(k) ?? []), JSON.parse(JSON.stringify(f))]); } // JSON copy: same wire shape as the D1 adapter (absent stays absent)
  async takeFacts(k: string) { const f = this.held.get(k) ?? []; this.held.delete(k); return f; }
  async heldFactKeys(prefix: string, after: string | undefined, limit: number) { return [...this.held.entries()].filter(([k, v]) => v.length > 0 && k.startsWith(prefix) && (after === undefined || k > after)).map(([k]) => k).sort().slice(0, Math.max(0, limit)); }
  async purchasesFor(id: string) { return [...this.purchases.values()].filter((p) => p.accountId === id); }
  subVer = new Map<string, number>();
  async putSubscription(s: Subscription) { this.subs.set(s.id, s); this.subVer.set(s.id, (this.subVer.get(s.id) ?? 0) + 1); }
  async subscriptionByPurchase(pid: string) { return [...this.subs.values()].find((x) => x.purchaseId === pid); }
  async putSubscriptionOnce(s: Subscription) { // no await between check and write
    if (this.subs.has(s.id) || [...this.subs.values()].some((x) => x.purchaseId === s.purchaseId)) return false;
    this.subs.set(s.id, s); this.subVer.set(s.id, (this.subVer.get(s.id) ?? 0) + 1); return true;
  }
  async paidWithoutSubscriptionBefore(cutoff: number, ids: string[]) {
    return [...this.purchases.values()].filter((p) => p.status === "paid" && p.paidAt !== undefined && cutoff >= p.paidAt && ids.includes(p.productId)
      && ![...this.subs.values()].some((x) => x.purchaseId === p.id)).sort((a, b) => a.paidAt! - b.paidAt! || (a.id < b.id ? -1 : 1)).map((p) => ({ ...p }));
  }
  async subscriptionVersioned(id: string) { const s = this.subs.get(id); return s && { sub: { ...s }, version: this.subVer.get(id) ?? 0 }; }
  async casSubscription(s: Subscription, expectedVersion: number) {
    if (!this.subs.has(s.id) || (this.subVer.get(s.id) ?? 0) !== expectedVersion) return false;
    this.subs.set(s.id, s); this.subVer.set(s.id, expectedVersion + 1); return true;
  }
  async createSubscription(s: Subscription) { if (this.subs.has(s.id)) return false; this.subs.set(s.id, s); this.subVer.set(s.id, 1); return true; }
  async subscriptionById(id: string) { return this.subs.get(id); }
  async subscriptionsFor(id: string) { return [...this.subs.values()].filter((s) => s.accountId === id); }
  // Reference semantics for the invoice contract (test/invoice_contract.test.ts runs it on every adapter): ids are upsert keys, numbers are unique,
  // and one purchase carries at most one invoice per Stripe event. A violation throws; nothing is written.
  async putInvoice(i: Invoice) {
    for (const o of this.invoices.values()) {
      if (o.id === i.id) continue;
      if (o.number === i.number) throw new Error(`invoice number ${i.number} already issued`);
      if (i.purchaseId !== undefined && o.purchaseId === i.purchaseId && o.stripeEventId === i.stripeEventId) throw new Error(`purchase ${i.purchaseId} already invoiced for event ${i.stripeEventId}`);
    }
    this.invoices.set(i.id, Object.fromEntries(Object.entries(i).filter(([, v]) => v !== undefined)) as unknown as Invoice); // absent optionals stay absent, as on D1
  }
  async invoicesFor(id: string) { return [...this.invoices.values()].filter((i) => i.accountId === id).map((i) => ({ ...i })); }
  async invoiceById(id: string) { const i = this.invoices.get(id); return i && { ...i }; }
  async purchaseInvoiced(id: string) { return [...this.invoices.values()].some((o) => o.purchaseId === id); }
  // No await between the check and the write: atomic on one object (putInvoice is async but runs synchronously to its end).
  async putInvoiceOnce(i: Invoice) {
    if ([...this.invoices.values()].some((o) => o.purchaseId === i.purchaseId)) return false;
    await this.putInvoice(i); return true;
  }
  async paidPurchasesBefore(cutoff: number) {
    return [...this.purchases.values()].filter((p) => p.paidAt !== undefined && p.paidAt <= cutoff && (p.status === "paid" || p.status === "refunded")
      && ![...this.invoices.values()].some((o) => o.purchaseId === p.id)).sort((a, b) => a.paidAt! - b.paidAt! || (a.id < b.id ? -1 : 1)).map((p) => ({ ...p }));
  }
  async pendingPurchasesBefore(cutoff: number) {
    return [...this.purchases.values()].filter((p) => p.status === "pending" && (p.createdAt ?? 0) <= cutoff)
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || (a.id < b.id ? -1 : 1)).map((p) => ({ ...p }));
  }
  async countByStatus(status: Purchase["status"]) { return [...this.purchases.values()].filter((p) => p.status === status).length; }
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
  async keysByPrefix(p: string) { return [...this.keys.values()].filter((k) => k.id.startsWith(p)); }
  async receiptsForKey(keyId: string, limit: number) { return [...this.receipts.values()].filter((r) => r.keyId === keyId).sort((a, b) => b.at - a.at).slice(0, limit); }
  async keyByHash(h: string) { return [...this.keys.values()].find((k) => k.hash === h); }
  async creditBalance(id: string) { return this.ledger.filter((e) => e.accountId === id).reduce((n, e) => n + e.delta, 0); }
  async creditApply(id: string, delta: number, reason: CreditEntry["reason"], ref: string, at: number) {
    // no await between the check and the push: the check-and-write is one synchronous step, so concurrent debits cannot oversell
    const bal = this.ledger.filter((e) => e.accountId === id).reduce((n, e) => n + e.delta, 0);
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
  // Data-rights support (src/dsr.ts DsrStore). Kept off the Store interface so existing adapters do not break.
  async receiptsFor(id: string) { return [...this.receipts.values()].filter((r) => r.accountId === id); }
  async creditOrdersFor(id: string) { return [...this.creditOrders.values()].filter((o) => o.accountId === id); }
  async cardsFor(id: string) { return [...this.cards.values()].filter((c) => c.accountId === id); }
  async purgeLoginStateFor(email: string) {
    for (const [k, t] of this.loginTokens) if (t.email === email) this.loginTokens.delete(k);
    this.loginLog.delete(email);
  }
  // Account deletion: PII goes, financial records stay (tax law), tied to an opaque id only.
  async anonymiseAccount(id: string, at: number) {
    const a = this.accounts.get(id); if (!a) return;
    this.accounts.set(id, { ...a, email: `deleted+${id}@deleted.invalid`, stripeCustomerId: undefined, deletedAt: at });
    for (const [k, d] of this.domains) if (d.accountId === id) this.domains.delete(k);
    for (const [k, key] of this.keys) if (key.accountId === id) this.keys.set(k, { ...key, revokedAt: key.revokedAt ?? at });
    await this.deleteSessionsFor(id);
  }
}
