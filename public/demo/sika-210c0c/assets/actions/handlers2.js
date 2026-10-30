// Actions v2, handlers part two: compatibility, safety, times, specification, project pack, export, link health, hand-off, help.
import { card, clarifyCard, unknownCard, src, plain, norm, findProducts, findProductsInOrder, NOT_PUBLISHED, cardCsv, cardText } from './core.js';
import { parseFacets, envId } from './parse.js';
import { fmt } from '../lib/finder/calc.js';
import { pickSds, safetyRows } from '../assistant/apply.js';
import { supplyClause, referencesLines, DRAFT_LABEL, STANDARDS_NOTE } from '../assistant/clause.js';
import { buildHandoff, uncoveredTerms } from '../assistant/handoff.js';
import { specText, FLAG as MISPRINT_FLAG } from '../lib/specs.js';
import { selectionLines, silentReason, dedupeWords, page, srcLabel, srcOf, range, ENV_LABEL, SUBSTRATE_LABEL, TILE_LABEL, handoffBtn, afterBtns, pickProduct, noteProduct, askProduct, jobText, cap } from './shared.js';
/* ---------------------------------------------------------------- COMPAT */
const TAGMAP = { // our facet -> compatibility tags in that dimension
  substrate: (v) => ['substrate:' + v],
  tile: (v) => ['tile_type:' + v],
};
function envTags(io, surface) {
  const t = [];
  if (io === 'internal') t.push('environment:internal'); else if (io === 'wet') t.push('environment:wet_area'); else if (io === 'external') t.push('environment:external', 'environment:balcony_deck'); else if (io === 'pool') t.push('environment:submerged');
  if (surface) t.push('environment:' + surface);
  return t;
}
const tagsOfRule = (r) => Object.entries(r.tags || {}).flatMap(([d, vs]) => [].concat(vs).map((v) => d + ':' + v));

