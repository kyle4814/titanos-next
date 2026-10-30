// facets.js: detect substrates, tile types and locations in text, and extract "not suitable for ..." exclusions from a product's own text.
import { normalise, sentences } from './tokenize.js';

// qualified compounds that are not the plain substrate (e.g. "fast-setting concrete" is not "concrete")
const MASK = /\b(fast[- ]setting|rapid[- ]setting|high[- ]strength|precast|lightweight|aerated|fresh|wet|green|reinforced|mass|sprayed|shot)\s+(concrete|repair mortars?)\b/g;
const NEG = /\b(not suitable|unsuitable|not recommended|not be used|should not be used|do not use|not intended|cannot be used|not designed|not for use|not to be used|must not be used)\b/;

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Compile facet definitions into one longest-phrase-first alternation (fast: one regex pass per text). */
export function compileFacets(FACETS) {
  const map = new Map();
  for (const [dim, items] of Object.entries(FACETS)) {
    for (const it of items) for (const t of it.terms) {
      const n = normalise(t).trim().replace(/-/g, ' ');
      if (!map.has(n)) map.set(n, []);
      map.get(n).push({ dim, id: it.id });
    }
  }
  const terms = [...map.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp('(?<![a-z0-9])(' + terms.map(escapeRe).join('|') + ')(?![a-z0-9])', 'g');
  return { re, map };
}

/** Find facet ids mentioned in text; the longest phrase wins ("existing tiles" is not also "tiles"). Returns {dim: [ids]}. */
export function detectFacets(compiled, text) {
  const s = normalise(text).replace(/-/g, ' ');
  const out = {};
  compiled.re.lastIndex = 0;
  let m;
  while ((m = compiled.re.exec(s))) {
    for (const f of compiled.map.get(m[1])) { const a = out[f.dim] || (out[f.dim] = []); if (!a.includes(f.id)) a.push(f.id); }
  }
  return out;
}

/** Sentences of a product that carry an exclusion, with the facets named from the trigger onward. */
export function extractExclusions(compiled, product) {
  const src = [].concat(product.usage || [], product.attributes || [], product.advantages || [], [product.summary || '']);
  for (const sec of product.sections || []) for (const it of sec.items || []) if (!/^(Technical|Product) Information$/.test(sec.title)) src.push(it.text || '');
  const seen = new Set(), out = [];
  for (const block of src) for (const sent of NEG.test(normalise(block)) ? sentences(block) : []) {
    const low = normalise(sent);
    const m = NEG.exec(low);
    if (!m || seen.has(sent)) continue;
    seen.add(sent);
    const tail = low.slice(m.index).replace(MASK, ' ');
    const f = detectFacets(compiled, tail);
    if (Object.keys(f).length) out.push({ text: sent.length > 260 ? sent.slice(0, 257) + '...' : sent, facets: f });
  }
  return out;
}

/** Sentences mentioning facets positively (no exclusion trigger), for reasons and tile-path evidence. */
export function positiveLines(compiled, product) {
  const src = [].concat(product.usage || [], product.attributes || [], product.advantages || [], [product.summary || '', product.tagline || '']);
  const out = [];
  for (const block of src) for (const sent of sentences(block)) {
    if (NEG.test(normalise(sent))) continue;
    out.push({ text: sent.length > 260 ? sent.slice(0, 257) + '...' : sent, facets: detectFacets(compiled, sent) });
  }
  return out;
}
