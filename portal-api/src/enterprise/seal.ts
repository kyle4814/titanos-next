// SSO client-secret seal/open: AES-256-GCM, versioned envelope, key from an INJECTED binding (a Worker secret in
// production, a generated key in tests). No plaintext secret should reach a store: seal before put, open at use.
// Envelope: "tsl1.<keyId>.<iv>.<ciphertext+tag>" (base64url). AAD binds the envelope to its context (e.g. tenant id),
// so a sealed value copied onto another tenant's row fails to open. Rotation: keyring holds old ids, `current` seals.
export interface SealKeyring { current: string; keys: Record<string, string> } // keys: keyId -> base64url of 32 raw bytes
export class SealError extends Error { code: string; constructor(code: string) { super(code); this.code = code; } }

const enc = new TextEncoder();
const b64u = (u: Uint8Array) => { let s = ""; for (const x of u) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = (s: string) => {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new SealError("bad_envelope");
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  try { return Uint8Array.from(atob(p), (c) => c.charCodeAt(0)); } catch { throw new SealError("bad_envelope"); }
};
async function aesKey(ring: SealKeyring, id: string, usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const raw = Object.prototype.hasOwnProperty.call(ring.keys ?? {}, id) ? ring.keys[id] : undefined;
  if (typeof raw !== "string") throw new SealError("unknown_key");
  const bytes = unb64u(raw);
  if (bytes.length !== 32) throw new SealError("bad_key");
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [usage]);
}
export const isSealed = (v: unknown): v is string => typeof v === "string" && v.startsWith("tsl1.");

export async function sealSecret(ring: SealKeyring, plaintext: string, context: string): Promise<string> {
  if (typeof plaintext !== "string" || !plaintext) throw new SealError("empty_secret");
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(ring?.current ?? "")) throw new SealError("bad_key");
  const key = await aesKey(ring, ring.current, "encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(12));                       // fresh random 96-bit IV per seal
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(context) }, key, enc.encode(plaintext)));
  return `tsl1.${ring.current}.${b64u(iv)}.${b64u(ct)}`;
}
export async function openSecret(ring: SealKeyring, envelope: string, context: string): Promise<string> {
  if (typeof envelope !== "string" || envelope.length > 4096) throw new SealError("bad_envelope");
  const p = envelope.split(".");
  if (p.length !== 4 || p[0] !== "tsl1") throw new SealError("bad_envelope");
  const iv = unb64u(p[2]), ct = unb64u(p[3]);
  if (iv.length !== 12 || ct.length < 17) throw new SealError("bad_envelope");
  const key = await aesKey(ring, p[1], "decrypt");
  try {
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: enc.encode(context) }, key, ct));
  } catch { throw new SealError("decrypt_failed"); }                            // wrong key, wrong context or tampered: one opaque error
}
export const newSealKey = (): string => b64u(crypto.getRandomValues(new Uint8Array(32)));
