// apply.js: provenance, page-cited facts, safety quotes, published times and yes/no compatibility on top of the rule-based engine.
// Pure code: no DOM, no network. The caller supplies load(productId) -> the product's k file (or null). Nothing here is paraphrased:
// every number, "not suitable" statement, hazard or time that is shown carries evidence {quote, url, label, kind, page?, version?} or the "Not in the published data" status.
import { plain, clip } from './answer.js';
import { timeAnswer, TIME_RE } from './times.js';
import { uncoveredTerms } from './handoff.js';

export const CHIPS = {
  sheet: 'From a published data sheet',
  page: 'From the published product page',
  derived: 'Worked out from published data',
  unknown: 'Not in the published data',
};
// Statuses. SIGNED is deliberately absent: nobody at the company has signed anything (G3), so no code path can emit it.
export const STATUS = { PUBLISHED: 'PUBLISHED', UNKNOWN: 'UNKNOWN' };

const nz = (s) => plain(String(s || '')).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const KIND = { PDS: 'pds', SDS: 'sds', WEB: 'page' };

/** Evidence entry from a compact lane source {t,u,v,p,pe,sec}. */
export function evOf(quote, s, label) {
  if (!s || !s.u) return null;
  const kind = KIND[s.t] || 'page';
  const doc = kind === 'sds' ? 'Safety data sheet' : kind === 'pds' ? 'Data sheet' : 'Product page';
  return { quote: quote == null ? null : plain(quote), url: s.u, kind, label: label || [doc, s.v ? plain(s.v) : (kind === 'page' ? null : 'version not stated'), s.p ? `page ${s.p}` : null].filter(Boolean).join(', '), version: s.v ? plain(s.v) : null, page: s.p == null ? null : s.p };
}
export const chipOf = (evs) => {
  if (!evs || !evs.length) return CHIPS.unknown;
  if (evs.some((e) => e.kind === 'pds' || e.kind === 'sds')) return CHIPS.sheet;
  if (evs.some((e) => e.kind === 'page')) return CHIPS.page;
  return CHIPS.derived;
};

/** Find the lane source whose sentence contains (or is contained in) the quote. Lane texts: compat rules, rate and time facts, SDS items. */
function* laneTexts(k) {
  if (!k) return;
  for (const r of k.compat || []) yield [r.text, r.s];
  for (const g of Object.values((k.rates && k.rates.facts) || {})) for (const f of g) yield [f.text, f.s];
  for (const g of Object.values((k.times) || {})) for (const f of g) yield [f.text, f.s];
}
export function findSource(k, quote) {
  const q = nz(String(quote).replace(/\.\.\.$/, ''));
  if (q.length < 12) return null;
  let best = null;
  for (const [t, s] of laneTexts(k)) {
    const n = nz(t); if (n.length < 12 || !s) continue;
    if (n.includes(q) || q.includes(n)) { if (!best || (s.t === 'PDS' && best.t !== 'PDS')) best = s; }
  }
  return best;
}

/** The lane consumption fact that a quote line's basis came from: most shared words, ties to the first. null when the product has none. */
export function laneRateFor(k, basis) {
  const fs = (k && k.rates && k.rates.facts && k.rates.facts.consumption) || [];
  if (!fs.length) return null;
  const bw = new Set(nz(basis).split(' ').filter((w) => w.length > 1));
  let best = null, bs = -1;
  for (const f of fs) { const sc = nz(f.text).split(' ').filter((w) => bw.has(w)).length; if (sc > bs) { best = f; bs = sc; } }
  return best;
}

