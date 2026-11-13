// The Final Business Declaration: ONE content source for the popup, the /declaration page and the PDF.
// Every number lives in FIGURES with its source and date; the PDF appendix prints that table. A figure that was not
// measured says so. No customer data, no credentials, no hostnames or addresses, nothing about a person's private life.
// Keep this file free of path aliases and JSON imports so node tests can load it directly (node --experimental-strip-types).
import { PRICING, LEADS, formatAUD } from "./pricing.ts";
import { CASES } from "./caseStudies.ts";
import { aud } from "./ledger.ts";

export const DECLARATION_VERSION = "2026-11";
export const DECLARATION_DATE = "10 November 2026";
export const DECLARATION_PATH = "/declaration";
export const PDF_PATH = "/declaration/TITANOS_Declaration_2026-11.pdf";
export const PDF_NAME = "TITANOS_Declaration_2026-11.pdf";

/** localStorage key remembering a dismissed popup. Bump the suffix to show it again to everyone. */
export const DISMISS_KEY = "titanos.declaration.dismissed.2026-11";

/** Public POST target of the mailing list route (portal-api POST /v1/subscribe). */
export const SUBSCRIBE_ENDPOINT = "https://api.titanos.tech/v1/subscribe";
export const CONSENT_LINE = "Daily artifacts from TITANOS. Unsubscribe any time.";
export const DEFAULT_TAG = "daily-artifacts";

export type CourseId = "trading" | "sales";
/** Sign-up URLs (decided 2026-11-10, not deployed until the site approval card). null = the card shows "Join the waitlist" and tags the signup with the course. */
export const COURSE_LINKS: Record<CourseId, string | null> = { trading: "https://learn-trading.titanos.tech", sales: null };

export type FigureStatus = "MEASURED" | "COMPUTED" | "PUBLISHED" | "OPERATOR_STATED";
export interface Figure { id: string; value: string; line: string; status: FigureStatus; source: string; asOf: string; method: string }

