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
export interface ApiKey { id: string; accountId: string; hash: string; scopes: string[]; createdAt: number; revokedAt?: number; capDaily?: number; capTotal?: number }

export interface CreditEntry { id: string; accountId: string; keyId?: string; delta: number; reason: "topup" | "debit" | "reversal"; ref: string; at: number }
export interface CreditOrder { id: string; accountId: string; checkoutId: string; packId: string; credits: number; paid: boolean }
export interface AgentReceipt { id: string; tool: string; keyId: string; accountId: string; at: number; inputSha: string; outputSha: string; credits: number; mode: "free" | "prepaid" | "byok"; sig: string; idem?: string; kid?: string }

export interface Store {
  // agent door (C7). creditApply must be atomic: a D1 adapter does it with one conditional UPDATE, never read-then-write.
  // F48 abuse tracing. prefix = first 8 chars of the key ID (never the secret token, never the hash). A D1 adapter indexes substr(id,1,8) (migration 0005).
  keysByPrefix(prefix: string, accountId?: string): Promise<ApiKey[]>; // accountId (F58): the tenant filter, applied in the WHERE
  receiptsForKey(keyId: string, limit: number, accountId?: string): Promise<AgentReceipt[]>; // newest first
  keyByHash(hash: string): Promise<ApiKey | undefined>;
  creditBalance(accountId: string): Promise<number>;
  creditApply(accountId: string, delta: number, reason: CreditEntry["reason"], ref: string, at: number, keyId?: string): Promise<number | undefined>; // new balance, or undefined if it would go below 0. keyId books the row to a key (a reversal must carry it so the key's spend is given back)
  // F176 (F19 wired): balance + per-key daily cap + per-key total cap + ledger write in ONE atomic step. A cap of N allows spend up to and including N.
  creditDebitCapped(o: import("./agent/d1agent.ts").DebitInput): Promise<import("./agent/d1agent.ts").CappedDebit>;
  keySpend(keyId: string, dayStart: number, accountId?: string): Promise<import("./agent/d1agent.ts").KeySpend>;
  creditEntries(accountId: string): Promise<CreditEntry[]>;
  putCreditOrder(o: CreditOrder): Promise<void>;
  creditOrderByCheckout(checkoutId: string): Promise<CreditOrder | undefined>;
  putReceipt(r: AgentReceipt): Promise<void>;
  receiptById(id: string, accountId?: string): Promise<AgentReceipt | undefined>;
  receiptByIdem(keyId: string, idem: string, accountId?: string): Promise<AgentReceipt | undefined>;
  // Idempotency reservation (F17, ported by F98). Insert-first, atomic: the FIRST caller for (keyId, idem) wins; a live claim is never stolen;
  // a claim with expires_at <= now is taken over and KEEPS its original rid (a debit made by a crashed owner is found, not repeated).
  idemReserve(keyId: string, idem: string, rid: string, owner: string, now: number, ttlMs: number): Promise<{ won: boolean; rid: string }>;
  idemRelease(keyId: string, idem: string, owner: string): Promise<void>; // owner-only; frees the key so a failed call can be retried
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
  keyById(id: string, accountId?: string): Promise<ApiKey | undefined>;
  anonymiseAccount(id: string, at: number): Promise<void>;
}

