import { hmacSha256Hex, sha256Hex, timingSafeEqual, randomToken } from "../util.ts";
import type { AgentReceipt } from "../store.ts";

// kid is part of the signed text, so editing a receipt's kid to point at another secret fails the signature, not just the lookup.
export const canonical = (r: Omit<AgentReceipt, "sig" | "idem">) => [r.id, r.tool, r.keyId, r.accountId, r.at, r.inputSha, r.outputSha, r.credits, r.mode, ...(r.kid ? [r.kid] : [])].join("|");

// Versioned receipt secrets (F48). Sign with `current`; verify accepts `current` and ONE `previous`. Rotating twice drops the oldest.
export interface ReceiptSecret { kid: string; secret: string }
export interface ReceiptKeyring { current: ReceiptSecret; previous?: ReceiptSecret }
export const rotate = (ring: ReceiptKeyring, next: ReceiptSecret): ReceiptKeyring => {
  if (!next.kid || !next.secret) throw new Error("rotate needs a kid and a secret");
  if (next.kid === ring.current.kid || next.kid === ring.previous?.kid) throw new Error("kid already used");
  return { current: next, previous: ring.current };
};
// A deployment that only sets the single RECEIPT_SECRET gets kid "k1"; setting a keyring is how rotation starts.
export const ringOf = (d: { receiptKeyring?: ReceiptKeyring; receiptSecret?: string }): ReceiptKeyring | undefined =>
  d.receiptKeyring ?? (d.receiptSecret ? { current: { kid: "k1", secret: d.receiptSecret } } : undefined);
export async function signWithRing(ring: ReceiptKeyring, r: Omit<AgentReceipt, "sig" | "kid">): Promise<AgentReceipt> {
  const body = { ...r, kid: ring.current.kid };
  return { ...body, sig: await hmacSha256Hex(ring.current.secret, canonical(body)) };
}
export async function verifyWithRing(ring: ReceiptKeyring | undefined, r: AgentReceipt): Promise<boolean> {
  if (!ring || typeof r.kid !== "string" || !r.kid) return false; // unknown or missing kid is refused, never retried against every secret
  const hit = [ring.current, ring.previous].find((k) => k && k.kid === r.kid);
  if (!hit || !hit.secret) return false;
  return timingSafeEqual(r.sig, await hmacSha256Hex(hit.secret, canonical(r)));
}
export async function signReceipt(secret: string, r: Omit<AgentReceipt, "sig">): Promise<AgentReceipt> {
  return { ...r, sig: await hmacSha256Hex(secret, canonical(r)) };
}
export async function verifyReceipt(secret: string, r: AgentReceipt): Promise<boolean> {
  if (!secret) return false;
  return timingSafeEqual(r.sig, await hmacSha256Hex(secret, canonical(r)));
}
export const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
export const hashOf = (v: unknown) => sha256Hex(stable(v));
export const newReceiptId = () => randomToken("rcpt", 12);
