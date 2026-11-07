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
import type { OwnerDeps } from "./service.ts";
import { MemoryOwnerStore, type OwnerStore } from "./owner/engine.ts";
import { D1OwnerStore } from "./owner/d1ownerstore.ts";
import { MemoryMarketStore, type MarketStore } from "./market/store.ts";
import { D1MarketStore } from "./market/d1store.ts";
import type { MarketDeps } from "./market/service.ts";
import { MemoryEntStore, type EntStore } from "./enterprise/store.ts";
import { D1EntStore, type SecretSealer } from "./enterprise/d1store.ts";
import type { EntContext } from "./enterprise/service.ts";

export type BuildDepsReason = "missing_binding" | "store_adapter_unavailable" | "live_key_refused";
export class BuildDepsError extends Error {
  readonly reason: BuildDepsReason; readonly binding?: string;
  constructor(reason: BuildDepsReason, binding?: string) { super(binding ? `${reason}:${binding}` : reason); this.name = "BuildDepsError"; this.reason = reason; this.binding = binding; }
}
export type StoreFactory = (db: NonNullable<Env["DB"]>, env: Env) => Store;
// f222: the owner, market and enterprise side stores. durable=true means D1-backed (survives a Worker restart); false means
// per-isolate memory (labelled, never the shipped default). Reads the DB binding only, no secret.
export interface SideStores { owner: OwnerStore; market: MarketStore; ent: EntStore; durable: boolean; label: string }
export type SideStoresFactory = (db: Env["DB"] | undefined, env: Env) => SideStores;
// SSO client secrets are sealed with a Worker secret (GATE2, not bound here). Until that key is bound the sealer refuses, so every
// other enterprise row is durable and an SSO secret is refused (typed) rather than stored in the clear.
export const failClosedSealer: SecretSealer = {
  async seal() { throw new HttpError(503, "sso_sealer_unavailable"); },
  async open() { throw new HttpError(503, "sso_sealer_unavailable"); },
};
// One instance per factory (a Worker builds deps on every request, so a fresh set per call would not even hold within the isolate).
export const memorySideStores = (): SideStoresFactory => {
  const one: SideStores = { owner: new MemoryOwnerStore(), market: new MemoryMarketStore(), ent: new MemoryEntStore(), durable: false, label: "non-durable: per-isolate memory, lost on restart" };
  return () => one;
};
export const memorySideStoresFactory: SideStoresFactory = (db, env) => memorySideStores()(db, env);
export const d1SideStoresFactory: SideStoresFactory = (db, env) => {
  if (!db) return memorySideStoresFactory(db, env);   // direct callers only; buildDeps refuses with no DB before it gets here
  return { owner: new D1OwnerStore(db), market: new D1MarketStore(db), ent: new D1EntStore(db, failClosedSealer), durable: true, label: "durable: D1 over the DB binding" };
};
// Providers the side seats need beyond a store (DoH + zones, job payments, IdP + payouts + scan). None is bound by default: a seat
// whose providers are absent stays 503 (owner_seat_unavailable / marketplace_unavailable / enterprise_unavailable). Binding a
// payments or payout provider is GATE1/GATE2, not this lane.
export interface SideProviders {
  owner?: Omit<OwnerDeps, "store">;
  market?: Omit<MarketDeps, "store">;
  ent?: Omit<EntContext, "store">;
}
export const sideStoresFor = (env: Env, f: SideStoresFactory = d1SideStoresFactory): SideStores => f(env.DB, env);

export interface BuildOpts { sideStoresFactory?: SideStoresFactory; side?: SideProviders; storeFactory?: StoreFactory; billing?: BillingProvider; dns?: TxtResolver; mailer?: Mailer; now?: () => number; fetchFn?: typeof fetch }
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
  const stores = sideStoresFor(env, opts.sideStoresFactory);
  const side = opts.side ?? {};
  return {
    ...(side.owner ? { owner: { store: stores.owner, ...side.owner } } : {}),
    ...(side.market ? { market: { store: stores.market, ...side.market } } : {}),
    ...(side.ent ? { ent: { store: stores.ent, ...side.ent } } : {}),
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
