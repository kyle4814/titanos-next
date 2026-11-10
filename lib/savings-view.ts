// Pure view model for the Enterprise savings calculator (f271). No React, no engine call: it formats an engine result
// (or typed error) into plain strings so the component and the tests share one source of display truth.
// Output is hours given back, never jobs removed.
import type { SavingsResult, SavingsError, ErrorCode } from "./savings-calculator";

const aud = (n: number) => "AU$" + Math.round(n).toLocaleString("en-AU");
const hrs = (n: number) => Math.round(n).toLocaleString("en-AU");
const mo = (n: number | null) => (n === null ? null : (Math.round(n * 10) / 10).toLocaleString("en-AU"));

const PLAIN: Record<ErrorCode, string> = {
  NOT_AN_OBJECT: "Something went wrong reading the form. Please refresh the page and try again.",
  NOT_A_NUMBER: "Please enter a number in every box.",
  NEGATIVE: "Please use zero or a positive number. Nothing can be negative.",
  TASKS_NOT_AN_ARRAY: "Something went wrong reading the form. Please refresh the page and try again.",
  TASK_NAME_MISSING: "Something went wrong reading the form. Please refresh the page and try again.",
};
const FIELD: Record<string, string> = {
  headcount: "People on the team",
  loadedHourlyCostAud: "Loaded hourly cost",
  currentToolSpendAud: "Current yearly tool spend",
};
const fieldLabel = (f: string) => (f.startsWith("tasks[") ? "Hours a week on repeat tasks" : FIELD[f] ?? null);
const clampLabel = (f: string) => fieldLabel(f) ?? (f === "tasks.totalHoursPerWeek" ? "Total weekly task hours" : f === "tasks" ? "Number of tasks" : f);

export type SavingsView =
  | { kind: "error"; message: string }
  | {
      kind: "result";
      hoursBand: string; // "x to y hours a year given back"
      dollarsBand: string; // "AU$a to AU$b a year"
      payback: string; // payback months against the Enterprise band
      paybackNote: string;
      method: string;
      notes: string[]; // clamp notes, one per field pulled into range
      disclaimer: string;
      label: string;
    };

export function buildSavingsView(r: SavingsResult | SavingsError): SavingsView {
  if (!r || typeof r !== "object") return { kind: "error", message: PLAIN.NOT_AN_OBJECT };
  if (r.ok === false) {
    const where = fieldLabel(r.error.field);
    const base = PLAIN[r.error.code] ?? "Please check the numbers and try again.";
    return { kind: "error", message: where && r.error.code !== "NOT_AN_OBJECT" ? `${where}: ${base}` : base };
  }
  const h = r.annualHoursReturned, d = r.annualDollarsAud, p = r.paybackMonths;
  const best = mo(p.bestMonths), worst = mo(p.worstMonths);
  const payback = best === null
    ? "No payback to show yet."
    : worst === null
      ? `About ${best} months at the best case.`
      : `About ${best} months at the best case and ${worst} months at the worst case, against the Enterprise band.`;
  return {
    kind: "result",
    hoursBand: `${hrs(h.floor)} to ${hrs(h.ceiling)} hours a year given back to your team`,
    dollarsBand: `${aud(d.floor)} to ${aud(d.ceiling)} a year`,
    payback,
    paybackNote: p.note,
    method: r.method,
    notes: r.clamped.map((f) => `${clampLabel(f)} was outside the range this estimate covers, so it was adjusted to the nearest limit.`),
    disclaimer: r.disclaimer,
    label: r.label,
  };
}
