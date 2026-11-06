// Offline stand-in for api.stripe.com (TEST-MODE shapes only). Used by stripe_testmode.ts when no sk_test_ key is present,
// and by its test. It records every request, enforces the bits of the Stripe contract the portal depends on
// (Bearer sk_test_, form encoding, AUD, idempotency keys replay the first object) and makes no network call.
export interface FakeCall { method: string; path: string; form: Record<string, string>; idem?: string }
export class FakeStripe {
  calls: FakeCall[] = [];
  private n = 0;
  private idemSeen = new Map<string, Record<string, unknown>>();
  private objs = new Map<string, Record<string, unknown>>();
  private id(prefix: string) { return `${prefix}_fake${String(++this.n).padStart(6, "0")}`; }
  fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const u = new URL(String(url instanceof Request ? url.url : url));
    if (u.origin !== "https://api.stripe.com") throw new Error(`fake_stripe_blocked_origin:${u.origin}`);
    const h = new Headers(init?.headers);
    const auth = h.get("authorization") ?? "";
    if (!auth.startsWith("Bearer sk_test_")) return this.err(401, "invalid_api_key");
    const method = (init?.method ?? "GET").toUpperCase();
    const path = u.pathname.replace(/^\/v1\//, "");
    const form = Object.fromEntries(new URLSearchParams(String(init?.body ?? "")).entries());
    const idem = h.get("idempotency-key") ?? undefined;
    this.calls.push({ method, path, form, idem });
    if (idem && this.idemSeen.has(`${path}|${idem}`)) return this.ok(this.idemSeen.get(`${path}|${idem}`)!);
    const out = this.route(method, path, form);
    if (out instanceof Response) return out;
    if (idem) this.idemSeen.set(`${path}|${idem}`, out);
    return this.ok(out);
  };
  private ok(o: Record<string, unknown>) { return new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } }); }
  private err(status: number, code: string) { return new Response(JSON.stringify({ error: { code, message: code } }), { status, headers: { "content-type": "application/json" } }); }
  private put(prefix: string, o: Record<string, unknown>) { const id = this.id(prefix); const r = { id, livemode: false, ...o }; this.objs.set(id, r); return r; }
  private route(method: string, path: string, f: Record<string, string>): Record<string, unknown> | Response {
    if (method === "POST" && path === "products") { if (!f.name) return this.err(400, "parameter_missing"); return this.put("prod", { object: "product", name: f.name, metadata: { catalogue_id: f["metadata[catalogue_id]"] } }); }
    if (method === "POST" && path === "prices") {
      if (!f.product || !f.unit_amount || f.currency !== "aud") return this.err(400, "parameter_invalid_empty");
      return this.put("price", { object: "price", product: f.product, unit_amount: Number(f.unit_amount), currency: "aud", recurring: f["recurring[interval]"] ? { interval: f["recurring[interval]"] } : null });
    }
    if (method === "POST" && path === "customers") return this.put("cus", { object: "customer", email: f.email });
    if (method === "POST" && path === "checkout/sessions") {
      if (!f.success_url || !f.cancel_url || f["line_items[0][price_data][currency]"] !== "aud") return this.err(400, "parameter_invalid_empty");
      const r = this.put("cs_test", { object: "checkout.session", mode: f.mode, amount_total: Number(f["line_items[0][price_data][unit_amount]"]), payment_status: "unpaid", metadata: { account_id: f["metadata[account_id]"], product_id: f["metadata[product_id]"] } });
      return { ...r, url: `https://checkout.stripe.com/c/pay/${r.id}#fake` };
    }
    if (method === "POST" && path === "payment_intents") {
      if (!f.customer || f.payment_method !== "pm_card_visa" || f.confirm !== "true") return this.err(400, "parameter_invalid_empty");
      return this.put("pi", { object: "payment_intent", status: "succeeded", amount: Number(f.amount), currency: "aud", customer: f.customer, amount_refunded: 0 });
    }
    if (method === "POST" && path === "subscriptions") {
      if (!f.customer || !f["items[0][price]"]) return this.err(400, "parameter_missing");
      return this.put("sub", { object: "subscription", status: "active", customer: f.customer, cancel_at_period_end: false });
    }
    let m = path.match(/^subscriptions\/([^/]+)$/);
    if (m && (method === "POST" || method === "DELETE")) {
      const s = this.objs.get(decodeURIComponent(m[1])); if (!s) return this.err(404, "resource_missing");
      if (method === "DELETE") s.status = "canceled"; else s.cancel_at_period_end = f.cancel_at_period_end === "true";
      return s;
    }
    if (method === "POST" && path === "refunds") {
      const pi = this.objs.get(f.payment_intent); if (!pi) return this.err(404, "resource_missing");
      const amt = Number(f.amount); if (!(amt > 0) || amt + Number(pi.amount_refunded) > Number(pi.amount)) return this.err(400, "charge_already_refunded");
      pi.amount_refunded = Number(pi.amount_refunded) + amt;
      return this.put("re", { object: "refund", payment_intent: f.payment_intent, amount: amt, status: "succeeded" });
    }
    if (method === "POST" && path === "billing_portal/sessions") return { id: this.id("bps"), url: "https://billing.stripe.com/p/session/fake" };
    return this.err(404, "unrecognized_request");
  }
}
