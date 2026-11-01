// ONE project model for the demo: the portal's "My projects" cart and the advisor's project memory are two windows on the same data.
// A project holds items (product, quantity, unit, where it came from), systems, documents and notes. Named projects, the advisor's recent
// questions and its gap list live beside them. Demo only and this browser only: localStorage, never sent anywhere. Quantities, never prices.
// The store is read-through: every call re-reads storage when it changed, so an edit made on the cart page is seen by the advisor on its
// next turn and the other way round. Plain code, no DOM, so Node tests import it directly and the portal and the advisor bundles share it.
import { ESTIMATE_LINE } from './finder/qty.js';

export const KEY = 'sika-demo-210c0c-project-v2';
export const LEGACY_PORTAL_KEY = 'sika-demo-210c0c-projects'; // the old cart: [{ id, qty, unit, note, calc }]; read once, never written again
export const LEGACY_ACTIONS_KEY = 'sika-demo-210c0c-actions-v1'; // the old advisor memory; read once, never written again
export const LIMITS = { projects: 30, perList: 100, items: 200, recent: 30, gaps: 50, text: 500, name: 60, calcs: 80, quotes: 30 };
export const UNITS = ['pack', 'pail', 'bag', 'cartridge', 'roll', 'litre', 'kg', 'tube', 'drum', 'sachet', 'box'];
export const DEFAULT_PROJECT = 'My project';

/** Plain text: no em or en dashes, no registered marks (same rule as the advisor). */
const plain = (s) => String(s == null ? '' : s).replace(/[®™]/g, '').replace(/\s*—\s*/g, ' - ').replace(/[–−]/g, '-').replace(/[ \t]{2,}/g, ' ').trim();
export const clip = (s, n) => plain(String(s == null ? '' : s)).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const nowIso = (clock) => (clock ? clock() : new Date()).toISOString();
const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const BAD_NAMES = new Set(['__proto__', 'constructor', 'prototype']);
const hash = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return h; };
const empty = () => ({ v: 1, model: 2, current: '', projects: {}, recent: [], gaps: [] });
const r2 = (n) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ units and quantities */
const UNIT_WORDS = { pack: 'pack', packs: 'pack', packet: 'pack', packets: 'pack', pail: 'pail', pails: 'pail', bucket: 'pail', buckets: 'pail', bag: 'bag', bags: 'bag', cartridge: 'cartridge', cartridges: 'cartridge', cart: 'cartridge', carts: 'cartridge', roll: 'roll', rolls: 'roll', l: 'litre', ltr: 'litre', ltrs: 'litre', litre: 'litre', litres: 'litre', liter: 'litre', liters: 'litre', kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', tube: 'tube', tubes: 'tube', drum: 'drum', drums: 'drum', sachet: 'sachet', sachets: 'sachet', box: 'box', boxes: 'box' };
/** A unit word as the visitor typed it ("bags", "L", "litres") to the one the cart uses; '' when it is not a unit. */
export const unitFromWord = (w) => UNIT_WORDS[String(w || '').toLowerCase().replace(/\.$/, '')] || '';
export const unitLabel = (unit, qty) => (qty === 1 ? unit : unit === 'litre' || unit === 'kg' ? unit : unit + 's');

const JOB_WORDS = { area_m2: (v) => `area ${v} m2`, area: (v) => `area ${v} m2`, length_m: (v) => `length ${v} m`, length: (v) => `length ${v} m`, volume_m3: (v) => `volume ${v} m3`, volume: (v) => `volume ${v} m3`, thickness_mm: (v) => `thickness ${v} mm`, thickness: (v) => `thickness ${v} mm`, notch_mm: (v) => `notch ${v} mm`, notch: (v) => `notch ${v}`, waste_pct: (v) => `allowance ${v}%`, allowance: (v) => `allowance ${v}%`, coats: (v) => `${v} coats` };
/** A worked job as plain words: "area 20 m2, notch 6 mm". */
export const jobBasis = (job) => Object.entries(job || {}).map(([k, v]) => (JOB_WORDS[k] ? JOB_WORDS[k](v) : `${String(k).replace(/_/g, ' ')} ${v}`)).join(', ');

/** From a worked quantity's rows ({ low, high, unit, packs }): the cart quantity and unit, the pack breakdown and the need as text. */
export function qtyFromRows(rows) {
  const r = rows && rows[0]; if (!r) return { qty: 1, unit: 'pack', packs: '', need: '' };
  const low = Number(r.low) || 0; const high = Number(r.high) || 0; const u = clip(r.unit, 6);
  const need = high ? (low && low !== high ? `${r2(low)} to ${r2(high)}` : String(r2(high))) + (u ? ' ' + u : '') : '';
  const packs = clip(r.packs, 200).replace(/\s*\([^)]*\)\s*$/, '');
  const counts = [...packs.matchAll(/(\d+)\s*x\s*[\d.]+/g)].map((m) => parseInt(m[1], 10));
  if (counts.length) return { qty: Math.max(1, counts.reduce((a, b) => a + b, 0)), unit: 'pack', packs, need };
  const unit = unitFromWord(u);
  if (high && unit) return { qty: Math.max(1, Math.ceil(high)), unit, packs: '', need };
  return { qty: 1, unit: 'pack', packs: '', need };
}

