/**
 * Blog content — single source of truth.
 *
 * Deliberately data-driven instead of MDX: this repo is a static export
 * (output:'export', see next.config.ts) with zero markdown tooling
 * installed, and every other page on the site is inline-styled JSX
 * reading design tokens from globals.css. Adding @next/mdx would be a
 * second content pipeline living next to this one. A typed content-block
 * array renders through the exact same component set (PageHero,
 * SectionReveal, tokens) with no new dependency and no parser to trust.
 *
 * To add a post: append to POSTS. Slugs are permanent — Google indexes
 * them, don't rename after publishing (redirect if you must).
 */

export type ContentBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string; attribution?: string }
  | { type: "cta"; text: string; label: string; href: string }
  | { type: "p-link"; before: string; linkText: string; href: string; after?: string };

export type BlogPost = {
  slug: string;
  title: string;
  /** SEO meta description — keep under 155 chars. */
  description: string;
  /** One-line hook shown on the index card. */
  excerpt: string;
  date: string; // ISO — YYYY-MM-DD
  updated?: string;
  tag: string;
  readMinutes: number;
  body: ContentBlock[];
  relatedSlugs?: string[];
};

export const POSTS: BlogPost[] = [
  {
    slug: "dead-quotes-hidden-revenue",
    title: "The dead-quote problem: how much revenue is sitting in your \"maybe\" pile",
    description:
      "Most trade businesses have a few hundred quotes that never got a yes or a no. Here's how to work out what they're actually worth.",
    excerpt:
      "You didn't lose these jobs. Nobody said no. They just went quiet — and quiet isn't the same as gone.",
    date: "2026-08-04",
    tag: "Revenue",
    readMinutes: 5,
    body: [
      {
        type: "p",
        text: "If you run quotes through any job-management system — ServiceM8, Tradify, simPRO, or just a spreadsheet — you've got a pile of jobs sitting in a status that isn't \"won\" and isn't \"lost\" either. They're just there. Quoted, sent, and never followed up because you got busy and the next job came in.",
      },
      {
        type: "p",
        text: "That pile is usually bigger than people expect, and it's rarely worth zero. Some of those jobs are genuinely dead — the client went with someone else, or the work isn't happening. But a meaningful share are just waiting on a follow-up that never happened, because chasing quotes competes with actually doing the work, and the work always wins.",
      },
      { type: "h2", text: "Why \"went quiet\" isn't the same as \"said no\"" },
      {
        type: "p",
        text: "A client who explicitly declines tells you something. A client who never replies tells you nothing — and most people who ask for a quote and then go silent aren't rejecting you, they're just slow, distracted, comparing options, or waiting for their own funding to line up. Treating silence as a no means you're leaving a call or a follow-up email on the table for every one of those jobs.",
      },
      { type: "h2", text: "A rough way to size the pile yourself" },
      {
        type: "ol",
        items: [
          "Pull every quote from the last 6-12 months that's still sitting at \"quoted\" status — not won, not marked unsuccessful.",
          "Drop anything you already know is genuinely dead (job cancelled, client told you no, scope changed).",
          "Add up what's left. That number is your dead-quote pile.",
          "Multiply by your historical quote-to-win rate for jobs you do follow up on. That's a rough floor on what re-chasing is worth.",
        ],
      },
      {
        type: "p",
        text: "That last step matters — the honest answer for some businesses is \"not much,\" and that's a useful answer too. It tells you the gap isn't in old quotes, it's somewhere else in the pipeline.",
      },
      { type: "h2", text: "Where this gets harder than a spreadsheet formula" },
      {
        type: "p-link",
        before:
          "Different job-management platforms model \"quoted but not converted\" differently, and the field that looks like a decision date isn't always one. There's a field-by-field breakdown of what ServiceM8, Tradify and simPRO exports actually contain in the ",
        linkText: "companion post on trade-software exports",
        href: "/blog/trade-software-quote-exports",
        after: " if you want to do this analysis yourself. If you'd rather someone just do it: that's the free audit offer below — send the export, get the number, no obligation either way.",
      },
      {
        type: "cta",
        text: "I'll go through your old quotes for free and tell you how many are still worth chasing.",
        label: "SEE WHAT I NEED FROM YOU →",
        href: "/your-data",
      },
    ],
    relatedSlugs: ["trade-software-quote-exports", "ai-audit-what-we-actually-find"],
  },
  {
    slug: "trade-software-quote-exports",
    title: "ServiceM8 vs Tradify vs simPRO: what your job data can (and can't) tell you",
    description:
      "A field-by-field look at how ServiceM8, Tradify and simPRO record quote status, and what to check before trusting any export for follow-up decisions.",
    excerpt:
      "Every platform records \"quoted but nothing happened\" differently. Knowing which field to trust matters more than which platform you're on.",
    date: "2026-08-15",
    tag: "Trade software",
    readMinutes: 6,
    body: [
      {
        type: "p",
        text: "If you're trying to work out which of your old quotes are still worth a follow-up call, the honest first step isn't analysis — it's checking whether your export actually says what you think it says. Every job-management platform models \"still open\" differently, and the wrong assumption here means chasing jobs that were already lost, or ignoring ones that weren't.",
      },
      { type: "h2", text: "ServiceM8" },
      {
        type: "p",
        text: "ServiceM8 uses four job statuses: Quote, Work Order, Completed, Unsuccessful. There's no separate \"declined\" reason code — a quote that gets accepted moves to Work Order, one that gets rejected (or the job is cancelled) moves to Unsuccessful. A quote still worth chasing is one still sitting at status Quote, with a quote_sent date already in the past and no work_order_date or unsuccessful_date to show it ever moved. That combination — sent, and nothing since — is the signal, not the raw quote count.",
      },
      {
        type: "p",
        text: "Amount fields aren't always on the job record itself in every export style; some exports carry totals on a linked invoice/materials object instead of the job row. Worth checking on one real export from your own account before assuming a column means what it looks like it means.",
      },
      { type: "h2", text: "Tradify and simPRO" },
      {
        type: "p",
        text: "Both platforms give you an explicit quote status field (accepted / declined / sent, or similar), which is more direct than ServiceM8's job-status model — but the same rule applies: a quote that's \"sent\" with no accepted or declined outcome, and no activity since the send date, is your candidate list. Anything with an explicit decline should come out before you do anything else, whichever platform you're on.",
      },
      { type: "h2", text: "The mistake that skews the numbers" },
      {
        type: "p",
        text: "The most common error isn't a wrong platform assumption, it's date confusion — using \"job created\" instead of \"quote sent\" as the reference point, or mixing GST-inclusive and exclusive totals when adding up value. Both of those will make a dead-quote audit look bigger or smaller than it actually is. If a number surprises you, check the date field and the tax treatment before the conclusion.",
      },
      {
        type: "p",
        text: "This is exactly the kind of thing that's faster to hand off than to untangle yourself, especially across a full year of exports.",
      },
      {
        type: "cta",
        text: "Export however your system does it, send it over, and I'll do the field-mapping myself.",
        label: "WHAT HAPPENS TO YOUR DATA →",
        href: "/your-data",
      },
    ],
    relatedSlugs: ["dead-quotes-hidden-revenue", "ai-audit-what-we-actually-find"],
  },
  {
    slug: "privacy-act-small-business-deadline",
    title: "Australia's Privacy Act changes: what small businesses actually need to do before 10 December 2026",
    description:
      "The Privacy Act reforms remove the small-business exemption for some obligations. Here's what actually changes for AU small businesses, in plain English.",
    excerpt:
      "\"We're too small for privacy law\" stops being reliably true this year. Here's what changes and what doesn't.",
    date: "2026-07-22",
    tag: "Compliance",
    readMinutes: 6,
    body: [
      {
        type: "p",
        text: "Most small businesses have operated for years under the assumption that the Privacy Act doesn't really apply to them — the small-business exemption (annual turnover under $3 million) has covered a lot of ground since 2001. The 2026 reforms narrow that safety margin, and the deadline that matters for anyone touching customer data is 10 December 2026.",
      },
      { type: "h2", text: "What's actually changing" },
      {
        type: "p",
        text: "The exemption itself isn't gone outright, but new obligations — around notifiable data breaches, transparency about automated decision-making, and stronger consent standards — increasingly apply regardless of business size when certain triggers are met (health information, data trading, certain contracted government work, and businesses using automated tools to make decisions about people). If any of those apply to you, the size exemption stops being a reliable shield.",
      },
      { type: "h2", text: "Who this actually catches" },
      {
        type: "ul",
        items: [
          "Anyone using AI tools that make or influence decisions about customers (credit, eligibility, pricing, risk scoring).",
          "Anyone handling health, biometric, or other sensitive information, regardless of turnover.",
          "Businesses that received a third party's customer data as part of a partnership, referral, or acquisition.",
          "Any business that's had — or could plausibly have — a data breach involving personal information.",
        ],
      },
      { type: "h2", text: "What it doesn't mean" },
      {
        type: "p",
        text: "It doesn't mean every small business needs a compliance officer or a six-figure legal review. For most operators the real gap is smaller and more practical: knowing what personal data you actually hold, where it lives, who can access it, and having an honest answer ready if someone asks what happens to their information. That's a few days of work done properly, not a program.",
      },
      { type: "h2", text: "A useful gut check" },
      {
        type: "p",
        text: "If you can't currently answer \"what personal data do we hold, where does it live, and who can see it\" in under two minutes without checking with someone else, that's the gap worth closing first — before the deadline, not after someone asks the question for you.",
      },
      {
        type: "cta",
        text: "Fixed-price Privacy Act compliance for AU small business, scoped to what actually applies to you.",
        label: "SEE THE COMPLIANCE PACK →",
        href: "/compliance",
      },
    ],
    relatedSlugs: ["free-scan-legitimacy-check", "ai-audit-what-we-actually-find"],
  },
  {
    slug: "ai-audit-what-we-actually-find",
    title: "What an AI audit actually finds in a trades or small-service business (real patterns, not hype)",
    description:
      "The recurring manual-work patterns a free AI audit surfaces in trades and small-service businesses — and which ones are actually worth automating.",
    excerpt:
      "The task worth automating is rarely the flashy one. It's the boring five-minutes-a-day task nobody's counted.",
    date: "2026-07-29",
    tag: "AI implementation",
    readMinutes: 5,
    body: [
      {
        type: "p",
        text: "\"AI audit\" gets used to mean a lot of things, so here's what it actually is on a 45-minute call: going through how the business actually runs day-to-day and finding the one manual task that's eating real hours, not the task that sounds most impressive to automate.",
      },
      { type: "h2", text: "The patterns that come up most" },
      {
        type: "ul",
        items: [
          "Quotes and enquiries tracked in someone's head or a notebook, with no reliable way to see what's still open.",
          "The same information typed into two or three systems by hand because they don't talk to each other.",
          "Follow-ups that depend entirely on one person remembering to do them.",
          "Customer questions answered the same way, by text or phone, dozens of times a week.",
          "Job status updates that exist somewhere but nobody looks at until something goes wrong.",
        ],
      },
      { type: "h2", text: "What's usually NOT worth automating" },
      {
        type: "p",
        text: "Anything that happens rarely, anything where the judgment call matters more than the data entry, and anything you're already using a decent tool for. A lot of what gets sold as automation just books appointments or shuffles data between two tools you already pay for — that's not a real gap, and the honest answer on a call is to say so.",
      },
      { type: "h2", text: "Why the free-audit-first model" },
      {
        type: "p",
        text: "Because the alternative — quoting a project before anyone's looked at what's actually manual in your business — is a guess dressed up as a number. The audit call exists so the quote that follows it is based on a real task, not a template.",
      },
      {
        type: "cta",
        text: "One hour of your time in month one: one call to find the task, one to check I built the right thing.",
        label: "BOOK A FREE AI AUDIT CALL →",
        href: "/audit#book",
      },
    ],
    relatedSlugs: ["dead-quotes-hidden-revenue", "outreach-that-actually-works"],
  },
  {
    slug: "outreach-that-actually-works",
    title: "Why \"book a call\" gets ignored and \"send me a spreadsheet\" doesn't",
    description:
      "A note on why smaller, more specific asks get better replies than generic call-booking outreach — and what that means for how offers should be built.",
    excerpt:
      "Asking a stranger for 20 minutes is a big ask. Asking them to export something they already have costs them nothing.",
    date: "2026-08-10",
    tag: "Notes",
    readMinutes: 4,
    body: [
      {
        type: "p",
        text: "Most cold outreach — call, email, doesn't matter — asks for the same thing first: book a call, get on a demo, see the pitch. That's a reasonable ask from someone who already knows and trusts you. It's a big ask from a stranger, and most strangers correctly decline it.",
      },
      { type: "h2", text: "The smaller ask" },
      {
        type: "p",
        text: "\"Send me a spreadsheet you already have\" costs the other person almost nothing — no time carved out, no commitment, no sales conversation to sit through. It also does something \"book a call\" doesn't: it self-selects. Someone who exports their quotes and sends them over has told you, without a word of copy, that they actually have the problem you solve. A call booking tells you someone's curious. A data export tells you someone's ready.",
      },
      { type: "h2", text: "It also produces the number you'd otherwise be guessing at" },
      {
        type: "p",
        text: "The free work — actually going through the export — hands back a real figure specific to that business, instead of a generic pitch about what automation could theoretically be worth. Quoting against a real number a client can check against their own data is a different conversation than quoting against an assumption.",
      },
      { type: "h2", text: "Where this doesn't apply" },
      {
        type: "p",
        text: "Not every offer reduces to a spreadsheet. This works because the free-audit model produces something concrete and checkable. If the free step is vague — \"let's chat about your goals\" — it's really just a call booking with extra steps, and it inherits the same problem it was meant to solve.",
      },
      {
        type: "cta",
        text: "This is the exact model behind the free quote audit — see what it actually asks for.",
        label: "READ THE DEAD-QUOTE POST →",
        href: "/blog/dead-quotes-hidden-revenue",
      },
    ],
    relatedSlugs: ["dead-quotes-hidden-revenue", "ai-audit-what-we-actually-find"],
  },
  {
    slug: "free-scan-legitimacy-check",
    title: "How to tell if a \"free scan\" offer is legitimate (and how to verify mine in five minutes)",
    description:
      "Free security scans are an easy vehicle for a scam. Here's how to check whether one is legitimate before handing anything over — including this one.",
    excerpt:
      "A free scan that asks for payment details before showing results isn't a free scan. Here's what a legitimate one looks like.",
    date: "2026-08-18",
    tag: "Trust",
    readMinutes: 4,
    body: [
      {
        type: "p",
        text: "\"Free scan\" is a phrase scammers use too, which makes it a reasonable thing to be suspicious of — including from us. If someone offers to scan your business for free, here's what to check before you give them anything.",
      },
      { type: "h2", text: "What a legitimate free scan should never ask for" },
      {
        type: "ul",
        items: [
          "Payment details or a card number before showing you any result.",
          "Login credentials to your own systems — a real external scan only needs your public domain, nothing you'd log into.",
          "Pressure to act immediately on a finding without being able to verify it yourself.",
        ],
      },
      { type: "h2", text: "What you can check about us specifically" },
      {
        type: "ul",
        items: [
          "ABN 34 318 502 254 — verifiable directly on the Australian Business Register, not just quoted on the site.",
          "The methodology page lists exactly what the scan checks and how to reproduce any finding yourself.",
          "We publish our own self-scan results in full, on the same page real client scans run from.",
          "Email from kyle@titanos.tech carries verified DKIM, SPF and DMARC — checkable in any email client's message headers.",
        ],
      },
      { type: "h2", text: "The general rule, beyond us" },
      {
        type: "p",
        text: "A legitimate free offer can tell you, in plain language, exactly what it checks, exactly what it does with the result, and exactly how you'd verify the operator is who they say they are — before you've committed to anything. If any of those three answers is vague or missing, that's the signal to walk away, regardless of who's making the offer.",
      },
      {
        type: "cta",
        text: "See exactly what our scan checks, and every finding from scanning ourselves.",
        label: "READ THE METHODOLOGY →",
        href: "/methodology",
      },
    ],
    relatedSlugs: ["privacy-act-small-business-deadline", "ai-audit-what-we-actually-find"],
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function getAllTags(): string[] {
  return Array.from(new Set(POSTS.map((p) => p.tag))).sort();
}

export function getRelatedPosts(post: BlogPost): BlogPost[] {
  if (!post.relatedSlugs?.length) return [];
  return post.relatedSlugs
    .map((s) => getPostBySlug(s))
    .filter((p): p is BlogPost => !!p);
}

export function postsSortedByDate(): BlogPost[] {
  return [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
}
