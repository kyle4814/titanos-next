// D1Store: the Cloudflare D1 adapter for the portal Store interface (F13). Written against migrations 0001..0004
// (0004 adds invoice_seq). NOT applied to any live D1 (GATE5); the Worker still fails closed until it is wired and deployed.
//
// Rules this file keeps:
//  - Every write that must be atomic is ONE SQL statement (conditional INSERT...SELECT, UPDATE...WHERE used=0,
//    INSERT...ON CONFLICT RETURNING). Never read-then-write across two awaits.
//  - Every query is parameterised (bind). No value is ever concatenated into SQL.
//  - Upserts use ON CONFLICT DO UPDATE, never INSERT OR REPLACE (REPLACE deletes the row and trips foreign keys).
//  - Times are stored as epoch milliseconds. Migration 0001 declares a few of them TEXT; SQLite keeps the digits
//    and we convert with Number() on the way out.
import type { D1Like, D1Statement } from "./env.ts";
import type { PlanState } from "./plan_change.ts";
import type { Account, AgentReceipt, ApiKey, CreditEntry, CreditOrder, DomainRow, Invoice, LoginToken, Purchase, RefundCase, ReviewCard, Session, Store, Subscription } from "./store.ts";

type Row = Record<string, unknown>;
const num = (v: unknown): number | undefined => (v === null || v === undefined || v === "" ? undefined : Number(v));
const str = (v: unknown): string | undefined => (v === null || v === undefined ? undefined : String(v));
const bool = (v: unknown): boolean => Number(v) === 1;

const toAccount = (r: Row): Account => ({ id: String(r.id), email: String(r.email), seat: String(r.seat), stripeCustomerId: str(r.stripe_customer_id), createdAt: Number(r.created_at), deletedAt: num(r.deleted_at) });
const toDomain = (r: Row): DomainRow => ({ id: String(r.id), accountId: String(r.account_id), domain: String(r.domain), token: String(r.verify_token), verifiedAt: num(r.verified_at) });
const clean = <T extends object>(o: T): T => { for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k]; return o; }; // absent optionals stay absent, as in MemoryStore
const toPurchase = (r: Row): Purchase => clean({ id: String(r.id), accountId: String(r.account_id), productId: String(r.product_id), domain: str(r.domain), checkoutId: String(r.checkout_id), paymentIntent: str(r.payment_intent), subscriptionId: str(r.subscription_id), paidAt: num(r.paid_at), amountCents: Number(r.amount_cents), deliverableIssued: bool(r.deliverable_issued), refundedCents: Number(r.refunded_cents), status: String(r.status) as Purchase["status"], createdAt: num(r.created_at) });
const toSub = (r: Row): Subscription => {
  const s: Subscription = clean({ id: String(r.id), accountId: String(r.account_id), purchaseId: String(r.purchase_id), productId: String(r.product_id), startedAt: Number(r.started_at), cancelAt: num(r.cancel_at), cancelledAt: num(r.cancelled_at) });
  if (r.plan_json !== null && r.plan_json !== undefined) s.plan = JSON.parse(String(r.plan_json)) as PlanState;
  return s;
};
const toInvoice = (r: Row): Invoice => clean({ id: String(r.id), accountId: String(r.account_id), purchaseId: str(r.purchase_id), number: String(r.number), productId: String(r.product_id), amountCents: Number(r.amount_cents), issuedAt: Number(r.issued_at), stripeEventId: String(r.stripe_event_id) });
const toCard = (r: Row): ReviewCard => ({ id: String(r.id), accountId: String(r.account_id), purchaseId: String(r.purchase_id), kind: String(r.kind) as ReviewCard["kind"], reason: String(r.reason), createdAt: Number(r.created_at), resolved: bool(r.resolved) });
const toKey = (r: Row): ApiKey => ({ id: String(r.id), accountId: String(r.account_id), hash: String(r.key_hash), scopes: String(r.scopes ?? "") === "" ? [] : String(r.scopes).split(","), createdAt: Number(r.created_at), revokedAt: num(r.revoked_at) });
const toEntry = (r: Row): CreditEntry => ({ id: String(r.id), accountId: String(r.account_id), delta: Number(r.delta), reason: String(r.reason) as CreditEntry["reason"], ref: String(r.ref), at: Number(r.at) });
const toOrder = (r: Row): CreditOrder => ({ id: String(r.id), accountId: String(r.account_id), checkoutId: String(r.checkout_id), packId: String(r.pack_id), credits: Number(r.credits), paid: bool(r.paid) });
const toReceipt = (r: Row): AgentReceipt => ({ id: String(r.id), tool: String(r.tool), keyId: String(r.key_id), accountId: String(r.account_id), at: Number(r.at), inputSha: String(r.input_sha), outputSha: String(r.output_sha), credits: Number(r.credits), mode: String(r.mode) as AgentReceipt["mode"], sig: String(r.sig), ...(r.idem === null || r.idem === undefined ? {} : { idem: String(r.idem) }), ...(r.kid === null || r.kid === undefined ? {} : { kid: String(r.kid) }) });
const planJson = (s: Subscription) => (s.plan === undefined ? null : JSON.stringify(s.plan));
const toRefundCase = (r: Row): RefundCase => clean({ id: String(r.id), accountId: String(r.account_id), purchaseId: String(r.purchase_id), productName: String(r.product_name), amountCents: Number(r.amount_cents), reason: String(r.reason), inPolicy: bool(r.in_policy), status: String(r.status) as RefundCase["status"], createdAt: Number(r.created_at), decidedAt: num(r.decided_at) });
const b = (v: boolean) => (v ? 1 : 0);
const n = (v: unknown) => (v === undefined ? null : v);