/* ------------------------------------------------------------------ cleaning */
export function cleanItem(i) {
  if (!i || typeof i !== 'object') return null;
  const id = clip(i.id, 100); if (!id || BAD_NAMES.has(id)) return null;
  let calc = null;
  if (i.calc && typeof i.calc === 'object' && !Array.isArray(i.calc)) { try { const s = JSON.stringify(i.calc); if (s.length < 6000) calc = JSON.parse(s); } catch { calc = null; } }
  const job = i.job && typeof i.job === 'object' && !Array.isArray(i.job) ? Object.fromEntries(Object.entries(i.job).slice(0, 14).filter(([, v]) => typeof v === 'number' || typeof v === 'string').map(([k, v]) => [clip(k, 30), typeof v === 'number' ? v : clip(v, 40)])) : {};
  return {
    id, name: clip(i.name, 160), qty: Math.round(num(i.qty, 1, 1, 99999)), unit: clip(i.unit, 20) || 'pack', note: clip(i.note, LIMITS.text),
    need: clip(i.need, 80), packs: clip(i.packs, 200), basis: clip(i.basis, 300), url: clip(i.url, 400), phrase: clip(i.phrase, 400), job,
    from: ['bot', 'portal', 'finder', 'migrated'].includes(i.from) ? i.from : 'portal', question: clip(i.question, 300),
    systemTitle: clip(i.systemTitle, 200), systemSlug: clip(i.systemSlug, 120), estimate: clip(i.estimate, 200),
    added: clip(i.added, 40), updated: clip(i.updated, 40), calc,
  };
}


/* ------------------------------------------------------------------ calculations (additive field: older saved files simply have none) */
export const CALC_KINDS = ['arithmetic', 'convert', 'perimeter', 'tiles', 'grout', 'sealant', 'bed', 'mixwater', 'timeline', 'product'];
const jsonSmall = (v, max) => { if (v == null || typeof v !== 'object') return null; try { const t = JSON.stringify(v); if (t.length > max) return null; return JSON.parse(t); } catch { return null; } };
/** One stored calculation: id, when, kind, product id or "none", inputs as typed and normalised, the result (quantity, unit, packs, range low and high), the citation, the estimate sentence and where it was used. */
export function cleanCalc(c) {
  if (!c || typeof c !== 'object') return null;
  const id = clip(c.id, 60); if (!id || BAD_NAMES.has(id)) return null;
  const kind = CALC_KINDS.includes(c.kind) ? c.kind : null; if (!kind) return null;
  const cit = c.citation && typeof c.citation === 'object' ? { text: clip(c.citation.text, 400), url: clip(c.citation.url, 400), page: c.citation.page == null ? null : clip(String(c.citation.page), 10), kind: clip(c.citation.kind, 20) } : null;
  const res = jsonSmall(c.result, 4000) || {};
  return {
    id, t: clip(c.t, 40), kind, product: clip(c.product, 100) || 'none', productName: clip(c.productName, 160), title: clip(c.title, 200), question: clip(c.question, 300),
    inputs: jsonSmall(c.inputs, 2000) || {}, normalised: jsonSmall(c.normalised, 2000) || {}, result: res, summary: clip(c.summary, 300), answer: clip(c.answer, 300), formula: clip(c.formula, 400),
    citation: cit, estimate: clip(c.estimate, 200),
    usedIn: (Array.isArray(c.usedIn) ? c.usedIn : []).slice(0, 10).map((u) => ({ type: ['cart', 'quote'].includes(u && u.type) ? u.type : 'cart', ref: clip(u && u.ref, 100), t: clip(u && u.t, 40) })),
  };
}

