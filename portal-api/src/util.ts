// Small crypto and id helpers. Web Crypto only, so the same code runs in a Worker and in node tests.
const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b as ArrayBuffer)].map((x) => x.toString(16).padStart(2, "0")).join("");

export async function sha256Hex(s: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}
export async function hmacSha256Hex(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
export function randomToken(prefix: string, bytes = 24): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return `${prefix}_${hex(b)}`;
}
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
export function normaliseEmail(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const e = s.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}
