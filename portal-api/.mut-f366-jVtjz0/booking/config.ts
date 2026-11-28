// The ONE place the booking rules live. Change a value here and /api/slots, /api/book and the Telegram alert all follow.
// Defaults (Kyle, 2026-11-12): Monday to Friday, 14:00 to 16:00 Brisbane time, 20 minute slots, bookable 1 to 14 days ahead.
// Queensland has no daylight saving, so a fixed +10:00 offset is exact for Australia/Brisbane. Move to another zone only
// together with a DST-aware offset function.
export interface BookingConfig {
  tzName: string;          // label shown to people and in the alert
  tzOffsetMin: number;     // minutes east of UTC for tzName (Brisbane = 600)
  tzShort: string;         // short label for the alert ("AEST")
  weekdays: readonly number[];   // 0 = Sunday ... 6 = Saturday, in tzName
  startMin: number;        // first slot starts at this minute of the day, in tzName
  endMin: number;          // last slot ends at or before this minute of the day
  slotMin: number;         // slot length in minutes
  minDaysAhead: number;    // first bookable calendar day, counted from today in tzName (1 = tomorrow)
  maxDaysAhead: number;    // last bookable calendar day
}
export const BOOKING: BookingConfig = {
  tzName: "Australia/Brisbane",
  tzOffsetMin: 600,
  tzShort: "AEST",
  weekdays: [1, 2, 3, 4, 5],
  startMin: 14 * 60,
  endMin: 16 * 60,
  slotMin: 20,
  minDaysAhead: 1,
  maxDaysAhead: 14,
};
