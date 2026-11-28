// C8 f31: the GATE1 approval card for a payout above AU$1,000, as PURE functions.
// Nothing here sends, stores, calls a network or moves money. The Telegram send path and the transfer
// stay GATE1/GATE4 (see the f31 receipt, CARD NEEDED). Deny-then-resweep dedupe belongs to f28, not here.
import { APPROVAL_ABOVE_CENTS } from "./share.ts";
import type { Payout, PayoutStatus } from "./types.ts";

// The decision layer adds two states on top of the ledger's PayoutStatus. "approved" means Kyle tapped yes;
// the transfer itself is a separate GATE1 step and is NOT started by this module.
export type DecisionStatus = PayoutStatus | "approved" | "denied";
export type CardPayout = Omit<Payout, "status"> & { status: DecisionStatus };
export type Decision = "approve" | "deny";

export interface PayoutCard {
  cardId: string;          // stable: same payout id + amount gives the same id, so a resend is one card
  payoutId: string;
  tenantId: string;        // the partner tenant that owns the payout
  amountCents: number;
  text: string;            // WHAT / WHY / COST / REVERSIBLE / approve-deny
}

export const needsCard = (amountCents: number): boolean => amountCents > APPROVAL_ABOVE_CENTS; // 1000.00 auto, 1000.01 card

const aud = (c: number) => `AU$${(c / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// FNV-1a 64-bit over "id|amount", hex. Not a secret and not security: a stable dedupe key.
function stableHash(s: string): string {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) { h ^= BigInt(s.charCodeAt(i)); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  return h.toString(16).padStart(16, "0");
}
export const cardIdFor = (payoutId: string, amountCents: number): string => `pc_${stableHash(`${payoutId}|${amountCents}`)}`;

// Only the payout id, the partner tenant id and the amount are ever read. The partner name is optional and
// is stripped to plain characters. No account reference, token, bank detail or provider ref can reach the text.
export function buildPayoutCard(payout: CardPayout, partnerName?: string): PayoutCard {
  if (!Number.isInteger(payout.amountCents) || payout.amountCents <= 0) throw new Error("bad_amount");
  if (!needsCard(payout.amountCents)) throw new Error("below_card_threshold");
  if (payout.status !== "pending_approval") throw new Error("not_pending_approval");
  const name = (partnerName ?? "").replace(/[^A-Za-z0-9 .,&'-]/g, "").slice(0, 60).trim() || "a partner";
  const cardId = cardIdFor(payout.id, payout.amountCents);
  const text = [
    `GATE1 PAYOUT APPROVAL  [${cardId}]`,
    `WHAT: pay ${aud(payout.amountCents)} of partner commission to ${name} (tenant ${payout.partnerId}, payout ${payout.id}).`,
    `WHY: the payout is above ${aud(APPROVAL_ABOVE_CENTS)}, so it waits for your tap. Commission is on real invoices, past the hold, after clawbacks.`,
    `COST: ${aud(payout.amountCents)} out of TITANOS cash. Provider fees are not included.`,
    `REVERSIBLE: deny is fully reversible (nothing moves, the balance stays with the partner). Approve is NOT reversible once the transfer runs.`,
    `ACTION: approve or deny. A repeat tap on the same card does nothing new.`,
  ].join("\n");
  return { cardId, payoutId: payout.id, tenantId: payout.partnerId, amountCents: payout.amountCents, text };
}

export type DecisionResult =
  | { ok: true; outcome: "applied" | "replayed"; payout: CardPayout }
  | { ok: false; outcome: "refused"; reason: "wrong_state" | "bad_decision" | "wrong_tenant" | "card_mismatch"; payout: CardPayout };

// approve: pending_approval -> approved. deny: pending_approval -> denied. Nothing else moves.
// Replaying the SAME decision on an already-decided payout is a no-op success; the opposite decision is refused.
// No state is skipped: sending/paid/failed/rejected are never reachable from here. Returns a new object.
export function applyDecision(payout: CardPayout, decision: Decision, tenantId: string, cardId?: string): DecisionResult {
  if (decision !== "approve" && decision !== "deny") return { ok: false, outcome: "refused", reason: "bad_decision", payout };
  if (payout.partnerId !== tenantId) return { ok: false, outcome: "refused", reason: "wrong_tenant", payout };
  if (cardId !== undefined && cardId !== cardIdFor(payout.id, payout.amountCents)) return { ok: false, outcome: "refused", reason: "card_mismatch", payout };
  const target: DecisionStatus = decision === "approve" ? "approved" : "denied";
  if (payout.status === target) return { ok: true, outcome: "replayed", payout };
  if (payout.status !== "pending_approval") return { ok: false, outcome: "refused", reason: "wrong_state", payout };
  return { ok: true, outcome: "applied", payout: { ...payout, status: target } };
}

// Tenant-scoped lookup: a payout id from another tenant looks absent. The list comes from the caller's store read.
export function findForTenant(payouts: CardPayout[], tenantId: string, payoutId: string): CardPayout | undefined {
  const p = payouts.find((x) => x.id === payoutId);
  return p && p.partnerId === tenantId ? p : undefined;
}
