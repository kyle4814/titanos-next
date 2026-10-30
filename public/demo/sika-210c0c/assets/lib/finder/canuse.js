// "Can I use this on or over...?" verdicts, read from a product's OWN published text. Pure functions, no DOM, no network.
// A verdict is NO (the exclusion sentence is quoted), YES (the positive sentence is quoted) or NOT STATED. No inference beyond the
// sentence, no "probably". "X only" is read as excluding the opposite and the sentence is quoted. A NO beats a YES (the safer reading).

export const CHIPS = [
  ['concrete', 'Concrete'], ['existing-tiles', 'Existing tiles'], ['membrane', 'Waterproofing membrane'], ['plasterboard', 'Plasterboard'],
  ['fibre-cement', 'Fibre cement sheet'], ['timber', 'Timber or plywood'], ['render-brick', 'Render or brick'], ['screed', 'Cement screed'],
  ['heated-floor', 'Heated floor'], ['natural-stone', 'Natural stone'], ['internal', 'Internal'], ['external', 'External'],
];
// every facet the finder can name, in matching order: the longest or most specific first, each match is blanked so a later facet cannot reuse it
const RX = [
  ['moisture-sensitive-stone', /(moisture|water)[ ]sensitive[ ](natural[ ])?(stone|marble|tiles?)s?|(tile|stone)s?([ ]and[ ](tile|stone)s?)?[ ]sensitive[ ]to[ ](moisture|water)|green[ ]marble/g],
  ['existing-tiles', /existing[ ]([a-z]+[ ])?tiles?|tile[ ](on|over)[ ]tile|tiling[ ]over[ ]tiles?|over[ ]tiles/g],
  ['underlay', /(ceramic[ ])?tile[ ]underlay(ment)?/g],
  ['heated-floor', /heated[ ]floors?|under[ ]?floor[ ]heating|in[ ]floor[ ]heating|radiant[ ]heat(ing)?|heated[ ]screeds?/g],
  ['fibre-cement', /fib(re|er)[ ]cement|cement[ ](sheet|board)s?|compressed[ ]sheet/g],
  ['plasterboard', /plaster[ ]?board|gyprock|gypsum[ ]board/g],
  ['timber', /timber|plywood|particle[ ]?board|chip[ ]?board|wooden|\bwood\b/g],
  ['screed', /\bscreeds?\b/g],
  ['render-brick', /\brender(ed|s|ing)?\b|brickwork|blockwork|\bbricks?\b|\bblocks?\b|masonry/g],
  ['aac', /autoclaved[ ]aerated[ ]concrete|\baac\b/g],
  ['concrete', /\bconcrete\b/g],
  ['membrane', /waterproofing[ ]membranes?|\bmembranes?\b|waterproofing[ ]systems?/g],
  ['natural-stone', /natural[ ]stone|\bmarble\b|granite|limestone|travertine|bluestone|sandstone/g],
  ['engineered-stone', /engineered[ ]stone|agglomerate|\bquartz\b/g],
  ['quarry-terracotta', /quarry|terracotta|\bslate\b/g],
  ['large-format', /large[ ]format/g],
  ['mosaic', /mosaics?/g],
  ['glass', /\bglass\b/g],
  ['porcelain', /porcelain/g],
  ['ceramic', /ceramics?/g],
  ['internal', /\b(internal|interior|indoor)(ly)?\b/g],
  ['external', /\b(external|exterior|outdoor)(ly)?\b|balcon(y|ies)|facade/g],
];
export const FACET_LABEL = {
  'concrete': 'concrete', 'existing-tiles': 'existing tiles', 'membrane': 'a waterproofing membrane', 'plasterboard': 'plasterboard', 'fibre-cement': 'fibre cement sheet',
  'timber': 'timber or plywood', 'render-brick': 'render or brick', 'screed': 'cement screed', 'heated-floor': 'a heated floor', 'natural-stone': 'natural stone',
  'internal': 'internal use', 'external': 'external use', 'aac': 'autoclaved aerated concrete', 'moisture-sensitive-stone': 'moisture sensitive stone',
  'porcelain': 'porcelain tiles', 'ceramic': 'ceramic tiles', 'mosaic': 'mosaic tiles', 'glass': 'glass tiles', 'engineered-stone': 'engineered stone',
  'quarry-terracotta': 'quarry or terracotta tiles', 'large-format': 'large format tiles',
};
const NEG = /\b(not suitable|unsuitable|not recommended|not be used|should not be used|do not use|not intended|cannot be used|not designed|not for use|not to be used|must not be used|not for)\b/;
const SUBSTRATES = ['concrete', 'existing-tiles', 'membrane', 'plasterboard', 'fibre-cement', 'timber', 'render-brick', 'screed', 'aac'];

