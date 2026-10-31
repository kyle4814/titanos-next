// num_extract.mjs: pure functions that turn one labelled data sheet row ("Pot Life | 18 minutes @ 23°C") into a normalised numeric fact.
// No file access, no network, no model. Used by build_num.mjs (build time) and by the tests in demo-tests/sika-brain2b.
// Rules: a figure is only read when its unit is printed next to it; an unreadable row gives null (never a guess); units are normalised
// (minutes, months, MPa, g/L, mm, degrees C) and the original text is always kept by the caller so the answer quotes it as written.

const NUM = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:[.,]\\d+)?)';
const DASH = '(?:-|\\u2013|\\u2014|\\u2212|to)';
export const toNum = (s) => {
  s = String(s);
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ''));
  return Number(s.replace(',', '.'));
};
const r4 = (x) => Math.round(x * 10000) / 10000;
const clean = (t) => String(t == null ? '' : t).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Printed time units to minutes. Only whole-word units are read ("5 h" yes, "5 hot" no). */
const TU = [[/^(sec(onds?)?|s)$/i, 1 / 60], [/^(min(ute)?s?)$/i, 1], [/^(h|hrs?|hours?)$/i, 60], [/^(d|days?)$/i, 1440], [/^(weeks?|wks?)$/i, 10080]];
export const unitMinutes = (u) => { for (const [rx, k] of TU) if (rx.test(u)) return k; return null; };

/** Temperature condition printed with a figure: "@ 23°C", "at 23 oC", "+20 °C". */
export function tempOf(text) {
  const m = clean(text).match(/([+-]?\d{1,2})\s*(?:°\s*c|º\s*c|o\s?c|°|deg(?:rees)?\s*c)\b/i);
  return m ? Number(m[1]) : null;
}

/** Every duration in a text. { lo, hi } in minutes, plus the printed unit and the qualifier (~ < > up to). */
export function durations(text) {
  const t = clean(text); const out = [];
  const rx = new RegExp(`(<|>|\\u2264|\\u2265|~|approx\\.?|about|up to|max\\.?|min\\.?)?\\s*(?<![\\w.,])${NUM}\\s*(?:${DASH}\\s*${NUM}\\s*)?(sec(?:onds?)?|mins?|minutes?|hours?|hrs?|h|days?|d|weeks?|wks?)(?![a-z])`, 'gi');
  let m;
  while ((m = rx.exec(t))) {
    const k = unitMinutes(m[4]); if (k == null) continue;
    const a = toNum(m[2]); const b = m[3] != null ? toNum(m[3]) : a;
    if (!(Number.isFinite(a) && Number.isFinite(b)) || b < a) continue;
    out.push({ lo: r4(a * k), hi: r4(b * k), unit: m[4].toLowerCase(), print: `${m[2]}${m[3] != null ? ' to ' + m[3] : ''} ${m[4]}`, q: (m[1] || '').toLowerCase().replace(/\.$/, '') || null, at: m.index });
  }
  return out;
}

/** "12 months", "up to 2 years", "18 months from the date of manufacture" -> months. */
export function shelfLife(text) {
  const t = clean(text);
  const m = t.match(new RegExp(`${NUM}\\s*(?:${DASH}\\s*${NUM}\\s*)?(months?|mths?|years?|yrs?)(?![a-z])`, 'i'));
  if (!m) return null;
  const k = /^y/i.test(m[3]) ? 12 : 1; const a = toNum(m[1]); const b = m[2] != null ? toNum(m[2]) : a;
  if (!(b >= a) || a <= 0) return null;
  return { months_lo: r4(a * k), months_hi: r4(b * k), print: `${m[1]}${m[2] != null ? ' to ' + m[2] : ''} ${m[3]}` };
}

