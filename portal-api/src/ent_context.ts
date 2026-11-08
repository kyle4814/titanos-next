// C8 f314: the production construction point for d.ent (the enterprise context). ONE function, buildEnterpriseDeps(env, seams).
// FAIL CLOSED: it returns an EntContext with EVERY member present, or throws a typed EntBuildError naming the missing binding or
// adapter (a NAME, never a value). It never returns a partial object and never invents a default tenant: there is no tenant id
// anywhere in this file, tenancy lives in the per-request session guard and in the EntStore methods that take a tenant id.
// Bindings used: DB (D1), INTERNAL_API_SECRET, ENT_SEAL_KEYS. There is no KV binding on this Worker (Env has none), so the estate
// cache and refresh limiter are per-isolate memory, keyed per tenant (UNKNOWN: a shared adapter is the follow-on).
// What has NO production adapter on disk is a seam, and an absent seam is a typed refusal, never a Memory fallback:
//   storeFactory (D1 EntStore), approvals (D1 ApprovalStore), payouts + payoutLookup (Stripe Connect transfers = GATE2), idp (built from the IDP_JWKS_URIS binding + the fetchJwks seam; absent binding = refusal).
import type { D1Like, Env } from "./env.ts";
import type { EntContext } from "./enterprise/service.ts";
import type { EntStore } from "./enterprise/store.ts";
import type { ApprovalStore } from "./enterprise/payout_decision.ts";
import type { IdpVerifier, PayoutProvider, ScanProvider } from "./enterprise/types.ts";
import type { TransferLookup } from "./enterprise/payout_sweep.ts";
import type { SealKeyring } from "./enterprise/seal.ts";
import type { SelfDealCheck } from "./enterprise/share.ts";
import { RATE_V1 } from "./enterprise/share.ts";
import { makeBookFacts } from "./enterprise/book_facts.ts";
import { estateCache, type EstateCache } from "./enterprise/estate_cache.ts";
import { MemoryRefreshLimiter, type RefreshLimiter } from "./enterprise/estate_refresh.ts";
import { dnsScan, publicDohResolver } from "./enterprise/estate_dns.ts";
import { createIdpVerifier, httpJwksFetcher, isSafeJwksUrl, type UrlJwksFetcher } from "./enterprise/idp_verifier.ts";

export type EntBuildReason = "missing_binding" | "bad_binding" | "adapter_unavailable";
export class EntBuildError extends Error {
  readonly reason: EntBuildReason; readonly binding: string;
  constructor(reason: EntBuildReason, binding: string) { super(`${reason}:${binding}`); this.name = "EntBuildError"; this.reason = reason; this.binding = binding; }
}
export type EntEnv = Pick<Env, "DB" | "INTERNAL_API_SECRET" | "ENT_SEAL_KEYS" | "IDP_JWKS_URIS">;
export interface EntSeams {
  storeFactory?: (db: D1Like, env: EntEnv) => EntStore;
  approvals?: (db: D1Like, env: EntEnv) => ApprovalStore;
  payouts?: PayoutProvider; payoutLookup?: TransferLookup;
  idp?: IdpVerifier; fetchJwks?: UrlJwksFetcher; fetchFn?: typeof fetch;
  scan?: ScanProvider;
  accounts?: { accountById(id: string): Promise<{ id: string; email: string; createdAt: number } | undefined> };   // the billing store: feeds the self-deal check
  now?: () => number;
}

export function parseSealKeys(raw: string): SealKeyring {
  let k: unknown;
  try { k = JSON.parse(raw); } catch { throw new EntBuildError("bad_binding", "ENT_SEAL_KEYS"); }
  const o = k as { current?: unknown; keys?: unknown };
  if (!o || typeof o !== "object" || typeof o.current !== "string" || !o.current || !o.keys || typeof o.keys !== "object") throw new EntBuildError("bad_binding", "ENT_SEAL_KEYS");
  const keys = o.keys as Record<string, unknown>;
  if (typeof keys[o.current] !== "string" || !Object.values(keys).every((v) => typeof v === "string" && v)) throw new EntBuildError("bad_binding", "ENT_SEAL_KEYS");
  return { current: o.current, keys: keys as Record<string, string> };
}

