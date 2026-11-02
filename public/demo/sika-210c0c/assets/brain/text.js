// text.js: normalise, tokenise, stem and spell tolerance. Shared by the build step and the runtime so the index and the query agree.
export const STOP = new Set('a an the is are was were be been to of in on at for and or what whats which how do does did can could i you it this that these those with my our your me we there their about tell please need want would should will shall any some from by as if so do im ive its use using used get got give show find look looking best good right one ones thing things much many long take takes'.split(/\s+/));
// words that carry no product meaning even though they are not in STOP (kept out of the "uncovered words" check too)
export const GENERIC = new Set('old new existing over onto into under above below near around when where why who whom whose than then also just only still very really more most such other another each every both either neither not no yes can ok okay stick sticks bond bonds work works working apply applied product products item items stuff material materials sika davco australia'.split(/\s+/));
export function normalise(s) {
  return String(s == null ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[®™©]/g, ' ').replace(/m²|m²/g, 'm2').replace(/\bsq\.? ?m(etres?|eters?)?\b/g, 'm2').replace(/\bsqm\b/g, 'm2').replace(/&/g, ' and ').replace(/\+/g, ' plus ')
    .replace(/(\d),(\d{3})\b/g, '$1$2').replace(/\b(\d{1,3}(?:\.\d+)?) ?(?:m|metres?|meters?|mtrs?)? ?(?:x|by|\*) ?(\d{1,3}(?:\.\d+)?) ?(?:m|metres?|meters?|mtrs?)\b(?! ?2)/g, (w, a, b) => `${Math.round(Number(a) * Number(b) * 100) / 100} m2`).replace(/[^a-z0-9.½]+/g, ' ').replace(/(^|\s)\.+(?=\s|$)/g, ' ').replace(/\.(\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
}
export function stem(w) {
  if (w.length > 3 && /^[a-z]+$/.test(w)) {
    if (w.endsWith('ies')) w = w.slice(0, -3) + 'y';
    else if (w.endsWith('sses')) w = w.slice(0, -2);
    else if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) w = w.slice(0, -1);
    if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
    else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
    if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1);
  }
  return w;
}
export const words = (s) => normalise(s).split(' ').filter(Boolean);
/** stemmed content tokens (stop words removed) */
export function tokens(s, keepStop = false) {
  const out = [];
  for (const w of words(s)) { if (!keepStop && STOP.has(w)) continue; const t = stem(w); if (t) out.push(t); }
  return out;
}
export const compact = (s) => normalise(s).replace(/[^a-z0-9]/g, '');
/** Damerau-Levenshtein bounded by max; returns max+1 when over */
export function dist(a, b, max = 2) {
  if (a === b) return 0;
  const la = a.length, lb = b.length; if (Math.abs(la - lb) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const cur = [i]; let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v; if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[lb];
}
/** numbers as they appear in text: 7.5, 1,000 -> 1000, ranges give both ends */
export function numbersIn(s) {
  const out = [];
  const t = String(s == null ? '' : s).replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/½/g, '.5');
  for (const m of t.matchAll(/\d+(?:\.\d+)?/g)) out.push(String(Number(m[0])));
  return out;
}

/** Clamp a passage to at most max characters, ending on a sentence or row boundary where one exists. hint = Set of stemmed tokens; the segment that matches most of them is kept. */
export function clampText(text, hint = null, max = 280) {
  const s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const score = (seg) => { if (!hint || !hint.size) return 0; let c = 0; for (const w of new Set(tokens(seg))) if (hint.has(w)) c++; return c; };
  const segs = s.split(/(?<=[.!?;])\s+|\s+\|\s+/).filter(Boolean);
  if (segs.length > 1) {
    let best = segs[0], bs = score(best);
    for (const g of segs) { const sc = score(g); if (sc > bs || (sc === bs && best.length > max && g.length < best.length)) { best = g; bs = sc; } }
    if (best.length <= max) return best;
    return clampText(best, hint, max);
  }
  // one long run (a flattened table): a window that starts at a word and ends at a word, around the first hinted word
  const ws = s.split(' '); let at = 0;
  if (hint && hint.size) { const i = ws.findIndex((w) => hint.has(stem(normalise(w)))); if (i > 0) at = Math.max(0, i - 4); }
  let out = '';
  for (let i = at; i < ws.length && (out + ' ' + ws[i]).length <= max - 4; i++) out = out ? out + ' ' + ws[i] : ws[i];
  return (at > 0 ? '\u2026 ' : '') + out + (at + out.split(' ').length < ws.length ? ' \u2026' : '');
}
