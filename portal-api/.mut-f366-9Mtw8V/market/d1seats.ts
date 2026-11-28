// f378: D1 adapter for SeatEntitlements (the Memory-only market store from the f378 inventory), table seat_subscriptions (migration 0026).
// The rule stays in ONE place: seatActive() in entitlements.ts. This file only stores and loads the record.
// account_id is a bound argument in every statement; set() is an upsert keyed on the account, so a repeated webhook is idempotent.
import type { D1Like } from "../env.ts";
import { seatActive, type SeatEntitlements, type SeatSubscription, type SubStatus } from "./entitlements.ts";

const STATUSES: readonly SubStatus[] = ["active", "past_due", "cancelled"];
export class D1SeatEntitlements implements SeatEntitlements {
  db: D1Like; clock: () => number;
  constructor(db: D1Like, clock: () => number = Date.now) { this.db = db; this.clock = clock; }
  async set(s: SeatSubscription): Promise<void> {
    if (!STATUSES.includes(s.status) || !Number.isFinite(s.paidThroughMs)) throw new Error("seat_subscription_invalid");
    await this.db.prepare(
      "INSERT INTO seat_subscriptions (account_id, status, paid_through_ms, updated_at) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT(account_id) DO UPDATE SET status = excluded.status, paid_through_ms = excluded.paid_through_ms, updated_at = excluded.updated_at")
      .bind(s.accountId, s.status, Math.trunc(s.paidThroughMs), this.clock()).run();
  }
  async get(accountId: string): Promise<SeatSubscription | undefined> {
    const r = await this.db.prepare("SELECT account_id, status, paid_through_ms FROM seat_subscriptions WHERE account_id = ?").bind(accountId)
      .first<{ account_id: string; status: SubStatus; paid_through_ms: number }>();
    return r ? { accountId: r.account_id, status: r.status, paidThroughMs: Number(r.paid_through_ms) } : undefined;
  }
  async isActiveSeat(accountId: string, now: number) { return seatActive(await this.get(accountId), now); }
}