export class D1Store implements Store {
  private db: D1Like;
  constructor(db: D1Like) { this.db = db; }

  private q(sql: string, ...args: unknown[]): D1Statement { return this.db.prepare(sql).bind(...args); }
  private async one(sql: string, ...args: unknown[]): Promise<Row | undefined> { return (await this.q(sql, ...args).first<Row>()) ?? undefined; }
  private async many(sql: string, ...args: unknown[]): Promise<Row[]> { return (await this.q(sql, ...args).all<Row>()).results; }
  private async exec(sql: string, ...args: unknown[]): Promise<number> {
    const r = (await this.q(sql, ...args).run()) as { meta?: { changes?: number } } | undefined;
    return r?.meta?.changes ?? 0;
  }

  // ---- accounts, login, sessions
  async accountByEmail(e: string) { const r = await this.one("SELECT * FROM accounts WHERE email = ?", e); return r && toAccount(r); }
  async accountById(id: string) { const r = await this.one("SELECT * FROM accounts WHERE id = ?", id); return r && toAccount(r); }
  async putAccount(a: Account) {
    await this.exec(
      "INSERT INTO accounts (id, email, seat, stripe_customer_id, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, seat = excluded.seat, stripe_customer_id = excluded.stripe_customer_id, created_at = excluded.created_at, deleted_at = excluded.deleted_at",
      a.id, a.email, a.seat, n(a.stripeCustomerId), a.createdAt, n(a.deletedAt));
  }
  async putLoginToken(t: LoginToken) {
    await this.exec("INSERT INTO login_tokens (hash, email, expires_at, used) VALUES (?, ?, ?, ?) ON CONFLICT(hash) DO UPDATE SET email = excluded.email, expires_at = excluded.expires_at, used = excluded.used", t.hash, t.email, t.expiresAt, b(t.used));
  }
  // ONE statement: the token is claimed and read in the same step, so two concurrent verifies cannot both win.
  async consumeLoginToken(hash: string, now: number) {
    const r = await this.one("UPDATE login_tokens SET used = 1 WHERE hash = ? AND used = 0 AND expires_at >= ? RETURNING hash, email, expires_at", hash, now);
    return r ? { hash: String(r.hash), email: String(r.email), expiresAt: Number(r.expires_at), used: true } : undefined;
  }
  async loginRequestsSince(email: string, since: number) { const r = await this.one("SELECT COUNT(*) AS c FROM login_requests WHERE email = ? AND at >= ?", email, since); return Number(r?.c ?? 0); }
  async noteLoginRequest(email: string, at: number) { await this.exec("INSERT INTO login_requests (email, at) VALUES (?, ?)", email, at); }
  async putSession(s: Session) { await this.exec("INSERT INTO sessions (hash, account_id, expires_at) VALUES (?, ?, ?) ON CONFLICT(hash) DO UPDATE SET account_id = excluded.account_id, expires_at = excluded.expires_at", s.hash, s.accountId, s.expiresAt); }
  async sessionByHash(hash: string, now: number) {
    const r = await this.one("SELECT hash, account_id, expires_at FROM sessions WHERE hash = ? AND expires_at > ?", hash, now);
    return r ? { hash: String(r.hash), accountId: String(r.account_id), expiresAt: Number(r.expires_at) } : undefined;
  }
  async deleteSessionsFor(accountId: string) { await this.exec("DELETE FROM sessions WHERE account_id = ?", accountId); }

