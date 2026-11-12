import type { D1Like } from "../env.ts";
import type { BookingRow, BookingStore } from "./types.ts";

type Raw = { id: string; slot_start: number; slot_end: number; name: string; business: string; email: string; phone: string | null; eats_week: string; status: "confirmed" | "cancelled"; created_at: number; notified_at: number | null };
const fromRaw = (r: Raw): BookingRow => ({ id: r.id, slotStart: r.slot_start, slotEnd: r.slot_end, name: r.name, business: r.business, email: r.email, phone: r.phone, eatsWeek: r.eats_week, status: r.status, createdAt: r.created_at, notifiedAt: r.notified_at });

export class D1BookingStore implements BookingStore {
  private db: D1Like;
  constructor(db: D1Like) { this.db = db; }
  async takenStarts(fromMs: number, toMs: number): Promise<number[]> {
    const r = await this.db.prepare("SELECT slot_start FROM bookings WHERE status = 'confirmed' AND slot_start >= ? AND slot_start <= ?").bind(fromMs, toMs).all<{ slot_start: number }>();
    return r.results.map((x) => x.slot_start);
  }
  // ONE statement. INSERT OR IGNORE plus the partial unique index means two racing callers cannot both land: the loser changes 0 rows.
  async insert(b: BookingRow): Promise<boolean> {
    const r = (await this.db.prepare("INSERT OR IGNORE INTO bookings (id, slot_start, slot_end, name, business, email, phone, eats_week, status, created_at, notified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, NULL)")
      .bind(b.id, b.slotStart, b.slotEnd, b.name, b.business, b.email, b.phone, b.eatsWeek, b.createdAt).run()) as { meta?: { changes?: number } };
    return (r.meta?.changes ?? 0) === 1;
  }
  async get(id: string): Promise<BookingRow | null> {
    const r = await this.db.prepare("SELECT * FROM bookings WHERE id = ?").bind(id).first<Raw>();
    return r ? fromRaw(r) : null;
  }
  async markNotified(id: string, at: number): Promise<void> {
    await this.db.prepare("UPDATE bookings SET notified_at = ? WHERE id = ?").bind(at, id).run();
  }
}