// f211: secondary index for MemoryStore. A bucket holds the ids whose key function returns that key, kept in FIRST-INSERT order of the
// row in its primary Map, which is exactly the order a full `[...map.values()].filter(...)` scan returns (Map.set on an existing key keeps
// its slot; delete then set moves to the end, and remove() drops the sequence number so a re-add gets a fresh one).
// Callers in service.ts mutate stored rows in place and then call put*(): so the key a row was INDEXED under is remembered per id (keyOf)
// and the old bucket is left from that remembered key, never from the (already mutated) row.
class MultiIndex<R> {
  private seq = new Map<string, number>(); private next = 0;
  private keyOf = new Map<string, string>();
  private buckets = new Map<string, { ids: Set<string>; max: number }>();
  readonly keyFn: (r: R) => string | undefined;
  constructor(keyFn: (r: R) => string | undefined) { this.keyFn = keyFn; }
  upsert(id: string, row: R): void {
    if (!this.seq.has(id)) this.seq.set(id, this.next++);
    const nk = this.keyFn(row), ok = this.keyOf.get(id);
    if (ok === nk) return;
    if (ok !== undefined) this.leave(id, ok);
    if (nk === undefined) { this.keyOf.delete(id); return; }
    this.keyOf.set(id, nk);
    let b = this.buckets.get(nk); if (!b) { b = { ids: new Set(), max: -1 }; this.buckets.set(nk, b); }
    const s = this.seq.get(id)!;
    if (s > b.max) { b.ids.add(id); b.max = s; }
    else { b.ids.add(id); b.ids = new Set([...b.ids].sort((x, y) => this.seq.get(x)! - this.seq.get(y)!)); } // a row that changed key keeps its primary-map slot
  }
  remove(id: string): void { const ok = this.keyOf.get(id); if (ok !== undefined) this.leave(id, ok); this.keyOf.delete(id); this.seq.delete(id); }
  private leave(id: string, key: string) { const b = this.buckets.get(key); if (!b) return; b.ids.delete(id); if (b.ids.size === 0) this.buckets.delete(key); }
  ids(key: string): Iterable<string> { return this.buckets.get(key)?.ids ?? []; }
  seqOf(id: string): number { return this.seq.get(id) ?? Infinity; }
  /** Ids of rows currently indexed (for the consistency check). */
  size(): number { return this.seq.size; }
}