export async function compat(ctx) {
  const { data, session } = ctx;
  const hits = await findProductsInOrder(data, ctx.rest || ctx.text, 2);
  const p = hits[0] || session.product;
  if (!p) return askProduct('compat', 'do you want to check');
  const rec = await data.compat(p.id);
  noteProduct(session, p);
  // text left once the product's own name is removed, so a name cannot be read as a surface
  let rest = norm(ctx.rest || ctx.text); for (const h of hits) rest = rest.replace(norm(h.name), ' ');
  const pf = parseFacets(rest);
  const wants = []; // {label, tags}
  if (pf.substrate) wants.push({ label: SUBSTRATE_LABEL[pf.substrate], tags: TAGMAP.substrate(pf.substrate), kind: 'substrate' });
  if (pf.tile) wants.push({ label: TILE_LABEL[pf.tile], tags: TAGMAP.tile(pf.tile), kind: 'tile' });
  if (pf.io) wants.push({ label: ENV_LABEL[envId(pf.io, pf.surface)] || pf.io, tags: envTags(pf.io, pf.surface), kind: 'environment' });
  // product to product: "can I use A with B"
  const other = hits[1];
  if (!wants.length && !other) {
    if (ctx.noAsk) return unknownCard('compat', `Can I use ${p.name}?`, 'I need to know what it is going on or over. Name a surface such as concrete, existing tiles or plasterboard.');
    return clarifyCard('compat', `What do you want to use ${p.name} on or over? For example concrete, existing tiles or plasterboard.`, ['concrete', 'existing_tiles', 'plasterboard', 'timber', 'waterproofing_membrane'].map((id) => ({ label: SUBSTRATE_LABEL[id], value: `Can I use ${p.name} on ${SUBSTRATE_LABEL[id]}` })), 'surface');
  }
  const c = card('compat', 'compat', `Can I use ${p.name}?`, { estimate: false, buttons: [handoffBtn] });
  const rules = (rec && rec.rules) || [];
  const rs = (r) => src(page({ url: r.source.url, page: r.source.page }), srcLabel(r.source), r.text);
  let anyNo = false, anyYes = false, anyCond = false, anyUnstated = false; const quotes = [];
  if (other) {
    const ro = rules.filter((r) => (r.mentions || []).includes(other.id) || norm(r.text).includes(norm(other.name)));
    if (ro.length) for (const r of ro.slice(0, 3)) { quotes.push(r.text); c.rows.push({ label: `${p.name} with ${other.name}`, value: `${r.polarity === 'no' ? 'No.' : r.polarity === 'yes' && !r.conditional ? 'Yes.' : 'Conditional.'} ${plain(r.text)}`, quote: true, source: rs(r) }); if (r.polarity === 'no') anyNo = true; else if (r.conditional) anyCond = true; else anyYes = true; }
    else { c.rows.push({ label: `${p.name} with ${other.name}`, value: `${NOT_PUBLISHED}. The published text of ${p.name} does not mention ${other.name}.`, source: null }); anyUnstated = true; }
  }
  for (const w of wants) {
    const m = rules.filter((r) => tagsOfRule(r).some((t) => w.tags.includes(t)) && ['suitability', 'restriction', 'compatibility'].includes(r.type));
    const no = m.find((r) => r.polarity === 'no' && !r.conditional) || m.find((r) => r.polarity === 'no');
    const yes = m.find((r) => r.polarity === 'yes' && !r.conditional);
    const cond = m.find((r) => r.conditional || r.polarity === 'conditional');
    const pick = no || yes || cond;
    if (!pick) { c.rows.push({ label: cap(w.label), value: `${NOT_PUBLISHED}. The published text of ${p.name} does not mention ${w.label}. I will not guess.`, source: null }); anyUnstated = true; (c.silent ||= []).push(w.label); continue; }
    quotes.push(pick.text);
    const verdict = no ? 'No.' : yes ? 'Yes.' : 'Only under a condition.';
    if (no) anyNo = true; else if (yes) anyYes = true; else anyCond = true;
    c.rows.push({ label: cap(w.label), value: `${verdict} ${plain(pick.text)}`, quote: true, verdict: no ? 'no' : yes ? 'yes' : 'conditional', source: rs(pick) });
  }
  // a Yes may only be said when the quoted sentences cover every word of the visitor's condition (owner fix, Monday script beat 4)
  const silent = uncoveredTerms(ctx.rest || ctx.text, [p.name, ...(other ? [other.name] : [])], [{ type: 'text', text: quotes.join(' ') }]);
  let overall;
  if (anyNo) overall = 'No. The published text says it is not suitable.';
  else if (silent.length && (anyYes || anyCond)) { overall = `The published text I quoted does not mention: ${silent.join(', ')}. I will not guess.`; c.silent = silent; anyUnstated = true; }
  else if (anyYes && !anyUnstated && !anyCond) overall = 'Yes, the published text says so.';
  else if (anyCond && !anyUnstated) overall = 'Only under the condition the published text states.';
  else overall = `${NOT_PUBLISHED}. I will not guess.`;
  c.rows.unshift({ label: 'Answer', value: overall, source: null, verdict: anyNo ? 'no' : (silent.length || anyUnstated || !(anyYes || anyCond)) ? 'unknown' : anyYes && !anyCond ? 'yes' : 'conditional' });
  c.status = c.rows[0].verdict === 'unknown' ? 'unknown' : 'published';
  if (c.status === 'unknown') c.handoff = true;
  // when the answer is No or silent for a surface, offer the tile adhesives whose own published text documents a fit for it (from the decision trees)
  const subWant = wants.find((w) => w.kind === 'substrate');
  if ((anyNo || anyUnstated) && subWant && pf.substrate) {
    const trees = await data.trees();
    if (trees) {
      const cnt = new Map();
      for (const [k, leaf] of Object.entries(trees.adhesive.leaves)) if (k.endsWith('|' + pf.substrate)) for (const e of leaf.documented_fit) { const x = cnt.get(e.product) || { n: 0, ev: null }; x.n++; if (!x.ev && e.evidence && e.evidence[0]) x.ev = e.evidence[0]; cnt.set(e.product, x); }
      const top = [...cnt].filter(([id]) => id !== p.id).sort((a, b) => b[1].n - a[1].n).slice(0, 4);
      if (top.length) {
        c.sections = [{ title: `Tile adhesives whose published text documents a fit for ${subWant.label}`, rows: top.map(([id, x]) => { const r = trees.rules[x.ev]; const cd = trees.cards[id]; return { label: 'Documented fit', value: cd ? plain(cd.name) : id, name: true, productId: id, source: r ? src(page({ url: r.url, page: r.page }), `Data sheet, ${plain(r.doc_version || '')}, page ${r.page}`, r.text) : src(cd && cd.product_url, 'Product page', '') }; }) }];
        c.notes.push('Check the conditions on each product page before choosing.');
      }
    }
  }
  c.silentWords = dedupeWords([...(c.silent || []), ...silent]); delete c.silent;
  return c;
}
/* ---------------------------------------------------------------- SAFETY */
export function sdsAgeYears(dateStr, now) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(dateStr || '').trim());
  if (!m) return null;
  const d = Date.UTC(+m[3], +m[2] - 1, +m[1]);
  return (now.getTime() - d) / (365.25 * 24 * 3600 * 1000);
}
export async function safety(ctx) {
  const { data, session } = ctx;
  const p = await pickProduct(ctx);
  if (!p) return askProduct('safety', 'do you want safety information for');
  noteProduct(session, p);
  const rec = await data.safety(p.id);
  const sds = rec && pickSds({ safety: { sds: rec.sds } });
  const c = card('safety', 'safety', `Safety data sheet statements for ${p.name}`, { estimate: false, buttons: afterBtns() });
  if (!sds) { c.status = 'unknown'; c.handoff = true; c.notes.push('No safety data sheet for this product is listed in the published data I hold. Check the Sika Australia website or ask Technical Services.'); c.buttons = [handoffBtn]; return c; }
  const q = plain(ctx.rest || ctx.text).toLowerCase();
  let rows = safetyRows(sds, q); if (!rows.length) rows = safetyRows(sds, 'ppe hazard storage transport');
  const ver = `Revision ${plain(sds.revision_date)}, version ${plain(sds.version)}`;
  c.summary = `Quoted from the safety data sheet dated ${plain(sds.revision_date)} (${plain(sds.version) ? 'version ' + plain(sds.version) : ''}). Check the current SDS before use.`;
  for (const r of rows) c.rows.push({ label: r.label, value: r.value, quote: !r.missing, source: r.src ? src(r.src.u + (r.src.p ? '#page=' + r.src.p : ''), `SDS ${plain(sds.revision_date)}, page ${r.src.p}`, r.value) : null });
  c.rows.unshift({ label: 'Revision date', value: `${plain(sds.revision_date)}, ${ver.replace(/^Revision [^,]*, /, '')}`, source: src(sds.url, `Safety data sheet, ${ver}`, `Revision ${plain(sds.revision_date)}`) });
  const age = sdsAgeYears(sds.revision_date, ctx.now || new Date());
  if (age != null && age > 3) { c.notes.push('This safety data sheet revision is more than 3 years old. Ask Sika for the current one before you rely on it.'); c.old = true; }
  c.sources = [src(sds.url, `Safety data sheet, ${ver}`, '')];
  return c;
}

