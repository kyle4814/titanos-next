// Actions v2, the project cart: what the advisor adds, changes, removes and reads back is the SAME project the portal's "My projects" page shows
// (lib/projectstore.js). Quantities only, never prices. Everything stays in this browser. Kept apart from flow.js so the conversation code stays small:
// flow.js calls cartAction() for the cart intents, cartAfterSave() after "save that", and cartButtons() to put an add button on a quantity or system answer.
import { card, findProducts, norm, plain, IN_BROWSER_NOTICE, ESTIMATE_LINE } from './core.js';
import { clarifyCard } from './core.js';
import { qtyFromRows, unitFromWord, unitLabel, jobBasis, buildJobPack } from '../lib/projectstore.js';

export const CART_ACTIONS = new Set(['cartadd', 'cartshow', 'cartremove', 'cartqty', 'cartpack']);
const UNIT_RX = 'packs?|pails?|bags?|cartridges?|carts?|rolls?|litres?|liters?|ltrs?|l|kgs?|kilos?|kilograms?|tubes?|drums?|sachets?|boxes|box|buckets?';
const NOT_DIM = '(?!\\s*(?:m2|m²|sqm|m3|mm|cm|m\\b|metres?|meters?|%|percent|coats?))';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NOTICE = IN_BROWSER_NOTICE;
const mem = (title, o) => card('memory', 'memory', title, { estimate: false, notice: NOTICE, ...o });
const linkBtns = (...extra) => [...extra, { label: 'What is in my project', command: '/cart' }, { label: 'Job pack: print, CSV, data sheets', command: '/jobpack' }];

/* ------------------------------------------------------------------ small helpers */
/** A quantity and unit out of free text, ignoring any number that belongs to a product name or a measurement. */
export function parseQty(text, maskNames = []) {
  let t = ' ' + plain(text).toLowerCase() + ' ';
  for (const n of maskNames) for (const tok of norm(n).split(' ')) if (tok) t = t.replace(new RegExp('(?<![a-z0-9])' + esc(tok) + '(?![a-z0-9])', 'g'), ' ');
  let m = new RegExp(`(?<![\\w.])(\\d+(?:[.,]\\d+)?)\\s*(?:x\\s*|of\\s+)?(${UNIT_RX})\\b`).exec(t);
  let qty = null; let unit = '';
  if (m) { qty = parseFloat(m[1].replace(',', '.')); unit = unitFromWord(m[2]); }
  else if ((m = new RegExp(`\\b(?:to|by|=|make it|make that|add|put|need|want|only|another)\\s+(?:x\\s*)?(\\d+(?:[.,]\\d+)?)\\b${NOT_DIM}`).exec(t))) qty = parseFloat(m[1].replace(',', '.'));
  else if ((m = new RegExp(`(?:\\bx\\s*(\\d+)\\b|\\b(\\d+)\\s*x\\b)${NOT_DIM}`).exec(t))) qty = parseInt(m[1] || m[2], 10);
  else { const all = [...t.matchAll(new RegExp(`(?<![\\w.-])(\\d+(?:[.,]\\d+)?)(?![\\w.-])${NOT_DIM}`, 'g'))]; if (all.length === 1) qty = parseFloat(all[0][1].replace(',', '.')); }
  if (qty != null && !Number.isFinite(qty)) qty = null;
  const rounded = qty == null ? null : Math.ceil(qty);
  return { qty: rounded, rounded: qty != null && rounded !== qty, unit, bad: qty != null && (rounded < 1 || rounded > 99999) };
}
const STOP = new Set('remove delete drop take out get rid of from off my the this that it its project projects cart basket list please and to a an set change update edit adjust quantity qty amount number make be by more less increase decrease reduce raise lower for item items product products add put pop in into x only another need want'.split(' '));
const stopUnits = new Set(UNIT_RX.split('|').flatMap((u) => [u, u.replace(/\?$/, '')]));

