import { normaliseEmail } from "../util.ts";

export interface BookingInput { slotMs: number; name: string; business: string; email: string; phone: string | null; eatsWeek: string }
export class BookingInvalid extends Error { code: string; constructor(code: string) { super(code); this.code = code; } }
// Strip control characters (no line breaks inside one-line fields), collapse runs of spaces, trim.
const clean = (v: unknown, max: number, multiline = false): string | null => {
  if (typeof v !== "string") return null;
  let s = v.replace(multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, " ");
  s = multiline ? s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n") : s.replace(/\s+/g, " ");
  s = s.trim();
  return s.length >= 1 && s.length <= max ? s : null;
};
export const HONEYPOT_FIELD = "website";
export function validateBooking(raw: Record<string, unknown>): BookingInput {
  const name = clean(raw.name, 100); if (!name) throw new BookingInvalid("invalid_name");
  const business = clean(raw.business, 120); if (!business) throw new BookingInvalid("invalid_business");
  const email = normaliseEmail(raw.email); if (!email) throw new BookingInvalid("invalid_email");
  let phone: string | null = null;
  if (raw.phone !== undefined && raw.phone !== null && String(raw.phone).trim() !== "") {
    const p = clean(raw.phone, 24);
    if (!p || !/^[+]?[0-9 ()-]{6,24}$/.test(p) || (p.match(/[0-9]/g) ?? []).length < 6) throw new BookingInvalid("invalid_phone");
    phone = p;
  }
  const eatsWeek = clean(raw.eatsWeek, 1000, true); if (!eatsWeek) throw new BookingInvalid("invalid_message");
  const slot = typeof raw.slot === "string" ? Date.parse(raw.slot) : NaN;
  if (!Number.isInteger(slot)) throw new BookingInvalid("invalid_slot");
  return { slotMs: slot, name, business, email, phone, eatsWeek };
}
