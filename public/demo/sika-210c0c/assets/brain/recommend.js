// recommend.js: "recommend one for me" at any stage of a conversation. Resolves the job so far (kind, conditions, area) against the advisor's
// best-X answer and returns the products whose own published text documents the fit. Pure helpers over the brain's public ask(); advisor.js is not touched.
// REQUEST for the advisor lane: an exported advisor.bestForJob(jobText) returning { ids, cards } would replace the ask('best ' + job) call below.
import { normalise } from './text.js';

const QTY = /\b\d+(?:\.\d+)?\s*(?:m2|m 2|sqm|square met\w+)\b(?:\s+of)?/g;
/** The job text of a question: the quantity phrases and the "how much do I need" frame removed ("adhesive for floor tiles"). */
export function jobOf(n) {
  let j = ' ' + normalise(n) + ' ';
  j = j.replace(QTY, ' ').replace(/\b(how (much|many)|what|which|whats|do i need|will i need|would i need|i need|to buy|should i (buy|get|use)|can i get|would you|could you|can you|please|best|recommend\w*|suggest\w*)\b/g, ' ');
  j = j.replace(/\b(for|of|to|on)\s+(for|of|to|on)\b/g, '$1').replace(/\s+/g, ' ').trim();
  return j.replace(/^(for|of|to|on)\s+/, '').replace(/\s+(for|of|to|on)$/, '').trim();
}
export const areaOf = (n) => { const m = /\b(\d+(?:\.\d+)?)\s*(?:m2|m 2|sqm|square met\w+)\b/.exec(normalise(n)); return m ? Number(m[1]) : null; };
export const leafOf = (cat) => String(cat || '').split('/').pop().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

/** ask: the brain's inner ask. Returns { ids, cards, answer } or null when the advisor names nothing. */
export async function recommendFor(ask, job) {
  const j = String(job || '').trim(); if (!j) return null;
  const r = await ask('best ' + j, null);
  const prods = r.cards.filter((c) => c.type === 'product' && c.product && c.status === 'PUBLISHED');
  if (!prods.length) return r.cards.length && (r.cards[0].type === 'advice' || r.cards[0].type === 'choose') ? { ids: [], names: [], cards: r.cards, answer: r, open: true } : null;
  return { ids: prods.map((c) => c.product.id), names: prods.map((c) => c.product.name), cards: r.cards.filter((c) => c.type !== 'choose'), answer: r };
}
