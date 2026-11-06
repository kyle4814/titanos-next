// D1 adapter for the plan-bearing chain (f172): accounts, purchases, subscriptions (with PlanState in subscriptions.plan_json).
// Every other Store method is inherited from MemoryStore and is NOT durable here: the full D1Store (login, sessions, domains,
// invoices, events, cards, keys) lives on the web/f13_c2_d1store stack and has not been merged into this base. This class exists
// so plan, period and minimum term can be proven to survive a restart against the real schema; it is not wired into the Worker.
import { MemoryStore, type Account, type Purchase, type Subscription } from "./store.ts";
import type { D1Like } from "./env.ts";
import type { PlanState } from "./plan_change.ts";

type Row = Record<string, unknown>;
const num = (v: unknown): number | undefined => (v === null || v === undefined || v === "" ? undefined : Number(v));
const str = (v: unknown): string | undefined => (v === null || v === undefined ? undefined : String(v));
const n = (v: unknown) => (v === undefined ? null : v);
const clean = <T extends object>(o: T): T => { for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k]; return o; };

const toAccount = (r: Row): Account => clean({ id: String(r.id), email: String(r.email), seat: String(r.seat), stripeCustomerId: str(r.stripe_customer_id), createdAt: Number(r.created_at), deletedAt: num(r.deleted_at) });
const toPurchase = (r: Row): Purchase => clean({ id: String(r.id), accountId: String(r.account_id), productId: String(r.product_id), domain: str(r.domain), checkoutId: String(r.checkout_id), paymentIntent: str(r.payment_intent), subscriptionId: str(r.subscription_id), paidAt: num(r.paid_at), amountCents: Number(r.amount_cents), deliverableIssued: Number(r.deliverable_issued) === 1, refundedCents: Number(r.refunded_cents), status: String(r.status) as Purchase["status"] });
const toSub = (r: Row): Subscription => {
  const s: Subscription = clean({ id: String(r.id), accountId: String(r.account_id), purchaseId: String(r.purchase_id), productId: String(r.product_id), startedAt: Number(r.started_at), cancelAt: num(r.cancel_at), cancelledAt: num(r.cancelled_at) });
  if (r.plan_json !== null && r.plan_json !== undefined) s.plan = JSON.parse(String(r.plan_json)) as PlanState;
  return s;
};

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
    await this.exec("INSERT INTO purchases (id, account_id, product_id, domain, checkout_id, payment_intent, subscription_id, paid_at, amount_cents, deliverable_issued, refunded_cents, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, product_id = excluded.product_id, domain = excluded.domain, checkout_id = excluded.checkout_id, payment_intent = excluded.payment_intent, subscription_id = excluded.subscription_id, paid_at = excluded.paid_at, amount_cents = excluded.amount_cents, deliverable_issued = excluded.deliverable_issued, refunded_cents = excluded.refunded_cents, status = excluded.status",
      p.id, p.accountId, p.productId, n(p.domain), p.checkoutId, n(p.paymentIntent), n(p.subscriptionId), n(p.paidAt), p.amountCents, p.deliverableIssued ? 1 : 0, p.refundedCents, p.status);
  }
  override async purchaseById(id: string) { const r = await this.one("SELECT * FROM purchases WHERE id = ?", id); return r && toPurchase(r); }
  override async purchaseByCheckout(c: string) { const r = await this.one("SELECT * FROM purchases WHERE checkout_id = ?", c); return r && toPurchase(r); }
  override async purchaseByPaymentIntent(pi: string) { const r = await this.one("SELECT * FROM purchases WHERE payment_intent = ? ORDER BY rowid LIMIT 1", pi); return r && toPurchase(r); }
  override async purchasesFor(id: string) { return (await this.many("SELECT * FROM purchases WHERE account_id = ? ORDER BY rowid", id)).map(toPurchase); }
  async allPurchases() { return (await this.many("SELECT * FROM purchases ORDER BY rowid")).map(toPurchase); }
  override async putSubscription(s: Subscription) {
    await this.exec("INSERT INTO subscriptions (id, account_id, purchase_id, product_id, started_at, cancel_at, cancelled_at, plan_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET version = subscriptions.version + 1, account_id = excluded.account_id, purchase_id = excluded.purchase_id, product_id = excluded.product_id, started_at = excluded.started_at, cancel_at = excluded.cancel_at, cancelled_at = excluded.cancelled_at, plan_json = excluded.plan_json",
      s.id, s.accountId, s.purchaseId, s.productId, s.startedAt, n(s.cancelAt), n(s.cancelledAt), s.plan === undefined ? null : JSON.stringify(s.plan));
  }
  override async createSubscription(s: Subscription) {
    const r = (await this.exec("INSERT INTO subscriptions (id, account_id, purchase_id, product_id, started_at, cancel_at, cancelled_at, plan_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
      s.id, s.accountId, s.purchaseId, s.productId, s.startedAt, n(s.cancelAt), n(s.cancelledAt), s.plan === undefined ? null : JSON.stringify(s.plan))) as { meta?: { changes?: number } };
    return Number(r?.meta?.changes ?? 0) === 1;
  }
  override async subscriptionById(id: string) { const r = await this.one("SELECT * FROM subscriptions WHERE id = ?", id); return r && toSub(r); }
  override async subscriptionVersioned(id: string) { const r = await this.one("SELECT * FROM subscriptions WHERE id = ?", id); return r && { sub: toSub(r), version: Number(r.version) }; }
  // Compare-and-set (f175): ONE statement, so the check and the write cannot be separated by another writer. 0 rows changed = lost the race.
  override async casSubscription(s: Subscription, expectedVersion: number) {
    const r = (await this.exec("UPDATE subscriptions SET account_id = ?, purchase_id = ?, product_id = ?, started_at = ?, cancel_at = ?, cancelled_at = ?, plan_json = ?, version = version + 1 WHERE id = ? AND version = ?",
      s.accountId, s.purchaseId, s.productId, s.startedAt, n(s.cancelAt), n(s.cancelledAt), s.plan === undefined ? null : JSON.stringify(s.plan), s.id, expectedVersion)) as { meta?: { changes?: number } };
    return Number(r?.meta?.changes ?? 0) === 1;
  }
  override async subscriptionsFor(id: string) { return (await this.many("SELECT * FROM subscriptions WHERE account_id = ? ORDER BY rowid", id)).map(toSub); }
  // PII goes, the financial rows stay (same rule as MemoryStore). The in-memory parts (domains, keys, sessions) go through super.
  override async anonymiseAccount(id: string, at: number) {
    const a = await this.accountById(id); if (!a) return;
    await super.putAccount(a); await super.anonymiseAccount(id, at);
    await this.putAccount((await super.accountById(id))!);
  }
}
