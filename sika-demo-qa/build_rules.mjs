// build_rules.mjs (T14): writes data/rules.json and data/rules.csv, the rule ledger, from the same extractors the advisor uses.
// One row per derived rule: stable id, product, type, the rule in plain words, the verbatim source sentence, source url, read date,
// status PUBLISHED, and blank signed_by / signed_on / comment columns. PUBLISHED means taken from a published Sika page. It does not
// mean Sika has approved it, and the signed columns are never auto-filled. Optional: corrections lane rules (CORRECTION rows).
// usage: node build_rules.mjs [portalDir] [correctionsRulesJson]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toCsv, COLUMNS } from '../public/demo/sika-210c0c/assets/lib/csv.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = process.argv[2] || path.join(HERE, '..', 'public', 'demo', 'sika-210c0c');
const CORR = process.argv[3] || '/home/tech2/klinge-kernel/state/sika/lanes/corrections/rules.json';
const A = (f) => import(pathToFileURL(path.join(PORTAL, 'assets', 'assistant', f)).href);
const { compileFacets, extractExclusions, positiveLines } = await A('facets.js');
const { productRates, parsePacks } = await A('rates.js');
const { sentences, normalise } = await A('tokenize.js');
const { FACETS } = await A('synonyms.js');
const { plain } = await A('answer.js');

export const TYPES = ['EXCLUSION', 'SUITABLE_FOR', 'CONSUMPTION', 'PACK', 'TIME', 'PRIMER'];
const compiled = compileFacets(FACETS);
const labelOf = (dim, id) => ((FACETS[dim] || []).find((f) => f.id === id) || { label: id }).label.split(' (')[0].toLowerCase();
const facetWords = (f) => Object.entries(f).flatMap(([d, ids]) => ids.map((id) => labelOf(d, id)));
const ws = (s) => String(s).replace(/\s+/g, ' ').trim();
const num = (n) => String(Math.round(n * 100) / 100);
const hash = (...a) => crypto.createHash('sha1').update(a.join('|')).digest('hex').slice(0, 10);

/** Every text block of a product that a rule may quote from. */
export function blocksOf(p) {
  const out = [].concat(p.usage || [], p.attributes || [], p.advantages || [], [p.summary || '', p.tagline || '', p.packaging || '']);
  for (const s of p.sections || []) for (const it of s.items || []) out.push(it.text || '');
  return out.filter(Boolean);
}
/** The whole text of a product with whitespace collapsed: the test target for "the quote is a substring". */
export const productBlob = (p) => ws(blocksOf(p).join(' \n '));

function fullSentence(p, clipped) {
  const stem = clipped.endsWith('...') ? clipped.slice(0, -3) : clipped;
  for (const b of blocksOf(p)) for (const s of sentences(b)) if (s.startsWith(stem)) return ws(s);
  return ws(clipped);
}

export function rowsFor(p, readDate) {
  const rows = []; const seen = new Set();
  const push = (type, rule, quote) => {
    quote = ws(quote); if (!quote) return;
    const id = hash(p.id, type, rule, quote); if (seen.has(id)) return; seen.add(id);
    rows.push({ id, product_id: p.id, product: plain(p.name), type, rule: plain(rule), quote, source_url: p.url, source_page: '', read_date: readDate, status: 'PUBLISHED', signed_by: '', signed_on: '', comment: '' });
  };
  const name = plain(p.name);
  for (const e of extractExclusions(compiled, p)) push('EXCLUSION', `${name} is not suitable for: ${facetWords(e.facets).join(', ')}.`, fullSentence(p, e.text));
  for (const l of positiveLines(compiled, p)) {
    if (!Object.keys(l.facets).length || !/\b(suitable|designed|can be used|used (for|on|over|in)|recommended|ideal|applications?)\b/i.test(l.text)) continue;
    push('SUITABLE_FOR', `The published text says ${name} suits: ${facetWords(l.facets).join(', ')}.`, fullSentence(p, l.text));
  }
  for (const r of productRates(p)) {
    let rule = `${name} consumption is published.`;
    if (r.kind === 'per_area') rule = `${name}: ${num(r.low)}${r.high !== r.low ? ' to ' + num(r.high) : ''} ${r.unit} per m2${r.perMm ? ' per mm' : ''}${r.basis ? ', ' + r.basis : ''}.`;
    else if (r.kind) rule = `${name}: a ${String(r.kind).replace(/_/g, ' ')} figure is published.`;
    push('CONSUMPTION', rule, r.text);
  }
  const packs = parsePacks(p.packaging);
  if (packs.length) push('PACK', `${name} is published in: ${packs.map((x) => x.label).join(', ')}.`, p.packaging);
  const TIMEWORD = /open time|pot life|working time|cur(e|ing)|wait|walk|traffic|setting|set time|recoat|overcoat|re-?coat|dry|grouting/i;
  const TIMEVAL = /\b\d+(\.\d+)?\s*(-|to|–)?\s*(\d+(\.\d+)?)?\s*(minutes?|mins?|hours?|hrs?|days?|weeks?)\b/i;
  for (const b of blocksOf(p)) for (const s of sentences(b)) if (TIMEWORD.test(s) && TIMEVAL.test(s) && s.length < 300) push('TIME', `${name}: a time is published (${ws((TIMEVAL.exec(s) || [''])[0])}).`, s);
  for (const b of blocksOf(p)) for (const s of sentences(b)) if (/\b(primer|priming|prime the)\b/i.test(s) && s.length < 300) push('PRIMER', `${name}: the published text makes a primer statement.`, s);
  return rows;
}

export { toCsv as csv, COLUMNS } from '../public/demo/sika-210c0c/assets/lib/csv.js';

export function build() {
  const products = JSON.parse(fs.readFileSync(path.join(PORTAL, 'data', 'products.json'), 'utf8'));
  const rows = [];
  for (const p of products) rows.push(...rowsFor(p, String(p.fetched || '2026-10-30').slice(0, 10)));
  // corrections lane output, when present: shown as CORRECTION rows (a rep's sourced fix), never as PUBLISHED
  let corr = 0;
  if (fs.existsSync(CORR)) {
    const cj = JSON.parse(fs.readFileSync(CORR, 'utf8')); const list = Array.isArray(cj) ? cj : cj.rules || [];
    for (const r of list) { corr++; rows.push({ id: hash('corr', r.question, r.answer), product_id: '', product: '', type: 'CORRECTION', rule: plain(r.answer || ''), quote: ws(r.question || ''), source_url: r.source_url || '', source_page: '', read_date: String(r.corrected_at || '').slice(0, 10), status: 'CORRECTION', signed_by: '', signed_on: '', comment: '' }); }
  }
  return { rows, corrections: corr };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { rows, corrections } = build();
  const counts = {}; for (const r of rows) counts[r.type] = (counts[r.type] || 0) + 1;
  const out = { generated: new Date().toISOString().slice(0, 10), note: 'PUBLISHED means taken from a published Sika page. It does not mean Sika has approved the rule. The signed columns are for Sika to fill.', columns: COLUMNS, counts, rules: rows };
  fs.writeFileSync(path.join(PORTAL, 'data', 'rules.json'), JSON.stringify(out));
  fs.writeFileSync(path.join(PORTAL, 'data', 'rules.csv'), toCsv(rows));
  console.log('rules:', rows.length, JSON.stringify(counts), 'corrections', corrections);
}