/* ---------------------------------------------------------------- TIME */
const TIME_KINDS = [['open_time', 'Open time', /open time|working time|open/], ['adjustability_time', 'Adjustability time', /adjust/], ['pot_life', 'Pot life', /pot ?life|working life/], ['skin_tack_times', 'Skin and tack-free time', /skin|tack/], ['cure_times', 'Cure and return to service', /cure|curing|service|traffic|walk|grout|dry|wait|set/], ['recoat_times', 'Wait before the next coat', /re-?coat|over-?coat|next coat|wait/]];
export async function time(ctx) {
  const { data, session } = ctx;
  const p = await pickProduct(ctx);
  if (!p) return askProduct('time', 'do you want times for');
  noteProduct(session, p);
  const rec = await data.arate(p.id);
  const c = card('time', 'time', `Published times for ${p.name}`, { estimate: false, buttons: afterBtns() });
  const q = plain(ctx.rest || ctx.text).toLowerCase();
  let kinds = TIME_KINDS.filter(([k, , re]) => rec && rec.facts[k] && re.test(q));
  if (!kinds.length) kinds = TIME_KINDS.filter(([k]) => rec && rec.facts[k]);
  for (const [k, label] of kinds) for (const f of rec.facts[k].slice(0, 4)) {
    c.rows.push({ label: f.label && f.label !== label ? `${label}: ${plain(f.label)}` : label, value: plain(f.text) + (f.context ? ` (${plain(f.context)})` : ''), quote: true, source: srcOf(f) });
  }
  if (!c.rows.length) { c.status = 'unknown'; c.handoff = true; c.notes.push(`Time not published for ${p.name} in the data I hold. Check the data sheet or ask Technical Services.`); c.buttons = [handoffBtn]; return c; }
  c.notes.push('Published times are a guide. Conditions such as temperature and humidity apply; each line shows the data sheet sentence it comes from.');
  return c;
}