async function nameOf(ctx, id) {
  const s = (ctx.session.products || []).find((x) => x.id === id); if (s && s.name) return s.name;
  try { const F = await ctx.data.finder(); const r = F.byId.get(id); if (r) return r.name; } catch { /* name stays the id */ }
  return id;
}
/** Cart items the text refers to: products named in it that are in the cart, else a unique name match on its words. */
async function cartMatches(ctx, text, items) {
  const hits = await findProducts(ctx.data, text, 4); const ids = new Set(items.map((i) => i.id));
  const named = hits.filter((h) => ids.has(h.id));
  if (named.length) return named.map((h) => items.find((i) => i.id === h.id));
  const toks = norm(text).split(' ').filter((w) => w && !STOP.has(w) && !stopUnits.has(w) && !/^\d+$/.test(w));
  if (!toks.length) return [];
  const names = await Promise.all(items.map(async (i) => norm(i.name || (await nameOf(ctx, i.id)))));
  const good = items.filter((_, k) => { const nt = new Set(names[k].split(' ')); return toks.every((w) => nt.has(w) || nt.has(w.replace(/s$/, ''))); });
  return good;
}
const lineOf = (it) => `${it.qty} ${unitLabel(it.unit, it.qty)}${it.packs ? ' (' + it.packs + ')' : ''}`;
const productRow = (label, it, name, extra = {}) => ({ label, value: `${name}: ${lineOf(it)}${extra.was ? ' (was ' + extra.was + ')' : ''}`, productId: it.id, meta: true, source: it.url ? { url: it.url, label: 'Published rate', sentence: it.phrase || '' } : null });
const asked = (ctx) => (ctx.session.answerQuestion || ctx.session.lastQuestion || '').slice(0, 300);

/** The fields that carry a worked-out quantity (from the existing quantity module's result) into the cart. */
function fromCalc(calc) {
  if (!calc) return {};
  const d = qtyFromRows(calc.rows); const r = (calc.rows || [])[0] || {};
  const basis = jobBasis(calc.job);
  return { qty: d.qty, unit: d.unit, need: d.need, packs: d.packs, basis, url: r.url || '', phrase: r.phrase || '', job: calc.job || {} };
}
/** The products of the last answer: a quantity (one product), a system or a pack (the first product of each step). */
async function lastProducts(ctx) {
  const { session } = ctx; const last = session.last; const out = [];
  if (last && (last.action === 'system' || last.action === 'pack') && session.system) {
    for (const ids of Object.values(session.system.steps || {})) { const id = (ids || [])[0]; if (id && !out.some((o) => o.id === id)) out.push({ id, name: await nameOf(ctx, id), calc: session.calcs[id] || null, system: session.system }); }
  } else if (session.cartFocus && ctx.memory && ctx.memory.getItem(session.cartFocus)) { const it = ctx.memory.getItem(session.cartFocus); out.push({ id: it.id, name: it.name || (await nameOf(ctx, it.id)), calc: session.calcs[it.id] || null, system: null }); // the product just added or changed is what "it" and a bare quantity mean
  } else if (session.product) out.push({ id: session.product.id, name: session.product.name, calc: session.calcs[session.product.id] || null, system: null });
  return out;
}

/** Put one product in the cart (and save its worked quantity and system with it). Returns { item, verb, was }. */
function putIn(ctx, p, { qty, unit, delta } = {}) {
  const { memory } = ctx; const before = memory.getItem(p.id);
  const calcFields = fromCalc(p.calc);
  // the same worked-out quantity again keeps whatever the visitor set since; a new calculation (a different need) replaces it
  const keep = !!(before && p.calc && before.need && before.need === calcFields.need);
  if (p.calc) memory.saveQuantity({ productId: p.id, name: p.name, job: p.calc.job, rows: p.calc.rows }, asked(ctx));
  if (keep) memory.setItem(p.id, { qty: before.qty, unit: before.unit, packs: before.packs });
  const f = { id: p.id, name: p.name, from: 'bot', question: asked(ctx), ...calcFields };
  if (p.system) { f.systemTitle = p.system.title; f.systemSlug = p.system.slug || ''; }
  const cur = memory.getItem(p.id);
  if (delta != null && cur) { f.qty = Math.max(1, cur.qty + delta); f.unit = unit || cur.unit; }
  else if (qty != null) { f.qty = qty; f.unit = unit || (cur && cur.unit) || calcFields.unit || 'pack'; }
  else if (cur) { delete f.qty; delete f.unit; delete f.packs; } // already there: adding it again changes no quantity
  if ('qty' in f && calcFields.qty != null && f.qty !== calcFields.qty) f.packs = ''; // a quantity set by hand no longer matches the worked pack breakdown
  const res = memory.addItem(f);
  return { ...res, existed: !!before, was: before ? lineOf(before) : '', name: p.name, project: res.project };
}

