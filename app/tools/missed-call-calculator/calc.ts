// Pure maths for the missed call calculator. No network, no storage: runs in the browser and in the test.
export type Inputs = {
  callsPerWeek: number;
  missedPct: number; // 0-100, share of calls that go unanswered
  jobValue: number; // dollars per won job (the figure you would invoice)
  closePct: number; // 0-100, share of answered enquiries you turn into a job
  weeksPerYear: number; // weeks you take calls in a year
  recoverPct: number; // 0-100, share of missed callers you win back by replying fast (your own guess)
};

export type Result = {
  missedPerWeek: number;
  lostJobsPerWeek: number;
  weekly: number;
  monthly: number;
  yearly: number;
  recoveredMonthly: number;
  recoveredYearly: number;
};

export const EXAMPLE: Inputs = { callsPerWeek: 30, missedPct: 20, jobValue: 450, closePct: 40, weeksPerYear: 48, recoverPct: 25 };

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

export function calculate(i: Inputs): Result {
  const calls = clamp(i.callsPerWeek, 0, 10000);
  const missed = clamp(i.missedPct, 0, 100) / 100;
  const value = clamp(i.jobValue, 0, 10_000_000);
  const close = clamp(i.closePct, 0, 100) / 100;
  const weeks = clamp(i.weeksPerYear, 0, 52);
  const recover = clamp(i.recoverPct, 0, 100) / 100;
  const missedPerWeek = calls * missed;
  const lostJobsPerWeek = missedPerWeek * close;
  const weekly = lostJobsPerWeek * value;
  const yearly = weekly * weeks;
  const monthly = yearly / 12;
  return { missedPerWeek, lostJobsPerWeek, weekly, monthly, yearly, recoveredMonthly: monthly * recover, recoveredYearly: yearly * recover };
}