/** The cart as one comparable string (product, quantity, unit), so a quote request can tell when the cart changed after it was prepared. */
export const sigOf = (items) => (items || []).map((i) => `${i.id}:${i.qty}:${i.unit}`).sort().join('|');
const REF_RX = /^SQ-\d{8}-[0-9A-Z]{4}$/;
/** A quote request record (demo only, this browser only): the lines as they were, the job basics, the contact, the document links. */
export function cleanQuote(q) {
  if (!q || typeof q !== 'object') return null;
  const ref = clip(q.ref, 24); if (!REF_RX.test(ref)) return null;
  const c = q.contact && typeof q.contact === 'object' ? q.contact : {}; const site = q.site && typeof q.site === 'object' ? q.site : {}; const nd = q.needed && typeof q.needed === 'object' ? q.needed : {};
  return {
    ref, status: q.status === 'stale' ? 'stale' : 'prepared', created: clip(q.created, 40), project: clip(q.project, LIMITS.name), sig: clip(q.sig, 6000), supersedes: REF_RX.test(clip(q.supersedes, 24)) ? clip(q.supersedes, 24) : '',
    lines: (Array.isArray(q.lines) ? q.lines : []).slice(0, LIMITS.items).map((l) => ({ id: clip(l && l.id, 100), name: clip(l && l.name, 160), qty: Math.round(num(l && l.qty, 1, 1, 99999)), unit: clip(l && l.unit, 20) || 'pack', packs: clip(l && l.packs, 200), need: clip(l && l.need, 80), basis: clip(l && l.basis, 300), url: clip(l && l.url, 400), phrase: clip(l && l.phrase, 400) })).filter((l) => l.id),
    site: { postcode: /^\d{4}$/.test(clip(site.postcode, 4)) ? clip(site.postcode, 4) : '', suburb: clip(site.suburb, 60), text: clip(site.text, 80) },
    needed: { iso: /^\d{4}-\d{2}-\d{2}$/.test(clip(nd.iso, 10)) ? clip(nd.iso, 10) : '', text: clip(nd.text, 60) },
    delivery: ['delivery', 'pickup', 'unsure'].includes(q.delivery) ? q.delivery : '', role: clip(q.role, 60), company: clip(q.company, 80),
    contact: { name: clip(c.name, 80), email: clip(c.email, 120), phone: clip(c.phone, 30), best: clip(c.best, 60) }, notes: clip(q.notes, LIMITS.text),
    calcs: (Array.isArray(q.calcs) ? q.calcs : []).slice(0, 10).map((k) => ({ id: clip(k && k.id, 60), title: clip(k && k.title, 200), answer: clip(k && k.answer, 300), formula: clip(k && k.formula, 400), source: clip(k && k.source, 400), url: clip(k && k.url, 400), estimate: clip(k && k.estimate, 200) })).filter((k) => k.id && k.answer),
    docs: (Array.isArray(q.docs) ? q.docs : []).slice(0, 40).map((d) => ({ product: clip(d && d.product, 160), kind: clip(d && d.kind, 40), title: clip(d && d.title, 160), url: clip(d && d.url, 400) })).filter((d) => d.url),
  };
}

function cleanProject(p, name) {
  p = p && typeof p === 'object' ? p : {};
  const arr = (a) => (Array.isArray(a) ? a.slice(0, LIMITS.perList) : []);
  const items = []; for (const raw of (Array.isArray(p.items) ? p.items : []).slice(0, LIMITS.items)) { const it = cleanItem(raw); if (it && !items.some((x) => x.id === it.id)) items.push(it); }
  return {
    name,
    created: clip(p.created, 40), updated: clip(p.updated, 40),
    items,
    systems: arr(p.systems).map((s) => ({ title: clip(s.title, 200), slug: clip(s.slug, 120), env: clip(s.env, 40), tile: clip(s.tile, 40), substrate: clip(s.substrate, 40), steps: s.steps && typeof s.steps === 'object' ? Object.fromEntries(Object.entries(s.steps).slice(0, 12).map(([k, v]) => [clip(k, 30), (Array.isArray(v) ? v : []).slice(0, 6).map((x) => clip(x, 80))])) : {}, saved: clip(s.saved, 40) })),
    quantities: arr(p.quantities).map((q) => ({ productId: clip(q.productId, 100), name: clip(q.name, 160), job: q.job && typeof q.job === 'object' ? Object.fromEntries(Object.entries(q.job).slice(0, 14).filter(([, v]) => typeof v === 'number' || typeof v === 'string').map(([k, v]) => [clip(k, 30), typeof v === 'number' ? v : clip(v, 40)])) : {}, rows: arr(q.rows).slice(0, 6).map((r) => ({ low: Number(r.low) || 0, high: Number(r.high) || 0, unit: clip(r.unit, 6), packs: clip(r.packs, 200), phrase: clip(r.phrase, 400), url: clip(r.url, 400) })), saved: clip(q.saved, 40) })),
    documents: arr(p.documents).map((d) => ({ title: clip(d.title, 200), url: clip(d.url, 400), saved: clip(d.saved, 40) })),
    notes: arr(p.notes).map((n) => ({ text: clip(n.text, LIMITS.text), saved: clip(n.saved, 40) })),
    calculations: (Array.isArray(p.calculations) ? p.calculations : []).slice(0, LIMITS.calcs).map(cleanCalc).filter(Boolean),
    quotes: (Array.isArray(p.quotes) ? p.quotes : []).slice(0, LIMITS.quotes).map(cleanQuote).filter(Boolean),
  };
}

/** The same item from a worked-out quantity record. */
function itemFromQuantity(q, from, clock, question) {
  const d = qtyFromRows(q.rows); const r = q.rows[0] || {};
  const basis = jobBasis(q.job);
  return cleanItem({ id: q.productId, name: q.name, qty: d.qty, unit: d.unit, need: d.need, packs: d.packs, basis, url: r.url, phrase: r.phrase, job: q.job, from, question, added: q.saved || nowIso(clock), updated: q.saved || nowIso(clock) });
}
/** Merge `b` over `a` field by field: a field of b wins when it holds something; empty fields never blank a filled one. */
const mergeItem = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) if (v !== '' && v != null && !(k === 'job' && !Object.keys(v).length)) o[k] = v; return o; };

