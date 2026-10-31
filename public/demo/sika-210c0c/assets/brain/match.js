// match.js: the ONE matcher. What a person types is read here and nowhere else: normalisation, trade slang and old names, spelling
// correction, synonym groups and product alias spans. The advisor brain (brain.js), the header search box and the finder free text
// (lib/search.js) all call this module, so a phrasing that works in one works in all three. Pure functions, no DOM, no network.
import { normalise, tokens, stem, dist, compact, STOP, GENERIC } from './text.js';
import { SYNONYM_GROUPS } from './syn.js';
import { applySlang } from './slang.js';
export { normalise, tokens, stem, dist, compact, STOP, GENERIC, applySlang, SYNONYM_GROUPS };

// ---------------------------------------------------------------- synonyms
const GROUPS = SYNONYM_GROUPS.map((g) => g.map((t) => ({ n: normalise(t), toks: tokens(t, true).filter((x) => !STOP.has(x)) })));

/** Brain form: Map(token -> weight), the query's own tokens at 1 and every synonym of a phrase found in the question at 0.4. */
export function expandSynonyms(n, qtoks) {
  const q = new Map(); for (const t of qtoks) q.set(t, 1);
  const padded = ' ' + n + ' ';
  for (const g of GROUPS) {
    const hit = g.filter((x) => padded.includes(' ' + x.n + ' '));
    if (!hit.length) continue; const hs = new Set(hit.flatMap((x) => x.toks));
    for (const x of g) for (const s of x.toks) if (!hs.has(s) && !q.has(s)) q.set(s, 0.4);
  }
  return q;
}
/** Finder form: Map(query token -> Set of synonym tokens), so a search can treat a word and its synonyms as one requirement. */
export function synonymsByToken(n, qtoks) {
  const out = new Map(qtoks.map((t) => [t, new Set()]));
  const padded = ' ' + n + ' ';
  for (const g of GROUPS) {
    const hit = g.filter((x) => padded.includes(' ' + x.n + ' '));
    if (!hit.length) continue;
    const members = new Set(g.flatMap((x) => x.toks));
    for (const t of qtoks) if (hit.some((x) => x.toks.includes(t))) for (const s of members) if (s !== t) out.get(t).add(s);
  }
  return out;
}

// ---------------------------------------------------------------- spelling
/** Nearest known word for t (edit distance 1, or 2 for words of 9+ letters), most frequent word on a tie. has(w) tells if w is known; vocab lists the known words; df(w) is a frequency. */
export function spellToken(t, vocab, has, df = () => 0) {
  if (has(t) || t.length < 5 || /\d/.test(t)) return t;
  const max = t.length >= 9 ? 2 : 1; let best = null, bd = 9, bdf = -1;
  for (const v of vocab) { if (Math.abs(v.length - t.length) > max || v.length < 5) continue; const d = dist(t, v, max); if (d > max) continue; const f = df(v); if (d < bd || (d === bd && f > bdf)) { best = v; bd = d; bdf = f; } }
  return best || t;
}
/** Correct the words of a normalised phrase against a lexicon of words the assistant understands (never against product names). skip(w) keeps a word as typed. */
export function correctAgainst(s, lexicon, skip) {
  return s.split(' ').map((x) => {
    if (x.length < 4 || /\d/.test(x) || skip(x) || STOP.has(x) || GENERIC.has(x)) return x;
    if (lexicon.includes(x)) return x;
    const max = x.length >= 9 ? 2 : 1; let best = null, bd = 9;
    for (const l of lexicon) { if (Math.abs(l.length - x.length) > max || (x.length < 5 && l.length < 5)) continue; const d = dist(x, l, max); if (d < bd && (d <= 1 || x.slice(0, 2) === l.slice(0, 2)) && !l.startsWith(x) && !x.startsWith(l) && x.slice(0, -1) !== l.slice(0, -1)) { bd = d; best = l; } }
    return best && bd <= max && !STOP.has(x) && !GENERIC.has(x) ? best : x;
  }).join(' ');
}

