// know.js: business and general questions, answered from Sika Australia's own public pages (data/brain/kb.json, compiled from the crawl by scripts/sika-brain/build_know.mjs).
// No model, no network beyond the shard loader. Every answer quotes a published line with its page link; when no line covers the question the answer says so.
import { normalise, tokens, STOP, GENERIC, clampText, dist } from './text.js';
import { card, fact, CHIPS, NOT_KNOWN } from './schema.js';

const SITE = 'https://aus.sika.com/en/';
const LINKS = { contact: SITE + 'Contact.html', whereToBuy: SITE + 'where-to-buy.html', careers: SITE + 'about-us/careers.html', about: SITE + 'about-us.html', dataSheets: SITE + 'documents-resources/pds.html', sds: SITE + 'documents-resources/material-safety-data-sheets.html', warranty: SITE + 'documents-resources/warranty-portal.html', training: SITE + 'Undertile-Waterproofing-training.html', tileDistributors: SITE + 'SikaTile-distributors.html', terms: SITE + 'terms-and-conditions.html', homeOwners: SITE + 'home-owners.html' };
const RETAILER = /\b(bunnings|mitre ?10|reece|bowens|tradelink|tilers? warehouse|beaumont|hardware store|kmart|amazon|ebay|woolworths|total tools|home hardware)\b/;
// words that say "this is a question about the company or the site, not about choosing a product"
const SIGNAL = /\b(contact (sika|us|details|number|info)|phone (number|no|numbr|sika)|telephone|tel (number|no)|ring (sika|them|you)|fax|head office|office address|email|technical (services?|support|help|team|advice|enquir\w+|department)|help ?line|customer service|where (can|do|could|would|to) (i|we) (buy|get|find|purchase|order)|where to buy|stockists?|retailers?|distributors?|dealers?|resellers?|warrant(y|ies)|guarantee|(davco|lanko|schonox|sarnafil)\b.*\b(part of|family|owned|company|history|since|brand|packag\w*|colou?r|bags?|formula|changed|new look|mascot|about)\b|part of sika|company|careers?|training|course|workshop|sustainab\w*|epd|environmental|green star|voc|bim|software|calculat(or|ion) software|terms and conditions|legal|privacy|imprint|diy|home ?owner|blog|reference projects?|case stud(y|ies)|remedial|project support|project support|sika engineers|global project|key project|large projects?|b2b|e-?shop|online shop|trade account|pre[- ]?treatment chart|catalogue|brochure)\b/;
const DEFN = /^(what (is|are)\b|what.s (a|an|the)|what (does|do) .* (mean|stand for)|why (do|does|is|are)|explain|how (does|do) .* work|who (is|are|owns?|makes?)|how long has|when (did|was)|is .* part of|are .* part of|has .* (changed|been)|did .* change)/;
const KG = new Set([...GENERIC].filter((w) => w !== 'davco' && w !== 'tile'));
const NUMW = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10' };
const FILLER = new Set('sika sikas australia australian tell know find want like get give show need tell help please best good great right info information details about product products range thing stuff someone anything'.split(' '));
const SYN = [['company', 'brand', 'family', 'owned', 'part'], ['phone', 'telephone', 'call', 'ring', 'number'], ['address', 'office', 'located', 'location'], ['buy', 'stockist', 'distributor', 'retailer', 'purchase'], ['training', 'course', 'workshop', 'webinar'], ['warranty', 'guarantee'], ['contact', 'enquiry', 'enquir', 'touch'], ['job', 'career', 'employment'], ['sustainable', 'sustainability', 'impact', 'environmental'], ['colour', 'color', 'packaging'], ['library', 'hub', 'documents', 'resources']];