function validate(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, error: 'This is not a project file from this assistant.' };
  if (o.v !== 1) return { ok: false, error: 'This project file has an unknown version, so I will not read it.' };
  if (!o.projects || typeof o.projects !== 'object' || Array.isArray(o.projects)) return { ok: false, error: 'The file has no projects in it.' };
  const names = Object.keys(o.projects);
  if (names.length > LIMITS.projects) return { ok: false, error: `The file has more than ${LIMITS.projects} projects, which is more than this demo keeps.` };
  const out = empty();
  for (const n of names) { const nm = clip(n, LIMITS.name); if (!nm || BAD_NAMES.has(nm)) continue; const p = o.projects[n]; if (!p || typeof p !== 'object') continue; out.projects[nm] = cleanProject(p, nm); }
  out.current = out.projects[clip(o.current, LIMITS.name)] ? clip(o.current, LIMITS.name) : Object.keys(out.projects)[0] || '';
  out.recent = (Array.isArray(o.recent) ? o.recent : []).slice(0, LIMITS.recent).map((r) => ({ q: clip(r && r.q, 300), action: clip(r && r.action, 20), t: clip(r && r.t, 40) })).filter((r) => r.q);
  out.gaps = (Array.isArray(o.gaps) ? o.gaps : []).slice(0, LIMITS.gaps).map((g) => ({ q: clip(g && g.q, 300), t: clip(g && g.t, 40), count: Math.max(1, Math.min(999, Number(g && g.count) || 1)) })).filter((g) => g.q);
  return { ok: true, state: out };
}

/* ------------------------------------------------------------------ storage and change notices */
const subs = new Set();
/** Called after every write by any store in this page: fn({ origin }) where origin is 'portal' or 'bot'. Returns an unsubscribe. */
export function onProjectChange(fn) { subs.add(fn); return () => subs.delete(fn); }
const emit = (origin) => subs.forEach((f) => { try { f({ origin }); } catch { /* a bad listener never breaks a save */ } });

/** Tell this page's listeners something changed elsewhere (another tab wrote to storage). */
export const announceChange = (origin = 'other') => emit(origin);

const tabOnly = new Map();
/** localStorage when the browser allows it; otherwise one in-memory store shared by the portal and the advisor for this tab (volatile = true). */
export function sharedStorage() {
  try { const s = globalThis.localStorage; if (s) { s.getItem('x'); return s; } } catch { /* blocked */ }
  return globalThis.__sikaTabStorage ||= { volatile: true, getItem: (k) => (tabOnly.has(k) ? tabOnly.get(k) : null), setItem: (k, v) => { tabOnly.set(k, String(v)); }, removeItem: (k) => { tabOnly.delete(k); } };
}