  // ---- domains
  async domainsFor(accountId: string) { return (await this.many("SELECT * FROM domains WHERE account_id = ? ORDER BY rowid", accountId)).map(toDomain); }
  async domainById(id: string) { const r = await this.one("SELECT * FROM domains WHERE id = ?", id); return r && toDomain(r); }
  async verifiedOwnerOf(domain: string) { const r = await this.one("SELECT * FROM domains WHERE domain = ? AND verified_at IS NOT NULL ORDER BY rowid LIMIT 1", domain); return r && toDomain(r); }
  async putDomain(d: DomainRow) {
    await this.exec("INSERT INTO domains (id, account_id, domain, verify_token, verified_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, domain = excluded.domain, verify_token = excluded.verify_token, verified_at = excluded.verified_at", d.id, d.accountId, d.domain, d.token, n(d.verifiedAt));
  }

  // ---- purchases, subscriptions, invoices, events, cards
  async putPurchase(p: Purchase) {
    await this.exec(
      "INSERT INTO purchases (id, account_id, product_id, domain, checkout_id, payment_intent, subscription_id, paid_at, amount_cents, deliverable_issued, refunded_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, product_id = excluded.product_id, domain = excluded.domain, checkout_id = excluded.checkout_id, payment_intent = excluded.payment_intent, subscription_id = excluded.subscription_id, paid_at = excluded.paid_at, amount_cents = excluded.amount_cents, deliverable_issued = excluded.deliverable_issued, refunded_cents = excluded.refunded_cents, status = excluded.status, created_at = excluded.created_at",
      p.id, p.accountId, p.productId, n(p.domain), p.checkoutId, n(p.paymentIntent), n(p.subscriptionId), n(p.paidAt), p.amountCents, b(p.deliverableIssued), p.refundedCents, p.status, n(p.createdAt));
  }
  async purchaseById(id: string) { const r = await this.one("SELECT * FROM purchases WHERE id = ?", id); return r && toPurchase(r); }
  async purchaseByCheckout(c: string) { const r = await this.one("SELECT * FROM purchases WHERE checkout_id = ?", c); return r && toPurchase(r); }
  async purchasesFor(accountId: string) { return (await this.many("SELECT * FROM purchases WHERE account_id = ? ORDER BY rowid", accountId)).map(toPurchase); }
  async putSubscription(s: Subscription) {
    await this.exec("INSERT INTO subscriptions (id, account_id, purchase_id, product_id, started_at, cancel_at, cancelled_at, plan_json, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET version = subscriptions.version + 1, account_id = excluded.account_id, purchase_id = excluded.purchase_id, product_id = excluded.product_id, started_at = excluded.started_at, cancel_at = excluded.cancel_at, cancelled_at = excluded.cancelled_at, plan_json = excluded.plan_json", s.id, s.accountId, s.purchaseId, s.productId, s.startedAt, n(s.cancelAt), n(s.cancelledAt), planJson(s));
  }
  async subscriptionById(id: string) { const r = await this.one("SELECT * FROM subscriptions WHERE id = ?", id); return r && toSub(r); }
  async subscriptionsFor(accountId: string) { return (await this.many("SELECT * FROM subscriptions WHERE account_id = ? ORDER BY rowid", accountId)).map(toSub); }
  async putInvoice(i: Invoice) {
    await this.exec("INSERT INTO invoices (id, account_id, purchase_id, number, product_id, amount_cents, issued_at, stripe_event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, purchase_id = excluded.purchase_id, number = excluded.number, product_id = excluded.product_id, amount_cents = excluded.amount_cents, issued_at = excluded.issued_at, stripe_event_id = excluded.stripe_event_id", i.id, i.accountId, n(i.purchaseId), i.number, i.productId, i.amountCents, i.issuedAt, i.stripeEventId);
  }
  async invoicesFor(accountId: string) { return (await this.many("SELECT * FROM invoices WHERE account_id = ? ORDER BY rowid", accountId)).map(toInvoice); }
  async invoiceById(id: string) { const r = await this.one("SELECT * FROM invoices WHERE id = ?", id); return r && toInvoice(r); }
  // Gap-free, atomic: one UPSERT...RETURNING on the single-row counter (migration 0004).
  async nextInvoiceNumber() {
    const r = await this.one("INSERT INTO invoice_seq (id, n) VALUES (1, 1) ON CONFLICT(id) DO UPDATE SET n = n + 1 RETURNING n");
    return `TT-${String(Number(r?.n)).padStart(6, "0")}`;
  }
  async claimEvent(eventId: string) { return (await this.exec("INSERT INTO stripe_events (id, at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING", eventId, Date.now())) === 1; }
  async putCard(c: ReviewCard) {
    await this.exec("INSERT INTO review_cards (id, account_id, purchase_id, kind, reason, created_at, resolved) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, purchase_id = excluded.purchase_id, kind = excluded.kind, reason = excluded.reason, created_at = excluded.created_at, resolved = excluded.resolved", c.id, c.accountId, c.purchaseId, c.kind, c.reason, c.createdAt, b(c.resolved));
  }
  async openCards() { return (await this.many("SELECT * FROM review_cards WHERE resolved = 0 ORDER BY rowid")).map(toCard); }

