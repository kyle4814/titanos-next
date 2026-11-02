// schema.js: the card schema of the Sika brain (v2). Pure data, no DOM, no network, no model.
// Sibling code (actions, project memory) reads cards through this file only.
//
// FACT   { source_url, page, sentence, status, doc_type?, doc_version? }
//   status is PUBLISHED (the sentence is on a published page or data sheet), UNKNOWN (the documentation is silent:
//   sentence is '' and the card says so) or SIGNED (reserved for a rep-approved value; NO code path emits it, the
//   UI never shows that word).
// CARD   { schema, type, status, title, product, headline, lines, facts, source, chip, links, table, calc, followups, handoff }
//   type    one of CARD_TYPES ('plan' is lane D: an ordered step table with the published waits, the conditions that void the plan, and card.plan, the payload
//           the tests recompute and "Add the plan to my project" saves; see cards.js planCard)
//   status  PUBLISHED | UNKNOWN | SIGNED  (UNKNOWN means: not in the published documentation; no number is shown)
//   product { id, name, url } or null
//   headline  one plain sentence (the answer itself)
//   lines   [{ label, text, fact? }]   rendered as a two column table; text may only carry numbers found in a fact sentence
//   facts   [FACT]                      every fact the card relies on
//   source  FACT | null                 the one source line shown under the card (first fact that carries a sentence)
//   chip    short label for the status (see CHIPS)
//   links   [{ label, url }]            documents or pages, opened in a new tab
//   table   { cols:[string], rows:[[string]] } | null  (comparison, system)
//   calc    { inputs:{...}, outputs:{...}, derived:true } | null  (calculation only: the outputs are recomputable from inputs and the fact)
//   followups [string]
//   handoff { question, product?, reason, missing:[string] } | null   (UNKNOWN cards)
// ANSWER { schema, query, intent, stage, cards:[CARD], followups:[string], state, ms, trace:[string] }
import { clampText } from './text.js';
export const CARD_SCHEMA = 'sika-brain-card@1';
export const ANSWER_SCHEMA = 'sika-brain-answer@1';
export const CARD_TYPES = ['product', 'rate', 'document', 'safety', 'time', 'compatibility', 'spec', 'system', 'calculation', 'comparison', 'choose', 'unknown', 'rule', 'info', 'advice', 'plan'];
export const STATUSES = ['PUBLISHED', 'UNKNOWN', 'SIGNED'];
export const CHIPS = {
  PUBLISHED: 'From the published documentation',
  DATASHEET: 'From a published data sheet',
  PAGE: 'From the published product page',
  SITE: 'From a published Sika Australia page',
  ADVICE: 'Fit documented in published text, not a ranking of quality',
  DERIVED: 'Worked out from published data',
  UNKNOWN: 'Not in the published data',
  RULE: 'Corrected rule, with its source',
};
export const NOT_KNOWN = 'I do not know this from the published documentation.';

export function fact(o) {
  return { source_url: o.source_url || '', page: o.page == null ? null : o.page, sentence: o.sentence || '', status: o.status || (o.sentence ? 'PUBLISHED' : 'UNKNOWN'), doc_type: o.doc_type || '', doc_version: o.doc_version || '' };
}
export function card(o) {
  const facts = (o.facts || []).map(fact);
  const src = o.source !== undefined ? o.source : (facts.find((f) => f.sentence) || null);
  return {
    schema: CARD_SCHEMA, type: o.type, status: o.status || (facts.some((f) => f.status === 'PUBLISHED') ? 'PUBLISHED' : 'UNKNOWN'), title: o.title || '',
    product: o.product || null, headline: o.headline || '', lines: o.lines || [], facts, source: src, chip: o.chip || '', links: o.links || [], table: o.table || null,
    calc: o.calc || null, followups: o.followups || [], handoff: o.handoff || null,
  };
}
/** Structural check used by the tests and by the loader's self-test. Returns a list of problems (empty = valid). */
export function validateCard(c) {
  const bad = [];
  if (!c || c.schema !== CARD_SCHEMA) bad.push('schema');
  if (!CARD_TYPES.includes(c.type)) bad.push('type ' + c.type);
  if (!STATUSES.includes(c.status)) bad.push('status ' + c.status);
  if (!c.chip) bad.push('chip');
  for (const f of c.facts || []) {
    if (!STATUSES.includes(f.status)) bad.push('fact status');
    if (f.status === 'PUBLISHED' && (!f.sentence || !f.source_url)) bad.push('PUBLISHED fact without sentence or url');
    if (f.status === 'SIGNED') bad.push('SIGNED is never emitted');
  }
  if (c.type !== 'choose' && c.status === 'PUBLISHED' && !c.source) bad.push('PUBLISHED card without source');
  if (c.type !== 'choose' && c.status === 'UNKNOWN' && !c.handoff) bad.push('UNKNOWN card without hand-off');
  return bad;
}
/** Plain text of a card: exactly what a visitor can read. Used by the UI fallback and by the property test. */
export function cardText(c) {
  const out = [c.title, c.headline];
  for (const l of c.lines || []) out.push(l.label + ' ' + l.text);
  if (c.table) { out.push(c.table.cols.join(' ')); for (const r of c.table.rows) out.push(r.join(' ')); }
  if (c.source && !out.some((x) => x && String(x).includes(c.source.sentence))) out.push(c.source.sentence); // the citation is not read twice when a line already quotes it
  if (c.handoff) out.push(c.handoff.reason);
  if (c.status === 'UNKNOWN' && c.chip) out.push(c.chip);
  return out.filter(Boolean).join('\n');
}

