// TITANOS Free Workflow X-Ray: the deterministic estimator, ported 1:1 from bin/mf_xray.py
// (klinge-kernel branch ent/e1_xray-2026-11-06, commit 0a6df26cbbe990eebbc8d287a545000c669be973).
// Runs entirely in the browser: no network, no clock, no randomness, no model. Same answers, same bytes.
// scripts/test_xray.mjs pins this port to the Python engine's output on three synthetic fixtures.
// Method (charter O5): hours = max(0, (N * ((T0+E0) - (T1+E1)) * A - O) / 60). Every reduction,
// adoption and overhead figure is ASSUMED and printed in the report.

export const SCHEMA = "mf.xray.v1";
export const BANNER_SYNTHETIC =
  "ESTIMATE, not measured. SYNTHETIC DEMO: every figure comes from fictional answers and labelled assumptions.";
export const BANNER_OWN =
  "ESTIMATE, not measured. Every figure comes from your own answers and labelled assumptions.";

export const SIZE_BANDS = ["1-4", "5-19", "20-99", "100-499", "500+"] as const;
export const TOOL_CATS = ["paper", "spreadsheet", "email", "accounting", "crm", "erp", "booking", "project", "other"] as const;
export const VISIBILITY = ["clear", "patchy", "blind"] as const;
export const CERTAINTY = ["measured_recently", "rough_estimate", "dont_know"] as const;
export const APPETITE = ["quick_fix", "automation", "either"] as const;
export const LEVELS = ["LOW", "MED", "HIGH"] as const;
export const DIMENSIONS = [
  "repeated_work", "rework", "handoff_waiting", "duplicated_entry", "exceptions", "visibility", "process_complexity",
] as const;
export const DIM_LABEL: Record<string, string> = {
  repeated_work: "REPEATED WORK", rework: "REWORK", handoff_waiting: "HANDOFF WAITING",
  duplicated_entry: "DUPLICATED ENTRY", exceptions: "EXCEPTIONS", visibility: "VISIBILITY",
  process_complexity: "PROCESS COMPLEXITY",
};
const ROOT_CAUSE: Record<string, [string, string]> = {
  repeated_work: ["the same steps are done by hand every time",
    "a one-week tally shows fewer runs or shorter hands-on time than reported"],
  rework: ["information is missing or wrong the first time round",
    "the same tally shows corrections on fewer than 1 in 20 jobs"],
  handoff_waiting: ["jobs wait for a person or an approval, not for work",
    "start and finish stamps show the wait sits in one holiday week, not every week"],
  duplicated_entry: ["the same detail is typed into more than one place",
    "a sample of 10 jobs shows the second entry is a paste or an import"],
  exceptions: ["odd cases take over the time of normal cases",
    "the odd cases turn out to share one cause that a checklist fixes"],
  visibility: ["nobody can see where a job is, so people chase it",
    "a shared status list for one week removes the chasing"],
  process_complexity: ["more steps than the outcome needs",
    "removing the two least useful steps for a week changes nothing downstream"],
};

