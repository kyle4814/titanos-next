/**
 * Black Ice dossiers: single source of truth.
 *
 * Same pattern as lib/blog.ts (typed content array, ContentBlock union reused unchanged), plus an
 * honesty layer: every dossier carries its evidence rung, an independent review verdict, what was
 * claimed versus tested, what it does not prove, limitations and sources.
 *
 * THE GATE: `published` is the single switch. While false, no page is emitted (generateStaticParams
 * omits the slug) and indexableRoutes() omits the URL, so an unapproved dossier cannot reach the
 * static export. Slugs are permanent once published. Enforced by scripts/test_dossiers.mjs.
 */
import type { ContentBlock } from "@/lib/blog";

export type EvidenceRung = "THESIS" | "EXAMPLE" | "OBSERVED" | "REPRODUCED" | "UNVERIFIED" | "UNKNOWN";
export type ReviewVerdict = "NOT_REVIEWED" | "REVIEWED_PASS" | "REVIEWED_REJECT" | "INCONCLUSIVE";

export type Dossier = {
  contentId: string;
  slug: string;
  title: string;
  /** SEO meta description, 155 characters at most. */
  description: string;
  excerpt: string;
  date: string;
  updated?: string;
  audience: string;
  series: string;
  rung: EvidenceRung;
  review: ReviewVerdict;
  claimedVsTested: { claimed: string; tested: string };
  body: ContentBlock[];
  asset?: { kind: "worksheet" | "checklist" | "protocol" | "diagram-spec"; title: string; items: string[] };
  objection: string;
  doesNotProve: string[];
  limitations: string[];
  sources: { label: string; note: string; url?: string }[];
  buyerReading: string;
  builderReading: string;
  corrections: { date: string; note: string }[];
  /** `commercial` carries the open invitation that follows the reader question. */
  cta: { question: string; commercial?: string };
  relatedSlugs?: string[];
  /** Social card text for the page image. */
  image?: { alt: string; caption: string };
  published: boolean;
};

export const SITE_DOSSIER_BASE = "https://titanos.tech/black-ice/dossiers";