const QUOTE_RE = /["“]([^"”]{12,})["”]/g;
const NEEDS_RE = /\d|not suitable/i;
const UNKNOWN_TEXT_RE = /does not say|do not give a rate|do not hold|not published|no usable published|I will not guess|has no [a-z ]*statement|does not name|not stated|cannot|not in the published/i;

/** Attach evidence and a status to every factual block. Mutates and returns ans. */
export function attachEvidence(ans, k, pid) {
  const pageCite = (ans.citations || []).find((c) => c.kind === 'page') || (ans.citations || [])[0];
  const pageSrc = pageCite ? { t: 'WEB', u: pageCite.url, v: null } : null;
  for (const b of ans.blocks) {
    if (b.evidence && b.evidence.length) { b.status = b.status || STATUS.PUBLISHED; b.chip = b.chip || chipOf(b.evidence); continue; }
    if (b.type === 'text') {
      const txt = b.text || '';
      const qs = []; let m; QUOTE_RE.lastIndex = 0; while ((m = QUOTE_RE.exec(txt))) qs.push(m[1]);
      const evs = [];
      for (const q of qs) { const s = findSource(k, q) || pageSrc; const e = evOf(q, s, s && s.t === 'WEB' ? 'Product page' : null); if (e) evs.push(e); }
      if (evs.length) { b.evidence = evs; b.status = STATUS.PUBLISHED; b.chip = chipOf(evs); }
      else if (UNKNOWN_TEXT_RE.test(txt)) { b.evidence = []; b.status = STATUS.UNKNOWN; b.chip = CHIPS.unknown; }
      else if (NEEDS_RE.test(txt)) {
        const e = pageSrc ? evOf(null, pageSrc, 'Worked out from the cited sources') : null;
        if (e) { e.kind = 'derived'; b.evidence = [e]; b.status = STATUS.PUBLISHED; b.chip = CHIPS.derived; }
        else { b.evidence = []; b.status = STATUS.UNKNOWN; b.chip = CHIPS.unknown; }
      }
    } else if (b.type === 'facts') {
      const evs = [];
      for (const r of b.rows || []) {
        if (r.evidence) { evs.push(...r.evidence); continue; }
        const s = findSource(k, r.value) || (r.source && r.source.url ? { t: 'WEB', u: r.source.url, v: null } : pageSrc);
        const e = evOf(r.value, s, s && s.t === 'WEB' ? (r.source && r.source.label) || 'Product page' : null); if (e) { evs.push(e); r.evidence = [e]; }
      }
      b.evidence = evs; b.status = evs.length ? STATUS.PUBLISHED : STATUS.UNKNOWN; b.chip = chipOf(evs);
    } else if (b.type === 'quote') {
      const evs = [];
      for (const l of b.lines || []) {
        if (l.evidence) { evs.push(...l.evidence); continue; }
        if (/supplied by you/i.test(l.basis || '')) { const e = { quote: null, url: null, kind: 'user', label: 'The rate you gave', version: null, page: null }; l.evidence = [e]; evs.push(e); continue; }
        const lf = laneRateFor(k, l.basis);
        if (lf) { const e = evOf(lf.text, lf.s); if (e) { l.evidence = [e]; evs.push(e); l.laneFact = lf.id; continue; } }
        const s = findSource(k, String(l.basis || '').replace(/^Published rate [^,]*,?\s*/, '')) || (l.source && l.source.url ? { t: 'WEB', u: l.source.url, v: null } : pageSrc);
        const e = evOf(l.basis, s, s && s.t === 'WEB' ? 'Product page' : null); if (e) { l.evidence = [e]; evs.push(e); }
      }
      b.evidence = evs; b.status = evs.length ? STATUS.PUBLISHED : STATUS.UNKNOWN; b.chip = evs.every((e) => e.kind === 'user') ? CHIPS.derived : chipOf(evs);
    }
  }
  return ans;
}

/* ------------------------------------------------------------------ compatibility from the lane's page-cited rules */
const EXTRA_TAGS = { substrate: { existing_tiles: ['\\b(?:old|current|existing|previous|original) (?:ceramic |porcelain )?tiles?\\b'] } };
export function tagsOf(text, tax) {
  const out = {};
  for (const dim of ['substrate', 'tile_type', 'environment']) {
    const pats = Object.assign({}, (tax || {})[dim] || {});
    for (const [id, ps] of Object.entries((EXTRA_TAGS[dim]) || {})) pats[id] = (pats[id] || []).concat(ps);
    for (const [id, ps] of Object.entries(pats)) if (ps.some((p) => { try { return new RegExp(p, 'i').test(text); } catch { return false; } })) (out[dim] ||= []).push(id);
  }
  return out;
}
/** 'No.' / 'Yes' / both-statements answer for "can I use X over/on/with Y", from the product's rules. Returns a block or null. */
export function compatAnswer(name, k, tail, tax) {
  if (!k || !k.compat || !tail) return null;
  const want = tagsOf(tail, tax); const dims = Object.keys(want);
  if (!dims.length) return null;
  const hit = k.compat.filter((r) => r.type === 'suitability' && dims.some((d) => (r.tags[d] || []).some((t) => want[d].includes(t))));
  const uniq = (list) => { const out = []; for (const r of list.slice().sort((a, b) => b.text.length - a.text.length)) if (!out.some((o) => nz(o.text).includes(nz(r.text)))) out.push(r); return out; };
  const no = uniq(hit.filter((r) => r.pol === 'no')); const yes = uniq(hit.filter((r) => r.pol === 'yes'));
  if (!no.length && !yes.length) return null;
  const evOfRule = (r) => evOf(r.text, r.s);
  const n = plain(name);
  if (no.length && !yes.length) return { type: 'text', text: `No. The ${n} data sheet says: "${clip(no[0].text, 400)}"`, evidence: no.slice(0, 2).map(evOfRule).filter(Boolean), verdict: 'no' };
  if (yes.length && !no.length) {
    const c = yes[0].cond ? ' This statement carries a condition, so read the whole sentence.' : '';
    // A yes has to cover the visitor's whole condition. A word the sentence never mentions (for example "heated") is not answered by a nearest match:
    // quote the sentence, say what it does not mention, show the Not-in-the-published-data status and let the hand-off block take over.
    const silent = uncoveredTerms(tail, [name], [{ type: 'text', text: yes[0].text }]);
    if (silent.length) return { type: 'text', text: `The ${n} data sheet says: "${clip(yes[0].text, 400)}" It does not mention ${silent.join(', ')}, so it does not answer your question. I will not guess; check the data sheet or ask technical services.`, evidence: yes.slice(0, 2).map(evOfRule).filter(Boolean), status: STATUS.UNKNOWN, chip: CHIPS.unknown, verdict: 'silent', silent };
    return { type: 'text', text: `Yes, according to the ${n} data sheet: "${clip(yes[0].text, 400)}"${c}`, evidence: yes.slice(0, 2).map(evOfRule).filter(Boolean), verdict: 'yes' };
  }
  return { type: 'text', text: `The ${n} data sheet has statements that point both ways, so I will not give a single answer. It says: "${clip(no[0].text, 300)}" and also "${clip(yes[0].text, 300)}". Check the data sheet or ask technical services.`, evidence: [no[0], yes[0]].map(evOfRule).filter(Boolean), verdict: 'mixed' };
}

/* ------------------------------------------------------------------ safety (T16) */
export const SAFETY_RE = /\b(ppe|protective equipment|(?:eye|hand|respiratory|face|skin) protection|gloves?|respirator|dust mask|goggles|safety glasses|first aid|hazards?|hazardous|flammable|toxic|dangerous goods|adg|un number|transport class|signal word|precaution(?:ary)?|storage|how (?:do i|should i|to) store|stored|h3\d\d|p\d\d\d)\b/i;
const SDS_ASK_ONLY = /\b(sds|msds|safety data sheet|safety data)\b/i;
const sdsSrc = (sds, s) => s || { t: 'SDS', u: sds.url, v: null };
const ver = (sds) => `Revision ${plain(sds.revision_date)}, Version ${plain(sds.version)}${sds.sds_number ? ', SDS number ' + plain(sds.sds_number) : ''}`;

/** Pick the SDS to quote: the newest revision whose name matches the product, else the first newest. */
export function pickSds(k) {
  const l = (k && k.safety && k.safety.sds) || [];
  return l.find((d) => d.latest_for_name && d.name_matches_product) || l.find((d) => d.name_matches_product) || null;
}
export function safetyRows(sds, q) {
  const w = (re) => re.test(q);
  const rows = []; const nsp = 'Not stated in this SDS';
  const add = (label, items, join = false) => {
    const list = (items || []).filter((x) => x && x.text);
    if (!list.length) { rows.push({ label, value: nsp, missing: true }); return; }
    for (const it of list) rows.push({ label, value: plain(it.text), src: it.s });
  };
  const ppe = sds.ppe || {};
  const wantPpe = w(/ppe|protective|protection|gloves?|respirator|mask|goggles|glasses|eye|clothing|skin|dust|breath/i);
  const wantHaz = w(/hazard|flammable|toxic|signal|precaution|h3\d\d|p\d\d\d|safe to/i);
  const wantStore = w(/storage|store|stored/i);
  const wantTransport = w(/transport|dangerous goods|adg|un number/i);
  const wantFirstAid = w(/first aid/i);
  if (wantFirstAid) rows.push({ label: 'First aid', value: 'Not stated in this SDS extract. Open the safety data sheet and read section 4 (first aid measures).', missing: true });
  if (wantPpe) {
    const only = [];
    if (w(/glove|hand/i)) only.push('hands'); if (w(/respirator|mask|dust|breath|lung/i)) only.push('respiratory'); if (w(/goggles|glasses|eye/i)) only.push('eyes'); if (w(/clothing|skin|body|overall|boots/i)) only.push('skin_body');
    const keys = only.length ? only : ['respiratory', 'hands', 'eyes', 'skin_body', 'engineering_controls'];
    for (const key of keys) { const it = ppe[key]; if (it && it.text) rows.push({ label: plain(it.label), value: plain(it.text), src: it.s }); else rows.push({ label: key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), value: nsp, missing: true }); }
  }
  if (wantHaz) {
    if (sds.signal_word && sds.signal_word.value) rows.push({ label: 'Signal word', value: plain(sds.signal_word.value), src: sds.signal_word.s }); else rows.push({ label: 'Signal word', value: nsp, missing: true });
    add('Hazard statement', sds.hazard_statements);
    if (w(/precaution|p\d\d\d/i)) add('Precautionary statement', sds.precautionary_statements);
  }
  if (wantStore) add('Storage', sds.storage);
  if (wantTransport) { const t = sds.transport_adg; if (t && t.text) rows.push({ label: 'Transport (ADG)', value: plain(t.text) + (t.class && !/not applicable/i.test(t.class) ? `. Class: ${plain(t.class)}` : ''), src: t.s }); else rows.push({ label: 'Transport (ADG)', value: nsp, missing: true }); }
  return rows;
}
export function safetyAnswer(name, k, question) {
  const sds = pickSds(k);
  const n = plain(name);
  if (!sds) return [{ type: 'text', text: `No safety data sheet for ${n} is listed in the published data I hold. Check the company website or ask technical services.`, evidence: [], status: STATUS.UNKNOWN, chip: CHIPS.unknown }];
  let rows = safetyRows(sds, question);
  if (!rows.length) rows = safetyRows(sds, 'ppe hazard storage transport');
  const evs = []; const out = rows.map((r) => {
    const e = r.src ? evOf(r.value, r.src, `Safety data sheet, ${ver(sds)}, page ${r.src.p}`) : null;
    if (e) evs.push(e);
    return { label: r.label, value: r.value, source: r.src ? { label: `SDS ${plain(sds.revision_date)}, page ${r.src.p}`, url: r.src.u } : null, evidence: e ? [e] : undefined };
  });
  const hev = evOf(null, { t: 'SDS', u: sds.url, v: ver(sds) }, `Safety data sheet, ${ver(sds)}`);
  const head = { type: 'text', text: `Quoted from the safety data sheet dated ${plain(sds.revision_date)} (version ${plain(sds.version)}). Check the current SDS before use.`, evidence: hev ? [hev] : [], status: hev ? STATUS.PUBLISHED : STATUS.UNKNOWN, chip: hev ? CHIPS.sheet : CHIPS.unknown };
  return [head, { type: 'facts', title: `Safety data sheet statements for ${n}`, rows: out, evidence: evs, status: evs.length ? STATUS.PUBLISHED : STATUS.UNKNOWN, chip: evs.length ? CHIPS.sheet : CHIPS.unknown, safety: true }];
}