/* ------------------------------------------------------------------ the actions */
async function add(ctx) {
  const { memory, session, data } = ctx; const text = ctx.rest || ctx.text; const lower = plain(text).toLowerCase();
  let hits = await findProducts(data, text, 3);
  // a name that is wholly inside the longer name just typed ("Sikafloor Level PRO" inside "Sikafloor Level PRO Primer") is the same words, not a second product
  if (hits.length > 1 && hits[0].score >= 1000) { const top = ' ' + norm(hits[0].name) + ' '; hits = hits.filter((h, i) => i === 0 || !top.includes(' ' + norm(h.name) + ' ')); }
  const q = parseQty(text, hits.map((h) => h.name));
  const whole = /\b(whole|entire|full|complete|all)\b[^.?!]{0,20}\b(set|system|lot|list|pack)\b|\b(everything|the lot|all of (?:it|that|this|them))\b/.test(lower);
  const more = /\b(more|another|extra|additional)\b/.test(lower);
  let targets = [];
  if (hits.length && !whole) targets = hits.slice(0, hits.length > 1 ? 3 : 1).map((h) => ({ id: h.id, name: h.name, calc: session.calcs[h.id] || null, system: null }));
  else if (q.qty != null && !whole) { const p = (await lastProducts(ctx))[0]; if (p) targets = [{ ...p, system: null }]; }
  else targets = await lastProducts(ctx);
  if (!targets.length) {
    if (q.qty != null) return clarifyCard('cartadd', `Which product should I add ${q.qty} ${q.unit ? unitLabel(q.unit, q.qty) : ''} of? Type its name, for example Davco Easy Grout.`.replace(/\s+of\?/, ' of?'), [], 'product');
    const c = mem('Nothing to add yet'); c.notes.push('Ask for a quantity or a system first, then say "add this to my project". Or name the product: "add 4 bags of Davco Easy Grout".'); return c;
  }
  if (q.bad) { const c = mem('That quantity is not possible'); c.notes.push('A quantity has to be a whole number from 1 to 99999.'); return c; }
  const c = mem(targets.length > 1 ? `Added ${targets.length} products to my project` : 'Added to my project');
  let sys = null;
  for (const p of targets) {
    const useQty = targets.length === 1 && !p.system ? q.qty : null;
    const r = putIn(ctx, p, { qty: more ? null : useQty, delta: more && useQty != null ? useQty : null, unit: targets.length === 1 ? q.unit : '' });
    if (!r.ok) { c.notes.push(r.error); continue; }
    const now = lineOf(r.item); const unworked = !r.item.need && !r.item.packs && !(targets.length === 1 && q.qty != null) && !r.existed;
    if (!r.existed) c.rows.push({ ...productRow('Added', r.item, p.name), ...(unworked ? { value: `${p.name}: ${now}. Quantity not worked out yet` } : {}) });
    else if (r.was !== now) c.rows.push(productRow('Changed', r.item, p.name, { was: r.was }));
    else c.rows.push(productRow('Already in my project', r.item, p.name));
    c.project = r.project; ctx.session.cartFocus = p.id;
    if (p.system) sys = p.system;
  }
  if (sys) memory.saveSystem({ title: sys.title, slug: sys.slug || '', env: sys.env, tile: sys.tile, substrate: sys.substrate, steps: sys.steps });
  if (c.rows.length && c.rows.every((r) => r.label === 'Changed')) c.title = c.rows.length > 1 ? 'Quantities changed' : 'Quantity changed';
  else if (c.rows.length && c.rows.every((r) => r.label === 'Already in my project')) c.title = 'Already in my project';
  if (q.rounded) c.notes.push('Quantities are whole numbers, so I rounded up.');
  if (c.rows.some((r) => /Quantity not worked out yet/.test(r.value))) c.notes.push('Where no quantity has been worked out it is in as 1 pack. Say "change quantity to 6", or ask me to work it out and add it again.');
  c.rows.unshift({ label: 'Project', value: c.project || memory.current(), meta: true, source: null });
  if (!memory.persistent()) c.notes.push('This browser blocked local storage, so it is kept for this tab only.');
  c.buttons = linkBtns(); c.cartLinks = true; return c;
}

