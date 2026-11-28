// C4 money seam. The marketplace talks to JobPayments, never to Stripe. MockPayments records every call and makes no
// request. StripeConnectPayments is the real adapter over fetch: it is NOT used by any test except with an injected fake
// fetch, and creating a Connect account or a transfer against real Stripe is GATE2 (see the receipt CARD NEEDED line).
// Pattern: "separate charges and transfers". The owner's payment is held on the platform balance; a transfer to the
// pro's Connect account happens ONLY from market/service.ts after a re-scan proves the fix.
import { randomToken } from "../util.ts";

export interface JobCheckoutRequest { jobId: string; ownerEmail: string; ownerAccountId: string; amountCents: number; name: string; successUrl: string; cancelUrl: string; idempotencyKey: string }
export interface JobPayments {
  createJobCheckout(r: JobCheckoutRequest): Promise<{ id: string; url: string }>;
  chargeClaimFee(proAccountId: string, connectAccountId: string, amountCents: number, idempotencyKey: string): Promise<{ id: string }>;
  refundHold(paymentIntent: string, amountCents: number, idempotencyKey: string): Promise<{ id: string }>;
  transfer(connectAccountId: string, amountCents: number, transferGroup: string, idempotencyKey: string): Promise<{ id: string }>;
  onboardingLink(proAccountId: string, email: string, existingConnectId: string | undefined, returnUrl: string, refreshUrl: string): Promise<{ connectAccountId: string; url: string }>;
  accountReady(connectAccountId: string): Promise<boolean>;
}

export class MockPayments implements JobPayments {
  calls: { op: string; args: Record<string, unknown> }[] = [];
  ready = new Set<string>();            // connect ids the test has marked as finished onboarding
  autoReady = false;                    // true: onboardingLink marks the new account ready at once
  failClaimFee = false; failTransfer = false;
  private seen = new Map<string, { id: string }>();   // idempotency: the same key returns the same result, no second effect
  private idem<T extends { id: string }>(op: string, key: string, args: Record<string, unknown>, mk: () => T): T {
    const k = `${op}:${key}`; const hit = this.seen.get(k); if (hit) return hit as T;
    this.calls.push({ op, args: { ...args, key } }); const v = mk(); this.seen.set(k, v); return v;
  }
  count(op: string) { return this.calls.filter((c) => c.op === op).length; }
  async createJobCheckout(r: JobCheckoutRequest) { return this.idem("checkout", r.idempotencyKey, { jobId: r.jobId, amountCents: r.amountCents }, () => { const id = randomToken("cs_test"); return { id, url: `https://checkout.mock.invalid/${id}` }; }); }
  async chargeClaimFee(pro: string, connect: string, cents: number, key: string) { if (this.failClaimFee) throw new Error("claim_fee_declined"); return this.idem("claim_fee", key, { pro, cents }, () => ({ id: randomToken("pi_fee") })); }
  async refundHold(pi: string, cents: number, key: string) { return this.idem("refund", key, { pi, cents }, () => ({ id: randomToken("re_test") })); }
  async transfer(connect: string, cents: number, group: string, key: string) { if (this.failTransfer) throw new Error("transfer_failed"); return this.idem("transfer", key, { connect, cents, group }, () => ({ id: randomToken("tr_test") })); }
  async onboardingLink(pro: string, _email: string, existing: string | undefined) {
    const connectAccountId = existing ?? `acct_mock_${pro.slice(0, 12)}`; this.calls.push({ op: "onboarding", args: { pro, connectAccountId } });
    if (this.autoReady) this.ready.add(connectAccountId);
    return { connectAccountId, url: `https://connect.mock.invalid/onboard/${connectAccountId}` };
  }
  async accountReady(id: string) { return this.ready.has(id); }
}

export class StripeConnectPayments implements JobPayments {
  private key: string; private fetchFn: typeof fetch;
  constructor(key: string, mode: "test" | "live", fetchFn: typeof fetch = fetch) {
    this.key = key; this.fetchFn = fetchFn;
    const want = mode === "live" ? "sk_live_" : "sk_test_";
    if (!key.startsWith(want) && !key.startsWith("rk_" + mode + "_")) throw new Error("stripe_key_mode_mismatch");
  }
  private async call(method: "GET" | "POST", path: string, body?: Record<string, string>, idem?: string) {
    const r = await this.fetchFn(`https://api.stripe.com/v1/${path}`, {
      method, headers: { authorization: `Bearer ${this.key}`, ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(idem ? { "idempotency-key": idem } : {}) },
      body: method === "POST" ? new URLSearchParams(body ?? {}).toString() : undefined,
    });
    if (!r.ok) throw new Error(`stripe_${r.status}`);
    return (await r.json()) as Record<string, any>;
  }
  async createJobCheckout(r: JobCheckoutRequest) {
    const j = await this.call("POST", "checkout/sessions", {
      mode: "payment", customer_email: r.ownerEmail, success_url: r.successUrl, cancel_url: r.cancelUrl, client_reference_id: r.ownerAccountId,
      "metadata[market_job_id]": r.jobId, "metadata[account_id]": r.ownerAccountId, "payment_intent_data[transfer_group]": r.jobId, "payment_intent_data[metadata][market_job_id]": r.jobId,
      "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "aud", "line_items[0][price_data][unit_amount]": String(r.amountCents), "line_items[0][price_data][product_data][name]": r.name,
    }, r.idempotencyKey);
    return { id: String(j.id), url: String(j.url) };
  }
  // The claim fee is charged to the pro at claim time. Real wiring (saved payment method or Connect balance debit) is a
  // card decision; until then this adapter refuses rather than guess.
  async chargeClaimFee(_pro: string, _connect: string, _cents: number, _key: string): Promise<{ id: string }> { throw new Error("claim_fee_method_not_configured"); }
  async refundHold(pi: string, cents: number, key: string) { const j = await this.call("POST", "refunds", { payment_intent: pi, amount: String(cents) }, key); return { id: String(j.id) }; }
  async transfer(connect: string, cents: number, group: string, key: string) {
    const j = await this.call("POST", "transfers", { amount: String(cents), currency: "aud", destination: connect, transfer_group: group }, key); return { id: String(j.id) };
  }
  async onboardingLink(pro: string, email: string, existing: string | undefined, returnUrl: string, refreshUrl: string) {
    let id = existing;
    if (!id) { const a = await this.call("POST", "accounts", { type: "express", country: "AU", email, "capabilities[transfers][requested]": "true", "metadata[account_id]": pro }, `connect_${pro}`); id = String(a.id); }
    const l = await this.call("POST", "account_links", { account: id, type: "account_onboarding", return_url: returnUrl, refresh_url: refreshUrl });
    return { connectAccountId: id, url: String(l.url) };
  }
  async accountReady(id: string) { const a = await this.call("GET", `accounts/${encodeURIComponent(id)}`); return a.payouts_enabled === true && a.details_submitted === true; }
}
