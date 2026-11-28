import type { D1Like } from "../env.ts";
import type { BookingConfig } from "./config.ts";

export interface BookingRow {
  id: string; slotStart: number; slotEnd: number; name: string; business: string; email: string;
  phone: string | null; eatsWeek: string; status: "confirmed" | "cancelled"; createdAt: number; notifiedAt: number | null;
}
export interface BookingStore {
  takenStarts(fromMs: number, toMs: number): Promise<number[]>;
  insert(row: BookingRow): Promise<boolean>;   // false = the slot was already taken (the unique index decided)
  get(id: string): Promise<BookingRow | null>;
  markNotified(id: string, at: number): Promise<void>;
}
export interface BookingDeps {
  store: BookingStore;
  notify?: (text: string) => Promise<void>;   // Telegram alert to Kyle; absent = booking still works, no alert
  config?: BookingConfig;
  log?: (line: string) => void;
}
export type { D1Like };