/** Strength figures with the age printed beside them. N/mm2 and MPa are the same unit. Age in days (hours / 24). */
export function strengths(text) {
  const t = clean(text).replace(/N\s*\/\s*mm\s*(?:2|²)/gi, 'MPa').replace(/\bN\/mm\^2\b/gi, 'MPa');
  const out = [];
  const rx = new RegExp(`(<|>|\\u2264|\\u2265|~|approx\\.?|\\u2248)?\\s*${NUM}\\s*(?:MPa\\s*)?(?:${DASH}\\s*${NUM}\\s*)?MPa(?![a-z])`, 'gi');
  let m;
  while ((m = rx.exec(t))) {
    const a = toNum(m[2]); const b = m[3] != null ? toNum(m[3]) : a; if (!(b >= a)) continue;
    // the age is the nearest "N day(s)/hour(s)" in the same clause (clauses split on ; and on a following figure)
    const from = Math.max(0, t.lastIndexOf(';', m.index) + 1); let to = t.indexOf(';', m.index + m[0].length); if (to < 0) to = t.length;
    const clause = t.slice(from, to);
    const ages = []; const agrx = new RegExp(`${NUM}\\s*(days?|d|hours?|hrs?|h)(?![a-z])`, 'gi'); let ag;
    while ((ag = agrx.exec(clause))) { const n = toNum(ag[1]); ages.push({ at: from + ag.index, end: from + ag.index + ag[0].length, days: /^h/i.test(ag[2]) ? r4(n / 24) : n }); }
    let age = null, bd = Infinity;
    const lead = ages.find((g) => g.end <= m.index && /^\s*(?:cure|curing|cured)?\s*[:\u2013\u2014-]?\s*(?:at|of)?\s*$/i.test(t.slice(g.end, m.index)));
    if (lead) age = lead.days; else
    for (const g of ages) { const d = g.end <= m.index ? m.index - g.end : g.at >= m.index + m[0].length ? g.at - (m.index + m[0].length) : 0; if (d < bd) { bd = d; age = g.days; } }
    out.push({ mpa_lo: a, mpa_hi: b, op: m[1] ? ({ '≤': '<=', '≥': '>=', '≈': '~', 'approx.': '~', approx: '~' }[m[1].toLowerCase()] || m[1]) : null, age_days: age });
  }
  return out;
}

/** VOC in grams per litre. "< 1 g/l", "VOC content 450 g/L". A percentage or an unlabelled number is not read. */
export function voc(text) {
  const t = clean(text); const out = [];
  const rx = new RegExp(`(<|>|\\u2264|\\u2265|~|max\\.?)?\\s*${NUM}\\s*(?:${DASH}\\s*${NUM}\\s*)?(g|mg)\\s*/\\s*(l|litre|liter|ltr)(?![a-z])`, 'gi');
  let m;
  while ((m = rx.exec(t))) { const k = /^mg/i.test(m[4]) ? 0.001 : 1; const a = toNum(m[2]) * k; const b = (m[3] != null ? toNum(m[3]) : toNum(m[2])) * k; out.push({ gl_lo: r4(a), gl_hi: r4(b), op: m[1] || null }); }
  return out;
}

/** Layer thickness ranges in mm ("1 - 30mm (neat) and 10-50mm (bulked)", "min. 10 mm / 150 mm"). Every range keeps its own words. */
export function thickness(text) {
  const t = clean(text); const out = [];
  const rx = new RegExp(`(min\\.?|max\\.?|up to|from)?\\s*(?<![\\w.,])${NUM}\\s*(?:mm)?\\s*(?:${DASH}\\s*${NUM}\\s*)?mm(?![a-z\\u00b2])`, 'gi');
  let m;
  while ((m = rx.exec(t))) {
    const a = toNum(m[2]); const b = m[3] != null ? toNum(m[3]) : a; if (!(b >= a)) continue;
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 24).toLowerCase();
    out.push({ mm_lo: a, mm_hi: b, q: m[1] ? m[1].toLowerCase().replace(/\.$/, '') : null, note: /neat|aggregate|bulk|extended/.test(after) ? (after.match(/neat|aggregate|bulk\w*|extended/) || [''])[0] : null });
  }
  return out;
}

/** Service or application temperature range in degrees C: "-40 C Min / +95 C Max", "-20 to +80 C". */
export function tempRange(text) {
  const t = clean(text).replace(/−/g, '-').replace(/([+-])\s+(\d)/g, '$1$2');
  const mn = t.match(/([+-]?\d{1,3})\s*(?:°|º|o)?\s*c\s*min/i); const mx = t.match(/([+-]?\d{1,3})\s*(?:°|º|o)?\s*c\s*max/i);
  if (mn && mx) return { c_lo: Number(mn[1]), c_hi: Number(mx[1]) };
  const m = t.match(/([+-]?\d{1,3})\s*(?:°|º|o)?\s*c?\s*(?:-|to)\s*([+-]?\d{1,3})\s*(?:°|º|o)\s*c/i);
  if (m && Number(m[2]) >= Number(m[1])) return { c_lo: Number(m[1]), c_hi: Number(m[2]) };
  return null;
}

/** Percent figures ("movement capability 25 %", "solid content by volume 100 %"). */
export function percent(text) {
  const t = clean(text); const out = [];
  const rx = new RegExp(`(<|>|\\u2264|\\u2265|~|\\u00b1|\\+/-)?\\s*${NUM}\\s*(?:${DASH}\\s*${NUM}\\s*)?%`, 'g');
  let m;
  while ((m = rx.exec(t))) { const a = toNum(m[2]); const b = m[3] != null ? toNum(m[3]) : a; if (b >= a) out.push({ pct_lo: a, pct_hi: b, op: m[1] || null }); }
  return out;
}