/* ---------------------------------------------------------------- SPEC */
function clauseRows(sp, limit = 6) {
  const rows = [];
  for (const sec of sp.sections || []) for (const cl of sec.cl || []) {
    if (cl.k !== 'datasheet') continue;
    const text = cl.x || (cl.s || []).join(' ');
    if (!text) continue;
    const s0 = src(sp.ds.url + (cl.p ? '#page=' + cl.p : ''), `Data sheet, ${plain(sp.ds.edition)}${cl.p ? ', page ' + cl.p : ''}`, plain(text));
    rows.push({ label: `${cl.no} ${plain(cl.t || sec.h)}`, value: plain(text).slice(0, 420), quote: true, source: s0 });
    for (const a of (sp.an || []).filter((x) => x.no === cl.no)) rows.push({ label: 'Check', value: `${MISPRINT_FLAG}${a.w ? ' ' + plain(a.w) : ''}`, source: s0, flag: true });
    if (rows.length >= limit) return rows;
  }
  return rows;
}
export async function spec(ctx) {
  const { data, session } = ctx;
  const p = await pickProduct(ctx);
  if (!p) return askProduct('spec', 'do you want a specification clause for');
  noteProduct(session, p);
  const sp = await data.spec(p.id);
  const c = card('spec', 'spec', `Draft specification clause for ${p.name}`, { estimate: false, buttons: afterBtns() });
  if (!sp || !sp.ds) { c.status = 'unknown'; c.handoff = true; c.notes.push('No data sheet edition is held for this product, so I cannot draft a clause that cites one.'); c.buttons = [handoffBtn]; return c; }
  const sub = session.system && session.system.substrate ? SUBSTRATE_LABEL[session.system.substrate] : '';
  const clause = supplyClause({ product: p.name, substrate: sub, title: `${p.name} Product Data Sheet`, version: sp.ds.edition });
  c.copyText = `${clause}\n\n${DRAFT_LABEL}`;
  try { c.fullText = specText(sp, { id: p.id, name: p.name, url: (await data.product(p.id) || {}).url || '' }, ctx.config || { company: { publishedDocsPhrase: 'the published documentation' } }); } catch { c.fullText = null; }
  c.rows.push({ label: 'Draft clause', value: clause, source: src(sp.ds.url, `Data sheet, ${plain(sp.ds.edition)}`, `Data sheet ${plain(sp.ds.edition)}`), draft: true });
  c.rows.push(...clauseRows(sp));
  const refs = referencesLines(sp.standards);
  refs.slice(0, 4).forEach((r) => c.rows.push({ label: 'Standard cited', value: r, source: src(sp.ds.url, `Data sheet, ${plain(sp.ds.edition)}`, r) }));
  if (c.fullText) c.exports = [{ label: 'Download the full draft specification (.txt)', filename: `${p.id}-draft-specification.txt`, mime: 'text/plain;charset=utf-8', text: c.fullText }];
  c.notes.push(DRAFT_LABEL, STANDARDS_NOTE);
  c.sources = [src(sp.ds.url, `Data sheet, ${plain(sp.ds.edition)}`, '')];
  return c;
}

