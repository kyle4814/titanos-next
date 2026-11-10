import { hmacSha256Hex, timingSafeEqual, randomToken } from "./util.ts";

// ---- webhook signature (Stripe scheme: header "t=<unix>,v1=<hex hmac of `${t}.${payload}`>") ----
export async function verifyStripeSignature(payload: string, header: string | null, secret: string | undefined, nowSec: number, toleranceSec = 300): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  const t = Number(parts["t"]);
  const v1 = header.split(",").map((p) => p.trim()).filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!Number.isFinite(t) || v1.length === 0) return false;
  if (Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = await hmacSha256Hex(secret, `${t}.${payload}`);
  return v1.some((s) => timingSafeEqual(s, expected));
}
export async function signStripePayload(payload: string, secret: string, t: number): Promise<string> {
  return `t=${t},v1=${await hmacSha256Hex(secret, `${t}.${payload}`)}`;
}

// ---- provider interface: the portal talks to this, never to Stripe directly ----
export interface CheckoutRequest {
  email: string; mode: "payment" | "subscription"; name: string; amountCents: number; interval?: "month" | "year";
  accountId: string; productId: string; successUrl: string; cancelUrl: string; idempotencyKey: string;
}
// f210: what the portal needs from a Checkout Session to decide a stuck purchase. status: open (customer can still pay), complete (finished; check paymentStatus), expired (can never be paid).
export interface SessionInfo {
  id: string; status: "open" | "complete" | "expired"; paymentStatus: "paid" | "unpaid" | "no_payment_required";
  paymentIntent?: string; customer?: string; subscription?: string | Record<string, unknown>;
}
export interface BillingProvider {
  retrieveSession(sessionId: string): Promise<SessionInfo>; // READ-ONLY lookup; throws on any provider error (the reconciler counts it and retries next sweep)
  createCheckout(r: CheckoutRequest): Promise<{ id: string; url: string }>;
  cancelSubscription(subId: string, atPeriodEnd: boolean): Promise<void>;
  refund(paymentIntentId: string, amountCents: number, idempotencyKey: string): Promise<{ id: string }>;
  portalUrl(customerId: string, returnUrl: string): Promise<string>;
}

// Mock: records every call, makes no network request. Used by tests and by any run without a key.
export class MockBilling implements BillingProvider {
  calls: { op: string; args: unknown }[] = [];
  sessions = new Map<string, SessionInfo>(); // test control: the "Stripe side" of a session id
  failNext: { id?: string; times: number } = { times: 0 }; // test control: make retrieveSession throw
  async retrieveSession(id: string): Promise<SessionInfo> {
    this.calls.push({ op: "retrieveSession", args: { id } });
    if (this.failNext.times > 0 && (this.failNext.id === undefined || this.failNext.id === id)) { this.failNext.times--; throw new Error("stripe_503"); }
    const s = this.sessions.get(id); if (!s) throw new Error("stripe_404");
    return { ...s };
  }
  async createCheckout(r: CheckoutRequest) { this.calls.push({ op: "checkout", args: r }); const id = randomToken("cs_test"); return { id, url: `https://checkout.mock.invalid/${id}` }; }
  async cancelSubscription(subId: string, atPeriodEnd: boolean) { this.calls.push({ op: "cancel", args: { subId, atPeriodEnd } }); }
  async refund(pi: string, amountCents: number, key: string) { this.calls.push({ op: "refund", args: { pi, amountCents, key } }); return { id: randomToken("re_test") }; }
  async portalUrl(customerId: string) { return `https://portal.mock.invalid/${customerId}`; }
}

// Real Stripe over fetch (form-encoded). Refuses a key that does not match the declared mode, so a live key
// can never be used while STRIPE_MODE says test. Never used by tests except with an injected fake fetch.
export class StripeHttpBilling implements BillingProvider {
  private key: string; private fetchFn: typeof fetch;
  constructor(key: string, mode: "test" | "live", fetchFn: typeof fetch = fetch) {
    this.key = key; this.fetchFn = fetchFn;
    const want = mode === "live" ? "sk_live_" : "sk_test_";
    if (!key.startsWith(want) && !key.startsWith("rk_" + mode + "_")) throw new Error("stripe_key_mode_mismatch");
  }
  private async post(path: string, body: Record<string, string>, idem?: string) {
    const r = await this.fetchFn(`https://api.stripe.com/v1/${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.key}`, "content-type": "application/x-www-form-urlencoded", ...(idem ? { "idempotency-key": idem } : {}) },
      body: new URLSearchParams(body).toString(),
    });
    if (!r.ok) throw new Error(`stripe_${r.status}`);
    return (await r.json()) as Record<string, unknown>;
  }
  // GET only. NOT exercised against live Stripe (PENDING LIVE, GATE2): tests inject a fake fetch.
  async retrieveSession(id: string): Promise<SessionInfo> {
    const r = await this.fetchFn(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}?expand[]=subscription`, { method: "GET", headers: { authorization: `Bearer ${this.key}` } });
    if (!r.ok) throw new Error(`stripe_${r.status}`);
    const j = (await r.json()) as Record<string, any>;
    const status = j.status === "complete" || j.status === "expired" ? j.status : "open";
    const ps = j.payment_status === "paid" || j.payment_status === "no_payment_required" ? j.payment_status : "unpaid";
    const ref = (v: unknown) => (v && typeof v === "object" ? String((v as any).id) : v ? String(v) : undefined);
    return { id: String(j.id), status, paymentStatus: ps, paymentIntent: ref(j.payment_intent), customer: ref(j.customer), subscription: j.subscription && typeof j.subscription === "object" ? j.subscription : ref(j.subscription) };
  }
  async createCheckout(r: CheckoutRequest) {
    const b: Record<string, string> = {
      mode: r.mode, customer_email: r.email, success_url: r.successUrl, cancel_url: r.cancelUrl,
      client_reference_id: r.accountId, "metadata[account_id]": r.accountId, "metadata[product_id]": r.productId,
      "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "aud",
      "line_items[0][price_data][unit_amount]": String(r.amountCents), "line_items[0][price_data][product_data][name]": r.name,
    };
    if (r.mode === "subscription") { b["line_items[0][price_data][recurring][interval]"] = r.interval ?? "month"; b["subscription_data[metadata][account_id]"] = r.accountId; b["subscription_data[metadata][product_id]"] = r.productId; }
    else b["payment_intent_data[metadata][account_id]"] = r.accountId;
    const j = await this.post("checkout/sessions", b, r.idempotencyKey);
    return { id: String(j.id), url: String(j.url) };
  }
  async cancelSubscription(subId: string, atPeriodEnd: boolean) {
    if (atPeriodEnd) await this.post(`subscriptions/${encodeURIComponent(subId)}`, { cancel_at_period_end: "true" });
    else { const r = await this.fetchFn(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}`, { method: "DELETE", headers: { authorization: `Bearer ${this.key}` } }); if (!r.ok) throw new Error(`stripe_${r.status}`); }
  }
  async refund(pi: string, amountCents: number, idem: string) {
    const j = await this.post("refunds", { payment_intent: pi, amount: String(amountCents) }, idem);
    return { id: String(j.id) };
  }
  async portalUrl(customerId: string, returnUrl: string) {
    const j = await this.post("billing_portal/sessions", { customer: customerId, return_url: returnUrl });
    return String(j.url);
  }
}
