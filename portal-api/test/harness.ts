import { handle } from "../src/index.ts";
import { MemoryStore, type Store, type Subscription } from "../src/store.ts";
import { D1PlanStore } from "../src/d1_plan_store.ts";
import { FakeD1 } from "./fake_d1.ts";
import { MockBilling, signStripePayload, StripeHttpBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { MockMailer, type Deps } from "../src/service.ts";

export const RECEIPT_SECRET = "rcpt_test_fixture_secret";
export class MockModel { calls: { apiKey: string; prompt: string }[] = []; fail = false; async complete(o: { apiKey: string; prompt: string }) { this.calls.push(o); if (this.fail) throw new Error("boom"); return "MOCK EXPLANATION"; } }
export const SECRET = "whsec_test_fixture";
export const T0 = Date.UTC(2026, 10, 6, 0, 0, 0);
// The stores the suites run against; make() also accepts a ready-made Store adapter (f171/f212: D1Store over FakeD1). (f172) D1 = D1PlanStore over FakeD1 (real SQLite, real migrations, foreign keys ON).
export type StoreKind = "memory" | "d1";
export const STORE_KINDS: StoreKind[] = ["memory", "d1"];
export function newStore(kind: StoreKind, d1?: FakeD1): MemoryStore { return kind === "d1" ? new D1PlanStore(d1 ?? new FakeD1()) : new MemoryStore(); }
export const allPurchases = async (s: MemoryStore) => ("allPurchases" in s ? await (s as D1PlanStore).allPurchases() : [...s.purchases.values()]);
// Seed a subscription the way a paid checkout would leave it: the purchase row first (subscriptions.purchase_id is a foreign key in D1).
export async function seedSub(s: Store, accountId: string, sub: Omit<Subscription, "accountId">) {
  await s.putPurchase({ id: sub.purchaseId, accountId, productId: sub.productId, checkoutId: `cs_${sub.purchaseId}`, amountCents: 0, deliverableIssued: false, refundedCents: 0, status: "paid" });
  await s.putSubscription({ ...sub, accountId });
}
export function make(kind: StoreKind | Store = "memory", d1?: FakeD1) {
  const clock = { t: T0 };
  const store = (typeof kind === "string" ? newStore(kind, d1) : kind) as MemoryStore, billing = new MockBilling(), dns = fakeResolver({}), mailer = new MockMailer(), model = new MockModel();
  const deps: Deps = { store, billing, dns, mailer, now: () => clock.t, siteOrigin: "https://titanos.tech", webhookSecret: SECRET, receiptSecret: RECEIPT_SECRET, model };
  const req = (method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) =>
    handle(new Request("https://api.test" + path, { method, headers: { ...(opts.body === undefined ? {} : { "content-type": "application/json" }), ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.headers ?? {}) }, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }), { TITANOS_SITE_ORIGIN: "https://titanos.tech" }, deps);
  const j = async (r: Response) => (await r.json()) as any;
  async function login(email: string) {
    await req("POST", "/auth/request", { body: { email } });
    const mail = mailer.outbox.filter((m) => m.to === email.trim().toLowerCase()).at(-1)!;
    const token = mail.text.match(/token=(ll_[0-9a-f]+)/)![1];
    const r = await j(await req("POST", "/auth/verify", { body: { token } }));
    return { session: r.session as string, account: r.account, loginToken: token };
  }
  async function verifiedDomain(session: string, domain: string) {
    const d = await j(await req("POST", "/domains", { token: session, body: { domain } }));
    dns.zone[d.record.name] = [d.record.value];
    const v = await j(await req("POST", `/domains/${d.id}/verify`, { token: session }));
    return { d, v };
  }
  let ev = 0;
  async function webhook(type: string, object: Record<string, unknown>, opts: { id?: string; secret?: string; t?: number } = {}) {
    const payload = JSON.stringify({ id: opts.id ?? `evt_${++ev}`, type, data: { object } });
    const sig = await signStripePayload(payload, opts.secret ?? SECRET, opts.t ?? Math.floor(clock.t / 1000));
    return handle(new Request("https://api.test/stripe/webhook", { method: "POST", headers: { "stripe-signature": sig }, body: payload }), {}, deps);
  }
  // pay a checkout the way Stripe would: the purchase's checkout id comes from the mock provider's recorded call
  async function pay(productId: string, accountId?: string) {
    const all = accountId ? await store.purchasesFor(accountId) : await allPurchases(store); // accountId = interface-only path (any adapter)
    const purchase = all.filter((p) => p.productId === productId && p.status === "pending").at(-1)!;
    const sub = ["monitor_monthly", "monitor_annual", "ai_growth", "ai_ops", "ai_embedded", "leads_retainer"].includes(productId);
    const r = await webhook("checkout.session.completed", { id: purchase.checkoutId, payment_status: "paid", payment_intent: `pi_${purchase.id}`, customer: `cus_${purchase.accountId}`, ...(sub ? { subscription: `sub_${purchase.id}` } : {}) });
    return { purchase, res: r };
  }
  return { model, clock, store, billing, dns, mailer, deps, req, j, login, verifiedDomain, webhook, pay };
}
export { StripeHttpBilling };
