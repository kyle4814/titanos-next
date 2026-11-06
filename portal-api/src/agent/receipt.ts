import { hmacSha256Hex, sha256Hex, timingSafeEqual, randomToken } from "../util.ts";
import type { AgentReceipt } from "../store.ts";

export const canonical = (r: Omit<AgentReceipt, "sig" | "idem">) => [r.id, r.tool, r.keyId, r.accountId, r.at, r.inputSha, r.outputSha, r.credits, r.mode].join("|");
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
