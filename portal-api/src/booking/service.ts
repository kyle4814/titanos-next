import { randomToken, HttpError } from "../util.ts";
import { BOOKING } from "./config.ts";
import { freeSlots, generateSlots, slotEnd, slotWindow, formatLocal } from "./slots.ts";
import { validateBooking, BookingInvalid } from "./validate.ts";
import type { BookingDeps, BookingRow } from "./types.ts";

export async function listFreeSlots(b: BookingDeps, now: number): Promise<{ tz: string; slotMinutes: number; slots: { start: string; startMs: number }[] }> {
  const cfg = b.config ?? BOOKING;
  const [from, to] = slotWindow(now, cfg);
  const taken = await b.store.takenStarts(from, to);
  return { tz: cfg.tzName, slotMinutes: cfg.slotMin, slots: freeSlots(now, taken, cfg).map((s) => ({ start: new Date(s).toISOString(), startMs: s })) };
}

// The alert is plain text on purpose: nothing a visitor types can be read as markup by Telegram.
export function alertText(row: BookingRow, cfg = BOOKING): string {
  const one = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "..." : s);
  return [
    "New call booked",
    `Name: ${one(row.name, 100)}`,
    `Business: ${one(row.business, 120)}`,
    `When: ${formatLocal(row.slotStart, cfg)}`,
    `Email: ${row.email}`,
    row.phone ? `Phone: ${row.phone}` : "Phone: not given",
    "What eats their week:",
    one(row.eatsWeek, 1000),
  ].join("\n");
}

export async function createBooking(b: BookingDeps, raw: Record<string, unknown>, now: number): Promise<{ id: string; startMs: number; endMs: number; start: string }> {
  const cfg = b.config ?? BOOKING;
  let input;
  try { input = validateBooking(raw); } catch (e) { if (e instanceof BookingInvalid) throw new HttpError(400, e.code); throw e; }
  if (!generateSlots(now, cfg).includes(input.slotMs)) throw new HttpError(400, "invalid_slot");   // off the grid, in the past or out of range
  const row: BookingRow = {
    id: randomToken("bk", 16), slotStart: input.slotMs, slotEnd: slotEnd(input.slotMs, cfg), name: input.name, business: input.business,
    email: input.email, phone: input.phone, eatsWeek: input.eatsWeek, status: "confirmed", createdAt: now, notifiedAt: null,
  };
  if (!(await b.store.insert(row))) throw new HttpError(409, "slot_taken");
  if (b.notify) {
    try { await b.notify(alertText(row, cfg)); await b.store.markNotified(row.id, now); }
    catch (e) { b.log?.(`booking alert failed id=${row.id} reason=${e instanceof Error ? e.message : "unknown"}`); }   // the booking stands; notified_at stays null
  }
  return { id: row.id, startMs: row.slotStart, endMs: row.slotEnd, start: new Date(row.slotStart).toISOString() };
}
