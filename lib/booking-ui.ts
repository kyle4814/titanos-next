// Pure helpers for the /book page: no React, no "@/" imports, so a plain node test can drive them.
// The slot rules themselves live in ONE place, portal-api/src/booking/config.ts; the page only draws what /api/slots returns.
export const BRISBANE_TZ = "Australia/Brisbane";
export type ApiSlot = { start: string; startMs: number };
export type DaySlots = { key: string; label: string; slots: { iso: string; local: string; brisbane: string }[] };

const fmt = (tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-AU", { ...o, timeZone: tz });

// Group slots by the VISITOR's calendar day, so a visitor in London sees Brisbane's 14:00 on the right local date.
export function groupSlots(slots: ApiSlot[], visitorTz: string): DaySlots[] {
  const dayKey = fmt(visitorTz, { year: "numeric", month: "2-digit", day: "2-digit" });
  const dayLabel = fmt(visitorTz, { weekday: "short", day: "numeric", month: "short" });
  const time = (tz: string) => fmt(tz, { hour: "numeric", minute: "2-digit", hour12: true });
  const tLocal = time(visitorTz), tBris = time(BRISBANE_TZ);
  const out: DaySlots[] = [];
  for (const s of [...slots].sort((a, b) => a.startMs - b.startMs)) {
    const d = new Date(s.startMs);
    const key = dayKey.format(d);
    let day = out.find((x) => x.key === key);
    if (!day) { day = { key, label: dayLabel.format(d), slots: [] }; out.push(day); }
    day.slots.push({ iso: s.start, local: tLocal.format(d), brisbane: tBris.format(d) });
  }
  return out;
}
export function visitorTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || BRISBANE_TZ; } catch { return BRISBANE_TZ; }
}
const MESSAGES: Record<string, string> = {
  invalid_name: "Please add your name.",
  invalid_business: "Please add your business name.",
  invalid_email: "That email address does not look right.",
  invalid_phone: "That phone number does not look right. You can leave it blank.",
  invalid_message: "Please tell me a little about what eats your week.",
  invalid_slot: "That time is no longer available. Please pick another.",
  slot_taken: "Someone just took that time. Please pick another.",
  too_many_attempts: "That is a lot of tries in a short time. Please wait a few minutes, or message Kyle on Telegram.",
};
export function bookingError(code: string | undefined): string {
  return (code && MESSAGES[code]) || "Something went wrong on our side. Your booking was not made. Please try again, or message Kyle on Telegram.";
}
export const confirmedHref = (id: string) => `/book/confirmed#id=${encodeURIComponent(id)}`;
export const parseConfirmedId = (hash: string): string | null => { const m = /^#?id=(bk_[0-9a-f]{32})$/.exec(hash); return m ? m[1] : null; };