// ---------------------------------------------------------------- aliases (exact product names, fused forms, old names)
export function pickSpans(hits) {
  hits.sort((a, b) => b.k - a.k || a.i - b.i); const used = new Set(), out = [];
  for (const h of hits) { let clash = false; for (let j = h.i; j < h.i + h.k; j++) if (used.has(j)) clash = true; if (clash) continue; for (let j = h.i; j < h.i + h.k; j++) used.add(j); out.push(h); }
  return out;
}
/** Longest phrases of the normalised question that are an alias key. alias: { key -> value }. Value is whatever the caller stores (product indexes or ids). */
export function findAliasSpans(n, alias) {
  const w = n.split(' ').filter(Boolean); const hits = [];
  const own = (key) => (Object.prototype.hasOwnProperty.call(alias, key) ? alias[key] : null); // a word like "constructor" must not hit Object.prototype
  for (let i = 0; i < w.length; i++) for (let k = Math.min(8, w.length - i); k >= 1; k--) {
    const phrase = w.slice(i, i + k).join(' '); const a = own(phrase) || (k > 1 ? own(compact(phrase)) : null);
    if (a) hits.push({ i, k, pis: a, key: phrase });
  }
  return pickSpans(hits);
}
export function aliasEntries(alias) { return Object.entries(alias).filter(([k]) => k.includes(' ') || /\d/.test(k)).map(([k, v]) => ({ k, toks: k.split(' ').map(stem), pis: v })); }
/** Alias keys of two or more words (or with a digit) matched with one slightly misspelt word. */
export function fuzzyAliasSpans(n, entries) {
  const q = n.split(' ').filter(Boolean).map(stem); const hits = [];
  const tokEq = (a, b) => a === b || (a.length >= 3 && b.length >= 3 && !/\d/.test(a + b) && dist(a, b, a.length >= 8 ? 2 : 1) <= (a.length >= 8 ? 2 : 1));
  for (const a of entries) {
    const k = a.toks.length; if (k < 2 && !/\d/.test(a.k)) continue;
    for (let i = 0; i + k <= q.length; i++) { let ok = true, fuzzy = 0; for (let j = 0; j < k; j++) { if (q[i + j] === a.toks[j]) continue; if (tokEq(q[i + j], a.toks[j])) { fuzzy++; continue; } ok = false; break; } if (ok && fuzzy && (fuzzy <= 1 || k >= 4)) { hits.push({ i, k, pis: a.pis, key: a.k, fuzzy }); break; } }
  }
  return pickSpans(hits);
}

// ---------------------------------------------------------------- the finder reading of a question
/**
 * interpret(q, { vocab, has, df, alias }) -> { n, text, notes, tokens, groups, aliasHits }
 *   n          the normalised question; text = n after trade slang and old-name rewrites
 *   tokens     content words, stemmed, spelling corrected against the vocabulary of the thing being searched
 *   groups     Map(token -> Set(synonym tokens))
 *   aliasHits  [{ i, k, key, pis }] product names / old names found in the question (words i..i+k-1 are consumed by the alias)
 */
export function interpret(q, { vocab = [], has = () => false, df = () => 0, alias = null } = {}) {
  const n = normalise(q); const sl = applySlang(n); const text = sl.text;
  const aliasHits = alias ? findAliasSpans(text, alias) : [];
  const consumed = new Set(); for (const h of aliasHits) for (let j = h.i; j < h.i + h.k; j++) consumed.add(j);
  const words = text.split(' ').filter(Boolean);
  const toks = [];
  words.forEach((w, i) => { if (consumed.has(i) || STOP.has(w)) return; const t = stem(w); if (!t) return; toks.push(spellToken(t, vocab, has, df)); });
  const uniq = [...new Set(toks)];
  return { n, text, notes: sl.notes, tokens: uniq, groups: synonymsByToken(text, uniq), aliasHits };
}
