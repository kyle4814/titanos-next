// flow16_matrix: the measure job for "all 16 self-serve flows" (plan C2 L10 bar, line 1494).
// Reads src/flows.ts (the registry), and for each flow records owner chunk, the named test file and test title that
// exercises it, GREP-VERIFIED to exist (not assumed), and a status. Fails if a registered flow has no evidence entry or
// points at a test that does not exist. No model calls, no network, no clock: output is deterministic.
//   node --experimental-strip-types scripts/flow16_matrix.ts           regenerate FLOW16_MATRIX.md (exit 1 on failure)
//   node --experimental-strip-types scripts/flow16_matrix.ts --check    diff only, write nothing
//   ... --verify-source <path>   also re-grep the kernel explosion file and fail if the quoted lines drifted (read-only)
// "EXISTS" is a grep fact; "PASSES" is what `npm test` in portal-api (node --test) and the site test chain prove.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FLOWS } from "../src/flows.ts";

export type Status = "TESTED" | "OWNED-ELSEWHERE-TESTED" | "OWNED-ELSEWHERE-UNTESTED" | "PENDING LIVE";
export interface Evidence { file: string; title: string } // file relative to the titanos-next repo root; title = literal substring
export interface Entry { id: string; evidence: Evidence[]; gap?: string; live?: string }

const D1_PENDING = "D1 adapter wired in later lanes; migrations (GATE5) and a deploy are a later OWNER CARD";
// One entry per registered flow. Titles are literal substrings the script greps for.
export const MANIFEST: Entry[] = [
  { id: "scan", evidence: [{ file: "scripts/test_guestscan.mjs", title: "result.modelCalls is 0" }, { file: "scripts/test_guestscan.mjs", title: "only DoH host contacted" }], live: "PENDING LIVE: phone wall-clock on real DoH (header of test_guestscan.mjs)" },
  { id: "read", evidence: [{ file: "scripts/test_guestscan.mjs", title: "plan has a step per non-pass finding" }] },
  { id: "signup", evidence: [{ file: "portal-api/test/portal.test.ts", title: "login: magic link creates the account on first verify, token is single use" }, { file: "portal-api/test/drill.test.ts", title: "DRILL: 50 strangers complete every C2-owned self-serve flow with 0 human touches" }], live: "PENDING LIVE: real login-link mail sender (Mailer interface + MockMailer only; GATE2/GATE4 choice); " + D1_PENDING },
  { id: "verify_domain", evidence: [{ file: "portal-api/test/portal.test.ts", title: "domain: TXT must match our token; wrong value and missing record are 422" }, { file: "portal-api/test/drill.test.ts", title: "DRILL: 50 strangers" }], live: "PENDING LIVE: real DoH TXT lookups against a customer zone" },
  { id: "buy", evidence: [{ file: "portal-api/test/portal.test.ts", title: "checkout: monitor and compliance need a VERIFIED domain; ai and leads do not; unknown product 400" }, { file: "portal-api/test/drill.test.ts", title: "DRILL: 50 strangers" }], live: "PENDING LIVE: live Stripe products/prices (creating them is GATE2; test mode and mocked interface only here)" },
  { id: "cancel", evidence: [{ file: "portal-api/test/portal.test.ts", title: "cancel: monitor ends at the period end, retainer not before the 3-month minimum, idempotent, owner only" }] },
  { id: "refund", evidence: [{ file: "portal-api/test/portal.test.ts", title: "refund: compliance inside 14 days with no deliverable is automatic and exact" }, { file: "portal-api/test/portal.test.ts", title: "refund: day 15, deliverable issued, monitor, leads and retainers all go to a review card, never auto" }], live: "PENDING LIVE: live Stripe refund call (mock adapter only)" },
  { id: "hire", evidence: [{ file: "portal-api/test/market.test.ts", title: "happy path: hire, fund, claim, deliver, re-scan proof, payout once, rank from the proof" }, { file: "portal-api/test/market.test.ts", title: "naive stranger: hire, get_paid and dispute all have registered C4 routes" }], live: "PENDING LIVE: funding through live Stripe" },
  { id: "get_paid", evidence: [{ file: "portal-api/test/market.test.ts", title: "get_paid kill test: a delivery the re-scan does not confirm never pays, and no direct payout call can bypass the proof" }, { file: "portal-api/test/market.test.ts", title: "payout twice, forced: two concurrent releases of one proven job produce one transfer and one refusal" }], live: "PENDING LIVE: Stripe Connect accounts and transfers (GATE2; adapter tested against a mock only)" },
  { id: "dispute", evidence: [{ file: "portal-api/test/market.test.ts", title: "dispute freezes the money and NO resolution can pay the pro; only a refund or a resume exists" }, { file: "portal-api/test/market.test.ts", title: "dispute then resume: the job returns to its prior state and can still only pay on proof" }] },
  // docs: the registry route names BOTH /trust and /terms. Only /trust has a dedicated test (C9 proof script); /terms has none.
  { id: "docs", evidence: [{ file: "scripts/test_c9proof.mjs", title: "trust/status says UNKNOWN, no invented uptime figure" }], gap: "/terms has no dedicated test in this tree (grep of scripts/ and portal-api/test finds none); only /trust is covered, so the flow is not claimed tested" },
  { id: "status", evidence: [{ file: "portal-api/test/health.test.ts", title: "health: 200 with db ok and test mode by default" }, { file: "portal-api/test/health.test.ts", title: "health: DB failure is 503, never a fake ok" }] },
  { id: "api_keys", evidence: [{ file: "portal-api/test/portal.test.ts", title: "keys: shown once, hash stored, revoke works, other accounts cannot revoke, scopes sanitised" }] },
  { id: "invoices", evidence: [{ file: "portal-api/test/portal.test.ts", title: "invoices: owner sees own invoice text with ABN and no GST; another account gets 404" }] },
  { id: "data_export", evidence: [{ file: "portal-api/test/portal.test.ts", title: "export: carries the account's own data only, no hashes or secrets" }] },
  { id: "account_deletion", evidence: [{ file: "portal-api/test/portal.test.ts", title: "deletion: needs the word DELETE, cancels subscriptions, wipes email/domains/sessions, keeps invoices without PII, email reusable" }] },
];

