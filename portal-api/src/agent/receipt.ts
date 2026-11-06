import { hmacSha256Hex, sha256Hex, timingSafeEqual, randomToken } from "../util.ts";
import type { AgentReceipt } from "../store.ts";

// Rotation (F19): secrets are named by a key id (kid). New receipts carry their kid, bound into the signature. A receipt with
// no kid (made before rotation existed) verifies under LEGACY_KID. Retiring a kid (dropping it from the keyring) makes its
// receipts fail verification: fail closed, by design.
export const LEGACY_KID = "k1";
export interface ReceiptKeyring { current: string; secrets: Record<string, string> }
const KID_RE = /^[\w-]{1,32}$/;
// Deps.receiptSecrets + receiptKid win; else the single Deps.receiptSecret is the keyring {k1}. Nothing configured = undefined (calls refused).
export function keyringOf(d: { receiptSecret?: string; receiptSecrets?: Record<string, string>; receiptKid?: string }): ReceiptKeyring | undefined {
  if (d.receiptSecrets && Object.keys(d.receiptSecrets).length) {
    const current = d.receiptKid ?? Object.keys(d.receiptSecrets).at(-1)!;
    return d.receiptSecrets[current] ? { current, secrets: d.receiptSecrets } : undefined;
  }
  return d.receiptSecret ? { current: LEGACY_KID, secrets: { [LEGACY_KID]: d.receiptSecret } } : undefined;
}
export const canonical = (r: Omit<AgentReceipt, "sig" | "idem">) => [r.id, r.tool, r.keyId, r.accountId, r.at, r.inputSha, r.outputSha, r.credits, r.mode, ...(r.kid ? [r.kid] : [])].join("|");
export async function signReceipt(ring: ReceiptKeyring | string, r: Omit<AgentReceipt, "sig" | "kid">): Promise<AgentReceipt> {
  const kr = typeof ring === "string" ? { current: LEGACY_KID, secrets: { [LEGACY_KID]: ring } } : ring;
  const full = { ...r, kid: kr.current };
  return { ...full, sig: await hmacSha256Hex(kr.secrets[kr.current], canonical(full)) };
}
export async function verifyReceipt(ring: ReceiptKeyring | string | undefined, r: AgentReceipt): Promise<boolean> {
  if (!ring) return false;
  const kr = typeof ring === "string" ? (ring ? { current: LEGACY_KID, secrets: { [LEGACY_KID]: ring } } : undefined) : ring;
  if (!kr) return false;
  const kid = r.kid ?? LEGACY_KID;
  if (typeof kid !== "string" || !KID_RE.test(kid) || !Object.prototype.hasOwnProperty.call(kr.secrets, kid) || !kr.secrets[kid]) return false;
  return timingSafeEqual(r.sig, await hmacSha256Hex(kr.secrets[kid], canonical(r)));
}
export const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
export const hashOf = (v: unknown) => sha256Hex(stable(v));
export const newReceiptId = () => randomToken("rcpt", 12);
