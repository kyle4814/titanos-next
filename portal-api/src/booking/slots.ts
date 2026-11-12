import { BOOKING, type BookingConfig } from "./config.ts";

const DAY = 86_400_000;
const MIN = 60_000;

// Every slot start (epoch ms, UTC) the rules allow from `nowMs`, ignoring what is already booked. Pure.
export function generateSlots(nowMs: number, cfg: BookingConfig = BOOKING): number[] {
  const off = cfg.tzOffsetMin * MIN;
  const localDayStart = Math.floor((nowMs + off) / DAY) * DAY;   // today's local midnight, written as if it were UTC
  const out: number[] = [];
  for (let d = cfg.minDaysAhead; d <= cfg.maxDaysAhead; d++) {
    const day = localDayStart + d * DAY;
    if (!cfg.weekdays.includes(new Date(day).getUTCDay())) continue;
    for (let m = cfg.startMin; m + cfg.slotMin <= cfg.endMin; m += cfg.slotMin) {
      const start = day + m * MIN - off;
      if (start > nowMs) out.push(start);
    }
  }
  return out;
}
export const slotEnd = (startMs: number, cfg: BookingConfig = BOOKING) => startMs + cfg.slotMin * MIN;
// Free slots: the rule set minus the starts already taken.
export function freeSlots(nowMs: number, taken: Iterable<number>, cfg: BookingConfig = BOOKING): number[] {
  const t = new Set(taken);
  return generateSlots(nowMs, cfg).filter((s) => !t.has(s));
}
// The window the store must be asked about to know what is taken.
export function slotWindow(nowMs: number, cfg: BookingConfig = BOOKING): [number, number] {
  const all = generateSlots(nowMs, cfg);
  return all.length ? [all[0], all[all.length - 1]] : [nowMs, nowMs];
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "Thu 13 Nov, 2:00 pm AEST (Brisbane)": written by hand so it never depends on the runtime's ICU data.
export function formatLocal(startMs: number, cfg: BookingConfig = BOOKING): string {
  const d = new Date(startMs + cfg.tzOffsetMin * MIN);
  const h = d.getUTCHours(), mi = d.getUTCMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}, ${h12}:${String(mi).padStart(2, "0")} ${h < 12 ? "am" : "pm"} ${cfg.tzShort} (${cfg.tzName.split("/").pop()})`;
}
