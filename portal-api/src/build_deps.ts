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
import { D1Store } from "./d1store.ts";
import { Throttle } from "./throttle.ts";
import { D1ThrottleStore } from "./d1throttle.ts";

export type BuildDepsReason = "missing_binding" | "store_adapter_unavailable" | "live_key_refused";
export class BuildDepsError extends Error {
  readonly reason: BuildDepsReason; readonly binding?: string;
  constructor(reason: BuildDepsReason, binding?: string) { super(binding ? `${reason}:${binding}` : reason); this.name = "BuildDepsError"; this.reason = reason; this.binding = binding; }
}
export type StoreFactory = (db: NonNullable<Env["DB"]>, env: Env) => Store;
export interface BuildOpts { storeFactory?: StoreFactory; billing?: BillingProvider; dns?: TxtResolver; mailer?: Mailer; now?: () => number; fetchFn?: typeof fetch }
export const THROTTLE_LIMITS = { maxFailures: 5, windowMs: 15 * 60_000, lockoutMs: 15 * 60_000 };

// No mail transport is bound yet (PENDING LIVE): refuse loudly instead of dropping login links on the floor.
export const unavailableMailer: Mailer = { async send() { throw new HttpError(503, "mailer_unavailable"); } };
// Explicit opt-out seam (tests, or a deploy that must refuse): throws the typed store_adapter_unavailable reason.
export const noStoreFactory: StoreFactory = () => { throw new BuildDepsError("store_adapter_unavailable"); };
// f216: the shipped default. D1Store over the DB binding ONLY (no secret is read). Missing DB is caught earlier in buildDeps
// as missing_binding:DB, so a per-isolate MemoryStore can never stand in for the shared database.
export const d1StoreFactory: StoreFactory = (db) => new D1Store(db);

// Fake billing unless the Env carries a TEST key. A live key is refused outright (live Stripe is GATE2, not this lane).
export function billingFor(env: Env, fetchFn?: typeof fetch): BillingProvider {
  const k = env.STRIPE_SECRET_KEY?.trim();
  if (!k) return new MockBilling();
  if (env.STRIPE_MODE === "live" || k.startsWith("sk_live_") || k.startsWith("rk_live_")) throw new BuildDepsError("live_key_refused");
  if (k.startsWith("sk_test_") || k.startsWith("rk_test_")) return new StripeHttpBilling(k, "test", fetchFn);
  return new MockBilling();
}

export function buildDeps(env: Env, opts: BuildOpts = {}): Deps {
  const db = env.DB;
  if (!db) throw new BuildDepsError("missing_binding", "DB");
  const siteOrigin = env.TITANOS_SITE_ORIGIN;
  if (!siteOrigin) throw new BuildDepsError("missing_binding", "TITANOS_SITE_ORIGIN");
  const store = (opts.storeFactory ?? d1StoreFactory)(db, env);
  return {
    store, billing: opts.billing ?? billingFor(env, opts.fetchFn), dns: opts.dns ?? dohResolver(opts.fetchFn),
    mailer: opts.mailer ?? unavailableMailer, now: opts.now ?? (() => Date.now()), siteOrigin,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET || undefined,
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
