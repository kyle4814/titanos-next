// C8 f42: resume sweep for payouts stuck in "sending" (a restart after the compare-and-set to sending and before the provider
// answered, or after the provider succeeded and before we recorded it). PURE and MOCK ONLY: it never calls transfer(), so it can
// never issue a second transfer for a key; it only ASKS the injected lookup whether the transfer for an idempotency key happened.
// No Stripe, no network, no scheduler, no cron. A real lookup adapter (and anything that runs this on a timer) is GATE1/GATE2.
//   provider confirms            -> paid (providerRef recorded, no ledger change: the debit already stands)
//   provider has no record       -> approved_retry (retryable; a later retry MUST reuse the same idempotency key = payout id)
//   provider unknown / error     -> held with a reason (money may have moved; a human looks, nothing is reversed)
// Every move is a compare-and-set from "sending", so the live path and a second sweep cannot both win.
import type { EntStore } from "./store.ts";
import type { Payout } from "./types.ts";

export type TransferLookupResult =
  | { found: true; ref: string; partnerId: string; amountCents: number }
  | { found: false }            // the provider affirms it has no record of this key
  | { found: "unknown" };       // the provider cannot say
export interface TransferLookup { lookup(idempotencyKey: string): Promise<TransferLookupResult> }

export interface SweepEnv { store: EntStore; lookup: TransferLookup; now: number; tenantId?: string }
export type SweepAction = "paid" | "approved_retry" | "held" | "lost_race";
export interface SweepItem { payoutId: string; tenantId: string; action: SweepAction; reason?: string }
export interface SweepResult { examined: number; skippedYoung: number; items: SweepItem[] }

export const SWEEP_MAX_AGE_MS = 15 * 60_000; // suggested default for a caller; the function takes maxAgeMs explicitly

export async function sweepStuckPayouts(env: SweepEnv, maxAgeMs: number): Promise<SweepResult> {
  const out: SweepResult = { examined: 0, skippedYoung: 0, items: [] };
  const stuck = await env.store.payoutsByStatus("sending", env.tenantId);
  for (const p of stuck) {
    if (env.tenantId !== undefined && p.partnerId !== env.tenantId) continue; // belt and braces: a store that ignores the filter cannot widen the scope
    out.examined++;
    const since = p.sendingAt ?? p.createdAt;
    if (env.now - since < maxAgeMs) { out.skippedYoung++; continue; }
    out.items.push(await resolve(env, p));
  }
  return out;
}

async function resolve(env: SweepEnv, p: Payout): Promise<SweepItem> {
  const item = (action: SweepAction, reason?: string): SweepItem => ({ payoutId: p.id, tenantId: p.partnerId, action, reason });
  let r: TransferLookupResult;
  try { r = await env.lookup.lookup(p.id); } catch { return move(env, p, "held", "provider_error", item); }
  if (r.found === true) {
    // a record that belongs to another tenant or another amount is not ours to trust: hold, never mark paid
    if (r.partnerId !== p.partnerId) return move(env, p, "held", "provider_mismatch_tenant", item);
    if (r.amountCents !== p.amountCents) return move(env, p, "held", "provider_mismatch_amount", item);
    return move(env, p, "paid", undefined, item, r.ref);
  }
  if (r.found === false) return move(env, p, "approved_retry", "provider_no_record", item);
  return move(env, p, "held", "provider_unknown", item);
}

async function move(env: SweepEnv, p: Payout, to: "paid" | "approved_retry" | "held", reason: string | undefined, item: (a: SweepAction, r?: string) => SweepItem, ref?: string): Promise<SweepItem> {
  const won = await env.store.transitionPayout(p.id, "sending", to); // ATOMIC: only a payout still in sending moves
  if (!won) return item("lost_race");
  await env.store.putPayout({ ...won, status: to, ...(ref ? { providerRef: ref } : {}), ...(reason ? { reason } : {}) });
  return item(to, reason);
}
