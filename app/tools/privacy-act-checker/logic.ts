// Pure decision logic for the Privacy Act coverage checker. No React, so a plain Node test can run it.
// Based on the small business operator test in section 6D of the Privacy Act 1988 (Cth) and the OAIC's
// published guidance. General information only, not legal advice.

export type Answer = "yes" | "no" | "unsure";
export type QuestionId = "turnover" | "health" | "trading" | "contract" | "reporting" | "related" | "other";

export type Question = {
  id: QuestionId;
  /** Yes on this question means the small business exemption does not protect you. */
  yesMeans: "covered" | "check";
  text: string;
  help: string;
};

export const QUESTIONS: Question[] = [
  {
    id: "turnover",
    yesMeans: "covered",
    text: "Was your business turnover more than AU$3 million in the last financial year (1 July to 30 June)?",
    help: "Turnover means the total income your business earned in that year. The Act tests the previous financial year, and a business can drop in or out of the exemption as its turnover moves. Over AU$3 million, the Act covers you in full.",
  },
  {
    id: "health",
    yesMeans: "covered",
    text: "Do you provide a health service, such as a GP, allied health, counselling, a gym, childcare or weight loss program, and hold health information about clients?",
    help: "Private sector health service providers are covered whatever their turnover. The definition of a health service is wide, so a yes or an unsure here matters.",
  },
  {
    id: "trading",
    yesMeans: "covered",
    text: "Do you disclose personal information to anyone else for a benefit, service or advantage, or collect it from anyone else in return for one?",
    help: "Think of selling or swapping a customer list, running a lead generation database or buying contact data. Doing it with the person's consent, or because the law requires it, is treated differently, so check the detail.",
  },
  {
    id: "contract",
    yesMeans: "covered",
    text: "Are you a contracted service provider for an Australian Government (Commonwealth) contract, handling personal information to deliver services for an agency?",
    help: "If you are, the Act applies to what you do under that contract, even if your turnover is small.",
  },
  {
    id: "reporting",
    yesMeans: "covered",
    text: "Are you a reporting entity under the Anti-Money Laundering and Counter-Terrorism Financing Act 2006, for example a remittance provider, a bullion dealer or a business newly regulated under the 2026 reforms?",
    help: "Reporting entities lose the small business exemption for their AML/CTF activities. Check AUSTRAC whether the new rules reach your profession and when.",
  },
  {
    id: "related",
    yesMeans: "check",
    text: "Is your business part of a group of related companies, or controlled by or controlling another company?",
    help: "Related bodies corporate have their own rules in the Act. Whether the group is tested together depends on the facts, so this one needs a closer look rather than a guess.",
  },
  {
    id: "other",
    yesMeans: "check",
    text: "Do you handle tax file numbers, credit reporting information, My Health Record data or Consumer Data Right data, or have you opted in to the Privacy Act?",
    help: "Special rules apply to these even where the small business exemption otherwise holds. Opting in is a formal choice a business can make through the OAIC.",
  },
];

export type Verdict = "covered" | "check" | "exempt";

export type Result = {
  verdict: Verdict;
  /** Question ids that drove the verdict. */
  reasons: QuestionId[];
};

/** answers: one entry per question, in QUESTIONS order. A missing answer counts as unsure. */
export function assess(answers: Partial<Record<QuestionId, Answer>>): Result {
  const covered: QuestionId[] = [];
  const check: QuestionId[] = [];
  for (const q of QUESTIONS) {
    const a = answers[q.id] ?? "unsure";
    if (a === "yes") (q.yesMeans === "covered" ? covered : check).push(q.id);
    else if (a === "unsure") check.push(q.id);
  }
  if (covered.length) return { verdict: "covered", reasons: covered };
  if (check.length) return { verdict: "check", reasons: check };
  return { verdict: "exempt", reasons: [] };
}
