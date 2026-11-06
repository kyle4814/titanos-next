// buildDeps(env): the Worker's dependency set over D1. NOT DEPLOYED. Anything that needs a credential the Worker does not hold
// (mail provider, Stripe key, DNS write, IdP, payout provider) is wired FAIL-CLOSED: it throws a named error, never pretends.
// LOCAL_DEV=1 (set only in .dev.vars / wrangler dev --local, never in wrangler.toml [vars]) swaps in local stand-ins so the
// Worker can be driven with curl: a console mailer, the mock billing/payments/IdP, a synthetic scan. Nothing leaves the machine.
import type { Env } from "../env.ts";
import { D1Store } from "./store.ts";
import { D1MarketStore } from "../market/d1store.ts";
import { D1EntStore } from "../enterprise/d1store.ts";
import { D1OwnerStore } from "../owner/d1ownerstore.ts";
import { MockBilling, StripeHttpBilling, type BillingProvider } from "../stripe.ts";
import { dohResolver } from "../dns.ts";
import { MockPayments, StripeConnectPayments, type JobPayments } from "../market/payments.ts";
import type { Deps, Mailer } from "../service.ts";
import { MockIdp } from "../enterprise/sso.ts";
import { SyntheticScan } from "../enterprise/estate.ts";
import { RATE_V1 } from "../enterprise/share.ts";
import { dohFetch } from "../../../lib/guestscan/scan.ts";
import type { PayoutProvider, ScanProvider, IdpVerifier } from "../enterprise/types.ts";

export class Unconfigured extends Error { constructor(what: string) { super(`${what}_unconfigured`); } }
const failMailer: Mailer = { async send() { throw new Unconfigured("mailer"); } };
const consoleMailer: Mailer = { async send(to, subject, text) { console.log(JSON.stringify({ svc: "local-mailer", to, subject, text })); } };
const failPayouts: PayoutProvider = { async transfer() { throw new Unconfigured("payout_provider"); } };
const noScan: ScanProvider = { source: "unconfigured", async scan() { throw new Unconfigured("estate_scan"); } };
const noIdp: IdpVerifier = { async verify() { throw new Unconfigured("idp"); } };

export function buildDeps(env: Env, now: () => number = Date.now): Deps | undefined {
  if (!env.DB) return undefined;                       // no database binding: every route but /health stays 503
  const db = env.DB, local = env.LOCAL_DEV === "1";
  const mode = env.STRIPE_MODE === "live" ? "live" : "test";
  const billing: BillingProvider = env.STRIPE_SECRET_KEY ? new StripeHttpBilling(env.STRIPE_SECRET_KEY, mode) : local ? new MockBilling() : unconfiguredBilling();
  const payments: JobPayments = env.STRIPE_SECRET_KEY ? new StripeConnectPayments(env.STRIPE_SECRET_KEY, mode) : local ? new MockPayments() : unconfiguredPayments();
  const ring = env.SEAL_KEY ? { current: "k1", keys: { k1: env.SEAL_KEY } } : undefined;
  const doh = dohFetch();
  return {
    store: new D1Store(db), billing, dns: dohResolver(), mailer: local ? consoleMailer : failMailer, now,
    siteOrigin: env.TITANOS_SITE_ORIGIN ?? "https://titanos.tech", webhookSecret: env.STRIPE_WEBHOOK_SECRET, receiptSecret: env.RECEIPT_SECRET,
    owner: { store: new D1OwnerStore(db, now), doh: () => doh, zones: { zoneFor: () => undefined } },   // no zone credentials: auto-fix stays off (GATE2)
    market: { store: new D1MarketStore(db), payments, doh: () => doh, internalSecret: env.INTERNAL_API_SECRET },
    ent: { store: new D1EntStore(db, ring), idp: local ? MockIdp : noIdp, payouts: failPayouts, scan: local ? SyntheticScan : noScan, rates: RATE_V1, internalSecret: env.INTERNAL_API_SECRET },
  };
}
// The real IdP verifier (createOidcVerifier) needs a per-tenant JWKS fetch policy: wired when the first enterprise IdP exists (CARD NEEDED in the receipt).

function unconfiguredBilling(): BillingProvider {
  const f = async () => { throw new Unconfigured("billing"); };
  return { createCheckout: f, cancelSubscription: f, refund: f, portalUrl: f };
}
function unconfiguredPayments(): JobPayments {
  return new Proxy({} as JobPayments, { get: (_t, k) => (k === "then" ? undefined : async () => { throw new Unconfigured("payments"); }) });
}
