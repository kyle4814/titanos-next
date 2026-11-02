// attrs.js: product facts that sit under a label on the published product page (shelf life, storage, density, temperature limits, mixing ratio, layer thickness,
// strengths, VOC, fire, chemical resistance, application steps, preparation, tools, standards, pack sizes, ...). Quoted as written, with the page link.
// A question about an attribute the page does not give for that product gets an honest "not published" card, never a guess.
import { normalise, tokens, stem, STOP, GENERIC, clampText } from './text.js';
import { card, fact, CHIPS } from './schema.js';
import { prod, unknown } from './cards.js';

const re = (s) => new RegExp(s, 'i');
export const ATTRS = [
  { id: 'packaging', what: 'pack sizes', q: re('\\b(pack(s|age|aging|aged|ed|ing)?|sizes?|comes? in|pallets?|bags? (on|per)|pail sizes?|how is .* (sold|supplied)|what size)\\b'), pack: true },
  { id: 'shelf', what: 'shelf life', q: re('shelf ?l[iy]fe?|how long (can|could|will|does|do|is)\\b.*\\b(store|keep|last|good for|stored|unopened)|expir|best before|use by|unopened'), labels: re('^shelf life$'), tbl: re('shelf life') },
  { id: 'storage', what: 'storage conditions', q: re('\\b(stor(e|ed|age|ing)|keep it|keeping)\\b'), labels: re('^(storage conditions|shelf life)$') },
  { id: 'density', what: 'density', q: re('density|weigh|weight|kg per (l|litre)|specific gravity'), labels: re('^density$'), tbl: re('density \\(uncured\\)|density') },
  { id: 'service_temp', what: 'service temperature', q: re('(service|once cured|after curing|withstand|resist\\w*|rating|how hot|heat resist\\w*)\\b.*temperature|temperature (resist\\w*|rating|it can (take|withstand|handle))|heat resist\\w*|how hot (can|will)|temperature can .* (take|withstand|handle)|take once cured'), labels: re('^(service temperature|temperature resistance)$'), tbl: re('service temperature') },
  { id: 'overcoat', what: 'waiting time before overcoating', q: re('overcoat|re-?coat|wait.*(before|until).*(coat|paint|apply)'), labels: re('^waiting time to overcoating$'), soft: true },
  { id: 'humidity', what: 'humidity limits', q: re('humidity|dew point|damp air'), labels: re('^(relative air humidity|dew point)$') },
  { id: 'app_temp', what: 'application temperature limits', q: re('temperature|too (cold|hot)|cold weather|hot weather|frost|freez\\w*|degrees|(cold|hot|winter|summer) (day|conditions)'), labels: re('^(ambient air temperature|substrate temperature|material temperature|application temperature)$') },
  { id: 'mixing', what: 'mixing ratio', q: re('mix(ing|ed)?\\b|water (to|do i)|parts|ratio|how much water|proportion'), labels: re('^(mixing ratio|mixing)$'), tbl: re('mixing ratio') },
  { id: 'thickness', what: 'layer thickness', q: re('thick|layer|depth|build ?up|how deep|minimum .*mm|maximum .*mm'), labels: re('^(layer thickness|thickness)$') },
  { id: 'thermal', what: 'thermal conductivity', q: re('thermal (conductivity|insulation|resistance value)|insulation value|insulating value|lambda value|r[- ]?value|\\bk[- ]value'), labels: re('thermal conductivity|thermal insulation|lambda') },
  { id: 'crack', what: 'crack bridging ability', q: re('crack[- ]?bridg\\w*|bridges? (the )?cracks?|bridging cracks?|crack (cover|span)\\w*'), labels: re('crack bridging') },
  { id: 'sag', what: 'sag flow', q: re('sag ?flow|sag resistance|non[- ]?sag|slump resistance|sags?\\b.*(overhead|vertical)'), labels: re('^(sag flow|non-?sag properties)$'), tbl: re('non-sag properties') },
  { id: 'strength', what: 'strength', q: re('strength|adhesion|bond strength|\\bmpa\\b|how strong'), labels: re('strength|adhesion'), dyn: true },
  { id: 'voc', what: 'VOC content', q: re('\\bvoc\\b|volatile|emission'), labels: re('voc|volatile') },
  { id: 'fire', what: 'reaction to fire', q: re('fire|flammab|combustib|burn|fire rating'), labels: re('reaction to fire|fire') },
  { id: 'chem', what: 'chemical resistance', q: re('chemical(?! base)|acid|resistan|resist (to )?'), labels: re('chemical resistance') },
  { id: 'movement', what: 'movement capability', q: re('movement|elongation|stretch|how flexible'), labels: re('^(movement capability|elongation)$'), tbl: re('movement capability|elongation at break') },
  { id: 'hardness', what: 'hardness', q: re('hardness|shore|how hard'), labels: re('shore|hardness'), tbl: re('shore [a-d] hardness') },
  { id: 'steps', what: 'application steps', q: re('how (do|to|should|can|would) (i|you|we)? ?(apply|use|install|lay|fix|put on|do it)|application (method|steps|instructions)|apply it|instructions|directions|how is .* applied'), labels: re('^(application|application instructions)$') },
  { id: 'prep', what: 'substrate preparation', q: re('prepar|substrate (prep|quality|condition|needs)|how (do|should) i prep|surface (prep|needs)|what surface'), labels: re('^(substrate preparation|substrate quality|surface preparation)$') },
  { id: 'clean', what: 'cleaning of equipment', q: re('clean(ing)? (the |my |off )?(tools|equipment|brush|trowel|roller)|wash (off|up|out)|remove(d)? (uncured|wet)|clean up'), labels: re('^(cleaning of equipment|removal)$') },
  { id: 'tools', what: 'equipment', q: re('\\b(tools?|equipment|what do i need to apply|trowel|mixer|drill|roller|notch)\\b'), labels: re('^equipment$') },
  { id: 'standards', what: 'standards and certificates', q: re('standard|classification|\\bas ?\\d{4}|\\ben ?\\d{3,}|\\biso\\b|certificat|approval|approved|ce mark|meets|compl(y|ies|iance)'), labels: re('^(approvals \\/ certificates|certificates and test reports|product declaration)$') },
  { id: 'dims', what: 'dimensions', q: re('dimension|length|width|diameter|roll size|sheet size|how (long|wide)'), labels: re('^(dimensions|length|diameter|height|width|mass per area)$') },
  { id: 'composition', what: 'composition', q: re('made of|composition|chemical base|ingredients|what.s in it|what is it based on'), labels: re('^composition$'), tbl: re('chemical base') },
  { id: 'colour', what: 'colour', q: re('colou?rs?|shades?|appearance'), labels: re('colou?r|appearance|shade'), textRx: re('colou?r') },
  { id: 'property', what: 'that property', q: re('\\b(waterproof|water resistant|uv resistant|uv|weatherproof|paintable|paint over|non[- ]?slip|slip resist\\w*|odour|odor|solvent[- ]free|toxic|food (safe|grade)|potable|drinking water)\\b'), textFromQ: true },
];
const PROP_RX = { waterproof: re('waterproof|water[- ]?tight|watertight'), 'water resistant': re('water resist|waterproof'), uv: re('\\buv\\b|ultra ?violet|weather'), 'uv resistant': re('\\buv\\b|ultra ?violet'), weatherproof: re('weather'), paintable: re('paint'), 'paint over': re('paint'), 'non-slip': re('slip'), 'non slip': re('slip'), 'slip resist': re('slip'), odour: re('odou?r'), odor: re('odou?r'), 'solvent-free': re('solvent[- ]free|solvent free'), 'solvent free': re('solvent[- ]free|solvent free'), toxic: re('toxic|harm|hazard'), 'food safe': re('food'), 'food grade': re('food'), potable: re('potable|drinking'), 'drinking water': re('potable|drinking') };