type Cat = { label: string; red: [number, number, number]; sens: string; diy: string[]; existing: string; titanos: string };
export const CATEGORIES: Record<string, Cat> = {
  invoicing_billing: {
    label: "Invoicing and billing", red: [0.20, 0.40, 0.55], sens: "HIGH",
    diy: ["Use one invoice template with locked fields so nothing is retyped",
      "Invoice on a fixed weekday from one list of finished jobs",
      "Add a 5-line check (name, amount, date, reference, terms) before each send"],
    existing: "Check whether your accounting package already offers repeat invoices or job-to-invoice conversion.",
    titanos: "A bounded proof that drafts invoices from your finished-job list for a person to approve.",
  },
  quoting: {
    label: "Quotes and estimates", red: [0.20, 0.35, 0.50], sens: "MED",
    diy: ["Save your 5 most common quotes as templates with the maths built in",
      "Keep one price list in one place and delete the others",
      "Quote within a set window and track how many are accepted"],
    existing: "Check whether your quoting or accounting tool already has quote templates and a price list feature.",
    titanos: "A bounded proof that drafts a quote from a short intake form for a person to review.",
  },
  scheduling: {
    label: "Scheduling and booking", red: [0.25, 0.45, 0.60], sens: "MED",
    diy: ["Publish fixed booking windows so back-and-forth messages stop",
      "Use one shared calendar as the single source of truth",
      "Send one standard confirmation message with the details people always ask for"],
    existing: "Check whether your calendar or booking tool already offers self-service booking links and reminders.",
    titanos: "A bounded proof that proposes booking slots and drafts confirmations for a person to send.",
  },
  data_transfer: {
    label: "Copying data between systems", red: [0.30, 0.55, 0.75], sens: "MED",
    diy: ["Pick the system that is the source of truth and enter data there only",
      "Use the import or CSV feature of the second system instead of retyping",
      "List the fields you copy; drop the ones nobody reads"],
    existing: "Check whether the two tools you use already have a built-in integration or a scheduled import.",
    titanos: "A bounded proof that moves the listed fields between two named systems, read-only first.",
  },
  enquiry_triage: {
    label: "Customer enquiries and triage", red: [0.15, 0.30, 0.45], sens: "MED",
    diy: ["Write 5 standard replies for the questions you answer most",
      "Use one shared inbox with an owner for each day",
      "Add a short form that collects the details you always have to ask for"],
    existing: "Check whether your email or CRM tool already has saved replies, labels and shared inbox rules.",
    titanos: "A bounded proof that sorts incoming enquiries and drafts replies for a person to approve.",
  },
  reporting: {
    label: "Reporting and dashboards", red: [0.30, 0.50, 0.70], sens: "LOW",
    diy: ["Agree the 5 numbers that matter and drop the rest of the report",
      "Build the report once as a template and only refresh the data",
      "Set a fixed time each week to produce it, not on request"],
    existing: "Check whether your accounting or CRM tool already has a saved report you can schedule.",
    titanos: "A bounded proof that assembles the weekly numbers from named sources into a draft report.",
  },
  approvals: {
    label: "Approvals and sign-off", red: [0.10, 0.25, 0.40], sens: "MED",
    diy: ["Write down who may approve what, up to which amount",
      "Give each approver a fixed time slot instead of ad hoc requests",
      "Let low-risk items through with a later spot check"],
    existing: "Check whether your document or project tool already has an approval step with reminders.",
    titanos: "A bounded proof that routes requests to the right approver and chases the open ones.",
  },
  stock_ordering: {
    label: "Stock and supplier ordering", red: [0.20, 0.40, 0.60], sens: "LOW",
    diy: ["Set a minimum level for your top 20 items and order on a fixed day",
      "Keep one supplier contact sheet with order cut-off times",
      "Count the fast movers weekly and the rest monthly"],
    existing: "Check whether your inventory or accounting tool already has reorder points and purchase order templates.",
    titanos: "A bounded proof that drafts supplier orders from your reorder list for a person to approve.",
  },
  job_admin: {
    label: "Job paperwork and timesheets", red: [0.20, 0.40, 0.60], sens: "MED",
    diy: ["Use one job sheet with the same fields every time",
      "Fill timesheets daily in 2 minutes, not weekly from memory",
      "Photograph the paperwork at the job and file it that day"],
    existing: "Check whether your project or accounting tool already has job sheets and timesheet capture.",
    titanos: "A bounded proof that turns a completed job sheet into the records you need.",
  },
  onboarding: {
    label: "New customer or staff onboarding", red: [0.20, 0.40, 0.55], sens: "HIGH",
    diy: ["Turn onboarding into one checklist with an owner for each line",
      "Send one welcome pack instead of several messages",
      "Collect the details once, in one form"],
    existing: "Check whether your CRM or project tool already has checklist templates and forms.",
    titanos: "A bounded proof that runs the onboarding checklist and drafts the welcome messages.",
  },
};
export const SECTORS: Record<string, string> = {
  trades: "Trades and field services", professional_services: "Professional services",
  wholesale_distribution: "Wholesale and distribution", retail: "Retail", hospitality: "Hospitality",
  health_allied: "Allied health and wellbeing", construction: "Construction", other: "Another sector",
};

const SCENARIOS = ["low", "base", "high"] as const;
const ADOPTION: Record<string, number> = { low: 0.5, base: 0.7, high: 0.85 };
const OVERHEAD_MIN: Record<string, number> = { low: 90, base: 45, high: 20 };
const REWORK_FACTOR = 0.8;
const MIN_HOURS_FOR_BUILD = 1.0;
const PII_RX = /@|https?:\/\/|www\.|\d{6,}|\b\d{2,4}[\s-]\d{3}[\s-]\d{3,4}\b/i;

