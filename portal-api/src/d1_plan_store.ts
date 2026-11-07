// D1 adapter for the plan-bearing chain (f172): accounts, purchases, subscriptions (with PlanState in subscriptions.plan_json).
// Invoices are durable too (f192), and so are held webhook facts (f194) and the webhook event claim (f197). Every other Store method is inherited from MemoryStore and is NOT durable here: the full D1Store (login, sessions, domains,
// events, cards, keys) lives on the web/f13_c2_d1store stack and has not been merged into this base. This class exists
// so plan, period and minimum term can be proven to survive a restart against the real schema; it is not wired into the Worker.
import { MemoryStore, type Account, type Invoice, type Purchase, type Subscription } from "./store.ts";
import type { D1Like } from "./env.ts";
import type { PlanState } from "./plan_change.ts";

type Row = Record<string, unknown>;
const num = (v: unknown): number | undefined => (v === null || v === undefined || v === "" ? undefined : Number(v));
const str = (v: unknown): string | undefined => (v === null || v === undefined ? undefined : String(v));
const n = (v: unknown) => (v === undefined ? null : v);
const clean = <T extends object>(o: T): T => { for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k]; return o; };

const toAccount = (r: Row): Account => clean({ id: String(r.id), email: String(r.email), seat: String(r.seat), stripeCustomerId: str(r.stripe_customer_id), createdAt: Number(r.created_at), deletedAt: num(r.deleted_at) });
const toPurchase = (r: Row): Purchase => clean({ id: String(r.id), accountId: String(r.account_id), productId: String(r.product_id), domain: str(r.domain), checkoutId: String(r.checkout_id), paymentIntent: str(r.payment_intent), subscriptionId: str(r.subscription_id), paidAt: num(r.paid_at), amountCents: Number(r.amount_cents), deliverableIssued: Number(r.deliverable_issued) === 1, refundedCents: Number(r.refunded_cents), status: String(r.status) as Purchase["status"], createdAt: num(r.created_at) });
const toSub = (r: Row): Subscription => {
  const s: Subscription = clean({ id: String(r.id), accountId: String(r.account_id), purchaseId: String(r.purchase_id), productId: String(r.product_id), startedAt: Number(r.started_at), cancelAt: num(r.cancel_at), cancelledAt: num(r.cancelled_at) });
  if (r.plan_json !== null && r.plan_json !== undefined) s.plan = JSON.parse(String(r.plan_json)) as PlanState;
  return s;
};

const toInvoice = (r: Row): Invoice => clean({ id: String(r.id), accountId: String(r.account_id), purchaseId: str(r.purchase_id), number: String(r.number), productId: String(r.product_id), amountCents: Number(r.amount_cents), issuedAt: Number(r.issued_at), stripeEventId: String(r.stripe_event_id) });

export class D1PlanStore extends MemoryStore {
  private db: D1Like;
  constructor(db: D1Like) { super(); this.db = db; }
  private one(sql: string, ...a: unknown[]) { return this.db.prepare(sql).bind(...a).first<Row>().then((r) => r ?? undefined); }
  private many(sql: string, ...a: unknown[]) { return this.db.prepare(sql).bind(...a).all<Row>().then((r) => r.results); }
  private exec(sql: string, ...a: unknown[]) { return this.db.prepare(sql).bind(...a).run(); }

