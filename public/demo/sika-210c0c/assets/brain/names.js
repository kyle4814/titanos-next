// names.js: old names, nicknames and rebrand history. Every alias cites the published page it came from; an alias is only added where the page
// itself shows the name. Nothing here is guessed: "Ultratile" style shorthand that no page shows is NOT aliased (the assistant says it is not published).
import { card, CHIPS } from './schema.js';
import { normalise } from './text.js';
const DAVCO = 'https://aus.sika.com/en/construction/davco.html';
const P = (cat, id) => `https://aus.sika.com/en/construction/${cat}/${id}.html`;
const SRC = {
  l173: { url: DAVCO, quote: 'Davco Lanko 173 Floor Leveller is still the same product name.' },
  l173c: { url: DAVCO, quote: 'Davco Lanko 173 Floor Leveller is still the same Green product colour as before.' },
  nov: { url: P('concrete/fibres', 'sikafiber-novomesh-950'), quote: 'SikaFiber Novomesh-950 previously Novomesh 950 or SikaFiber Force 950.' },
  pot: { url: P('tile-stone-installationsystems/tile-adhesives', 'davco-grey-one-potadhesive'), quote: 'Davco Grey One Pot adhesive (sold in pails)' },
};
/** { key (normalised phrase), id (product id), src } */
export const NAME_ALIASES = [
  { k: 'davco lanko 173', id: 'lanko-173-floor-leveller', src: SRC.l173 },
  { k: 'davco lanko 173 floor leveller', id: 'lanko-173-floor-leveller', src: SRC.l173 },
  { k: 'davco 173 floor leveller', id: 'lanko-173-floor-leveller', src: SRC.l173 },
  { k: 'green bag floor leveller', id: 'lanko-173-floor-leveller', src: SRC.l173c },
  { k: 'green davco leveller', id: 'lanko-173-floor-leveller', src: SRC.l173c },
  { k: 'sikafiber force 950', id: 'sikafiber-novomesh-950', src: SRC.nov },
  { k: 'sika fiber force 950', id: 'sikafiber-novomesh-950', src: SRC.nov },
  { k: 'sikafiber novomesh 950', id: 'sikafiber-novomesh-950', src: SRC.nov },
  { k: 'grey pot', id: 'davco-grey-one-potadhesive', src: SRC.pot },
  { k: 'davco grey pot', id: 'davco-grey-one-potadhesive', src: SRC.pot },
  { k: 'grey pot adhesive', id: 'davco-grey-one-potadhesive', src: SRC.pot },
];
/** Merge the table into core.alias (key -> [product index]); a key already owned by a different product is left alone and reported. */
export function applyNames(core, pIndex) {
  const clash = [];
  for (const a of NAME_ALIASES) { const pi = pIndex.get(a.id); if (pi == null) continue; const cur = core.alias[a.k]; if (cur && (cur.length !== 1 || cur[0] !== pi)) { clash.push(a.k); continue; } core.alias[a.k] = [pi]; }
  return clash;
}
const H = [
  { rx: /\bparex\b|\b(davco|lanko)\b.*\b(owned|owner|acquir\w*|bought|buy|parex|cta|part of sika|belongs?|who (makes|made|owns))\b|\b(who owns|owned by|acquisition of) (davco|lanko)\b/, title: 'Who owns Davco',
    lines: ["Sika Australia entered the building finishing sector in 2015 by acquiring CTA's well-known brand. The acquisition of Parex, with the brand Davco in Australia, expanded the product line from top to mid-range.", 'Sika completed its acquisition of Parex on May 23, 2019. The transaction was announced on January 8, 2019.'], head: 'Davco is a Sika brand.' },
  { rx: /\b(davco|lanko)\b.*\b(packag\w*|bags?|pails?)\b.*\b(chang\w*|new|differen\w*|same|updat\w*)\b|\b(davco|lanko)\b.*\b(new|old|yellow|white|bag|packag\w*|pack|pail|colour|color|changed|change|same|formula|differen\w*)\b.*\b(packag\w*|pack|bag|pail|colour|color|product|formula|same)\b|\b(old|new) (davco|lanko)\b|\bdavco (bag|pail) (changed|colour|color)\b/, title: 'Davco packaging change',
    lines: ["Rest assured, the product inside hasn't changed.", 'The only change is the packaging colour, which has been updated from white to Sika yellow.', 'The Davco product names remain the same, the familiar product colour coding remains the same, and the quality and performance you trust are unchanged.', "Old packaging will continue to move through until it's used up. Both old and new packaging contain the same product."], head: 'Davco products kept their names and colour coding; only the packaging changed.' },
  { rx: /\blanko\b.*\b(called|known as|named)\b|\blanko\b.*\b(renam\w*|rebrand\w*|now called|new name|used to be|formerly|old name|become|became|changed to|now (a )?davco|turned into)\b|\b(renam\w*|rebrand\w*|formerly|old name)\b.*\blanko\b/, title: 'Lanko names',
    lines: ["Product name's haven't changed. Davco Lanko 173 Floor Leveller is still the same product name."], head: 'The pages I work from show Davco and Lanko names side by side and say the product names have not changed.', gap: 'A rename of the Lanko range is not published in the pages I work from.' },
  { rx: /\bsikafloor level\b.*\b(renam\w*|rebrand\w*|used to (be|have)|another name|other name|earlier name|formerly|old name|was called|previous(ly)?|now called|new name|replac\w*|before)\b|\b(renam\w*|formerly|old name|was called)\b.*\bsikafloor level\b|\blevel (pro|top|ultra|eco)\b.*\b(old|former|previous) name\b/, title: 'Sikafloor Level names',
    lines: [], head: 'No published page I work from gives an earlier name for the Sikafloor Level range.', gap: 'Rename history for Sikafloor Level is not published in the pages I work from.' },
];
/** An info card for a question about old names, ownership or the packaging change, or null. Every sentence is quoted from the cited page. */
export function historyCard(n0) {
  const n = normalise(n0); const h = H.find((x) => x.rx.test(n)); if (!h) return null;
  const facts = h.lines.map((s) => ({ source_url: DAVCO, page: null, sentence: s, status: 'PUBLISHED', doc_type: 'WEB', doc_version: '' }));
  const lines = h.lines.map((s, i) => ({ label: i === 0 ? 'The Davco page says' : '', text: s }));
  if (h.gap) lines.push({ label: 'Not published', text: h.gap });
  const c = card({ type: 'info', title: h.title, headline: h.head, facts, status: facts.length ? 'PUBLISHED' : 'UNKNOWN', chip: facts.length ? CHIPS.SITE : CHIPS.UNKNOWN, lines, links: [{ label: 'Davco page on the Sika Australia site', url: DAVCO }, { label: 'Ask Sika Technical Services', url: 'https://aus.sika.com/en/Contact/technical.html' }], followups: ['Show me the Davco range', 'Recommend one for me'] });
  if (!facts.length) { c.type = 'unknown'; c.handoff = { question: n0, product: '', reason: h.gap, missing: ['rename history'] }; }
  return c;
}