async function show(ctx) {
  const { memory } = ctx; const p = memory.currentProject();
  const c = mem(p ? `My project: ${p.name}` : 'My project is empty');
  if (!p || (!p.items.length && !p.systems.length && !p.documents.length && !p.notes.length)) { c.notes.push('Nothing in it yet. Ask for a quantity or a system and say "add this to my project", or say "add 4 bags of Davco Easy Grout".'); c.cartLinks = true; return c; }
  c.summary = `${p.items.length} ${p.items.length === 1 ? 'product' : 'products'}, ${p.systems.length} ${p.systems.length === 1 ? 'system' : 'systems'}, ${p.documents.length} ${p.documents.length === 1 ? 'document' : 'documents'}, ${p.notes.length} ${p.notes.length === 1 ? 'note' : 'notes'}. Quantities only, no prices.`;
  c.sections = [];
  if (p.items.length) c.sections.push({ title: 'Products and quantities', rows: await Promise.all(p.items.map(async (it) => ({ label: it.name || (await nameOf(ctx, it.id)), value: lineOf(it) + (it.need ? `; need about ${it.need}` : ''), productId: it.id, derived: !!it.need, meta: !it.need, source: it.url ? { url: it.url, label: 'Published rate', sentence: it.phrase || '' } : null }))) });
  if (p.systems.length) c.sections.push({ title: 'System', rows: p.systems.map((s) => ({ label: s.title, value: s.slug ? `Sheet: ${s.slug}` : 'No sheet link', meta: true, source: null })) });
  if (p.documents.length) c.sections.push({ title: 'Documents', rows: p.documents.map((d) => ({ label: d.title, value: d.url, source: { url: d.url, label: d.title, sentence: d.title }, doc: true })) });
  if (p.notes.length) c.sections.push({ title: 'Notes', rows: p.notes.map((n) => ({ label: n.saved ? n.saved.slice(0, 10) : 'Note', value: n.text, meta: true, source: null })) });
  c.buttons = linkBtns(); c.cartLinks = true; return c;
}

async function pickOne(ctx, action, text, items) {
  if (!items.length) return { none: true };
  const m = await cartMatches(ctx, text, items);
  if (m.length === 1) return { item: m[0] };
  if (m.length > 1) { const opts = await Promise.all(m.slice(0, 6).map(async (i) => { const n = i.name || (await nameOf(ctx, i.id)); return { label: n, value: `${text.replace(/\s+$/, '')} ${n}`.slice(0, 200) }; })); return { ask: clarifyCard(action, 'Which one do you mean?', opts, 'product') }; }
  const f = ctx.session.cartFocus && items.find((i) => i.id === ctx.session.cartFocus);
  if (f && /\b(it|that|this|the last one)\b/i.test(text)) return { item: f };
  return { none: true, unmatched: true };
}

async function remove(ctx) {
  const { memory } = ctx; const text = ctx.rest || ctx.text; const items = memory.items();
  const soft = ctx.soft;
  if (/\b(all|everything|the lot)\b/i.test(text) && /\b(project|cart|basket|list)\b/i.test(text)) { const c = mem('I will not empty it from here'); c.notes.push('Emptying a whole project cannot be undone, so use "Clear project" on the My projects page, or tell me which product to remove.'); c.cartLinks = true; return c; }
  const r = await pickOne(ctx, 'cartremove', text, items);
  if (r.ask) return r.ask;
  if (r.none) { if (soft) return null; const c = mem(items.length ? 'I could not tell which product' : 'My project is empty'); c.notes.push(items.length ? 'Name the product to take out, for example "remove Davco Easy Grout from my project".' : 'There is nothing in it to remove.'); c.buttons = items.length ? [{ label: 'What is in my project', command: '/cart' }] : []; return c; }
  const name = r.item.name || (await nameOf(ctx, r.item.id)); const res = memory.removeItem(r.item.id);
  const c = mem(res.ok ? 'Removed from my project' : 'Could not remove it');
  if (!res.ok) c.notes.push(res.error); else { c.rows.push({ label: 'Removed', value: `${name}: ${lineOf(r.item)}`, productId: r.item.id, meta: true, source: null }); if (ctx.session.cartFocus === r.item.id) ctx.session.cartFocus = null; c.notes.push('It is still on the data sheet and product page; only the project line is gone.'); }
  c.buttons = linkBtns(); c.cartLinks = true; return c;
}

