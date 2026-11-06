// f203: reconcile the claimed-but-unfinished webhook window. handleStripeEvent claims the event BEFORE its handler runs (at-most-once, f197), so a crash after markPaid has
// written the paid purchase but before the invoice lands leaves a paid purchase with no invoice, and Stripe's retry is answered "duplicate". This pure function finds those
// purchases and issues the missing first invoice through the same idempotent path markPaid uses (issueInvoiceOnce). Safe to run twice, concurrently, or against a late delivery:
// one invoice per purchase, enforced by the store. NOT wired to any cron or route (a later, gated step).
// What it cannot repair (pinned in test): a crash BEFORE the purchase row flips to paid leaves the purchase pending, so nothing says it was paid; that needs Stripe's own record.
import type { Store } from "./store.ts";
import { PRODUCTS } from "./catalogue.ts";
import { issueInvoiceOnce } from "./service.ts";

export interface ReconcileReport { scanned: number; repaired: number; skipped: number; errors: string[] }
export const reconcileEventId = (purchaseId: string) => `reconcile:${purchaseId}`;

// graceMs: a purchase paid less than graceMs ago is left alone (its handler may still be running). Age >= graceMs is eligible.
export async function reconcile(store: Store, now: number, graceMs: number): Promise<ReconcileReport> {
  const rep: ReconcileReport = { scanned: 0, repaired: 0, skipped: 0, errors: [] };
  const grace = Number.isFinite(graceMs) && graceMs > 0 ? graceMs : 0;
  const todo = await store.paidPurchasesBefore(now - grace);
  for (const p of todo) {
    rep.scanned++;
    const prod = PRODUCTS[p.productId];
    if (!prod) { rep.skipped++; rep.errors.push(`${p.id}: unknown product ${p.productId}`); continue; }
    try {
      if (await issueInvoiceOnce({ store, now: () => now }, p, prod.amountCents, reconcileEventId(p.id))) rep.repaired++; else rep.skipped++;
    } catch (e) { rep.skipped++; rep.errors.push(`${p.id}: ${String((e as Error)?.message ?? e)}`); }
  }
  return rep;
}