export class MemoryStore implements Store {
  accounts = new Map<string, Account>(); loginTokens = new Map<string, LoginToken>(); loginLog = new Map<string, number[]>();
  sessions = new Map<string, Session>(); domains = new Map<string, DomainRow>(); purchases = new Map<string, Purchase>();
  subs = new Map<string, Subscription>(); invoices = new Map<string, Invoice>(); events = new Set<string>(); held = new Map<string, Record<string, unknown>[]>();
  cards = new Map<string, ReviewCard>(); refundCases = new Map<string, RefundCase>(); keys = new Map<string, ApiKey>(); private inv = 0;
  // f211 secondary indexes, kept on EVERY write path (put*, delete, anonymise). The Maps above stay the source of truth; checkIndexes() proves index == full scan.
  private ixAcctEmail = new MultiIndex<Account>((a) => a.email);
  private ixSessAcct = new MultiIndex<Session>((s) => s.accountId);
  private ixDomAcct = new MultiIndex<DomainRow>((d) => d.accountId);
  private ixDomVerified = new MultiIndex<DomainRow>((d) => (d.verifiedAt ? d.domain : undefined)); // verifiedAt 0 is falsy, as in the old scan
  private ixPurAcct = new MultiIndex<Purchase>((p) => p.accountId);
  private ixPurCheckout = new MultiIndex<Purchase>((p) => p.checkoutId);
  private ixPurPi = new MultiIndex<Purchase>((p) => p.paymentIntent);
  private ixSubAcct = new MultiIndex<Subscription>((x) => x.accountId);
  private ixInvAcct = new MultiIndex<Invoice>((i) => i.accountId);
  private ixInvPur = new MultiIndex<Invoice>((i) => (i.purchaseId === undefined ? "u" : "p" + i.purchaseId)); // "u" = no purchase: the old scan matched undefined === undefined
  private ixInvNumber = new MultiIndex<Invoice>((i) => i.number);
  private ixInvEvent = new MultiIndex<Invoice>((i) => (i.purchaseId === undefined ? undefined : i.purchaseId + "\u0000" + i.stripeEventId));
  private ixKeyAcct = new MultiIndex<ApiKey>((k) => k.accountId);
  private ixRefundPur = new MultiIndex<RefundCase>((r) => r.purchaseId);
  private rows<R>(ix: MultiIndex<R>, m: Map<string, R>, key: string): R[] { // re-checks the key on the live row, so a row mutated away in place and not yet re-put is not returned
    const out: R[] = []; for (const id of ix.ids(key)) { const r = m.get(id); if (r && ix.keyFn(r) === key) out.push(r); } return out;
  }
  private firstRow<R>(ix: MultiIndex<R>, m: Map<string, R>, key: string): R | undefined { for (const id of ix.ids(key)) { const r = m.get(id); if (r && ix.keyFn(r) === key) return r; } return undefined; }
  private ixAccount(a: Account) { this.accounts.set(a.id, a); this.ixAcctEmail.upsert(a.id, a); }
  private ixDomain(d: DomainRow) { this.domains.set(d.id, d); this.ixDomAcct.upsert(d.id, d); this.ixDomVerified.upsert(d.id, d); }
  private ixKey(k: ApiKey) { this.keys.set(k.id, k); this.ixKeyAcct.upsert(k.id, k); }
  private ixPur(p: Purchase) { this.ixPurAcct.upsert(p.id, p); this.ixPurCheckout.upsert(p.id, p); this.ixPurPi.upsert(p.id, p); }
  /** Full-scan oracle for the property test: every index answer equals the scan answer, same order. Returns a list of mismatches (empty = consistent). */
  checkIndexes(): string[] {
    const bad: string[] = [], same = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((x, i) => x === b[i]);
    const accts = new Set<string>(), emails = new Set<string>(), pis = new Set<string>(), cos = new Set<string>(), doms = new Set<string>(), pids = new Set<string>(), nums = new Set<string>();
    for (const a of this.accounts.values()) { accts.add(a.id); emails.add(a.email); }
    for (const s of this.sessions.values()) accts.add(s.accountId); for (const d of this.domains.values()) { accts.add(d.accountId); doms.add(d.domain); }
    for (const p of this.purchases.values()) { accts.add(p.accountId); cos.add(p.checkoutId); if (p.paymentIntent !== undefined) pis.add(p.paymentIntent); pids.add(p.id); }
    for (const x of this.subs.values()) accts.add(x.accountId); for (const k of this.keys.values()) accts.add(k.accountId);
    for (const i of this.invoices.values()) { accts.add(i.accountId); nums.add(i.number); if (i.purchaseId !== undefined) pids.add(i.purchaseId); }
    for (const r of this.refundCases.values()) pids.add(r.purchaseId);
    accts.add("ghost"); emails.add("ghost@x"); pis.add("ghost"); cos.add("ghost"); doms.add("ghost"); pids.add("ghost"); nums.add("ghost");
    const vals = <R>(m: Map<string, R>) => [...m.values()];
    const cmp = (name: string, key: string, got: unknown[], want: unknown[]) => { if (!same(got, want)) bad.push(`${name}(${key}): index ${got.length} rows != scan ${want.length} rows (or order differs)`); };
    for (const e of emails) cmp("accountByEmail", e, this.rows(this.ixAcctEmail, this.accounts, e).slice(0, 1), vals(this.accounts).filter((a) => a.email === e).slice(0, 1));
    for (const a of accts) {
      cmp("domainsFor", a, this.rows(this.ixDomAcct, this.domains, a), vals(this.domains).filter((d) => d.accountId === a));
      cmp("purchasesFor", a, this.rows(this.ixPurAcct, this.purchases, a), vals(this.purchases).filter((p) => p.accountId === a));
      cmp("subscriptionsFor", a, this.rows(this.ixSubAcct, this.subs, a), vals(this.subs).filter((s) => s.accountId === a));
      cmp("invoicesFor", a, this.rows(this.ixInvAcct, this.invoices, a), vals(this.invoices).filter((i) => i.accountId === a));
      cmp("keysFor", a, this.rows(this.ixKeyAcct, this.keys, a), vals(this.keys).filter((k) => k.accountId === a));
      cmp("sessionsFor", a, this.rows(this.ixSessAcct, this.sessions, a), vals(this.sessions).filter((s) => s.accountId === a));
    }
    for (const d of doms) cmp("verifiedOwnerOf", d, this.rows(this.ixDomVerified, this.domains, d).slice(0, 1), vals(this.domains).filter((x) => x.domain === d && x.verifiedAt).slice(0, 1));
    for (const c of cos) cmp("purchaseByCheckout", c, this.rows(this.ixPurCheckout, this.purchases, c).slice(0, 1), vals(this.purchases).filter((p) => p.checkoutId === c).slice(0, 1));
    for (const c of pis) cmp("purchaseByPaymentIntent", c, this.rows(this.ixPurPi, this.purchases, c).slice(0, 1), vals(this.purchases).filter((p) => p.paymentIntent === c).slice(0, 1));
    for (const n of nums) cmp("invoiceNumber", n, this.rows(this.ixInvNumber, this.invoices, n), vals(this.invoices).filter((i) => i.number === n));
    for (const p of pids) {
      cmp("purchaseInvoiced", p, this.rows(this.ixInvPur, this.invoices, "p" + p), vals(this.invoices).filter((i) => i.purchaseId === p));
      cmp("refundCasesFor", p, this.rows(this.ixRefundPur, this.refundCases, p), vals(this.refundCases).filter((r) => r.purchaseId === p));
    }
    cmp("invoiceNoPurchase", "u", this.rows(this.ixInvPur, this.invoices, "u"), vals(this.invoices).filter((i) => i.purchaseId === undefined));
    const evs = new Set<string>(); for (const i of this.invoices.values()) if (i.purchaseId !== undefined) evs.add(i.purchaseId + "\u0000" + i.stripeEventId);
    for (const e of evs) { const [pu, ev] = e.split("\u0000"); cmp("invoiceEvent", e, this.rows(this.ixInvEvent, this.invoices, e), vals(this.invoices).filter((i) => i.purchaseId === pu && i.stripeEventId === ev)); }
    return bad;
  }
  async accountByEmail(e: string) { return this.firstRow(this.ixAcctEmail, this.accounts, e); }
  async accountById(id: string) { return this.accounts.get(id); }
  async putAccount(a: Account) { this.ixAccount(a); }
  async putLoginToken(t: LoginToken) { this.loginTokens.set(t.hash, t); }
  async consumeLoginToken(h: string, now: number) { const t = this.loginTokens.get(h); if (!t || t.used || t.expiresAt < now) return undefined; t.used = true; return t; }
  async loginRequestsSince(e: string, since: number) { return (this.loginLog.get(e) ?? []).filter((x) => x >= since).length; }
  async noteLoginRequest(e: string, at: number) { this.loginLog.set(e, [...(this.loginLog.get(e) ?? []), at]); }
  async putSession(s: Session) { this.sessions.set(s.hash, s); this.ixSessAcct.upsert(s.hash, s); }
  async sessionByHash(h: string, now: number) { const s = this.sessions.get(h); return s && s.expiresAt > now ? s : undefined; }
  async deleteSessionsFor(id: string) { for (const s of this.rows(this.ixSessAcct, this.sessions, id)) { this.sessions.delete(s.hash); this.ixSessAcct.remove(s.hash); } }
  async domainsFor(id: string) { return this.rows(this.ixDomAcct, this.domains, id); }
  async domainById(id: string) { return this.domains.get(id); }
  async verifiedOwnerOf(domain: string) { return this.firstRow(this.ixDomVerified, this.domains, domain); }
  async putDomain(d: DomainRow) { this.ixDomain(d); }
  async putPurchase(p: Purchase) { this.purchases.set(p.id, p); this.ixPur(p); }
  async casPurchase(next: Purchase, expected: Purchase["status"], expectedRefundedCents?: number) { // check and write in one synchronous step: no await between them, so two callers cannot both pass
    const cur = this.purchases.get(next.id); if (!cur || cur.status !== expected || (expectedRefundedCents !== undefined && cur.refundedCents !== expectedRefundedCents)) return false; // f239: refunded_cents is part of the guard when given
    const row = { ...next }; this.purchases.set(next.id, row); this.ixPur(row); return true;
  }
  async purchaseById(id: string) { return this.purchases.get(id); }
  async purchaseByCheckout(c: string) { return this.firstRow(this.ixPurCheckout, this.purchases, c); }
  async purchaseByPaymentIntent(pi: string) { return this.firstRow(this.ixPurPi, this.purchases, pi); }
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
  async purchasesFor(id: string) { return this.rows(this.ixPurAcct, this.purchases, id); }
  subVer = new Map<string, number>();
  async putSubscription(s: Subscription) { this.subs.set(s.id, s); this.ixSubAcct.upsert(s.id, s); this.subVer.set(s.id, (this.subVer.get(s.id) ?? 0) + 1); }
  async subscriptionByPurchase(pid: string) { return [...this.subs.values()].find((x) => x.purchaseId === pid); }
  async putSubscriptionOnce(s: Subscription) { // no await between check and write
    if (this.subs.has(s.id) || [...this.subs.values()].some((x) => x.purchaseId === s.purchaseId)) return false;
    this.subs.set(s.id, s); this.ixSubAcct.upsert(s.id, s); this.subVer.set(s.id, (this.subVer.get(s.id) ?? 0) + 1); return true;
  }
  async paidWithoutSubscriptionBefore(cutoff: number, ids: string[]) {
    return [...this.purchases.values()].filter((p) => p.status === "paid" && p.paidAt !== undefined && cutoff >= p.paidAt && ids.includes(p.productId)
      && ![...this.subs.values()].some((x) => x.purchaseId === p.id)).sort((a, b) => a.paidAt! - b.paidAt! || (a.id < b.id ? -1 : 1)).map((p) => ({ ...p }));
  }
  async subscriptionVersioned(id: string) { const s = this.subs.get(id); return s && { sub: { ...s }, version: this.subVer.get(id) ?? 0 }; }
  async casSubscription(s: Subscription, expectedVersion: number) {
    if (!this.subs.has(s.id) || (this.subVer.get(s.id) ?? 0) !== expectedVersion) return false;
    this.subs.set(s.id, s); this.ixSubAcct.upsert(s.id, s); this.subVer.set(s.id, expectedVersion + 1); return true;
  }
  async createSubscription(s: Subscription) { if (this.subs.has(s.id)) return false; this.subs.set(s.id, s); this.ixSubAcct.upsert(s.id, s); this.subVer.set(s.id, 1); return true; }
  async subscriptionById(id: string) { return this.subs.get(id); }
  async subscriptionsFor(id: string) { return this.rows(this.ixSubAcct, this.subs, id); }
  // Reference semantics for the invoice contract (test/invoice_contract.test.ts runs it on every adapter): ids are upsert keys, numbers are unique,
  // and one purchase carries at most one invoice per Stripe event. A violation throws; nothing is written.
  async putInvoice(i: Invoice) {
    // First violating row in Map order (the old scan's order): the number rule is checked before the event rule on the same row.
    const nHit = [...this.ixInvNumber.ids(i.number)].find((id) => id !== i.id);
    const eHit = i.purchaseId === undefined ? undefined : [...this.ixInvEvent.ids(i.purchaseId + "\u0000" + i.stripeEventId)].find((id) => id !== i.id);
    if (nHit !== undefined && (eHit === undefined || this.ixInvNumber.seqOf(nHit) <= this.ixInvEvent.seqOf(eHit))) throw new Error(`invoice number ${i.number} already issued`);
    if (eHit !== undefined) throw new Error(`purchase ${i.purchaseId} already invoiced for event ${i.stripeEventId}`);
    const row = Object.fromEntries(Object.entries(i).filter(([, v]) => v !== undefined)) as unknown as Invoice; // absent optionals stay absent, as on D1
    this.invoices.set(i.id, row);
    for (const ix of [this.ixInvAcct, this.ixInvPur, this.ixInvNumber, this.ixInvEvent]) ix.upsert(i.id, row);
  }
  async invoicesFor(id: string) { return this.rows(this.ixInvAcct, this.invoices, id).map((i) => ({ ...i })); }
  async invoiceById(id: string) { const i = this.invoices.get(id); return i && { ...i }; }
  async purchaseInvoiced(id: string) { return this.rows(this.ixInvPur, this.invoices, "p" + id).length > 0; }
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
  async putRefundCase(r: RefundCase) { this.refundCases.set(r.id, r); this.ixRefundPur.upsert(r.id, r); }
  async refundCaseById(id: string) { return this.refundCases.get(id); }
  async refundCasesFor(p: string) { return this.rows(this.ixRefundPur, this.refundCases, p); }
  async openCards() { return [...this.cards.values()].filter((c) => !c.resolved); }
  ledger: CreditEntry[] = []; creditOrders = new Map<string, CreditOrder>(); receipts = new Map<string, AgentReceipt>(); callLog = new Map<string, number[]>(); private ent = 0;
  async keysByPrefix(p: string, accountId?: string) { return [...this.keys.values()].filter((k) => k.id.startsWith(p) && (accountId === undefined || k.accountId === accountId)); }
  async receiptsForKey(keyId: string, limit: number, accountId?: string) { return [...this.receipts.values()].filter((r) => r.keyId === keyId && (accountId === undefined || r.accountId === accountId)).sort((a, b) => b.at - a.at).slice(0, limit); }
  async keyByHash(h: string) { return [...this.keys.values()].find((k) => k.hash === h); }
  async creditBalance(id: string) { return this.ledger.filter((e) => e.accountId === id).reduce((n, e) => n + e.delta, 0); }
  // F98: SYNCHRONOUS check-and-write (no await between the balance read and the push), and (reason, ref) is unique, as in the D1 ledger
  // (UNIQUE (reason, ref)). Before F98 this awaited creditBalance first, so 45 of 60 parallel 1-credit debits were served on a balance of 25,
  // and a replayed top-up or refund was granted twice.
  async creditApply(id: string, delta: number, reason: CreditEntry["reason"], ref: string, at: number, keyId?: string) {
    if (this.ledger.some((e) => e.reason === reason && e.ref === ref)) return undefined;
    const bal = this.ledger.filter((e) => e.accountId === id).reduce((n, e) => n + e.delta, 0);
    if (bal + delta < 0) return undefined;
    if (keyId !== undefined && this.keys.get(keyId)?.accountId !== id) return undefined;
    this.ledger.push({ id: `ent_${++this.ent}`, accountId: id, delta, reason, ref, at, ...(keyId !== undefined ? { keyId } : {}) });
    return bal + delta;
  }
  // F176: the in-memory twin of D1AgentStore.creditDebitCapped. SYNCHRONOUS from the first read to the push (no await), so it is atomic.
  async creditDebitCapped(o: import("./agent/d1agent.ts").DebitInput): Promise<import("./agent/d1agent.ts").CappedDebit> {
    if (this.keys.get(o.keyId)?.accountId !== o.accountId) return { ok: false, reason: "key_not_in_tenant" };
    if (this.ledger.some((e) => e.reason === "debit" && e.ref === o.ref)) return { ok: false, reason: "duplicate_ref" };
    const bal = this.ledger.filter((e) => e.accountId === o.accountId).reduce((n, e) => n + e.delta, 0);
    const sp = this.spendSync(o.keyId, o.dayStart, o.accountId);
    if (sp.day + o.amount > o.capDaily) return { ok: false, reason: "key_cap_daily" };
    if (sp.total + o.amount > o.capTotal) return { ok: false, reason: "key_cap_total" };
    if (bal - o.amount < 0) return { ok: false, reason: "insufficient_credits" };
    this.ledger.push({ id: `ent_${++this.ent}`, accountId: o.accountId, keyId: o.keyId, delta: -o.amount, reason: "debit", ref: o.ref, at: o.at });
    return { ok: true, balance: bal - o.amount, spent: { day: sp.day + o.amount, total: sp.total + o.amount } };
  }
  private spendSync(keyId: string, dayStart: number, accountId?: string) {
    const rows = this.ledger.filter((e) => e.keyId === keyId && (accountId === undefined || e.accountId === accountId));
    return { day: -rows.filter((e) => e.at >= dayStart).reduce((n, e) => n + e.delta, 0), total: -rows.reduce((n, e) => n + e.delta, 0) };
  }
  async keySpend(keyId: string, dayStart: number, accountId?: string) { return this.spendSync(keyId, dayStart, accountId); }
  async creditEntries(id: string) { return this.ledger.filter((e) => e.accountId === id); }
  async putCreditOrder(o: CreditOrder) { this.creditOrders.set(o.id, o); }
  async creditOrderByCheckout(c: string) { return [...this.creditOrders.values()].find((o) => o.checkoutId === c); }
  async putReceipt(r: AgentReceipt) { this.receipts.set(r.id, r); }
  async receiptById(id: string, accountId?: string) { const r = this.receipts.get(id); return r && (accountId === undefined || r.accountId === accountId) ? r : undefined; }
  async receiptByIdem(keyId: string, idem: string, accountId?: string) { return [...this.receipts.values()].find((r) => r.keyId === keyId && r.idem === idem && (accountId === undefined || r.accountId === accountId)); }
  idem = new Map<string, { rid: string; owner: string; expiresAt: number }>();
  async idemReserve(keyId: string, idem: string, rid: string, owner: string, now: number, ttlMs: number) {
    // synchronous check-and-set (no await between read and write), the in-memory twin of the D1 upsert
    const k = `${keyId}\u0000${idem}`, cur = this.idem.get(k);
    if (cur && cur.expiresAt > now) return { won: false, rid: cur.rid };
    const keep = cur?.rid ?? rid;
    this.idem.set(k, { rid: keep, owner, expiresAt: now + ttlMs });
    return { won: true, rid: keep };
  }
  async idemRelease(keyId: string, idem: string, owner: string) { const k = `${keyId}\u0000${idem}`; if (this.idem.get(k)?.owner === owner) this.idem.delete(k); }
  async callsSince(k: string, since: number) { return (this.callLog.get(k) ?? []).filter((x) => x >= since).length; }
  async noteCall(k: string, at: number) { this.callLog.set(k, [...(this.callLog.get(k) ?? []), at]); }
  async putKey(k: ApiKey) { this.ixKey(k); }
  async keysFor(id: string) { return this.rows(this.ixKeyAcct, this.keys, id); }
  async keyById(id: string, accountId?: string) { const k = this.keys.get(id); return k && (accountId === undefined || k.accountId === accountId) ? k : undefined; }
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
    this.ixAccount({ ...a, email: `deleted+${id}@deleted.invalid`, stripeCustomerId: undefined, deletedAt: at });
    for (const d of this.rows(this.ixDomAcct, this.domains, id)) { this.domains.delete(d.id); this.ixDomAcct.remove(d.id); this.ixDomVerified.remove(d.id); }
    for (const key of this.rows(this.ixKeyAcct, this.keys, id)) this.ixKey({ ...key, revokedAt: key.revokedAt ?? at });
    await this.deleteSessionsFor(id);
  }
}