  // ---- API keys
  async putKey(k: ApiKey) {
    await this.exec("INSERT INTO api_keys (id, account_id, key_hash, scopes, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, key_hash = excluded.key_hash, scopes = excluded.scopes, created_at = excluded.created_at, revoked_at = excluded.revoked_at", k.id, k.accountId, k.hash, k.scopes.join(","), k.createdAt, n(k.revokedAt));
  }
  async keysFor(accountId: string) { return (await this.many("SELECT * FROM api_keys WHERE account_id = ? ORDER BY rowid", accountId)).map(toKey); }
  async keyById(id: string) { const r = await this.one("SELECT * FROM api_keys WHERE id = ?", id); return r && toKey(r); }
  async keyByHash(hash: string) { const r = await this.one("SELECT * FROM api_keys WHERE key_hash = ?", hash); return r && toKey(r); }

  // ---- agent door (C7)
  async creditBalance(accountId: string) { const r = await this.one("SELECT COALESCE(SUM(delta), 0) AS bal FROM credit_ledger WHERE account_id = ?", accountId); return Number(r?.bal ?? 0); }
  // THE ATOMIC DEBIT. One conditional statement: the ledger row is inserted only if the balance after it is >= 0, and
  // the post-insert balance comes back from the same statement. Two concurrent debits cannot both pass the check
  // (D1 serialises writes per database and this is a single write). No row back = refused (insufficient, or this
  // (reason, ref) was already applied, which keeps a replayed top-up from granting twice).
  async creditApply(accountId: string, delta: number, reason: CreditEntry["reason"], ref: string, at: number) {
    const id = `ent_${crypto.randomUUID().replace(/-/g, "")}`;
    const r = await this.one(
      "INSERT INTO credit_ledger (id, account_id, delta, reason, ref, at) SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE (SELECT COALESCE(SUM(delta), 0) FROM credit_ledger WHERE account_id = ?2) + ?3 >= 0 ON CONFLICT(reason, ref) DO NOTHING RETURNING (SELECT COALESCE(SUM(delta), 0) FROM credit_ledger WHERE account_id = ?2) AS bal",
      id, accountId, delta, reason, ref, at);
    return r ? Number(r.bal) : undefined;
  }
  async creditEntries(accountId: string) { return (await this.many("SELECT * FROM credit_ledger WHERE account_id = ? ORDER BY rowid", accountId)).map(toEntry); }
  async putCreditOrder(o: CreditOrder) {
    await this.exec("INSERT INTO credit_orders (id, account_id, checkout_id, pack_id, credits, paid) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, checkout_id = excluded.checkout_id, pack_id = excluded.pack_id, credits = excluded.credits, paid = excluded.paid", o.id, o.accountId, o.checkoutId, o.packId, o.credits, b(o.paid));
  }
  async creditOrderByCheckout(checkoutId: string) { const r = await this.one("SELECT * FROM credit_orders WHERE checkout_id = ?", checkoutId); return r && toOrder(r); }
  async putReceipt(r: AgentReceipt) {
    await this.exec("INSERT INTO agent_receipts (id, tool, key_id, account_id, at, input_sha, output_sha, credits, mode, sig, idem, kid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET tool = excluded.tool, key_id = excluded.key_id, account_id = excluded.account_id, at = excluded.at, input_sha = excluded.input_sha, output_sha = excluded.output_sha, credits = excluded.credits, mode = excluded.mode, sig = excluded.sig, idem = excluded.idem, kid = excluded.kid", r.id, r.tool, r.keyId, r.accountId, r.at, r.inputSha, r.outputSha, r.credits, r.mode, r.sig, n(r.idem), n(r.kid));
  }
  async receiptById(id: string) { const r = await this.one("SELECT * FROM agent_receipts WHERE id = ?", id); return r && toReceipt(r); }
  async receiptByIdem(keyId: string, idem: string) { const r = await this.one("SELECT * FROM agent_receipts WHERE key_id = ? AND idem = ?", keyId, idem); return r && toReceipt(r); }
  async callsSince(keyId: string, since: number) { const r = await this.one("SELECT COUNT(*) AS c FROM agent_calls WHERE key_id = ? AND at >= ?", keyId, since); return Number(r?.c ?? 0); }
  async noteCall(keyId: string, at: number) { await this.exec("INSERT INTO agent_calls (key_id, at) VALUES (?, ?)", keyId, at); }