export class XrayError extends Error {}

export type WorkflowInput = {
  name: string; category: string; n_per_week: number | null; t0_min: number | null; rework_pct?: number;
  rework_min?: number; wait_hours?: number; handoffs?: number; systems_retyped?: number; exception_pct?: number;
  steps?: number; visibility?: string; certainty?: string;
};
export type XrayInput = {
  synthetic?: boolean; as_of: string; business_label?: string; industry: string; size_band: string;
  tools?: string[]; appetite?: string; hourly_rate?: number | null; workflows: WorkflowInput[];
};
// The report is plain JSON-shaped data; it is typed loosely on purpose (it mirrors the Python dict).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Report = any;

// Python-compatible rounding: round-half-to-even on exact ties, correct on the binary value otherwise.
function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}
function round2(x: number): number {
  return Number(x.toFixed(2));
}
export function dispHours(h: number): number {
  return roundHalfEven(h * 2) / 2;
}
const level = (v: number, cuts: [number, number]) => (v >= cuts[1] ? "HIGH" : v >= cuts[0] ? "MED" : "LOW");
// Python "%g" for the numbers that appear in text (integers and short decimals).
export function g(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toPrecision(6)));
}

export function netHours(n: number, t0: number, e0: number, t1: number, e1: number, a: number, o: number): [number, number] {
  const raw = (n * ((t0 + e0) - (t1 + e1)) * a - o) / 60;
  return [raw, Math.max(0, raw)];
}

type CleanWf = {
  name: string; category: string; certainty: string; n_per_week: number | null; t0_min: number | null;
  rework_pct: number; rework_min: number; wait_hours: number; handoffs: number; systems_retyped: number;
  exception_pct: number; steps: number; visibility: string;
};

function scenarioHours(wf: CleanWf, scen: (typeof SCENARIOS)[number]) {
  const idx = SCENARIOS.indexOf(scen);
  const r = CATEGORIES[wf.category].red[idx];
  const t0 = wf.t0_min as number;
  const e0 = (wf.rework_pct / 100) * wf.rework_min;
  const t1 = t0 * (1 - r);
  const e1 = e0 * (1 - Math.min(0.9, REWORK_FACTOR * r));
  const [raw, floored] = netHours(wf.n_per_week as number, t0, e0, t1, e1, ADOPTION[scen], OVERHEAD_MIN[scen]);
  return {
    scenario: scen, reduction_assumed: r, t0_min: t0, e0_min: round2(e0), t1_min: round2(t1), e1_min: round2(e1),
    adoption_assumed: ADOPTION[scen], overhead_min_assumed: OVERHEAD_MIN[scen], hours_signed: round2(raw),
    hours: round2(floored), hours_display: dispHours(floored),
  };
}

function dimensions(wf: CleanWf) {
  const n = wf.n_per_week as number, t0 = wf.t0_min as number;
  const hands = (n * t0) / 60;
  const out: Record<string, { level: string; basis: string; provenance?: string }> = {};
  out.repeated_work = { level: level(hands, [2, 6]), basis: `${hands.toFixed(1)} hands-on hours per week` };
  out.rework = { level: level(wf.rework_pct, [5, 15]), basis: `${g(wf.rework_pct)}% of jobs need rework` };
  out.handoff_waiting = {
    level: level(wf.wait_hours, [4, 24]),
    basis: `${g(wf.wait_hours)} elapsed hours of waiting across ${wf.handoffs} handoffs (not staff time)`,
  };
  out.duplicated_entry = {
    level: level(wf.systems_retyped, [1, 2]), basis: `${wf.systems_retyped} other place(s) the same detail is typed`,
  };
  out.exceptions = { level: level(wf.exception_pct, [5, 15]), basis: `${g(wf.exception_pct)}% of jobs are odd cases` };
  out.visibility = {
    level: ({ clear: "LOW", patchy: "MED", blind: "HIGH" } as Record<string, string>)[wf.visibility],
    basis: `status is ${wf.visibility}`,
  };
  out.process_complexity = { level: level(wf.steps, [6, 11]), basis: `${wf.steps} steps from start to finish` };
  for (const d of Object.values(out)) d.provenance = "SELF_REPORTED";
  return out;
}