/* ------------------------------------------------------------------ the store */
export function createProjectStore(storage, clock, { origin = 'bot' } = {}) {
  let state = empty(); let persistent = !(storage && storage.volatile); let loadedFrom = 'empty'; let lastRaw; let migratedTried = false;
  const getRaw = (k) => { try { return storage ? storage.getItem(k) : null; } catch { persistent = false; return null; } };
  const parse = (raw) => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const write = () => {
    if (!storage) { persistent = false; return false; }
    try { const raw = JSON.stringify(state); storage.setItem(KEY, raw); lastRaw = raw; emit(origin); return true; } catch { persistent = false; emit(origin); return false; }
  };

  function migrate() {
    migratedTried = true;
    const a = parse(getRaw(LEGACY_ACTIONS_KEY)); const v = a ? validate(a) : { ok: false };
    const out = v.ok ? v.state : empty(); let found = v.ok && (Object.keys(out.projects).length > 0 || out.recent.length > 0 || out.gaps.length > 0);
    for (const p of Object.values(out.projects)) for (const q of p.quantities) { const it = itemFromQuantity(q, 'migrated', clock); if (it) p.items = mergeItem0(p.items, it); }
    const old = parse(getRaw(LEGACY_PORTAL_KEY));
    if (Array.isArray(old) && old.length) {
      const items = old.slice(0, LIMITS.items).map((x) => cleanItem({ ...(x && typeof x === 'object' ? x : {}), from: 'portal', added: nowIso(clock), updated: nowIso(clock) })).filter(Boolean);
      if (items.length) {
        if (!out.current || !out.projects[out.current]) { out.current = out.current || DEFAULT_PROJECT; out.projects[out.current] = cleanProject({ created: nowIso(clock), updated: nowIso(clock) }, out.current); }
        const p = out.projects[out.current]; for (const it of items) p.items = mergeItem0(p.items, it, true); found = true;
      }
    }
    if (found) { state = out; loadedFrom = 'migrated'; write(); }
  }
  // an item list with one item merged in by product id; `win` = the incoming fields win (the portal's quantity and unit are what the visitor set)
  function mergeItem0(list, it, win) { const i = list.findIndex((x) => x.id === it.id); if (i < 0) return [...list, it].slice(0, LIMITS.items); const m = list.slice(); m[i] = win ? mergeItem(list[i], it) : mergeItem(it, list[i]); return m; }

  function sync() {
    if (!storage) return;
    const raw = getRaw(KEY);
    if (lastRaw !== undefined && raw === lastRaw) return;
    lastRaw = raw;
    const o = parse(raw); const v = o ? validate(o) : { ok: false };
    if (v.ok) { state = v.state; loadedFrom = loadedFrom === 'migrated' ? 'migrated' : 'storage'; return; }
    if (!migratedTried) migrate(); // nothing usable here yet: bring the two old stores in, once (they stay untouched as a backup)
  }
  sync();

  const ensureProject = () => {
    if (!state.current || !state.projects[state.current]) {
      const name = state.current || DEFAULT_PROJECT;
      state.projects[name] = cleanProject({ created: nowIso(clock), updated: nowIso(clock) }, name); state.current = name;
    }
    return state.projects[state.current];
  };
  // a cart edit after a quote request was prepared marks that request stale (it no longer matches the cart); it never comes back by itself
  const touch = (p) => { p.updated = nowIso(clock); const sg = sigOf(p.items); for (const q of p.quotes || []) if (q.status === 'prepared' && q.sig !== sg) q.status = 'stale'; write(); };
  const push = (p, list, item) => { p[list].unshift(item); if (p[list].length > LIMITS.perList) p[list].length = LIMITS.perList; touch(p); };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cur = () => (state.current ? state.projects[state.current] || null : null);
  const copy = (x) => JSON.parse(JSON.stringify(x));
  // wrap so every public call starts from what is in storage now
  const S = (fn) => (...a) => { sync(); return fn(...a); };

  const api = {
    persistent: () => persistent, loadedFrom: () => loadedFrom, origin,
    state: S(() => copy(state)),
    list: S(() => Object.values(state.projects).map((p) => ({ name: p.name, updated: p.updated, counts: { items: p.items.length, systems: p.systems.length, quantities: p.quantities.length, documents: p.documents.length, notes: p.notes.length, quotes: (p.quotes || []).length } }))),
    current: S(() => state.current),
    currentProject: S(() => (cur() ? copy(cur()) : null)),
    productsOf(p) {
      const ids = new Map();
      for (const it of (p && p.items) || []) ids.set(it.id, it.name || it.id);
      for (const q of (p && p.quantities) || []) if (!ids.has(q.productId)) ids.set(q.productId, q.name);
      for (const s of (p && p.systems) || []) for (const list of Object.values(s.steps || {})) list.slice(0, 1).forEach((id) => { if (!ids.has(id)) ids.set(id, id); });
      return [...ids].map(([id, name]) => ({ id, name }));
    },
    create: S((name) => {
      const nm = clip(name, LIMITS.name) || DEFAULT_PROJECT;
      if (BAD_NAMES.has(nm)) return { ok: false, error: 'That name is not allowed.' };
      if (!state.projects[nm] && Object.keys(state.projects).length >= LIMITS.projects) return { ok: false, error: `This demo keeps up to ${LIMITS.projects} projects.` };
      if (!state.projects[nm]) state.projects[nm] = cleanProject({ created: nowIso(clock), updated: nowIso(clock) }, nm);
      state.current = nm; write(); return { ok: true, name: nm };
    }),
    use: S((name) => {
      const nm = clip(name, LIMITS.name); const hit = Object.keys(state.projects).find((k) => k.toLowerCase() === nm.toLowerCase());
      if (!hit) return { ok: false, error: `There is no project called "${nm}".` };
      state.current = hit; write(); return { ok: true, name: hit };
    }),
    remove: S((name) => { const hit = Object.keys(state.projects).find((k) => k.toLowerCase() === clip(name, LIMITS.name).toLowerCase()); if (!hit) return false; delete state.projects[hit]; if (state.current === hit) state.current = Object.keys(state.projects)[0] || ''; write(); return true; }),

    /* items: the cart */
    items: S(() => (cur() ? copy(cur().items) : [])),
    itemCount: S(() => (cur() ? cur().items.length : 0)),
    hasItem: S((id) => !!cur() && cur().items.some((i) => i.id === id)),
    getItem: S((id) => { const i = cur() && cur().items.find((x) => x.id === id); return i ? copy(i) : null; }),
    /** Add a product, or update it when it is already there (one line per product). `fields` are only the ones given. */
    addItem: S((fields) => {
      const it = cleanItem({ from: origin === 'portal' ? 'portal' : 'bot', ...fields }); if (!it) return { ok: false, error: 'There is no product to add.' };
      const p = ensureProject(); const t = nowIso(clock); const i = p.items.findIndex((x) => x.id === it.id);
      if (i >= 0) { const before = p.items[i]; const given = Object.fromEntries(Object.keys(fields).filter((k) => k in it).map((k) => [k, it[k]])); if ('qty' in given && given.qty !== before.qty && !('packs' in fields)) given.packs = ''; p.items[i] = { ...before, ...given, updated: t }; touch(p); return { ok: true, updated: true, item: copy(p.items[i]), project: p.name, before: copy(before) }; }
      if (p.items.length >= LIMITS.items) return { ok: false, error: `This demo keeps up to ${LIMITS.items} products in a project.` };
      it.added = it.updated = t; p.items.unshift(it); touch(p); return { ok: true, added: true, item: copy(it), project: p.name };
    }),
    setItem: S((id, patch) => {
      const p = cur(); const i = p ? p.items.findIndex((x) => x.id === id) : -1; if (i < 0) return { ok: false, error: 'That product is not in this project.' };
      const before = p.items[i]; const merged = cleanItem({ ...before, ...patch, id }); if ('qty' in patch && merged.qty !== before.qty && !('packs' in patch)) merged.packs = ''; // a changed quantity no longer matches the worked pack breakdown
      p.items[i] = { ...merged, added: before.added, updated: nowIso(clock) }; touch(p); return { ok: true, item: copy(p.items[i]), before: copy(before), project: p.name };
    }),
    removeItem: S((id) => { const p = cur(); const i = p ? p.items.findIndex((x) => x.id === id) : -1; if (i < 0) return { ok: false, error: 'That product is not in this project.' }; const [gone] = p.items.splice(i, 1); touch(p); return { ok: true, item: copy(gone), project: p.name }; }),
    clearItems: S(() => { const p = cur(); if (!p || (!p.items.length && !(p.quotes || []).length)) return { ok: true, removed: 0 }; const n = p.items.length; p.items = []; p.quotes = []; touch(p); return { ok: true, removed: n, project: p.name }; }), // clearing the project clears its quote requests too
    removeSystem: S((i) => { const p = cur(); if (!p || !p.systems[i]) return false; p.systems.splice(i, 1); touch(p); return true; }),
    removeDocument: S((url) => { const p = cur(); if (!p) return false; const n = p.documents.length; p.documents = p.documents.filter((d) => d.url !== url); if (p.documents.length !== n) touch(p); return p.documents.length !== n; }),
    removeNote: S((i) => { const p = cur(); if (!p || !p.notes[i]) return false; p.notes.splice(i, 1); touch(p); return true; }),


    /* calculations: every worked calculation, kept with the project (the quote pack reads them through calculations()) */
    calculations: S(() => (cur() ? copy(cur().calculations || []) : [])),
    allCalculations: S(() => Object.values(state.projects).flatMap((p) => (p.calculations || []).map((c) => ({ ...copy(c), project: p.name })))),
    lastCalculations: S((n = 3) => (cur() ? copy((cur().calculations || []).slice(0, Math.max(0, n))) : [])),
    getCalculation: S((id) => { const c = cur() && (cur().calculations || []).find((x) => x.id === id); return c ? copy(c) : null; }),
    /** Store one. A calculation with the same kind, product, inputs and result is not stored twice (the existing one is returned with duplicate: true). */
    addCalculation: S((rec) => {
      const p = ensureProject(); if (!p.calculations) p.calculations = [];
      const t = nowIso(clock); const seq = (p.calculations.length + 1);
      const c = cleanCalc({ ...rec, id: rec && rec.id && !BAD_NAMES.has(clip(rec.id, 60)) ? rec.id : 'calc-' + t.replace(/\D/g, '').slice(2, 14) + '-' + seq + '-' + (Math.abs(hash(JSON.stringify(rec && rec.inputs) + (rec && rec.kind))) % 1296).toString(36), t: (rec && rec.t) || t });
      if (!c) return { ok: false, error: 'There is no calculation to save.' };
      const dup = p.calculations.find((x) => x.kind === c.kind && x.product === c.product && same(x.inputs, c.inputs) && same(x.result, c.result));
      if (dup) return { ok: true, duplicate: true, calculation: copy(dup), project: p.name };
      if (p.calculations.some((x) => x.id === c.id)) c.id += '-' + p.calculations.length;
      p.calculations.unshift(c); if (p.calculations.length > LIMITS.calcs) p.calculations.length = LIMITS.calcs; touch(p);
      return { ok: true, added: true, calculation: copy(c), project: p.name };
    }),
    /** Re-run or edit: replace inputs, normalised inputs, result and citation of a stored calculation; its id and first time stay. */
    updateCalculation: S((id, patch) => {
      const p = cur(); const i = p ? (p.calculations || []).findIndex((x) => x.id === id) : -1; if (i < 0) return { ok: false, error: 'That calculation is not in this project.' };
      const before = p.calculations[i]; const c = cleanCalc({ ...before, ...patch, id, t: before.t, usedIn: before.usedIn }); if (!c) return { ok: false, error: 'That calculation could not be updated.' };
      p.calculations[i] = c; touch(p); return { ok: true, calculation: copy(c), before: copy(before), project: p.name };
    }),
    removeCalculation: S((id) => { const p = cur(); const i = p ? (p.calculations || []).findIndex((x) => x.id === id) : -1; if (i < 0) return false; p.calculations.splice(i, 1); touch(p); return true; }),
    /** Record that a cart line or a quote came from this calculation: ref is the product id (cart) or the quote reference. */
    markCalculationUsed: S((id, use) => {
      const p = cur(); const c = p && (p.calculations || []).find((x) => x.id === id); if (!c) return false;
      const u = cleanCalc({ ...c, usedIn: [{ type: use && use.type, ref: use && use.ref, t: nowIso(clock) }] }).usedIn[0];
      if (!c.usedIn.some((x) => x.type === u.type && x.ref === u.ref)) c.usedIn.push(u); touch(p); return true;
    }),
    /* quote requests (demo only): the record of what was prepared, kept with the project it came from */
    quotes: S(() => (cur() ? copy(cur().quotes || []) : [])),
    getQuote: S((ref) => { const q = cur() && (cur().quotes || []).find((x) => x.ref === ref); return q ? copy(q) : null; }),
    addQuote: S((rec) => {
      const q = cleanQuote(rec); if (!q) return { ok: false, error: 'That is not a quote request record.' };
      const p = ensureProject(); p.quotes ||= []; if (p.quotes.some((x) => x.ref === q.ref)) return { ok: false, error: 'That reference is already used.' };
      p.quotes.unshift(q); if (p.quotes.length > LIMITS.quotes) p.quotes.length = LIMITS.quotes; p.updated = nowIso(clock); write(); return { ok: true, quote: copy(q), project: p.name };
    }),
    removeQuote: S((ref) => { const p = cur(); const n = p && p.quotes ? p.quotes.length : 0; if (!p || !n) return false; p.quotes = p.quotes.filter((x) => x.ref !== ref); if (p.quotes.length === n) return false; p.updated = nowIso(clock); write(); return true; }),

    saveSystem: S((s) => { const p = ensureProject(); const item = cleanProject({ systems: [{ ...s, saved: nowIso(clock) }] }, 'x').systems[0]; if (p.systems.some((x) => x.title === item.title && same(x.steps, item.steps))) return { ok: true, duplicate: true, project: p.name }; push(p, 'systems', item); return { ok: true, project: p.name }; }),
    saveQuantity: S((q, question) => {
      const p = ensureProject(); const item = cleanProject({ quantities: [{ ...q, saved: nowIso(clock) }] }, 'x').quantities[0];
      const line = itemFromQuantity(item, origin === 'portal' ? 'portal' : 'bot', clock, question);
      if (line) { const i = p.items.findIndex((x) => x.id === line.id); if (i >= 0) p.items[i] = { ...mergeItem(p.items[i], line), added: p.items[i].added || line.added }; else p.items.unshift(line); p.items = p.items.slice(0, LIMITS.items); }
      const i = p.quantities.findIndex((x) => x.productId === item.productId); if (i >= 0) { p.quantities[i] = item; touch(p); return { ok: true, replaced: true, project: p.name, item: line ? copy(line) : null }; } push(p, 'quantities', item); return { ok: true, project: p.name, item: line ? copy(line) : null };
    }),
    saveDocument: S((d) => { const p = ensureProject(); const item = cleanProject({ documents: [{ ...d, saved: nowIso(clock) }] }, 'x').documents[0]; if (!item.url || p.documents.some((x) => x.url === item.url)) return { ok: true, duplicate: true, project: p.name }; push(p, 'documents', item); return { ok: true, project: p.name }; }),
    addNote: S((text) => { const t = clip(text, LIMITS.text); if (!t) return { ok: false, error: 'There is no note text.' }; const p = ensureProject(); push(p, 'notes', { text: t, saved: nowIso(clock) }); return { ok: true, project: p.name }; }),
    rememberQuestion: S((q, action) => { const t = clip(q, 300); if (!t) return; state.recent = [{ q: t, action: clip(action || 'ask', 20), t: nowIso(clock) }, ...state.recent.filter((r) => r.q !== t)].slice(0, LIMITS.recent); write(); }),
    recent: S(() => state.recent.slice()),
    addGap: S((q) => { const t = clip(q, 300); if (!t) return; const g = state.gaps.find((x) => x.q.toLowerCase() === t.toLowerCase()); if (g) { g.count = Math.min(999, g.count + 1); g.t = nowIso(clock); } else state.gaps.unshift({ q: t, t: nowIso(clock), count: 1 }); state.gaps = state.gaps.slice(0, LIMITS.gaps); write(); }),
    gaps: S(() => state.gaps.slice()),
    clearGaps: S(() => { state.gaps = []; write(); }),
    exportJSON: S((notice) => JSON.stringify({ ...state, exported: nowIso(clock), note: notice || 'Demo only. This file stays on your computer.' }, null, 1)),
    importJSON: S((text, { merge = true } = {}) => {
      let o; try { o = JSON.parse(String(text || '')); } catch { return { ok: false, error: 'That is not valid JSON.' }; }
      const v = validate(o); if (!v.ok) return v;
      // an older file (no items) still carries worked quantities: they become cart lines
      for (const p of Object.values(v.state.projects)) for (const q of p.quantities) { const it = itemFromQuantity(q, 'migrated', clock); if (it) p.items = mergeItem0(p.items, it); }
      if (!merge) state = v.state;
      else {
        for (const [n, p] of Object.entries(v.state.projects)) { if (!state.projects[n]) { if (Object.keys(state.projects).length >= LIMITS.projects) continue; state.projects[n] = p; continue; } const c = state.projects[n]; for (const l of ['systems', 'quantities', 'documents', 'notes']) for (const it of p[l]) if (!c[l].some((x) => same(x, it))) c[l].push(it); for (const it of p.items) if (!c.items.some((x) => x.id === it.id)) c.items.push(it); for (const it of p.calculations) if (!c.calculations.some((x) => x.id === it.id)) c.calculations.push(it); c.quotes ||= []; for (const qq of p.quotes || []) if (!c.quotes.some((x) => x.ref === qq.ref)) c.quotes.push(qq); c.updated = p.updated || c.updated; }
        state.recent = [...v.state.recent, ...state.recent].filter((r, i, a) => a.findIndex((x) => x.q === r.q) === i).slice(0, LIMITS.recent);
        for (const g of v.state.gaps) if (!state.gaps.some((x) => x.q.toLowerCase() === g.q.toLowerCase())) state.gaps.push(g);
        state.gaps = state.gaps.slice(0, LIMITS.gaps);
        if (!state.current) state.current = v.state.current;
      }
      write(); return { ok: true, projects: Object.keys(v.state.projects).length };
    }),
    // an explicit empty record, not a removed key: a removed key would let the migration bring the old data back
    clearAll() { sync(); state = empty(); write(); },
  };
  return api;
}

