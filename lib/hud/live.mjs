// Live counter maths: validate the published numbers, re-anchor to each measurement (never backwards), tick at the live 1 h pace.
// Pure, so the tests import it too. The counter cannot run ahead of the last measurement by more than CEILING_REFRESHES refresh intervals.
export const REFRESH_MS = 60_000;
export const CEILING_REFRESHES = 2;
export const STALE_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;
export const KEYS = ["v", "generated_ms", "sloc", "repos", "ey", "ey_per_day_1h", "ey_per_day_24h", "ey_per_day_7d", "aud_per_ey",
  "jobs_1h", "jobs_24h", "jobs_per_hr_avg", "commits_1h"];

/** Fixed key set, every value a finite non-negative number, else null (the counter then keeps its current anchor). */
export function validateNumbers(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  const ks = Object.keys(d);
  if (ks.length !== KEYS.length || !KEYS.every((k) => ks.includes(k))) return null;
  for (const k of KEYS) if (typeof d[k] !== "number" || !Number.isFinite(d[k]) || d[k] < 0) return null;
  if (d.v !== 1 || d.ey <= 0) return null;
  return { ...d };
}

export function livePace(m) {
  return Number.isFinite(m.ey_per_day_1h) ? m.ey_per_day_1h : m.ey_per_day_24h;
}

/** New anchor: max(what is shown now, the measured value), ticking at the live 1 h pace from nowMs. */
export function reanchor(shownEy, m, nowMs) {
  const ey = Math.max(shownEy, m.ey);
  const pace = livePace(m);
  return { ey, ms: nowMs, pace, ceiling: ey + (pace * CEILING_REFRESHES * REFRESH_MS) / DAY_MS, aud_per_ey: m.aud_per_ey };
}

export function eyAt(a, nowMs) {
  return Math.min(a.ey + (a.pace * Math.max(nowMs - a.ms, 0)) / DAY_MS, a.ceiling);
}

/** Fleet pulse readout from a measurement. ratio = pace now / 7-day average (null when the average is 0). */
export function pulse(m, nowMs) {
  const ageMs = Math.max(nowMs - m.generated_ms, 0);
  return {
    jobs1h: m.jobs_1h, jobsAvg: m.jobs_per_hr_avg, paceNow: livePace(m), pace7d: m.ey_per_day_7d,
    ratio: m.ey_per_day_7d > 0 ? livePace(m) / m.ey_per_day_7d : null, ageMin: Math.round(ageMs / 60_000), stale: ageMs > STALE_MS,
  };
}
