// f203: reconcile the claimed-but-unfinished webhook window. handleStripeEvent claims the event BEFORE its handler runs (at-most-once, f197), so a crash after markPaid has
// written the paid purchase but before the invoice lands leaves a paid purchase with no invoice, and Stripe's retry is answered "duplicate". This pure function finds those
// purchases and issues the missing first invoice through the same idempotent path markPaid uses (issueInvoiceOnce). Safe to run twice, concurrently, or against a late delivery:
// one invoice per purchase, enforced by the store. NOT wired to any cron or route (a later, gated step).
// What it cannot repair (pinned in test): a crash BEFORE the purchase row flips to paid leaves the purchase pending, so nothing says it was paid; that needs Stripe's own record.
import type { Store } from "./store.ts";
import { PRODUCTS } from "./catalogue.ts";
import { issueInvoiceOnce, buildSubscription } from "./service.ts";
import type { BillingProvider } from "./stripe.ts";

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

// f237: the missing-subscription repair (f236 limit 2). Since the f236 claim, a crash after pending -> paid and before the subscription seed leaves a PAID purchase with no subscription
// row, and no invoice-only sweep sees it. For every status='paid' purchase of a subscription-mode product with no subscription (keyed on purchase id) this asks Stripe's own record
// (retrieveSession, READ-ONLY, mocked in tests) and seeds the row through the SAME builder markPaid uses, then issues the first invoice if that is missing too.
// Idempotent: the existence check skips a purchase that already has a row, and putSubscriptionOnce is the atomic guard behind it. refunded / cancelled / abandoned / pending are never selected.
export interface SeedReport { scanned: number; seeded: number; skipped: number; errors: string[] }
export const seedEventId = (purchaseId: string) => `subseed:${purchaseId}`;
export async function reconcileSubscriptions(store: Store, billing: BillingProvider, now: number, graceMs: number): Promise<SeedReport> {
  const rep: SeedReport = { scanned: 0, seeded: 0, skipped: 0, errors: [] };
  const grace = Number.isFinite(graceMs) && graceMs > 0 ? graceMs : 0;
  const ids = Object.values(PRODUCTS).filter((p) => p.mode === "subscription").map((p) => p.id);
  const d = { store, now: () => now };
  for (const p of await store.paidWithoutSubscriptionBefore(now - grace, ids)) {
    rep.scanned++;
    try {
      if (await store.subscriptionByPurchase(p.id)) { rep.skipped++; continue; } // existence check BEFORE takeFacts, which is destructive
      const s = await billing.retrieveSession(p.checkoutId);
      if (s.status !== "complete" || s.paymentStatus !== "paid") { rep.skipped++; rep.errors.push(`${p.id}: stripe session not paid (${s.status}/${s.paymentStatus})`); continue; }
      const subRef = s.subscription ?? p.subscriptionId;
      const subId = p.subscriptionId ?? (subRef && typeof subRef === "object" ? String((subRef as any).id) : subRef ? String(subRef) : undefined);
      if (!subId) { rep.skipped++; rep.errors.push(`${p.id}: no subscription id on purchase or session`); continue; }
      const pur = { ...p, subscriptionId: subId };
      const sub = await buildSubscription(d, pur, subRef, now);
      if (await store.putSubscriptionOnce(sub)) {
        rep.seeded++;
        if (p.subscriptionId !== subId) await store.casPurchase(pur, "paid"); // persist an id the claim never stored
      } else rep.skipped++;
      const prod = PRODUCTS[p.productId];
      if (prod) await issueInvoiceOnce(d, pur, prod.amountCents, seedEventId(p.id));
    } catch (e) { rep.skipped++; rep.errors.push(`${p.id}: seed failed: ${String((e as Error)?.message ?? e)}`); }
  }
  return rep;
}
