// f208: buildDeps(env) assembles the real Deps for the Worker entry from an Env. FAIL CLOSED: a missing binding throws a typed
// BuildDepsError naming the binding (never a secret value); the entry turns it into a 503 with a named reason.
// Nothing here is deployed. The default StoreFactory (f216) is D1Store over env.DB; a per-isolate MemoryStore must never
// pretend to be the shared database, so with no DB binding buildDeps refuses (missing_binding:DB).
import type { Env } from "./env.ts";
import type { Deps, Mailer } from "./service.ts";
import { HttpError } from "./service.ts";
import type { Store } from "./store.ts";
import { MockBilling, StripeHttpBilling, type BillingProvider } from "./stripe.ts";
import { dohResolver, type TxtResolver } from "./dns.ts";
import { Throttle } from "./throttle.ts";
import { D1ThrottleStore } from "./d1throttle.ts";
import { D1Store } from "./d1store.ts";
import type { OwnerDeps } from "./service.ts";
import type { ZoneProvider } from "./owner/engine.ts";
import { D1OwnerStore } from "./owner/d1ownerstore.ts";
import { D1MarketStore } from "./market/d1store.ts";
import { D1DisputeCaseStore } from "./market/dispute_case_store.ts";
import { D1AnchorStore } from "./market/audit_anchor.ts";
import type { DisputeTrail } from "./market/dispute_trail.ts";
import { StripeConnectPayments, type JobPayments } from "./market/payments.ts";
import type { MarketDeps } from "./market/service.ts";
import type { EntContext } from "./enterprise/service.ts";
import { D1EntStore, D1ApprovalStore } from "./enterprise/d1store.ts";
import { createOidcVerifier, type Jwks } from "./enterprise/oidc.ts";
import { dnsScan, publicDohResolver } from "./enterprise/estate_dns.ts";
import { RATE_V1 } from "./enterprise/share.ts";
import { makeBookFacts } from "./enterprise/book_facts.ts";
import { parseSealKeys, type SealKeyring } from "./enterprise/seal.ts";
import type { PayoutProvider } from "./enterprise/types.ts";
import { ResendMailer, RelayMailer, MAIL_PROVIDERS } from "./mail.ts";

export type BuildDepsReason = "missing_binding" | "store_adapter_unavailable" | "live_key_refused" | "live_not_armed" | "mail_config_invalid";
export class BuildDepsError extends Error {
  readonly reason: BuildDepsReason; readonly binding?: string;
  constructor(reason: BuildDepsReason, binding?: string) { super(binding ? `${reason}:${binding}` : reason); this.name = "BuildDepsError"; this.reason = reason; this.binding = binding; }
}
export type StoreFactory = (db: NonNullable<Env["DB"]>, env: Env) => Store;
export interface BuildOpts { side?: boolean; storeFactory?: StoreFactory; billing?: BillingProvider; dns?: TxtResolver; mailer?: Mailer; now?: () => number; fetchFn?: typeof fetch }
// /auth/request sends real mail in production, so besides the per-email limit (service.ts LOGIN_LIMIT) it is capped per client IP and globally.
// Defaults here; override per deploy with env LOGIN_IP_LIMIT / LOGIN_GLOBAL_LIMIT (positive integers, per hour). Every request counts, sent or not.
export const LOGIN_REQUEST_LIMITS = { perIpPerHour: 10, globalPerHour: 200 };
const posInt = (v: string | undefined, d: number) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 1_000_000 ? n : d; };
export const loginLimitsFor = (env: Env) => ({ perIpPerHour: posInt(env.LOGIN_IP_LIMIT, LOGIN_REQUEST_LIMITS.perIpPerHour), globalPerHour: posInt(env.LOGIN_GLOBAL_LIMIT, LOGIN_REQUEST_LIMITS.globalPerHour) });
export const THROTTLE_LIMITS = { maxFailures: 5, windowMs: 15 * 60_000, lockoutMs: 15 * 60_000 };