function topDimension(dims: ReturnType<typeof dimensions>): string | null {
  let best: [number, string] | null = null;
  for (const d of DIMENSIONS) {
    const rank = LEVELS.indexOf(dims[d].level as (typeof LEVELS)[number]);
    if (best === null || rank > best[0]) best = [rank, d];
  }
  return best && best[0] > 0 ? best[1] : null;
}

function feasibility(tools: string[]): [string, string] {
  const s = new Set(tools);
  if (["accounting", "crm", "erp", "booking", "project"].some((t) => s.has(t)))
    return ["HIGH", "you already use at least one business tool that usually has an export or an integration"];
  if (["spreadsheet", "email"].some((t) => s.has(t)))
    return ["MED", "your data sits in spreadsheets and email, which can be read but needs care"];
  return ["LOW", "the work is on paper or in unlisted tools, so a small step to digitise comes first"];
}

const WF_KEYS = ["certainty", "exception_pct", "handoffs", "n_per_week", "rework_min", "rework_pct", "steps",
  "systems_retyped", "t0_min", "visibility", "wait_hours"];

function workflowReport(wf: CleanWf, tools: string[], rate: number | null, wid: string) {
  const cat = CATEGORIES[wf.category];
  const unknown = wf.certainty === "dont_know" || wf.n_per_week === null || wf.t0_min === null;
  const dims = unknown ? null : dimensions(wf);
  const top = dims ? topDimension(dims) : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rec: any = {
    id: wid, name: wf.name, category: wf.category, category_label: cat.label,
    inputs: Object.fromEntries(WF_KEYS.map((k) => [k, (wf as unknown as Record<string, unknown>)[k]])),
    dimensions: dims, top_dimension: top, sensitivity: cat.sens,
  };
  rec.rung = unknown ? "ASSUMPTION" : "SELF_REPORTED";
  if (unknown || !dims) {
    rec.status = "NOT_ENOUGH_EVIDENCE";
    rec.scenarios = [];
    rec.base_hours = null;
    rec.hypothesis = `Not enough evidence to name a bottleneck for ${wf.name}. No score is shown.`;
    rec.measurement = "Count how many times it happens and time five runs with a watch. " +
      "That one exercise is worth more than any estimate here.";
    return rec;
  }
  rec.status = "SCORED";
  rec.scenarios = SCENARIOS.map((s) => scenarioHours(wf, s));
  const base = rec.scenarios[1];
  rec.base_hours = base.hours;
  rec.queue_hours_elapsed = wf.wait_hours;
  if (rate !== null) rec.modelled_capacity_equivalent_per_week = rec.scenarios.map((s: { hours: number }) => round2(s.hours * rate));
  if (top) {
    const [cause, falsify] = ROOT_CAUSE[top];
    rec.hypothesis = `HYPOTHESIS from your own answers: the largest pressure in ${wf.name} is ${DIM_LABEL[top]}, because ${cause}.`;
    rec.falsify = falsify;
  } else {
    rec.hypothesis = `HYPOTHESIS from your own answers: ${wf.name} shows no high pressure on any of the seven ` +
      "dimensions, so there is no standout bottleneck here.";
    rec.falsify = "a one-week tally shows more runs or more minutes than reported";
  }
  const doNothing = base.hours < MIN_HOURS_FOR_BUILD;
  rec.classes = {
    FREE_DIY: cat.diy,
    EXISTING_SOFTWARE: cat.existing + " UNVERIFIED: vendor and version not checked.",
    OPTIONAL_TITANOS: cat.titanos + (doNothing
      ? " Not worth it at these numbers: the free fix or doing nothing is the honest advice."
      : " Only after the free fix and a measured week."),
  };
  rec.do_nothing_reasonable = doNothing;
  const [f, why] = feasibility(tools);
  rec.feasibility = { level: f, why };
  rec.risk = {
    data_sensitivity: cat.sens,
    note: `${cat.sens === "HIGH" ? "Financial or personal" : cat.sens === "MED" ? "Business" : "Low-sensitivity"} data is ` +
      "involved, so any automation would need a named owner, least access and a person approving each output.",
  };
  rec.experiment_7_day = {
    protocol: `For 5 working days, tally each run of ${wf.name} and time the hands-on minutes with a phone timer. ` +
      "Record waiting time separately.",
    falsifies: rec.falsify,
    decision: `If measured minutes are within 25% of the ${g(wf.t0_min as number)} reported, keep the estimate; otherwise ` +
      "re-run it with the measured numbers.",
  };
  return rec;
}

