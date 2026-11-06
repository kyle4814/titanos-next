// GATE1 refund card: a pure payload builder and a pure decision transition. It sends NOTHING: no Telegram, no network,
// no Stripe call, no money moved. The send path and the Stripe refund call after an approve are GATE1/GATE4 and
// stay unwired (see the f32 receipt, CARD NEEDED). Amounts are AUD cents.
import { createHash } from "node:crypto";

export type RefundStatus = "pending_review" | "approved" | "denied";
export type RefundDecision = "approve" | "deny";

export interface RefundCase {
  id: string;
  accountId: string;
  purchaseId: string;
  productName: string;
  amountCents: number;
  reason: string;          // the refundVerdict reason code (catalogue.ts)
  inPolicy: boolean;       // true = automatic under the published terms, never a card case
  status: RefundStatus;
  createdAt: number;
  decidedAt?: number;
}

export interface RefundCard {
  cardId: string;
  refundId: string;
  amountCents: number;
  title: string;
  what: string;
  why: string;
  cost: string;
  reversible: string;
  actions: ["approve", "deny"];
  text: string;            // the full card as plain text
}

const REASONS: Record<string, string> = {
  outside_14_days: "the request came after the 14 day window",
  deliverable_issued: "a deliverable has already been issued",
  monitor_no_refund_current_period: "monitor plans have no refund for the current period",
  scope_terms_apply: "this product is covered by its scope terms, not the automatic refund",
  already_refunded: "this purchase already has a refund recorded",
};

export function formatAud(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new RangeError("amount_invalid");
  const d = Math.floor(cents / 100);
  return `AU$${d.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${String(cents % 100).padStart(2, "0")}`;
}

// Stable and idempotent: the same refund id and amount always give the same card id; a changed amount gives a new one.
export function refundCardId(refundId: string, amountCents: number): string {
  return "rcard_" + createHash("sha256").update(`refundcard:v1:${refundId}:${amountCents}`).digest("hex").slice(0, 16);
}

function check(r: RefundCase): void {
  if (!r || typeof r.id !== "string" || !r.id) throw new TypeError("refund_invalid");
  if (!Number.isInteger(r.amountCents) || r.amountCents <= 0) throw new RangeError("amount_invalid");
}

export function buildRefundCard(r: RefundCase): RefundCard {
  check(r);
  if (r.inPolicy) throw new Error("not_a_card_case: in-policy refunds are automatic");
  if (r.status !== "pending_review") throw new Error(`not_a_card_case: status ${r.status}`);
  const amt = formatAud(r.amountCents);
  const why = REASONS[r.reason] ?? "it falls outside the automatic refund terms";
  const what = `Refund ${amt} for ${r.productName} (purchase ${r.purchaseId}, refund ${r.id}).`;
  const whyLine = `Outside the published terms because ${why}. The customer asked; nothing has been paid back.`;
  const cost = `${amt} returned to the customer if approved. Nothing if denied.`;
  const reversible = "Deny is reversible by a new request. Approve is NOT reversible: money goes back and Stripe does not return it.";
  const cardId = refundCardId(r.id, r.amountCents);
  const text = [`REFUND CARD ${cardId}`, `WHAT: ${what}`, `WHY: ${whyLine}`, `COST: ${cost}`, `REVERSIBLE: ${reversible}`, "ACTION: approve or deny"].join("\n");
  return { cardId, refundId: r.id, amountCents: r.amountCents, title: `Refund ${amt}`, what, why: whyLine, cost, reversible, actions: ["approve", "deny"], text };
}

export type DecisionResult =
  | { ok: true; changed: boolean; refund: RefundCase }
  | { ok: false; error: "not_a_card_case" | "bad_decision" | "already_decided" };

const TARGET: Record<RefundDecision, RefundStatus> = { approve: "approved", deny: "denied" };

// pending_review -> approved | denied only. Same decision again is an idempotent no-op; the opposite decision after
// the first is refused; in-policy refunds are not card cases. The input is never mutated.
export function applyRefundDecision(r: RefundCase, decision: RefundDecision, nowMs: number = Date.now()): DecisionResult {
  check(r);
  if (decision !== "approve" && decision !== "deny") return { ok: false, error: "bad_decision" };
  if (r.inPolicy) return { ok: false, error: "not_a_card_case" };
  const to = TARGET[decision];
  if (r.status === to) return { ok: true, changed: false, refund: r };
  if (r.status === "approved" || r.status === "denied") return { ok: false, error: "already_decided" };
  if (r.status !== "pending_review") return { ok: false, error: "not_a_card_case" };
  return { ok: true, changed: true, refund: { ...r, status: to, decidedAt: nowMs } };
}