export function parseIdpJwksUris(raw: string): Record<string, string> {
  let k: unknown;
  try { k = JSON.parse(raw); } catch { throw new EntBuildError("bad_binding", "IDP_JWKS_URIS"); }
  if (!k || typeof k !== "object" || Array.isArray(k)) throw new EntBuildError("bad_binding", "IDP_JWKS_URIS");
  const e = Object.entries(k as Record<string, unknown>);
  if (!e.length || !e.every(([iss, u]) => typeof u === "string" && isSafeJwksUrl(iss) && isSafeJwksUrl(u))) throw new EntBuildError("bad_binding", "IDP_JWKS_URIS");
  return Object.fromEntries(e) as Record<string, string>;
}

// One cache + limiter per DB binding object, so every request on an isolate shares them (buildDeps runs per request). Keyed per tenant inside.
const shared = new WeakMap<object, { cache: EstateCache; limiter: RefreshLimiter; scan: ScanProvider }>();

export function buildEnterpriseDeps(env: EntEnv, seams: EntSeams = {}): EntContext {
  const db = env.DB;
  if (!db) throw new EntBuildError("missing_binding", "DB");
  if (!env.INTERNAL_API_SECRET) throw new EntBuildError("missing_binding", "INTERNAL_API_SECRET");
  if (!env.ENT_SEAL_KEYS) throw new EntBuildError("missing_binding", "ENT_SEAL_KEYS");
  const sealKeys = parseSealKeys(env.ENT_SEAL_KEYS);
  if (!seams.storeFactory) throw new EntBuildError("adapter_unavailable", "store");
  if (!seams.approvals) throw new EntBuildError("adapter_unavailable", "approvals");
  if (!seams.payouts) throw new EntBuildError("adapter_unavailable", "payouts");
  if (!seams.payoutLookup) throw new EntBuildError("adapter_unavailable", "payoutLookup");
  // idp: a supplied verifier wins; else it is BUILT only when the IDP_JWKS_URIS binding (issuer -> jwks url) is present. Absent = typed refusal.
  const idpUrls = env.IDP_JWKS_URIS ? parseIdpJwksUris(env.IDP_JWKS_URIS) : undefined;
  const idp = seams.idp ?? (idpUrls ? createIdpVerifier({ fetchJwks: seams.fetchJwks ?? httpJwksFetcher(seams.fetchFn ?? fetch), jwksUrls: idpUrls }) : undefined);
  if (!idp) throw new EntBuildError("adapter_unavailable", "idp");
  const book = makeBookFacts(env);
  if (!book) throw new EntBuildError("missing_binding", "DB");
  let s = shared.get(db);
  if (!s) {
    const scan = seams.scan ?? dnsScan({ resolver: publicDohResolver(), resolverSource: "cloudflare-dns.com (DNS-over-HTTPS, passive public records)", now: seams.now });
    s = { scan, cache: estateCache({ inner: scan, now: seams.now }), limiter: new MemoryRefreshLimiter(seams.now ?? (() => Date.now())) };
    shared.set(db, s);
  }
  const accounts = seams.accounts;
  const selfDeal: SelfDealCheck | undefined = accounts
    ? { party: async (id) => { const a = await accounts.accountById(id); return a ? { accountId: a.id, email: a.email, createdAt: a.createdAt } : undefined; } }
    : undefined;
  if (!selfDeal) throw new EntBuildError("adapter_unavailable", "accounts");
  return {
    store: seams.storeFactory(db, env), approvals: seams.approvals(db, env), idp, payouts: seams.payouts, payoutLookup: seams.payoutLookup,
    scan: s.scan, rates: RATE_V1, internalSecret: env.INTERNAL_API_SECRET, sealKeys, selfDeal, book, estateCache: s.cache, refreshLimiter: s.limiter,
  };
}