export const FIGURES: Figure[] = [
  { id: "engine_commits", value: "7,236", line: "7,236 commits in the engine repository in 43 days (first commit 29 September 2026).", status: "MEASURED", source: "git rev-list --count origin/main, engine repository", asOf: "2026-11-10", method: "Commit count on the main branch; first commit date from git log." },
  { id: "engine_pace", value: "168", line: "About 168 commits a day on average across those 43 days.", status: "COMPUTED", source: "engine_commits divided by 43 calendar days (29 September to 10 November inclusive)", asOf: "2026-11-10", method: "7,236 / 43 = 168.3." },
  { id: "site_commits", value: "1,041", line: "1,041 commits in this website's repository since 4 June 2026.", status: "MEASURED", source: "git rev-list --count origin/main, website repository", asOf: "2026-11-10", method: "Commit count on the main branch; first commit date from git log." },
  { id: "engine_suites", value: "527", line: "527 automated test suites in the engine's main gate.", status: "MEASURED", source: "distinct test_*.sh entries in the SUITES list of the engine's verify script on origin/main", asOf: "2026-11-10", method: "Entries counted by script, duplicates removed (528 listed, 527 distinct)." },
  { id: "site_tests", value: "149", line: "149 test commands in this website's test manifest, plus built-page checks that run after every build.", status: "MEASURED", source: "non-comment lines of scripts/test_manifest.txt, website repository, origin/main", asOf: "2026-11-10", method: "Line count of the manifest the test runner reads." },
  { id: "api_tests", value: "1,054", line: "114 test files and 1,054 test cases in the customer backend (sign-in, billing, security).", status: "MEASURED", source: "portal-api/test/*.test.ts in the website repository", asOf: "2026-11-10", method: "Files counted with ls; test() and it() declarations counted with grep (declarations, not executions)." },
  { id: "mutants", value: "21", line: "21 mutation-test scripts that break the code on purpose to prove the tests notice.", status: "MEASURED", source: "scripts/test_*mutants.sh, website repository", asOf: "2026-11-10", method: "File count." },
  { id: "ledger_tests", value: "6,314", line: "6,314 automated test cases passing across the estate on 9 October 2026.", status: "MEASURED", source: "site ledger (lib/ledger.json, tests_main), from the engine's recorded verify runs", asOf: "2026-10-09", method: "Recorded gate results. Not re-run for this document." },
  { id: "loc", value: "256,217", line: "256,217 lines of production code across 12 repositories (counted 13 October 2026).", status: "MEASURED", source: "site ledger (lib/ledger.json, estate_sloc); method on titanos.tech/engineering", asOf: "2026-10-13", method: "Non-blank, non-comment lines; mirrors, clones and third-party code excluded. Not re-counted for this document." },
  { id: "cost_job", value: "8.4x", line: "Cost per AI job fell 8.4 times, from US$0.97 to US$0.12, while quality on the matched set rose from 23 of 25 to 25 of 25.", status: "MEASURED", source: "site ledger (lib/ledger.json, cost_job_x), from the kernel compression gate result", asOf: "2026-10-09", method: "25 matched jobs run before and after the compressed instruction set." },
  { id: "fleet", value: "1,549", line: "1,549 agent jobs in one 24 hour window, with a 7.3% failure rate (failed or stuck) and a median job time of 12 minutes.", status: "MEASURED", source: "site ledger (lib/ledger.json, fleet_jobs_24h, fleet_fail_rate_24h, fleet_median_job_min), engine job ledger", asOf: "2026-10-13", method: "Job ledger totals for the 24 hours to the stated time. Not re-measured for this document." },
  { id: "hw_local", value: "8 cores, 23 GB", line: "The workstation is a laptop: Intel Core i7-7700HQ (8 logical CPUs), 23 GB of RAM, running Linux under Windows.", status: "MEASURED", source: "nproc, free -g and lscpu on the workstation", asOf: "2026-11-10", method: "Commands run on the day." },
  { id: "hw_cloud", value: "4 cores, 15 GB", line: "Full test suites run on a cloud test runner: AMD EPYC 7B12, 4 cores, 15 GB of RAM.", status: "MEASURED", source: "nproc, free -g and lscpu on the cloud test runner", asOf: "2026-11-10", method: "Commands run on the day. The runner's address is deliberately not published." },
  { id: "cost_build", value: "about US$30 a month", line: "About US$30 a month of AI tools while the main engine was built (to 29 September 2026).", status: "OPERATOR_STATED", source: "titanos.tech/engineering, operator figure; no receipt on file", asOf: "2026-10-09", method: "Stated by the operator. Not receipted." },
  { id: "cost_now", value: `about ${aud("compute_today_aud_month")} a month`, line: `About ${aud("compute_today_aud_month")} a month of AI tool subscriptions since then.`, status: "OPERATOR_STATED", source: "titanos.tech/engineering and /costs, operator figure; no receipt on file", asOf: "2026-10-09", method: "Stated by the operator. Not receipted. A receipted subscription ledger is not measured yet." },
  { id: "prices", value: "AU$0 to AU$149,997", line: "Published prices run from a free scan to enterprise programmes, all from the site's own price file.", status: "PUBLISHED", source: "lib/pricing.ts in the website repository", asOf: "2026-11-10", method: "Read from the file the live site renders its prices from." },
];

export const FIG: Record<string, Figure> = Object.fromEntries(FIGURES.map((f) => [f.id, f]));

export const HEADLINE = "The final business declaration";
export const WHO = [
  "TITANOS is a one-person AI engineering practice in Brisbane, run with a team of AI agents and a strict test gate. It builds software, security checks and AI systems for small and mid-sized businesses.",
  "This page is everything in the open: what has been built, what it cost, how fast it ran, how it is tested, how it is kept safe, and how you can do the same. It is free to read, copy and share.",
];

export const ACHIEVEMENT_IDS = ["engine_commits", "engine_pace", "engine_suites", "ledger_tests", "loc", "cost_job", "fleet", "site_commits"];
export const ACHIEVEMENTS: string[] = ACHIEVEMENT_IDS.map((id) => FIG[id].line);

