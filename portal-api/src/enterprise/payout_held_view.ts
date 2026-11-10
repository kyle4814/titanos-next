// C8 f425: operator view of payouts that need a human (held, approved_retry) plus a retry PLANNER. READ-ONLY and PURE:
// nothing here sends, schedules or writes. The planner returns the request a later, gated executor WOULD send; it never calls a provider.
// A real send is GATE1 (money) and GATE2 (provider credentials), so every planned request is flagged CARD NEEDED.
// Rules: tenant_id is mandatory and re-checked on every row (a store that ignores the filter cannot widen the scope);
// held rows are NEVER planned for retry (a human decides: money may have moved); a retry reuses the ORIGINAL idempotency key (the payout id).
//
// D1 adapter note (NOT APPLIED, no migration): the memory adapter's payoutsByStatus is enough here. A D1 equivalent would be
//   SELECT id, partner_id, amount_cents, status, created_at, reason, sending_at, attempts, held_at FROM payouts
//   WHERE partner_id = ?1 AND status IN ('held', 'approved_retry') ORDER BY COALESCE(held_at, sending_at, created_at) ASC, id ASC
// served by an index on payouts(partner_id, status). Applying that index is a migration and a separate decision.
import type { EntStore } from "./store.ts";
import type { Payout } from "./types.ts";

export type AttentionStatus = "held" | "approved_retry";
export interface AttentionRow { payoutId: string; tenantId: string; status: AttentionStatus; reason: string; ageMs: number; amountCents: number; attempts: number; nextAction: string }

export const NEXT_ACTION: Record<AttentionStatus, string> = {
  held: "Operator review: confirm with the provider whether money moved, then release or refund by hand. Never retried automatically.",
  approved_retry: "Retry is approved but not sent: a planned request is available and needs a card (GATE1 and GATE2) before anything is sent.",
};

const since = (p: Payout): number => (p.status === "held" ? p.heldAt ?? p.sendingAt ?? p.createdAt : p.sendingAt ?? p.createdAt);

/** Read-only, tenant-scoped. Oldest first, ties by payout id. Executes nothing. */
export async function listPayoutsNeedingAttention(store: EntStore, tenantId: string, now: number): Promise<AttentionRow[]> {
  if (typeof tenantId !== "string" || tenantId === "") return [];
  const rows: AttentionRow[] = [];
  for (const status of ["held", "approved_retry"] as const) {
    for (const p of await store.payoutsByStatus(status, tenantId)) {
      if (p.partnerId !== tenantId || p.status !== status) continue;
      rows.push({ payoutId: p.id, tenantId: p.partnerId, status, reason: p.reason ?? "unknown", ageMs: Math.max(0, now - since(p)), amountCents: p.amountCents, attempts: p.attempts ?? 0, nextAction: NEXT_ACTION[status] });
    }
  }
  return rows.sort((a, b) => b.ageMs - a.ageMs || a.payoutId.localeCompare(b.payoutId));
}

export interface PlannedRequest { partnerId: string; accountRef: string; amountCents: number; idempotencyKey: string }
export interface RetryPlanItem { payoutId: string; tenantId: string; request: PlannedRequest; cardNeeded: "GATE1/GATE2"; wouldCallProvider: false; attemptNumber: number }
export interface RetrySkip { payoutId: string; reason: "held_never_retried" | "payout_account_missing" | "not_approved_retry" | "wrong_tenant" }
export interface RetryPlan { tenantId: string; items: RetryPlanItem[]; skipped: RetrySkip[] }

/** PURE: rows and the tenant's payout account in, plan out. No store, no provider, no clock. */
export function planRetries(tenantId: string, payouts: readonly Payout[], payoutAccount: string | undefined | null): RetryPlan {
  const plan: RetryPlan = { tenantId, items: [], skipped: [] };
  if (typeof tenantId !== "string" || tenantId === "") return plan;
  for (const p of payouts) {
    if (p.partnerId !== tenantId) { plan.skipped.push({ payoutId: p.id, reason: "wrong_tenant" }); continue; }
    if (p.status === "held") { plan.skipped.push({ payoutId: p.id, reason: "held_never_retried" }); continue; }
    if (p.status !== "approved_retry") { plan.skipped.push({ payoutId: p.id, reason: "not_approved_retry" }); continue; }
    if (!payoutAccount) { plan.skipped.push({ payoutId: p.id, reason: "payout_account_missing" }); continue; }
    plan.items.push({ payoutId: p.id, tenantId: p.partnerId, request: { partnerId: p.partnerId, accountRef: payoutAccount, amountCents: p.amountCents, idempotencyKey: p.id }, cardNeeded: "GATE1/GATE2", wouldCallProvider: false, attemptNumber: (p.attempts ?? 0) + 1 });
  }
  plan.items.sort((a, b) => a.payoutId.localeCompare(b.payoutId));
  return plan;
}

/** Reads the store (read-only) and plans. Held rows are fetched only so they show up as skipped, never as items. */
export async function planRetriesForTenant(store: EntStore, tenantId: string): Promise<RetryPlan> {
  if (typeof tenantId !== "string" || tenantId === "") return { tenantId, items: [], skipped: [] };
  const t = await store.tenantById(tenantId);
  const rows = [...(await store.payoutsByStatus("approved_retry", tenantId)), ...(await store.payoutsByStatus("held", tenantId))];
  return planRetries(tenantId, rows, t?.payoutAccount);
}