export function normalise(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[®™©]/g, '').replace(/[‐-―]/g, '-').replace(/-/g, ' ').replace(/\s+/g, ' ');
}
/** Facet ids named in a piece of text. */
export function detect(text) {
  let s = ' ' + normalise(text) + ' '; const out = [];
  for (const [id, rx] of RX) {
    rx.lastIndex = 0;
    if (rx.test(s)) { rx.lastIndex = 0; if (id !== 'underlay') out.push(id); s = s.replace(rx, ' '); }
  }
  return out;
}
/** Split a text block into sentences and list items. */
export function sentences(block) {
  return String(block || '').split(/\n+|[•▪]|(?<=[.!?])\s+(?=[A-Z0-9])/).map((x) => x.trim()).filter(Boolean);
}
const clip = (s) => (s.length > 260 ? s.slice(0, 257) + '...' : s);

/** All evidence lines of a product: { text, field, positiveOk } in reading order. */
function lines(p) {
  const out = [];
  const add = (arr, field, positiveOk) => {
    let negHeading = false;
    for (const block of arr) {
      const ss = sentences(block);
      for (const s of ss) {
        const low = normalise(s);
        const heading = NEG.test(low) && /[:;]\s*$/.test(s.trim());
        const item = negHeading && s.length < 70 && !/[.!?]$/.test(s.trim());
        if (item) { out.push({ text: s, field, positiveOk: false, forceNo: true }); continue; }
        negHeading = heading;
        out.push({ text: s, field, positiveOk });
      }
      if (!ss.length) negHeading = false;
    }
  };
  add(p.usage || [], 'Usage', true);
  add(p.attributes || [], 'Features', true);
  add(p.advantages || [], 'Advantages', true);
  add([p.summary || '', p.tagline || ''], 'Summary', true);
  for (const sec of p.sections || []) {
    if (/\?$/.test(sec.title || '')) continue;
    for (const it of sec.items || []) {
      const t = it.text || '';
      if (/ \| /.test(t)) continue;
      add([t], sec.title || 'Product information', false);
    }
  }
  return out;
}

/** Evidence per facet: { no:[{text,field}], yes:[{text,field}], only:[...] } */
export function evidence(p) {
  const ev = {};
  const get = (f) => (ev[f] ||= { no: [], yes: [] });
  const seen = new Set();
  for (const ln of lines(p)) {
    const low = normalise(ln.text);
    const key = ln.text + '|' + ln.field;
    if (seen.has(key)) continue; seen.add(key);
    if (ln.forceNo) { for (const f of detect(ln.text)) get(f).no.push(ln); continue; }
    const m = NEG.exec(low);
    if (m) {
      const posPart = low.slice(0, m.index), negPart = low.slice(m.index);
      for (const f of detect(negPart)) get(f).no.push(ln);
      if (ln.positiveOk) for (const f of detect(posPart)) if (!(ev[f] && ev[f].no.includes(ln))) get(f).yes.push(ln);
      continue;
    }
    // "X only": the opposite is excluded and the sentence is quoted
    if (/\bonly\b/.test(low)) {
      const f = detect(low);
      if (f.includes('internal') && !f.includes('external')) { get('external').no.push(ln); if (ln.positiveOk) get('internal').yes.push(ln); continue; }
      if (f.includes('external') && !f.includes('internal')) { get('internal').no.push(ln); if (ln.positiveOk) get('external').yes.push(ln); continue; }
      const subs = f.filter((x) => SUBSTRATES.includes(x));
      if (subs.length && ln.positiveOk && /\b(on|over|to|with|for)\b[^.]{0,60}\bonly\b/.test(low) && !/(wall|floor)s?\b[^.]*only/.test(low)) {
        for (const o of SUBSTRATES) if (!subs.includes(o)) get(o).no.push(ln);
        for (const x of subs) get(x).yes.push(ln);
        continue;
      }
    }
    if (ln.positiveOk) for (const f of detect(ln.text)) get(f).yes.push(ln);
  }
  return ev;
}

/** The verdict for one facet. */
export function verdictFor(p, facet, ev = evidence(p)) {
  const e = ev[facet];
  const mk = (verdict, l) => ({ verdict, quote: clip(l.text), field: l.field, url: p.url || p.canonicalUrl || null });
  if (e && e.no.length) return mk('no', e.no[0]);
  if (e && e.yes.length) return mk('yes', e.yes[0]);
  return { verdict: 'unstated', quote: null, field: null, url: p.url || null };
}
/** Verdicts for the twelve chips. */
export function canUse(p) {
  const ev = evidence(p); const out = {};
  for (const [id] of CHIPS) out[id] = verdictFor(p, id, ev);
  return out;
}
/** Every NO the product's text states, by facet (used to list products "ruled out by their own text"). */
export function exclusions(p) {
  const ev = evidence(p); const out = {};
  for (const f of Object.keys(ev)) if (ev[f].no.length) out[f] = { quote: clip(ev[f].no[0].text), field: ev[f].no[0].field };
  return out;
}
