// rulex.mjs: rule extraction from the published specification clauses (data/specs/<id>.json). Pure functions, no I/O, no model, no network.
// Every rule keeps the exact words it came from (q), the clause number (c) and the data sheet page (p), so the answer layer can cite it.
// A number in a rule is read from the clause text and from nowhere else: the unit tests flip one number in a real clause and the rule must follow.
// Used by build_rules.mjs (build time) and by demo-tests/sika-brain2d. The browser never loads this file.

const HOURS = { min: 1 / 60, mins: 1 / 60, minute: 1 / 60, minutes: 1 / 60, h: 1, hr: 1, hrs: 1, hour: 1, hours: 1, day: 24, days: 24, week: 168, weeks: 168 };
const NUM = '(\\d+(?:[.,]\\d+)?)';
const DASH = '(?:-|\\u2013|\\u2014|\\u2500|to)';
const UNITRX = '(min(?:ute)?s?|mins?|h(?:ou)?rs?|hours?|hrs?|days?|weeks?)';
const num = (s) => Number(String(s).replace(',', '.'));
const clip = (s, n = 280) => { s = String(s).replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
export const norm = (s) => String(s == null ? '' : s).replace(/[­]/g, '').replace(/º/g, '°').replace(/\s+/g, ' ').trim();

/** "1-2 hours", "6 to 8 hours", "~3 hours", "3+ days", "50min+", "30 Minutes" -> { min, max, plus } in HOURS, or null. The first duration in the text. */
export function parseDuration(text) {
  const s = norm(text).replace(/½/g, '.5');
  const m = new RegExp(NUM + '\\s*(?:' + DASH + '\\s*' + NUM + ')?\\s*(\\+)?\\s*' + UNITRX + '\\b(\\+)?', 'i').exec(s);
  if (!m) return null;
  if (/^\s*(mm|cm|m)\b/i.test(s.slice(m.index + m[0].length)) ) return null;
  const k = HOURS[m[4].toLowerCase()]; const a = num(m[1]), b = m[2] != null ? num(m[2]) : a;
  return { min: round(a * k), max: round(b * k), plus: !!(m[3] || m[5]), raw: m[0].trim().replace(/\s+/g, ' ') };
}
const round = (x) => Math.round(x * 1e6) / 1e6;

/** every text line of a clause: the sentence, the lead, the bullets, each table row (cells joined with " | "), the trailing notes and the grouped tables */
export function clauseLines(c) {
  const out = [];
  if (c.x) out.push(c.x);
  if (c.l) out.push(c.l);
  for (const s of c.s || []) out.push(s);
  for (const r of c.tb || []) out.push(r.join(' | '));
  for (const r of c.r || []) out.push(r.filter(Boolean).join(' | '));
  for (const s of c.tr || []) out.push(s);
  for (const g of c.g || []) { if (g.heading) out.push(g.heading); for (const r of g.table || []) out.push(r.join(' | ')); for (const s of g.trail || []) out.push(s); }
  return out.map(norm).filter(Boolean);
}
/** the rows of a clause as cell arrays (table rows only) */
const rowsOf = (c) => (c.tb || []).map((r) => r.map(norm));
const sentences = (line) => norm(line).split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/).map((x) => x.trim()).filter(Boolean);

