// C8 f318: the PRODUCTION IdpVerifier. It wraps the f25 RS256 verifier (oidc.ts) behind an injected fetchJwks(url) seam and adds what a
// production caller needs that the bare verifier does not: ISSUER PINNING to a configured jwks url (a tenant-supplied issuer string can
// never steer a fetch: SSRF), a TTL on the key cache (a revoked key stops verifying after at most ttlMs), a bounded refetch on an unknown
// kid (one per cooldown, so a forged kid cannot start a fetch storm), a failure backoff, in-flight coalescing, response bounds, and a
// FAIL-CLOSED stance: a fetch error, a bad document or an expired cache never falls back to stale keys.
// No network lives here: the Worker wires httpJwksFetcher(fetch), tests wire a fake. A real IdP tenant is PENDING LIVE (GATE2).
import type { IdpClaims, IdpVerifier, SsoConfig } from "./types.ts";
import { SsoError } from "./sso.ts";
import { createOidcVerifier, type Jwks } from "./oidc.ts";

export type UrlJwksFetcher = (url: string) => Promise<Jwks>;
export interface IdpVerifierOptions {
  fetchJwks: UrlJwksFetcher;
  jwksUrls: Record<string, string>;   // issuer -> https jwks url: the ONLY urls this verifier will ever fetch
  ttlMs?: number;                     // key cache lifetime, default 10 min, clamped 60 s .. 24 h
  refetchCooldownMs?: number;         // min gap between two fetches for one issuer on an unknown kid, default 30 s, floor 1 s
  failureBackoffMs?: number;          // after a failed fetch, no new fetch for this long, default 15 s, floor 1 s
  skewSec?: number;                   // clock skew allowance, default 60, clamped 0 .. 300
  maxKeys?: number;                   // keys taken from one document, default 32
}

export const IDP_DEFAULTS = { ttlMs: 600_000, refetchCooldownMs: 30_000, failureBackoffMs: 15_000, skewSec: 60, maxKeys: 32 } as const;
const clamp = (v: number | undefined, d: number, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** https only, no credentials, no fragment: the single shape of url the verifier accepts. */
export function isSafeJwksUrl(u: string): boolean {
  try { const p = new URL(u); return p.protocol === "https:" && !p.username && !p.password && !p.hash && !!p.hostname; } catch { return false; }
}

interface IssuerState { oidc: ReturnType<typeof createOidcVerifier>; loadedAt: number; failedAt?: number }

export function createIdpVerifier(opts: IdpVerifierOptions): IdpVerifier {
  const ttl = clamp(opts.ttlMs, IDP_DEFAULTS.ttlMs, 60_000, 86_400_000);
  const cooldown = clamp(opts.refetchCooldownMs, IDP_DEFAULTS.refetchCooldownMs, 1_000, 86_400_000);
  const backoff = clamp(opts.failureBackoffMs, IDP_DEFAULTS.failureBackoffMs, 1_000, 3_600_000);
  const skew = clamp(opts.skewSec, IDP_DEFAULTS.skewSec, 0, 300);
  const maxKeys = clamp(opts.maxKeys, IDP_DEFAULTS.maxKeys, 1, 256);
  const urls = new Map(Object.entries(opts.jwksUrls).filter(([iss, u]) => isSafeJwksUrl(iss) && isSafeJwksUrl(u)));
  const states = new Map<string, IssuerState>();
  const inflight = new Map<string, Promise<Jwks>>();
  let clock = 0;   // newest caller-supplied time seen: the single clock (verify() is handed nowMs; no hidden Date.now)

  function newState(issuer: string, url: string, at: number): IssuerState {
    const st: IssuerState = {
      loadedAt: at,
      oidc: createOidcVerifier({
        skewSec: skew, refetchCooldownMs: cooldown,
        fetchJwks: async () => {
          if (st.failedAt !== undefined && clock - st.failedAt < backoff) throw new SsoError("jwks_unavailable"); // backoff: do not hammer a failing IdP
          let p = inflight.get(url);
          if (!p) {
            p = (async () => {
              const doc = await opts.fetchJwks(url);
              if (!doc || typeof doc !== "object" || !Array.isArray((doc as Jwks).keys)) throw new SsoError("jwks_unavailable");
              return { keys: doc.keys.slice(0, maxKeys) };
            })().finally(() => inflight.delete(url));
            inflight.set(url, p);
          }
          try { const out = await p; st.failedAt = undefined; return out; }
          catch { st.failedAt = clock; throw new SsoError("jwks_unavailable"); }
        },
      }),
    };
    return st;
  }

  return {
    async verify(cfg: SsoConfig, idToken: string, nowMs: number): Promise<IdpClaims> {
      if (typeof nowMs !== "number" || !Number.isFinite(nowMs)) throw new SsoError("bad_token");
      clock = Math.max(clock, nowMs);
      if (!cfg || typeof cfg.issuer !== "string" || typeof cfg.clientId !== "string" || !cfg.clientId) throw new SsoError("bad_issuer");
      const url = urls.get(cfg.issuer);
      if (!url) throw new SsoError("bad_issuer");   // not pinned: refused before any key is touched and before any fetch
      let st = states.get(cfg.issuer);
      if (st && nowMs - st.loadedAt >= ttl) { states.delete(cfg.issuer); st = undefined; }   // TTL: drop every key, fail closed on the next fetch error
      if (!st) { st = newState(cfg.issuer, url, nowMs); states.set(cfg.issuer, st); }
      return st.oidc.verifyIdToken(idToken, { issuer: cfg.issuer, clientId: cfg.clientId }, nowMs);
    },
  };
}

/** The Worker's JWKS fetcher: GET, https only, no redirects, 5 s timeout, 64 KB cap, JSON object with a keys array. Anything else throws. */
export function httpJwksFetcher(fetchFn: typeof fetch = fetch, timeoutMs = 5_000, maxBytes = 65_536): UrlJwksFetcher {
  return async (url) => {
    if (!isSafeJwksUrl(url)) throw new Error("unsafe_url");
    const res = await fetchFn(url, { method: "GET", redirect: "error", headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== 200) throw new Error("status");
    const text = await res.text();
    if (text.length > maxBytes) throw new Error("too_large");
    const doc = JSON.parse(text);
    if (!doc || typeof doc !== "object" || !Array.isArray(doc.keys)) throw new Error("bad_document");
    return doc as Jwks;
  };
}