/* ---------------------------------------------------------------- PACK */
export async function pack(ctx) {
  const { data, session, memory } = ctx;
  let items = [];
  const named = await findProductsInOrder(data, ctx.rest || ctx.text, 6);
  if (named.length) items = named;
  else if (session.system) items = Object.values(session.system.steps).flatMap((ids) => ids.slice(0, 1)).map((id) => ({ id, name: (session.products.find((x) => x.id === id) || {}).name || id }));
  else if (session.compare) items = session.compare.map((id) => session.products.find((x) => x.id === id) || { id, name: id });
  else if (session.product) items = [session.product];
  else if (memory && memory.currentProject()) items = memory.productsOf(memory.currentProject());
  if (!items.length) return ctx.noAsk ? unknownCard('pack', 'Project pack', 'Nothing to put in a pack yet. Ask for a system or a quantity first.') : clarifyCard('pack', 'What goes in the pack? Ask for a system first (for example /system porcelain on concrete, inside), or name the products.', [], 'products');
  items = items.filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).slice(0, 8);
  const docs = await data.docs();
  const c = card('pack', 'pack', `Project pack: ${(session.system && session.system.title) || items.map((x) => x.name).join(', ')}`, { estimate: false, print: true });
  c.summary = 'Chosen products, their documents and the specification wording on one printable page.';
  c.sections = [];
  let anyQty = false;
  for (const it of items) {
    const [pd, sp] = await Promise.all([data.product(it.id), data.spec(it.id)]);
    const sec = { title: plain(it.name), productId: it.id, rows: [] };
    sec.rows.push({ label: 'Product page', value: plain(it.name), name: true, source: src(pd && pd.url, 'Product page', '') });
    const qd = session.calcs[it.id];
    if (qd) { anyQty = true; qd.rows.slice(0, 1).forEach((r) => { sec.rows.push({ label: 'Quantity', value: `${range(r.low, r.high, r.unit)}${r.packs ? '; ' + r.packs : ''}`, derived: true, source: src(r.url, 'Published rate', r.phrase) }); }); sec.rows.push({ label: 'Job', value: jobText(qdFacets(qd.job)), input: true }); }
    const dl = ((pd && pd.docs) || []).filter((d) => !d.http || d.http.status === 200).filter((d) => d.type === 'product_data_sheet' || d.type === 'safety_data_sheet').slice(0, 4);
    for (const d of dl) sec.rows.push({ label: d.type === 'safety_data_sheet' ? 'Safety data sheet' : 'Product data sheet', value: plain(d.title) + (d.version ? ` (${plain(d.version)})` : ''), source: src(d.url, `${d.typeLabel}${d.http ? ', link checked ' + String(d.http.checked || '').slice(0, 10) : ''}`, plain(d.title)), doc: true });
    if (sp && sp.ds) {
      sec.rows.push({ label: 'Specification clause (draft)', value: supplyClause({ product: it.name, substrate: session.system ? SUBSTRATE_LABEL[session.system.substrate] : '', title: `${it.name} Product Data Sheet`, version: sp.ds.edition }), source: src(sp.ds.url, `Data sheet, ${plain(sp.ds.edition)}`, `Data sheet ${plain(sp.ds.edition)}`), draft: true });
      sec.rows.push(...clauseRows(sp, 3));
    } else sec.rows.push({ label: 'Specification clause', value: `${NOT_PUBLISHED}: no data sheet edition is held for this product.`, source: null });
    c.sections.push(sec);
  }
  c.estimate = anyQty;
  c.notes.push(DRAFT_LABEL);
  c.buttons = [{ label: 'Print this pack', print: true }, { label: 'Export CSV', command: '/export' }, { label: 'Save to my project', command: '/save' }, handoffBtn];
  return c;
}
const qdFacets = (j) => ({ area: j.area_m2, length: j.length_m, volume: j.volume_m3, thickness: j.thickness_mm, coats: j.coats, notch: j.notch_mm, csp: j.csp, dilution: j.dilution, allowance: j.waste_pct });

/* ---------------------------------------------------------------- EXPORT */
export async function exportAction(ctx) {
  const last = ctx.session.last;
  if (!last) return unknownCard('export', 'Export', 'Nothing to export yet. Ask me for a quantity, a system or a comparison first.', { handoff: false });
  const c = card('export', 'export', `Export: ${last.title}`, { estimate: false });
  const slug = norm(last.title).replace(/ /g, '-').slice(0, 40) || 'result';
  c.exports = [
    { label: 'Download CSV', filename: `${slug}.csv`, mime: 'text/csv;charset=utf-8', text: cardCsv(last) },
    { label: 'Download text', filename: `${slug}.txt`, mime: 'text/plain;charset=utf-8', text: cardText(last) },
  ];
  c.buttons = [{ label: 'Print this result', printLast: true }];
  c.summary = last.estimate ? 'The CSV ends with the estimate-only line.' : 'Every row keeps its source sentence and link.';
  return c;
}

