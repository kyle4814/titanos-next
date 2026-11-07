// f210: reconcile PENDING purchases (f203 limit 1). A crash after the webhook claim but before the purchase flips to paid leaves the row pending and says nothing about
// payment, so f203's reconcile() cannot see it. This sweep asks the BillingProvider (Stripe's own record) about every purchase still pending past a grace period:
//   paid session        -> finalised through the SAME markPaid path the webhook uses (idempotent: one invoice per purchase, issueInvoiceOnce)
//   expired session     -> abandoned (status "abandoned", migration 0008; old rows written as "cancelled" by f210 keep their meaning)
//   open + unpaid       -> left pending; abandoned only once older than abandonAfterMs (Stripe sessions live at most 24 h, default 25 h)
//   provider error      -> row stays pending, counted in errors, retried next sweep
// Pure over (Deps, clock): d.now() is the clock, d.billing the provider. NOT wired to any cron or route (a later, gated step). Real Stripe lookup = PENDING LIVE (GATE2).
import type { Deps } from "./service.ts";
import { markPaid } from "./service.ts";

export interface PendingReport { scanned: number; recovered: number; abandoned: number; stillOpen: number; skipped: number; errors: number; errorDetails: string[]; storeAbandoned: number; storeCancelled: number }
export const pendingReconcileEventId = (purchaseId: string) => `pendrecon:${purchaseId}`;
export const DEFAULT_ABANDON_AFTER_MS = 25 * 3_600_000;

// graceMs: a purchase created less than graceMs ago is left alone (its customer may still be paying). Age >= graceMs is eligible.
export async function reconcilePending(d: Deps, graceMs: number, abandonAfterMs = DEFAULT_ABANDON_AFTER_MS): Promise<PendingReport> {
  const rep: PendingReport = { scanned: 0, recovered: 0, abandoned: 0, stillOpen: 0, skipped: 0, errors: 0, errorDetails: [], storeAbandoned: 0, storeCancelled: 0 };
  const now = d.now();
  const grace = Number.isFinite(graceMs) && graceMs > 0 ? graceMs : 0;
  for (const p of await d.store.pendingPurchasesBefore(now - grace)) {
    rep.scanned++;
    try {
      const s = await d.billing.retrieveSession(p.checkoutId);
      const fresh = await d.store.purchaseById(p.id); // a late webhook may have finished it while we were asking
      if (!fresh || fresh.status !== "pending") { rep.skipped++; continue; }
      if (s.paymentStatus === "paid" || s.paymentStatus === "no_payment_required") {
        await markPaid(d, fresh, { payment_intent: s.paymentIntent, customer: s.customer, subscription: s.subscription }, pendingReconcileEventId(p.id));
        rep.recovered++;
      } else if (s.status === "expired" || (now - (p.createdAt ?? 0) >= abandonAfterMs && s.status === "open")) {
        await d.store.putPurchase({ ...fresh, status: "abandoned" });
        rep.abandoned++;
      } else rep.stillOpen++; // open and young, or complete with the payment still settling (async method)
    } catch (e) { rep.errors++; rep.errorDetails.push(`${p.id}: ${String((e as Error)?.message ?? e)}`); }
  }
  // f234: stored totals after the sweep, counted apart: 'abandoned' = reconciler gave up on an unpaid checkout, 'cancelled' = a customer cancel (and f210-era abandons, which keep that status).
  rep.storeAbandoned = await d.store.countByStatus("abandoned"); rep.storeCancelled = await d.store.countByStatus("cancelled");
  return rep;
}