// ------------------------------------------------------------------ waits
/** which published wait a label or sentence describes (a label can be several: "Grouting and light foot traffic") */
export function waitKinds(label) {
  const s = norm(label).toLowerCase(); const k = [];
  if (/(2nd|second|next|subsequent|between)\s+coats?|\bcoat\b.*\bbefore applying the (2nd|second|next)/.test(s)) k.push('coat');
  if (/\b(prior to|before|until|for)\s+(the\s+)?grout(?:ing)?\b|\bready for grouting\b|^\s*grout(?:ing)?\b|\bgrouting\s*(?:and|or|\/|&)|\bset(?:ting)? time (?:prior|before) (?:to )?grout/.test(s) && !/grout haze|cleaning/.test(s)) k.push('grout');
  if (/\b(ready (for|to be) (tiling|covered|covering)|tiling|prior to covering|before (tiling|covering)|covering with tile|overcoat\w*|floor coverings?|subsequent flooring|ready for tile)\b/.test(s) && !/grout|flood/.test(s)) k.push('cover');
  if (/light foot|foot traffic|foot trafic|walkable|pedestrian/.test(s)) k.push('light');
  if (/dry (areas?|are)\b/.test(s)) k.push('dry');
  if (/wet area|wet areas/.test(s)) k.push('wet');
  if (/submerged|\bpools?\b|\bspas?\b|filling/.test(s)) k.push('submerged');
  if (/full (service|traffic|cure|strength)|full service/.test(s)) k.push('full');
  if (/flood/.test(s)) k.push('flood');
  if (/return to (service|use)|service\b|\buse\b/.test(s) && !k.includes('dry') && !k.includes('wet') && !k.includes('submerged') && !k.includes('full') && !k.includes('light')) k.push('service');
  if (/exposed to water|water or chemicals/.test(s) && !k.includes('wet')) k.push('wet');
  if (/skin/.test(s)) k.push('skin');
  if (/tack[- ]free/.test(s)) k.push('tack');
  if (/\b(emulsif|rewash)/.test(s)) k.push('wash');
  return [...new Set(k)];
}
const poro = (s) => (/non[- ]?porous|compressed cement/i.test(s) ? { porous: false } : /\bporous\b/i.test(s) ? { porous: true } : {});
const ON = (s) => (/\bon the wall\b|\bwall\b/i.test(s) && !/\bfloor\b/i.test(s) ? 'wall' : /\bon the floor\b|\bfloor\b/i.test(s) && !/\bwall\b/i.test(s) ? 'floor' : null);
/** conditions the figure was measured at */
export function atConditions(text) {
  const s = norm(text); const o = {};
  const t = /(?:at|@|measured at|taken at)\s*\+?(\d+)\s*°\s*C/i.exec(s) || /(\d+)\s*°\s*C\b/.exec(s); if (t) o.c = Number(t[1]);
  const h = /(\d+)\s*%\s*(?:r\.?h\.?|relative humidity|reletive humidity)/i.exec(s); if (h) o.rh = Number(h[1]);
  return o;
}
/** "For temperatures less than 15\u00b0C allow 3 days for dry areas and 7 days for wet areas" -> { below: 15, dry: 72, wet: 168 } (hours), or null */
export function coldWait(text) {
  const s = norm(text); const m = new RegExp('(?:temperatures?|climates?)[^.]*?(?:less than|below|under|lower than)\\s*\\+?' + NUM + '\\s*\u00b0\\s*C[^.]*?allow\\s*' + NUM + '\\s*' + UNITRX + '\\s*for dry areas?[^.]*?(?:and|,)\\s*' + NUM + '\\s*' + UNITRX + '\\s*for wet areas?', 'i').exec(s);
  if (!m) return null;
  return { below: num(m[1]), dry: round(num(m[2]) * HOURS[m[3].toLowerCase()]), wet: round(num(m[4]) * HOURS[m[5].toLowerCase()]), dryRaw: m[2] + ' ' + m[3].toLowerCase(), wetRaw: m[4] + ' ' + m[5].toLowerCase() };
}
const WAIT_TITLE = /ready for use|waiting time|curing time|drying time|setting time|application data|curing rate|skinning|tack free|applied product|curing treatment|^application\b|limitations|flood|properties stated/i;
const WAIT_TRIGGER = /\b(allow|wait|dry|ready|before|prior|after|until|cure|commence|walkable|set time|setting)\b/i;
/** waits from one clause. Table rows "label | value", "Key: value" bullets and trigger sentences. Returns [{ kinds, min, max, plus, on, label, q, at }] */
export function extractWaits(c) {
  const out = []; const seen = new Set();
  const push = (kinds, label, valueText, quote, extra = {}) => {
    const d = parseDuration(valueText); if (!d || !kinds.length) return;
    const key = kinds.join('+') + '|' + d.min + '|' + d.max + '|' + (extra.on || ''); if (seen.has(key)) return; seen.add(key);
    out.push({ kinds, min: d.min, max: d.max, plus: d.plus, raw: d.raw, on: extra.on || ON(label) || null, label: clip(label, 90), q: clip(quote), at: extra.at || {}, ...extra.more });
  };
  const title = c.t || '';
  const lines = clauseLines(c); const cond = lines.filter((l) => /measure|taken|determined|tested|laboratory/i.test(l)).map(atConditions).find((x) => x.c || x.rh) || {};
  if (!WAIT_TITLE.test(title)) return out;
  const isTable = /ready for use|waiting time|curing time|drying time|setting time|curing treatment|applied product|tack free/i.test(title);
  for (const r of rowsOf(c)) {
    if (r.length < 2) continue;
    const label = r[0] || ''; const val = r.slice(1).join(' ');
    if (!parseDuration(val) && parseDuration(label) && /skinning|tack free|curing rate/i.test(title) && !/mm/i.test(label)) { const kt = waitKinds(title); if (kt.length) push(kt, title, label, r.join(' | '), { at: atConditions(r.join(' ')) }); continue; }
    if (!parseDuration(val)) continue;
    if (/pot life|open time/i.test(label + ' ' + title) && !/ready|grout|service/.test(label)) continue;
    const k = waitKinds(label + ' ' + (isTable && !label ? title : '')) ; const kk = k.length ? k : (isTable ? waitKinds(title) : []);
    if (!/tack free/i.test(title) && !kk.length) continue;
    push(/tack free/i.test(title) ? ['tack'] : kk, label, val, r.join(' | '), { at: cond, on: ON(label), more: poro(label) });
  }
  for (const l of lines) {
    if ((c.tb || []).some((r) => r.join(' | ') === l)) continue;
    const kv = /^([A-Za-z][A-Za-z ()\/&,'\-]{2,70}?)\s*[:–-]\s*(.+)$/.exec(l);
    if (kv && /time|ready|drying|setting|curing|skinning|tack/i.test(kv[1]) && !/pot life|open time|adjustab/i.test(kv[1])) {
      const kinds = waitKinds(kv[1] + ' ' + kv[2]); const d = parseDuration(kv[2]);
      if (d && /mm\s*\/\s*\d/.test(kv[2])) continue;
      if (d && /(curing rate|cure rate)/i.test(kv[1])) continue;
      if (d && kinds.length) { push(kinds, kv[1], kv[2], l, { at: atConditions(l) }); continue; }
      if (d && /setting time|drying time|curing time|skinning/i.test(kv[1])) { push(/skinning/i.test(kv[1]) ? ['skin'] : /setting/i.test(kv[1]) ? ['set'] : ['drying'], kv[1], kv[2], l, { at: atConditions(l) }); continue; }
    }
    for (const sn of sentences(l)) {
      const cold = coldWait(sn); if (cold) { push(['cold'], clip(sn, 90), sn, sn, { at: { c: cold.below }, more: { below: cold.below, dry: cold.dry, wet: cold.wet, dryRaw: cold.dryRaw, wetRaw: cold.wetRaw } }); continue; }
      if (!parseDuration(sn) || !WAIT_TRIGGER.test(sn)) continue;
      if (/pot life|open time|shelf life|months?\b|weeks? (curing|cure|old)|\bcure for \d+ weeks|cured? (a )?min/i.test(sn)) continue;
      if (/mm\s*\/\s*\d+\s*h/i.test(sn)) continue;
      if (/\b(clean(ing)?|haze|wipe|sponge|skinned|emulsif|rewash|re-?prime|primed.*within|recontaminat)\b/i.test(sn)) continue;
      if (/\b(within|more than|longer than|no later than|beyond|left (?:un)?covered|left exposed)\b/i.test(sn)) continue; // a limit on how long a layer may wait is not a wait
      if (/\bfor\s+\d+\s*(?:-|to)?\s*\d*\s*(?:hours?|days?)\s+(?:at|min)/i.test(sn) && /flood/i.test(sn) === false && !/dry|ready|allow|wait/i.test(sn)) continue;
      const kinds = waitKinds(sn); if (!kinds.length) continue;
      push(kinds, clip(sn, 90), sn, sn, { at: atConditions(sn) });
    }
  }
  return out;
}
/** pot life / open time / adjustability, in hours */
export function extractWorkTimes(c) {
  const out = []; const t = c.t || '';
  const kindOf = (s) => (/pot life/i.test(s) ? 'pot' : /open time/i.test(s) ? 'open' : /adjustab/i.test(s) ? 'adjust' : null);
  if (/pot life|open time|adjustab|application data|properties stated/i.test(t)) {
    for (const r of rowsOf(c)) { const k = kindOf(t + ' ' + r[0]); const d = k && parseDuration(r.slice(r.length > 1 ? 1 : 0).join(' ')); if (d && /pot life|open time|adjustab/i.test(t + ' ' + r[0])) out.push({ kind: k, min: d.min, max: d.max, q: clip(r.join(' | ')), at: atConditions(r.join(' ')) }); }
    for (const l of clauseLines(c)) {
      const m = /^(pot life|open time|adjustab\w* time)\s*[:\-]?\s*(.+)$/i.exec(l); if (!m) continue; const d = parseDuration(m[2]); if (!d) continue;
      out.push({ kind: kindOf(m[1]), min: d.min, max: d.max, q: clip(l), at: atConditions(l) });
    }
  }
  return out;
}

// ------------------------------------------------------------------ temperature, humidity, moisture, dew point
const TEMP = '\\+?\\s*(\\d+(?:[.,]\\d+)?)\\s*\\u00b0?\\s*C\\b';
/** { min, max } in degrees C from "+5 °C to +40 °C", "5 - 40 °C", "below 5°C or above 35°C", "between 5°C and 35°C", "min. +5 °C" */
export function parseTempRange(text) {
  const s = norm(text).replace(/–|—|─/g, '-').replace(/[<>≤≥]\s*/g, ''); let m;
  const o = {};
  { const mn = /\+?\s*(\d+(?:[.,]\d+)?)\s*°?\s*C\s*min\b/i.exec(s), mx = /\+?\s*(\d+(?:[.,]\d+)?)\s*°?\s*C\s*max\b/i.exec(s); if (mn || mx) { if (mn) o.min = num(mn[1]); if (mx) o.max = num(mx[1]); return o; } }
  if ((m = new RegExp('(?:between\\s*)?\\+?\\s*(\\d+(?:[.,]\\d+)?)\\s*\\u00b0?\\s*C?\\s*(?:-|to|and)\\s*\\+?\\s*(\\d+(?:[.,]\\d+)?)\\s*\\u00b0\\s*C', 'i').exec(s))) { o.min = num(m[1]); o.max = num(m[2]); if (o.min > o.max) return {}; return o; }
  const lo = new RegExp('(?:below|under|less than|lower than|minimum|min\\.?)\\s*(?:application\\s*)?(?:temperature\\s*)?(?:of\\s*)?' + TEMP, 'i').exec(s);
  const hi = new RegExp('(?:above|over|greater than|higher than|exceed\\w*|maximum|max\\.?)\\s*(?:application\\s*)?(?:temperature\\s*)?(?:of\\s*)?' + TEMP, 'i').exec(s);
  if (lo) o.min = num(lo[1]); if (hi) o.max = num(hi[1]);
  return o;
}
const tempTitle = (t) => (/substrate temperature|surface temperature/i.test(t) ? 'temp_sub' : /ambient air temperature|application temperature|air temperature|material temperature|temperature range/i.test(t) ? 'temp_air' : null);
export function extractTemps(c) {
  const out = []; const title = c.t || '';
  const tt = tempTitle(title);
  if (tt) {
    const rows = rowsOf(c);
    if (rows.length) { const o = {}; for (const r of rows) { const lab = (r[0] || '').toLowerCase(); const v = parseTempRange(r.slice(1).join(' ')) ; const t = new RegExp(TEMP, 'i').exec(r.slice(1).join(' ')); if (/max/.test(lab) && t) o.max = num(t[1]); else if (/min/.test(lab) && t) o.min = num(t[1]); }
      if (o.min != null || o.max != null) out.push({ kind: tt, ...o, q: clip(rows.map((r) => r.join(' | ')).join('; ')) }); }
    for (const l of clauseLines(c)) { if ((c.tb || []).some((r) => r.join(' | ') === l)) continue; if (/dew point/i.test(l) && !/°/.test(l.replace(/dew point/gi, ''))) continue; const r = parseTempRange(l.replace(/,?\s*min\.?\s*\+?\d+\s*°\s*C\s*above dew point.*$/i, '')); if (r.min != null || r.max != null) { out.push({ kind: tt, ...r, q: clip(l) }); break; } }
  }
  if (/limitations|conditions stated|important|application\b|characteristics|substrate (quality|prep)|^application/i.test(title) || tt) {
    for (const l of clauseLines(c)) {
      for (const sn of sentences(l)) {
        if (!/°\s*C/.test(norm(sn))) continue;
        if (!/\b(do not|don't|must not|not (be )?(use|used|apply|applied|recommended)|use in temperatures?|apply (at|in) temperatures?|temperatures? (must|should|of)|between)\b|compr[io]m+is+ed?/i.test(sn)) continue;
        if (/dew point/i.test(sn) || /\b(wet down|hot,? windy)\b/i.test(sn)) continue;
        if (!/temperature|\bdo not (use|apply)\b|\bbelow\b|\babove\b|\bbetween\b/i.test(sn)) continue;
        if (/\b(adhesive temperature|cartridge|material temperature must)\b/i.test(sn) && !/\b(do not|between)\b/i.test(sn)) continue;
        if (/substrate temperature/i.test(sn) && !tt) { const r = parseTempRange(sn); if (r.min != null || r.max != null) out.push({ kind: 'temp_sub', ...r, q: clip(sn) }); continue; }
        const r = parseTempRange(sn); if (r.min == null && r.max == null) continue;
        out.push({ kind: /substrate|surface/i.test(sn) && !/air|ambient/i.test(sn) ? 'temp_sub' : 'temp_air', ...r, q: clip(sn) });
      }
    }
  }
  return dedupe(out, (x) => x.kind + '|' + x.min + '|' + x.max);
}
export function extractHumidity(c) {
  const out = []; const title = c.t || ''; const titleHum = /humidity/i.test(title);
  if (!titleHum && !/application data|conditions|limitations|properties|climatic|ambient/i.test(title)) return out;
  for (const l of clauseLines(c)) {
    if (!/humidity|r\.?\s?h\.?\b/i.test(l) && !titleHum) continue;
    if (/measure|taken at|determined|tested at|laboratory|values are|specifications vary|based on/i.test(l)) continue;
    if (!titleHum && /(concrete|subfloor|substrate|slab|screed|moisture content)/i.test(l)) continue;
    if (l.length > 220) continue;
    const m = new RegExp(NUM + '\\s*%\\s*(?:r\\.?\\s?h\\.?|relative humidity)?\\s*max|(?:up to|not exceed\\w*|below|less than|under|<|no more than|max\\w*\\.?)\\s*' + NUM + '\\s*%', 'i').exec(l); // the first limit in the line
    if (m) out.push({ kind: 'humidity', max: num(m[1] != null ? m[1] : m[2]), q: clip(l) });
  }
  return dedupe(out, (x) => x.max);
}
export function extractMoisture(c) {
  const out = []; const title = c.t || '';
  for (const l of clauseLines(c)) {
    let m;
    if (/substrate moisture content/i.test(title) && (m = new RegExp('(?:<|up to|max(?:imum)?\\.?|not more than|no more than)\\s*' + NUM + '\\s*%|' + NUM + '\\s*%\\s*max', 'i').exec(l))) out.push({ kind: 'moisture', max: num(m[1] != null ? m[1] : m[2]), unit: '%', q: clip(l) });
    else if ((m = new RegExp('(?:greater than|more than|above|exceed\\w*|>)\\s*' + NUM + '\\s*%\\s*(?:relative humn?idity|r\\.?h\\.?)', 'i').exec(l)) && /moisture|damp|rising/i.test(l)) out.push({ kind: 'moisture', over: num(m[1]), unit: '%RH', q: clip(l) });
    else if ((m = new RegExp('(?:RH|relative humidity)\\s*(?:>|greater than|above)\\s*' + NUM + '\\s*%', 'i').exec(l))) out.push({ kind: 'moisture', over: num(m[1]), unit: '%RH', q: clip(l) });
  }
  return dedupe(out, (x) => x.max + '|' + x.over);
}
export function extractDew(c) {
  const out = [];
  for (const l of clauseLines(c)) for (const sn of sentences(l)) {
    const m = new RegExp('(?:min\\.?|minimum|at least|must be|be)?\\s*\\+?' + NUM + '\\s*\\u00b0\\s*C\\s*above\\s*(?:the\\s*)?dew point', 'i').exec(sn);
    if (m) out.push({ kind: 'dew', margin: num(m[1]), q: clip(sn) });
  }
  return dedupe(out, (x) => x.margin);
}

// ------------------------------------------------------------------ thickness, mixing, shelf life
export function extractThickness(c) {
  const out = []; const title = c.t || '';
  if (!/layer thickness|thickness|dry film|yield/i.test(title) && !/application data/i.test(title)) return out;
  for (const l of clauseLines(c)) {
    if (!/thick|dry film|layer/i.test(l)) continue;
    const mm = /(\d+(?:[.,]\d+)?)\s*mm/gi; const v = [...l.matchAll(mm)].map((m) => num(m[1]));
    if (!v.length) continue;
    const o = { kind: 'layer', q: clip(l) };
    if (/no greater than|maximum|max\.?|not exceed|up to/i.test(l) && !/minimum|min\.?/i.test(l)) o.max = Math.max(...v);
    else if (/minimum|min\.?/i.test(l) && /maximum|max\.?/i.test(l)) { o.min = Math.min(...v); o.max = Math.max(...v); }
    else if (/minimum|min\.?|at least/i.test(l)) o.min = Math.min(...v);
    else if (v.length >= 2) { o.min = Math.min(...v); o.max = Math.max(...v); }
    else o.nominal = v[0];
    if (/dry film/i.test(l)) o.dry = true;
    out.push(o);
  }
  for (const r of rowsOf(c)) { const h = (c.tb || [])[0] || []; if (/minimum/i.test(h.join(' ')) && /maximum/i.test(h.join(' ')) && r !== h) { const v = r.join(' ').match(/\d+(?:[.,]\d+)?\s*mm/gi); if (v && v.length === 2) out.push({ kind: 'layer', min: num(v[0]), max: num(v[1]), q: clip(r.join(' | ')) }); } }
  return dedupe(out, (x) => x.min + '|' + x.max + '|' + x.nominal);
}
export function extractMix(c) {
  const out = [];
  if (!/mixing ratio|application data|mixing\b|dilution/i.test(c.t || '')) return out;
  for (const l of clauseLines(c)) if (/^mixing ratio\s*[:\-]/i.test(l) || (/mixing ratio/i.test(c.t || '') && /litre|\bL\b|kg|parts?/i.test(l) && /\d/.test(l))) out.push({ kind: 'mix', nums: [...l.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => num(m[0])), q: clip(l) });
  return out;
}
export function extractShelf(c) {
  const out = [];
  for (const l of clauseLines(c)) { const m = new RegExp('shelf life\\s*[:\\-]?\\s*(?:of\\s*)?(?:[^|]*?)' + NUM + '\\s*(?:' + DASH + '\\s*' + NUM + ')?\\s*months?', 'i').exec(l) || new RegExp('has a shelf life of\\s*' + NUM + '\\s*months?', 'i').exec(l); if (m) out.push({ kind: 'shelf', months: num(m[2] != null ? m[2] : m[1]), q: clip(l) }); }
  if (!out.length && /shelf life/i.test(c.t || '')) for (const r of rowsOf(c)) { const m = new RegExp(NUM + '\\s*months?', 'i').exec(r.join(' ')); if (m) out.push({ kind: 'shelf', months: num(m[1]), q: clip(r.join(' | ')) }); }
  return dedupe(out, (x) => x.months + x.q.slice(0, 20));
}

// ------------------------------------------------------------------ standards, joints, substrate age, primers, limits
const STD_RX = /\b(AS\/NZS?|AS\/NZ|AS ISO|AS|ISO|EN ISO|EN|ASTM|BS|SCAQMD method|CQP)\s?([A-Z]?\d[\d.]*(?:[-:]\d{2,4})?(?:\+A1:\d{4})?)/g;
/** the standards a clause names, exactly as written ("AS3958.1", "AS 4858:2004") */
export function standardsIn(text) {
  const out = []; const s = norm(text);
  for (const m of s.matchAll(STD_RX)) { const name = m[0].replace(/[.,;:]+$/, ''); if (!/\d/.test(name)) continue; out.push(name); }
  return [...new Set(out)];
}
export function extractStandards(c) {
  const out = [];
  if (/standards and test methods cited/i.test(c.t || '')) {
    for (const s of c.s || []) { const m = /^(.+?):\s+((?:cited|referred to|listed under|stated|named)[^.]*)\.\s*(?:Where:\s*(.*))?$/.exec(norm(s)); if (m) { const pg = /\(p\.(\d+)\)/.exec(m[3] || ''); out.push({ kind: 'std', name: m[1], how: m[2], where: clip(m[3] || '', 120), page: pg ? Number(pg[1]) : null, q: clip(s) }); } }
    return out;
  }
  return out;
}
const JOINT_RX = /movement joints?|expansion joints?|control joints?|construction joints?|bond[- ]?break\w*|backing (?:rod|material)|perimeter joints?|(?:cracks?|joints?) (?:subject to|moving)|dynamic cracks?/i;
export function extractJoints(c) {
  const out = []; const seen = new Set();
  if (/safety|hazard|standards and test|approvals/i.test(c.t || '')) return out;
  for (const l of clauseLines(c)) for (const sn of sentences(l)) {
    if (!JOINT_RX.test(sn) || sn.length < 25) continue;
    const tags = [];
    if (/movement joints?|expansion joints?|control joints?|construction joints?/i.test(sn)) tags.push('movement_joint');
    if (/bond[- ]?break/i.test(sn)) tags.push('bond_breaker');
    if (/backing (rod|material)/i.test(sn)) tags.push('backing');
    if (/perimeter/i.test(sn)) tags.push('perimeter');
    if (/crack/i.test(sn)) tags.push('crack');
    const q = clip(sn); if (seen.has(q)) continue; seen.add(q); out.push({ kind: 'joint', tags, q });
  }
  return out;
}
const AGE_SUB = [['concrete', /concrete|slab/i], ['screed', /screed/i], ['render', /render/i], ['masonry', /brick|block/i]];
const ageUnitless = (text) => { const m = new RegExp('(?:cure[ds]?|curing)\\s*(?:for)?\\s*(\\d+(?:\\s*-\\s*\\d+)?)\\s*(?:\\.|$|\\(|,)', 'i').exec(text); return m ? { hours: null, unitless: m[1].replace(/\s+/g, '') } : null; };
const ageOf = (text) => { const m = new RegExp('(?:cure[ds]?|cured)\\s*(?:for|a)?\\s*(?:a\\s*)?(?:min(?:imum)?\\.?\\s*(?:of\\s*)?)?(?:at least\\s*)?' + NUM + '\\s*(hours?|days?|weeks?)', 'i').exec(text) || new RegExp('(?:min(?:imum)?\\.?\\s*)' + NUM + '\\s*(hours?|days?|weeks?)\\s*cur', 'i').exec(text); return m ? { hours: round(num(m[1]) * HOURS[m[2].toLowerCase()]), index: m.index } : null; };
/** how long a new substrate must cure before this product goes on: "Concrete - wood float finish | Cured a min 6 weeks | Prime with ..." and "slabs must ... be allowed to cure for 6 weeks" */
export function extractAges(c) {
  const out = [];
  for (const l of clauseLines(c)) {
    for (const sn of (l.includes(' | ') ? [l] : sentences(l))) {
      if (!/cure[ds]?\b/i.test(sn) || /curing (compound|agent)|cure technology|cure silicone|neutral cure|cure time|curing time/i.test(sn)) continue;
      const a = ageOf(sn) || ageUnitless(sn); if (!a) continue;
      const head = sn.split(' | ')[0];
      // in a sentence, the surface named just before "cured for N" is the one the figure belongs to ("fully cured concrete, screed (cured for 7 days)" is the screed)
      const near = (!sn.includes(' | ') && a.index != null) ? AGE_SUB.map(([id, rx]) => { const w = sn.slice(Math.max(0, a.index - 40), a.index); let last = -1; for (const mm of w.matchAll(new RegExp(rx.source, 'gi'))) last = mm.index; return [id, last]; }).filter(([, i]) => i >= 0).sort((x, y) => y[1] - x[1])[0] : null;
      const sub = (near ? near[0] : (AGE_SUB.find(([, rx]) => rx.test(head)) || AGE_SUB.find(([, rx]) => rx.test(sn)) || [null])[0]); if (!sub) continue;
      const o = { kind: 'age', sub, hours: a.hours, q: clip(sn) }; if (a.unitless) o.unitless = a.unitless;
      if (/steel trowel|power float|smooth/i.test(sn)) o.finish = 'steel'; else if (/wood float|rough/i.test(sn)) o.finish = 'wood';
      const pr = /prime with ([^|]+)$/i.exec(sn); if (pr) o.primer = clip(pr[1], 80);
      out.push(o);
    }
  }
  return dedupe(out, (x) => x.sub + '|' + x.hours + '|' + (x.unitless || '') + '|' + (x.finish || ''));
}
export function extractPrimers(c) {
  const out = [];
  for (const l of clauseLines(c)) {
    const cells = l.split(' | ');
    if (cells.length >= 2 && /prime|primer|ultraprime|primex|prep n prime|moisture seal/i.test(cells[cells.length - 1]) && cells[0].length < 120) out.push({ kind: 'primer', sub: clip(cells[0], 90), primer: clip(cells[cells.length - 1], 120), q: clip(l) });
  }
  return dedupe(out, (x) => x.q);
}
export const TAGS = {
  substrate: [['timber', /timber|plywood|particle ?board|chipboard|wood(?!\s*float)\b|floorboards/i], ['plasterboard', /plasterboard|gypsum|drywall/i], ['existing_tiles', /existing (ceramic )?tiles?|tile over tile|over tiles/i], ['concrete', /concrete|slab/i], ['screed', /screed/i], ['render', /render/i], ['aac', /\baac\b|autoclaved/i], ['cement_board', /cement (sheet|board)|fibre cement|compressed/i], ['metal', /\bmetal|\bsteel\b|aluminium/i], ['paint', /painted|paint\b|coating/i]],
  env: [['external', /external|exterior|outdoor|outside|balcon|deck|terrace|facade/i], ['wet', /wet area|shower|bathroom|laundry/i], ['pool', /\bpools?\b|\bspas?\b|submerged|immersion|water feature/i], ['floor', /\bfloors?\b/i], ['wall', /\bwalls?\b/i], ['internal', /internal|interior|indoor/i]],
  tile: [['porcelain', /porcelain/i], ['stone', /natural stone|marble|granite|slate/i], ['msstone', /moisture sensitive|green marble|resin backed/i], ['glass', /glass/i], ['mosaic', /mosaic/i], ['large', /large format|\b[6-9]\d{2}\s*mm\s*x\s*[6-9]\d{2}|greater than 600/i]],
  cond: [['hydrostatic', /hydrostatic|rising damp/i], ['traffic', /vehicular|forklift|heavy traffic|wearing surface/i], ['uv', /\buv\b|exposed/i], ['frost', /frost|freez/i], ['chemical', /chemical|acid/i], ['moving', /movement|flex|deflect/i], ['heated', /under ?floor heating|heated/i]],
};
export const tagsOf = (text) => { const o = {}; for (const [dim, list] of Object.entries(TAGS)) { const t = list.filter(([, rx]) => rx.test(text)).map(([id]) => id); if (t.length) o[dim] = t; } return o; };
const LIMIT_RX = /^(?:do not|don't|never|must not|shall not|not (?:suitable|recommended|designed|intended|for use|to be used|approved)|avoid)\b|\b(?:is|are) not (?:suitable|recommended|designed|intended)\b|\bnot suitable (?:for|on|over|in)\b|\bnot for use\b|\bdo not (?:use|apply|install|tile)\b|\bmust not be used\b/i;
export const isLimit = (sn) => LIMIT_RX.test(norm(sn));
/** hard limits ("Do not use ...", "not suitable for ...") with the substrate, environment, tile and condition words they name */
export function extractLimits(c) {
  const out = []; const seen = new Set();
  if (!/limit|important|consider|uses|intended|note|application|substrate|characteristics|conditions|description/i.test(c.t || '')) return out;
  for (const l of clauseLines(c)) for (const sn of sentences(l)) {
    if (!LIMIT_RX.test(sn) || sn.length < 18) continue;
    const q = clip(sn); if (seen.has(q)) continue; seen.add(q);
    const t = tagsOf(sn); if (!Object.keys(t).length) continue;
    const o = { kind: 'no', tags: t, q };
    const sz = new RegExp('(?:greater|larger|bigger) than\\s*' + NUM + '\\s*(?:mm)?\\s*x\\s*' + NUM, 'i').exec(sn); if (sz) o.size = num(sz[1]);
    const hh = new RegExp('(?:above|over|higher than)\\s*' + NUM + '\\s*(?:m\\b|met(?:er|re)s?)', 'i').exec(sn); if (hh) o.height = num(hh[1]);
    out.push(o);
  }
  return out;
}
export function extractPrep(c) {
  const out = [];
  if (!/substrate (quality|prep)|surface prep|substrate condition/i.test(c.t || '')) return out;
  for (const l of clauseLines(c)) for (const sn of sentences(l)) {
    if (!/\b(must|shall|should|ensure|required|clean|dry|sound)\b/i.test(sn) || sn.length < 30) continue;
    const tags = [];
    if (/\bdry\b/i.test(sn)) tags.push('dry'); if (/clean|free from|free of/i.test(sn)) tags.push('clean'); if (/sound|structurally/i.test(sn)) tags.push('sound');
    if (/deflection|L\/\d{3}/.test(sn)) tags.push('deflection'); if (/fall|slope/i.test(sn)) tags.push('falls'); if (/even and true|flat/i.test(sn)) tags.push('flat'); if (/crack/i.test(sn)) tags.push('crack');
    if (!tags.length) continue; out.push({ kind: 'prep', tags, q: clip(sn) });
  }
  return out;
}
/** "large format tiles greater than 600mm x 600mm, substrates shall be even and true to 1..." -> { side: 600 } */
export function extractLargeFormat(c) {
  const out = [];
  for (const l of clauseLines(c)) for (const sn of sentences(l)) {
    const m = new RegExp('large format[^.]{0,60}?(?:greater than|larger than|over|exceed\\w*|>)\\s*' + NUM + '\\s*mm\\s*x\\s*' + NUM + '\\s*mm', 'i').exec(sn);
    if (m) out.push({ kind: 'lf', side: num(m[1]), side2: num(m[2]), flat: /even and true/i.test(sn), q: clip(sn) });
  }
  return out;
}
const WORDNUM = { one: 1, two: 2, three: 3, four: 4 };
/** "applied in a minimum 2 coat application" -> { min: 2 } ; "two coats" */
export function extractCoats(c) {
  const out = [];
  if (!/consumption|application|trials|thickness|characteristics|product description|properties/i.test(c.t || '')) return out;
  for (const l of clauseLines(c)) for (const sn of sentences(l)) {
    const m = /minimum (?:of )?(\d|one|two|three|four)[- ]coats?|minimum (\d|two|three)[- ]coat|(?:applied|application)[^.]{0,40}\bin (?:a )?(?:minimum )?(\d|two|three)[- ]coat|at least (\d|two|three) coats?/i.exec(sn);
    if (m) { const raw = (m[1] || m[2] || m[3] || m[4]).toLowerCase(); const n = WORDNUM[raw] || Number(raw); if (n >= 1 && n <= 6) out.push({ kind: 'coats', min: n, q: clip(sn) }); }
  }
  return dedupe(out, (x) => x.min);
}
/** the sheet's own sentence that lower temperatures lengthen the waits */
export function extractTempNote(c) {
  const out = [];
  if (!/ready for use|waiting time|curing|drying|setting|applied product|limitations|application data/i.test(c.t || '')) return out;
  for (const l of clauseLines(c)) for (const sn of sentences(l)) if (/\b(lower|low|cool|cold|cooler)\b[^.]*\b(temperatures?|climates?|conditions)\b[^.]*\b(increase|extend|longer|slower|prolong)\w*|\b(increase|extend|longer|prolong)\w*[^.]*\b(cool|cold|lower)\b/i.test(sn) && sn.length > 30) out.push({ kind: 'tempnote', q: clip(sn) });
  return dedupe(out, (x) => x.q);
}
/** "must be coated within 24 hours, otherwise ... re-primed" -> { hours: 24 } : how long a primed or prepared surface may stand before the next layer */
export function extractMaxOpen(c) {
  const out = [];
  if (!/application|limitations|substrate|primer|priming/i.test(c.t || '')) return out;
  for (const l of clauseLines(c)) for (const sn of sentences(l)) {
    const m = new RegExp('(?:within|more than|longer than|no later than|cannot be overcoated within)\\s*' + NUM + '\\s*' + UNITRX, 'i').exec(sn);
    if (m && /(coated|overcoat\w*|covered|uncovered|re-?prim\w*|tiling|waterproof\w*)/i.test(sn) && /(prim|uncovered|re-?clean)/i.test(sn)) out.push({ kind: 'maxopen', hours: round(num(m[1]) * HOURS[m[2].toLowerCase()]), q: clip(sn) });
  }
  return dedupe(out, (x) => x.hours);
}
const dedupe = (list, key) => { const s = new Set(); return list.filter((x) => { const k = key(x); if (s.has(k)) return false; s.add(k); return true; }); };

/** every rule of one product spec (data/specs/<id>.json). Returns { id, name, brand, url, edition, rules:[{ k, v, q, c, p }] } with v = the extracted values */
export function extractProduct(spec) {
  const rules = []; const add = (k, o, c) => { const { q, kind, ...v } = o; rules.push({ k, v, q, c: c.no, p: c.p != null ? c.p : (pageOf(c) || null), t: c.t }); };
  for (const s of spec.sections || []) for (const c of s.cl) {
    if (c.k === 'refer' || c.k === 'site') continue;
    for (const w of extractWaits(c)) { const { q, ...v } = w; rules.push({ k: 'wait', v, q, c: c.no, p: pg(c), t: c.t }); }
    for (const w of extractWorkTimes(c)) add(w.kind, w, c);
    for (const o of extractTemps(c)) add(o.kind, o, c);
    for (const o of extractHumidity(c)) add('humidity', o, c);
    for (const o of extractMoisture(c)) add('moisture', o, c);
    for (const o of extractDew(c)) add('dew', o, c);
    for (const o of extractThickness(c)) add('layer', o, c);
    for (const o of extractMix(c)) add('mix', o, c);
    for (const o of extractShelf(c)) add('shelf', o, c);
    for (const o of extractStandards(c)) { const { q, kind, ...v } = o; rules.push({ k: 'std', v, q, c: c.no, p: o.page || pg(c), t: c.t }); }
    for (const o of extractJoints(c)) add('joint', o, c);
    for (const o of extractAges(c)) add('age', o, c);
    for (const o of extractPrimers(c)) add('primer', o, c);
    for (const o of extractLimits(c)) add('no', o, c);
    for (const o of extractPrep(c)) add('prep', o, c);
    for (const o of extractLargeFormat(c)) add('lf', o, c);
    for (const o of extractCoats(c)) add('coats', o, c);
    for (const o of extractMaxOpen(c)) add('maxopen', o, c);
    for (const o of extractTempNote(c)) add('tempnote', o, c);
  }
  const seen = new Set(); const uniq = rules.filter((r) => { const key = r.k + '|' + JSON.stringify(r.v) + (r.k === 'wait' ? '' : '|' + r.q); if (seen.has(key)) return false; seen.add(key); return true; });
  return { id: spec.id, name: spec.name, brand: spec.brand, url: spec.ds && spec.ds.url, edition: spec.ds && spec.ds.edition, rules: uniq };
}
const pageOf = (c) => { const m = /pages? (\d+)/i.exec(c.c || ''); return m ? Number(m[1]) : null; };
const pg = (c) => (c.p != null ? c.p : pageOf(c));