  // ---- f345 parity block: every Store method MemoryStore has, implemented against the existing migrations (no new migration).
  // Each atomic method is ONE statement (changes === 1 is the win signal); each list carries the same ORDER as MemoryStore.
  // Purchases
  // f236 compare-and-set: UPDATE ... WHERE id = ? AND status = ? [AND refunded_cents = ?]. The whole row is written (created_at included), exactly as MemoryStore replaces it.
  async casPurchase(p: Purchase, expected: Purchase["status"], expectedRefundedCents?: number) {
    const g = expectedRefundedCents !== undefined;
    const c = await this.exec("UPDATE purchases SET account_id = ?, product_id = ?, domain = ?, checkout_id = ?, payment_intent = ?, subscription_id = ?, paid_at = ?, amount_cents = ?, deliverable_issued = ?, refunded_cents = ?, status = ?, created_at = ? WHERE id = ? AND status = ?" + (g ? " AND refunded_cents = ?" : ""),
      p.accountId, p.productId, n(p.domain), p.checkoutId, n(p.paymentIntent), n(p.subscriptionId), n(p.paidAt), p.amountCents, b(p.deliverableIssued), p.refundedCents, p.status, n(p.createdAt), p.id, expected, ...(g ? [expectedRefundedCents] : []));
    return c === 1;
  }
  async purchaseByPaymentIntent(pi: string) { const r = await this.one("SELECT * FROM purchases WHERE payment_intent = ? ORDER BY rowid LIMIT 1", pi); return r && toPurchase(r); }
  // f234: pending reconciler and status counts. A row with no created_at counts as oldest.
  async pendingPurchasesBefore(cutoff: number) { return (await this.many("SELECT * FROM purchases WHERE status = 'pending' AND COALESCE(created_at, 0) <= ? ORDER BY COALESCE(created_at, 0), id", cutoff)).map(toPurchase); }
  async countByStatus(status: Purchase["status"]) { return Number((await this.one("SELECT COUNT(*) AS n FROM purchases WHERE status = ?", status))?.n ?? 0); }
  async paidPurchasesBefore(cutoff: number) {
    return (await this.many("SELECT * FROM purchases p WHERE p.paid_at IS NOT NULL AND p.paid_at <= ? AND p.status IN ('paid', 'refunded') AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.purchase_id = p.id) ORDER BY p.paid_at, p.id", cutoff)).map(toPurchase);
  }
  async paidWithoutSubscriptionBefore(cutoff: number, ids: string[]) {
    if (ids.length === 0) return [];
    return (await this.many(`SELECT * FROM purchases p WHERE p.status = 'paid' AND p.paid_at IS NOT NULL AND ? >= p.paid_at AND p.product_id IN (${ids.map(() => "?").join(",")}) AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.purchase_id = p.id) ORDER BY p.paid_at, p.id`, cutoff, ...ids)).map(toPurchase);
  }
  // Subscriptions. version starts at 1 on every insert path (MemoryStore's subVer), +1 on every write.
  async putSubscriptionOnce(s: Subscription) {
    return (await this.exec("INSERT INTO subscriptions (id, account_id, purchase_id, product_id, started_at, cancel_at, cancelled_at, plan_json, version) SELECT ?, ?, ?, ?, ?, ?, ?, ?, 1 WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE purchase_id = ? OR id = ?)",
      s.id, s.accountId, s.purchaseId, s.productId, s.startedAt, n(s.cancelAt), n(s.cancelledAt), planJson(s), s.purchaseId, s.id)) === 1;
  }
  async createSubscription(s: Subscription) {
    return (await this.exec("INSERT INTO subscriptions (id, account_id, purchase_id, product_id, started_at, cancel_at, cancelled_at, plan_json, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT(id) DO NOTHING",
      s.id, s.accountId, s.purchaseId, s.productId, s.startedAt, n(s.cancelAt), n(s.cancelledAt), planJson(s))) === 1;
  }
  async subscriptionByPurchase(pid: string) { const r = await this.one("SELECT * FROM subscriptions WHERE purchase_id = ? ORDER BY rowid LIMIT 1", pid); return r && toSub(r); }
  async subscriptionVersioned(id: string) { const r = await this.one("SELECT * FROM subscriptions WHERE id = ?", id); return r && { sub: toSub(r), version: Number(r.version) }; }
  async casSubscription(s: Subscription, expectedVersion: number) {
    return (await this.exec("UPDATE subscriptions SET account_id = ?, purchase_id = ?, product_id = ?, started_at = ?, cancel_at = ?, cancelled_at = ?, plan_json = ?, version = version + 1 WHERE id = ? AND version = ?",
      s.accountId, s.purchaseId, s.productId, s.startedAt, n(s.cancelAt), n(s.cancelledAt), planJson(s), s.id, expectedVersion)) === 1;
  }
  // Invoices (f203). `purchase_id IS ?` is NULL-safe equality, so an invoice with no purchase id behaves as in MemoryStore (undefined === undefined).
  async purchaseInvoiced(id: string) { return (await this.one("SELECT 1 AS x FROM invoices WHERE purchase_id = ? LIMIT 1", id)) !== undefined; }
  async putInvoiceOnce(i: Invoice) {
    return (await this.exec("INSERT INTO invoices (id, account_id, purchase_id, number, product_id, amount_cents, issued_at, stripe_event_id) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE purchase_id IS ?)",
      i.id, i.accountId, n(i.purchaseId), i.number, i.productId, i.amountCents, i.issuedAt, i.stripeEventId, n(i.purchaseId))) === 1;
  }
  // Claim lease (f242/f245, migration 0015): insert, or on conflict take over only an EXPIRED lease or renew our own. changes === 1 = we hold it.
  async acquireLease(key: string, owner: string, now: number, ttlMs: number) {
    return (await this.exec("INSERT INTO claim_leases (key, owner, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at WHERE claim_leases.expires_at <= ? OR claim_leases.owner = excluded.owner",
      key, owner, now + ttlMs, now)) === 1;
  }
  async releaseLease(key: string, owner: string) { await this.exec("DELETE FROM claim_leases WHERE key = ? AND owner = ?", key, owner); }
  // Held webhook facts (f194, migration 0006). takeFacts is ONE DELETE ... RETURNING; RETURNING order is undefined, so rows are sorted back into hold order by seq.
  async holdFact(key: string, fact: Record<string, unknown>) { await this.exec("INSERT INTO held_facts (key, fact) VALUES (?, ?)", key, JSON.stringify(fact)); }
  async heldFactKeys(prefix: string, after: string | undefined, limit: number) { // f356: ascending distinct keys after the cursor, bounded; substr (not LIKE) so a % or _ in a key is literal
    const rows = await this.many("SELECT DISTINCT key FROM held_facts WHERE substr(key, 1, ?) = ? AND key > ? ORDER BY key LIMIT ?", prefix.length, prefix, after ?? "", Math.max(0, limit));
    return rows.map((r) => String(r.key));
  }
  async takeFacts(key: string) {
    const rows = await this.many("DELETE FROM held_facts WHERE key = ? RETURNING seq, fact", key);
    return rows.sort((a, b) => Number(a.seq) - Number(b.seq)).map((r) => JSON.parse(String(r.fact)) as Record<string, unknown>);
  }
  // f243/f355 refund memo on held_facts (no migration; the row carries the memo JSON). Insert-if-absent is ONE statement; the swap is ONE conditional UPDATE/DELETE on the exact stored JSON,
  // so two callers over one D1 cannot both win. exec() here returns the changes count.
  async memoInsert(key: string, fact: Record<string, unknown>) {
    return (await this.exec("INSERT INTO held_facts (key, fact) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM held_facts WHERE key = ?)", key, JSON.stringify(fact), key)) === 1;
  }
  async memoPeek(key: string) { const r = await this.one("SELECT fact FROM held_facts WHERE key = ? ORDER BY seq LIMIT 1", key); return r ? (JSON.parse(String(r.fact)) as Record<string, unknown>) : undefined; }
  async memoSwap(key: string, expected: Record<string, unknown>, next: Record<string, unknown> | null) {
    const c = next === null ? await this.exec("DELETE FROM held_facts WHERE key = ? AND fact = ?", key, JSON.stringify(expected))
      : await this.exec("UPDATE held_facts SET fact = ? WHERE key = ? AND fact = ?", JSON.stringify(next), key, JSON.stringify(expected));
    return c === 1;
  }
  async memoList(prefix: string) {
    const rows = await this.many("SELECT key, fact FROM held_facts WHERE substr(key, 1, ?) = ? ORDER BY seq", prefix.length, prefix);
    return rows.map((r) => ({ key: String(r.key), fact: JSON.parse(String(r.fact)) as Record<string, unknown> }));
  }
  // Review cards and refund cases (migrations 0002, 0003). Upsert on id keeps the original position, as a Map.set does.
  async cardById(id: string) { const r = await this.one("SELECT * FROM review_cards WHERE id = ?", id); return r && toCard(r); }
  async allCards() { return (await this.many("SELECT * FROM review_cards ORDER BY rowid")).map(toCard); }
  async putRefundCase(r: RefundCase) {
    await this.exec("INSERT INTO refund_cases (id, account_id, purchase_id, product_name, amount_cents, reason, in_policy, status, created_at, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, purchase_id = excluded.purchase_id, product_name = excluded.product_name, amount_cents = excluded.amount_cents, reason = excluded.reason, in_policy = excluded.in_policy, status = excluded.status, created_at = excluded.created_at, decided_at = excluded.decided_at",
      r.id, r.accountId, r.purchaseId, r.productName, r.amountCents, r.reason, b(r.inPolicy), r.status, r.createdAt, n(r.decidedAt));
  }
  async refundCaseById(id: string) { const r = await this.one("SELECT * FROM refund_cases WHERE id = ?", id); return r && toRefundCase(r); }
  async refundCasesFor(purchaseId: string) { return (await this.many("SELECT * FROM refund_cases WHERE purchase_id = ? ORDER BY rowid", purchaseId)).map(toRefundCase); }
  // F48 abuse tracing (migration 0014). Prefix match on the non-secret key id; a length-8 prefix uses the substr(id,1,8) index.
  async keysByPrefix(prefix: string) {
    if (prefix.length === 8) return (await this.many("SELECT * FROM api_keys WHERE substr(id, 1, 8) = ? ORDER BY rowid", prefix)).map(toKey); // the exact expression api_keys_prefix indexes
    return (await this.many("SELECT * FROM api_keys WHERE substr(id, 1, ?) = ? ORDER BY rowid", prefix.length, prefix)).map(toKey);
  }
  async receiptsForKey(keyId: string, limit: number) { return (await this.many("SELECT * FROM agent_receipts WHERE key_id = ? ORDER BY at DESC, rowid LIMIT ?", keyId, Math.max(0, limit))).map(toReceipt); }

  // Account deletion: PII goes, financial records stay (tax law). All four writes in one D1 batch (a transaction), so a
  // failure half way leaves the account intact rather than half erased. Without batch support the order is
  // revoke keys, drop sessions, drop domains, then blank the account last, so a retry finishes the job.
  async anonymiseAccount(id: string, at: number) {
    const stmts = [
      this.q("UPDATE api_keys SET revoked_at = COALESCE(revoked_at, ?) WHERE account_id = ?", at, id),
      this.q("DELETE FROM sessions WHERE account_id = ?", id),
      this.q("DELETE FROM domains WHERE account_id = ?", id),
      this.q("UPDATE accounts SET email = ?, stripe_customer_id = NULL, deleted_at = ? WHERE id = ?", `deleted+${id}@deleted.invalid`, at, id),
    ];
    if (this.db.batch) await this.db.batch(stmts);
    else for (const s of stmts) await s.run();
  }
}
