// rates.js: parse consumption / yield / dosage text and pack sizes from a product's own published text. Never invents a rate.

const NUM = '\\d+(?:\\.\\d+)?';
const RNG = `(${NUM})(?:\\s*(?:ml|mls|l|ltr|litres?|kg|g|%|m2)?\\s*(?:-|to|and)\\s*(${NUM}))?`;
const UNIT = '(kg|g|gr|gram|grams|l|lt|ltr|litre|litres|liter|liters|ml|mls)';

/** Clean text for parsing: decimal commas, dashes, symbols. */
export function clean(text) {
  return String(text || '').replace(/®|™/g, '').replace(/[\u2013\u2014\u2212]/g, '-').replace(/×/g, 'x').replace(/²/g, '2').replace(/³/g, '3')
    .replace(/ | /g, ' ').replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2').replace(/\b(\d{1,3}) (\d{3})(?!\d)/g, '$1$2').replace(/~/g, ' ').replace(/[ \t]+/g, ' ');
}

/** Canonical unit: kg | g | L | ml. */
export function canonUnit(u) {
  u = String(u).toLowerCase();
  if (/^(kg)$/.test(u)) return 'kg';
  if (/^(g|gr|gram|grams)$/.test(u)) return 'g';
  if (/^(ml|mls)$/.test(u)) return 'ml';
  return 'L';
}

/** Convert an amount between compatible units; returns null when kg and L are mixed. */
export function convert(v, from, to) {
  if (from === to) return v;
  if (from === 'kg' && to === 'g') return v * 1000;
  if (from === 'g' && to === 'kg') return v / 1000;
  if (from === 'L' && to === 'ml') return v * 1000;
  if (from === 'ml' && to === 'L') return v / 1000;
  return null;
}

