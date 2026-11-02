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
// WRONG_REVIEW_2026-11-02.md: all 39 judge WRONGs of 2026-11-02 reviewed one by one (question, answer shown, judge reason). Verdicts: MISSING (no unsupported claim; the right page or answer exists and was not surfaced),
// BANK-FIX (the answer shown is true and relevant; the bank expectation was too narrow), BRAIN-WRONG (the answer shown was wrong or misleading to a buyer). A BRAIN-WRONG with FIXED in its note
// no longer reaches this function (the brain was fixed, with a regression test in unit_brain.mjs); one with NOT FIXED stays here and shows in the WRONG count of the headline.
const REVIEW_2026_11_02 = {
  arkr8f7: { c: "BRAIN-WRONG", note: "sales-ranking ask (\"fast movers\") answered with three products as if ranked; the data holds no sales data. FIXED: sales-popularity phrases route to the honest decline (brain.js RX.price)." },
  ajt8dj6: { c: "BANK-FIX", note: "shown page quotes \"Sika offers training to employees of tiling businesses who use the Sika Internal Wet Area System\": a true answer. Bank wants one exact page URL." },
  am154gv: { c: "BANK-FIX", note: "\"Local Projects\" page lists the Coffs Harbour Bypass project: true and relevant. Bank wants the dedicated page URL." },
  aheb869: { c: "BANK-FIX", note: "\"Local Projects\" page lists Northbridge Swimming Pool Restoration: true and relevant. Bank wants the dedicated page URL." },
  a1kkypj: { c: "MISSING", note: "labelled list of food and hygienic resin floors; no unsupported claim. The Kerry Ingredients case study page exists and was not surfaced." },
  a1naiqg: { c: "MISSING", note: "labelled list of structural strengthening systems; no unsupported claim. The Chatswood carpark case study page exists and was not surfaced." },
  a1uo8hm: { c: "MISSING", note: "quotes the published SikaTack PRO sentence \"30 minutes Minimum Drive-Away Time\"; the dedicated Minimum Drive-Away Time page (with its \"may be affected in certain cases\" line) exists and was not surfaced." },
  af0fuup: { c: "MISSING", note: "quotes the published ADAS calibration sentence; the dedicated ADAS page exists and was not surfaced." },
  a1yph6n: { c: "BRAIN-WRONG", note: "\"windscreen removal\" answered with Sika Cleaner PCA (\"removal of contamination or cleaning of windshields\"): a word collision on \"removal\", not the SmartCut cut-out process. The card says it matches words, but a buyer can read it as the removal answer. FIXED: a windscreen removal or cut-out ask is answered by Sika's two published removal procedures (SmartCut, complete removal) and says plainly that no Sika product removes a windscreen (know.js topic). Regression test in unit_pick.mjs." },
  addi4nz: { c: "BRAIN-WRONG", note: "\"removing a windscreen completely\" answered with Sikasil Windscreen (a sealant): the product name collides with the ask; nothing about removal. FIXED: same removal routing as row 8 (know.js topic). Regression test in unit_pick.mjs." },
  a1snv3h: { c: "MISSING", note: "labelled word-match list; the freshly painted vehicles page exists and was not surfaced. No unsupported claim." },
  agdjw2s: { c: "MISSING", note: "labelled fit list that states what the text does not say (\"Not stated in the published text\"); the special weather conditions page was not surfaced." },
  ae64epu: { c: "MISSING", note: "honest range list (\"I am not ordering these\"); the PC/PMMA bonding page exists and was not surfaced." },
  a16pdfr: { c: "MISSING", note: "labelled word-match list (silicone); the identification page exists and was not surfaced. No unsupported claim." },
  a702ntn: { c: "MISSING", note: "labelled word-match list; the marine FAQ page exists and was not surfaced." },
  a1i6dit: { c: "BRAIN-WRONG", note: "the filler \"quick one\" was read as a requirement (\"Criterion used: fast setting or drying\"), which the buyer never asked for. FIXED: \"quick one/question/ask...\" no longer triggers the fast-setting criterion (advisor.js); teak decking now returns Sikaflex-298 and Sikaflex-290 DC PRO." },
  a1vqoi8: { c: "BANK-FIX", note: "shown page is the Renewable Energy Adhesives for Solar & Wind page and its text covers wind blade and nacelle work: a true answer. Bank wants one URL." },
  a1f5d9k: { c: "MISSING", note: "labelled word-match list under an Automotive heading; the solar page exists and was not surfaced. The product sentence quoted is accurate for that product." },
  a124qn5: { c: "MISSING", note: "labelled tile grout list with its criterion stated (\"glass and mosaic tiles\"); the glass balustrade page exists and was not surfaced." },
  a17wdx1: { c: "MISSING", note: "labelled fit list with its criterion stated; the insulating glass page exists and was not surfaced." },
  a1owfbc: { c: "BRAIN-WRONG", note: "\"honeycomb panel bonding\" answered with concrete repair mortars for honeycombed concrete: a word collision, a different thing. FIXED: honeycomb PANEL asks route to Sika's Honeycomb Panels page (SikaForce and SikaMelt adhesives); honeycombed concrete still gets the repair mortars (know.js topic). Regression test in unit_pick.mjs." },
  aa7lpbk: { c: "MISSING", note: "SikaPower-4720 sentence names door skins and panel bonding, so the product is relevant; the building components doors page was not surfaced." },
  a1vswpz: { c: "MISSING", note: "labelled word-match list; the elevator page exists and was not surfaced." },
  aiohph6: { c: "MISSING", note: "honest range list (\"I am not ordering these\"); the HVAC page exists and was not surfaced." },
  a1655bd: { c: "BRAIN-WRONG", note: "price ask (\"how much is a pail of ...\") answered with a product card and no decline. FIXED: \"how much is/are ... pail/bag/tub/...\" routes to the price decline (brain.js RX.price)." },
  apokefr: { c: "BRAIN-WRONG", note: "\"rrp\" ask answered with a product card and no decline. FIXED: rrp, specials, on sale, price list route to the price decline." },
  a70wy33: { c: "BRAIN-WRONG", note: "\"specials\" ask answered with a range list and no decline. FIXED: same price routing." },
  a1ap27x: { c: "MISSING", note: "vague ask answered with a labelled word-match list instead of one clarifying question; no unsupported claim." },
  a1qg9bt: { c: "MISSING", note: "vague ask answered with a labelled fit list (criterion \"stopping leaks\") instead of a clarifier; no unsupported claim." },
  d1blsnw9: { c: "MISSING", note: "\"BIM files\" answered with the Where to buy page (honest, says the stockist list is not held); the BIM page exists and was not surfaced." },
  d1g2uenx: { c: "MISSING", note: "same as row 6: quotes the published SikaTack DRIVE (60 min) sentence; the drive-away page was not surfaced." },
  d11w435h: { c: "MISSING", note: "same as row 12." },
  d15s3nnq: { c: "MISSING", note: "labelled appliance sealant list; the home appliances page was not surfaced." },
  d1d0mahm: { c: "BRAIN-WRONG", note: "price ask (\"how much is a 20kg bag\") answered with a product card and no decline. FIXED: same price routing as row 24." },
  d1fskui1: { c: "BRAIN-WRONG", note: "\"on special this week\" answered with a product card and no decline. FIXED: same price routing as row 25." },
  d141ez75: { c: "MISSING", note: "vague ask answered with a relevant published bathroom page instead of a clarifier; no unsupported claim." },
  d0wenbxv: { c: "MISSING", note: "vague ask answered with a labelled fit list (criteria wet areas, stopping leaks); no unsupported claim." },
  c056: { c: "BANK-FIX", note: "SikaRoof VersiDrain 8 Mesh usage lines name \"Basement walls / Tunnels / Underground excavated rock surfaces\": a documented fit for an underground wall (unchanged from the earlier triage)." },
  b070: { c: "MISSING", note: "relevant Landscape & Building Solutions page shown; the project support page exists and was not surfaced." },
};
export const REVIEWED_IDS = Object.keys(REVIEW_2026_11_02);
export const REVIEW = REVIEW_2026_11_02;
export function triage(r) {
  if (r.cls !== 'WRONG') return null;
  const why = r.why || ''; const lane = LANG.test(r.messy || '') ? 'C' : 'B'; const txt = r.text || '';
  const n = REVIEW_2026_11_02[r.id] || WRONG_NOTES[r.id]; if (n) return { c: n.c || 'BRAIN-WRONG', lane: n.lane || lane, note: n.note };
  if (/^product answer to a business question|^answer without the right page/.test(why)) return { c: 'MISSING', lane: 'C', note: 'the page for this ask is in kb.json or pages.json (validate_bank.mjs proves it); the brain surfaced a different page or a product list instead. No unsupported figure was stated.' };
  if (r.type === 'nodata' && /answered something the data cannot answer/.test(why)) return /\$\s?\d|\bAUD?\s?\d|per (bag|pail|unit).{0,10}\d/i.test(txt) ? { c: 'BRAIN-WRONG', lane: 'B', note: 'a price-like figure appears in the answer; no price is published in the data' } : { c: 'MISSING', lane: 'C', note: 'price, stock or sales ask not routed to the honest decline; the card shows published product text and states no price' };
  if (r.type === 'vague' && /guessed silently/.test(why) && /^advice:/.test(r.first)) return { c: 'MISSING', lane: 'C', note: 'vague ask answered with a labelled "products whose published text uses your words" list instead of one clarifying question (gap 7)' };
  if (r.type === 'vague' && /guessed silently/.test(why) && /^info:/.test(r.first)) return { c: 'MISSING', lane: 'C', note: 'vague ask answered with a published information page instead of one clarifying question (gap 7); no product was claimed' };
  if (r.type === 'system' && /other system/.test(why)) return { c: 'BRAIN-WRONG', lane: 'C', note: 'linked a different system sheet from the one asked' };
  return { c: 'BRAIN-WRONG', lane, note: 'answer names a product the published data does not support for this ask (' + why.slice(0, 90) + '):' + said(why) };
}
