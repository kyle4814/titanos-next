// Store wiring for plan change (f96). Persists PlanState on the Subscription row (optional field, additive).
// NO Stripe call is made here: the billing action a live change needs is returned as DATA (billingIntent) for a later
// owner-approved wire (CARD NEEDED in the f96 receipt). Not mounted on any HTTP route.
import type { Account } from "./store.ts";
import { HttpError, casEditSubscription, type Deps } from "./service.ts";
import { initPlan, periodStart, isTier, planChange, type Request, type Outcome } from "./plan_change.ts";

export async function changePlan(d: Deps, a: Account, subId: string, req: Request) {
  const sub = await d.store.subscriptionById(subId);
  if (!sub || sub.accountId !== a.id) throw new HttpError(404, "not_found");
  if (!isTier(sub.productId)) throw new HttpError(409, "not_a_retainer");
  const now = d.now();
  // f250: the decision and the write are ONE compare-and-set loop on the row just read (f248 helper). A lost CAS (a cancel webhook, an invoice.paid period advance, a concurrent plan change landed in between)
  // re-reads the fresh row and re-decides on it, so nothing that landed meanwhile is overwritten. The ledger makes the decision idempotent per eventId, so a retry never double-applies.
  let r!: ReturnType<typeof planChange>;
  const out = await casEditSubscription(d, subId, (s) => {
    if (!isTier(s.productId)) throw new HttpError(409, "not_a_retainer");
    // A subscription seen for the first time: history before now is the Stripe side's, so the module starts with an empty ledger.
    const base = s.plan ?? { ...initPlan(s.startedAt, s.productId), ledger: [] };
    let billed = 1; if (!s.plan) while (periodStart(s.startedAt, billed) <= now) billed += 1;
    const seeded = s.plan ? base : { ...base, billedPeriods: billed };
    r = planChange(seeded, req, now);
    if (r.replayed) return false;
    s.plan = r.state; s.productId = r.state.tier;
    if (r.outcome.ok && r.outcome.kind === "cancel") s.cancelAt = r.outcome.effectiveAt;
    if (r.outcome.ok && (r.outcome.kind === "keep" || r.outcome.kind === "upgrade")) s.cancelAt = undefined;
    return true;
  });
  if (!out) throw new HttpError(404, "not_found");
  const o: Outcome = r.outcome;
  const billingIntent = o.ok && o.chargeCents > 0 ? { kind: "one_off_invoice_item" as const, subscriptionId: sub.id, amountCents: o.chargeCents, currency: "aud", live: false } : undefined;
  return { outcome: o, replayed: r.replayed, billingIntent };
}
