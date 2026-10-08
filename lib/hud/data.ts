import feed from "./feed.json";
import numbers from "./numbers.json";

export type FeedItem = { t: number; acct: string; cat: string; code: string };
export type Row = { value: number; unit: string; label: string; method: string };

export const FEED = feed as { generated: number; shown: number; dropped_orgs: number; items: FeedItem[] };
export const NUM = numbers as unknown as {
  snapshot_ms: number;
  snapshot_ts: string;
  facts_as_of: string;
  rows: Record<string, Row>;
  needle: { realised: number; ceiling: number; label: string; text: string; method: string };
  facts: Record<string, { text: string; label: string; method: string }>;
};

/** AU$ per engineer-year, derived from the snapshot itself (replacement cost / engineer-years). */
export const AUD_PER_EY = NUM.rows.replacement_cost_aud.value / NUM.rows.engineer_years.value;
/** Extrapolation stops after this many days so a stale deploy cannot run away. */
export const MAX_EXTRAPOLATE_DAYS = 14;
const DAY_MS = 86_400_000;

export function engineerYearsAt(nowMs: number): number {
  const days = Math.min(Math.max((nowMs - NUM.snapshot_ms) / DAY_MS, 0), MAX_EXTRAPOLATE_DAYS);
  return NUM.rows.engineer_years.value + NUM.rows.engineer_years_per_day_7d.value * days;
}
export function audAt(nowMs: number): number {
  return engineerYearsAt(nowMs) * AUD_PER_EY;
}
/** Needle position 0..1 on the tachometer (linear: realised multiple / modelled ceiling). */
export function needleFraction(): number {
  return Math.min(NUM.needle.realised / NUM.needle.ceiling, 1);
}
