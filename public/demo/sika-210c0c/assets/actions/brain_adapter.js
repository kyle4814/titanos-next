// Actions v2, adapter to the brain card schema (sika-brain-card@1, written by the apply/brain builder in assets/brain/schema.js).
// Kept separate on purpose: the brain's files are not imported, so this branch works with or without the brain merged.
//   observeBrainAnswer(session, answer): remember the product and the job facets a brain answer carried, so "now make that a project pack" works after it.
//   toBrainCard(card): an action card in the brain's card shape, for a brain-style renderer; validateBrainCard() mirrors the brain's structural check.
import { plain } from './core.js';

export const CARD_SCHEMA = 'sika-brain-card@1';
const TYPE = { calc: 'calculation', system: 'system', compare: 'comparison', compat: 'compatibility', safety: 'safety', time: 'time', spec: 'spec', pack: 'document', link: 'document', export: 'document', handoff: 'unknown', help: 'choose', memory: 'rule' };
const CALC_KEYS = { area_m2: 'area', length_m: 'length', volume_m3: 'volume', thickness_mm: 'thickness', coats: 'coats', notch_mm: 'notch', waste_pct: 'allowance', csp: 'csp', dilution: 'dilution' };

export function observeBrainAnswer(session, answer) {
  if (!answer || !Array.isArray(answer.cards)) return session;
  for (const c of answer.cards) {
    if (c.product && c.product.id) { session.product = { id: c.product.id, name: plain(c.product.name) }; session.products = [session.product, ...(session.products || []).filter((x) => x.id !== c.product.id)].slice(0, 12); }
    if (c.calc && c.calc.inputs) for (const [k, v] of Object.entries(c.calc.inputs)) if (CALC_KEYS[k] && v != null) session.facets[CALC_KEYS[k]] = v;
  }
  const f = answer.state && answer.state.facets;
  if (f && typeof f === 'object') { for (const k of ['tile', 'substrate']) if (Array.isArray(f[k]) && f[k][0]) session.facets[k] = String(f[k][0]); }
  if (answer.query) session.lastQuestion = answer.query;
  return session;
}

const chipFor = (url) => (/\.pdf/i.test(url || '') ? 'From a published data sheet' : url ? 'From the published product page' : 'Not in the published documentation');
export function toBrainCard(c) {
  const cells = [...(c.rows || []), ...((c.sections || []).flatMap((s) => s.rows || [])), ...((c.table && c.table.rows) || []).flatMap((r) => r.cells)];
  const facts = cells.filter((x) => x.source && x.source.url && x.source.sentence).map((x) => ({ source_url: x.source.url, page: null, sentence: x.source.sentence, status: 'PUBLISHED', doc_type: /\.pdf/i.test(x.source.url) ? 'PDS' : 'WEB', doc_version: '' }));
  const status = c.status === 'unknown' ? 'UNKNOWN' : facts.length || c.kind === 'handoff' ? 'PUBLISHED' : 'UNKNOWN';
  const first = facts[0] || null;
  const out = {
    schema: CARD_SCHEMA, type: TYPE[c.action] || 'rule', status, title: c.title, product: null, headline: c.summary || c.title,
    lines: (c.rows || []).map((r) => ({ label: r.label, text: r.value, fact: r.source && r.source.sentence ? { source_url: r.source.url, page: null, sentence: r.source.sentence, status: 'PUBLISHED' } : undefined })),
    facts, source: first, chip: status === 'UNKNOWN' ? 'Not in the published documentation' : chipFor(first && first.source_url),
    links: (c.sources || []).map((s) => ({ label: s.label, url: s.url })), table: c.table ? { cols: c.table.head, rows: c.table.rows.map((r) => [r.label, ...r.cells.map((x) => x.value)]) } : null,
    calc: c.action === 'calc' ? { inputs: {}, outputs: {}, derived: true } : null, followups: (c.buttons || []).filter((b) => b.command).map((b) => b.command), handoff: null,
  };
  if (status === 'UNKNOWN') out.handoff = { question: c.title, reason: (c.notes && c.notes[0]) || 'Not in the published data.', missing: [] };
  return out;
}
export function validateBrainCard(c) {
  const bad = [];
  if (!c || c.schema !== CARD_SCHEMA) bad.push('schema');
  if (!['product', 'rate', 'document', 'safety', 'time', 'compatibility', 'spec', 'system', 'calculation', 'comparison', 'choose', 'unknown', 'rule'].includes(c.type)) bad.push('type ' + c.type);
  if (!['PUBLISHED', 'UNKNOWN'].includes(c.status)) bad.push('status ' + c.status);
  if (!c.chip) bad.push('chip');
  for (const f of c.facts || []) if (f.status === 'PUBLISHED' && (!f.sentence || !f.source_url)) bad.push('PUBLISHED fact without sentence or url');
  if (c.type !== 'choose' && c.status === 'PUBLISHED' && !c.source && c.type !== 'rule' && c.type !== 'unknown') bad.push('PUBLISHED card without source');
  if (c.type !== 'choose' && c.status === 'UNKNOWN' && !c.handoff) bad.push('UNKNOWN card without hand-off');
  return bad;
}
