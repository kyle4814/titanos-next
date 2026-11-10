// RS256 OIDC id_token verifier (WebCrypto only, no network of its own).
// Keys come from a JWKS passed in, or from an INJECTED fetcher (the Worker wires fetch(); tests wire a stub).
// What it enforces: alg pinned to RS256 (none/HS256/anything else refused before any key is touched), kid lookup,
// RSA >= 2048 bit, iss/aud(+azp)/exp/nbf/iat with a small clock skew, optional nonce, verified email.
// Rotation: an unknown kid triggers ONE refetch (rate-limited by a cooldown so a flood of junk kids cannot hammer the IdP).
// A real IdP tenant is PENDING LIVE: nothing here talks to a network or reads a secret.
import type { IdpClaims } from "./types.ts";
import { SsoError } from "./sso.ts";

export interface Jwk { kty: string; kid?: string; use?: string; alg?: string; key_ops?: string[]; n?: string; e?: string }
export interface Jwks { keys: Jwk[] }
export type JwksFetcher = (issuer: string) => Promise<Jwks>;
export interface OidcOptions {
  jwks?: Jwks;                 // static keys (tests, or pinned keys)
  fetchJwks?: JwksFetcher;     // injected fetcher, called for the first load and for ONE refetch on an unknown kid
  skewSec?: number;            // default 60
  refetchCooldownMs?: number;  // default 30_000: minimum gap between two fetches for one issuer
  maxTokenLen?: number;        // default 8192
}
export interface OidcExpect { issuer: string; clientId: string; nonce?: string }

const MIN_MODULUS_BITS = 2048;
const dec = new TextDecoder();
function unb64uBytes(s: string): Uint8Array {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]*$/.test(s)) throw new SsoError("bad_token");
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  try { return Uint8Array.from(atob(p), (c) => c.charCodeAt(0)); } catch { throw new SsoError("bad_token"); }
}
const jsonPart = (s: string): any => { try { return JSON.parse(dec.decode(unb64uBytes(s))); } catch { throw new SsoError("bad_token"); } };
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

async function importRsa(jwk: Jwk): Promise<CryptoKey | null> {
  if (jwk.kty !== "RSA" || typeof jwk.n !== "string" || typeof jwk.e !== "string") return null;
  if (jwk.use !== undefined && jwk.use !== "sig") return null;
  if (jwk.alg !== undefined && jwk.alg !== "RS256") return null;
  if (jwk.key_ops !== undefined && !jwk.key_ops.includes("verify")) return null;
  try {
    const nBytes = unb64uBytes(jwk.n);
    const lead = nBytes.findIndex((x) => x !== 0);
    if (lead < 0 || (nBytes.length - lead) * 8 < MIN_MODULUS_BITS) return null;
    return await crypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  } catch { return null; }
}

interface IssuerCache { keys: Map<string, CryptoKey>; fetchedAt: number }