/** Shore hardness number (A or D) from the text, or null. */
export function shore(text) {
  const t = clean(text); const m = t.match(new RegExp(`(?:~|approx\\.?|about)?\\s*${NUM}\\s*(?:\\(|\\s)?(?:shore\\s*)?(A|D)?\\b`, 'i'));
  const sc = t.match(/shore\s*([AD])/i); const n = t.match(new RegExp(`${NUM}`));
  if (!n) return null;
  return { value: toNum(n[1]), scale: sc ? sc[1].toUpperCase() : (m && m[2] ? m[2].toUpperCase() : null) };
}

/** Pack sizes from a Packaging row: "20kg Paper bags", "13.5 kg bag", "5 L pail", "300 ml cartridge". */
export function packs(text) {
  const t = clean(text); const out = []; const seen = new Set();
  const rx = new RegExp(`(?<![\\w.,])${NUM}\\s*(kg|g|l|ltrs?|litres?|liters?|ml|mL)\\b\\s*(?:-\\s*)?(?:x\\s*)?([a-z]+)?`, 'gi');
  let m;
  while ((m = rx.exec(t))) {
    let u = m[2].toLowerCase(); u = u === 'g' ? 'g' : u === 'kg' ? 'kg' : u === 'ml' ? 'mL' : 'L';
    const a = toNum(m[1]); const c = (m[3] || '').toLowerCase();
    const container = /^(bags?|pails?|cartridges?|sausages?|drums?|cans?|tubs?|buckets?|units?|kits?|bottles?|tubes?|containers?|jugs?|tins?|rolls?|packs?)$/.test(c) ? c.replace(/s$/, '') : (/^(paper|plastic|foil|metal|steel|poly)$/.test(c) ? '' : '');
    const key = a + u; if (seen.has(key) || !(a > 0)) continue; seen.add(key);
    out.push({ amount: a, unit: u, container });
  }
  return out;
}

// ---- the field table. label: which published labels feed it; parse: how the value is read; rank: how a question can order it.
const L = (s) => new RegExp(s, 'i');
export const FIELDS = [
  { id: 'pot_life', what: 'pot life', label: L('^(pot life|working time|workable life)\\b'), parse: 'dur' },
  { id: 'open_time', what: 'open time', label: L('^(open time|open-time|time open)\\b'), parse: 'dur' },
  { id: 'adjust_time', what: 'adjustability time', label: L('^adjustab'), parse: 'dur' },
  { id: 'initial_set', what: 'initial set time', label: L('^(initial set|initial setting|setting time)\\b'), parse: 'dur' },
  { id: 'final_set', what: 'final set time', label: L('^final set'), parse: 'dur' },
  { id: 'cure_rate', what: 'curing rate', label: L('^(curing rate|cure rate|curing time|cure speed)\\b'), parse: 'rate' },
  { id: 'cure_time', what: 'curing time', label: L('^(curing time|cure time|curing rate|cure rate|hardening time|full cure)\\b'), parse: 'dur' },
  { id: 'skin_time', what: 'skinning or tack free time', label: L('^(skinning time|skin time|tack[- ]free time|skin over time)\\b'), parse: 'dur' },
  { id: 'overcoat_wait', what: 'waiting time to overcoating', label: L('^(waiting time to overcoating|overcoating|recoat)'), parse: 'dur' },
  { id: 'compressive', what: 'compressive strength', label: L('^compressive strength\\b'), parse: 'str' },
  { id: 'flexural', what: 'flexural strength', label: L('^(flexural[- ]strength|tensile strength in flexure|flexural)\\b'), parse: 'str' },
  { id: 'tensile_adhesion', what: 'tensile adhesion strength', label: L('^(tensile adhesion strength|adhesion strength|bond strength|adhesion)\\b'), parse: 'str' },
  { id: 'tensile', what: 'tensile strength', label: L('^tensile strength\\b(?! in flexure)'), parse: 'str' },
  { id: 'voc', what: 'VOC content', label: L('^(volatile organic compound|voc)'), parse: 'voc' },
  { id: 'shelf_life', what: 'shelf life', label: L('^shelf life$'), parse: 'shelf' },
  { id: 'layer', what: 'layer thickness', label: L('^(layer thickness|application thickness)$'), parse: 'mm' },
  { id: 'service_temp', what: 'service temperature', label: L('^service temperature'), parse: 'temp' },
  { id: 'movement', what: 'movement capability', label: L('^movement capability'), parse: 'pct' },
  { id: 'solids_vol', what: 'solid content by volume', label: L('^solid content by volume'), parse: 'pct' },
  { id: 'shore', what: 'Shore hardness', label: L('^shore (a|d) hardness'), parse: 'shore' },
  { id: 'pack_sizes', what: 'pack sizes', label: L('^packaging$'), parse: 'packs' },
];