/** The "Typical Product Data" table is stored as one pipe-separated passage ("Shelf life | | 9 months C | CQP = ..."); lift the one row that carries the asked label. */
export function tblRow(sh, rx) {
  for (const it of sh.d.sec || []) {
    const t = String(it.t || ''); if (!/ \| /.test(t)) continue;
    const m = t.match(new RegExp('(?:^|\\s\\|\\s|\\s)(' + rx.source + ')[^|]{0,60}?(?: \\|){1,2} ', 'i')); if (!m) continue;
    let tail = t.slice(m.index + (m[0].startsWith(' ') ? 1 : 0));
    const cut = tail.search(/ \| (?:[A-Z][A-Za-z\-\/ ]{2,40}(?: \([^)]*\))?|CQP|[A-D]\)) ?(?:\||=|\s[A-Z0-9a-z])/); // next row label / footnote
    const first = tail.indexOf(' | ');
    let end = tail.length; const rest = tail.slice(first + 3);
    const nx = rest.search(/ \| (?=[A-Z][A-Za-z\-\/ ]{2,40}(?: \([^)]*\))? \|)/); if (nx >= 0) end = first + 3 + nx; else end = Math.min(end, 160);
    void cut;
    const row = tail.slice(0, end).replace(/ \| (?:CQP|[A-D]\)) .*$/, '').replace(/(?:\s*\|\s*)+/g, ' | ').replace(/^\s*\|\s*|\s*\|\s*$/g, '').trim();
    const val = row.replace(new RegExp('^' + rx.source + '[^|]*\\| ?', 'i'), '').replace(/^\| ?/, '').trim();
    if (val.length > 2) return val;
  }
  return null;
}
export const attrWords = () => ATTRS.flatMap((a) => (a.q.source.match(/[a-z]{5,}/g) || []));
const pick = (n) => ATTRS.find((a) => a.q.test(n));
const title = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());

