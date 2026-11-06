// The hours counter on home. Two honest numbers, never mixed:
//  - SAMPLE (MODELLED): hours a plan hands back for a fixed reference domain with no email records,
//    computed from the fix table in fixes.ts.
//  - LEDGER (MEASURED once live): minutes laid out across real scans. Zero until the tally exists.
import { buildPlan } from "./fixes.ts";
import type { Finding } from "./scan.ts";

export interface HoursLedger { scans: number; minutesHandedBack: number; since: string; source: string }
export const LEDGER_SEED: HoursLedger = { scans: 0, minutesHandedBack: 0, since: "2026-11-06", source: "no live tally yet (PENDING LIVE)" };

const NO_EMAIL_RECORDS: Finding[] = [
  { check: "SPF", status: "FAIL", detail: "", fix: "x" }, { check: "DMARC", status: "FAIL", detail: "", fix: "x" },
  { check: "DKIM", status: "WARN", detail: "", fix: "x" }, { check: "DNSSEC", status: "WARN", detail: "", fix: "x" },
  { check: "MX", status: "PASS", detail: "", fix: "" }, { check: "MTA-STS", status: "WARN", detail: "", fix: "x" },
];
export function sampleHours() {
  const p = buildPlan({ domain: "example.com.au", findings: NO_EMAIL_RECORDS });
  return { byHandHours: Math.round((p.minutesByHand / 60) * 10) / 10, planMinutes: p.minutesWithPlan, handedBackHours: p.hoursHandedBack, label: "MODELLED estimate, table in lib/guestscan/fixes.ts, 2026-11-06" };
}
export function ledgerHours(l: HoursLedger = LEDGER_SEED) { return Math.round((l.minutesHandedBack / 60) * 10) / 10; }