// ---- input checks (the same refusals as the Python engine; free text may not look like contact details)
function num(v: unknown, lo: number, hi: number, name: string, allowNull = false): number | null {
  if (v === null && allowNull) return null;
  if (typeof v !== "number" || Number.isNaN(v) || v < lo || v > hi)
    throw new XrayError(`${name} must be a number from ${lo} to ${hi}${allowNull ? " or empty" : ""}`);
  return v;
}
function text(v: unknown, name: string, maxlen = 80): string {
  if (typeof v !== "string" || !v.trim() || v.length > maxlen) throw new XrayError(`${name} must be 1 to ${maxlen} characters of text`);
  for (const c of v) if (c.charCodeAt(0) > 126 || c.charCodeAt(0) < 32) throw new XrayError(`${name} must be plain text with no accents or symbols`);
  if (PII_RX.test(v)) throw new XrayError(`${name} looks like contact details or an identifier; describe the task, not a person or company`);
  return v.trim();
}

function validate(doc: XrayInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.as_of || "")) throw new XrayError("as_of must be an ISO date YYYY-MM-DD");
  if (!(doc.industry in SECTORS)) throw new XrayError("pick a sector");
  if (!(SIZE_BANDS as readonly string[]).includes(doc.size_band)) throw new XrayError("pick a size band");
  const tools = doc.tools ?? [];
  if (tools.some((t) => !(TOOL_CATS as readonly string[]).includes(t))) throw new XrayError("unknown tool category");
  const appetite = doc.appetite ?? "either";
  if (!(APPETITE as readonly string[]).includes(appetite)) throw new XrayError("unknown appetite");
  const wfs = doc.workflows;
  if (!Array.isArray(wfs) || wfs.length < 1 || wfs.length > 5) throw new XrayError("add 1 to 5 workflows");
  const clean: CleanWf[] = wfs.map((w, idx) => {
    const i = idx + 1;
    if (!(w.category in CATEGORIES)) throw new XrayError(`workflow ${i}: pick a type of work`);
    const cert = w.certainty ?? "rough_estimate";
    if (!(CERTAINTY as readonly string[]).includes(cert)) throw new XrayError(`workflow ${i}: unknown certainty`);
    const unknown = cert === "dont_know";
    const vis = w.visibility ?? "patchy";
    if (!(VISIBILITY as readonly string[]).includes(vis)) throw new XrayError(`workflow ${i}: unknown visibility`);
    return {
      name: text(w.name, `workflow ${i} name`), category: w.category, certainty: cert,
      n_per_week: num(w.n_per_week, 0, 5000, `workflow ${i} jobs a week`, unknown),
      t0_min: num(w.t0_min, 0, 600, `workflow ${i} minutes a job`, unknown),
      rework_pct: num(w.rework_pct ?? 0, 0, 100, `workflow ${i} rework %`) as number,
      rework_min: num(w.rework_min ?? 0, 0, 600, `workflow ${i} rework minutes`) as number,
      wait_hours: num(w.wait_hours ?? 0, 0, 720, `workflow ${i} waiting hours`) as number,
      handoffs: Math.trunc(num(w.handoffs ?? 0, 0, 20, `workflow ${i} handoffs`) as number),
      systems_retyped: Math.trunc(num(w.systems_retyped ?? 0, 0, 10, `workflow ${i} places retyped`) as number),
      exception_pct: num(w.exception_pct ?? 0, 0, 100, `workflow ${i} odd cases %`) as number,
      steps: Math.trunc(num(w.steps ?? 1, 1, 50, `workflow ${i} steps`) as number),
      visibility: vis,
    };
  });
  const rate = doc.hourly_rate === undefined ? null : num(doc.hourly_rate, 0, 500, "hourly value", true);
  return {
    label: text(doc.business_label ?? "Your business", "business name", 40), industry: doc.industry,
    size_band: doc.size_band, tools: [...new Set(tools)].sort(), appetite, rate, workflows: clean, as_of: doc.as_of,
  };
}

