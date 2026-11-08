// C4 attribution (F-C4 backfill). Pure functions only: no store, no clock, no network, no money. The service calls them and acts on the verdict.
//  (a) judgeAttribution: a pro is paid only when the re-proof pass follows the pro's recorded delivery, not an owner's own DNS change.
//  (b) washTradeFlags: the same payer fingerprint or email-domain pair funding and claiming repeated jobs is excluded from RANK. Payment is not blocked.
//  (c) clawbackFor: a warranty regression after pay yields a LEDGER entry. No money moves here; the transfer stays a GATE1 card.
//  (d) mayRaisePayoutCard: a denied payout card is not re-raised on the next sweep unless the proof has changed.
import type { Job } from "./store.ts";

export const WARRANTY_WINDOW_DAYS = 30;   // mirrors rank.ts WARRANTY_DAYS (kept local so rank.ts can import this file without a cycle)
const DAY = 86_400_000;

// ---------- (a) who fixed it ----------
// Where an observation of the check came from. Only the first four are PRE-DELIVERY evidence; "rescan" is the proof attempt itself.
export type ObsSrc = "baseline" | "claim" | "watch" | "owner" | "rescan";
export interface Obs { at: number; status: string; src: ObsSrc }
export interface OwnerEvent { at: number; kind: string; check?: string }   // subset of the owner seat's event log
export interface AttributionVerdict { pay: boolean; reason: "pass_follows_delivery" | "no_delivery_recorded" | "fix_observed_before_delivery"; evidenceAt?: number; evidenceSrc?: string }

const FAULT = (s: string) => s === "FAIL" || s === "WARN";
// Owner events that mean the OWNER (not the pro) changed or saw the DNS fixed: their own auto-fix, or their own scan proving it.
const OWNER_FIX_KINDS = new Set(["fix_applied", "proven_fixed"]);

export function judgeAttribution(j: Pick<Job, "check" | "deliveredAt"> & { observations?: Obs[] }, ownerEvents: OwnerEvent[] = []): AttributionVerdict {
  if (j.deliveredAt === undefined) return { pay: false, reason: "no_delivery_recorded" };
  const cut = j.deliveredAt;
  const pre = (j.observations ?? []).filter((o) => o.src !== "rescan" && o.at <= cut);
  const lastFault = pre.filter((o) => FAULT(o.status)).reduce((m, o) => Math.max(m, o.at), -Infinity);
  const ownerFix = ownerEvents.filter((e) => OWNER_FIX_KINDS.has(e.kind) && e.check === j.check && e.at <= cut).map((e) => ({ at: e.at, src: "owner:" + e.kind }));
  const seenPass = pre.filter((o) => o.status === "PASS").map((o) => ({ at: o.at, src: o.src }));
  // evidence of a fixed state before delivery counts only if no fault was seen after it (a fault that came back resets the clock)
  const hit = [...ownerFix, ...seenPass].filter((e) => e.at >= lastFault).sort((a, b) => a.at - b.at)[0];
  if (hit) return { pay: false, reason: "fix_observed_before_delivery", evidenceAt: hit.at, evidenceSrc: hit.src };
  return { pay: true, reason: "pass_follows_delivery" };
}

// ---------- (b) wash trade ----------
// Free-mail domains say nothing about who someone is: two gmail users are strangers. Only an organisational domain pair is a signal.
export const FREE_MAIL = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "ymail.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "bigpond.com", "optusnet.com.au", "aol.com", "gmx.com"]);
export const WASH_MIN_REPEATS = 2;   // EXAMPLE threshold: the second job on the same link flags both
export const emailDomain = (email: string): string | undefined => { const m = /@([^@\s]+)$/.exec(email.trim().toLowerCase()); return m ? m[1] : undefined; };
export type WashJob = Pick<Job, "id" | "status" | "ownerAccountId" | "proAccountId"> & Partial<Pick<Job, "payerFp" | "proPayerFp" | "ownerEmailDomain" | "proEmailDomain">>;
const COUNTED = new Set(["claimed", "delivered", "reproved", "paid", "disputed"]);

/** Returns job id -> why it is flagged. Flagged jobs still pay; they simply never count for rank. */
export function washTradeFlags(jobs: WashJob[]): Map<string, string> {
  const groups = new Map<string, WashJob[]>();
  const add = (k: string, j: WashJob) => { const g = groups.get(k); if (g) g.push(j); else groups.set(k, [j]); };
  for (const j of jobs) {
    if (!j.proAccountId || !COUNTED.has(j.status)) continue;
    const pro = j.proAccountId;
    if (j.payerFp && j.proPayerFp && j.payerFp === j.proPayerFp) add(`shared_card|${pro}|${j.payerFp}`, j);
    const od = j.ownerEmailDomain?.toLowerCase(), pd = j.proEmailDomain?.toLowerCase();
    if (od && pd && od === pd && !FREE_MAIL.has(od)) add(`domain_pair|${pro}|${od}`, j);
    if (j.payerFp) add(`one_card_many_owners|${pro}|${j.payerFp}`, j);
  }
  const out = new Map<string, string>();
  for (const [k, g] of groups) {
    const kind = k.split("|")[0];
    if (kind === "one_card_many_owners") { if (new Set(g.map((j) => j.ownerAccountId)).size < WASH_MIN_REPEATS) continue; }
    else if (g.length < WASH_MIN_REPEATS) continue;
    for (const j of g) if (!out.has(j.id)) out.set(j.id, kind);
  }
  return out;
}

// ---------- (c) clawback ledger ----------
export interface Clawback { id: string; jobId: string; proAccountId: string; amountCents: number; at: number; reason: string; transferId?: string; status: "recorded" | "approved_awaiting_transfer" | "waived"; moneyMoved: false }
export function clawbackFor(j: Pick<Job, "id" | "status" | "proAccountId" | "payout" | "proof" | "regressedAt" | "clawbacks" | "check">, now: number): Clawback | null {
  if (j.status !== "paid" || j.payout?.status !== "paid" || !j.proAccountId || !j.proof || j.regressedAt === undefined) return null;
  if (j.clawbacks?.length) return null;   // one entry per job: idempotent across sweeps
  if (j.regressedAt - j.proof.at > WARRANTY_WINDOW_DAYS * DAY) return null;   // outside the warranty window it is a new fault, not a clawback
  return { id: `cb_${j.id}`, jobId: j.id, proAccountId: j.proAccountId, amountCents: j.payout.amountCents, at: now, reason: `${j.check} regressed ${Math.floor((j.regressedAt - j.proof.at) / DAY)} days after the proof inside the ${WARRANTY_WINDOW_DAYS} day warranty`, transferId: j.payout.transferId, status: "recorded", moneyMoved: false };
}

// ---------- (d) a denied card stays denied ----------
export const proofKey = (j: Pick<Job, "proof">) => (j.proof ? `${j.proof.scanId}@${j.proof.at}` : "");
/** False when Kyle already denied a payout card on THIS proof. A new proof (a fresh re-scan) is new evidence and may raise a card again. */
export function mayRaisePayoutCard(j: Pick<Job, "proof" | "payoutDenied">): boolean {
  return !j.payoutDenied || j.payoutDenied.proofKey !== proofKey(j);
}
