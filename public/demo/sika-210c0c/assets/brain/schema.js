// schema.js: the card schema of the Sika brain (v2). Pure data, no DOM, no network, no model.
// Sibling code (actions, project memory) reads cards through this file only.
//
// FACT   { source_url, page, sentence, status, doc_type?, doc_version? }
//   status is PUBLISHED (the sentence is on a published page or data sheet), UNKNOWN (the documentation is silent:
//   sentence is '' and the card says so) or SIGNED (reserved for a rep-approved value; NO code path emits it, the
//   UI never shows that word).
// CARD   { schema, type, status, title, product, headline, lines, facts, source, chip, links, table, calc, followups, handoff }
//   type    one of CARD_TYPES
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
export const CARD_TYPES = ['product', 'rate', 'document', 'safety', 'time', 'compatibility', 'spec', 'system', 'calculation', 'comparison', 'choose', 'unknown', 'rule', 'info', 'advice'];
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
  if (c.source) out.push(c.source.sentence);
  if (c.handoff) out.push(c.handoff.reason);
  if (c.status === 'UNKNOWN' && c.chip) out.push(c.chip);
  return out.filter(Boolean).join('\n');
}

/** Final pass on every card: no passage longer than 280 characters, a clamped fact keeps the same wording as the line that shows it. */
export function finalize(c) {
  const cl = (x) => clampText(x);
  for (const f of c.facts) f.sentence = cl(f.sentence);
  if (c.source) c.source = c.facts.find((f) => f.source_url === c.source.source_url && (f.page === c.source.page)) || { ...c.source, sentence: cl(c.source.sentence) };
  c.headline = cl(c.headline); c.title = c.title; for (const l of c.lines) l.text = cl(l.text);
  if (c.table) c.table.rows = c.table.rows.map((r) => r.map(cl));
  if (c.handoff && c.handoff.reason) c.handoff.reason = cl(c.handoff.reason);
  return c;
}