// Reconciliation evidence, quoted from the kernel (read-only). --verify-source re-greps these so a drift is loud.
const SRC_EXPLOSION = "/home/tech2/klinge-kernel/EXPLOSION_PORTAL_FULL_SELFSERVE_2026-10-10.md";
const SRC_PLAN = "/home/tech2/klinge-kernel/FULL_BUSINESS_PROJECT/01_BUSINESS_PLAN_2026-10-10.md";
export const SOURCE_QUOTES: { file: string; line: number; needle: string }[] = [
  { file: SRC_EXPLOSION, line: 19, needle: "dispute (rule-coded, escalation card to Kyle only on the edge), docs, status, API keys, invoices, data export, account deletion." },
  { file: SRC_EXPLOSION, line: 21, needle: "completes all 14 flows above with zero human help" },
  { file: SRC_EXPLOSION, line: 47, needle: "all 14 self-serve flows green by the naive-user agent" },
  { file: SRC_PLAN, line: 1494, needle: "all 16 self-serve flows listed green (the source says 14; count unreconciled)" },
];

export interface Row { id: string; owner: string; route: string; status: Status; evidence: Evidence[]; gap?: string; live?: string; missing: string[] }

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = resolve(here, "../.."); // titanos-next repo root

/** A title "exists" when the file is present and a line contains it. For *.test.ts files the line must be a test( declaration. */
export function titleExists(root: string, ev: Evidence): boolean {
  const p = resolve(root, ev.file);
  if (!existsSync(p)) return false;
  const lines = readFileSync(p, "utf8").split("\n");
  const isNodeTest = /\.test\.ts$/.test(ev.file);
  return lines.some((l) => l.includes(ev.title) && (!isNodeTest || /^\s*test\(/.test(l)));
}

export function buildRows(root = DEFAULT_ROOT, manifest: Entry[] = MANIFEST, flows = FLOWS): Row[] {
  return flows.map((f) => {
    const m = manifest.find((e) => e.id === f.id);
    const evidence = m?.evidence ?? [];
    const missing = m ? evidence.filter((e) => !titleExists(root, e)).map((e) => `${e.file} :: ${e.title}`) : ["(no manifest entry for this registered flow)"];
    const verified = !missing.length && evidence.length > 0;
    let status: Status = "OWNED-ELSEWHERE-UNTESTED";
    if (verified && !m?.gap) status = f.owner === "C2" ? "TESTED" : "OWNED-ELSEWHERE-TESTED";
    return { id: f.id, owner: f.owner, route: f.route ?? "(none registered)", status, evidence, gap: m?.gap, live: m?.live, missing };
  });
}

export function problems(rows: Row[], manifest: Entry[] = MANIFEST, flows = FLOWS): string[] {
  const out: string[] = [];
  for (const r of rows) for (const m of r.missing) out.push(`flow ${r.id}: test does not exist: ${m}`);
  for (const e of manifest) if (!flows.some((f) => f.id === e.id)) out.push(`manifest entry ${e.id} is not a registered flow`);
  for (const r of rows) if (r.owner === "C2" && !r.evidence.length) out.push(`flow ${r.id}: C2-owned with no test evidence`);
  return out;
}

const esc = (s: string) => s.replace(/\|/g, "\\|");

export function render(rows: Row[]): string {
  const n = (s: Status) => rows.filter((r) => r.status === s).length;
  const c2 = rows.filter((r) => r.owner === "C2");
  const byOwner = (o: string) => rows.filter((r) => r.owner === o).length;
  const L: string[] = [];
  L.push("# FLOW16 MATRIX (generated, do not edit by hand)");
  L.push("");
  L.push("Generated by `portal-api/scripts/flow16_matrix.ts` from `portal-api/src/flows.ts`; regenerate with `node --experimental-strip-types scripts/flow16_matrix.ts` inside `portal-api/`. `test/flow16_matrix.test.ts` regenerates it in memory and fails on any diff. No model calls, no network, no timestamp.");
  L.push("");
  L.push("EXISTS means the named test file is on disk and a `test(` line (or, for the site `.mjs` scripts, an assertion message) contains the title verbatim. It does not mean the test passed: run `npm test` in `portal-api/` and the site test chain for that. Status words: TESTED (C2-owned, test exists), OWNED-ELSEWHERE-TESTED (another chunk's flow, its test exists), OWNED-ELSEWHERE-UNTESTED (no verified test, or a stated gap), PENDING LIVE (needs real traffic or a gated live resource; shown in the Live column because a flow can be tested in code and still pending live).");
  L.push("");
  L.push("## Summary");
  L.push("");
  L.push(`- Registered flows: ${rows.length}. By owner: C2 ${byOwner("C2")}, C1 ${byOwner("C1")}, C4 ${byOwner("C4")}, static ${byOwner("static")}.`);
  L.push(`- TESTED ${n("TESTED")} / OWNED-ELSEWHERE-TESTED ${n("OWNED-ELSEWHERE-TESTED")} / OWNED-ELSEWHERE-UNTESTED ${n("OWNED-ELSEWHERE-UNTESTED")}. Flows with a PENDING LIVE note: ${rows.filter((r) => r.live).length} of ${rows.length}.`);
  L.push(`- C2 alone: ${c2.filter((r) => r.status === "TESTED").length} of ${c2.length} C2-owned flows have verified tests; all ${rows.length} are covered by a verified test only if the OWNED-ELSEWHERE-UNTESTED count is 0 (it is ${n("OWNED-ELSEWHERE-UNTESTED")}).`);
  L.push("");
  L.push("## Matrix");
  L.push("");
  L.push("| # | Flow | Owner | Route (registry) | Status | Test file | Test title (grep-verified) | Live |");
  L.push("|---|---|---|---|---|---|---|---|");
  rows.forEach((r, i) => {
    const files = [...new Set(r.evidence.map((e) => e.file))].join("<br>") || "NONE";
    const titles = r.evidence.map((e) => esc(e.title) + (titleExists(DEFAULT_ROOT, e) ? "" : " (NOT FOUND)")).join("<br>") || "NONE";
    L.push(`| ${i + 1} | ${r.id} | ${r.owner} | ${esc(r.route)} | ${r.status} | ${files} | ${titles} | ${r.live ? esc(r.live) : "-"} |`);
  });
  const gaps = rows.filter((r) => r.gap);
  L.push("");
  L.push("## Gaps");
  L.push("");
  if (!gaps.length) L.push("None.");
  for (const g of gaps) L.push(`- ${g.id}: ${g.gap}`);
  L.push("");
  L.push("## 14 versus 16 reconciliation (PROPOSAL, evidence labelled)");
  L.push("");
  L.push("OBSERVED (read-only grep of `EXPLOSION_PORTAL_FULL_SELFSERVE_2026-10-10.md` in the kernel):");
  L.push("");
  for (const q of SOURCE_QUOTES) L.push(`- \`${q.file.replace("/home/tech2/klinge-kernel/", "")}:${q.line}\`: "${q.needle}"`);
  L.push("");
  L.push("OBSERVED: the source's own sentence at lines 18 to 19 lists these items, in order: scan, read, sign up, verify a domain, buy, cancel, refund, hire, get paid, dispute, docs, status, API keys, invoices, data export, account deletion. Counted by the script from `src/flows.ts`, that is " + rows.length + " named items, while lines 21 and 47 of the same file say \"14\". So the source's prose list and its stated count disagree inside one file. The plan (line 1494) copied the list and flagged the mismatch.");
  L.push("");
  L.push("UNKNOWN: which 14 the author meant. No other file in the kernel states a 14-item list (the only other hits for the file name are the plan, the queue and the brief for this lane). The count was never itemised, so any choice below is a proposal, not a recovery.");
  L.push("");
  L.push("PROPOSAL (INFERRED, kill test: Kyle names the 14, or the source author's notes turn up): two natural merges take 16 to 14 without dropping a capability: (a) `scan` + `read` are one customer step, \"scan and read the result\" (both C1, one page); (b) `hire` + `get_paid` are the two halves of one marketplace job lifecycle in C4 (the hire flow ends at payout). Under that reading the 14 are: scan-and-read, signup, verify_domain, buy, cancel, refund, hire-and-get-paid, dispute, docs, status, api_keys, invoices, data_export, account_deletion.");
  L.push("");
  L.push("DECISION FOR THE PLAN: keep 16 as the bar. It is a superset of every 14 reading (each proposal merges, none drops), so a test matrix green on 16 is green on any 14. The counter pinned in `test/drill.test.ts` stays at 16.");
  L.push("");
  return L.join("\n");
}

export function verifySource(): string[] {
  const bad: string[] = [];
  for (const q of SOURCE_QUOTES) {
    if (!existsSync(q.file)) { bad.push(`source missing: ${q.file}`); continue; }
    const line = readFileSync(q.file, "utf8").split("\n")[q.line - 1] ?? "";
    if (!line.includes(q.needle)) bad.push(`${q.file}:${q.line} no longer contains: ${q.needle}`);
  }
  return bad;
}

export const OUT_PATH = resolve(here, "../FLOW16_MATRIX.md");

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const rows = buildRows();
  const probs = problems(rows);
  if (args.includes("--verify-source")) probs.push(...verifySource());
  const text = render(rows);
  if (args.includes("--check")) {
    const cur = existsSync(OUT_PATH) ? readFileSync(OUT_PATH, "utf8") : "";
    if (cur !== text) probs.push("FLOW16_MATRIX.md is stale: regenerate it");
  } else writeFileSync(OUT_PATH, text);
  if (probs.length) { console.error("FLOW16 FAILED\n" + probs.join("\n")); process.exit(1); }
  console.log(`FLOW16 OK ${rows.length} flows: ${rows.filter((r) => r.status === "TESTED").length} TESTED, ${rows.filter((r) => r.status === "OWNED-ELSEWHERE-TESTED").length} OWNED-ELSEWHERE-TESTED, ${rows.filter((r) => r.status === "OWNED-ELSEWHERE-UNTESTED").length} OWNED-ELSEWHERE-UNTESTED`);
}