/* ---------------------------------------------------------------- LINK */
export async function link(ctx) {
  const { data, session } = ctx;
  const docs = await data.docs();
  const url = /https?:\/\/\S+/.exec(ctx.rest || ctx.text);
  const c = card('link', 'link', 'Document link health', { estimate: false });
  c.notes.push('These are the results recorded when the demo data was built. A browser cannot check another site\'s link live, so this does not call the Sika site.');
  const row = (d) => {
    const h = d.http;
    const ok = h && h.status === 200;
    const sentence = h ? `HTTP ${h.status} checked ${String(h.checked || '').slice(0, 10)} (${plain(h.via || 'recorded check')})` : 'Not checked';
    c.rows.push({ label: `${d.typeLabel || 'Document'}: ${plain(d.title)}`, value: h ? (ok ? `Link working. ${sentence}` : `Link unavailable. ${sentence}`) : 'Not checked', source: h ? src(d.url, plain(d.title), sentence) : null, ok });
  };
  if (url) {
    const u = url[0].replace(/[).,]+$/, '');
    const d = docs.list.find((x) => x.url === u || (x.http && x.http.url === u));
    if (!d) { c.status = 'unknown'; c.notes.push('That link is not in the published document list I hold.'); return c; }
    row(d); return c;
  }
  const p = await pickProduct(ctx);
  if (!p) return askProduct('link', 'do you want the document links checked for');
  noteProduct(session, p);
  const pd = await data.product(p.id);
  const list = ((pd && pd.docs) || []).slice(0, 12);
  c.title = `Document link health for ${p.name}`;
  if (!list.length) { c.status = 'unknown'; c.notes.push('No documents are listed for this product.'); return c; }
  list.forEach(row);
  const bad = c.rows.filter((r) => r.ok === false).length;
  c.summary = bad ? 'Some links are unavailable and should not be relied on.' : 'Every listed link responded when it was last checked.';
  return c;
}

/* ---------------------------------------------------------------- HANDOFF */
export async function handoff(ctx) {
  const { session } = ctx;
  const products = (session.products || []).slice(0, 3).map((x) => ({ id: x.id, name: x.name }));
  const sel = selectionLines(session);
  const b = buildHandoff({ query: session.lastQuestion || ctx.text, products, sel, reason: (session.last && silentReason(session.last.silentWords)) || 'You asked to speak to Technical Services. The context so far is included.', config: ctx.config });
  const c = card('handoff', 'handoff', 'Ask Technical Services', { estimate: false, handoffBlock: b });
  return c;
}

/* ---------------------------------------------------------------- HELP */
export function help(ctx) {
  const c = card('help', 'help', 'What I can do', { estimate: false });
  c.summary = 'Type a slash command or just ask in plain English. Everything here is plain code running in your browser: no AI model, no tracking.';
  (ctx.commands || []).forEach(([cmd, , desc]) => c.rows.push({ label: cmd, value: desc, command: cmd }));
  c.notes.push('Voice input is off in this demo: the browser speech service sends the audio to the browser vendor, and nothing else here leaves the page. Add voice=1 to the address to turn it on; type instead.');
  return c;
}


/* ---------------------------------------------------------------- PROBLEM (symptom questions, T22 wording) */
export async function problem(ctx) {
  const chip = ctx.chip;
  const c = card('problem', 'problem', `What the published pages say: ${chip.label}`, { estimate: false });
  if (chip.items.length) {
    c.summary = `I cannot diagnose "${chip.label.toLowerCase()}" from here. The published product pages mention it in ${chip.items.length === 1 ? 'one place' : 'a few places'}; here is what they say, word for word.`;
    for (const i of chip.items) c.rows.push({ label: plain(i.name), value: `"${plain(i.quote)}"`, quote: true, productId: undefined, source: src(i.url, 'product page', plain(i.quote)) });
  } else {
    c.status = 'unknown'; c.handoff = true;
    c.summary = `The published product pages I hold do not say anything about "${chip.label.toLowerCase()}". I will not guess.`;
  }
  c.handoffBlock = buildHandoff({ query: ctx.session.lastQuestion || ctx.text, products: chip.products.slice(0, 3), reason: chip.items.length ? 'This is as far as the published text goes. It does not diagnose your job.' : 'This is not in the published data I hold.', config: ctx.config });
  return c;
}