/* ------------------------------------------------------------------ the job pack (all in the browser, nothing sent) */
const csvCell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
export const itemLine = (it) => `${it.qty} ${unitLabel(it.unit, it.qty)}${it.packs ? ' (' + it.packs + ')' : ''}`;
export const DOC_KINDS = { product_data_sheet: 'Data sheet', safety_data_sheet: 'Safety data sheet' };

/** getDocs(productId) -> Promise<[{ type, title, url, http? }]>; only data sheets and SDS with a working link are listed. */
export async function buildJobPack(project, getDocs, { nameOf } = {}) {
  const p = project || { name: DEFAULT_PROJECT, items: [], documents: [], notes: [], systems: [], calculations: [] };
  const nm = (it) => clip((nameOf && nameOf(it.id)) || it.name || it.id, 160);
  const docs = [];
  for (const it of p.items) {
    let list = []; try { list = (getDocs ? await getDocs(it.id) : []) || []; } catch { list = []; }
    for (const d of list) { const kind = DOC_KINDS[d.type]; const url = (d.http && d.http.url) || d.url; if (!kind || !url || (d.http && d.http.status && d.http.status !== 200)) continue; if (!docs.some((x) => x.url === url)) docs.push({ product: nm(it), kind, title: clip(d.title, 160), url }); }
  }
  for (const d of p.documents) if (!docs.some((x) => x.url === d.url)) docs.push({ product: 'Saved from the advisor', kind: 'Document', title: d.title, url: d.url });
  const head = ['Product', 'Quantity', 'Unit', 'Worked out', 'Packs, rounded up', 'Basis', 'Source', 'Note'];
  const body = p.items.map((it) => [nm(it), it.qty, unitLabel(it.unit, it.qty), it.need || '', it.packs || '', it.basis || '', it.url || '', it.note || '']);
  const csv = [head, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n' + csvCell(ESTIMATE_LINE) + '\r\n';
  const docsText = [`Data sheets and safety data sheets for ${p.name}`, 'Open each link on the Sika Australia website. Nothing is downloaded or sent by this page.', '', ...(docs.length ? docs.map((d) => `${d.product} | ${d.kind} | ${d.title}\n${d.url}`) : ['No documents are listed for the products in this project.'])].join('\n') + '\n';
  const enquiry = [`Project: ${p.name}`, '', 'Products and quantities:', ...(p.items.length ? p.items.map((it) => `- ${nm(it)}: ${itemLine(it)}${it.need ? ', need about ' + it.need : ''}${it.note ? ' (' + it.note + ')' : ''}`) : ['- none yet']),
    ...(p.systems.length ? ['', 'System:', ...p.systems.map((s) => `- ${s.title}`)] : []), ...(p.notes.length ? ['', 'Notes:', ...p.notes.map((n) => `- ${n.text}`)] : []), ...((p.calculations || []).length ? ['', 'Calculations (estimates, with their working):', ...p.calculations.map((c) => `- ${c.title}: ${c.answer || c.summary}${c.formula ? ' (' + c.formula + ')' : ''}`)] : []), '', ESTIMATE_LINE].join('\n');
  return { name: p.name, rows: body, head, csv, docs, docsText, enquiry };
}