export const DOSSIERS: Dossier[] = [
  {
    "contentId": "BI-Y1-092",
    "slug": "seven-question-proof-test",
    "title": "Seven Questions to Ask an AI Vendor Before You Buy",
    "description": "Seven plain questions and a free printable worksheet to test whether an AI vendor's \"finished\" is real. Works on any vendor. No signup.",
    "excerpt": "Seven plain questions and a printable worksheet to test whether an AI vendor's \"finished\" is real.",
    "date": "2026-10-28",
    "audience": "practical buyers and operators, from sole traders to enterprise procurement, who are evaluating AI systems that do multi-step work",
    "series": "Black Ice, Fault Line (Day 092), buyer and operator utility",
    "rung": "THESIS",
    "review": "REVIEWED_PASS",
    "claimedVsTested": {
      "claimed": "[THESIS] This page claims that seven questions, asked in order and scored on the kind of evidence offered, give a buyer a better view of a vendor than a demo alone.",
      "tested": "[OBSERVED] What was actually tested: nothing. No buyer was surveyed, no vendor was put through this checklist, and no purchase decision has been compared against the results of using it. The checklist was designed at a desk. [UNKNOWN] Whether these seven are the seven best for every buyer is not measured. They are our best argued selection, and the closing question on this page asks you to tell us which one is missing. [UNKNOWN] Whether scoring a vendor with this worksheet predicts a better outcome than not scoring them is not measured. [THESIS] Because nothing was tested, the correct status for this whole page is a guide and an argument, not a finding."
    },
    "body": [
      {
        "type": "p",
        "text": "Free page. No signup, no email, no gate of any kind."
      },
      {
        "type": "h2",
        "text": "Part 1. BLUF"
      },
      {
        "type": "p",
        "text": "[THESIS] This page gives you seven questions to put to any vendor who sells you an AI system that does work on its own, plus a printable worksheet to score the answers."
      },
      {
        "type": "p",
        "text": "[THESIS] It is for practical buyers and operators, from a one-person business to a large enterprise, who have to decide whether a thing that \"finished\" has actually finished."
      },
      {
        "type": "p",
        "text": "[THESIS] It does not cover model quality benchmarks, legal contract terms, security certification or pricing comparison, and it is not an audit."
      },
      {
        "type": "h2",
        "text": "Part 2. The claim and the stakes"
      },
      {
        "type": "h3",
        "text": "What appears true."
      },
      {
        "type": "p",
        "text": "[THESIS] A modern AI system can produce a convincing report that a task is complete: a green tick, a summary, a log with no errors in it."
      },
      {
        "type": "p",
        "text": "[THESIS] That report is real. It is also written by the same system whose work is in question."
      },
      {
        "type": "h3",
        "text": "The missing condition."
      },
      {
        "type": "p",
        "text": "[THESIS] The missing condition is an acceptance test that was agreed before the work started and checked by something other than the thing that did the work."
      },
      {
        "type": "p",
        "text": "[THESIS] Without it, \"finished\" means \"the system believes it finished\", which is a statement about the system and not about your outcome."
      },
      {
        "type": "h3",
        "text": "Why it costs you."
      },
      {
        "type": "p",
        "text": "[THESIS] The cost shows up later and somewhere else: a wrong figure in a quote, a customer emailed twice, a record changed that nobody noticed, a staff member quietly redoing the work and never saying so."
      },
      {
        "type": "p",
        "text": "[THESIS] The expensive failures are not the loud ones, which get caught on day one. They are the quiet ones that look like success and are paid for in rework, trust and time."
      },
      {
        "type": "p",
        "text": "[UNKNOWN] We have not measured how often AI systems report completion that turns out to be wrong across the market. We do not cite a rate, and we do not need one for the argument: one quiet failure that reaches a customer is enough to justify asking."
      },
      {
        "type": "h3",
        "text": "The sharpest defensible contradiction."
      },
      {
        "type": "p",
        "text": "[THESIS] The usual way to buy this kind of software is a demo and a sales deck. The better way is an acceptance test written first. The demo shows what the vendor chose to show; the acceptance test shows whether it does what you need on your work."
      },
      {
        "type": "h2",
        "text": "Part 3. What was claimed versus what was actually tested"
      },
      {
        "type": "p",
        "text": "[THESIS] This page claims that seven questions, asked in order and scored on the kind of evidence offered, give a buyer a better view of a vendor than a demo alone."
      },
      {
        "type": "p",
        "text": "[OBSERVED] What was actually tested: nothing. No buyer was surveyed, no vendor was put through this checklist, and no purchase decision has been compared against the results of using it. The checklist was designed at a desk."
      },
      {
        "type": "p",
        "text": "[UNKNOWN] Whether these seven are the seven best for every buyer is not measured. They are our best argued selection, and the closing question on this page asks you to tell us which one is missing."
      },
      {
        "type": "p",
        "text": "[UNKNOWN] Whether scoring a vendor with this worksheet predicts a better outcome than not scoring them is not measured."
      },
      {
        "type": "p",
        "text": "[THESIS] Because nothing was tested, the correct status for this whole page is a guide and an argument, not a finding."
      },
      {
        "type": "h2",
        "text": "Part 4. The method: a worked exercise"
      },
      {
        "type": "h3",
        "text": "How to run it."
      },
      {
        "type": "ol",
        "items": [
          "[THESIS] Pick one real workflow you are thinking of handing to an AI system. Not \"our operations\". One workflow, such as matching supplier invoices to purchase orders.",
          "[THESIS] Decide the risk tier (the three tiers are defined in Part 8). The tier decides how hard you push and when you should stop using a checklist and pay for an independent assessment.",
          "[THESIS] Ask the seven questions below, in this order, in writing if you can. Written answers are harder to walk back than spoken ones.",
          "[THESIS] For each answer, note two things: the score from 0 to 3, and the evidence rung (A, B, C or D, defined below). A confident answer with no evidence is rung A, however good it sounds.",
          "[THESIS] Apply the decision rules at the bottom of the worksheet. Sign it. Keep it with the contract."
        ]
      },
      {
        "type": "h3",
        "text": "The evidence rungs (our own scale for this checklist, not a standard)."
      },
      {
        "type": "ul",
        "items": [
          "[THESIS] Rung A: the vendor said it.",
          "[THESIS] Rung B: the vendor showed you a document, screenshot or recording they made.",
          "[THESIS] Rung C: the vendor showed it working on a sample of your own work, which you chose and they had not seen.",
          "[THESIS] Rung D: someone independent of the vendor showed it, such as a reference customer you found yourself, or a paid assessor."
        ]
      },
      {
        "type": "h3",
        "text": "The seven questions, with how to read the answers."
      },
      {
        "type": "h3",
        "text": "Question 1. \"What exactly counts as finished, and who decides?\""
      },
      {
        "type": "p",
        "text": "[THESIS] This is the question the other six depend on. If \"finished\" is not defined in a form that a stranger could check, nothing after it can be tested."
      },
      {
        "type": "ul",
        "items": [
          "Good answer: [THESIS] A written definition of done for your workflow, in terms of the outcome (the right invoice is matched to the right order, with the amount within a stated tolerance) and not in terms of activity (the process ran, the job exited cleanly). It names who signs off, and it is agreed before work starts.",
          "Bad or evasive answer: [THESIS] \"It will tell you when it is done.\" \"Our customers are very happy.\" \"That depends on the use case\" with no follow-up offer to define it for yours. A tick on a dashboard offered as the definition.",
          "Why it is hard to fake: [THESIS] A real definition of done forces the vendor to commit to something that can later be shown wrong. A fake one stays vague, because vague cannot fail.",
          "Where it matters most: [THESIS] All tiers. It is the cheapest question to ask and the most expensive to skip."
        ]
      },
      {
        "type": "h3",
        "text": "Question 2. \"Show me the outcome, not the log. Who checks it, and is it anyone but the system?\""
      },
      {
        "type": "p",
        "text": "[THESIS] A system's own report of success is self-attestation. A check performed by a separate step, a human sample, or a count against a source of truth is verification."
      },
      {
        "type": "ul",
        "items": [
          "Good answer: [THESIS] A named verification step that does not rely on the agent's own report: a reconciliation against your records, a human spot check at a stated sample rate, a second system with different access. The vendor can show you the output of that check from a real run.",
          "Bad or evasive answer: [THESIS] \"The agent confirms its own work.\" \"We have logging.\" \"It has never reported an error.\" Logs prove the process ran, not that the result is right.",
          "Why it is hard to fake: [THESIS] Ask to see a check that caught something. A verification step that has never caught anything is either unneeded or not really running.",
          "Where it matters most: [THESIS] Material and high stakes, where an unverified wrong result becomes money, a customer message or a record that others rely on."
        ]
      },
      {
        "type": "h3",
        "text": "Question 3. \"What did you actually test, on what data, and when?\""
      },
      {
        "type": "p",
        "text": "[THESIS] A demo and a deployment are different things. A demo runs on prepared inputs on a good day. A deployment meets your messy, odd, out-of-date real work."
      },
      {
        "type": "ul",
        "items": [
          "Good answer: [THESIS] A specific statement: the task, the sample size, where the sample came from, the date, the software version, and what was not tested. Ideally an offer to run your own sample before you sign.",
          "Bad or evasive answer: [THESIS] \"Extensively tested.\" \"Thousands of runs\" with no description of the runs. A benchmark with no date or version. Results on the vendor's data only.",
          "Why it is hard to fake: [THESIS] Specificity is expensive. A vendor who did the testing can say what they ran and when. A vendor who did not will stay general, and will resist running your sample.",
          "Where it matters most: [THESIS] Material and high stakes, and any time your data is unusual (your own formats, your own jargon, your own edge cases)."
        ]
      },
      {
        "type": "h3",
        "text": "Question 4. \"Tell me about a time it failed. What happened, and what did you change?\""
      },
      {
        "type": "p",
        "text": "[THESIS] Every real system has failed in some way. A vendor who cannot describe a failure has either not looked, not run it long enough, or is choosing not to say."
      },
      {
        "type": "ul",
        "items": [
          "Good answer: [THESIS] A concrete, dated failure told plainly: what went wrong, how it was noticed, who was affected, what was fixed, and what check now stops it happening again. Some discomfort in the telling is a good sign.",
          "Bad or evasive answer: [THESIS] \"We haven't had any failures.\" \"Nothing material.\" A failure described only as something the customer did wrong. A story with no change made afterwards.",
          "Why it is hard to fake: [THESIS] An invented failure story tends to be tidy and to end well. A real one has loose ends and a specific fix. Ask a follow-up about the fix, and a made-up story runs out quickly.",
          "Where it matters most: [THESIS] All tiers, and especially high stakes, where how a vendor behaves after a failure is part of what you are buying."
        ]
      },
      {
        "type": "h3",
        "text": "Question 5. \"When it is wrong, what is the worst it can do, and how do I stop it?\""
      },
      {
        "type": "p",
        "text": "[THESIS] This question is about the blast radius: what the system can touch, what it can change, and whether you can undo it."
      },
      {
        "type": "ul",
        "items": [
          "Good answer: [THESIS] A plain list of what the system can read and write, a statement of the worst realistic outcome, the controls that limit it (least access, approval steps for anything irreversible, a spend or volume limit), a stop switch you control, and a way to roll back. Ideally they have rehearsed it.",
          "Bad or evasive answer: [THESIS] \"It can't go wrong.\" \"Our model is very safe.\" Broad access granted by default. No stop switch, or a stop that needs the vendor's help. Rollback described as \"restore from backup\" with no evidence it has been tried.",
          "Why it is hard to fake: [THESIS] Ask them to demonstrate the stop, on a test copy, while you watch. A control that exists only as a sentence cannot be demonstrated.",
          "Where it matters most: [THESIS] High stakes first, then material. In the low tier, with reversible and cheap actions, a lighter answer can be enough."
        ]
      },
      {
        "type": "h3",
        "text": "Question 6. \"What does one accepted result cost me, all in?\""
      },
      {
        "type": "p",
        "text": "[THESIS] The price on the quote is not the price of your outcome. The number that matters is the total cost divided by the results you actually accept."
      },
      {
        "type": "ul",
        "items": [
          "Good answer: [THESIS] The vendor works through the cost with you, including the subscription or usage fee, your own review time, the rework on results that fail, and any extra checking you will need. They accept that cost per accepted result is the fair comparison, and they are willing to measure it on a trial.",
          "Bad or evasive answer: [THESIS] Only a per-run or per-seat price. \"It pays for itself\" with no arithmetic. Savings stated as a percentage with no baseline, no date and no method.",
          "Why it is hard to fake: [THESIS] A vendor cannot honestly state your cost per accepted result without your accepted-result rate, which only a trial on your work can produce. Anyone who quotes it before the trial is guessing.",
          "Where it matters most: [THESIS] Material tier, where the money is real but the decision is still yours to make with a spreadsheet."
        ]
      },
      {
        "type": "h3",
        "text": "Question 7. \"Where should I not use this, and what do I keep if I leave?\""
      },
      {
        "type": "p",
        "text": "[THESIS] The best signal of an honest vendor is that they can tell you where their own product is the wrong answer. The second part is exit: your data, your configuration and your freedom to go."
      },
      {
        "type": "ul",
        "items": [
          "Good answer: [THESIS] A real list of poor fits, including cases where a simple rule-based automation or a person would do the job better or more safely. A clear account of what you can export on exit, in what format, how fast, and what is deleted and when.",
          "Bad or evasive answer: [THESIS] \"It works for everything.\" Nothing offered as a poor fit. Exit terms that say your data stays with them, or your workflow only runs on their platform with no export.",
          "Why it is hard to fake: [THESIS] A vendor who sells only to people they should sell to will happily name the people they should not. Pressure on this question tends to reveal whether the sale or the fit comes first.",
          "Where it matters most: [THESIS] All tiers. Poor-fit honesty matters most in low and material work, where a cheaper tool often wins. Exit rights matter most at high stakes, where you cannot afford to be stuck."
        ]
      },
      {
        "type": "h3",
        "text": "A worked example (fictional)."
      },
      {
        "type": "p",
        "text": "[EXAMPLE] This workflow is invented for illustration. It is not a TITANOS customer, it is not a case study, and no part of it happened."
      },
      {
        "type": "p",
        "text": "[EXAMPLE] A fictional distributor, Harbour Lane Supplies, is offered an AI agent to match supplier invoices to purchase orders. About 400 invoices arrive a week. Material tier: a wrong match means a wrong payment."
      },
      {
        "type": "p",
        "text": "[EXAMPLE] Question 1: the owner and the vendor agree that \"finished\" means every invoice is either matched to exactly one purchase order within a 1 percent amount tolerance, or placed in an exceptions list with a reason. \"Processed\" does not count."
      },
      {
        "type": "p",
        "text": "[EXAMPLE] Question 2: the vendor proposes that the agent's own \"all matched\" message is the check. The owner declines this and instead asks for a weekly reconciliation of matched totals against the accounting ledger, plus a human check of 20 random matches. The agent's report is rung A. The ledger reconciliation is rung C."
      },
      {
        "type": "p",
        "text": "[EXAMPLE] Question 3: the vendor's evidence is a demo on tidy sample invoices (rung B). The owner supplies 50 real invoices from last quarter, including awkward ones, and asks for a trial run before signing (rung C)."
      },
      {
        "type": "p",
        "text": "[EXAMPLE] Credible failure case: in the trial, the agent reports \"400 of 400 matched\". The ledger reconciliation shows 31 invoices matched to the wrong supplier, because two suppliers share near-identical trading names. The log shows no errors, because from the agent's point of view nothing went wrong."
      },
      {
        "type": "p",
        "text": "[EXAMPLE] This is the case the seven questions exist for. Without Question 2 the report is accepted and 31 wrong payments follow. With it, the failure is found in the trial, the vendor adds a supplier-ID check (their answer to Question 4), and the owner decides whether the fix is good enough."
      },
      {
        "type": "p",
        "text": "[EXAMPLE] Question 5: the owner asks what the agent can do. It can write to the payment queue. The owner insists it write to a holding list that a person releases, so the worst case is a bad suggestion and not a bad payment. A stop switch is demonstrated on a test copy."
      },
      {
        "type": "p",
        "text": "[EXAMPLE] Question 6, illustrative arithmetic only, with all figures invented and in Australian dollars: 1,000 runs in a month at 50 cents a run is $500. Of those, 820 results are accepted and 180 need rework at 6 minutes each, at $45 an hour of staff time: 180 x 6 minutes = 18 hours x $45 = $810. Reviewing every run for 30 seconds is 500 minutes, about 8.33 hours, which is about $375. Total about $1,685. Divided by 820 accepted results, that is about $2.05 per accepted result."
      },
      {
        "type": "p",
        "text": "[EXAMPLE] The point of that sum is the shape, not the number: the quote said 50 cents, and the cost per accepted result was about four times that. The figures are made up and predict nothing about any real vendor."
      },
      {
        "type": "p",
        "text": "[EXAMPLE] Question 7: the owner asks where the agent is a poor fit. The honest answer is the 12 invoices a week with handwritten amendments, which a person should handle. The owner also asks about exit and learns the matching rules are exportable, which is a point in the vendor's favour."
      },
      {
        "type": "h2",
        "text": "Part 5. The unique asset: the seven-question worksheet"
      },
      {
        "type": "p",
        "text": "[THESIS] Copy this out or print it."
      }
    ],
    "asset": {
      "kind": "worksheet",
      "title": "THE SEVEN-QUESTION PROOF TEST: BUYER WORKSHEET",
      "items": [
        "A guide, not an audit. It cannot detect a determined liar and it is weaker than a paid independent assessment. Free to copy and print. Not a certification of any vendor or product.",
        "Vendor / product: ______________________   Date: ____________\nWorkflow being considered (one only): ______________________________\nRisk tier (circle):   LOW      MATERIAL      HIGH STAKES\nCompleted by: ______________________   Second reviewer: ______________\n\nEVIDENCE RUNGS (record one per answer)\n  A = the vendor said it\n  B = the vendor showed a document or recording they made\n  C = shown working on a sample of MY work, chosen by me\n  D = shown by someone independent of the vendor\n\nSCORE: 0 = no answer or evasive   1 = answer, no evidence\n       2 = answer with evidence   3 = answer with evidence I could check myself",
        "Q1  What exactly counts as finished, and who decides?\n    Good: written, outcome-based, agreed before work starts, named sign-off.\n    Red flag: \"it tells you when it's done\"; a dashboard tick as the definition.\n    Their definition of done, in their words: ______________________\n    ______________________________________________________________\n    Rung: A  B  C  D     Score: 0  1  2  3     Notes: ____________",
        "Q2  Show me the outcome, not the log. Who checks it, and is it anyone\n    but the system?\n    Good: a named check the agent does not control; output of a real\n    check that caught something.\n    Red flag: \"the agent confirms its own work\"; \"we have logging\".\n    The check, who runs it, how often: _____________________________\n    ______________________________________________________________\n    Rung: A  B  C  D     Score: 0  1  2  3     Notes: ____________",
        "Q3  What did you actually test, on what data, and when?\n    Good: task, sample size, source, date, version, and what was NOT tested;\n    willing to run MY sample before I sign.\n    Red flag: \"extensively tested\"; results on their data only; no date.\n    What was tested / sample / date / version: _____________________\n    ______________________________________________________________\n    Rung: A  B  C  D     Score: 0  1  2  3     Notes: ____________",
        "Q4  Tell me about a time it failed. What happened, and what did you change?\n    Good: a dated, specific failure, a fix, and a check that now stops it.\n    Red flag: \"no failures\"; blames the customer; no change made.\n    The failure they described: ____________________________________\n    The fix and the new check: _____________________________________\n    Rung: A  B  C  D     Score: 0  1  2  3     Notes: ____________",
        "Q5  When it is wrong, what is the worst it can do, and how do I stop it?\n    Good: list of what it can read and write; limits on access, spend and\n    volume; approval step for irreversible actions; a stop I control;\n    a tested rollback; stop demonstrated while I watch.\n    Red flag: \"it can't go wrong\"; broad default access; stop needs the vendor.\n    Worst realistic outcome: _______________________________________\n    Stop switch demonstrated?  YES   NO     Rollback tried?  YES   NO\n    Rung: A  B  C  D     Score: 0  1  2  3     Notes: ____________",
        "Q6  What does one accepted result cost me, all in?\n    Good: fee + my review time + rework on failures, divided by results I\n    accept; measured in a trial on my work.\n    Red flag: per-run price only; \"pays for itself\" with no arithmetic;\n    savings percentage with no baseline, date or method.\n    Fee: ________  My review time: ________  Rework: ________\n    Accepted results: ________  Cost per accepted result: ________\n    Rung: A  B  C  D     Score: 0  1  2  3     Notes: ____________",
        "Q7  Where should I not use this, and what do I keep if I leave?\n    Good: a real list of poor fits, including where a simple tool or a\n    person is better; export of my data and settings, format and speed stated.\n    Red flag: \"works for everything\"; no poor fits; data stays with them.\n    Poor fits they named: __________________________________________\n    What I can export, how, how fast: ______________________________\n    Rung: A  B  C  D     Score: 0  1  2  3     Notes: ____________",
        "DECISION RULES (our suggestions; adjust to your own situation)\n  1. Any score of 0 on Q1, Q2 or Q5 at MATERIAL or HIGH STAKES: stop.\n     Do not proceed until the vendor answers it with evidence.\n  2. Q2 and Q3 only at rung A at MATERIAL: ask for a trial on my own\n     sample (rung C) before any commitment.\n  3. HIGH STAKES: this sheet is a first filter only. Commission a paid\n     independent assessment and take legal and insurance advice first.\n  4. A vendor who tells me not to buy (Q7) has given me information.\n     Thank them. Do not punish it.\n  5. Two vendors: compare on rung first, then score, then cost per\n     accepted result (Q6). A cheaper vendor on rung A can be dearer.\n\nTOTAL SCORE: ____ / 21      Lowest rung on Q2, Q3 or Q5: ____\nProceed to trial   /   Ask for more evidence   /   Stop   (circle one)\n\nOwner sign-off: ______________________   Date: ____________\nSecond reviewer sign-off: ______________   Date: ____________\n\nLIMITS: this worksheet is a guide, not an audit. It cannot detect a\ndetermined liar. It is weaker than a paid independent assessment. It is\nnot legal, financial or compliance advice. Black Ice is a company-run\neditorial challenge from TITANOS and is not an independent certifier."
      ]
    },
    "objection": "The objection, steelmanned.\n\n[THESIS] \"This is too much ceremony. For most business tasks, a plain scripted automation, a spreadsheet formula or a person doing the work is cheaper, easier to understand and easier to check than an autonomous AI agent. A buyer who runs seven questions on an agent has already made the mistake of choosing an agent. The right first question is whether you need one at all.\"\n\n[THESIS] The objection has more force than it first appears. A rule-based tool has a fixed, testable behaviour. A human reviewer can notice something odd that nobody specified. Complex systems add failure modes, ongoing cost and a dependency on the vendor. A checklist can also create false comfort: someone who ticks seven boxes may feel safer than they are.\n\nOur answer, and where the objection wins.\n\n[THESIS] The objection wins on its core point. If a simple automation or a human can do the job at acceptable cost and risk, that is usually the better buy, and Question 7 is built to bring that out. Where a vendor's honest answer to Question 7 is \"you do not need us\", the checklist has worked.\n\n[THESIS] The objection also wins on false comfort. That is why Part 7 and Part 8 exist, and why the worksheet records the evidence rung and not just a score.\n\n[THESIS] Where we disagree: the objection treats \"use a simple tool\" and \"run an acceptance test\" as alternatives. They are not. A simple tool also needs a definition of done and a check that someone other than the tool performs. The seven questions work on a person's process or a script as well, with small adjustments.\n\n[THESIS] There are also tasks where the work is too variable for rules and too large for a person, such as reading thousands of free-text documents. There, an AI system may be the only sensible option, and the questions are how you buy it without trusting its own report.",
    "doesNotProve": [
      "[THESIS] A vendor who scores well on this worksheet is not therefore good. A vendor who scores badly is not therefore dishonest.",
      "[THESIS] The checklist does not prove the system works. It shows what the vendor has and has not shown you.",
      "[THESIS] It cannot detect a determined liar. A vendor willing to fabricate a failure story, a reference customer or a test result can pass every question on paper. The rungs help, since rung C (your own sample) and rung D (independent) are much harder to fake than rung A, but they reduce the risk and do not remove it.",
      "[THESIS] It is not an audit, and it is weaker than a paid independent assessment. If the stakes are high, hire the assessment.",
      "[THESIS] It does not tell you whether the vendor will be around in two years, whether their security is adequate or whether the contract protects you. Those need their own checks.",
      "[UNKNOWN] It does not show that using the checklist improves outcomes. We have not tested that, and the page says so in Part 3.",
      "[THESIS] It does not show that TITANOS is better than anyone. We have not published our own answers to the seven questions. That is a gap, and Part 12 addresses it."
    ],
    "limitations": [
      "Risk tiers. [THESIS] These tier definitions are our own working definitions for this checklist, not a standard.",
      "[THESIS] Low: the action is cheap, internal and easy to reverse. A wrong result costs minutes. Examples: drafting an internal summary a person reads before use, tagging support tickets for later review. A lighter pass through the questions is reasonable, with Questions 1, 4 and 7 as the minimum.",
      "[THESIS] Material: a wrong result costs real money, reaches customers or suppliers, or changes records others rely on, but can be corrected with effort. Examples: matching invoices, drafting customer replies that are sent, updating inventory. Run all seven, and insist on rung C for Questions 2, 3 and 6.",
      "[THESIS] High stakes: a wrong result could cause harm to a person, a legal or regulatory breach, a large or irreversible financial loss, or a safety consequence. [THESIS] At this tier a seven-question checklist is a first filter only. Get a paid, independent assessment, involve your lawyers and your insurer, and keep a qualified human in the loop for the decision itself.",
      "When not to automate: [THESIS] When the task is rare, cheap and quick for a person. The setup and checking effort will exceed the saving.",
      "When not to automate: [THESIS] When you cannot define \"finished\" in terms someone else could check. Fix that first, because no vendor can do it for you.",
      "When not to automate: [THESIS] When a rule-based tool covers it. Prefer the thing you can fully understand.",
      "When not to automate: [THESIS] When the decision needs judgement, empathy or accountability that must sit with a named person, such as a decision about someone's employment, care or legal rights.",
      "When not to automate: [THESIS] When you have no one who can do the verification. An unchecked agent is not a saving, it is a deferred cost.",
      "Scope limits of this page: [THESIS] The seven questions are written for systems that do multi-step work with some autonomy. They apply less well to a simple chat assistant used for brainstorming, where \"finished\" has no real meaning.",
      "Scope limits of this page: [UNKNOWN] We have not tested the checklist on any specific industry. Regulated sectors will have requirements this page does not know about.",
      "Scope limits of this page: [THESIS] Nothing here is legal, financial or compliance advice."
    ],
    "sources": [
      {
        "label": "THESIS",
        "note": "[THESIS] An argument we make and stand behind. It would change if a better argument or a measured counter-example showed it wrong. Most of this page is THESIS, and that is the honest label for a guide."
      },
      {
        "label": "EXAMPLE",
        "note": "[THESIS] The Harbour Lane Supplies workflow, the invoice figures, the dollar arithmetic and the failure case are fictional. They would stop being labelled EXAMPLE only if a real, consented, documented case replaced them, and then they would be relabelled and dated."
      },
      {
        "label": "OBSERVED",
        "note": "[THESIS] Used on this page only to say that nothing was tested. It would apply to any future section reporting something we actually saw, with what, when and how."
      },
      {
        "label": "REPRODUCED",
        "note": "[THESIS] Not used. Would apply only to results seen repeatedly under stated conditions."
      },
      {
        "label": "UNVERIFIED",
        "note": "[THESIS] Not used. Would apply to a claim we state but have not checked."
      },
      {
        "label": "UNKNOWN",
        "note": "[THESIS] Used where we lack evidence: market-wide failure rates, whether the checklist improves outcomes, industry fit, and our own published answers. Each would change with a measurement we make or a source we can name and date."
      },
      {
        "label": "Sources",
        "note": "[THESIS] This page cites no external statistic, study, benchmark or vendor price. That is deliberate. Where a figure would have helped, we preferred to write UNKNOWN. Readers who know a good, dated, citable source for any point on this page are invited to send it; we will add it with its date and label."
      }
    ],
    "buyerReading": "1. [THESIS] Pick one workflow you are considering. Write its definition of done in two sentences. If you cannot, that is your first finding.\n2. [THESIS] Send the vendor Questions 1, 2 and 3 in writing and ask for a reply with evidence. Note the rung.\n3. [THESIS] Ask for a trial on 50 of your own real, awkward items, with you choosing the sample.\n4. [THESIS] Decide the tier before you decide the vendor.",
    "builderReading": "1. [THESIS] Answer the seven questions about your own product, in writing, in public if you can. A buyer who finds your answers before asking is a buyer who already trusts you more.\n2. [THESIS] Replace every activity-based \"done\" in your product (process ran, job exited) with an outcome-based one, and show the check.\n3. [THESIS] Write down one real failure, what you changed, and the check that now stops it. Be ready to tell it.\n4. [THESIS] Write the list of poor fits for your product. If it is empty, you have not thought hard enough.",
    "corrections": [],
    "cta": {
      "question": "Which question would you add?",
      "commercial": "[THESIS] The seven here are our best argued selection, not a proven set. If you have bought, sold or built AI systems and know a question that would have caught something these miss, we want it. [UNKNOWN] We have not yet published our own answers to these seven questions for TITANOS. If that is useful to you, you are welcome to ask us to answer them in public in the same format, and a no thanks is just as welcome. --- ---"
    },
    "relatedSlugs": [
      "demo-vs-deployment",
      "cost-per-accepted-outcome",
      "self-attestation-vs-verification",
      "verify-the-outcome",
      "ai-procurement-refusal-gates",
      "how-vendors-disclose-limitations",
      "limits-of-ai-buyer-checklists"
    ],
    "image": {
      "alt": "A person at a desk comparing a printed seven-line checklist with a laptop screen, beside a three-step diagram: define done, check the outcome, decide.",
      "caption": "Illustration only. A buyer checks a vendor's claim of completion against a written seven-question list. The diagram shows three steps: define what finished means, check the outcome independently, then decide."
    },
    "published": true
  },
  {
    "contentId": "BI-Y1-099",
    "slug": "cost-per-accepted-outcome",
    "title": "Cost per accepted outcome: the equation and worksheet",
    "description": "Cheap tokens can make expensive work. Run one equation and a free worksheet to compare AI options on accepted results, not price per call.",
    "excerpt": "Cheap tokens can make expensive work. One equation and a worksheet to compare AI options on accepted results.",
    "date": "2026-10-28",
    "audience": "operators, founders and budget owners",
    "series": "Black Ice, Year 1, Day 099, FAULT LINE",
    "rung": "THESIS",
    "review": "NOT_REVIEWED",
    "claimedVsTested": {
      "claimed": "Claimed: \"the lowest price per call is the lowest cost.\" [THESIS] That is the common shorthand, and nobody in particular is being quoted. [THESIS]",
      "tested": "Actually tested: nothing. [UNKNOWN] We ran no models, no tasks and no real workflow for this page. [UNKNOWN] The two comparisons below are fictional workflows with invented unit costs, built to teach the arithmetic. [EXAMPLE] If you want a real answer for your work, you have to run the worksheet on your own tasks. [THESIS]"
    },
    "body": [
      {
        "type": "p",
        "text": "Black Ice is a company-run editorial and technical challenge from TITANOS / Parallax Technologies. It is not an independent certifier and nothing here is a certification. [THESIS]"
      },
      {
        "type": "h2",
        "text": "Part 1. BLUF"
      },
      {
        "type": "p",
        "text": "This page gives you one equation for the cost of getting a result you actually accept, and a worksheet to run it on your own work. [THESIS] It is for operators, founders and budget owners who are comparing AI models or tools on price. [THESIS] It does not tell you which model to buy, it quotes no real vendor price, and it reports no measured saving from anyone. [THESIS]"
      },
      {
        "type": "h2",
        "text": "Part 2. The claim and the stakes"
      },
      {
        "type": "p",
        "text": "What appears true: the model with the lowest price per call is the cheapest one to run. [THESIS] It is true only for the invoice line. [THESIS]"
      },
      {
        "type": "p",
        "text": "The missing condition: you do not buy calls, you buy accepted results. [THESIS] A call that produces something a person rejects, reworks or later finds wrong still cost you money, and it produced nothing you can use. [THESIS] Retries, review time, rework and the cost of a wrong answer that got through all land on your budget, but not on the vendor's price list. [THESIS]"
      },
      {
        "type": "p",
        "text": "Why it matters: if you compare two options on price per call, you may pick the one that costs more per useful result and never see it, because the extra cost is hidden in staff time and downstream fixes. [THESIS] UNKNOWN: we have not measured how often this happens in any real business, and we are not claiming it is common. [UNKNOWN]"
      },
      {
        "type": "h2",
        "text": "Part 3. WHAT WAS CLAIMED versus WHAT WAS ACTUALLY TESTED"
      },
      {
        "type": "p",
        "text": "Claimed: \"the lowest price per call is the lowest cost.\" [THESIS] That is the common shorthand, and nobody in particular is being quoted. [THESIS]"
      },
      {
        "type": "p",
        "text": "Actually tested: nothing. [UNKNOWN] We ran no models, no tasks and no real workflow for this page. [UNKNOWN] The two comparisons below are fictional workflows with invented unit costs, built to teach the arithmetic. [EXAMPLE] If you want a real answer for your work, you have to run the worksheet on your own tasks. [THESIS]"
      },
      {
        "type": "h2",
        "text": "Part 4. The method"
      },
      {
        "type": "h3",
        "text": "The equation"
      },
      {
        "type": "ul",
        "items": [
          "CPAO = ( C_attempt + C_verify + C_human + C_downstream ) / N_accepted"
        ]
      },
      {
        "type": "p",
        "text": "Defined term by term: [THESIS]"
      },
      {
        "type": "ul",
        "items": [
          "C_attempt: every model call or tool run you paid for on this task set, including failed calls, retries and calls whose output was thrown away. Not just the ones that worked. [THESIS]",
          "C_verify: the cost of checking the output. An automatic test, a second model, or a person reading it. Verification is a cost of getting to \"accepted\", so it goes in the numerator. A method with no verification is not free, it is unchecked. [THESIS]",
          "C_human: rework time. People fixing, rewriting, escalating or redoing rejected output, priced at a stated hourly cost. [THESIS]",
          "C_downstream: the cost of results that were accepted and later turned out wrong: the fix, the refund, the apology, the second pass. This is the cost of the wrong answer that got through. [THESIS]",
          "N_accepted: the count of outcomes that met the acceptance definition you wrote down before the run. Not attempts. Not \"looked fine\". Accepted. [THESIS]"
        ]
      },
      {
        "type": "p",
        "text": "CPAO means cost per accepted outcome, in whatever currency and time window you stated. [THESIS] If you have set-up costs (prompt writing, integration), either add them as a fifth term and say so, or exclude them and say so. Never leave it unstated. [THESIS]"
      },
      {
        "type": "h3",
        "text": "Step one: write the acceptance definition BEFORE the run"
      },
      {
        "type": "p",
        "text": "Acceptance needs a written test a stranger could apply: what must be true of the output, who checks it, and what counts as a pass. [THESIS] Loosening the definition after you see results flatters the metric, because N_accepted goes up while the cost stays put. [THESIS] So the definition is dated and signed off before any task runs, and if you change it, you report both versions and say why. [THESIS]"
      },
      {
        "type": "p",
        "text": "EXAMPLE of how definition shopping works: 200 tasks, 80 pass a strict checklist. [EXAMPLE] Relax the checklist to \"reads plausibly\" and 160 pass. [EXAMPLE] The cost per accepted outcome roughly halves on paper, and nothing about the model changed. [EXAMPLE]"
      },
      {
        "type": "h3",
        "text": "Step two: choose the task set honestly"
      },
      {
        "type": "p",
        "text": "A small or hand-picked set cannot carry a general claim. [THESIS] Pick tasks by a rule you wrote down (for example, \"the last 200 tickets in date order\"), not by memory of which ones went well. [THESIS] State how many tasks, and from when to when. [THESIS] A result from 10 tasks describes those 10 tasks. [THESIS]"
      },
      {
        "type": "h3",
        "text": "Step three: record the counts, then divide"
      },
      {
        "type": "p",
        "text": "Record attempts, passes, rework minutes, wrong-after-acceptance count and every unit cost with a source label. [THESIS] Then compute. Keep the counts on the page beside the ratio, because a ratio alone hides how small the sample was. [THESIS]"
      },
      {
        "type": "h3",
        "text": "The zero-denominator case"
      },
      {
        "type": "p",
        "text": "If N_accepted is zero, CPAO is undefined, not infinite and not zero. [THESIS] Dividing by zero is not an answer, and \"infinite cost\" is a figure of speech that cannot be compared or budgeted. [THESIS] Report instead: the cost incurred, the number attempted, \"0 accepted\", and the acceptance definition that produced the zero. [THESIS]"
      },
      {
        "type": "p",
        "text": "EXAMPLE: Model A, 200 tasks, the strict checklist from the second worked example below. Suppose 0 of 200 pass. [EXAMPLE] Cost incurred is $2,400.40 (EXAMPLE figure), accepted is 0, so you write: \"$2,400.40 spent, 0 of 200 accepted under definition v1, CPAO undefined.\" [EXAMPLE] That sentence is useful: it tells the next person what was spent and what failed. [THESIS]"
      },
      {
        "type": "p",
        "text": "A near-zero denominator is the quieter trap. [THESIS] With 1 accepted result, CPAO equals the whole spend, and a single extra pass halves it. Report the count, not just the ratio. [THESIS]"
      },
      {
        "type": "h3",
        "text": "Uncertainty, in plain terms"
      },
      {
        "type": "p",
        "text": "Your pass rate from a sample is an estimate, not a fact about the model. [THESIS] EXAMPLE: 8 passes out of 10 tasks is a measured 80 percent, but a standard Wilson 95 percent interval on that sample runs from roughly 49 percent to 94 percent (EXAMPLE arithmetic). [EXAMPLE] A pass rate that wide means cost per accepted outcome could be near double, or near the figure you computed. [EXAMPLE] More tasks narrow it. Fewer tasks, or tasks you chose by hand, cannot be rescued by clever maths. [THESIS]"
      },
      {
        "type": "h3",
        "text": "Worked EXAMPLE 1: the cheap model WINS"
      },
      {
        "type": "p",
        "text": "Fictional workflow, not a real customer and not a real tool: a small team sorts 1,000 incoming support messages into one of six labels. [EXAMPLE] Acceptance definition v1, written first: the label is one of the six allowed values and passes an automatic rule check; a label the check rejects is re-routed and fixed by a person. [EXAMPLE]"
      },
      {
        "type": "p",
        "text": "Unit costs, all EXAMPLE figures and not market prices: Model A $2.00 per thousand calls. Model B $20.00 per thousand calls. Automatic check $1.00 per thousand. Fix of a rejected label $0.05 per item (a few seconds, EXAMPLE). Downstream cost of a wrong label that gets through: $0 here, because the rule check catches the failures and a mislabelled message simply gets re-routed (EXAMPLE assumption). [EXAMPLE]"
      },
      {
        "type": "ul",
        "items": [
          "EXAMPLE figures | Model A (cheap) | Model B (dearer)",
          "Attempts (1,000 calls) | $2.00 | $20.00",
          "Verification (1,000 checks) | $1.00 | $1.00",
          "Rejected first pass | 100 | 30",
          "Rework at $0.05 each | $5.00 | $1.50",
          "Downstream failures | $0.00 | $0.00",
          "Total cost | $8.00 | $22.50",
          "Accepted outcomes | 1,000 | 1,000",
          "CPAO | $0.008 | $0.0225"
        ]
      },
      {
        "type": "p",
        "text": "Result in this EXAMPLE: Model A costs about 2.8 times less per accepted outcome. [EXAMPLE] Why it wins: stakes are low, verification is automatic and cheap, and rework is nearly free, so a worse first-pass rate barely hurts. [EXAMPLE] This is the honest case for the cheap model. [THESIS] If your work looks like this, buy the cheap one and enjoy it. [THESIS]"
      },
      {
        "type": "h3",
        "text": "Worked EXAMPLE 2: the cheap model LOSES"
      },
      {
        "type": "p",
        "text": "Fictional workflow, not a real customer: 200 short summaries of contract clauses, each to be checked by a person against a checklist before anyone relies on it. [EXAMPLE] Acceptance definition v1, written first: a reviewer ticks every checklist line; any failed line rejects the summary, and rejected summaries are dropped, not reworked. [EXAMPLE]"
      },
      {
        "type": "p",
        "text": "Unit costs, all EXAMPLE figures and not market prices: Model A $2.00 per thousand calls. Model B $20.00 per thousand calls. Reviewer time $72 per hour (EXAMPLE), 10 minutes per summary, so $12.00 per review, applied to every attempt. Downstream cost of a wrong summary found after acceptance: $100 each (EXAMPLE). Pass rate: Model A 40 percent, Model B 85 percent (EXAMPLE assumptions). Wrong-after-acceptance: 4 for Model A, 1 for Model B (EXAMPLE). [EXAMPLE]"
      },
      {
        "type": "ul",
        "items": [
          "EXAMPLE figures | Model A (cheap) | Model B (dearer)",
          "Attempts (200 calls) | $0.40 | $4.00",
          "Review (200 x $12.00) | $2,400.00 | $2,400.00",
          "Accepted outcomes | 80 | 170",
          "Wrong after acceptance | 4 | 1",
          "Downstream ($100 each) | $400.00 | $100.00",
          "Total cost | $2,800.40 | $2,504.00",
          "CPAO | $35.01 | $14.73"
        ]
      },
      {
        "type": "p",
        "text": "Result in this EXAMPLE: Model A is ten times cheaper per call and about 2.4 times dearer per accepted outcome. [EXAMPLE] Why it loses: the review cost is fixed per attempt and dwarfs the call price, so every rejected attempt is mostly wasted reviewer time. [EXAMPLE] The call price was the smallest line on the sheet. [EXAMPLE]"
      },
      {
        "type": "h3",
        "text": "Worked EXAMPLE 3: the expensive model is still wrong"
      },
      {
        "type": "p",
        "text": "Cost is not quality. [THESIS] Change one EXAMPLE assumption in the table above: Model B also passes only 40 percent and also has 4 wrong after acceptance. [EXAMPLE] Then Model B totals $4.00 + $2,400.00 + $400.00 = $2,804.00 over 80 accepted, a CPAO of $35.05, a hair worse than Model A's $35.01. [EXAMPLE] The higher price bought nothing. [EXAMPLE] Pay more only when the pass rate or the failure rate actually moves in your own test. [THESIS]"
      },
      {
        "type": "h2",
        "text": "Part 5. The unique asset: the cost-per-accepted-outcome worksheet"
      },
      {
        "type": "p",
        "text": "Do not copy numbers from the worked examples into your own sheet, they are EXAMPLE figures. [THESIS]"
      }
    ],
    "asset": {
      "kind": "worksheet",
      "title": "Cost-per-accepted-outcome worksheet (blank, printable)",
      "items": [
        "COST-PER-ACCEPTED-OUTCOME WORKSHEET (BLANK, PRINTABLE)",
        "Rule zero: every number you enter must carry a source label. EXAMPLE figures from this page must not be copied into a real decision.",
        "Sheet date: ____________  Prepared by: ____________  Task type: ____________",
        "A. ACCEPTANCE DEFINITION (WRITE AND SIGN BEFORE THE RUN)",
        "1. An output is ACCEPTED only if (list the testable conditions): ______________________________________\n2. Who or what applies the test: ______________________________________\n3. A fail means (dropped / reworked / escalated): ______________________________________\n4. Audit window after acceptance (days) for \"found wrong later\": ____________\n5. Definition version: v____   Date locked: ____________\n6. Owner sign-off (name, date): ______________________________________\n7. If the definition changes after the run, report BOTH versions and the reason: ______________________________________",
        "B. TASK SET",
        "Field | Entry\nSelection rule (written, not from memory) |\nNumber of tasks |\nDate range or source |\nAnything excluded, and why |",
        "A set this small or this hand-picked supports a claim only about itself. State that on the output.",
        "C. UNIT COSTS (SOURCE LABEL: OBSERVED / EXAMPLE / UNVERIFIED / UNKNOWN)",
        "Item | Unit | Cost | Source label | Date checked\nOption 1 per call or per run |  |  |  |\nOption 2 per call or per run |  |  |  |\nVerification per item |  |  |  |\nStaff cost per hour |  |  |  |\nCost of a wrong result found later (each) |  |  |  |\nSet-up costs, if included (state yes or no) |  |  |  |",
        "D. COUNTS AND COSTS PER OPTION",
        "Line | Option 1 | Option 2\nAttempts, including retries |  |\nC_attempt (attempts x unit cost) |  |\nC_verify |  |\nRejected on first pass |  |\nRework minutes |  |\nC_human (minutes x staff cost) |  |\nAccepted outcomes (N_accepted) |  |\nFound wrong after acceptance |  |\nC_downstream (count x cost each) |  |\nTotal cost (sum of the four C terms) |  |\nCPAO = total / N_accepted |  |",
        "E. ZERO AND NEAR-ZERO CHECK",
        "- Is N_accepted = 0? If yes, write: \"Cost incurred ______, attempted ______, accepted 0, definition v____. CPAO undefined.\" Do not enter a number in the CPAO row.\n- Is N_accepted under 10? If yes, show the counts beside the ratio and mark the ratio \"small sample\".",
        "F. UNCERTAINTY AND HONESTY",
        "- Pass rate (accepted divided by attempted): Option 1 ______  Option 2 ______\n- Rough range from the sample size (state method): ______________________________________\n- CPAO at acceptance: ______   CPAO after the audit window: ______\n- Does the cheaper option win only under the loose definition? yes / no\n- Is this task low stakes, easy to check and cheap to redo? yes / no (if yes, price per call may be enough)",
        "G. DECISION AND SIGN-OFF",
        "- Decision: ______________________________________\n- What would change it: ______________________________________\n- Owner sign-off (name, date): ______________________________________",
        "---"
      ]
    },
    "objection": "The objection, put as strongly as it can be: \"Lower-cost or faster systems can genuinely win under some task and risk definitions. Your whole framing adds cost terms that, for most everyday work, are tiny. If the task is low stakes, the check is automatic and the rework is cheap, the call price is the cost, and the extra accounting is overhead that costs more than it saves. Speed matters too: a faster system lets you do more attempts per hour, and a retry that takes two seconds is not a retry that costs you anything.\" [THESIS]\n\nHonest answer: this objection partly wins. [THESIS] Worked EXAMPLE 1 is exactly that case, and in it the cheap model wins by about 2.8 times. [EXAMPLE] If your task is low stakes, easy to verify and cheap to redo, buying on price per call is a fine rule, and you should not spend a week building a cost model. [THESIS] The equation is for the decision where review time, rework or a wrong answer is dear compared with the call price. [THESIS] Where the objection does not win: it assumes the missing costs are tiny without checking, and the only way to know is to fill in the worksheet once. [THESIS] A ten-minute version of the worksheet is cheap insurance. [THESIS]\n\nOn speed: faster is a real benefit when it turns into more accepted outcomes per hour, or lets you catch failures sooner. [THESIS] Time can be added to the equation as a cost (staff waiting, queues, delays), so a fast system gets credit where it earns it. [THESIS] A fast system that returns rejected output quickly just fails quickly. [THESIS]",
    "doesNotProve": [
      "It does not prove any real model is cheaper or dearer than another. Every figure here is an EXAMPLE. [EXAMPLE]",
      "It does not prove that cheap models usually lose. Example 1 shows the opposite case, and which one you are in depends on your own tasks. [THESIS]",
      "It does not prove that this equation is complete. Some costs are hard to price (trust, reputation, stress), and the equation leaves them out unless you add them. [THESIS]",
      "It does not show a TITANOS saving, ROI or productivity gain. We have none to report, and none is implied. [UNKNOWN]",
      "It does not certify, rate or endorse any product, vendor or method. Black Ice is a company-run editorial challenge, not an independent certifier. [THESIS]",
      "It does not tell you what acceptance should mean for your work. That is your decision and your risk. [THESIS]"
    ],
    "limitations": [
      "Scope: a single task type with a stable acceptance test. Mixed workloads need one sheet per task type, because averaging a dull task with a risky one hides both. [THESIS]",
      "Risk tiers: for low-stakes, easily checked work, price per call is a reasonable proxy. For medium-stakes work, use the equation. For work where a wrong answer can hurt a person, break a law or move money, do not let cost per accepted outcome be the deciding number at all; use a human-owned review process and consult qualified people. [THESIS]",
      "When NOT to automate: when you cannot write an acceptance test, when checking costs more than doing the work by hand, or when a wrong result is expensive and slow to detect. [THESIS] A simpler tool (a template, a lookup table, a spreadsheet formula) or a person is often the better answer there. [THESIS]",
      "Dependence: pass rates depend on your prompts, your data and your reviewers. A result on one team's tasks may not transfer. [THESIS]",
      "Time: unit costs and pass rates change. Date every sheet. [THESIS]",
      "UNKNOWN: we have not measured how large the hidden terms are for any real team. [UNKNOWN]"
    ],
    "sources": [
      {
        "label": "THESIS",
        "note": "The equation, definitions, the objection and the exclusions. A documented case where the equation misprices a real decision"
      },
      {
        "label": "EXAMPLE",
        "note": "Every number: unit costs, pass rates, totals, ratios, the interval. Nothing; EXAMPLE figures never become findings. Only a tested run with its method published would create an OBSERVED figure"
      },
      {
        "label": "OBSERVED",
        "note": "None on this page. A dated, described test run on real tasks, with counts and method published"
      },
      {
        "label": "REPRODUCED",
        "note": "None on this page. The same test repeated under stated conditions"
      },
      {
        "label": "UNVERIFIED",
        "note": "None on this page. Not applicable unless a sourced claim is added"
      },
      {
        "label": "UNKNOWN",
        "note": "Whether hidden costs are large for any real team; any TITANOS saving. A measured study with the acceptance definition written first"
      },
      {
        "label": "Note",
        "note": "No external statistic, vendor price or study is cited on this page. [THESIS] The Wilson interval is a standard statistical method, and its use here is EXAMPLE arithmetic, not a cited study. [EXAMPLE]"
      }
    ],
    "buyerReading": "Monday: pick one real task your team does weekly and write down what \"accepted\" means in three lines. [THESIS] Ask any vendor or internal team for the counts behind a cost claim: how many tasks, who chose them, what counted as a pass, and what review and rework cost. [THESIS] A cost claim with no acceptance definition and no sample size is a price, not a result. [THESIS] If the task is low stakes and easy to check, do not over-think it. [THESIS]",
    "builderReading": "Monday: log every attempt, including failures and retries, with a task id. [THESIS] Log reviewer minutes per item. Add a field for \"found wrong after acceptance\". [THESIS] Freeze the acceptance test and the task-selection rule in a dated file before the next run, and report the zero case as \"undefined, plus what was spent\". [THESIS]",
    "corrections": [],
    "cta": {
      "question": "What cost is usually missing?",
      "commercial": "Which line in your own sheet would surprise you most: the review time, the rework, or the wrong answer that got through? [THESIS] If that is useful to you, TITANOS can help you set up the worksheet and the acceptance definition on your own tasks, and a no is perfectly fine. [THESIS] ---"
    },
    "relatedSlugs": [
      "pricing-per-attempt-vs-outcome",
      "retry-economics",
      "human-correction-costs",
      "downstream-failure-costs",
      "when-cheap-ai-wins",
      "cost-study-proof-burden",
      "seven-question-proof-test"
    ],
    "image": {
      "alt": "Two example cost tables side by side, labelled EXAMPLE, showing that the option with the lower price per call can have the higher cost per accepted outcome.",
      "caption": "Illustrative example only. Invented figures show a cheaper-per-call option costing more per accepted result when review time dominates."
    },
    "published": false
  },
  {
    "contentId": "BI-Y1-015",
    "slug": "self-attestation-vs-verification",
    "title": "Self-attestation vs verification: who checks the AI?",
    "description": "An AI checking its own homework is a report. Producer, verifier, owner, which self-checks are fair, and a free worksheet. Thesis, not test results.",
    "excerpt": "An AI checking its own homework is a report, not a check. Producer, verifier, owner, and a free worksheet.",
    "date": "2026-10-28",
    "audience": "curious builders, business operators and technical buyers who rely on AI agents reporting that work is done",
    "series": "Black Ice, Year 1, Day 015, FAULT LINE",
    "rung": "THESIS",
    "review": "NOT_REVIEWED",
    "claimedVsTested": {
      "claimed": "What was claimed: that self-attestation alone is weak evidence of completion for high-stakes work, and that independent observation of the required result is stronger. [THESIS]",
      "tested": "What was actually tested: nothing. [UNKNOWN] This page reports no experiment, no benchmark, no incident and no customer outcome. [THESIS] Every worked example below is fictional and labelled EXAMPLE in the text. [EXAMPLE] Until a real test supports more, treat the arguments as THESIS and the examples as EXAMPLE. [THESIS]"
    },
    "body": [
      {
        "type": "h2",
        "text": "Part 1. BLUF"
      },
      {
        "type": "p",
        "text": "This page separates three jobs that most AI workflows quietly merge: the one who does the work (producer), the one who looks at the result (verifier) and the one who accepts the consequence (owner). [THESIS] It is for builders, operators and technical buyers who want to know whether \"the agent says it finished\" is good enough for their situation. [THESIS] It does not report a test, a measurement or a customer result, and it does not claim any architecture gives unforgeable proof. [THESIS]"
      },
      {
        "type": "h2",
        "text": "Part 2. The claim and the stakes"
      },
      {
        "type": "p",
        "text": "The claim that appears true is this: if an AI agent reports that a task is complete, and it has a built-in step that confirms completion, the task is complete. [THESIS] The missing condition is that the confirming step often reads the same narration the producer wrote, so it can only agree with it. [THESIS] A check that can only agree is a report with a tick next to it. [THESIS]"
      },
      {
        "type": "p",
        "text": "The cost shows up as rework, silent errors and misplaced trust. [THESIS] If a wrong \"done\" reaches a customer, a ledger or a deployment, someone pays to find it later, and finding it later is usually dearer than finding it at the time. [THESIS] We have not measured how much dearer, and we will not guess. [UNKNOWN]"
      },
      {
        "type": "h2",
        "text": "Part 3. What was claimed versus what was actually tested"
      },
      {
        "type": "p",
        "text": "What was claimed: that self-attestation alone is weak evidence of completion for high-stakes work, and that independent observation of the required result is stronger. [THESIS]"
      },
      {
        "type": "p",
        "text": "What was actually tested: nothing. [UNKNOWN] This page reports no experiment, no benchmark, no incident and no customer outcome. [THESIS] Every worked example below is fictional and labelled EXAMPLE in the text. [EXAMPLE] Until a real test supports more, treat the arguments as THESIS and the examples as EXAMPLE. [THESIS]"
      },
      {
        "type": "h2",
        "text": "Part 4. The method: three roles and where they collapse"
      },
      {
        "type": "h3",
        "text": "Definitions, one line each."
      },
      {
        "type": "ul",
        "items": [
          "Producer: does the work and reports on it. [THESIS]",
          "Verifier: observes the required result independently of the producer's report. [THESIS]",
          "Owner: decides, accepts and carries the consequence. [THESIS]"
        ]
      },
      {
        "type": "p",
        "text": "Where real workflows collapse the roles. The common collapses are producer and verifier in one agent (\"I wrote it and I confirmed it\"), verifier and owner in one dashboard (\"the tool said green so we shipped\") and all three in one person on a busy day. [THESIS] None of these is a moral failing. [THESIS] Each one is a place where nobody is positioned to say \"this is wrong\" with evidence the producer did not write. [THESIS]"
      },
      {
        "type": "p",
        "text": "The test that separates a check from a report. Ask what the check reads. [THESIS] If it reads the producer's narration, status field, summary or log of its own intentions, it is a report. [THESIS] If it reads the world the result was supposed to change (a file, a record, a count in a system of record, an exit code from a process the producer does not control), it is closer to a check. [THESIS]"
      },
      {
        "type": "p",
        "text": "Worked exercise (fictional). A small business, fictional and invented for this page, asks an agent to reconcile supplier invoices against a ledger. [EXAMPLE] The agent reports: \"Reconciled 212 of 212 invoices. No exceptions.\" [EXAMPLE] A self-attestation check reads that line and passes it. [EXAMPLE]"
      },
      {
        "type": "p",
        "text": "A verifier instead does three things the producer's report cannot answer. [EXAMPLE] First, it counts the invoice files in the source folder from the source folder itself, not from the agent's list, and gets a number such as 219. [EXAMPLE] Second, it counts the reconciled rows in the ledger export, and gets a number such as 212. [EXAMPLE] Third, it compares the two and flags the gap of seven for the owner. [EXAMPLE] The numbers are illustrative arithmetic, not a prediction of how often a gap occurs. [EXAMPLE]"
      },
      {
        "type": "p",
        "text": "The point of the exercise is that the verifier did not need to be smarter than the producer. [THESIS] It needed to look at a different place. [THESIS]"
      },
      {
        "type": "p",
        "text": "Self-checks that ARE legitimate, and exactly why. The lazy version of this argument says all self-checking is worthless. That is wrong. [THESIS] A self-check earns its place when it meets most of these conditions: it observes external state the producer cannot cheaply fake, it was written before the work and cannot be edited by the work, its failure is loud and cannot be suppressed, and the stakes are low enough that the residual risk is acceptable. [THESIS] Here is the honest list."
      },
      {
        "type": "ol",
        "items": [
          "Exit code of a process the producer does not control. A build, test run or script either exits with a failure code or it does not. [THESIS] It is legitimate because the code is produced by the process, not by the producer's description of it. [THESIS]",
          "Existence and size of an expected artefact. Checking that a file is at the expected location and is not empty is cheap and hard to fake by narration alone. [THESIS] It is legitimate because the world either has the file or does not. [THESIS] It is weak if the producer wrote the file itself with placeholder content. [THESIS]",
          "A checksum recorded before the work. If the expected digest of an input or reference artefact was stored before the run, comparing it afterwards observes a fact. [THESIS] It is legitimate because the reference was fixed in advance. [THESIS]",
          "A schema or contract check written beforehand. Validating output shape against a contract the producer cannot edit catches a large class of plain mistakes. [THESIS] It is legitimate for structure, and says nothing about whether the content is true. [THESIS]",
          "A round-trip check. Encode then decode, export then re-import, and compare. [THESIS] It is legitimate because it tests the result against the original with arithmetic rather than opinion. [THESIS]",
          "A count against a system of record. Rows landed, messages queued, records updated, compared to a count the producer did not supply. [THESIS] It is legitimate because the second number has a different source. [THESIS]",
          "A loud halt. An assertion or timeout that stops the pipeline and cannot be caught and silenced by the same step. [THESIS] It is legitimate because the failure is visible to others by construction. [THESIS]",
          "A dry run with a diff a human can read. The producer shows exactly what it would change, and the owner looks before anything is applied. [THESIS] It is legitimate because the owner sees the proposed state, not a summary of it. [THESIS]",
          "Low-stakes, reversible work. A draft, a suggestion, a personal note. [THESIS] A producer's own tick is acceptable when being wrong is cheap to spot and cheap to undo. [THESIS]"
        ]
      },
      {
        "type": "p",
        "text": "Where self-attestation is weak. It is weak when the check reads the producer's own narration or status field. [THESIS] It is weak when the producer can modify the check or its inputs. [THESIS] It is weak when \"done\" is defined by the producer at run time. [THESIS] It is weak when the stakes are high and nobody else ever looks. [THESIS]"
      },
      {
        "type": "p",
        "text": "A second agent is not automatically independent. Adding a second agent feels like adding a verifier. It may be only a second producer. [THESIS] If both agents share the same prompt, the same model, the same input material and the same definition of \"good\", they can share the same blind spot, and agreement between them then measures similarity, not truth. [THESIS] A second agent that reads the first agent's summary inherits the first agent's framing. [THESIS]"
      },
      {
        "type": "p",
        "text": "What independence actually requires. In plain terms, a verifier is independent to the extent that it has these properties. [THESIS]"
      },
      {
        "type": "ul",
        "items": [
          "A separate source of evidence: it observes the result in the world, not the producer's account of it. [THESIS]",
          "A separate definition of done, written before the work and held where the producer cannot edit it. [THESIS]",
          "Separate instructions and, where practical, a different method (a deterministic script, a different model, or a person). [THESIS]",
          "No write access to the evidence it judges, and no shared credit for a pass. [THESIS]",
          "A real ability to fail the work, with a consequence that reaches the owner. [THESIS]",
          "Records kept somewhere the producer cannot rewrite. [THESIS]"
        ]
      },
      {
        "type": "p",
        "text": "Independence is a matter of degree, and a deterministic check of external state still cannot see a failure it was not written to look for. [THESIS]"
      },
      {
        "type": "p",
        "text": "The honest limit: no unforgeable proof. No architecture gives unforgeable proof that work was done correctly. [THESIS] Hashes and digital signatures can authenticate a record, meaning they can show that a record has not changed since a given key signed it. [THESIS] They do that only under a key custody and threat model, and that model itself has to be validated: who holds the key, who can use it, what happens if it is copied, what the signer was looking at when it signed. [THESIS] A signed receipt for a wrong result is an authentic receipt for a wrong result. [THESIS] We have not validated any key custody arrangement for this page and make no claim about one. [UNKNOWN]"
      },
      {
        "type": "h2",
        "text": "Part 5. The unique asset"
      },
      {
        "type": "p",
        "text": "The asset is the Producer / Verifier / Owner worksheet and decision checklist."
      },
      {
        "type": "p",
        "text": "Diagram spec for a designer (words only; no image exists). [THESIS]"
      },
      {
        "type": "p",
        "text": "Title: \"Who is checking?\" [THESIS]"
      },
      {
        "type": "p",
        "text": "Format: one wide editorial diagram, readable on a phone, plain background, no stock imagery, no invented test output, no logos, no screenshots of tools. [THESIS]"
      },
      {
        "type": "p",
        "text": "Layout: three horizontal lanes, top to bottom: PRODUCER, VERIFIER, OWNER. [THESIS] On the far right, a single column labelled \"The world\" containing a small stack of icons: a file, a database row, an exit code box. [THESIS]"
      },
      {
        "type": "p",
        "text": "Flows:"
      },
      {
        "type": "ul",
        "items": [
          "PRODUCER lane: a box \"Does the work\" leads to a box \"Writes a status report\". An arrow goes from the report box straight up to the OWNER lane with a dashed line and the caption \"A report, not a check.\" [THESIS]",
          "VERIFIER lane: a box \"Reads the world, not the report\" with a solid arrow to \"The world\" column, and a second solid arrow from the world column to a box \"Observed result\". [THESIS] A small padlock icon on the VERIFIER box carries the caption \"Definition of done written before the work\". [THESIS]",
          "OWNER lane: a box \"Decides and accepts\" receiving the dashed report arrow and the solid observed-result arrow. [THESIS] Beneath it, a box \"Carries the consequence\". [THESIS]"
        ]
      },
      {
        "type": "p",
        "text": "Failure callouts, three small tags with a red outline, each pointing at a collapse: \"Producer reads its own status\" (a loop arrow on the PRODUCER lane), \"Second agent, same prompt\" (two producers in the VERIFIER lane joined by a bracket labelled \"one blind spot?\"), and \"Dashboard green, nobody looked\" (a monitor icon between VERIFIER and OWNER). [THESIS]"
      },
      {
        "type": "p",
        "text": "Footer line, small: \"No architecture gives unforgeable proof. Signatures authenticate records only under a validated key custody and threat model.\" [THESIS]"
      },
      {
        "type": "p",
        "text": "Colour and access: high contrast, no meaning carried by colour alone, every box has a text label, and the alt text below describes the whole flow. [THESIS]"
      },
      {
        "type": "p",
        "text": "Examples of acceptable self-checks are the nine listed in Part 4."
      }
    ],
    "asset": {
      "kind": "checklist",
      "title": "PRODUCER / VERIFIER / OWNER WORKSHEET AND DECISION CHECKLIST",
      "items": [
        "Workflow name: ______________________  Date: ____________  Completed by: ______________________",
        "Free to copy, print and adapt. No signup. This worksheet is a thinking aid. It does not certify anything.",
        "Role | Definition | Who or what fills it here\nProducer | Does the work and reports on it |\nVerifier | Observes the required result independently of the producer's report |\nOwner | Decides, accepts and carries the consequence |",
        "Collapse check. Tick any that apply:",
        "- [ ] Producer and verifier are the same agent or person\n- [ ] Verifier and owner are the same dashboard or person\n- [ ] All three are the same person or agent\n- [ ] \"Second agent\" shares the same prompt, model or inputs as the producer",
        "1. What observable result must exist when the work is done? ______________________\n2. Where in the world can it be observed (file, record, count, exit code)? ______________________\n3. Who wrote this definition, and when? ______________________\n4. Can the producer edit this definition or its inputs? YES / NO\n5. Where is the definition stored? ______________________",
        "C. What does the check actually read? (tick one)",
        "- [ ] The producer's narration, summary or status field (a report)\n- [ ] An artefact or state in the world that the producer cannot cheaply fake (a check)\n- [ ] Both (note which one decides pass or fail) ______________________",
        "D. Is a self-check acceptable here? Answer YES or NO.",
        "1. Does the check observe external state the producer cannot cheaply fake?\n2. Was the check written before the work?\n3. Can the work edit the check or its inputs? (NO is the good answer)\n4. Is the failure loud, so the producer cannot suppress it?\n5. Is the residual risk acceptable to the owner if the check is wrong?",
        "Reading: YES to 1, 2, 4, 5 and NO to 3 means a self-check is reasonable for this tier. Anything else means add a verifier with a separate source of evidence.",
        "- [ ] Separate source of evidence\n- [ ] Separate definition of done, held where the producer cannot edit it\n- [ ] Separate instructions and, where practical, a different method\n- [ ] No write access to the evidence it judges\n- [ ] Can fail the work with a consequence that reaches the owner\n- [ ] Records kept where the producer cannot rewrite them\n- [ ] Known shared blind spots with the producer written down: ______________________",
        "- [ ] Low (reversible, cheap to spot)\n- [ ] Medium (money, customer data or published output)\n- [ ] High (hard to undo, legal or safety exposure)",
        "If High: a verifier with a separate source of evidence and a named, signing owner are needed.",
        "- [ ] We understand no check gives unforgeable proof.\n- [ ] If we rely on signatures or hashes, we have written down who holds the key, who can use it, what a copied key would allow, and how we validated that model. Link or note: ______________________",
        "Owner name: ______________________ Decision: ACCEPT / REJECT / NEEDS MORE EVIDENCE Evidence reviewed: ______________________ Residual risk I am accepting: ______________________ Signature: ______________________  Date: ____________",
        "---"
      ]
    },
    "objection": "The steelman. Self-attestation is how almost all useful software works, and it works well. [THESIS] A compiler checks its own parse, a program asserts its own invariants, a database refuses its own malformed writes, and a careful person re-reads their own email before sending. [THESIS] Demanding a separate verifier for everything adds cost, delay and more moving parts, and every added part is a new place for something to fail. [THESIS] A second verifier also needs its own verifier if you follow the logic, and the chain has no end. [THESIS] In practice, a well-designed producer with pre-written, loud, external-state checks catches most ordinary mistakes at a fraction of the price of a separate team. [THESIS] For most low-stakes work, insisting on independence is waste. [THESIS]\n\nThe honest answer. The objection wins on three points. [THESIS] First, cost: independence should scale with stakes, and for low stakes the producer's own loud check is the right answer. [THESIS] Second, the regress is real: no chain of verifiers ends in certainty, so the aim is to put the check in a place where the producer's mistakes and the verifier's mistakes are unlikely to be the same mistake, not to build a tower. [THESIS] Third, a self-check that meets the conditions in Part 4 is a real check, not a report. [THESIS]\n\nThe objection does not win where the check reads the producer's own narration, where the producer can edit the check, where \"done\" is defined at run time, or where the stakes are high and nobody else looks. [THESIS] In those cases, the objection defends a convenience, not a control. [THESIS]\n\nWe invite a counterexample: a case where a producer's own confirmation, with none of the safeguards above, still reliably protected a high-stakes outcome. [UNKNOWN] We have not seen one and have not looked systematically. [UNKNOWN]",
    "doesNotProve": [
      "It does not prove that any particular AI agent, product or workflow is unreliable. [THESIS]",
      "It does not prove that second-agent review is useless. It proves nothing about review quality, because nothing was tested. [THESIS]",
      "It does not prove that independent verification is always worth its cost. [THESIS]",
      "It does not prove that a signed record is true, only (at best) that it came from a key and has not changed. [THESIS]",
      "It does not report any measurement, error rate, saving or customer result. [UNKNOWN]",
      "It does not certify anything. Black Ice is a company-operated editorial programme, not an independent certifier. [OBSERVED: this is stated by its operator in the introduction of this document.]"
    ],
    "limitations": [
      "Scope. This page covers completion claims for AI-assisted or automated work in business settings. [THESIS] It does not cover safety-critical systems, regulated medical or financial controls, or legal compliance duties. [THESIS] Those fields have their own standards and professionals. [THESIS]",
      "Risk tiers (a thinking aid, not a standard). [THESIS]",
      "Low: reversible, cheap to spot, one person affected. A loud producer-side check is usually enough. [THESIS]",
      "Medium: money, customer data or published output affected. Use at least one check that reads external state and a human glance at a diff. [THESIS]",
      "High: hard to undo, large cost, legal or safety exposure. Use a verifier with a separate source of evidence and a named owner who signs. [THESIS]",
      "When not to automate. If you cannot define in advance what \"done\" looks like in observable terms, do not hand the task to an agent and hope the agent defines it. [THESIS] If the result cannot be observed by anyone but the producer, a person doing the work may be the better answer. [THESIS] If a simple script or a spreadsheet formula does the job and its output is easy to inspect, use that. [THESIS]"
    ],
    "sources": [
      {
        "label": "THESIS",
        "note": "used for arguments and positions. A well-designed test or a documented counterexample could confirm or overturn them. [THESIS]"
      },
      {
        "label": "EXAMPLE",
        "note": "used for the fictional invoice reconciliation and its illustrative counts. It would become OBSERVED only if a real, described run were published with what, when and how. [EXAMPLE]"
      },
      {
        "label": "OBSERVED",
        "note": "used once, for the statement about what Black Ice is. [OBSERVED: the operator states it in this document.]"
      },
      {
        "label": "UNVERIFIED",
        "note": "no sentence on this page currently needs this label. [THESIS]"
      },
      {
        "label": "UNKNOWN",
        "note": "used where we have no evidence, such as the cost of late error discovery, any key custody arrangement, and the existence of counterexamples. [UNKNOWN]"
      },
      {
        "label": "Sources",
        "note": "none cited. No statistic, study, vendor price or benchmark is used on this page. [OBSERVED: the page contains none.]"
      }
    ],
    "buyerReading": "Ask your supplier or team three questions in writing. [THESIS] Who writes the definition of done, and when? [THESIS] What does the acceptance check read: the producer's report or the result in the world? [THESIS] Who is named as the owner who accepts the consequence? [THESIS] A clear, boring answer is a good sign, and an unclear one tells you where to look next. [THESIS]",
    "builderReading": "",
    "corrections": [],
    "cta": {
      "question": "Who is the verifier in your stack?",
      "commercial": "If you have a case where a producer's own confirmation protected a high-stakes outcome, or where a second agent was independent in a way this page denies, we would like to hear the counterexample. If that is useful to you, TITANOS can talk through where your own producer, verifier and owner sit. No obligation. ---"
    },
    "relatedSlugs": [
      "verify-the-outcome",
      "second-agent-vs-independent-judge",
      "who-audits-the-auditor",
      "signed-receipt-threat-model",
      "swarm-self-attestation",
      "seven-question-proof-test"
    ],
    "image": {
      "alt": "Diagram with three horizontal lanes labelled Producer, Verifier and Owner. A dashed arrow labelled report runs from the Producer to the Owner. A solid arrow runs from the Verifier to a box called The world, and a solid arrow labelled observed result runs from there to the Owner.",
      "caption": "Who is checking? A report comes from the producer. A check reads the world. The owner decides."
    },
    "published": false
  },
];

export function getDossier(slug: string): Dossier | undefined {
  return DOSSIERS.find((d) => d.slug === slug && d.published);
}

export function publishedDossiers(): Dossier[] {
  return DOSSIERS.filter((d) => d.published);
}