export function buildReport(doc: XrayInput): Report {
  const d = validate(doc);
  const synthetic = doc.synthetic === true;
  const recs = d.workflows.map((w, i) => workflowReport(w, d.tools, d.rate, `W${i + 1}`));
  const ranked = recs
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const ka = [a.r.status === "SCORED" ? 0 : 1, -(a.r.base_hours || 0), a.r.id] as const;
      const kb = [b.r.status === "SCORED" ? 0 : 1, -(b.r.base_hours || 0), b.r.id] as const;
      return ka[0] - kb[0] || ka[1] - kb[1] || (ka[2] < kb[2] ? -1 : ka[2] > kb[2] ? 1 : 0);
    })
    .map((x) => x.r);
  const scored = ranked.filter((r) => r.status === "SCORED");
  const sortedCats = Object.keys(CATEGORIES).sort();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rep: any = {
    schema: SCHEMA, banner: synthetic ? BANNER_SYNTHETIC : BANNER_OWN, synthetic, as_of: d.as_of, level: 0,
    business_label: synthetic ? `${d.label} (SYNTHETIC)` : d.label,
    context: { industry: SECTORS[d.industry], size_band: d.size_band, tools: d.tools, appetite: d.appetite },
    method: {
      formula: "hours = max(0, (N * ((T0+E0) - (T1+E1)) * A - O) / 60)",
      worked_example_fictional: "200 tasks a week, 12 min before, 7 min after, adoption 0.80, overhead 100 min: " +
        "(200*5*0.8-100)/60 = 11.67 hours of capacity a week",
      assumed: {
        adoption: ADOPTION, overhead_min_per_week: OVERHEAD_MIN, rework_reduction_factor: REWORK_FACTOR,
        time_reduction_by_category: Object.fromEntries(sortedCats.map((k) => [k, [...CATEGORIES[k].red]])),
      },
      statements: [
        "Every input is SELF_REPORTED. Every reduction, adoption and overhead figure is ASSUMED.",
        "Low, base and high are scenario bands, not statistical confidence intervals.",
        "Waiting time is elapsed time. It is shown beside the hours and never added to them.",
        "Capacity freed is not cash saved. Payroll savings need proof that actual costs change.",
        "No implementation cost is known yet, so no return on investment is computed.",
        "Measurement maturity rung for this report: " + (scored.length ? "SELF_REPORTED" : "ASSUMPTION") +
          " (next rung: INSTRUMENTED BASELINE).",
      ],
    },
    workflows: ranked, ranking: ranked.map((r) => r.id), totals: null,
  };
  if (scored.length) {
    rep.totals = Object.fromEntries(SCENARIOS.map((s, i) => [s, round2(scored.reduce((a, r) => a + r.scenarios[i].hours, 0))]));
    rep.totals_note = "Sum of the separate workflows. Overlap between workflows is possible and not subtracted.";
  }
  rep.monday_plan = scored.slice(0, 3).map((r) => ({
    action: r.classes.FREE_DIY[0], workflow: r.name, owner: "the person who runs it today", time_needed_min: 30,
    success_metric: "hands-on minutes per run next week, from the same tally",
  }));
  const insufficient = ranked.filter((r) => r.status !== "SCORED");
  if (insufficient.length) rep.measurement_first = insufficient.map((r) => ({ workflow: r.name, do: r.measurement }));
  if (scored.length) {
    const t = scored[0];
    rep.executive_summary = `${t.hypothesis} Base case: about ${g(t.scenarios[1].hours_display)} hours a week of capacity could be ` +
      `released IF the self-reported numbers and the labelled assumptions hold. Low to high: ` +
      `${g(t.scenarios[0].hours_display)} to ${g(t.scenarios[2].hours_display)} hours.`;
  } else {
    rep.executive_summary = "Not enough evidence yet to name a bottleneck. The honest next step is a one-week " +
      "count and timing exercise, listed below. No score is shown.";
  }
  rep.limitations = [
    "This is a questionnaire result, not a measurement of your systems. Nothing was connected or scanned.",
    "Free fixes and doing nothing are valid outcomes and are shown with the same weight as any paid route.",
    "Existing-software tips are UNVERIFIED until a person checks the vendor and the version.",
    "No individual staff member is assessed. The seven dimensions describe the work, not the people.",
  ];
  rep.synthetic_labels = synthetic
    ? "SYNTHETIC DEMO: fictional business, fictional answers, no real data."
    : "Your answers stayed in your browser. Nothing was sent, saved or scanned.";
  return rep;
}