/* ------------------------------------------------------------------ T15 rate facts */
/** The lane's page-cited consumption facts for a product, newest wording untouched. */
export function rateFacts(k) {
  const l = (k && k.rates && k.rates.facts && k.rates.facts.consumption) || [];
  return l.map((f) => ({ id: f.id, label: plain(f.label), text: plain(f.text), calc: !!f.calc, s: f.s, parsed: f.parsed }));
}
export function rateBlock(name, k) {
  const facts = rateFacts(k); const n = plain(name);
  if (!facts.length) return null;
  const rows = facts.slice(0, 6).map((f) => { const e = evOf(f.text, f.s); return { label: f.label, value: f.text, source: e ? { label: e.label, url: e.url + (e.kind === 'pds' && e.page ? `#page=${e.page}` : '') } : null, evidence: e ? [e] : undefined }; });
  const evs = rows.flatMap((r) => r.evidence || []);
  return { type: 'facts', title: `Published rate for ${n}, page cited`, rows, evidence: evs, status: STATUS.PUBLISHED, chip: chipOf(evs), rates: true };
}

/* ------------------------------------------------------------------ orchestration */
/** Citations for a safety or time answer: the product page, plus every document the evidence points at. */
function citesFor(prod, blocks) {
  const out = []; const add = (label, url, kind) => { if (url && !out.some((c) => c.url === url)) out.push({ label: plain(label), url, kind }); };
  add(`${plain(prod.name)} (product page)`, prod.url, 'page');
  for (const b of blocks) for (const e of b.evidence || []) if (e.url) add(e.kind === 'sds' ? 'Safety data sheet' : 'Product data sheet', e.url, /\.pdf/i.test(e.url) ? 'pdf' : 'page');
  return out;
}
const nameTokens = (n) => nz(n).split(' ').filter((t) => t.length > 1);
export function mentions(text, productName, brand) {
  const t = nz(text); const nameN = nz(productName);
  if (nameN && t.includes(nameN)) return true;
  const b = nz(brand || ''); const toks = nameTokens(productName).filter((x) => x !== b);
  if (!toks.length) return false;
  const have = toks.filter((x) => new RegExp('\\b' + x + 's?\\b').test(t)).length;
  return have >= Math.max(2, Math.ceil(toks.length * 0.6)) || (toks.length === 1 && have === 1);
}
export function productIdOf(ans) {
  if (ans.state && ans.state.productId) return ans.state.productId;
  const m = ans.debug && ans.debug.matched && ans.debug.matched[0];
  return m ? m.id : null;
}