export function detectAttr(n) { return pick(n); }
export function attrCard(sh, n, q, soft) {
  const a = pick(n); if (!a) return null;
  const rows = []; const add = (label, text, url) => { text = String(text || '').replace(/\s+/g, ' ').trim(); if (text.length < 2) return; if (rows.some((r) => r.text === text)) return; rows.push({ label, text, url: url || sh.u, doc: 'WEB' }); };
  if (a.pack) { for (const f of sh.pk || []) { rows.push({ label: 'Packaging', text: f.text, url: f.s && f.s.u ? f.s.u : sh.u, doc: f.s && f.s.t ? f.s.t : 'WEB', ver: f.s ? f.s.v : '', page: f.s ? f.s.p : null }); } if (!rows.length && sh.d.pk) add('Packaging', sh.d.pk); for (const it of sh.d.sec || []) if (/^(dimensions|diameter|length|height|width)$/i.test(it.l) && /sizes?|pack/i.test(n)) add(title(it.l), it.t); }
  else if (a.textFromQ) {
    const m = n.match(a.q); const rx = PROP_RX[m && m[1]] || re(m ? m[1] : 'xxxx');
    const pool = [...(sh.d.us || []), ...(sh.d.a || []), sh.d.s, sh.d.t, ...(sh.d.sec || []).map((x) => x.t)].filter(Boolean);
    for (const t of pool) { const segs = String(t).split(/(?<=[.!?])\s+|\s+[•·]\s+/).filter(Boolean); for (const s of segs) if (rx.test(s) && rows.length < 3) add('Published', s); }
  } else {
    let lab = a.labels;
    if (a.dyn) { const w = /compressive/.test(n) ? 'compressive' : /tensile/.test(n) ? 'tensile' : /flexur|bending/.test(n) ? 'flex' : /adhesion|bond|pull/.test(n) ? 'adhesion|bond' : null; if (w) lab = new RegExp(w, 'i'); }
    for (const it of sh.d.sec || []) if (lab && lab.test(it.l) && it.t) add(title(it.l || a.what), it.t);
    if (!rows.length && a.tbl) { const t = tblRow(sh, a.tbl); if (t) add(title(a.what), t); }
    if (!rows.length && a.textRx) { const pool = [...(sh.d.us || []), ...(sh.d.a || []), sh.d.s, sh.d.t].filter(Boolean); for (const t of pool) if (a.textRx.test(t) && rows.length < 2) add('Published', t); }
    if (a.id === 'app_temp' || a.id === 'thickness') for (const it of sh.d.sec || []) if (/^(application)$/i.test(it.l) && a.id === 'thickness' && /thick|layer|mm/i.test(it.t) && !rows.length) add('Application', it.t);
  }
  const hint = new Set(tokens(n));
  // a long passage keeps the sentence with the figure in it, not just the one that shares most words with the question
  for (const r of rows) if (r.text.length > 270) { const segs = r.text.split(/(?<=[.!?])\s+|\s+\|\s+/).filter(Boolean); if (segs.length > 1) { const sc = (g) => tokens(g).filter((t) => hint.has(t)).length + (/\d/.test(g) ? 3 : 0); r.text = segs.reduce((b, g) => (sc(g) > sc(b) ? g : b), segs[0]); } }
  if (!rows.length) {
    // a published question and answer on the same page ("Can I paint over 11 FC+?")
    const qa = faq(sh, n); if (qa) return qa;
    if (soft) return null;
    return unknown(q, sh, `The published product page and data sheet text I work from do not give ${a.what} for ${sh.n}. I will not guess it. Please check the data sheet or ask Technical Services.`, [a.what]);
  }
  const used = rows.slice(0, 3);
  const facts = used.map((r) => fact({ source_url: r.url, page: r.page == null ? null : r.page, sentence: clampText(r.text, hint), doc_type: r.doc, doc_version: r.ver || '' }));
  return card({ type: 'info', title: `${title(a.what)}: ${sh.n}`, product: prod(sh), headline: `The published ${a.what} for ${sh.n}, quoted as written.`, lines: used.map((r, i) => ({ label: r.label, text: facts[i].sentence })), facts, source: facts[0], chip: facts[0].doc_type === 'PDS' ? CHIPS.DATASHEET : CHIPS.PAGE,
    links: [{ label: 'Open the product page', url: sh.u }], followups: [`Data sheet for ${sh.n}`, `Coverage of ${sh.n}`] });
}
/** A question the product page itself asks and answers. Needs most of the question's content words to appear in the published question. */
export function faq(sh, n) {
  const qt = [...new Set(tokens(n).filter((t) => !GENERIC.has(t) && t.length > 2))].filter((t) => !tokens(sh.n).includes(t)); if (qt.length < 2) return null;
  let best = null, bs = 0;
  for (const it of sh.d.sec || []) { if (!/\?$/.test(it.g || '')) continue; const gt = new Set(tokens(it.g)); const c = qt.filter((t) => gt.has(t)).length; const cov = c / qt.length; if (c >= 2 && cov >= 0.6 && c > bs) { bs = c; best = it; } }
  if (!best) return null;
  const f = fact({ source_url: sh.u, page: null, sentence: clampText(best.t, new Set(qt)), doc_type: 'WEB' });
  return card({ type: 'info', title: best.g, product: prod(sh), headline: `${sh.n}: the product page asks and answers this.`, lines: [{ label: 'Published answer', text: f.sentence }], facts: [f], source: f, chip: CHIPS.PAGE, links: [{ label: 'Open the product page', url: sh.u }], followups: [`Data sheet for ${sh.n}`] });
}