export function createOidcVerifier(opts: OidcOptions) {
  const skew = opts.skewSec ?? 60, cooldown = opts.refetchCooldownMs ?? 30_000, maxLen = opts.maxTokenLen ?? 8192;
  const caches = new Map<string, IssuerCache>();

  async function load(set: Jwks): Promise<Map<string, CryptoKey>> {
    const m = new Map<string, CryptoKey>();
    if (!isObj(set) || !Array.isArray((set as Jwks).keys)) return m;
    for (const j of set.keys) {
      if (!isObj(j) || typeof j.kid !== "string" || m.has(j.kid)) continue; // duplicate kid: first wins, never ambiguous
      const k = await importRsa(j);
      if (k) m.set(j.kid, k);
    }
    return m;
  }
  async function keyFor(issuer: string, kid: string, nowMs: number): Promise<CryptoKey> {
    let c = caches.get(issuer);
    if (!c) {
      const src = opts.jwks ?? (opts.fetchJwks ? await opts.fetchJwks(issuer).catch(() => { throw new SsoError("jwks_unavailable"); }) : undefined);
      if (!src) throw new SsoError("jwks_unavailable");
      c = { keys: await load(src), fetchedAt: nowMs };
      caches.set(issuer, c);
      const hit = c.keys.get(kid);
      if (hit) return hit;
      throw new SsoError("unknown_kid"); // just loaded: a second fetch now would add nothing
    }
    const hit = c.keys.get(kid);
    if (hit) return hit;
    if (opts.fetchJwks && nowMs - c.fetchedAt >= cooldown) {           // rotation: exactly one refetch
      c.fetchedAt = nowMs;                                              // stamped first so a failing IdP is also rate-limited
      const fresh = await load(await opts.fetchJwks(issuer).catch(() => { throw new SsoError("jwks_unavailable"); }));
      if (fresh.size) c.keys = fresh;
      const k2 = c.keys.get(kid);
      if (k2) return k2;
    }
    throw new SsoError("unknown_kid");
  }

  async function verifyIdToken(idToken: string, exp: OidcExpect, nowMs: number): Promise<IdpClaims> {
    if (typeof idToken !== "string" || idToken.length > maxLen) throw new SsoError("bad_token");
    const parts = idToken.split(".");
    if (parts.length !== 3 || !parts[2]) throw new SsoError("bad_token");
    const header = jsonPart(parts[0]);
    if (!isObj(header) || header.alg !== "RS256") throw new SsoError("bad_alg"); // none, HS256, ES256, absent: all refused here
    if ("crit" in header) throw new SsoError("bad_token");                       // we understand no critical extensions
    if (typeof header.kid !== "string" || !header.kid) throw new SsoError("bad_token");
    const key = await keyFor(exp.issuer, header.kid, nowMs);
    const sig = unb64uBytes(parts[2]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) throw new SsoError("bad_signature");
    const c = jsonPart(parts[1]);
    if (!isObj(c)) throw new SsoError("bad_token");
    if (c.iss !== exp.issuer) throw new SsoError("bad_issuer");
    const aud = c.aud;
    if (typeof aud === "string") { if (aud !== exp.clientId) throw new SsoError("bad_audience"); }
    else if (Array.isArray(aud) && aud.includes(exp.clientId)) {
      if (aud.length > 1 && c.azp !== exp.clientId) throw new SsoError("bad_audience"); // OIDC core 3.1.3.7: multi-aud needs azp
    } else throw new SsoError("bad_audience");
    if (c.azp !== undefined && c.azp !== exp.clientId) throw new SsoError("bad_audience");
    const now = Math.floor(nowMs / 1000);
    if (typeof c.exp !== "number" || !Number.isFinite(c.exp) || c.exp + skew <= now) throw new SsoError("expired");
    if (c.nbf !== undefined && (typeof c.nbf !== "number" || c.nbf - skew > now)) throw new SsoError("not_yet_valid");
    if (typeof c.iat !== "number" || c.iat - skew > now) throw new SsoError("bad_iat");
    if (c.email_verified !== true) throw new SsoError("email_not_verified");
    if (typeof c.email !== "string" || typeof c.sub !== "string" || !c.sub) throw new SsoError("bad_token");
    if (typeof c.nonce !== "string") throw new SsoError("bad_token");
    if (exp.nonce !== undefined && c.nonce !== exp.nonce) throw new SsoError("bad_nonce");
    return { iss: c.iss as string, aud: exp.clientId, sub: c.sub, email: c.email, email_verified: true, nonce: c.nonce, exp: c.exp, iat: c.iat };
  }
  return {
    verifyIdToken,
    // IdpVerifier-shaped adapter: cfg supplies issuer + clientId (the caller checks the nonce against its stored state).
    verify: (cfg: { issuer: string; clientId: string }, idToken: string, nowMs: number) =>
      verifyIdToken(idToken, { issuer: cfg.issuer, clientId: cfg.clientId }, nowMs),
  };
}