async function qty(ctx) {
  const { memory } = ctx; const text = ctx.rest || ctx.text; const items = memory.items(); const lower = plain(text).toLowerCase();
  const m = await cartMatches(ctx, text, items);
  let item = m.length === 1 ? m[0] : null;
  if (m.length > 1) return clarifyCard('cartqty', 'Which product should change?', m.slice(0, 6).map((i) => ({ label: i.name || i.id, value: `${text} ${i.name || i.id}` })), 'product');
  if (!item) { const f = ctx.session.cartFocus && items.find((i) => i.id === ctx.session.cartFocus); const ps = ctx.session.product && items.find((i) => i.id === ctx.session.product.id); if (/\b(it|that|this)\b/.test(lower) || items.length === 1) item = f || ps || (items.length === 1 ? items[0] : null); }
  if (!item) { if (ctx.soft) return null; const c = mem(items.length ? 'Which product?' : 'My project is empty'); c.notes.push(items.length ? 'Name the product, for example "change quantity of Davco Easy Grout to 8 bags".' : 'Add a product first.'); return c; }
  const names = [item.name, ...(await findProducts(ctx.data, text, 2)).map((h) => h.name)].filter(Boolean);
  const q = parseQty(text, names);
  const dec = /\b(decrease|reduce|lower|less|fewer|minus|remove \d)\b/.test(lower); const inc = /\b(increase|raise|more|another|extra|plus|up by)\b/.test(lower);
  if (q.qty == null || q.bad) { const c = mem('What quantity?'); c.notes.push(`Tell me the new quantity, for example "change ${item.name || 'it'} to 8 bags".`); return c; }
  const rel = /\bby\b/.test(lower) && (inc || dec); const next = rel ? item.qty + (dec ? -q.qty : q.qty) : q.qty;
  const name = item.name || (await nameOf(ctx, item.id));
  if (next < 1) { const c = mem('That would leave none'); c.notes.push(`To take ${name} out, say "remove ${name}".`); return c; }
  const res = memory.setItem(item.id, { qty: next, unit: q.unit || item.unit });
  const c = mem(res.ok ? 'Quantity changed' : 'Could not change it');
  if (!res.ok) c.notes.push(res.error); else { c.rows.push(productRow('Changed', res.item, name, { was: lineOf(res.before) })); ctx.session.cartFocus = item.id; if (q.rounded) c.notes.push('Quantities are whole numbers, so I rounded up.'); }
  c.buttons = linkBtns(); c.cartLinks = true; return c;
}

