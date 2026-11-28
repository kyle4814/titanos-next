import type { Party } from "./types.ts";

// F5: partner self-dealing through a SECOND account. A PURE heuristic: no store, no clock, no network. It never denies
// anything; it only says SELF-DEAL-SUSPECT so the commission is held for the operator's tap. MODELLED: it has never seen
// live traffic, so its false-positive and false-negative rates are UNKNOWN (see the receipt).

// Shared mailboxes: a common domain here proves nothing. EXAMPLE list, extend from real traffic; injected, never hard-wired.
export const FREE_MAIL: readonly string[] = [
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "yahoo.com.au", "ymail.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.net", "zoho.com", "mail.com",
  "bigpond.com", "bigpond.net.au", "optusnet.com.au", "tpg.com.au", "iinet.net.au", "internode.on.net", "fastmail.com", "hey.com",
];
export const SIGNUP_WINDOW_MS = 24 * 3_600_000; // EXAMPLE: 24 hours

export type SuspectReason = "shared_email_domain" | "payer_fingerprint" | "signup_burst_same_network";

// Lower-case, trim. Gmail-style plus-addressing is stripped from the local part. The domain is what the rules use.
export function normaliseEmail(raw: string): string {
  const s = String(raw ?? "").trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at <= 0 || at === s.length - 1) return s;
  const local = s.slice(0, at).split("+")[0], domain = s.slice(at + 1).replace(/\.+$/, "");
  return `${local}@${domain}`;
}
export function emailDomain(raw: string): string | undefined {
  const n = normaliseEmail(raw), at = n.lastIndexOf("@");
  return at > 0 && at < n.length - 1 ? n.slice(at + 1) : undefined;
}
const clean = (v?: string) => { const t = (v ?? "").trim(); return t === "" ? undefined : t; };

export interface SelfDealOptions { freeMail?: readonly string[]; windowMs?: number }
export interface SelfDealVerdict { suspect: boolean; reasons: SuspectReason[] }

// referrers = every account that belongs to the referring partner tenant; referee = the account whose spend earns.
export function detectSelfDeal(referrers: Party[], referee: Party, o: SelfDealOptions = {}): SelfDealVerdict {
  const free = new Set((o.freeMail ?? FREE_MAIL).map((d) => d.toLowerCase()));
  const windowMs = o.windowMs ?? SIGNUP_WINDOW_MS;
  const reasons = new Set<SuspectReason>();
  const refDomain = emailDomain(referee.email), refFp = clean(referee.payerFingerprint), refNet = clean(referee.signupNet);
  for (const r of referrers) {
    if (r.accountId === referee.accountId) continue; // same account is blocked upstream (self_referral)
    const d = emailDomain(r.email);
    if (d && refDomain && d === refDomain && !free.has(d)) reasons.add("shared_email_domain");
    const fp = clean(r.payerFingerprint);
    if (fp && refFp && fp === refFp) reasons.add("payer_fingerprint");
    const net = clean(r.signupNet);
    if (net && refNet && net === refNet && Math.abs(r.createdAt - referee.createdAt) <= windowMs) reasons.add("signup_burst_same_network");
  }
  return { suspect: reasons.size > 0, reasons: [...reasons].sort() };
}
