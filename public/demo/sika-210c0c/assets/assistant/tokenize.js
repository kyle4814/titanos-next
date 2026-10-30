// tokenize.js: text normalisation, tokenising and light stemming shared by index and query. No dependencies.

const STOP = new Set(('a an and are as at be but by can could do does for from had has have how i if in into is it its me my of on or our '
  + 'so than that the their them then there these they this to us was we were what when where which who why will with would you your '
  + 'please tell show give need want looking look get got any some about also just like should shall may might am been being not no yes '
  + 'use used using best good right suitable product products').split(' '));

/** Normalise text: lower case, strip diacritics and registered marks, unify area/volume symbols and unit spellings. */
export function normalise(text) {
  let s = String(text == null ? '' : text).toLowerCase();
  if (/[^\x00-\x7f]/.test(s)) {
    s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\u00ae\u2122\u00a9]/g, '')
      .replace(/\u00b2/g, '2').replace(/\u00b3/g, '3').replace(/[\u2013\u2014\u2212]/g, '-').replace(/[\u2018\u2019]/g, "'");
  }
  if (/sq|square|cubic|cu\.? ?m/.test(s)) {
    s = s.replace(/\bsq\.?\s*m(etres?|eters?)?\b/g, 'm2').replace(/\bsquare\s+(metres?|meters?)\b/g, 'm2').replace(/\bsqm\b/g, 'm2')
      .replace(/\bcubic\s+(metres?|meters?)\b/g, 'm3').replace(/\bcu\.?\s*m\b/g, 'm3');
  }
  return s;
}

/** Light Porter-style stemmer: plurals, -ing, -ed, -ly, -er, final e, doubled consonants. */
export function stem(w) {
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y';
  else if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && w.length > 3) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 5 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 5 && w.endsWith('ly')) w = w.slice(0, -2);
  else if (w.length > 6 && w.endsWith('er')) w = w.slice(0, -2);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  if (w.length > 4 && /([^aeiouls])\1$/.test(w)) w = w.slice(0, -1);
  else if (w.length > 4 && w.endsWith('ll')) w = w.slice(0, -1);
  return w;
}

const cache = new Map();
/** Stem with memoisation (the catalogue repeats the same words thousands of times). */
export function stemCached(w) {
  let r = cache.get(w);
  if (r === undefined) { r = stem(w); if (cache.size < 200000) cache.set(w, r); }
  return r;
}

/** Raw word split on the normalised string; letter/digit compounds such as 11fc also yield their parts. */
export function words(text) {
  const out = [];
  const parts = normalise(text).match(/[a-z0-9]+/g);
  if (!parts) return out;
  for (const p of parts) {
    out.push(p);
    if (p.length > 2 && /[a-z]\d|\d[a-z]/.test(p)) {
      const sub = p.match(/[a-z]+|\d+/g);
      for (const q of sub) out.push(q);
    }
  }
  return out;
}

/** Index tokens: stop words dropped, stems applied. */
export function tokenize(text, keepStop = false) {
  const out = [];
  for (const w of words(text)) {
    if (!keepStop && STOP.has(w)) continue;
    out.push(stemCached(w));
  }
  return out;
}

/** Compact key for name matching: letters and digits only (tolerates spacing, hyphens, case, marks). */
export function compact(text) {
  return normalise(text).replace(/[^a-z0-9]+/g, '');
}

export function isStop(w) { return STOP.has(w); }

/** Split text into sentences (also on newlines and bullet pipes). */
export function sentences(text) {
  return String(text || '').split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])/).map(s => s.trim()).filter(Boolean);
}

/** Edit distance up to 1 test (cheap fuzzy for typos). */
export function within1(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
  }
  return edits + (la - i) + (lb - j) <= 1;
}
