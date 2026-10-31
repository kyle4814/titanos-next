// Light quantity text helpers shared by the whole portal (kept apart from calc.js so the home bundle does not carry the dosage parser).
export const ESTIMATE_LINE = 'Estimate only, not an offer. Quantities, not prices. Confirm with the product data sheet and Sika Technical Services before ordering.';
export const DEMO_LINE = 'Built from Sika Australia\'s public data sheets on 2026-10-30. Not an official Sika document. Technical Services decides suitability.';
export const NO_RATE_TEXT = 'Rate not published, ask Technical Services';

/** Number as text: up to 2 decimals, no trailing zeros. */
export function fmt(n) { return String(Math.round(n * 100) / 100); }
/** Quantity with unit; small amounts shown in the smaller unit. */
export function fmtQty(amount, unit) {
  if (unit === 'L' && amount < 1) return fmt(amount * 1000) + ' mL';
  if (unit === 'kg' && amount < 1) return fmt(amount * 1000) + ' g';
  return fmt(amount) + ' ' + unit;
}


/** One text line for a pack option, for example "3 x 10 L (30 L)". */
export function packText(o) { return o.count + ' x ' + fmt(o.size) + ' ' + o.unit + ' (' + fmtQty(o.total, o.unit === 'mL' ? 'L' : o.unit === 'g' ? 'kg' : o.unit) + ')'; }