async function jobPack(ctx) {
  const { memory, data } = ctx; const p = memory.currentProject();
  if (!p || !p.items.length) { const c = mem('Job pack'); c.notes.push('There is nothing in the project yet. Add products first: "add this to my project".'); c.cartLinks = true; return c; }
  const jp = await buildJobPack(p, async (id) => { const rec = await data.product(id); return (rec && rec.docs) || []; }, { nameOf: (id) => (p.items.find((i) => i.id === id) || {}).name });
  const c = card('memory', 'memory', `Job pack: ${p.name}`, { estimate: true, notice: NOTICE });
  c.summary = `${p.items.length} ${p.items.length === 1 ? 'product' : 'products'} with quantities, ${jp.docs.length} data sheet and SDS ${jp.docs.length === 1 ? 'link' : 'links'}. Quantities only, no prices. Nothing is sent anywhere.`;
  c.sections = [{ title: 'Products and quantities', rows: p.items.map((it, k) => ({ label: jp.rows[k][0], value: lineOf(it) + (it.need ? `; need about ${it.need}` : '') + (it.note ? `. Note: ${it.note}` : ''), productId: it.id, derived: !!it.need, meta: !it.need, source: it.url ? { url: it.url, label: 'Published rate', sentence: it.phrase || '' } : null })) }];
  if (jp.docs.length) c.sections.push({ title: 'Data sheets and safety data sheets', rows: jp.docs.map((d) => ({ label: `${d.product}: ${d.kind}`, value: d.title || d.url, source: { url: d.url, label: d.kind, sentence: d.title }, doc: true })) });
  if (p.systems.length) c.sections.push({ title: 'System', rows: p.systems.map((s) => ({ label: s.title, value: s.slug ? `Sheet: ${s.slug}` : 'No sheet link', meta: true, source: null })) });
  if (p.notes.length) c.sections.push({ title: 'Notes', rows: p.notes.map((n) => ({ label: n.saved ? n.saved.slice(0, 10) : 'Note', value: n.text, meta: true, source: null })) });
  c.exports = [{ label: 'Download quantities (CSV)', filename: 'job-pack-quantities.csv', mime: 'text/csv;charset=utf-8', text: jp.csv }, { label: 'Download data sheet and SDS links', filename: 'job-pack-documents.txt', mime: 'text/plain;charset=utf-8', text: jp.docsText }];
  c.buttons = [{ label: 'Print the job pack', print: true }, { label: 'What is in my project', command: '/cart' }];
  c.copyText = jp.enquiry; c.copyLabel = 'Copy for the enquiry form'; c.copyAria = 'Text for the enquiry form'; c.cartLinks = true;
  return c;
}

/** The cart intents. Returns null when a "soft" phrase turned out not to be about the cart, so the question goes on to the advisor. */
export async function cartAction(ctx, action) {
  const m = ctx.memory;
  if (!m) return card('memory', 'memory', 'My project', { status: 'unknown', notes: ['Project memory is not available in this browser.'], notice: NOTICE });
  switch (action) {
    case 'cartadd': return add(ctx);
    case 'cartshow': return show(ctx);
    case 'cartremove': return remove(ctx);
    case 'cartqty': return qty(ctx);
    case 'cartpack': return jobPack(ctx);
    default: return null;
  }
}

/** After "save that": a saved system also puts its products in the cart, and the card says what is in the cart for what was saved. */
export async function cartAfterSave(ctx, c) {
  const { session, memory } = ctx; if (!memory || !c || c.title !== 'Saved to my project') return;
  const last = session.last; if (!last) return;
  if ((last.action === 'system' || last.action === 'pack') && session.system) {
    const ps = await lastProducts(ctx);
    for (const p of ps) { const r = putIn(ctx, p, {}); if (r.ok) c.rows.push(productRow(r.updated ? 'In my project' : 'Added', r.item, p.name)); }
  } else if (last.action === 'calc' && session.product) {
    const it = memory.getItem(session.product.id); if (it) c.rows.push(productRow('In my project', it, session.product.name));
  }
  c.cartLinks = true;
}

/** An add button on an answer that names products or a quantity (the button fires the ordinary /add command). */
export function cartButtons(c, session, memory, text) {
  if (c && c.action !== 'memory' && c.kind !== 'clarify' && text) { session.answerQuestion = String(text); session.cartFocus = null; } // a new answer: the question the cart line will remember, and "it" means that answer again
  if (!memory || !c || c.status === 'unknown' || c.kind === 'clarify') return;
  const have = (b) => (c.buttons || []).some((x) => x.command === '/add');
  if (have()) return;
  if (c.action === 'calc' && c.kind === 'quantity' && session.product && session.calcs[session.product.id]) c.buttons = [{ label: 'Add to my project', command: '/add' }, ...(c.buttons || [])];
  else if ((c.action === 'system' || c.action === 'pack') && session.system) c.buttons = [{ label: 'Add the whole set to my project', command: '/add' }, ...(c.buttons || [])];
}

export { ESTIMATE_LINE };
