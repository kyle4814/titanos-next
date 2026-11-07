// C8 f46: retry executor for payouts in "approved_retry" plus the operator view of "held" payouts. PURE and MOCK ONLY: the
// transfer goes through the injected PayoutProvider (tests inject MockPayouts); no Stripe, no network, no scheduler, no cron.
// A real transfer, and anything that runs this on a timer, is GATE1/GATE2 (see receipt).
// Rules: (1) every attempt reuses the SAME idempotency key (the payout id), so the provider sees one logical transfer;
// (2) a payout is claimed by a compare-and-set approved_retry -> sending, so two concurrent runs cannot both send;
// (3) success -> paid; a thrown error is treated as transient -> approved_retry with attempts+1; attempts >= maxAttempts ->
// held (reason retry_exhausted); (4) the ledger is never touched: money may have moved, a human decides (held = no reversal);
// (5) a crash mid-attempt leaves the row in sending, which the resume sweep (payout_sweep.ts) resolves by key lookup.
import type { EntStore } from "./store.ts";
import type { Payout, PayoutProvider } from "./types.ts";

export interface RetryEnv { store: EntStore; transfer: PayoutProvider; now: number; tenantId?: string }
export type RetryAction = "paid" | "approved_retry" | "held" | "lost_race";
export interface RetryItem { payoutId: string; tenantId: string; action: RetryAction; attempts: number; reason?: string }
export interface RetryResult { examined: number; items: RetryItem[] }

export async function retryApprovedPayouts(store: EntStore, transfer: PayoutProvider, now: number, maxAttempts: number, tenantId?: string): Promise<RetryResult> {
  const out: RetryResult = { examined: 0, items: [] };
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) return out; // a bad bound sends nothing
  const env: RetryEnv = { store, transfer, now, tenantId };
  for (const p of await store.payoutsByStatus("approved_retry", tenantId)) {
    if (tenantId !== undefined && p.partnerId !== tenantId) continue; // a store that ignores the filter cannot widen the scope
    out.examined++;
    out.items.push(await attempt(env, p, maxAttempts));
  }
  return out;
}

async function attempt(env: RetryEnv, p: Payout, maxAttempts: number): Promise<RetryItem> {
  const prior = p.attempts ?? 0;
  const item = (action: RetryAction, attempts: number, reason?: string): RetryItem => ({ payoutId: p.id, tenantId: p.partnerId, action, attempts, reason });
  const won = await env.store.transitionPayout(p.id, "approved_retry", "sending"); // ATOMIC claim: only one runner gets it
  if (!won) return item("lost_race", prior);
  const t = await env.store.tenantById(p.partnerId);
  if (!t?.payoutAccount) { // nothing was sent, so nothing to retry blindly: a human fixes the account
    await put(env, { ...won, status: "held", reason: "payout_account_missing", heldAt: env.now });
    return item("held", prior, "payout_account_missing");
  }
  await env.store.putPayout({ ...won, sendingAt: env.now });
  try {
    const r = await env.transfer.transfer({ partnerId: won.partnerId, accountRef: t.payoutAccount, amountCents: won.amountCents, idempotencyKey: won.id }); // same key every attempt
    await put(env, { ...won, status: "paid", providerRef: r.ref, sendingAt: env.now });
    return item("paid", prior + 1);
  } catch {
    const attempts = prior + 1;
    if (attempts >= maxAttempts) {
      await put(env, { ...won, status: "held", reason: "retry_exhausted", attempts, heldAt: env.now }); // no ledger reversal: a human looks
      return item("held", attempts, "retry_exhausted");
    }
    await put(env, { ...won, status: "approved_retry", reason: "retry_transient_error", attempts });
    return item("approved_retry", attempts, "retry_transient_error");
  }
}
const put = (env: RetryEnv, p: Payout) => env.store.putPayout(p);

export interface HeldRow { payoutId: string; tenantId: string; amountCents: number; reason: string; ageMs: number; attempts: number }

// Enterprise operator view: held payouts for ONE tenant. tenant_id is mandatory and re-checked on every row.
export async function listHeldPayouts(store: EntStore, tenantId: string, now: number): Promise<HeldRow[]> {
  if (typeof tenantId !== "string" || tenantId === "") return [];
  const rows = (await store.payoutsByStatus("held", tenantId)).filter((p) => p.partnerId === tenantId);
  return rows
    .map((p) => ({ payoutId: p.id, tenantId: p.partnerId, amountCents: p.amountCents, reason: p.reason ?? "unknown", ageMs: Math.max(0, now - (p.heldAt ?? p.sendingAt ?? p.createdAt)), attempts: p.attempts ?? 0 }))
    .sort((a, b) => b.ageMs - a.ageMs || a.payoutId.localeCompare(b.payoutId));
}
