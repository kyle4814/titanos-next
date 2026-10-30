// clause.js (T20): draft specification wording. Text only, every value taken from a data sheet; never a statement of compliance.
import { plain } from './answer.js';

export const DRAFT_LABEL = 'Draft for editing. Not approved by Sika.';
export const STANDARDS_NOTE = 'Standards are listed as the data sheet cites them. Check the current editions. These standards are not reproduced here.';

/** One clause per step: "Supply and install <product> to <substrate> in accordance with the manufacturer's data sheet <title, version and date>." */
export function supplyClause({ product, substrate, title, version, date }) {
  const ds = [title, version, date].filter(Boolean).map((x) => plain(String(x))).join(', ');
  const sub = substrate ? ` to ${plain(substrate)}` : '';
  return `Supply and install ${plain(product)}${sub} in accordance with the manufacturer's data sheet ${ds}.`;
}
/** References list from the standards a data sheet cites: [{citation, section, page}] -> lines. Duplicated citations are merged. */
export function referencesLines(standards) {
  const seen = new Map();
  for (const s of standards || []) { const c = plain(s.citation || ''); if (!c) continue; if (!seen.has(c)) seen.set(c, []); if (s.page) seen.get(c).push(s.page); }
  return [...seen.entries()].map(([c, pages]) => `${c} (cited in the data sheet${pages.length ? ', page ' + [...new Set(pages)].sort((a, b) => a - b).join(', ') : ''})`);
}
/** Guard: a clause never claims compliance. */
export const claimsCompliance = (t) => /\b(complies|compliant|conforms|conformance|meets the requirements of|in compliance with)\b/i.test(t);