  override async accountByEmail(e: string) { const r = await this.one("SELECT * FROM accounts WHERE email = ?", e); return r && toAccount(r); }
  override async accountById(id: string) { const r = await this.one("SELECT * FROM accounts WHERE id = ?", id); return r && toAccount(r); }
  override async putAccount(a: Account) {
    await this.exec("INSERT INTO accounts (id, email, seat, stripe_customer_id, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, seat = excluded.seat, stripe_customer_id = excluded.stripe_customer_id, created_at = excluded.created_at, deleted_at = excluded.deleted_at",
      a.id, a.email, a.seat, n(a.stripeCustomerId), a.createdAt, n(a.deletedAt));
  }
  override async putPurchase(p: Purchase) {
    await this.exec("INSERT INTO purchases (id, account_id, product_id, domain, checkout_id, payment_intent, subscription_id, paid_at, amount_cents, deliverable_issued, refunded_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, product_id = excluded.product_id, domain = excluded.domain, checkout_id = excluded.checkout_id, payment_intent = excluded.payment_intent, subscription_id = excluded.subscription_id, paid_at = excluded.paid_at, amount_cents = excluded.amount_cents, deliverable_issued = excluded.deliverable_issued, refunded_cents = excluded.refunded_cents, status = excluded.status, created_at = COALESCE(purchases.created_at, excluded.created_at)",
      p.id, p.accountId, p.productId, n(p.domain), p.checkoutId, n(p.paymentIntent), n(p.subscriptionId), n(p.paidAt), p.amountCents, p.deliverableIssued ? 1 : 0, p.refundedCents, p.status, n(p.createdAt));
  }
  // f236: ONE statement, UPDATE ... WHERE id = ? AND status = ?; changes === 1 means THIS call made the transition. No migration: id and status already exist.
  override async casPurchase(p: Purchase, expected: Purchase["status"]) {
    const r = await this.exec("UPDATE purchases SET account_id = ?, product_id = ?, domain = ?, checkout_id = ?, payment_intent = ?, subscription_id = ?, paid_at = ?, amount_cents = ?, deliverable_issued = ?, refunded_cents = ?, status = ? WHERE id = ? AND status = ?",
      p.accountId, p.productId, n(p.domain), p.checkoutId, n(p.paymentIntent), n(p.subscriptionId), n(p.paidAt), p.amountCents, p.deliverableIssued ? 1 : 0, p.refundedCents, p.status, p.id, expected);
    return r.meta.changes === 1;
  }
  override async purchaseById(id: string) { const r = await this.one("SELECT * FROM purchases WHERE id = ?", id); return r && toPurchase(r); }
  override async purchaseByCheckout(c: string) { const r = await this.one("SELECT * FROM purchases WHERE checkout_id = ?", c); return r && toPurchase(r); }
  override async purchaseByPaymentIntent(pi: string) { const r = await this.one("SELECT * FROM purchases WHERE payment_intent = ? ORDER BY rowid LIMIT 1", pi); return r && toPurchase(r); }
  override async purchasesFor(id: string) { return (await this.many("SELECT * FROM purchases WHERE account_id = ? ORDER BY rowid", id)).map(toPurchase); }
  async allPurchases() { return (await this.many("SELECT * FROM purchases ORDER BY rowid")).map(toPurchase); }
  override async putSubscription(s: Subscription) {
    await this.exec("INSERT INTO subscriptions (id, account_id, purchase_id, product_id, started_at, cancel_at, cancelled_at, plan_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, purchase_id = excluded.purchase_id, product_id = excluded.product_id, started_at = excluded.started_at, cancel_at = excluded.cancel_at, cancelled_at = excluded.cancelled_at, plan_json = excluded.plan_json",
      s.id, s.accountId, s.purchaseId, s.productId, s.startedAt, n(s.cancelAt), n(s.cancelledAt), s.plan === undefined ? null : JSON.stringify(s.plan));
  }
  // f237. ONE statement: INSERT ... SELECT ... WHERE NOT EXISTS (a subscription for this purchase, or this id); changes === 1 means THIS call wrote the row.
  override async putSubscriptionOnce(s: Subscription) {
    const r = await this.exec("INSERT INTO subscriptions (id, account_id, purchase_id, product_id, started_at, cancel_at, cancelled_at, plan_json) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE purchase_id = ? OR id = ?)",
      s.id, s.accountId, s.purchaseId, s.productId, s.startedAt, n(s.cancelAt), n(s.cancelledAt), n(s.plan === undefined ? undefined : JSON.stringify(s.plan)), s.purchaseId, s.id);
    return r.meta.changes === 1;
  }
  override async subscriptionByPurchase(pid: string) { const r = await this.one("SELECT * FROM subscriptions WHERE purchase_id = ? ORDER BY rowid LIMIT 1", pid); return r && toSub(r); }
  override async paidWithoutSubscriptionBefore(cutoff: number, ids: string[]) {
    if (ids.length === 0) return [];
    return (await this.many(`SELECT * FROM purchases p WHERE p.status = 'paid' AND p.paid_at IS NOT NULL AND ? >= p.paid_at AND p.product_id IN (${ids.map(() => "?").join(",")}) AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.purchase_id = p.id) ORDER BY p.paid_at, p.id`, cutoff, ...ids)).map(toPurchase);
  }
  override async subscriptionById(id: string) { const r = await this.one("SELECT * FROM subscriptions WHERE id = ?", id); return r && toSub(r); }
  override async subscriptionsFor(id: string) { return (await this.many("SELECT * FROM subscriptions WHERE account_id = ? ORDER BY rowid", id)).map(toSub); }
  // Invoices (f192, migration 0005). Upsert on id; the UNIQUE number and the partial UNIQUE (purchase_id, stripe_event_id) make D1 throw where MemoryStore throws.
  override async putInvoice(i: Invoice) {
    await this.exec("INSERT INTO invoices (id, account_id, purchase_id, number, product_id, amount_cents, issued_at, stripe_event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, purchase_id = excluded.purchase_id, number = excluded.number, product_id = excluded.product_id, amount_cents = excluded.amount_cents, issued_at = excluded.issued_at, stripe_event_id = excluded.stripe_event_id",
      i.id, i.accountId, n(i.purchaseId), i.number, i.productId, i.amountCents, i.issuedAt, i.stripeEventId);
  }
  override async invoicesFor(id: string) { return (await this.many("SELECT * FROM invoices WHERE account_id = ? ORDER BY rowid", id)).map(toInvoice); }
  override async invoiceById(id: string) { const r = await this.one("SELECT * FROM invoices WHERE id = ?", id); return r && toInvoice(r); }
  // f203. putInvoiceOnce is ONE statement: INSERT ... SELECT ... WHERE NOT EXISTS (invoice for this purchase); changes === 1 means THIS call wrote the invoice.
  override async purchaseInvoiced(id: string) { return (await this.one("SELECT 1 AS x FROM invoices WHERE purchase_id = ? LIMIT 1", id)) !== undefined; }
  override async putInvoiceOnce(i: Invoice) {
    const r = await this.exec("INSERT INTO invoices(id, account_id, purchase_id, number, product_id, amount_cents, issued_at, stripe_event_id) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE purchase_id = ?)",
      i.id, i.accountId, i.purchaseId ?? null, i.number, i.productId, i.amountCents, i.issuedAt, i.stripeEventId, i.purchaseId ?? null);
    return r.meta.changes === 1;
  }
  override async paidPurchasesBefore(cutoff: number) {
    return (await this.many("SELECT * FROM purchases p WHERE p.paid_at IS NOT NULL AND p.paid_at <= ? AND p.status IN ('paid', 'refunded') AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.purchase_id = p.id) ORDER BY p.paid_at, p.id", cutoff)).map(toPurchase);
  }
  override async pendingPurchasesBefore(cutoff: number) {
    return (await this.many("SELECT * FROM purchases WHERE status = 'pending' AND COALESCE(created_at, 0) <= ? ORDER BY COALESCE(created_at, 0), id", cutoff)).map(toPurchase);
  }
  override async countByStatus(status: Purchase["status"]) {
    return Number((await this.many("SELECT COUNT(*) AS n FROM purchases WHERE status = ?", status))[0]?.n ?? 0);
  }
  // Gap-free and atomic: one UPSERT...RETURNING on the single-row counter. Survives a restart; two stores over one D1 never repeat a number.
  override async nextInvoiceNumber() {
    const r = await this.one("INSERT INTO invoice_seq (id, n) VALUES (1, 1) ON CONFLICT(id) DO UPDATE SET n = n + 1 RETURNING n");
    return `TT-${String(Number(r?.n)).padStart(6, "0")}`;
  }
  // Held webhook facts (f194, migration 0006). holdFact appends in hold order; takeFacts is ONE statement (DELETE ... RETURNING), so two takers over one D1 never both
  // receive a fact (a SELECT then DELETE would). RETURNING order is not defined by SQL, so the rows carry seq and are sorted back into hold order here.
  override async holdFact(key: string, fact: Record<string, unknown>) { await this.exec("INSERT INTO held_facts (key, fact) VALUES (?, ?)", key, JSON.stringify(fact)); }
  override async takeFacts(key: string) {
    const rows = await this.many("DELETE FROM held_facts WHERE key = ? RETURNING seq, fact", key);
    return rows.sort((a, b) => Number(a.seq) - Number(b.seq)).map((r) => JSON.parse(String(r.fact)) as Record<string, unknown>);
  }
  // Webhook event claim (f197). stripe_events (id PRIMARY KEY) already exists in migration 0002, so no new migration is needed. ONE statement: INSERT OR IGNORE, then
  // meta.changes === 1 means THIS call inserted the row. Two deliveries of one event id, on any number of store objects over one D1, cannot both see 1 (a SELECT then INSERT could).
  // The claim is durable the moment it is written: see test/claim_contract.test.ts for the chosen replay-after-crash behaviour (at-most-once, documented).
  override async claimEvent(id: string) {
    const r = await this.exec("INSERT OR IGNORE INTO stripe_events (id, at) VALUES (?, ?)", id, Date.now());
    return r.meta.changes === 1;
  }
  // PII goes, the financial rows stay (same rule as MemoryStore). The in-memory parts (domains, keys, sessions) go through super.
  override async anonymiseAccount(id: string, at: number) {
    const a = await this.accountById(id); if (!a) return;
    await super.putAccount(a); await super.anonymiseAccount(id, at);
    await this.putAccount((await super.accountById(id))!);
  }
}