// No mail transport is bound yet (PENDING LIVE): refuse loudly instead of dropping login links on the floor.
export const unavailableMailer: Mailer = { async send() { throw new HttpError(503, "mailer_unavailable"); } };
// Explicit opt-out seam (tests, or a deploy that must refuse): throws the typed store_adapter_unavailable reason.
export const noStoreFactory: StoreFactory = () => { throw new BuildDepsError("store_adapter_unavailable"); };
// f216: the shipped default. D1Store over the DB binding ONLY (no secret is read). Missing DB is caught earlier in buildDeps
// as missing_binding:DB, so a per-isolate MemoryStore can never stand in for the shared database.
export const d1StoreFactory: StoreFactory = (db) => new D1Store(db);

// Fake billing unless the Env carries a TEST key. A live key is used ONLY when live mode is fully armed (assertLiveArmed);
// every other live-ish combination (live key in test mode, test key in live mode) is refused exactly as before.
const isLiveKey = (k: string | undefined) => !!k && (k.startsWith("sk_live_") || k.startsWith("rk_live_"));
export const ARMING_RE = /^yes-\d{4}-\d{2}-\d{2}$/;
// LIVE BILLING IS ARMED ONLY WHEN ALL OF: STRIPE_MODE="live", a live-shaped STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, a real mail
// transport (MAIL_PROVIDER + its key + MAIL_FROM), LIVE_BILLING_ARMED="yes-YYYY-MM-DD", and DEV_OUTBOX unset. Otherwise it throws
// live_not_armed naming exactly what is missing (names only, never values).
export function assertLiveArmed(env: Env): void {
  const missing: string[] = [];
  if (!isLiveKey(env.STRIPE_SECRET_KEY?.trim())) missing.push("STRIPE_SECRET_KEY(live)");
  const wh = env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!wh || !wh.startsWith("whsec_") || wh.length <= "whsec_".length) missing.push("STRIPE_WEBHOOK_SECRET(whsec_...)");
  if (!env.MAIL_PROVIDER || !(MAIL_PROVIDERS as readonly string[]).includes(env.MAIL_PROVIDER)) missing.push("MAIL_PROVIDER");
  else if (env.MAIL_PROVIDER === "relay") { if (!env.MAIL_RELAY || typeof env.MAIL_RELAY.fetch !== "function") missing.push("MAIL_RELAY"); if (!env.MAIL_RELAY_SECRET?.trim()) missing.push("MAIL_RELAY_SECRET"); }
  else { if (!env.RESEND_API_KEY?.trim()) missing.push("RESEND_API_KEY"); if (!env.MAIL_FROM?.trim()) missing.push("MAIL_FROM"); }
  if (!ARMING_RE.test(env.LIVE_BILLING_ARMED ?? "")) missing.push("LIVE_BILLING_ARMED");
  if (env.DEV_OUTBOX) missing.push("DEV_OUTBOX(must be unset)");
  if (missing.length) throw new BuildDepsError("live_not_armed", missing.join(","));
}
export function billingFor(env: Env, fetchFn?: typeof fetch): BillingProvider {
  const k = env.STRIPE_SECRET_KEY?.trim();
  if (env.STRIPE_MODE === "live" && isLiveKey(k)) { assertLiveArmed(env); return new StripeHttpBilling(k!, "live", fetchFn); }
  if (!k) return new MockBilling();
  if (env.STRIPE_MODE === "live" || isLiveKey(k)) throw new BuildDepsError("live_key_refused");
  if (k.startsWith("sk_test_") || k.startsWith("rk_test_")) return new StripeHttpBilling(k, "test", fetchFn);
  return new MockBilling();
}