export interface Group { title: string; points: string[] }
export const CAPABILITY: Group[] = [
  { title: "Cost", points: [
    FIG.cost_build.line,
    FIG.cost_now.line,
    FIG.cost_job.line,
    "Receipted subscription costs are not measured yet; the two monthly figures above are the operator's own numbers and are labelled that way in the appendix.",
  ] },
  { title: "Speed", points: [
    FIG.engine_pace.line,
    FIG.fleet.line,
    "Case studies below give start and finish times for whole builds, taken from the git log.",
  ] },
  { title: "Quality", points: [
    "Nothing counts as done until the full gate is green and the result has been read, not assumed.",
    "A second agent reviews each change; no agent signs off its own work.",
    FIG.cost_job.line,
  ] },
  { title: "Tests and automated testing", points: [
    FIG.engine_suites.line,
    FIG.site_tests.line,
    FIG.api_tests.line,
    FIG.mutants.line,
    "Every failure that reaches a person becomes a regression test the same day.",
    "Copy is linted too: no dashes, no filler words, and no addresses or credentials in anything public.",
  ] },
  { title: "Security", points: [
    "Outside parties are only ever checked passively, from public DNS records. Nothing of theirs is touched.",
    "Money, credentials, legal commitments, messages to third parties and anything irreversible need a human approval tap first.",
    "Secrets live outside the code and are never pasted into chat; a secret scan is part of the engine's test gate.",
    "The website sets a content security policy and publishes a security contact file (security.txt).",
    "The customer backend verifies signed payment events, rate limits sensitive routes per visitor, and sends no-store and anti-framing headers on every response.",
  ] },
  { title: "Hardware", points: [FIG.hw_local.line, FIG.hw_cloud.line] },
];

export interface PriceRow { name: string; price: string; href: string }
export const SUBSCRIPTIONS: PriceRow[] = [
  { name: "Free email security scan", price: formatAUD(PRICING.FREE_SCAN), href: "/scan" },
  { name: "TITANOS Monitor", price: `${formatAUD(PRICING.MONITOR_MONTHLY)} a month or ${formatAUD(PRICING.MONITOR_ANNUAL)} a year`, href: "/monitor" },
  { name: "Job Flow for tradies", price: `${formatAUD(PRICING.JOB_FLOW_MONTHLY)} a month`, href: "/tradies" },
  { name: "AI Growth Partner", price: `${formatAUD(PRICING.AI_GROWTH_PARTNER)} a month, ${PRICING.AI_RETAINER_MIN_MONTHS}-month minimum`, href: "/ai-delivery" },
  { name: "AI Ops Partner", price: `${formatAUD(PRICING.AI_OPS_PARTNER)} a month, ${PRICING.AI_RETAINER_MIN_MONTHS}-month minimum`, href: "/ai-delivery" },
  { name: "Embedded AI Partner", price: `from ${formatAUD(PRICING.AI_EMBEDDED_PARTNER)} a month, ${PRICING.AI_RETAINER_MIN_MONTHS}-month minimum`, href: "/ai-delivery" },
  { name: "Lead lists", price: `${formatAUD(LEADS.STARTER.price)} to ${formatAUD(LEADS.CAMPAIGN.price)} one-off, or ${formatAUD(LEADS.RETAINER.price)} a month`, href: "/leads" },
  { name: "Compliance pack", price: `${formatAUD(PRICING.PACK_PRICE)} one-off`, href: "/compliance" },
  { name: "Enterprise programmes", price: `${formatAUD(PRICING.ENTERPRISE_GOVERNANCE)} to ${formatAUD(PRICING.OEM_LICENCE_ANNUAL)}, scoped on a call`, href: "/enterprise" },
];
export const SUBSCRIPTIONS_NOTE = "Prices are read from the site's own price file and link to the page that sells each one. See also /pricing and /costs.";

export interface Step { title: string; text: string }
export const METHOD: Step[] = [
  { title: "Write down what done means first", text: "Before anything is built, list the acceptance checks: what must work, what must not break, what the limits are. Everything later is judged against that list, not against a feeling." },
  { title: "Run one orchestrator and many small agents", text: "One session holds the plan and the context. It hands self-contained briefs to agents, each with one job, its own branch and the exact files it may touch. Small, bounded jobs fail cheaply." },
  { title: "Tests before claims", text: "A change is not described as working until a test shows it. Each bug that gets through becomes a regression test, and mutation tests confirm the tests really fail when the code is wrong." },
  { title: "Run the full suite on a cloud test runner", text: "The workstation stays free for building. The whole suite runs on a separate machine from a clean copy, and the pass and fail counts are read, not assumed." },
  { title: "Use independent review", text: "A different agent, with no stake in the change, reviews it. It only blocks on a demonstrated fault. Everything else goes on a list for later, so work keeps moving." },
  { title: "Put approval gates around the irreversible", text: "Spending money, handling credentials, signing, messaging a third party and deleting things go to a person as a one-tap card. Everything reversible and in scope just gets done." },
  { title: "Keep receipts", text: "Every change leaves a commit, a test result and a note of what is still unknown. A number without a source and a date does not get published." },
  { title: "Turn repeats into code", text: "Anything done twice becomes a script with a test. That is how a one-person practice keeps pace: the machine does the known, the person decides the unknown." },
];
export const METHOD_NOTE = "This is not magic and it is not hands-off. A person sets the direction, approves the gated steps and owns every decision that matters.";