// ---- text lines (prefix '#' heading, '##' subheading, '!' banner, '|' radar row)
export function reportLines(rep: Report): string[] {
  const L: string[] = [];
  const a = (s: string) => L.push(s);
  a("# TITANOS Free Workflow X-Ray (Level 0)");
  a("! " + rep.banner);
  a(`${rep.business_label}. As of ${rep.as_of}. Industry: ${rep.context.industry}. Size: ${rep.context.size_band} staff.`);
  a("");
  a("# Summary");
  a(rep.executive_summary);
  if (rep.totals) {
    const t = rep.totals;
    a(`All scored workflows together, low / base / high: ${g(dispHours(t.low))} / ${g(dispHours(t.base))} / ${g(dispHours(t.high))} ` +
      `hours a week (ESTIMATE). ${rep.totals_note}`);
  }
  a("");
  a("# Bottleneck radar (seven dimensions, never one score)");
  for (const w of rep.workflows) {
    a(`## ${w.id}: ${w.name}`);
    if (w.status !== "SCORED") {
      a(w.hypothesis);
      a("Evidence rung: ASSUMPTION. Measurement first: " + w.measurement);
      continue;
    }
    for (const d of DIMENSIONS) {
      const x = w.dimensions[d];
      a(`| ${DIM_LABEL[d].padEnd(19)}|${x.level}|${x.basis} (${x.provenance})`);
    }
    a(w.hypothesis);
    a("It would be wrong if: " + w.falsify + ".");
  }
  a("");
  a("# Time capacity scenarios (ESTIMATE, not measured)");
  for (const w of rep.workflows) {
    if (w.status !== "SCORED") continue;
    a(`## ${w.id}: ${w.name}`);
    for (const s of w.scenarios) {
      a(`${s.scenario.toUpperCase()} case: ${g(s.hours_display)} hours a week (reduction ASSUMED ${g(Math.round(s.reduction_assumed * 100))}%, ` +
        `adoption ASSUMED ${g(s.adoption_assumed)}, overhead ASSUMED ${g(s.overhead_min_assumed)} min a week; signed figure ${g(s.hours_signed)}).`);
    }
    a(`Waiting time you reported: ${g(w.queue_hours_elapsed)} elapsed hours per job. This is queue time, not staff time, and is not in the hours above.`);
    if (w.modelled_capacity_equivalent_per_week) {
      const [lo, ba, hi] = w.modelled_capacity_equivalent_per_week;
      a(`Modelled labour capacity equivalent per week (MODELLED, low / base / high): AU$${g(lo)} / AU$${g(ba)} / AU$${g(hi)}. This is capacity, not cash saved.`);
    }
  }
  a("");
  a("# Three ways forward for each workflow (equal weight)");
  for (const w of rep.workflows) {
    if (w.status !== "SCORED") continue;
    a(`## ${w.id}: ${w.name}`);
    a("1. FREE DIY:");
    for (const x of w.classes.FREE_DIY) a("   - " + x);
    a("2. EXISTING SOFTWARE: " + w.classes.EXISTING_SOFTWARE);
    a("3. OPTIONAL TITANOS: " + w.classes.OPTIONAL_TITANOS);
    if (w.do_nothing_reasonable) a("Doing nothing is a reasonable choice for this one: the base case is under one hour a week.");
    a(`Readiness: feasibility ${w.feasibility.level} (${w.feasibility.why}). Data sensitivity ${w.risk.data_sensitivity}. ${w.risk.note}`);
  }
  a("");
  a("# Monday morning action plan");
  if (rep.monday_plan.length) {
    rep.monday_plan.forEach((m: Record<string, unknown>, i: number) =>
      a(`${i + 1}. ${m.action} (${m.workflow}). Owner: ${m.owner}. Time: ${m.time_needed_min} minutes. Success metric: ${m.success_metric}.`));
  } else a("No scored workflow yet. Start with the measurement exercise below.");
  a("");
  a("# Seven-day measurement experiment");
  for (const w of rep.workflows) {
    if (w.status === "SCORED") {
      const e = w.experiment_7_day;
      a(`${w.id}: ${e.protocol} Falsified if: ${e.falsifies}. ${e.decision}`);
    }
  }
  for (const m of rep.measurement_first ?? []) a(`${m.workflow}: ${m.do}`);
  a("");
  a("# Method and assumptions");
  a("Formula: " + rep.method.formula);
  a("Fictional worked example: " + rep.method.worked_example_fictional + ".");
  for (const s of rep.method.statements) a(s);
  a("# Limits");
  for (const s of rep.limitations) a(s);
  a(rep.synthetic_labels);
  return L;
}
