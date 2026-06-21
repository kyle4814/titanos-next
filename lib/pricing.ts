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
  // --- recurring engines ---
  MONITOR_MONTHLY: 149,
  MONITOR_ANNUAL: 1490,
  MONITOR_CURRENCY: "AUD",

  // --- one-time pack ---
  PACK_PRICE: 5997,
  PACK_INCLUDED_MONITOR_MONTHS: 3,
  MONITOR_CONTINUATION_MODE: "opt_in" as "opt_in" | "auto_continue",

  // --- AI delivery ladder ---
  // Diagnostic dropped 2026-06-21 — replaced with a free 30-min scoping call.
  // Build is the only paid AI rung; Ops Retainer is post-build only.
  AI_BUILD_FLOOR: 9997,
  AI_OPS_RETAINER_LOW: 990,
  AI_OPS_RETAINER_HIGH: 1990,
} as const;

// --- Display helpers ---
// Use these everywhere copy needs a price. Never inline a dollar sign in JSX.

const AUD_FMT = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatAUD(amount: number): string {
  // "AU$149" not "A$149" — the wordmark voice everywhere on the site.
  return AUD_FMT.format(amount).replace(/^A\$/, "AU$");
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
  MONITOR_MONTHLY: formatMonthly(PRICING.MONITOR_MONTHLY),
  MONITOR_ANNUAL: formatAnnual(PRICING.MONITOR_ANNUAL),
  PACK_PRICE: formatAUD(PRICING.PACK_PRICE),
  AI_BUILD_FLOOR: `From ${formatAUD(PRICING.AI_BUILD_FLOOR)}`,
  AI_OPS_RETAINER: `${formatRange(PRICING.AI_OPS_RETAINER_LOW, PRICING.AI_OPS_RETAINER_HIGH)}/mo`,
};