export function createKnow({ load }) {
  let kb = null, idx = null, df = null, N = 0;
  async function boot() {
    if (kb) return kb; kb = await (load.kb ? load.kb() : null); if (!kb) return null;
    idx = new Map(); df = new Map(); const units = [];
    kb.pages.forEach((p, pi) => { const tt = new Set(tokens(p.t)); p.l.forEach((line, li) => { const t = new Set(tokens(line)); units.push({ pi, li, kind: 'page', t, tt }); }); });
    (kb.prod || []).forEach((e, ei) => { units.push({ ei, kind: 'prod', t: new Set(tokens(e.n + ' ' + e.l + ' ' + e.x)), tt: new Set() }); });
    N = units.length; kb.units = units;
    units.forEach((u, ui) => { for (const t of u.t) { let a = idx.get(t); if (!a) idx.set(t, a = []); a.push(ui); } });
    for (const [t, a] of idx) df.set(t, a.length);
    return kb;
  }
  const idf = (t) => Math.log(1 + N / (df.get(t) || N));
  const vocabFix = (t) => { if (!idx || idx.has(t) || t.length < 5 || /\d/.test(t)) return t; const max = t.length >= 9 ? 2 : 1; let best = t, bd = 9, bdf = 0; for (const [v, a] of idx) { if (Math.abs(v.length - t.length) > max) continue; const d = dist(t, v, max); if (d > max) continue; if (d > 1 && t.slice(0, 2) !== v.slice(0, 2)) continue; if (d < bd || (d === bd && a.length > bdf)) { best = v; bd = d; bdf = a.length; } } return best; };
  const qTokens = (n, noCap) => { if (/\bhow long (has|have|had)\b/.test(n)) n = n.replace(/\bhow long\b/, 'since'); const base = [...new Set(tokens(n.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g, (m) => NUMW[m])).filter((t) => !KG.has(t) && !FILLER.has(t) && t.length > 0).map(vocabFix))]; const q = new Map(base.map((t) => [t, 1])); if (idx && !noCap && base.length > 5) { const keep = new Set([...base].sort((a, b) => idf(b) - idf(a)).slice(0, 5)); for (const t of [...q.keys()]) if (!keep.has(t)) q.delete(t); }
    for (const g of SYN) { const gt = g.map((x) => tokens(x)[0]); if (gt.some((t) => q.has(t))) for (const t of gt) if (!q.has(t)) q.set(t, 0.5); } return q; };
  function search(n, filter0) {
    const wantProj = /\b(project|projects|case stud\w+|reference|references|built|completed|used (on|at|in)|stadium|tower|bridge)\b/.test(n);
    const filter = (u) => (!filter0 || filter0(u)) && (wantProj || u.kind !== 'page' || kb.pages[u.pi].k !== 'project');
    const q = qTokens(n); const prim = [...q].filter(([, w]) => w >= 1).map(([t]) => t); if (!prim.length) return null;
    const score = new Map();
    for (const [t, w] of q) { const a = idx.get(t); if (!a) continue; const wi = w * idf(t); for (const ui of a) { if (filter && !filter(kb.units[ui])) continue; const e = score.get(ui) || { s: 0, hit: new Set() }; e.s += wi; if (w >= 1) e.hit.add(t); score.set(ui, e); } }
    const items = [];
    for (const [ui, e] of score) { const u = kb.units[ui]; const cov = e.hit.size / prim.length; let s = e.s * (0.3 + 0.7 * cov) * (u.kind === 'page' && (kb.pages[u.pi].k === 'site' || kb.pages[u.pi].k === 'diy') ? 1.15 : 1); if (u.kind === 'page') for (const t of prim) if (u.tt.has(t)) s += 1.2 * idf(t); items.push({ ui, s, cov, hit: e.hit.size, u }); }
    items.sort((a, b) => b.s - a.s || a.ui - b.ui);
    return { items, prim, q };
  }
  const pageFact = (p, line, hint) => fact({ source_url: p.u, page: null, sentence: clampText(line, hint, 240), doc_type: 'WEB' });
  const hintOf = (n) => new Set(tokens(n));
  function infoCard({ title, headline, rows, links, question, status }) {
    const facts = rows.map((r) => r.fact);
    return card({ type: 'info', status: status || 'PUBLISHED', title, headline, lines: rows.map((r) => ({ label: r.label, text: r.fact.sentence })), facts, source: facts[0] || null, chip: CHIPS.SITE, links: links || [], followups: [] });
  }
  const linkOf = (label, url) => ({ label, url });
  const pageBy = (rx) => kb.pages.find((p) => rx.test(p.u));
  const linesOf = (p, rxs) => (p ? p.l.filter((l) => rxs.some((r) => r.test(l))) : []);
  function unknownInfo(question, reason, links) { const c = card({ type: 'unknown', status: 'UNKNOWN', title: 'Not in the published documentation', headline: NOT_KNOWN, facts: [], source: null, chip: CHIPS.UNKNOWN, links: links || [], handoff: { question, product: '', reason, missing: [] } }); return c; }

  /** Pointer topics: questions about the company that have a known published home. Returns a card or null. */
  async function topic(q, n) {
    await boot(); if (!kb) return null;
    const hint = hintOf(n);
    const has = (rx) => rx.test(n);
    if (/\b(is|are|was)\b.*\b(davco|lanko|schonox|sarnafil|sikatile)\b.*\b(sika|company|brand|owned|part of|family)\b/.test(n)) { const p = pageBy(/construction\/davco\.html/); const ls = linesOf(p, [/a Sika brand/i, /part of the Sika family/i]); if (p && ls.length) return infoCard({ title: 'Davco and Sika', headline: "Sika Australia's own page about Davco.", rows: ls.slice(0, 2).map((l, i) => ({ label: i === 0 ? 'Published' : '', fact: pageFact(p, l, hint) })), links: [linkOf(p.t, p.u)] }); }
    if (has(/\b(warrant(y|ies)|guarantee)\b/)) {
      if (/\b(how long|how many years|years|duration|period|expire|expiry|last)\b/.test(n)) return unknownInfo(q, 'The published warranty portal text does not give a warranty period, so I will not guess one. Please ask Sika Australia Technical Services.', [linkOf('Warranty portal', LINKS.warranty)]);
      const p = pageBy(/warranty-portal/); if (p) { const ls = p.l.slice(0, 12).filter((l) => !/^(Document|Step \d|Register to access)/i.test(l)); if (ls.length) return infoCard({ title: 'Sika Australia warranty portal', headline: "This is what Sika Australia's own warranty page says.", rows: ls.map((l, i) => ({ label: i === 0 ? 'Published' : '', fact: pageFact(p, l, hint) })), links: [linkOf('Open the warranty portal', LINKS.warranty)] }); }
    }
    if (has(/\b(contact|helpline|help ?line|phone|call|support|customer service)\b/) && has(/\b(hours|opening hours|open (on|until|late|today|weekends?|saturday|sunday)|closes?|closed|after hours|what time|weekend|saturday|sunday)\b/) && !has(/open time/)) return unknownInfo(q, 'Opening hours and call times are not in the documentation I work from, and I will not guess them. Sika Australia publishes a contact page.', [linkOf('Sika Australia contact page', LINKS.contact)]);
    if (has(/\b(contact (sika|us|details|number|info|information|someone|a person)|phone (number|no|numbr|sika|them|you)|telephone|tel (number|no)|ring (sika|them|you)|fax|head office|office address|email|who do i call|call (sika|you|them|someone)|reach sika|speak (to|with) (someone|a person|sika)|talk to (someone|a person)|technical (services?|support|help|team|advice|enquir\w+|department)|help ?line|customer service|get in touch)\b/) && !has(/contact (adhesive|cement|glue|cleaner)/)) {
      const p = pageBy(/\/imprint\.html/); const p2 = pageBy(/concrete-repair-contact/);
      const rows = [];
      for (const l of linesOf(p, [/Head Office/i, /^Wetherill/i, /^Phone/i])) rows.push({ label: /Head Office/i.test(l) ? 'Head office' : /Phone/i.test(l) ? 'Phone' : 'Address', fact: pageFact(p, l, hint) });
      for (const l of linesOf(p2, [/Technical Enquiry/i])) rows.push({ label: 'Technical enquiries', fact: pageFact(p2, l, hint) });
      if (rows.length) return infoCard({ title: 'Contacting Sika Australia', headline: "Sika Australia's own published contact details. Technical questions go through the contact page.", rows, links: [linkOf('Sika Australia contact page', LINKS.contact), linkOf('Concrete repair and protection contact page', p2 ? p2.u : LINKS.contact)] });
    }
    if (has(/\b(where (can|do|could|would|to|should) (i|we|you)? ?(buy|get|purchase|source|order)|where to buy|(find|locate) (a |the |my )?(local )?(stockist|retailer|distributor|dealer|store|shop)|stockists?|retailers?|distributors?|dealers?|resellers?|buy (sika|davco|it|these|from)|can i buy)\b/) && !has(/\b(price|cost|how much|cheap|discount|sds|data ?sheet|pds)\b/)) {
      if (RETAILER.test(n)) return unknownInfo(q, 'Which retailers stock which products is not in the documentation I work from, and I will not guess. Sika Australia publishes a Where to Buy page.', [linkOf('Where to buy', LINKS.whereToBuy)]);
      if (/\b(become|apply|join|stock sika|sell sika|trade account|b2b)\b/.test(n)) return null;
      const f1 = fact({ source_url: 'https://aus.sika.com/en/construction/tile-stone-installationsystems/tile-adhesives/sikatile-405-lite.html', sentence: 'Find a stockist', doc_type: 'WEB' });
      const p = pageBy(/SikaTile-distributors/);
      const rows = [{ label: 'Published', fact: f1 }]; if (p) rows.push({ label: 'SikaTile', fact: pageFact(p, p.l[0], hint) });
      return infoCard({ title: 'Where to buy Sika Australia products', headline: 'Sika Australia publishes a Where to Buy page. The stockist list itself is not in the documentation I work from, so please open the page.', rows, links: [linkOf('Where to buy', LINKS.whereToBuy), linkOf('SikaTile distributors', LINKS.tileDistributors)] });
    }
    if (has(/\b(careers?|employment|work (for|at) sika|vacanc\w+|hiring|job (openings?|ads?|vacanc\w+|opportunit\w+)|jobs? (at|with) sika|apply for a job)\b/)) {
      const f1 = fact({ source_url: SITE + 'construction/davco.html', sentence: 'Careers', doc_type: 'WEB' });
      return infoCard({ title: 'Careers at Sika Australia', headline: 'Sika Australia lists Careers in its own site menu. The vacancies themselves are on that page, not in the documentation I work from.', rows: [{ label: 'Site menu', fact: f1 }], links: [linkOf('Sika Australia careers', LINKS.careers)] });
    }
    if (has(/\b(training|training courses?|workshop|webinar|accredit\w*|apprentice\w*)\b/) && !has(/\b(ppe|safety)\b/)) {
      const p = pageBy(/warranty-portal/); const ls = linesOf(p, [/training/i]);
      const rows = ls.slice(0, 1).map((l) => ({ label: 'Published', fact: pageFact(p, l, hint) }));
      if (rows.length) return infoCard({ title: 'Training from Sika Australia', headline: "Sika Australia's site lists an Undertile Waterproofing training page. Dates, cost and content are not in the documentation I work from, so please open it or ask Technical Services.", rows, links: [linkOf('Undertile Waterproofing training', LINKS.training), linkOf('Sika Australia contact page', LINKS.contact)] });
    }
    { const m = /\b(sell|supply|offer|make|have|do|provide)\b.*\b(automotive|marine|boats?|yachts?|wind (farm|energy|turbines?)|solar|rail|transport\w*|buses|trucks|caravans?|appliances?|elevators?|textiles?|building components|facade)\b|\b(industry|industries)\b.*\b(automotive|marine|solar|rail|transport\w*)\b|^(sika )?(automotive|marine|boat|wind energy|solar|rail|building components|textiles?)( glass bonding| range| products?| solutions?| adhesives?)?$/.exec(n);
      if (m) { const map = [[/automotive/, /industry\/automotive-aftermarket\.html/], [/marine|boat|yacht/, /industry\/marine\.html/], [/wind/, /wind-energy\.html/], [/solar/, /solar\.html/], [/rail|transport|bus|truck|caravan/, /industry\/transportation\.html/], [/appliance|elevator/, /appliance-and-equipment/], [/textile/, /textiles-and-consumables\.html/], [/building components|facade/, /building-components\.html/]]; const hit = map.find(([r]) => r.test(n)); const p = hit && pageBy(hit[1]); if (p) return infoCard({ title: p.t, headline: `From Sika Australia's published page "${p.t}".`, rows: p.l.filter((l) => l.length > 40).slice(0, 2).map((l, i) => ({ label: i === 0 ? 'Published' : '', fact: pageFact(p, l, hint) })), links: [linkOf(p.t, p.u)] }); } }
    if (has(/\b(terms and conditions|terms of (sale|trade|use)|conditions of sale)\b/)) { const p = pageBy(/terms-and-conditions\.html$/); if (p) return infoCard({ title: 'Terms and conditions', headline: "Sika Australia's terms and conditions are published as a document on its site.", rows: [{ label: 'Published', fact: pageFact(p, p.l[0], hint) }], links: [linkOf('Open the terms and conditions', LINKS.terms)] }); }
    if (has(/\b(legal notice|privacy|imprint|disclaimer)\b/)) { const p = pageBy(/legal-notice\.html$/); if (p) return infoCard({ title: 'Legal notice', headline: "Sika Australia's own legal notice.", rows: p.l.slice(1, 3).map((l) => ({ label: 'Published', fact: pageFact(p, l, hint) })), links: [linkOf('Open the legal notice', p.u)] }); }
    if (has(/\b(data ?sheets?|pds|tds)\b/) && has(/\b(where|find|all|every|library|download|list)\b/) && !has(/\b(for|of) [a-z]/)) { const p = pageBy(/documents-resources\/pds\.html/); if (p) return infoCard({ title: 'Product data sheets', headline: "Sika Australia keeps every product data sheet in one library on its site. I can also give you the data sheet for a named product.", rows: [{ label: 'Published', fact: pageFact(p, p.l[0], hint) }], links: [linkOf('Product data sheet library', LINKS.dataSheets)] }); }
    if (has(/\b(sds|msds|safety data sheets?)\b/) && has(/\b(where|find|kept|all|every|library|download|list)\b/) && !has(/\b(for|of) [a-z]/)) { const p = pageBy(/material-safety-data-sheets/); if (p) return infoCard({ title: 'Safety data sheets', headline: "Sika Australia keeps its safety data sheets in one library on its site. I can also give you the safety data sheet for a named product.", rows: [{ label: 'Published', fact: pageFact(p, p.l[0], hint) }], links: [linkOf('Safety data sheet library', LINKS.sds)] }); }
    return null;
  }

  /** Standard and class codes ("AS 3740", "C2TE S1", "class III", "EN 1504"): the products whose own published lines carry that code. */
  async function codeSearch(q, n, opts) {
    let rx = null, what = '';
    let m = /\b(?:as|nzs|iso|en)\s?(?:iso\s?)?(\d{3,5})\b/.exec(n); if (m) { rx = new RegExp('(AS|NZS|ISO|EN)[ /]?(NZS|ISO)? ?' + m[1], 'i'); what = m[0].toUpperCase(); }
    if (!rx) { m = /\bc([12])(?:t?e?s?([12])?)?\b/.exec(n) && /\bc([12])(t?e?s?([12])?)\b/.exec(n); if (m && /\b(c1|c2|c2t|c2tes1|c2tes2|c2te|classified|classification|adhesive|class)\b/.test(n)) { rx = new RegExp('\\bC' + m[1] + (m[2] ? m[2].replace(/s([12])/, '') : '') + (/s([12])/.test(m[2] || '') ? '' : ''), 'i'); what = m[0].toUpperCase(); } }
    if (!rx) { m = /\bclass (iii|ii|i|iv|[1-4])\b/.exec(n); if (m) { rx = new RegExp('class ' + (m[1] === '3' ? '(iii|3)' : m[1]) + '\\b', 'i'); what = 'class ' + m[1].toUpperCase(); } }
    if (!rx) return null;
    if (/^class /.test(what) && opts && opts.kind) return null;
    await boot(); if (!kb) return null;
    const seen = new Set(); const rows = []; const links = [];
    for (const e of kb.prod || []) { if (e.l !== 'Published standard' && !/certif|approv|declar/i.test(e.l)) continue; if (!rx.test(e.x) || seen.has(e.p)) continue; seen.add(e.p); rows.push({ label: e.n.replace(/[\u2013\u2014]/g, '-'), fact: fact({ source_url: e.u, sentence: clampText(e.x, null, 240), doc_type: 'WEB' }) }); links.push(linkOf(e.n.replace(/[\u2013\u2014]/g, '-'), e.u)); if (rows.length >= 6) break; }
    if (!rows.length) return unknownInfo(q, `None of the product pages I work from quotes ${what} in its published text, so I will not say which products meet it. Please ask Technical Services.`, []);
    return infoCard({ title: 'Published lines that carry that code', headline: 'These products carry that code in their own published text. Each line is quoted from the product page, and I am claiming nothing beyond what the line says.', rows, links });
  }
  /** A question that is (nearly) the name of a published page: "three must haves for builders", "leaking shower". */
  async function titleMatch(q, n, hasKind, strictOnly) {
    await boot(); if (!kb) return null;
    const qs = qTokens(n, true); const qset = new Set([...qs].filter(([, w]) => w >= 1).map(([t]) => t)); if (qset.size < 2) return null;
    const wantProj = /\b(project|projects|case stud\w+|reference|references)\b/.test(n);
    let best = null;
    for (const p of kb.pages) {
      if (p.k === 'project' ? !wantProj : !(p.k === 'diy' || p.k === 'article' || p.k === 'site')) continue;
      if (!p.tt) p.tt = [...new Set(tokens(p.t).filter((t) => !KG.has(t) && !FILLER.has(t)))];
      if (p.tt.length < 2) continue; const m = p.tt.filter((t) => qset.has(t)).length; if (m < 2 || (strictOnly && (m < 3 || m / p.tt.length < 0.9))) continue;
      const tc = m / p.tt.length, qc = m / qset.size; if (!(tc >= 0.8 || (qc >= 0.66 && (!hasKind || p.k === 'diy')))) continue;
      const sc = tc + qc + (p.k === 'diy' ? 0.1 : 0); if (!best || sc > best.sc) best = { p, sc, tc, qc };
    }
    if (!best || best.tc + best.qc < 1.1) return null;
    const p = best.p; const hint = hintOf(n); const body = p.l.slice(1).filter((l) => l.length > 30).slice(0, 3);
    const rows = (body.length ? body : p.l.slice(0, 2)).map((l, i) => ({ label: i === 0 ? 'Published' : '', fact: pageFact(p, l, hint) }));
    return infoCard({ title: p.t, headline: `From Sika Australia's published page "${p.t}".`, rows, links: [linkOf(p.t, p.u)] });
  }
  /** General retrieval over the page lines. mode 'strict' needs near-full coverage of the question's words. */
  async function retrieve(q, n, { prodToo = true, strict = true } = {}) {
    await boot(); if (!kb) return null;
    const res = search(n, prodToo ? null : (u) => u.kind === 'page'); if (!res || !res.items.length) return null;
    if (typeof process !== 'undefined' && process.env && process.env.KNOW_DEBUG) console.log(res.prim, res.items.slice(0, 3).map((it) => [it.s.toFixed(1), it.hit, it.cov, it.u.kind === 'page' ? kb.pages[it.u.pi].t + ' :: ' + kb.pages[it.u.pi].l[it.u.li].slice(0, 60) : 'prod']));
    const top = res.items[0]; const need = res.prim.length <= 1 ? 1 : res.prim.length === 2 ? 2 : Math.ceil(res.prim.length * (strict ? 0.75 : 0.6));
    if (top.hit < Math.min(need, res.prim.length <= 4 && top.hit >= 2 && top.s >= 12 ? 2 : need) || top.s < (res.prim.length <= 1 ? 6.5 : res.prim.length === 2 && top.hit >= 2 ? 3.5 : 6)) return null;
    if (res.prim.length <= 1 && top.u.kind === 'page' && !top.u.tt.has(res.prim[0])) return null;
    const hint = hintOf(n);
    if (top.u.kind === 'prod') { // corpus-wide product lines: certifications, VOC and the like
      const seen = new Set(); const rows = []; const links = [];
      for (const it of res.items) { if (it.u.kind !== 'prod' || it.hit < need) continue; const e = kb.prod[it.u.ei]; if (seen.has(e.p)) continue; seen.add(e.p); rows.push({ label: e.n.replace(/[\u2013\u2014]/g, '-'), fact: fact({ source_url: e.u, sentence: clampText(e.x, hint), doc_type: 'WEB' }) }); links.push(linkOf(e.n.replace(/[\u2013\u2014]/g, '-'), e.u)); if (rows.length >= 6) break; }
      return infoCard({ title: 'Published lines that match', headline: 'These products carry a published line that matches your question. Each line is quoted from the product page.', rows, links });
    }
    { const rare = [...res.prim].sort((a, b) => idf(b) - idf(a))[0]; if (res.prim.length >= 3 && top.u.kind === 'page' && !top.u.t.has(rare) && !top.u.tt.has(rare)) return null; }
    const pg = kb.pages[top.u.pi]; const same = [top].concat(res.items.filter((it) => it !== top && it.u.kind === 'page' && it.u.pi === top.u.pi && it.hit >= Math.max(1, Math.min(need, top.hit) - 1) && it.s >= top.s * 0.3)).slice(0, 4);
    const lis = new Set(same.map((it) => it.u.li)); for (const li of [...lis]) if (/\?$/.test(pg.l[li]) && pg.l[li + 1]) lis.add(li + 1);
    const rows = [...lis].sort((a, b) => a - b).slice(0, 5).map((li) => ({ u: { li } })).map((it, i) => ({ label: i === 0 ? 'Published' : '', fact: pageFact(pg, pg.l[it.u.li], hint) }));
    return infoCard({ title: pg.t, headline: `From Sika Australia's published page "${pg.t}".`, rows, links: [linkOf(pg.t, pg.u)] });
  }
  return { weakSignal: (n) => /\b(voc|green star|sustainab\w*|epd|environmental|certif\w*)\b/.test(n), domainOk: (n) => true, words: () => [...new Set([SIGNAL.source, DEFN.source].join(' ').match(/[a-z]{5,}/g).concat(['automotive', 'marine', 'industry', 'sustainability', 'conditions', 'terms', 'warranty', 'contact', 'training']))], topic, retrieve, titleMatch, codeSearch, signal: (n) => SIGNAL.test(n), definitional: (n) => DEFN.test(n), boot };
}
