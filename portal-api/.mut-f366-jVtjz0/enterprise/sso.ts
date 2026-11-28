import type { IdpClaims, IdpVerifier, SsoConfig } from "./types.ts";
import { timingSafeEqual } from "../util.ts";

const enc = new TextEncoder();
const b64u = (b: Uint8Array | string) => {
  const u = typeof b === "string" ? enc.encode(b) : b;
  let s = "";
  for (const x of u) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64u = (s: string) => {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(p), (c) => c.charCodeAt(0)));
};
async function hmac(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg))));
}

export class SsoError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}

// MOCK IdP: HS256 id tokens signed with the tenant's shared secret. A real IdP signs RS256 and publishes a JWKS;
// that verifier is NOT BUILT (PENDING LIVE, needs a real IdP tenant). Every check below is one a real verifier must
// also make: alg pinned, issuer, audience, expiry, issued-at skew, nonce (checked by the caller) and verified email.
export const MockIdp: IdpVerifier & {
  sign(cfg: Pick<SsoConfig, "secret">, claims: Record<string, unknown>, header?: Record<string, unknown>): Promise<string>;
} = {
  async sign(cfg, claims, header = { alg: "HS256", typ: "JWT" }) {
    const h = b64u(JSON.stringify(header)), p = b64u(JSON.stringify(claims));
    return `${h}.${p}.${await hmac(cfg.secret, `${h}.${p}`)}`;
  },
  async verify(cfg, idToken, nowMs): Promise<IdpClaims> {
    if (typeof idToken !== "string" || idToken.length > 8192) throw new SsoError("bad_token");
    const parts = idToken.split(".");
    if (parts.length !== 3) throw new SsoError("bad_token");
    let header: any, c: any;
    try { header = JSON.parse(unb64u(parts[0])); c = JSON.parse(unb64u(parts[1])); } catch { throw new SsoError("bad_token"); }
    if (!header || header.alg !== "HS256") throw new SsoError("bad_alg"); // rejects alg:none and any downgrade
    if (!timingSafeEqual(await hmac(cfg.secret, `${parts[0]}.${parts[1]}`), parts[2])) throw new SsoError("bad_signature");
    if (!c || typeof c !== "object") throw new SsoError("bad_token");
    if (c.iss !== cfg.issuer) throw new SsoError("bad_issuer");
    if (c.aud !== cfg.clientId) throw new SsoError("bad_audience"); // string equality: an array aud is refused
    const now = Math.floor(nowMs / 1000);
    if (typeof c.exp !== "number" || c.exp <= now) throw new SsoError("expired");
    if (typeof c.iat !== "number" || c.iat > now + 60) throw new SsoError("bad_iat");
    if (c.email_verified !== true) throw new SsoError("email_not_verified");
    if (typeof c.email !== "string" || typeof c.sub !== "string" || typeof c.nonce !== "string") throw new SsoError("bad_token");
    return c as IdpClaims;
  },
};
