// Savings calculator engine (plan chapter 6, C8, Enterprise seat). Pure: no network, no model call, no clock.
// Output is HOURS GIVEN BACK and dollars, as a floor-to-ceiling band. It never claims a job is removed.

export const ENTERPRISE_PRICE_AUD = { low: 49997, high: 149997 } as const; // CORE NUM1, per year
export const WORKING_WEEKS_PER_YEAR = 46;
export const CAPTURE = { floor: 0.3, ceiling: 0.7 } as const; // share of named-task hours returned
export const TOOL_SPEND_RETIRED = { floor: 0, ceiling: 0.25 } as const; // share of current tool spend consolidated

export const LIMITS = {
  headcount: { min: 1, max: 50000 },
  hourlyCostAud: { min: 15, max: 500 },
  hoursPerWeekPerTask: { min: 0, max: 40 },
  hoursPerWeekTotal: { min: 0, max: 60 },
  tasks: { max: 50 },
  toolSpendAud: { min: 0, max: 50_000_000 },
} as const;

export interface TaskInput { name: string; hoursPerWeek: number } // hours per person per week
export interface SavingsInput {
  headcount: number;
  loadedHourlyCostAud: number;
  tasks: TaskInput[];
  currentToolSpendAud: number; // per year
}
export type ErrorCode = "NOT_AN_OBJECT" | "NOT_A_NUMBER" | "NEGATIVE" | "TASKS_NOT_AN_ARRAY" | "TASK_NAME_MISSING";
export interface SavingsError { ok: false; error: { code: ErrorCode; field: string; message: string } }
export interface Band { floor: number; ceiling: number }
export interface Payback { bestMonths: number | null; worstMonths: number | null; note: string }
export interface SavingsResult {
  ok: true;
  inputs: SavingsInput; // as used, after clamping
  clamped: string[]; // fields that were pulled into range
  weeklyHoursOnNamedTasks: number;
  annualHoursReturned: Band;
  annualDollarsAud: Band;
  paybackMonths: Payback;
  formulas: { hours: string; dollars: string; payback: string };
  method: string;
  disclaimer: string;
  label: string;
}

const fail = (code: ErrorCode, field: string, message: string): SavingsError => ({ ok: false, error: { code, field, message } });
const round2 = (n: number) => Math.round(n * 100) / 100;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function take(v: unknown, field: string, min: number, max: number, clamped: string[], integer = false): number | SavingsError {
  if (!isNum(v)) return fail("NOT_A_NUMBER", field, `${field} must be a finite number`);
  if (v < 0) return fail("NEGATIVE", field, `${field} cannot be negative`);
  const n = integer ? Math.round(v) : v;
  const c = Math.min(max, Math.max(min, n));
  if (c !== n) clamped.push(field);
  return c;
}
const bad = (x: unknown): x is SavingsError => typeof x === "object" && x !== null && (x as SavingsError).ok === false;

export function calculateSavings(raw: unknown): SavingsResult | SavingsError {
  if (typeof raw !== "object" || raw === null) return fail("NOT_AN_OBJECT", "input", "input must be an object");
  const r = raw as Record<string, unknown>;
  const clamped: string[] = [];

  const headcount = take(r.headcount, "headcount", LIMITS.headcount.min, LIMITS.headcount.max, clamped, true);
  if (bad(headcount)) return headcount;
  const cost = take(r.loadedHourlyCostAud, "loadedHourlyCostAud", LIMITS.hourlyCostAud.min, LIMITS.hourlyCostAud.max, clamped);
  if (bad(cost)) return cost;
  const spend = take(r.currentToolSpendAud, "currentToolSpendAud", LIMITS.toolSpendAud.min, LIMITS.toolSpendAud.max, clamped);
  if (bad(spend)) return spend;
  if (!Array.isArray(r.tasks)) return fail("TASKS_NOT_AN_ARRAY", "tasks", "tasks must be an array");
  if (r.tasks.length > LIMITS.tasks.max) clamped.push("tasks");

  const tasks: TaskInput[] = [];
  let weekly = 0;
  for (const [i, t] of r.tasks.slice(0, LIMITS.tasks.max).entries()) {
    const o = (typeof t === "object" && t !== null ? t : {}) as Record<string, unknown>;
    if (typeof o.name !== "string" || o.name.trim() === "") return fail("TASK_NAME_MISSING", `tasks[${i}].name`, "each task needs a name");
    const h = take(o.hoursPerWeek, `tasks[${i}].hoursPerWeek`, LIMITS.hoursPerWeekPerTask.min, LIMITS.hoursPerWeekPerTask.max, clamped);
    if (bad(h)) return h;
    tasks.push({ name: o.name.trim(), hoursPerWeek: h });
    weekly += h;
  }
  if (weekly > LIMITS.hoursPerWeekTotal.max) { weekly = LIMITS.hoursPerWeekTotal.max; clamped.push("tasks.totalHoursPerWeek"); }

  const baseHours = headcount * weekly * WORKING_WEEKS_PER_YEAR;
  const hours: Band = { floor: round2(baseHours * CAPTURE.floor), ceiling: round2(baseHours * CAPTURE.ceiling) };
  const dollars: Band = {
    floor: round2(hours.floor * cost + spend * TOOL_SPEND_RETIRED.floor),
    ceiling: round2(hours.ceiling * cost + spend * TOOL_SPEND_RETIRED.ceiling),
  };

  const best = dollars.ceiling > 0 ? round2(ENTERPRISE_PRICE_AUD.low / (dollars.ceiling / 12)) : null;
  const worst = dollars.floor > 0 ? round2(ENTERPRISE_PRICE_AUD.high / (dollars.floor / 12)) : null;
  const payback: Payback = {
    bestMonths: best,
    worstMonths: worst,
    note: best === null
      ? "No hours entered, so there is nothing to pay back yet."
      : worst === null
        ? "The floor returns no dollars, so the worst case has no payback."
        : "Best case pairs the ceiling with the lowest band price; worst case pairs the floor with the highest.",
  };

  const inputs: SavingsInput = { headcount, loadedHourlyCostAud: cost, tasks, currentToolSpendAud: spend };
  const hf = `annual hours = headcount ${headcount} x weekly task hours ${round2(weekly)} x ${WORKING_WEEKS_PER_YEAR} weeks x capture ${CAPTURE.floor} (floor) to ${CAPTURE.ceiling} (ceiling)`;
  const df = `annual AU$ = annual hours x loaded hourly cost AU$${cost} + tool spend AU$${spend} x ${TOOL_SPEND_RETIRED.floor} (floor) to ${TOOL_SPEND_RETIRED.ceiling} (ceiling)`;
  const pf = `payback months = Enterprise price (AU$${ENTERPRISE_PRICE_AUD.low} to AU$${ENTERPRISE_PRICE_AUD.high} a year) / (annual AU$ / 12)`;
  return {
    ok: true,
    inputs,
    clamped,
    weeklyHoursOnNamedTasks: round2(weekly),
    annualHoursReturned: hours,
    annualDollarsAud: dollars,
    paybackMonths: payback,
    formulas: { hours: hf, dollars: df, payback: pf },
    method: `${hf}. ${df}. ${pf}.`,
    disclaimer: "These are hours given back to your team on the tasks you named. Nobody is replaced. The band is an estimate from your inputs, not a promise.",
    label: "Estimate from the inputs you entered. Test fixtures in this repo are synthetic.",
  };
}
