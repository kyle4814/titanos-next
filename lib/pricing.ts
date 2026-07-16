/**
 * Pricing — single source of truth.
 *
 * Every price/term on the site must import from here. Hardcoded dollar
 * figures in JSX after this commit will fail the QA grep — the test is
 * `grep -r '\$[0-9]' app/ components/` returning nothing outside this file.
 *
 * MONITOR_CONTINUATION_MODE controls what happens at the end of the 3 free
 * months bundled with the compliance pack:
 *   - "opt_in"        (DEFAULT)  — subscription does NOT start automatically.
 *                                  Reminder email a week before free_until.
 *                                  No charge unless they affirmatively subscribe.
 *                                  Maximally honest, matches the brand.
 *   - "auto_continue" (LATER)    — subscription auto-starts at free_until.
 *                                  Still one-click cancel from the portal.
 *                                  Flip here ONLY if attach rate justifies it.
 * The server (`recurring/webhook.py`) reads the same mode flag from its own
 * config — keep both in sync. Site copy below reflects DEFAULT opt_in.
 */

export const PRICING = {
  // --- free scan ---
  FREE_SCAN: 0,

  // --- recurring engines ---
  MONITOR_MONTHLY: 149,
  MONITOR_ANNUAL: 1490,
  MONITOR_CURRENCY: "AUD",

  // --- one-time pack ---
  PACK_PRICE: 5997,
  PACK_INCLUDED_MONITOR_MONTHS: 3,
  MONITOR_CONTINUATION_MODE: "opt_in" as "opt_in" | "auto_continue",

  // --- AI partnership retainers ---
  // Retainer-only model: the build happens INSIDE month 1 of the retainer,
  // months 2-3 optimise, then it continues month-to-month. No separate
  // one-time build price — one sale, recurring from day one.
  // All three tiers: 3-month minimum. Repositioned 2026-07-16.
  AI_GROWTH_PARTNER: 1500,
  AI_OPS_PARTNER: 2500,
  AI_EMBEDDED_PARTNER: 5000,
  AI_RETAINER_MIN_MONTHS: 3,
} as const;

// --- Leads & Intelligence (fourth door) ---
// One-off verified contact lists + an ongoing intelligence feed retainer.
// Delivery channel: DataForSEO pipeline + manual verification step.
// Deploy of /leads is HELD until fulfilment confirmed end-to-end.
export const LEADS = {
  STARTER:   { price: 497,  contacts: 250,  industries: 1,        turnaround: "5 business days" },
  GROWTH:    { price: 1497, contacts: 1000, industries: 3,        turnaround: "5–7 business days" },
  CAMPAIGN:  { price: 3497, contacts: 3000, industries: "custom", turnaround: "7–10 business days" },
  RETAINER:  { price: 990,  contactsPerMonth: 500, billing: "monthly" as const },
} as const;

// --- Display helpers ---
// Use these everywhere copy needs a price. Never inline a dollar sign in JSX.
//
// Why not Intl.NumberFormat? Node 20 + Termux/Android ship with truncated
// ICU data — `Intl.NumberFormat("en-AU", { currency: "AUD" })` returns
// "A$497" for 3-digit amounts but bare "$1,497" for 4-digit amounts on
// build hosts that lack full locale data. That breaks the wordmark voice
// "AU$" inconsistently across the site. Use grouped digits + literal
// "AU$" prefix to guarantee the same output everywhere.

const GROUPED = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true,
});

export function formatAUD(amount: number): string {
  return `AU$${GROUPED.format(amount)}`;
}

export function formatMonthly(amount: number): string {
  return `${formatAUD(amount)}/mo`;
}

export function formatAnnual(amount: number): string {
  return `${formatAUD(amount)}/yr`;
}

export function formatRange(low: number, high: number): string {
  return `${formatAUD(low)}–${formatAUD(high)}`;
}

// --- Common prebuilt display strings ---
// Keep these centralised so a price bump flows everywhere on next build.

export const DISPLAY = {
  FREE_SCAN_PRICE: formatAUD(PRICING.FREE_SCAN),
  MONITOR_MONTHLY: formatMonthly(PRICING.MONITOR_MONTHLY),
  MONITOR_ANNUAL: formatAnnual(PRICING.MONITOR_ANNUAL),
  PACK_PRICE: formatAUD(PRICING.PACK_PRICE),
  AI_GROWTH_PARTNER: `${formatMonthly(PRICING.AI_GROWTH_PARTNER)}`,
  AI_OPS_PARTNER: `${formatMonthly(PRICING.AI_OPS_PARTNER)}`,
  AI_EMBEDDED_PARTNER: `${formatMonthly(PRICING.AI_EMBEDDED_PARTNER)}+`,
  AI_RETAINER_MIN: `${PRICING.AI_RETAINER_MIN_MONTHS}-month minimum`,
  AI_LADDER_ENTRY: `Retainers from ${formatMonthly(PRICING.AI_GROWTH_PARTNER)} · ${PRICING.AI_RETAINER_MIN_MONTHS}-month minimum`,
  LEADS_STARTER: formatAUD(LEADS.STARTER.price),
  LEADS_GROWTH: formatAUD(LEADS.GROWTH.price),
  LEADS_CAMPAIGN: formatAUD(LEADS.CAMPAIGN.price),
  LEADS_RETAINER: formatMonthly(LEADS.RETAINER.price),
  LEADS_STARTER_FROM: `From ${formatAUD(LEADS.STARTER.price)}`,
};
