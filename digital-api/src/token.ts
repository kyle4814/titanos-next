// Signed download tokens. Format: "v1.<base64url(json payload)>.<hex hmac-sha256 of the first two parts>".
// The token proves "this order may fetch this file until exp". Revocation and the 5-download cap are NOT in the token
// (a token cannot be recalled); they are enforced against the order row on every download (store.consumeDownload).
import { hmacSha256Hex, timingSafeEqual } from "../../portal-api/src/util.ts";

export const TOKEN_TTL_SEC = 7 * 24 * 3600;
export const MAX_DOWNLOADS = 5;
export interface TokenPayload { o: string; s: string; e: number }   // order id, slug, expiry (epoch seconds)
export type TokenCheck = { ok: true; payload: TokenPayload } | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

const enc = new TextEncoder(), dec = new TextDecoder();
function b64u(bytes: Uint8Array): string { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function unb64u(s: string): Uint8Array { const p = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4); const bin = atob(p); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); }

export async function mintToken(payload: TokenPayload, secret: string): Promise<string> {
  if (!secret || secret.length < 16) throw new Error("token_secret_too_short");
  const body = b64u(enc.encode(JSON.stringify({ o: payload.o, s: payload.s, e: payload.e })));
  return `v1.${body}.${await hmacSha256Hex(secret, `v1.${body}`)}`;
}

export async function verifyToken(token: unknown, secret: string | undefined, nowSec: number): Promise<TokenCheck> {
  if (typeof token !== "string" || token.length > 600 || !secret) return { ok: false, reason: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[0-9a-f]{64}$/.test(parts[2])) return { ok: false, reason: "malformed" };
  const expected = await hmacSha256Hex(secret, `v1.${parts[1]}`);
  if (!timingSafeEqual(parts[2], expected)) return { ok: false, reason: "bad_signature" };   // signature is checked BEFORE the payload is trusted or parsed further
  let p: any;
  try { p = JSON.parse(dec.decode(unb64u(parts[1]))); } catch { return { ok: false, reason: "malformed" }; }
  if (!p || typeof p.o !== "string" || typeof p.s !== "string" || typeof p.e !== "number" || !Number.isFinite(p.e)) return { ok: false, reason: "malformed" };
  if (nowSec >= p.e) return { ok: false, reason: "expired" };
  return { ok: true, payload: { o: p.o, s: p.s, e: p.e } };
}
