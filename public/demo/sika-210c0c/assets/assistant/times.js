// times.js (T21): the cure-time programme, built only from times the knowledge lane read from a data sheet.
// Every step quotes its source sentence. A step with no published time says so. No time is ever computed, converted or added up here.
import { plain } from './answer.js';

export const STEPS = [
  ['open', 'Open time'],
  ['adjust', 'Adjustability time'],
  ['grout', 'Setting time before grouting'],
  ['foot', 'Foot traffic'],
  ['dry', 'Return to service, dry area'],
  ['wet', 'Return to service, wet area'],
  ['pot', 'Pot life'],
  ['recoat', 'Waiting time before the next coat'],
];
const UNIT = { min: ['minute', 'minutes'], h: ['hour', 'hours'], d: ['day', 'days'], s: ['second', 'seconds'], wk: ['week', 'weeks'] };

/** Which programme step a published time belongs to (or 'other'). Uses the lane's group and the data sheet's own label and sentence. */
export function stepOf(kind, f) {
  const t = (f.label + ' ' + f.text + ' ' + ((f.parsed || {}).condition || '')).toLowerCase();
  if (kind === 'pot_life') return 'pot';
  if (kind === 'recoat_times') return 'recoat';
  if (kind === 'adjustability_time') return 'adjust';
  if (kind === 'open_time') return /adjust/.test(t) ? 'adjust' : 'open';
  if (/wet area/.test(t)) return 'wet';
  if (/dry area/.test(t)) return 'dry';
  if (/grouting/.test(t)) return 'grout';
  if (/foot traffic|walk on/.test(t)) return 'foot';
  return 'other';
}

function amount(p) {
  if (!p || p.model !== 'duration' || p.min == null || !UNIT[p.unit]) return null;
  const w = (n) => String(n);
  const u = UNIT[p.unit][(p.max != null ? p.max : p.min) === 1 && (p.max == null || p.max === p.min) ? 0 : 1];
  const core = p.max != null && p.max !== p.min ? `${w(p.min)} to ${w(p.max)} ${u}` : `${w(p.min)} ${u}`;
  return (p.qualifier ? p.qualifier + ' ' : '') + core;
}

/** Flat list of every published time for a product: {step, kind, label, text, amount, conditions, at_c, s}. */
export function timesOf(k) {
  const out = [];
  const T = (k && k.times) || {};
  for (const kind of Object.keys(T)) for (const f of T[kind]) {
    out.push({ id: f.id, step: stepOf(kind, f), kind, label: plain(f.label), text: plain(f.text), amount: amount(f.parsed), at_c: (f.parsed || {}).at_c == null ? null : f.parsed.at_c,
      conditions: (f.conditions || []).map(plain), header: f.table_header ? plain(f.table_header) : null, s: f.s });
  }
  return out;
}

/** Programme: one entry per step in STEPS. {step, label, items:[time...]} ; empty items means "time not published". */
export function programmeOf(k) {
  const all = timesOf(k);
  return STEPS.map(([step, label]) => ({ step, label, items: all.filter((t) => t.step === step), notPublished: !all.some((t) => t.step === step) }));
}

/** Plain-text lines for the programme box on a system sheet. Every figure printed is the lane's parsed figure, shown beside its source sentence. */
export function programmeLines(k) {
  const lines = [];
  for (const st of programmeOf(k)) {
    if (st.notPublished) { lines.push({ step: st.step, label: st.label, text: 'Time not published', quote: null, s: null }); continue; }
    for (const it of st.items) lines.push({ step: st.step, label: st.label, text: it.amount ? it.amount + (it.at_c != null ? ` at ${it.at_c} degrees C` : '') : 'See the quoted sentence', quote: it.text, conditions: it.conditions, s: it.s });
  }
  return lines;
}
export const PROGRAMME_CAVEAT = 'Published times are a guide. Conditions such as temperature and humidity apply; each line shows the data sheet sentence it comes from.';

/** Does the question ask for a time? */
export const TIME_RE = /\b(open time|working time|pot ?life|cure|curing|cured|setting time|set time|how long (?:before|until|till|to wait|do i wait|does it take|should i wait)|wait (?:before|until|for)|before (?:i )?grout|grout(?:ing)? after|foot traffic|walk on|return(?:ing)? to service|re-?coat|over-?coat|dry(?:ing)? time|how long (?:to|for) dry|time to dry|adjustab)/i;

/** Block(s) answering a time question for a product from its k file. */
export function timeAnswer(name, k, question) {
  const prog = programmeOf(k);
  const q = String(question || '').toLowerCase();
  const want = new Set();
  if (/open time|working time/.test(q)) want.add('open');
  if (/adjust/.test(q)) want.add('adjust');
  if (/grout|set(?:ting)? time/.test(q)) want.add('grout');
  if (/foot traffic|walk on/.test(q)) want.add('foot');
  if (/wet area|shower|bathroom|wet/.test(q) && /service|use|cure|dry|wait|how long/.test(q)) want.add('wet');
  if (/return(?:ing)? to service|dry area|cure|curing|cured|dry/.test(q)) { want.add('dry'); want.add('wet'); }
  if (/pot ?life/.test(q)) want.add('pot');
  if (/re-?coat|over-?coat|next coat/.test(q)) want.add('recoat');
  const steps = want.size ? prog.filter((s) => want.has(s.step)) : prog.filter((s) => !s.notPublished);
  const rows = [];
  for (const s of steps) {
    if (s.notPublished) { rows.push({ label: s.label, value: 'Time not published' }); continue; }
    for (const it of s.items) rows.push({ label: s.label, value: it.text, source: it.s ? { label: `${it.s.t === 'PDS' ? 'Data sheet' : 'Product page'}, ${it.s.v || ''}${it.s.p ? ', page ' + it.s.p : ''}`.replace(/, ,/g, ','), url: it.s.u } : null, conds: it.conditions });
  }
  const other = !want.size ? timesOf(k).filter((t) => t.step === 'other') : [];
  for (const it of other) rows.push({ label: it.label, value: it.text, source: it.s ? { label: `${it.s.t === 'PDS' ? 'Data sheet' : 'Product page'}, ${it.s.v || ''}${it.s.p ? ', page ' + it.s.p : ''}`, url: it.s.u } : null, conds: it.conditions });
  if (!rows.length) return null;
  return { type: 'facts', title: `Published times for ${plain(name)}`, rows, note: PROGRAMME_CAVEAT };
}
