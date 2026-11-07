// Refund request handling for the billing page. Pure: the caller passes the API call in, so
// scripts/test_portal_refund_pending.mjs runs it in node without a browser.
// Server contract (portal-api f240): POST /refunds can answer 503 {error:"refund_record_pending", refundId, purchaseId}.
// That means Stripe has already issued the refund and our ledger write is still catching up. Replaying the same
// request is safe: the server remembers the refund and never makes a second Stripe call.

export const REFUND_TEXT: Record<string, string> = {
  outside_14_days: "This is outside the 14-day refund window, so Kyle reviews it personally and replies by email.",
  deliverable_issued: "A deliverable has already been issued, so Kyle reviews it personally and replies by email.",
  monitor_no_refund_current_period: "Monitor is not refunded for the current period. Cancel to stop future charges. Kyle will review anything unusual.",
  scope_terms_apply: "Refund terms for this offer are in your written scope, so Kyle reviews it personally and replies by email.",
  already_refunded: "Already refunded.",
};
export const REFUNDED_TEXT = "Refunded in full. It reaches your card in 5 to 10 business days.";
export const PENDING_TEXT = "Your refund has been issued with Stripe and we are recording it now. You do not need to do anything, and you will not be charged twice. It can take a minute to show here.";
export const PENDING_RETRY_LABEL = "Check again";
export const PENDING_STILL_TEXT = "Still recording. Your refund is safe with Stripe. Check again in a minute, or email us with the reference above.";

export type RefundOutcome =
  | { kind: "refunded"; text: string }
  | { kind: "review"; text: string }
  | { kind: "pending"; purchaseId: string; refundId: string; text: string }
  | { kind: "error"; error: unknown };

const isPending = (e: any) => !!e && e.status === 503 && e.code === "refund_record_pending";

// `send` makes the POST /refunds call for one purchase; retrying calls submitRefund again with the same purchaseId.
export async function submitRefund(send: () => Promise<any>, purchaseId: string): Promise<RefundOutcome> {
  try {
    const r = await send();
    if (r && r.status === "refunded") return { kind: "refunded", text: REFUNDED_TEXT };
    return { kind: "review", text: REFUND_TEXT[r?.reason] ?? "Sent for review." };
  } catch (e: any) {
    if (isPending(e)) {
      const refundId = typeof e.body?.refundId === "string" ? e.body.refundId : "";
      return { kind: "pending", purchaseId: typeof e.body?.purchaseId === "string" ? e.body.purchaseId : purchaseId, refundId, text: PENDING_TEXT };
    }
    return { kind: "error", error: e };
  }
}