/**
 * Run the engine, then add what the lanes know. deps: { load(id)->k|null, tax, products: Map id->{name,brand} }.
 * A safety or time question is only answered for a product the visitor named (or the one already in the conversation).
 */
export async function applyAsk(engine, text, state, deps) {
  const ans = engine.ask(text, state);
  let pid = productIdOf(ans);
  // The engine reads some safety and time questions as another intent and drops the product ("how should I store X" reads as where to buy). Find the named product with a document probe.
  if (!pid && (SAFETY_RE.test(text) || TIME_RE.test(text)) && deps.products) { const pr = engine.ask('datasheet for ' + text, null); const c = pr.state && pr.state.productId; const cp = c && deps.products.get(c); if (cp && mentions(text, cp.name, cp.brand)) pid = c; }
  const prod = pid && deps.products ? deps.products.get(pid) : null;
  let k = null; try { k = pid ? await deps.load(pid) : null; } catch { k = null; }
  const named = prod && (mentions(text, prod.name, prod.brand) || (state && state.productId === pid));
  const last = ans.blocks.length - 1;
  const keepTail = (blocks) => { const phrase = ans.blocks[last]; const head = ans.blocks.filter((b, i) => i < last && (b.type === 'products' || b.type === 'docs' || b.type === 'ask')); return { head, phrase }; };
  if (named && ans.intent !== 'quote' && ans.intent !== 'documents' && SAFETY_RE.test(text) && !(SDS_ASK_ONLY.test(text) && !/ppe|hazard|storage|first aid|gloves?|respirator/i.test(text))) {
    const blocks = safetyAnswer(prod.name, k, text);
    const { head, phrase } = keepTail();
    ans.blocks = [...blocks, ...head.filter((b) => b.type === 'docs'), phrase];
    ans.citations = citesFor(prod, blocks); ans.intent = 'safety'; ans.followups = [`What storage conditions for ${plain(prod.name)}?`, `Datasheet for ${plain(prod.name)}`];
  } else if (named && ans.intent !== 'quote' && TIME_RE.test(text)) {
    const b = timeAnswer(prod.name, k, text);
    const { head, phrase } = keepTail();
    const blk = b || { type: 'text', text: `The published data for ${plain(prod.name)} does not give a time for that. Time not published; check the data sheet.`, evidence: [], status: STATUS.UNKNOWN, chip: CHIPS.unknown };
    ans.blocks = [blk, ...head.filter((x) => x.type === 'docs'), phrase];
    ans.citations = citesFor(prod, [blk]); ans.intent = 'times';
  } else if (ans.intent === 'compatibility' && prod && k && (ans.state.productIds || []).length === 1) {
    const tail = (/\b(?:over|onto|on top of|on|with|to|under)\s+(.+)$/.exec(nz(text)) || [])[1] || '';
    const blk = compatAnswer(prod.name, k, tail, deps.tax);
    if (blk) {
      const kept = ans.blocks.filter((b, i) => !(b.type === 'facts' && /Compatibility and system notes|Primer guidance/.test(b.title || '')) && !(b.type === 'text' && /^(No\.|Yes,|The published text for)/.test(b.text || '')));
      kept.splice(Math.min(1, kept.length), 0, blk); ans.blocks = kept;
    }
  } else if ((ans.intent === 'consumption' || ans.intent === 'quote') && prod && k) {
    const rb = rateBlock(prod.name, k);
    if (rb && ans.intent === 'consumption' && !ans.blocks.some((b) => b.rates)) {
      const at = ans.blocks.findIndex((b) => b.type === 'facts'); if (at >= 0) ans.blocks.splice(at, 1, rb); else ans.blocks.splice(Math.max(0, ans.blocks.length - 1), 0, rb);
    } else if (rb && ans.intent === 'quote' && ans.blocks.some((b) => b.type === 'quote')) {
      const qi = ans.blocks.findIndex((b) => b.type === 'quote');
      if (deps.mismatch && deps.mismatch.has(pid)) {
        // The portal's own reading of this sentence disagrees with the page-cited reading: show the cited sentence, give no pack count.
        const note = { type: 'text', text: `The quantity workings for ${plain(prod.name)} do not agree with the data sheet's own wording, so I will not give a pack count. The data sheet sentence is below; please check it or ask technical services.` };
        ans.blocks.splice(qi, 1, note, rb);
      } else ans.blocks.splice(qi + 1, 0, rb);
    } else if (rb && ans.intent === 'quote' && !ans.blocks.some((b) => b.type === 'quote')) {
      const at = ans.blocks.findIndex((b) => b.type === 'text' && /do not give a rate|No usable published rate/.test(b.text));
      ans.blocks.splice(at >= 0 ? at + 1 : Math.max(0, ans.blocks.length - 1), 0, rb);
    }
  }
  attachEvidence(ans, k, pid);
  return ans;
}