export interface CourseDef { id: CourseId; title: string; blurb: string; caseSlug: string }
export const COURSES: CourseDef[] = [
  { id: "trading", title: "Trading platform (includes the AI course)", blurb: "A phone-first trading education platform: a 200-lesson course, live charts, an AI tutor on every screen and a practice-money journal. The course on how to use AI sits inside it.", caseSlug: "trading-app" },
  { id: "sales", title: "Sales course", blurb: "A sales course of 190 modules and 1,900 lessons with quizzes and an AI coach for questions, role-play and speaking practice, built for a sales coach.", caseSlug: "sales-coaching-course" },
];

export type CourseAction = { kind: "link"; url: string } | { kind: "waitlist"; tag: string; source: string };
/** The one place a course card decides link or waitlist. A null link always falls back to the waitlist, tagged with the course. */
export function courseAction(c: CourseDef, links: Record<CourseId, string | null> = COURSE_LINKS): CourseAction {
  const url = links[c.id];
  return url ? { kind: "link", url } : { kind: "waitlist", tag: `course-${c.caseSlug}`, source: "declaration-waitlist" };
}

export interface CaseItem { slug: string; title: string; sector: string; label: string; href: string; facts: [string, string][] }
/** Built straight from CASES: a new case study appears here, on the page and in the PDF with no edit to this file. */
export const CASE_LIST: CaseItem[] = CASES.map((c) => ({ slug: c.slug, title: c.title, sector: c.sector, label: c.label, href: `/case-studies/${c.slug}`, facts: c.facts.slice(0, 4) as [string, string][] }));
export const CASES_NOTE = "Each case links to its own page with dates, costs and what was tested. Client names are never published, and every figure traces to the build's git log or a dated usage reading.";

export const APPENDIX_INTRO = `Every figure in this declaration, with where it came from and when. Measured on ${DECLARATION_DATE} unless a different date is shown. MEASURED means counted from a real source. COMPUTED means arithmetic on measured figures. PUBLISHED means read from the live price file. OPERATOR_STATED means the operator's own figure with no receipt on file. Figures dated 9 October 2026 or 13 October 2026 come from the site ledger and were not re-measured for this document.`;
export const APPENDIX_CASES = "Case study figures: taken from lib/caseStudies.ts as at the date above. Each is traceable to that build's git log or a dated usage reading, and the case page shows the detail.";

export const STILL_UNKNOWN = "Not measured yet: a receipted subscription ledger, lines of code re-counted after 13 October 2026, and any revenue figure. They are left out rather than guessed.";

/** Plain text of the whole declaration. The PDF's content hash is taken over this, so the PDF cannot drift from the source. */
export function declarationText(): string {
  const out: string[] = [HEADLINE, ...WHO, "Key achievements", ...ACHIEVEMENTS];
  out.push("AI engineering capability");
  for (const g of CAPABILITY) out.push(g.title, ...g.points);
  out.push("Subscriptions and prices", ...SUBSCRIPTIONS.flatMap((s) => [s.name, s.price]), SUBSCRIPTIONS_NOTE);
  out.push("Case studies", CASES_NOTE, ...CASE_LIST.flatMap((c) => [c.title, c.sector, ...c.facts.flat()]));
  out.push("How we do it", ...METHOD.flatMap((s) => [s.title, s.text]), METHOD_NOTE);
  out.push("Courses", ...COURSES.flatMap((c) => { const a = courseAction(c); return [c.title, c.blurb, a.kind === "link" ? a.url : "Join the waitlist"]; }));
  out.push("Daily artifacts", CONSENT_LINE);
  out.push("Appendix: sources", APPENDIX_INTRO, ...FIGURES.flatMap((f) => [f.value, f.status, f.source, f.asOf, f.method]), APPENDIX_CASES, STILL_UNKNOWN);
  return out.join("\n");
}
