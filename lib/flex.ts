// W3 copy: the figures the whole site quotes, in one place, each with its label and source.
// Every value traces to state/baseline/BASELINE_2026-10-08.json (klinge-kernel) or the named source.
// Labels: MEASURED (we read it off the running system), RECORDED (a stored result), EXAMPLE, MODELLED.
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
    big: "215,000 to 29,130",
    label: "tokens each worker reads before it starts",
    kind: "MEASURED",
    analogy: "A new starter's induction folder cut from a filing cabinet to one binder, with the work done just as well.",
    source: "BASELINE_2026-10-08.json, worker start tokens, bin/context_audit.py, 52 sessions, 0 flagged",
  },
  costPerJob: {
    big: "US$0.97 to US$0.12",
    label: "cost of one worker job, 8 October 2026",
    kind: "RECORDED",
    analogy: "8.4 times more finished work for every dollar, and 25 of 25 jobs passed against 23 of 25 before.",
    source: "Same-25-job comparison recorded 8 Oct 2026 (investor_outreach.md). The baseline sheet's all-in figure, US$1.037 per job, also counts orchestrator spend.",
  },
  fleetJobs: {
    big: "251 jobs in 24 hours",
    label: "finished by the machine, 4.0% failed",
    kind: "MEASURED",
    analogy: "About one finished job every six minutes, overnight and through the day.",
    source: "BASELINE_2026-10-08.json, fleet jobs per hour, state/fleet/ledger.jsonl, median 6.0 minutes per job (n=233)",
  },
  tests: {
    big: "5,777 tests",
    label: "run in one full pass of the TITANOS suite",
    kind: "RECORDED",
    analogy: "A pilot's pre-flight checklist, run before every take-off instead of once.",
    source: "r2_titanos-cron-light-redo.md receipt, ./run_all_tests.sh, 8 Oct 2026",
  },
  memory: {
    big: "20.2 GB to 11.8 GB",
    label: "memory the build machine holds",
    kind: "MEASURED",
    analogy: "Same machine, same work, almost half the memory, because waste was found and turned into code.",
    source: "BASELINE_2026-10-08.json, vmmem, powershell Get-Process",
  },
  engineers: {
    big: "20 engineers for 27 months",
    label: "what the industry COCOMO model says this build would take. One person built it in about 4 months.",
    kind: "MODELLED",
    analogy: "A whole engineering department, for the price of one person.",
    source: "COCOMO estimate, method on the Engineering page",
  },
  market: {
    big: "232,912",
    label: "Australian businesses with 5 to 19 staff",
    kind: "RECORDED",
    analogy: "Each one holds the same repetitive work, and none of them has a spare engineering department.",
    source: "ABS, actively trading businesses, June 2026",
  },
} satisfies Record<string, Flex>;