/** Final pass on every card: no passage longer than 280 characters, a clamped fact keeps the same wording as the line that shows it. */
const MIN_SENTENCE = 25;
const sameText = (x) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().toLowerCase();
export function finalize(c) {
  const cl = (x) => clampText(x);
  // one sentence, once: a line whose text the card already says (headline, an earlier line) is dropped, and a fact quoted twice is kept once
  { const sents = (t) => String(t == null ? '' : t).split(/\n|(?<=[.!?])\s+(?=[A-Z])/).map(sameText).filter((k) => k.length >= MIN_SENTENCE);
    const said = new Set([...sents(c.headline), ...(c.handoff ? sents(c.handoff.reason) : [])]), both = new Set(); // short values ("24 hours") can legitimately repeat under different labels
    c.lines = (c.lines || []).filter((l) => { const k = sameText(l.text); if (!k) return true; const lk = sameText(l.label) + '|' + k; if (both.has(lk)) return false; both.add(lk); const ss = sents(l.text); if (!ss.length) return true; if (ss.every((x) => said.has(x))) return false; ss.forEach((x) => said.add(x)); return true; });
    const fk = new Set(); c.facts = c.facts.filter((f) => { const k = [f.source_url, f.page, sameText(f.sentence)].join('|'); if (fk.has(k)) return false; fk.add(k); return true; }); }
  for (const f of c.facts) f.sentence = cl(f.sentence);
  if (c.source) c.source = c.facts.find((f) => f.source_url === c.source.source_url && (f.page === c.source.page)) || { ...c.source, sentence: cl(c.source.sentence) };
  c.headline = cl(c.headline); c.title = c.title; for (const l of c.lines) l.text = cl(l.text);
  if (c.table) c.table.rows = c.table.rows.map((r) => r.map(cl));
  if (c.handoff && c.handoff.reason) c.handoff.reason = cl(c.handoff.reason);
  return c;
}

/** One sentence, once per answer: a product card whose one-line description is word for word the description an earlier card of the same answer already showed
 *  (different products can share a tagline) keeps its title and its own lines, but not the repeat; the same goes for a line of a later product card that repeats an earlier one. Nothing else is removed here: the first card is never touched. */
export function dedupeAcrossCards(cards) {
  const said = new Set();
  cards.forEach((c, i) => {
    const k = sameText(c.headline);
    if (i > 0 && c.type === 'product' && k.length >= MIN_SENTENCE && said.has(k)) c.headline = '';
    if (k.length >= MIN_SENTENCE) said.add(k);
    if (i > 0 && c.type === 'product') c.lines = (c.lines || []).filter((l) => { const t = sameText(l.text); return !(t.length >= MIN_SENTENCE && said.has(t)); }); // two products can share the same reason line
    for (const l of c.lines || []) { const t = sameText(l.text); if (t.length >= MIN_SENTENCE) said.add(t); }
  });
  return cards;
}