function basisFrom(after, label) {
  const m = /(based on[^.)\n|]{3,70}|with an? [^.)\n|]{0,25}trowel[^.)\n|]{0,15}|per (?:coat|layer)|\/coat|on (?:timber|steel|concrete|porous[^.)\n|]{0,20})|@ ?\d+ ?mm[^.)\n|]{0,15})/i.exec(after);
  const parts = [];
  if (label) parts.push(label);
  if (m) parts.push(m[1].trim().replace(/^\//, 'per ').replace(/\s+/g, ' '));
  return parts.join(', ');
}

function mk(o) { return Object.assign({ kind: '', unit: '', low: null, high: null, perMm: false, perLayer: false, basis: '', raw: '' }, o); }

/** Parse a Consumption/Yield/Dosage text into rate objects. Kinds: per_area, area_per_pack, per_m3, per_100kg, pct_binder, joint_table, grout_table, linear_per_pack. */
export function parseRates(text, label = '') {
  const out = [];
  const src = clean(text);
  const lines = src.split(/\n+/);
  // tables first
  const joint = parseJointTable(lines); if (joint) out.push(joint);
  const grout = parseGroutTable(lines); if (grout) out.push(grout);
  const inTable = (l) => (l.match(/\|/g) || []).length >= 2;
  for (let li = 0; li < lines.length; li++) {
    let line = lines[li];
    if (joint && /joint (length|width)/i.test(line)) continue;
    const cells = line.split('|').map(s => s.trim());
    const ctx = line.includes('|') && cells.length >= 2 && cells[0].length <= 90 && !/\d\s*(kg|g|l|ml)\b/i.test(cells[0]) ? cells[0] : '';
    const seg = line;
    const used = [];
    const take = (re, fn) => {
      const r = new RegExp(re, 'gi'); let m;
      while ((m = r.exec(seg))) {
        const s = m.index, e = s + m[0].length;
        if (used.some(([a, b]) => s < b && e > a)) continue;
        const item = fn(m, seg.slice(e));
        if (item && item.kind === 'per_area' && !item.basis) {
          const prev = used.reduce((mx, [, b]) => (b <= s && b > mx ? b : mx), 0);
          const lead = seg.slice(prev, s).split(/[.;](?:\s|$)/).pop().replace(/[|:]+/g, ' ').replace(/\s+/g, ' ').trim();
          if (lead.length >= 3 && lead.length <= 60 && !/^\W*$/.test(lead) && !/^(approx\w*\.?|about|around|typically|generally|average|averag\w+|up to|normally|usually|total|and|or|is|are|of|per)$/i.test(lead)) item.basis = lead;
        }
        if (item) { used.push([s, e]); item.raw = m[0].trim(); out.push(item); }
      }
    };
    const lo = (a, b) => parseFloat(a), hi = (a, b) => parseFloat(b || a);
    // P5 yield: 12 L - 4m2 @ 3mm  /  12 litre per bag (4m2 @ 3mm)
    take(`(${NUM})\\s*${UNIT}\\b[^0-9@]{0,25}?(${NUM})\\s*m2\\s*@\\s*(${NUM})\\s*mm`, (m, aft) => {
      const V = parseFloat(m[1]), u = canonUnit(m[2]), A = parseFloat(m[3]), t = parseFloat(m[4]);
      if (!A || !t) return null;
      const v = V / (A * t);
      return mk({ kind: 'per_area', unit: u, low: v, high: v, perMm: true, basis: basisFrom(aft, ctx) || `yield ${V} ${u} covers ${A} m2 at ${t} mm`, yieldPerPack: { amount: V, unit: u } });
    });
    // P4 per m2 per mm / per cm thick per m2
    take(`${RNG}\\s*${UNIT}\\s*(?:of\\s+[a-z ]{0,20}?)?per\\s*m2\\s*per\\s*(mm|cm)`, (m, aft) => perThick(m[1], m[2], m[3], m[4], aft, ctx));
    take(`${RNG}\\s*${UNIT}\\s*(?:of\\s+[a-z ]{0,20}?)?per\\s*(mm|cm)\\s*(?:thick(?:ness)?\\s*)?per\\s*m2`, (m, aft) => perThick(m[1], m[2], m[3], m[4], aft, ctx));
    // fill: 1 l can fill 1 m2 per mm thick
    take(`(${NUM})\\s*${UNIT}\\b[^.|]{0,40}?fill\\s*(${NUM})\\s*m2\\s*per\\s*mm`, (m) => { const v = parseFloat(m[1]) / parseFloat(m[3]); return mk({ kind: 'per_area', unit: canonUnit(m[2]), low: v, high: v, perMm: true, basis: ctx }); });
    // P1 amount covers area
    take(`${RNG}\\s*${UNIT}\\b[^.|]{0,60}?\\b(?:covers?|will cover|yields?)\\b[^0-9.|]{0,25}?${RNG}\\s*m2`, (m, aft) => {
      const X = parseFloat(m[1]), u = canonUnit(m[3]); const a1 = parseFloat(m[4]), a2 = parseFloat(m[5] || m[4]);
      if (m[2]) return null;
      return mk({ kind: 'per_area', unit: u, low: X / Math.max(a1, a2), high: X / Math.min(a1, a2), basis: basisFrom(aft, ctx) });
    });
    // P3 amount per m2 (optional per mm/cm/coat/layer)
    take(`${RNG}\\s*${UNIT}\\s*(?:/|per|\\s)\\s*m2(?:\\s*(?:/|per)\\s*(mm|cm|coat|layer))?`, (m, aft) => {
      const u = canonUnit(m[3]); let l = parseFloat(m[1]), h = parseFloat(m[2] || m[1]); const per = (m[4] || '').toLowerCase();
      let perMm = false;
      if (per === 'mm') perMm = true; else if (per === 'cm') { perMm = true; l /= 10; h /= 10; }
      const mult = /(\d+(?:\.\d+)?)(?:\s*-\s*(\d+))?\s*x\s*$/i.exec(seg.slice(0, m.index));
      return mk({ kind: 'per_area', unit: u, low: l, high: h, perMm, perLayer: per === 'coat' || per === 'layer' || /^\s*(?:per|\/)\s*(coat|layer)/i.test(aft) || /per (coat|layer)/i.test(aft.slice(0, 14)),
        basis: [ctx, mult ? `${mult[1]}${mult[2] ? ' to ' + mult[2] : ''} coats` : '', basisFrom(aft, '')].filter(Boolean).join(', ') });
    });
    // unit per area, e.g. 1 litre/4m2
    take(`(${NUM})\\s*(l|lt|ltr|litre|liter|kg)\\s*(?:/|per)\\s*${RNG}\\s*m2`, (m, aft) => {
      const X = parseFloat(m[1]), a1 = parseFloat(m[3]), a2 = parseFloat(m[4] || m[3]);
      return mk({ kind: 'per_area', unit: canonUnit(m[2]), low: X / Math.max(a1, a2), high: X / Math.min(a1, a2), basis: basisFrom(aft, ctx) });
    });
    // area per stated pack, e.g. 7.5m2 per 15L pail
    take(`${RNG}\\s*m2\\s*per\\s*(${NUM})\\s*${UNIT}\\b`, (m, aft) => {
      const a1 = parseFloat(m[1]), a2 = parseFloat(m[2] || m[1]), X = parseFloat(m[3]);
      return mk({ kind: 'per_area', unit: canonUnit(m[4]), low: X / a2, high: X / a1, basis: basisFrom(aft, ctx) });
    });
    // P2 area per unit
    take(`${RNG}\\s*m2\\s*(?:/|per|\\s)\\s*(?:an?\\s+|mixed\\s+)*(l|lt|ltr|litre|liter|kg|bag|pail|cartridge|can|kit|unit)\\b`, (m, aft) => {
      const a1 = parseFloat(m[1]), a2 = parseFloat(m[2] || m[1]); const w = m[3].toLowerCase();
      const b = basisFrom(aft, ctx) || (/\/\s*coat/i.test(aft.slice(0, 8)) ? 'per coat' : '');
      if (/^(l|lt|ltr|litre|liter|kg)$/.test(w)) return mk({ kind: 'per_area', unit: canonUnit(w), low: 1 / Math.max(a1, a2), high: 1 / Math.min(a1, a2), basis: b, perLayer: /coat/i.test(aft.slice(0, 12)) || /coat/i.test(b) });
      return mk({ kind: 'area_per_pack', pack: w, low: a1, high: a2, basis: b });
    });
    // P6 per m3 of concrete
    take(`${RNG}\\s*(kg|g|l|ml|mls|litres?|ltr|bags?|pieces?)\\s*(?:/|per)\\s*(?:m3|cubic)`, (m) => {
      const w = m[3].toLowerCase(); const unit = /^bags?$/.test(w) ? 'bag' : /^pieces?$/.test(w) ? 'piece' : canonUnit(w);
      return mk({ kind: 'per_m3', unit, low: parseFloat(m[1]), high: parseFloat(m[2] || m[1]), basis: ctx || 'per cubic metre of concrete' });
    });
    take(`${RNG}\\s*(?:to|and)?\\s*(${NUM})?\\s*(?:litres?|l|ltr)\\s*(?:/|per)\\s*(?:m3|cubic)`, () => null);
    // P7 per 100 kg cementitious
    take(`${RNG}\\s*(ml|mls|l|litres?|kg|g)\\s*(?:/|per)\\s*100\\s*kg`, (m) =>
      mk({ kind: 'per_100kg', unit: canonUnit(m[3]), low: parseFloat(m[1]), high: parseFloat(m[2] || m[1]), basis: 'per 100 kg of cementitious material' }));
    take(`${RNG}\\s*%\\s*(?:by\\s+weight\\s+of|of)\\s+(?:total\\s+)?(binder|cement\\w*)`, (m) =>
      mk({ kind: 'pct_binder', unit: '%', low: parseFloat(m[1]), high: parseFloat(m[2] || m[1]), basis: 'by weight of ' + m[3] }));
    // linear metres per pack from bead
    take(`(${NUM})\\s*(?:linear\\s*)?(?:m|metres?|meters?)\\b[^.|]{0,30}?bead`, (m, aft) => mk({ kind: 'linear_per_pack', low: parseFloat(m[1]), high: parseFloat(m[1]), basis: (/^[^.]{0,60}/.exec(m[0] + aft) || [''])[0].trim() }));
  }
  return out;
}

function perThick(a, b, u, per, aft, ctx) {
  let l = parseFloat(a), h = parseFloat(b || a);
  if (per.toLowerCase() === 'cm') { l /= 10; h /= 10; }
  return mk({ kind: 'per_area', unit: canonUnit(u), low: l, high: h, perMm: true, basis: [ctx, basisFrom(aft, '')].filter(Boolean).join(', ') });
}

function numOf(cell) { const m = /(\d+(?:\.\d+)?)/.exec(cell.replace(/,/g, '.')); return m ? parseFloat(m[1]) : null; }

function parseJointTable(lines) {
  const wl = lines.findIndex(l => /^joint width\s*\|/i.test(l)), dl = lines.findIndex(l => /^joint depth\s*\|/i.test(l)), ll = lines.findIndex(l => /^joint length/i.test(l) && l.includes('|'));
  if (wl >= 0 && dl >= 0 && ll >= 0) {
    const W = lines[wl].split('|').slice(1).map(numOf), D = lines[dl].split('|').slice(1).map(numOf), L = lines[ll].split('|').slice(1).map(numOf);
    const rows = W.map((w, i) => ({ width: w, depth: D[i], lengths: [L[i]] })).filter(r => r.lengths[0] != null);
    const pk = /\/\s*(\d+\s*ml)/i.exec(lines[ll]);
    if (rows.length) return mk({ kind: 'joint_table', rows, packs: [pk ? pk[1] : 'pack'], basis: pk ? 'per ' + pk[1] : '', raw: lines[ll] });
  }
  const hi = lines.findIndex(l => /joint/i.test(l) && /length/i.test(l) && l.includes('|'));
  if (hi < 0) return null;
  const head = lines[hi].split('|').map(s => s.trim());
  const wi = head.findIndex(h => /width/i.test(h)), di = head.findIndex(h => /depth/i.test(h));
  const li = head.map((h, i) => (/length/i.test(h) ? i : -1)).filter(i => i >= 0);
  if (!li.length) return null;
  const rows = [];
  for (let i = hi + 1; i < lines.length; i++) {
    const c = lines[i].split('|').map(s => s.trim());
    if (c.length < 2 || !/^\D{0,3}\d/.test(c.join(' ').trim())) continue;
    const lens = li.map(k => numOf(c[k] || '')); const w = wi >= 0 ? numOf(c[wi] || '') : null, d = di >= 0 ? numOf(c[di] || '') : null;
    if (lens.some(x => x == null)) continue;
    rows.push({ width: w, depth: d, lengths: lens });
  }
  if (!rows.length) return null;
  // some tables list width and depth in a different order; the header decides
  const packs = li.map(k => (/per\s+(.+?)(?:\[|\||$)/i.exec(head[k]) || [, head[k]])[1].trim());
  const inline = /per\s+(\d+\s*ml\s*[a-z ]+?)(?:\s*\||$)/i.exec(lines[hi]);
  return mk({ kind: 'joint_table', rows, packs: packs.map(p => p.replace(/\s+/g, ' ')), basis: inline ? 'per ' + inline[1] : '', raw: lines[hi] });
}

function parseGroutTable(lines) {
  const hi = lines.findIndex(l => /tile size/i.test(l) && /joint/i.test(l) && l.includes('|'));
  if (hi < 0) return null;
  const head = lines[hi].split('|').map(s => s.trim());
  const cols = head.slice(1).map(numOf);
  const rows = []; let mode = '';
  for (let i = hi + 1; i < lines.length; i++) {
    const c = lines[i].split('|').map(s => s.trim());
    const vals = c.slice(1);
    if (vals.length < 1 || !/\d/.test(vals.join(''))) continue;
    const m2 = /m2/i.test(vals.join(' ')), kg = /kg/i.test(vals.join(' '));
    if (!m2 && !kg) continue;
    mode = mode || (m2 ? 'area_per_pack' : 'kg_per_m2');
    rows.push({ tile: c[0], values: vals.map(numOf), complete: vals.length === cols.length });
  }
  if (!rows.length) return null;
  const pack = lines.slice(0, hi).map(l => /based on (.+)$/i.exec(l)).find(Boolean);
  return mk({ kind: 'grout_table', mode, cols, rows, pack: pack ? pack[1].trim() : '', basis: pack ? 'based on ' + pack[1].trim() : mode === 'kg_per_m2' ? 'kg per m2 by tile size and joint width' : '', raw: lines[hi] });
}

/** All rates a product publishes, with the label of the section item each came from. */
export function productRates(product) {
  const out = [];
  for (const s of product.sections || []) {
    if (s.title !== 'Consumption') continue;
    for (const it of s.items || []) for (const r of parseRates(it.text, '')) { r.from = it.label; r.text = it.text; out.push(r); }
  }
  return out;
}

const PACK_WORD = /^\s*(?:x\s*)?(pails?|bags?|drums?|cartridges?|kits?|tubs?|bottles?|cans?|containers?|jerry|ibc|sachets?|foil|unipacks?|tubes?|rolls?|buckets?|cases?|boxes|plastic|tins?)/i;

/** Parse pack sizes from packaging text: [{size, unit (kg|g|L|ml), word, label, bulk}]. */
export function parsePacks(packaging) {
  const t = clean(packaging);
  const re = new RegExp(`(${NUM})\\s*${UNIT}\\b`, 'gi');
  const all = []; let m;
  while ((m = re.exec(t))) {
    const size = parseFloat(m[1]), unit = canonUnit(m[2]);
    const before = t.slice(Math.max(0, m.index - 30), m.index), after = t.slice(m.index + m[0].length, m.index + m[0].length + 40);
    let w = PACK_WORD.exec(after); let word = w ? w[1].toLowerCase().replace(/^boxes$/, 'box').replace(/s$/, '') : '';
    if (/^(plastic|jerry|foil)$/.test(word)) { const w2 = /(pail|bag|container|can|pack|drum|bottle|tub)/i.exec(after.slice(0, 25)); word = w2 ? w2[1].toLowerCase() : word === 'jerry' ? 'jerry can' : word === 'foil' ? 'foil pack' : 'pack'; }
    const bulk = /\bibc\b|bulk/i.test(before.slice(-12) + ' ' + after.slice(0, 10)) || ((unit === 'L' && size >= 200) || (unit === 'kg' && size >= 500));
    all.push({ size, unit, word, bulk, idx: m.index, before, after: after.slice(0, 25) });
  }
  let picked = all;
  const ab = []; const abRe = new RegExp(`a\\s*[+&]\\s*b\\W{0,6}(${NUM})\\s*${UNIT}\\b`, 'gi'); let am;
  while ((am = abRe.exec(t))) ab.push(parseFloat(am[1]) + canonUnit(am[2]));
  if (ab.length) picked = all.filter(p => ab.includes(p.size + p.unit));
  else if (/\bkit\b|unipack/i.test(t)) {
    const kit = all.filter(p => /kit|unipack|ready to mix/i.test(p.before.slice(-12) + ' ' + p.after));
    if (kit.length) picked = kit;
  }
  for (let i = picked.length - 1, nxt = ''; i >= 0; i--) { if (picked[i].word) nxt = picked[i].word; else if (nxt) picked[i].word = nxt; }
  const seen = new Set(), out = [];
  let lastWord = '';
  for (const p of picked) {
    if (p.word) lastWord = p.word;
    const word = p.word || 'pack';
    const key = p.size + p.unit + (p.bulk ? 'b' : '');
    if (seen.has(key) || p.size <= 0) continue; seen.add(key);
    const u = p.unit === 'L' ? 'L' : p.unit;
    out.push({ size: p.size, unit: u, word, bulk: p.bulk, label: `${trim(p.size)} ${u} ${word}` });
  }
  return out;
}

function trim(n) { return String(Math.round(n * 1000) / 1000); }
export { trim as fmtNum };
