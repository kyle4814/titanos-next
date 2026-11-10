// f413: copy for /adm-sprint, the ADM transparency sprint offer (Privacy Act APP 1.7 to 1.9).
// Every figure comes from committed research in the kernel repo and carries its source below.
// Static data only: no form, no tracking, no email capture, no popup. Tests: scripts/test_adm_offer.mjs.

export const ADM_ROUTE = "/adm-sprint";
export const ADM_COMMENCEMENT = "10 December 2026";

export type AdmSource = { id: string; label: string; ref: string };

// ref = path inside the kernel repo plus the commit that holds it (EV6: which system, what date).
export const ADM_SOURCES: AdmSource[] = [
  { id: "xray", label: "TITANOS ADM X-ray, a passive read of public privacy policies on 2026-11-10 (observed wording gaps only, not a finding about anyone's practice)", ref: "state/research/adm_xray/SUMMARY.md @ b85f81d535" },
  { id: "offer", label: "TITANOS offer research, 2026-11-10: first deal shape and the Option A and Option B terms", ref: "state/research/ENTERPRISE_TARGETS_EXPLOSION_2026-11-10.md @ c45d757b49" },
  { id: "law", label: "Privacy and Other Legislation Amendment Act 2024: APP 1.7 to 1.9 commence 10 December 2026 (secondary law-firm summaries, consistent across several firms)", ref: "state/research/ENTERPRISE_TARGETS_EXPLOSION_2026-11-10.md @ c45d757b49" },
];

export type AdmFact = { big: string; text: string; source: string };
export const ADM_FACTS: AdmFact[] = [
  { big: "141 of 184", text: "readable privacy policies we read had no wording about automated decisions (77%). 81 of the 265 organisations could not be read and are left out of that figure.", source: "xray" },
  { big: "10 December 2026", text: "is the date the new transparency rules in APP 1.7 to 1.9 start.", source: "law" },
];

export const ADM_TITLE = "ADM Transparency Sprint | Privacy Act APP 1.7 to 1.9 | TITANOS";
export const ADM_DESC = "A fixed-fee sprint to get your automated-decision disclosure written and ready before 10 December 2026. Public records only, nothing touched, nobody replaced.";

export const ADM_HEADLINE = "Get your automated-decision disclosure written before 10 December 2026";
export const ADM_INTRO = "From 10 December 2026 the Privacy Act asks organisations that use software to make or help make decisions about people to say so in their privacy policy. This page explains the sprint we offer to get that done, what it costs, and how we work. Nothing here asks you to do anything today.";

export type AdmConcern = { id: string; q: string; a: string };
// The front-loaded concerns block (CT2). Order is the order a careful reader asks.
export const ADM_CONCERNS: AdmConcern[] = [
  { id: "who", q: "Who are we?", a: "TITANOS is an Australian business run by Kyle Deligny. You can read how we build and what we have published at titanos.tech/engineering." },
  { id: "found", q: "How did we find you?", a: "From the public list of organisations that are likely to use software in decisions about people: insurers, lenders, recruiters, telcos, energy retailers and similar. Your privacy policy is a public web page, and that is where we looked." },
  { id: "public", q: "What did we use?", a: "Public records only. We read your published privacy policy and compared it with APP 1.7 to 1.9. We did not log in anywhere, fill in a form or send a request to your systems." },
  { id: "touched", q: "Did we touch anything of yours?", a: "No. The sprint is read-only. We work from your public page and from what your team tells us, and we do not connect to your systems." },
  { id: "replaced", q: "Will anyone be replaced?", a: "No. Your privacy, legal and IT people stay in charge and sign off every word. We do the drafting and the legwork so their time goes back to them." },
  { id: "tactics", q: "Is this a sales tactic?", a: "No tactics. We say plainly what we found and what we would do, and a no is welcome." },
  { id: "cost", q: "What does it cost?", a: "Option A is a fixed fee of AU$25,000 for the sprint. Option B applies to the savings platform only and costs AU$0 up front. Both are set out below." },
  { id: "law", q: "Is this legal advice?", a: "No. We prepare the disclosure and the working papers. Your own lawyer decides what your organisation publishes." },
];

export type AdmSprintStep = { n: number; title: string; text: string };
export const ADM_SPRINT_STEPS: AdmSprintStep[] = [
  { n: 1, title: "Read", text: "We read your public privacy policy against APP 1.7 to 1.9 and hand you the gap list." },
  { n: 2, title: "Inventory", text: "We list, with your team, the places software makes or helps make decisions that significantly affect people." },
  { n: 3, title: "Draft", text: "We write the policy wording, in plain English, for your lawyer to review." },
  { n: 4, title: "Assurance Pack", text: "You receive the 12-item Privacy and Security Assurance Pack as the working record." },
  { n: 5, title: "Hand over", text: "The sprint runs for 10 business days. If it is not finished by 10 December 2026, we keep working at no charge until it is." },
];
export const ADM_BONUSES = [
  "The 12-item Privacy and Security Assurance Pack",
  "A check for lookalike domains and email DMARC records, using public DNS only",
  "90 days of policy monitoring after hand over",
];

export type AdmOption = { id: "A" | "B"; name: string; price: string; lines: string[] };
export const ADM_OPTIONS: AdmOption[] = [
  {
    id: "A",
    name: "Option A, fixed fee",
    price: "AU$25,000",
    lines: [
      "ADM Transparency Sprint: AU$25,000, fixed.",
      "Platform: AU$100,000 a year, fixed.",
      "The ADM sprint is Option A only, because compliance work saves no dollars to split.",
    ],
  },
  {
    id: "B",
    name: "Option B, performance share, 70/30",
    price: "AU$0 up front",
    lines: [
      "Platform only: AU$0 up front. You keep 70% and TITANOS takes 30% of measured savings and recovered profit, for 12 months per finding.",
      "What counts: duplicate billing, missing credits, invoice mismatches and margin leakage found by the read-only platform.",
      "Rules: the baseline and measurement method are signed before we start. Only realised dollars count (a credit received, an invoice reversed, a contract repriced), never a suspected one. You approve each finding. You get a monthly statement with evidence links, and your own records are the source of truth.",
    ],
  },
];
export const ADM_WORKED_EXAMPLE = "Worked example (MODELLED, illustrative, not a promise): AU$50M annual supplier spend with 1% recovered leakage is AU$500,000. At 70/30, AU$350,000 stays with you and AU$150,000 goes to TITANOS, with no up-front cost.";

export const ADM_CLOSE_LEAD = "If you like what you have read, and you are happy with how we work, would it be okay if we sent you the gap list for your own privacy policy? It is free, you can say no, and you can take the time you need to talk it over with your team.";
export const ADM_CLOSE_NOTE = "We can also start with Option A or Option B, or come back to you at a time that suits.";
export const ADM_CTA_LABEL = "Yes, send me the gap list";

// Everything a reader sees, for the lint and the tests.
export function admAllCopy(): string[] {
  return [
    ADM_TITLE, ADM_DESC, ADM_HEADLINE, ADM_INTRO,
    ...ADM_FACTS.flatMap((f) => [f.big, f.text]),
    ...ADM_SOURCES.map((s) => s.label),
    ...ADM_CONCERNS.flatMap((c) => [c.q, c.a]),
    ...ADM_SPRINT_STEPS.flatMap((s) => [s.title, s.text]),
    ...ADM_BONUSES,
    ...ADM_OPTIONS.flatMap((o) => [o.name, o.price, ...o.lines]),
    ADM_WORKED_EXAMPLE, ADM_CLOSE_LEAD, ADM_CLOSE_NOTE, ADM_CTA_LABEL,
  ];
}
