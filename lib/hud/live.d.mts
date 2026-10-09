export type LiveNumbers = Record<"v" | "generated_ms" | "sloc" | "repos" | "ey" | "ey_per_day_1h" | "ey_per_day_24h" | "ey_per_day_7d" | "aud_per_ey" | "jobs_1h" | "jobs_24h" | "jobs_per_hr_avg" | "commits_1h", number>;
export type Anchor = { ey: number; ms: number; pace: number; ceiling: number; aud_per_ey: number };
export const REFRESH_MS: number;
export const STALE_MS: number;
export function validateNumbers(d: unknown): LiveNumbers | null;
export function livePace(m: LiveNumbers): number;
export function reanchor(shownEy: number, m: LiveNumbers, nowMs: number): Anchor;
export function eyAt(a: Anchor, nowMs: number): number;
export function pulse(m: LiveNumbers, nowMs: number): { jobs1h: number; jobsAvg: number; paceNow: number; pace7d: number; ratio: number | null; ageMin: number; stale: boolean };
