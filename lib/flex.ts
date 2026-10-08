// W3 copy: the figures the whole site quotes, in one place, each with its label and source.
// Every value traces to state/baseline/BASELINE_2026-10-08.json (klinge-kernel) or the named source.
// Labels: MEASURED (we read it off the running system), RECORDED (a stored result), EXAMPLE, MODELLED.
import { int, dec, v, AS_OF_LONG } from "./ledger";
export type Kind = "MEASURED" | "RECORDED" | "MODELLED" | "EXAMPLE";

export type Flex = {
  big: string;
  label: string;
  kind: Kind;
  analogy: string;
  source: string;
};

export const FLEX = {
  startTokens: {
    big: `${int("tokens_before")} to ${int("tokens_after")}`,
    label: "tokens each worker reads before it starts",
    kind: "MEASURED",
    analogy: "A new starter's induction folder cut from a filing cabinet to one binder, with the work done just as well.",
    source: "BASELINE_2026-10-08.json, worker start tokens, bin/context_audit.py, 52 sessions, 0 flagged",
  },
  costPerJob: {
    big: `US$${v("cost_job_before").toFixed(2)} to US$${v("cost_job_after").toFixed(2)}`,
    label: "cost of one worker job, 8 October 2026",
    kind: "RECORDED",
    analogy: `${dec("cost_job_x")} times more finished work for every dollar, and 25 of 25 jobs passed against 23 of 25 before.`,
    source: "Same-25-job comparison recorded 8 Oct 2026 (investor_outreach.md). The baseline sheet's all-in figure, US$1.037 per job, also counts orchestrator spend.",
  },
  fleetJobs: {
    big: `${int("fleet_jobs_24h")} jobs in 24 hours`,
    label: `finished by the machine, ${dec("fleet_fail_rate_24h")}% failed or stuck`,
    kind: "MEASURED",
    analogy: `About ${int("fleet_worker_hours_24h")} worker-hours of finished jobs in a day, a median job taking ${dec("fleet_median_job_min")} minutes.`,
    source: `Job ledger (state/fleet/ledger.jsonl), the last 24 hours to ${AS_OF_LONG}, via lib/ledger.json`,
  },
  tests: {
    big: `${int("tests_main")} test cases`,
    label: "in the main TITANOS engine, plus automated safety suites on the control layer",
    kind: "MEASURED",
    analogy: "A pilot's pre-flight checklist, run before every take-off instead of once.",
    source: `Count of test functions in the main engine, ${AS_OF_LONG}, via lib/ledger.json`,
  },
  memory: {
    big: "20.2 GB to 11.8 GB",
    label: "memory the build machine holds",
    kind: "MEASURED",
    analogy: "Same machine, same work, almost half the memory, because waste was found and turned into code.",
    source: "BASELINE_2026-10-08.json, vmmem, powershell Get-Process",
  },
  engineers: {
    big: `${Math.round(v("model_team"))} engineers for ${Math.round(v("model_schedule_months"))} months`,
    label: `what the industry COCOMO model says this build would take (MODELLED). One person built it in about ${Math.round(v("elapsed_months"))} months, around a day job.`,
    kind: "MODELLED",
    analogy: "A whole engineering department, for the price of one person.",
    source: `COCOMO estimate on ${int("estate_sloc")} lines, method on the Engineering page`,
  },
  market: {
    big: "232,912",
    label: "Australian businesses with 5 to 19 staff",
    kind: "RECORDED",
    analogy: "Each one holds the same repetitive work, and none of them has a spare engineering department.",
    source: "ABS, actively trading businesses, June 2026",
  },
} satisfies Record<string, Flex>;
