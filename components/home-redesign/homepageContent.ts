// Homepage redesign content (2026-11-28). Every number shown on / is bound here to the ledger or to the case-study record the site
// already cites; nothing is typed in as a bare claim without a source line. scripts/test_home_redesign.mjs checks the built page against these.
import { LEDGER, int, dec, isUnsourced, AS_OF_LONG } from "@/lib/ledger";
import type { LedgerKey } from "@/lib/ledger";
import { CASES } from "@/lib/caseStudies";

export const ENGINE_SLUG = "titanos-engine";
export const ENGINE = CASES.find((c) => c.slug === ENGINE_SLUG)!;
const fact = (i: number) => ENGINE.facts[i][0];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** ledger as_of ("2026-10-13T04:05:02" or "2026-10-09") -> "13 October 2026" */
export function asOfLong(k: LedgerKey): string {
  const [y, m, d] = LEDGER[k].as_of.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export type Metric = { id: string; icon: "code" | "layers" | "bolt" | "trend"; value: string; title: string; scope: string; status: "MEASURED" | "COUNTED"; href: string; hrefLabel: string };

// 1 and 2 come from the TITANOS engine case study (git log counted 27 Nov 2026; full gate reading 18 Nov 2026).
// 3 and 4 come from lib/ledger.json (klinge-kernel export), the same rows /engineering and the old hero cited.
export const METRICS: Metric[] = [
  {
    id: "commits", icon: "code", value: fact(0), title: "Work commits",
    scope: "29 Sep to 26 Nov 2026, git log counted 27 Nov; merges and backup snapshots excluded",
    status: "COUNTED", href: `/case-studies/${ENGINE_SLUG}`, hrefLabel: "Source",
  },
  {
    id: "suites", icon: "layers", value: "652 / " + fact(2), title: "Test suites passing",
    scope: "Full gate reading, 18 Nov 2026. 14 suites failed and are on the fix list",
    status: "MEASURED", href: `/case-studies/${ENGINE_SLUG}`, hrefLabel: "Source",
  },
  {
    id: "lines", icon: "bolt", value: int("estate_sloc"), title: "Lines of production code",
    scope: `Across ${int("estate_repos")} repositories, non-blank non-comment, ledger as of ${asOfLong("estate_sloc")}`,
    status: "MEASURED", href: "/engineering", hrefLabel: "Source",
  },
  {
    id: "job-cost", icon: "trend", value: `${dec("cost_job_x")}x`, title: "Lower cost per job",
    scope: `US$${dec("cost_job_before")} to US$${dec("cost_job_after")} on 25 matched jobs, recorded 8 October 2026`,
    status: "MEASURED", href: "/efficiency", hrefLabel: "Source",
  },
];
// UNSOURCED ledger rows may never be shown as plain fact (fence C9); the build fails if one is bound here.
for (const k of ["estate_sloc", "estate_repos", "cost_job_x", "cost_job_before", "cost_job_after"] as LedgerKey[]) {
  if (isUnsourced(k)) throw new Error(`home metric bound to UNSOURCED ledger row ${k}`);
}

export const LEDGER_AS_OF = AS_OF_LONG;

export const SERVICES = [
  { icon: "code", title: "AI Engineering", body: "Software built and tested for one specific operational problem, with a receipt for every change.", href: "/engineering", aria: "AI Engineering: the measured engineering record" },
  { icon: "cog", title: "Automation Systems", body: "Repetitive work turned into a reliable system, with human review kept on anything that matters.", href: "/ai-delivery", aria: "Automation Systems: the AI Partnership retainers" },
  { icon: "monitor", title: "Enterprise Demos", body: "Real builds you can open: a dealership command centre, a course platform and a trading app, each labelled REAL.", href: "/case-studies", aria: "Enterprise Demos: the case studies" },
  { icon: "chart", title: "Growth Infrastructure", body: "Verified Australian business leads and follow-up systems, built on public information only.", href: "/leads", aria: "Growth Infrastructure: verified leads programmes" },
] as const;

export const STEPS = [
  { n: 1, icon: "layers", title: "Intake", body: "Goals, constraints and what you permit. We ask before we touch anything." },
  { n: 2, icon: "brain", title: "Build", body: "A scoped system, built and reviewed with controlled access." },
  { n: 3, icon: "check", title: "Prove", body: "Run, test and measure. You get the receipts and the limits." },
  { n: 4, icon: "rocket", title: "Scale", body: "Expand only after the evidence and your approval." },
] as const;

export const TRUST = [
  { icon: "link", label: "Source-linked figures" },
  { icon: "gate", label: "Human approval gates" },
  { icon: "check", label: "Tested before it ships" },
  { icon: "receipt", label: "A receipt for every change" },
] as const;

/** The outcome panel on the featured case: three facts taken as written from the engine case study record. */
export const CASE_OUTCOMES = [
  { icon: "code", value: fact(0), label: "work commits in 50 active days" },
  { icon: "clock", value: fact(1), label: "soak test, 8 of 9 checks passed, 1 left open" },
  { icon: "gate", value: fact(3), label: "human gates on money, credentials, legal, outbound and the irreversible" },
] as const;

export const PROOF_DOCS = [
  { file: "declaration/TITANOS_Declaration_2026-11.pdf", href: "/declaration/TITANOS_Declaration_2026-11.pdf", title: "The Declaration", sub: "Dated claims, each with its source and status", kind: "PDF" },
  { file: "sample-evidence-pack-excerpt.pdf", href: "/sample-evidence-pack-excerpt.pdf", title: "Evidence pack excerpt", sub: "What a TITANOS report looks like, in full layout", kind: "PDF" },
  { file: "proof/trading-app-build-replay.log", href: "/proof/trading-app-build-replay.log", title: "Build replay log", sub: "A trading app, commit by commit, tests passed over total", kind: "LOG" },
] as const;
