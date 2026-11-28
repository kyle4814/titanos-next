// Order log over D1. Every state change that matters is ONE conditional statement (no read-then-write race).
import type { D1Like } from "./env.ts";

export interface OrderRow {
  id: string; session_id: string; payment_intent: string | null; slug: string; email: string; amount_cents: number; currency: string; livemode: number;
  status: "paid" | "revoked"; downloads: number; max_downloads: number; token_exp_sec: number; email_lease_at: number | null; emailed_at: number | null;
  revoked_at: number | null; revoke_reason: string | null; created_at: number;
}
export type ConsumeResult = "ok" | "revoked" | "limit" | "expired" | "missing";
const changes = (r: unknown): number => Number((r as { meta?: { changes?: number } })?.meta?.changes ?? 0);

export class DigitalStore {
  private db: D1Like;
  constructor(db: D1Like) { this.db = db; }

  async eventSeen(id: string): Promise<boolean> { return !!(await this.db.prepare("SELECT 1 AS x FROM digital_events WHERE event_id = ?").bind(id).first()); }
  async recordEvent(id: string, type: string, now: number): Promise<void> { await this.db.prepare("INSERT OR IGNORE INTO digital_events (event_id, type, processed_at) VALUES (?, ?, ?)").bind(id, type, now).run(); }

  async orderBySession(sessionId: string): Promise<OrderRow | null> { return this.db.prepare("SELECT * FROM digital_orders WHERE session_id = ?").bind(sessionId).first<OrderRow>(); }
  async orderById(id: string): Promise<OrderRow | null> { return this.db.prepare("SELECT * FROM digital_orders WHERE id = ?").bind(id).first<OrderRow>(); }

  // Idempotent on session_id: a replay returns the existing row untouched.
  async createOrder(o: { id: string; sessionId: string; paymentIntent: string | null; slug: string; email: string; amountCents: number; currency: string; livemode: boolean; tokenExpSec: number; maxDownloads: number; now: number; revokedReason?: string }): Promise<OrderRow> {
    await this.db.prepare(
      "INSERT OR IGNORE INTO digital_orders (id, session_id, payment_intent, slug, email, amount_cents, currency, livemode, status, max_downloads, token_exp_sec, revoked_at, revoke_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(o.id, o.sessionId, o.paymentIntent, o.slug, o.email, o.amountCents, o.currency, o.livemode ? 1 : 0, o.revokedReason ? "revoked" : "paid", o.maxDownloads, o.tokenExpSec, o.revokedReason ? o.now : null, o.revokedReason ?? null, o.now).run();
    return (await this.orderBySession(o.sessionId))!;
  }

  // Revoke every paid order of a payment intent. Returns how many rows changed.
  async revokeByPaymentIntent(pi: string, reason: string, now: number): Promise<number> {
    return changes(await this.db.prepare("UPDATE digital_orders SET status = 'revoked', revoked_at = ?, revoke_reason = ? WHERE payment_intent = ? AND status = 'paid'").bind(now, reason, pi).run());
  }
  async orderCountByPaymentIntent(pi: string): Promise<number> { return Number((await this.db.prepare("SELECT COUNT(*) AS n FROM digital_orders WHERE payment_intent = ?").bind(pi).first<{ n: number }>())?.n ?? 0); }
  async addPendingRevocation(pi: string, reason: string, now: number): Promise<void> { await this.db.prepare("INSERT OR IGNORE INTO digital_pending_revocations (payment_intent, reason, created_at) VALUES (?, ?, ?)").bind(pi, reason, now).run(); }
  async pendingRevocation(pi: string): Promise<string | null> { return (await this.db.prepare("SELECT reason FROM digital_pending_revocations WHERE payment_intent = ?").bind(pi).first<{ reason: string }>())?.reason ?? null; }

  // Email lease: only one sender at a time, and never after the email went out.
  async leaseEmail(id: string, now: number, leaseMs = 60_000): Promise<boolean> {
    return changes(await this.db.prepare("UPDATE digital_orders SET email_lease_at = ? WHERE id = ? AND emailed_at IS NULL AND status = 'paid' AND (email_lease_at IS NULL OR email_lease_at < ?)").bind(now, id, now - leaseMs).run()) === 1;
  }
  async markEmailed(id: string, now: number): Promise<void> { await this.db.prepare("UPDATE digital_orders SET emailed_at = ?, email_lease_at = NULL WHERE id = ?").bind(now, id).run(); }
  async releaseEmail(id: string): Promise<void> { await this.db.prepare("UPDATE digital_orders SET email_lease_at = NULL WHERE id = ? AND emailed_at IS NULL").bind(id).run(); }

  // The ONE gate on a download: paid, not expired, under the cap, all in a single conditional UPDATE.
  async consumeDownload(id: string, nowSec: number): Promise<ConsumeResult> {
    if (changes(await this.db.prepare("UPDATE digital_orders SET downloads = downloads + 1 WHERE id = ? AND status = 'paid' AND downloads < max_downloads AND token_exp_sec > ?").bind(id, nowSec).run()) === 1) return "ok";
    const o = await this.orderById(id);
    if (!o) return "missing";
    if (o.status !== "paid") return "revoked";
    if (o.token_exp_sec <= nowSec) return "expired";
    return "limit";
  }
  async releaseDownload(id: string): Promise<void> { await this.db.prepare("UPDATE digital_orders SET downloads = downloads - 1 WHERE id = ? AND downloads > 0").bind(id).run(); }
  async logDownload(orderId: string, result: string, now: number): Promise<void> { await this.db.prepare("INSERT INTO digital_download_log (order_id, result, at) VALUES (?, ?, ?)").bind(orderId, result, now).run(); }

  // Hourly per-key counter; returns the count including this hit. Old buckets are dropped opportunistically.
  async rateHit(key: string, hour: number): Promise<number> {
    await this.db.prepare("DELETE FROM digital_rate WHERE k NOT LIKE ?").bind(`${hour}:%`).run();
    await this.db.prepare("INSERT INTO digital_rate (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1").bind(`${hour}:${key}`).run();
    return Number((await this.db.prepare("SELECT n FROM digital_rate WHERE k = ?").bind(`${hour}:${key}`).first<{ n: number }>())?.n ?? 1);
  }

  async parkMail(to: string, subject: string, body: string, now: number): Promise<void> { await this.db.prepare("INSERT INTO digital_outbox (to_addr, subject, body, created_at) VALUES (?, ?, ?, ?)").bind(to, subject, body, now).run(); }
}
