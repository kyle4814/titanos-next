// Pro seat entitlement (C4 follow-up, f44). The claim-fee discount is decided HERE, server-side, from a subscription record
// keyed by account id. Nothing a client sends (a `plan` field on /pro/join or anywhere else) is ever consulted.
// Adapters: MemorySeatEntitlements (tests/local, synthetic records). A Stripe-webhook-fed adapter is NOT BUILT (GATE2):
// see the CARD NEEDED line in the f44 receipt.
export type SubStatus = "active" | "past_due" | "cancelled";
// One row per account. SYNTHETIC in tests. paidThroughMs is the end of the last period actually paid for.
export interface SeatSubscription { accountId: string; status: SubStatus; paidThroughMs: number }
export interface SeatEntitlements { isActiveSeat(accountId: string, now: number): Promise<boolean> }

// Rules (each has a test):
//  active    -> seat, while now <= paidThrough (a lapsed "active" row that the webhook never updated fails closed)
//  past_due  -> no seat (a failed payment is not a paid period)
//  cancelled -> seat only until paidThrough, then none
//  no record -> no seat
export function seatActive(s: SeatSubscription | undefined, now: number): boolean {
  if (!s) return false;
  if (s.status === "past_due") return false;
  if (s.status === "active" || s.status === "cancelled") return Number.isFinite(s.paidThroughMs) && now <= s.paidThroughMs;
  return false;
}

export class MemorySeatEntitlements implements SeatEntitlements {
  subs = new Map<string, SeatSubscription>();
  set(s: SeatSubscription) { this.subs.set(s.accountId, { ...s }); }
  async isActiveSeat(accountId: string, now: number) { return seatActive(this.subs.get(accountId), now); }
}