/** One row -> { id, v } or null. v is the normalised value(s); the caller keeps the printed text, page and source beside it. */
export function extractRow(label, value) {
  const lab = clean(label).replace(/\s*\(.*$/, '').trim(); const text = clean(value);
  if (!lab || !text) return null;
  for (const f of FIELDS) {
    if (!f.label.test(lab)) continue;
    let v = null;
    // a flattened table ("Temperature | Open time | 3 minutes | 3 hours") loses which figure belongs to which column: never read figures out of it
    if (/\s\|\s/.test(text) && ['dur', 'str', 'voc', 'mm', 'pct'].includes(f.parse)) return null;
    switch (f.parse) {
      case 'rate': { const m = text.match(new RegExp(`${NUM}\\s*(?:${DASH.replace('to', 'to|~')}\\s*${NUM}\\s*)?mm\\s*(?:/|per|in)\\s*(24\\s*(?:h|hrs?|hours?)|day|1\\s*day)`, 'i')); if (m) { const a = toNum(m[1]); const b = m[2] != null ? toNum(m[2]) : a; if (b >= a) v = { mm_lo: a, mm_hi: b, per_hours: 24, at_c: tempOf(text) }; } break; }
      case 'dur': { if (/mm\s*(?:\/|per|in)\s*\d*\s*(?:h|hrs?|hours?|days?)\b/i.test(text)) break;  const d = durations(text); if (d.length) v = { items: d.map((x) => ({ min_lo: x.lo, min_hi: x.hi, unit: x.unit, print: x.print, q: x.q })), at_c: tempOf(text) }; break; }
      case 'str': { const s = strengths(text); if (s.length) v = { items: s }; break; }
      case 'voc': { const s = voc(text); if (s.length) v = { items: s }; break; }
      case 'shelf': { const s = shelfLife(text); if (s) v = s; break; }
      case 'mm': { const s = thickness(text); if (s.length) v = { items: s }; break; }
      case 'temp': { const s = tempRange(text); if (s) v = s; break; }
      case 'pct': { const s = percent(text); if (s.length) v = { items: s }; break; }
      case 'shore': { const s = shore(lab + ' ' + text); if (s && s.scale) v = s; break; }
      case 'packs': { const s = packs(text); if (s.length) v = { items: s }; break; }
    }
    if (v) return { id: f.id, what: f.what, v };
  }
  return null;
}

/** The value a ranking question compares, per field. null = this row cannot be ordered (the caller says "not comparable"). */
export function rankValue(fieldId, v) {
  if (!v) return null;
  switch (fieldId) {
    case 'pot_life': case 'open_time': case 'adjust_time': case 'initial_set': case 'final_set': case 'cure_time': case 'skin_time': case 'overcoat_wait':
      return v.items && v.items[0] ? { lo: v.items[0].min_lo, hi: v.items[0].min_hi, unit: 'min', at_c: v.at_c } : null;
    case 'compressive': case 'flexural': case 'tensile_adhesion': case 'tensile': {
      // only the same age compares: 28 days. Compressive strength needs the age printed; the others may print none (then the cited text carries the test condition)
      const it = (v.items || []).filter((x) => x.age_days === 28 || (x.age_days == null && fieldId !== 'compressive'));
      return it.length ? { lo: it[0].mpa_lo, hi: it[0].mpa_hi, unit: 'MPa', age_days: it[0].age_days } : null;
    }
    case 'cure_rate': return { lo: v.mm_lo, hi: v.mm_hi, unit: 'mm per 24 h', at_c: v.at_c };
    case 'voc': return v.items && v.items[0] ? { lo: v.items[0].gl_lo, hi: v.items[0].gl_hi, unit: 'g/L' } : null;
    case 'shelf_life': return { lo: v.months_lo, hi: v.months_hi, unit: 'months' };
    case 'layer': return v.items && v.items[0] ? { lo: v.items[0].mm_lo, hi: v.items[0].mm_hi, unit: 'mm' } : null;
    case 'movement': return v.items && v.items[0] ? { lo: v.items[0].pct_lo, hi: v.items[0].pct_hi, unit: '%' } : null;
    default: return null;
  }
}
