// Pure maths for the hours ledger and the C1 hand-raise rate. No I/O.
// Plan line 1487: C1 kill test = at least 3% of the first 1,000 guest scans press GET THIS FIXED.
export const KILL_TEST_SCANS = 1000;
export const KILL_TEST_MIN_PERCENT = 3;

export interface HoursLedger { scans: number; minutesHandedBack: number; hoursHandedBack: number; source: string }
export function hoursLedger(scans: number, minutes: number): HoursLedger {
  if (!Number.isFinite(scans) || !Number.isFinite(minutes) || scans < 0 || minutes < 0) throw new RangeError("counts must be non-negative finite numbers");
  return {
    scans, minutesHandedBack: minutes,
    hoursHandedBack: Math.round((minutes / 60) * 10) / 10,
    source: scans === 0 ? "no scans counted yet (UNKNOWN, not zero value)" : "counted from the scan beacon; minutes are the MODELLED plan table summed over real scans",
  };
}

export type KillVerdict = "PENDING" | "PASS" | "FAIL";
export interface HandRate { presses: number; scans: number; rate: number | null; percent: number | null; verdict: KillVerdict; note: string }
// rate is null at 0 scans (UNKNOWN, never 0%). Verdict is PENDING until 1,000 scans are in; then integer maths (presses*100 >= 3*scans)
// so 30/1000 passes and 29/1000 fails with no float edge. Pass the first-1,000 snapshot; later scans do not rewrite the test.
export function handRaiseRate(presses: number, scans: number): HandRate {
  if (!Number.isInteger(presses) || !Number.isInteger(scans) || presses < 0 || scans < 0) throw new RangeError("counts must be non-negative integers");
  if (presses > scans) throw new RangeError("presses cannot exceed scans");
  if (scans === 0) return { presses, scans, rate: null, percent: null, verdict: "PENDING", note: "0 scans: rate UNKNOWN" };
  const rate = presses / scans;
  const percent = Math.round(rate * 1000) / 10;
  if (scans < KILL_TEST_SCANS) return { presses, scans, rate, percent, verdict: "PENDING", note: `${scans} of ${KILL_TEST_SCANS} scans: kill test not decidable yet` };
  const pass = presses * 100 >= KILL_TEST_MIN_PERCENT * scans;
  return { presses, scans, rate, percent, verdict: pass ? "PASS" : "FAIL", note: `${percent}% against the ${KILL_TEST_MIN_PERCENT}% bar` };
}
