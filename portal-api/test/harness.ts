import { handle } from "../src/index.ts";
import { MemoryStore } from "../src/store.ts";
import { MockBilling, signStripePayload, StripeHttpBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { MockMailer, type Deps } from "../src/service.ts";

export const RECEIPT_SECRET = "rcpt_test_fixture_secret";
export class MockModel { calls: { apiKey: string; prompt: string }[] = []; fail = false; async complete(o: { apiKey: string; prompt: string }) { this.calls.push(o); if (this.fail) throw new Error("boom"); return "MOCK EXPLANATION"; } }
export const SECRET = "whsec_test_fixture";
export const T0 = Date.UTC(2026, 10, 6, 0, 0, 0);
export function make() {
  const clock = { t: T0 };
  const store = new MemoryStore(), billing = new MockBilling(), dns = fakeResolver({}), mailer = new MockMailer(), model = new MockModel();
  const deps: Deps = { store, billing, dns, mailer, now: () => clock.t, siteOrigin: "https://titanos.tech", webhookSecret: SECRET, receiptSecret: RECEIPT_SECRET, model };
  const req = (method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) =>
    handle(new Request("https://api.test" + path, { method, headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.headers ?? {}) }, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }), { TITANOS_SITE_ORIGIN: "https://titanos.tech" }, deps);
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
  async function pay(productId: string) {
    const purchase = [...store.purchases.values()].filter((p) => p.productId === productId && p.status === "pending").at(-1)!;
    const sub = ["monitor_monthly", "monitor_annual", "ai_growth", "ai_ops", "ai_embedded", "leads_retainer"].includes(productId);
    const r = await webhook("checkout.session.completed", { id: purchase.checkoutId, payment_status: "paid", payment_intent: `pi_${purchase.id}`, customer: `cus_${purchase.accountId}`, ...(sub ? { subscription: `sub_${purchase.id}` } : {}) });
    return { purchase, res: r };
  }
  return { model, clock, store, billing, dns, mailer, deps, req, j, login, verifiedDomain, webhook, pay };
}
export { StripeHttpBilling };
