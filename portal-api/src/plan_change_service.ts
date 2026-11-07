// Store wiring for plan change (f96). Persists PlanState on the Subscription row (optional field, additive).
// NO Stripe call is made here: the billing action a live change needs is returned as DATA (billingIntent) for a later
// owner-approved wire (CARD NEEDED in the f96 receipt). Not mounted on any HTTP route.
import type { Account } from "./store.ts";
import { HttpError, type Deps } from "./service.ts";
import { initPlan, periodStart, isTier, planChange, type Request, type Outcome } from "./plan_change.ts";

export async function changePlan(d: Deps, a: Account, subId: string, req: Request) {
  const sub = await d.store.subscriptionById(subId);
  if (!sub || sub.accountId !== a.id) throw new HttpError(404, "not_found");
  if (!isTier(sub.productId)) throw new HttpError(409, "not_a_retainer");
  const now = d.now();
  // A subscription seen for the first time: history before now is the Stripe side's, so the module starts with an empty ledger.
  const base = sub.plan ?? { ...initPlan(sub.startedAt, sub.productId), ledger: [] };
  let billed = 1; if (!sub.plan) while (periodStart(sub.startedAt, billed) <= now) billed += 1;
  const seeded = sub.plan ? base : { ...base, billedPeriods: billed };
  const r = planChange(seeded, req, now);
  if (!r.replayed) {
    sub.plan = r.state; sub.productId = r.state.tier;
    if (r.outcome.ok && r.outcome.kind === "cancel") sub.cancelAt = r.outcome.effectiveAt;
    if (r.outcome.ok && (r.outcome.kind === "keep" || r.outcome.kind === "upgrade")) sub.cancelAt = undefined;
    await d.store.putSubscription(sub);
  }
  const o: Outcome = r.outcome;
  const billingIntent = o.ok && o.chargeCents > 0 ? { kind: "one_off_invoice_item" as const, subscriptionId: sub.id, amountCents: o.chargeCents, currency: "aud", live: false } : undefined;
  return { outcome: o, replayed: r.replayed, billingIntent };
}