// ---- 2026-11-10 self-serve wiring (TEST MODE): the owner, market and enterprise seats over the same D1 binding ----
// Every provider below either works with no secret (D1 stores, passive public DoH, OIDC JWKS discovery) or REFUSES with a typed
// 503 (money movement, DNS writes). Nothing here moves money or writes anyone's DNS: binding a payout or live payments provider
// is GATE1/GATE2 and stays out of this file.
const refuse = (code: string) => { throw new HttpError(503, code); };
export const refusingPayouts: PayoutProvider = { async transfer() { return refuse("payouts_unavailable"); } };
export const refusingJobPayments: JobPayments = {
  async createJobCheckout() { return refuse("payments_unavailable"); }, async chargeClaimFee() { return refuse("payments_unavailable"); },
  async refundHold() { return refuse("payments_unavailable"); }, async transfer() { return refuse("payments_unavailable"); },
  async onboardingLink() { return refuse("payments_unavailable"); }, async accountReady() { return false; },
};
// No zone write access to any customer's DNS: auto-fix answers no_zone (the engine's own honest path), the checks still run.
export const noZones: ZoneProvider = { zoneFor: () => undefined };
// Market payments: Stripe Connect in TEST mode only when a test key is bound; otherwise refuse. In LIVE mode (and for payouts, always)
// every call answers 503 payments_unavailable / payouts_unavailable: marketplace money movement is out of scope for the live cutover.
export function jobPaymentsFor(env: Env, fetchFn?: typeof fetch): JobPayments {
  const k = env.STRIPE_SECRET_KEY?.trim();
  if (k && env.STRIPE_MODE !== "live" && (k.startsWith("sk_test_") || k.startsWith("rk_test_"))) return new StripeConnectPayments(k, "test", fetchFn);
  return refusingJobPayments;
}
// OIDC discovery: issuer -> /.well-known/openid-configuration -> jwks_uri, https only, 5 s budget per fetch.
export function discoveryJwks(fetchFn: typeof fetch = fetch): (issuer: string) => Promise<Jwks> {
  const get = async (url: string) => {
    if (!/^https:\/\//.test(url)) throw new Error("oidc_https_only");
    const r = await fetchFn(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error("oidc_fetch_" + r.status);
    return r.json() as Promise<any>;
  };
  return async (issuer) => { const conf = await get(issuer.replace(/\/+$/, "") + "/.well-known/openid-configuration"); return get(String(conf?.jwks_uri ?? "")); };
}
const sealKeysOf = (env: Env): SealKeyring | undefined => { try { return parseSealKeys(env.SSO_SEAL_KEYS); } catch { return undefined; } };   // absent = putSso 503, never plaintext
// TEST MODE mailer: DEV_OUTBOX="1" parks each message in the dev_outbox table (0025) instead of sending it. Refused in live mode.
export function devOutboxMailer(db: NonNullable<Env["DB"]>, now: () => number): Mailer {
  return { async send(to, subject, text) {
    const t = now();
    await db.prepare("DELETE FROM dev_outbox WHERE created_at < ?").bind(t - 86_400_000).run();   // keep one day, never a growing pile of login links
    await db.prepare("INSERT INTO dev_outbox (to_addr, subject, body, created_at) VALUES (?, ?, ?, ?)").bind(to, subject, text, t).run();
  } };
}
export function mailerFor(env: Env, now: () => number, fetchFn?: typeof fetch): Mailer {
  if (env.MAIL_PROVIDER) {   // a real transport was asked for: build it or refuse naming the missing binding
    if (env.STRIPE_MODE === "live" && env.DEV_OUTBOX) throw new BuildDepsError("live_key_refused", "DEV_OUTBOX");
    if (!(MAIL_PROVIDERS as readonly string[]).includes(env.MAIL_PROVIDER)) throw new BuildDepsError("mail_config_invalid", "MAIL_PROVIDER");
    if (env.MAIL_PROVIDER === "relay") {
      if (!env.MAIL_RELAY || typeof env.MAIL_RELAY.fetch !== "function") throw new BuildDepsError("missing_binding", "MAIL_RELAY");
      const rs = env.MAIL_RELAY_SECRET?.trim(); if (!rs) throw new BuildDepsError("missing_binding", "MAIL_RELAY_SECRET");
      return new RelayMailer(env.MAIL_RELAY, rs);
    }
    const key = env.RESEND_API_KEY?.trim(), from = env.MAIL_FROM?.trim();
    if (!key) throw new BuildDepsError("missing_binding", "RESEND_API_KEY");
    if (!from) throw new BuildDepsError("missing_binding", "MAIL_FROM");
    return new ResendMailer(key, from, fetchFn);
  }
  if (env.DEV_OUTBOX !== "1" || !env.DB) return unavailableMailer;
  if (env.STRIPE_MODE === "live") throw new BuildDepsError("live_key_refused", "DEV_OUTBOX");
  return devOutboxMailer(env.DB, now);
}
// f381: the dispute trail over D1 (migrations 0006 audit_anchor + 0007 dispute_case). The tenant of a case is the job's owner account,
// resolved from the market store; an unknown job is absent on read and refused on write (D1 invariant). CAS state lives in the
// instance, so sideDeps (one call per request) builds a fresh store each time. No DB bound = the caller keeps memoryTrail (service.ts).
export function disputeTrailFor(db: NonNullable<Env["DB"]>, market: Pick<MarketDeps["store"], "getJob">): DisputeTrail {
  return { cases: new D1DisputeCaseStore(db, async (jobId) => (await market.getJob(jobId))?.ownerAccountId), anchors: new D1AnchorStore(db) };
}
export function sideDeps(env: Env, fetchFn?: typeof fetch): { owner: OwnerDeps; market: MarketDeps; ent: EntContext } {
  const db = env.DB; if (!db) throw new BuildDepsError("missing_binding", "DB");
  const doh = () => publicDohResolver();
  const internalSecret = env.INTERNAL_API_SECRET || undefined;
  const marketStore = new D1MarketStore(db);
  return {
    owner: { store: new D1OwnerStore(db), doh, zones: noZones },
    market: { store: marketStore, payments: jobPaymentsFor(env, fetchFn), doh, internalSecret, disputes: disputeTrailFor(db, marketStore) },
    ent: {
      store: new D1EntStore(db), approvals: new D1ApprovalStore(db), idp: createOidcVerifier({ fetchJwks: discoveryJwks(fetchFn) }),
      payouts: refusingPayouts, scan: dnsScan({ resolver: publicDohResolver(), resolverSource: "cloudflare-dns.com (DNS-over-HTTPS, passive public records)" }),
      rates: RATE_V1, internalSecret, sealKeys: sealKeysOf(env), book: makeBookFacts(env as { DB?: any }),
    },
  };
}

export function buildDeps(env: Env, opts: BuildOpts = {}): Deps {
  const db = env.DB;
  if (!db) throw new BuildDepsError("missing_binding", "DB");
  const siteOrigin = env.TITANOS_SITE_ORIGIN;
  if (!siteOrigin) throw new BuildDepsError("missing_binding", "TITANOS_SITE_ORIGIN");
  if (env.STRIPE_MODE === "live") assertLiveArmed(env);   // fail closed before anything is built; test mode never runs this line
  const store = (opts.storeFactory ?? d1StoreFactory)(db, env);
  const now = opts.now ?? (() => Date.now());
  return {
    ...(opts.side === false ? {} : sideDeps(env, opts.fetchFn)),
    store, billing: opts.billing ?? billingFor(env, opts.fetchFn), dns: opts.dns ?? dohResolver(opts.fetchFn),
    mailer: opts.mailer ?? mailerFor(env, now, opts.fetchFn), now, siteOrigin,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET?.trim() || undefined,   // the SAME trimmed value assertLiveArmed checked
    operatorSecret: env.INTERNAL_API_SECRET || undefined,   // /internal/keys/trace: unset = nobody (401)
    receiptSecret: env.RECEIPT_SECRET || undefined,
    loginLimits: loginLimitsFor(env),
  };
}

// Shared (D1) throttle, one per DB binding object so every request on an isolate reuses it. Returns undefined with no DB.
const throttles = new WeakMap<object, Throttle>();
export function throttleFor(env: Env, now: () => number = () => Date.now(), log?: (l: string) => void): Throttle | undefined {
  const db = env.DB; if (!db) return undefined;
  let t = throttles.get(db);
  if (!t) { t = new Throttle({ ...THROTTLE_LIMITS, now, log }, new D1ThrottleStore(db)); throttles.set(db, t); }
  return t;
}
