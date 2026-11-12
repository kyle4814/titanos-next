import { BOOKING, type BookingConfig } from "./config.ts";
import { formatLocal } from "./slots.ts";
import type { BookingRow } from "./types.ts";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
// RFC 5545 lines must not exceed 75 octets; fold with CRLF + space.
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = " " + rest.slice(74); }
  out.push(rest);
  return out.join("\r\n");
}
export function bookingIcs(b: BookingRow, kyleEmail = "kyle@titanos.tech", cfg: BookingConfig = BOOKING): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TITANOS//Booking//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.id}@titanos.tech`,
    `DTSTAMP:${stamp(b.createdAt)}`,
    `DTSTART:${stamp(b.slotStart)}`,
    `DTEND:${stamp(b.slotEnd)}`,
    `SUMMARY:${esc("20 minute call with Kyle (TITANOS)")}`,
    `DESCRIPTION:${esc(`A 20 minute call about what eats your week. ${formatLocal(b.slotStart, cfg)}. Kyle will call you on the number or email you gave. Need to change it? Reply to the confirmation or message Kyle at ${kyleEmail}.`)}`,
    `ORGANIZER;CN=Kyle:mailto:${kyleEmail}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Call with Kyle in 15 minutes", "TRIGGER:-PT15M", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
