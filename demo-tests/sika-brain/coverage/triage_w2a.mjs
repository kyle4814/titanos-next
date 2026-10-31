// triage_w2a.mjs: wave 2 lane A triage of every judge WRONG. The judge flags an answer WRONG on pattern; a human-readable class decides what it means.
//   BRAIN-WRONG  the brain showed a product or page the published data does not support for that ask (zero tolerance; listed in the receipt as a request, quarantined here until the owning lane fixes it)
//   MISSING      the right answer exists in the data and the brain did not find it (request to the owning lane); no unsupported claim was made
// Anything the judge calls WRONG that is not covered here is UNTRIAGED and fails the gate. Ids are stable hashes of the question ground truth.
// Lanes: B = data/brain/adv + advisor reading it (best/list/numbers/PDS tables), C = language (typos, slang, vague, know pages, session, spelling).
import { shard } from './_bankkit.mjs';
const said = (why) => { const m = /fit: ([a-z0-9,\-]+)/.exec(why || ''); if (!m) return ''; return m[1].split(',').slice(0, 2).map((id) => { try { const d = shard(id).d; return ` ${id} is published as "${String(d.t || d.s || '').replace(/\s+/g, ' ').slice(0, 110)}"`; } catch (e) { return ''; } }).join(';'); };
const LANG = /typo|slang|sms|voice|units|hand|mutated|wild/;
// explicit BRAIN-WRONG notes: the data that contradicts or fails to support the answer
const WRONG_NOTES = {
  c056: { c: 'BANK-FIX', note: 'bank expectation too narrow: SikaRoof VersiDrain 8 Mesh usage lines name "Basement walls / Tunnels / Underground excavated rock surfaces" (products.json usage), so it is a documented fit for an underground wall' },
  b070: { c: 'MISSING', lane: 'C', note: 'project support page exists in the crawl; the brain surfaced the Landscape & Building Solutions page' },
  avyrv7b: { c: 'BRAIN-WRONG', lane: 'C', note: 'wall is damp answered with the marine acoustic "Vertical Damping" page: damp vs damping stem collision, no support in the data' },
  a136yvq: { c: 'BRAIN-WRONG', lane: 'B', note: 'SikaCeram Sealing Membrane A is a tile waterproofing membrane (products.json tagline: flexible waterproofing membrane for wet rooms); it is not transport interior or exterior sealing' },
};
export function triage(r) {
  if (r.cls !== 'WRONG') return null;
  const why = r.why || ''; const lane = LANG.test(r.messy || '') ? 'C' : 'B'; const txt = r.text || '';
  const n = WRONG_NOTES[r.id]; if (n) return { c: n.c || 'BRAIN-WRONG', lane: n.lane || lane, note: n.note };
  if (/^product answer to a business question|^answer without the right page/.test(why)) return { c: 'MISSING', lane: 'C', note: 'the page for this ask is in kb.json or pages.json (validate_bank.mjs proves it); the brain surfaced a different page or a product list instead. No unsupported figure was stated.' };
  if (r.type === 'nodata' && /answered something the data cannot answer/.test(why)) return /\$\s?\d|\bAUD?\s?\d|per (bag|pail|unit).{0,10}\d/i.test(txt) ? { c: 'BRAIN-WRONG', lane: 'B', note: 'a price-like figure appears in the answer; no price is published in the data' } : { c: 'MISSING', lane: 'C', note: 'price, stock or sales ask not routed to the honest decline; the card shows published product text and states no price' };
  if (r.type === 'vague' && /guessed silently/.test(why) && /^advice:/.test(r.first)) return { c: 'MISSING', lane: 'C', note: 'vague ask answered with a labelled "products whose published text uses your words" list instead of one clarifying question (gap 7)' };
  if (r.type === 'vague' && /guessed silently/.test(why) && /^info:/.test(r.first)) return { c: 'MISSING', lane: 'C', note: 'vague ask answered with a published information page instead of one clarifying question (gap 7); no product was claimed' };
  if (r.type === 'system' && /other system/.test(why)) return { c: 'BRAIN-WRONG', lane: 'C', note: 'linked a different system sheet from the one asked' };
  return { c: 'BRAIN-WRONG', lane, note: 'answer names a product the published data does not support for this ask (' + why.slice(0, 90) + '):' + said(why) };
}
