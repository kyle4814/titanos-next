// Actions v2, project memory. Demo only and this browser only: named projects holding saved systems, quantities, documents and notes,
// recent questions and a "my gaps" list. Storage is injected (localStorage in the browser); every access is wrapped in try/catch so a blocked
// or full store never breaks the assistant (it then keeps the data for this tab only and says so). Nothing is ever sent anywhere.
import { plain, IN_BROWSER_NOTICE } from './core.js';

export const KEY = 'sika-demo-210c0c-actions-v1';
export const LIMITS = { projects: 30, perList: 100, recent: 30, gaps: 50, text: 500, name: 60 };
const clip = (s, n) => plain(String(s == null ? '' : s)).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const nowIso = (clock) => (clock ? clock() : new Date()).toISOString();
const empty = () => ({ v: 1, current: '', projects: {}, recent: [], gaps: [] });

function cleanProject(p, name) {
  const arr = (a) => (Array.isArray(a) ? a.slice(0, LIMITS.perList) : []);
  return {
    name,
    created: clip(p.created, 40), updated: clip(p.updated, 40),
    systems: arr(p.systems).map((s) => ({ title: clip(s.title, 200), slug: clip(s.slug, 120), env: clip(s.env, 40), tile: clip(s.tile, 40), substrate: clip(s.substrate, 40), steps: s.steps && typeof s.steps === 'object' ? Object.fromEntries(Object.entries(s.steps).slice(0, 12).map(([k, v]) => [clip(k, 30), (Array.isArray(v) ? v : []).slice(0, 6).map((x) => clip(x, 80))])) : {}, saved: clip(s.saved, 40) })),
    quantities: arr(p.quantities).map((q) => ({ productId: clip(q.productId, 100), name: clip(q.name, 160), job: q.job && typeof q.job === 'object' ? Object.fromEntries(Object.entries(q.job).slice(0, 14).filter(([, v]) => typeof v === 'number' || typeof v === 'string').map(([k, v]) => [clip(k, 30), typeof v === 'number' ? v : clip(v, 40)])) : {}, rows: arr(q.rows).slice(0, 6).map((r) => ({ low: Number(r.low) || 0, high: Number(r.high) || 0, unit: clip(r.unit, 6), packs: clip(r.packs, 200), phrase: clip(r.phrase, 400), url: clip(r.url, 400) })), saved: clip(q.saved, 40) })),
    documents: arr(p.documents).map((d) => ({ title: clip(d.title, 200), url: clip(d.url, 400), saved: clip(d.saved, 40) })),
    notes: arr(p.notes).map((n) => ({ text: clip(n.text, LIMITS.text), saved: clip(n.saved, 40) })),
  };
}

export function createMemory(storage, clock) {
  let state = empty(); let persistent = true; let loadedFrom = 'empty';
  const read = () => {
    try { const raw = storage && storage.getItem(KEY); if (!raw) return null; return JSON.parse(raw); } catch { persistent = false; return null; }
  };
  const write = () => {
    try { if (!storage) { persistent = false; return false; } storage.setItem(KEY, JSON.stringify(state)); return true; } catch { persistent = false; return false; }
  };
  const validate = (o) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, error: 'This is not a project file from this assistant.' };
    if (o.v !== 1) return { ok: false, error: 'This project file has an unknown version, so I will not read it.' };
    if (!o.projects || typeof o.projects !== 'object' || Array.isArray(o.projects)) return { ok: false, error: 'The file has no projects in it.' };
    const names = Object.keys(o.projects);
    if (names.length > LIMITS.projects) return { ok: false, error: `The file has more than ${LIMITS.projects} projects, which is more than this demo keeps.` };
    const out = empty();
    for (const n of names) { const nm = clip(n, LIMITS.name); if (!nm || nm === '__proto__' || nm === 'constructor' || nm === 'prototype') continue; const p = o.projects[n]; if (!p || typeof p !== 'object') continue; out.projects[nm] = cleanProject(p, nm); }
    out.current = out.projects[clip(o.current, LIMITS.name)] ? clip(o.current, LIMITS.name) : Object.keys(out.projects)[0] || '';
    out.recent = (Array.isArray(o.recent) ? o.recent : []).slice(0, LIMITS.recent).map((r) => ({ q: clip(r.q, 300), action: clip(r.action, 20), t: clip(r.t, 40) })).filter((r) => r.q);
    out.gaps = (Array.isArray(o.gaps) ? o.gaps : []).slice(0, LIMITS.gaps).map((g) => ({ q: clip(g.q, 300), t: clip(g.t, 40), count: Math.max(1, Math.min(999, Number(g.count) || 1)) })).filter((g) => g.q);
    return { ok: true, state: out };
  };
  const init = read();
  if (init) { const v = validate(init); if (v.ok) { state = v.state; loadedFrom = 'storage'; } }
  const ensureProject = () => {
    if (!state.current || !state.projects[state.current]) {
      const name = state.current || 'My project';
      state.projects[name] = cleanProject({ created: nowIso(clock), updated: nowIso(clock) }, name); state.current = name;
    }
    return state.projects[state.current];
  };
  const touch = (p) => { p.updated = nowIso(clock); write(); };
  const push = (p, list, item) => { p[list].unshift(item); if (p[list].length > LIMITS.perList) p[list].length = LIMITS.perList; touch(p); };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const api = {
    notice: IN_BROWSER_NOTICE,
    persistent: () => persistent, loadedFrom: () => loadedFrom,
    state: () => JSON.parse(JSON.stringify(state)),
    list: () => Object.values(state.projects).map((p) => ({ name: p.name, updated: p.updated, counts: { systems: p.systems.length, quantities: p.quantities.length, documents: p.documents.length, notes: p.notes.length } })),
    current: () => state.current,
    currentProject: () => (state.current ? state.projects[state.current] || null : null),
    productsOf(p) {
      const ids = new Map();
      for (const q of (p && p.quantities) || []) ids.set(q.productId, q.name);
      for (const s of (p && p.systems) || []) for (const list of Object.values(s.steps || {})) list.slice(0, 1).forEach((id) => { if (!ids.has(id)) ids.set(id, id); });
      return [...ids].map(([id, name]) => ({ id, name }));
    },
    create(name) {
      const nm = clip(name, LIMITS.name) || 'My project';
      if (nm === '__proto__' || nm === 'constructor') return { ok: false, error: 'That name is not allowed.' };
      if (!state.projects[nm] && Object.keys(state.projects).length >= LIMITS.projects) return { ok: false, error: `This demo keeps up to ${LIMITS.projects} projects.` };
      if (!state.projects[nm]) state.projects[nm] = cleanProject({ created: nowIso(clock), updated: nowIso(clock) }, nm);
      state.current = nm; write(); return { ok: true, name: nm };
    },
    use(name) {
      const nm = clip(name, LIMITS.name); const hit = Object.keys(state.projects).find((k) => k.toLowerCase() === nm.toLowerCase());
      if (!hit) return { ok: false, error: `There is no project called "${nm}".` };
      state.current = hit; write(); return { ok: true, name: hit };
    },
    remove(name) { const hit = Object.keys(state.projects).find((k) => k.toLowerCase() === clip(name, LIMITS.name).toLowerCase()); if (!hit) return false; delete state.projects[hit]; if (state.current === hit) state.current = Object.keys(state.projects)[0] || ''; write(); return true; },
    saveSystem(s) { const p = ensureProject(); const item = cleanProject({ systems: [{ ...s, saved: nowIso(clock) }] }, 'x').systems[0]; if (p.systems.some((x) => x.title === item.title && same(x.steps, item.steps))) return { ok: true, duplicate: true, project: p.name }; push(p, 'systems', item); return { ok: true, project: p.name }; },
    saveQuantity(q) { const p = ensureProject(); const item = cleanProject({ quantities: [{ ...q, saved: nowIso(clock) }] }, 'x').quantities[0]; const i = p.quantities.findIndex((x) => x.productId === item.productId); if (i >= 0) { p.quantities[i] = item; touch(p); return { ok: true, replaced: true, project: p.name }; } push(p, 'quantities', item); return { ok: true, project: p.name }; },
    saveDocument(d) { const p = ensureProject(); const item = cleanProject({ documents: [{ ...d, saved: nowIso(clock) }] }, 'x').documents[0]; if (!item.url || p.documents.some((x) => x.url === item.url)) return { ok: true, duplicate: true, project: p.name }; push(p, 'documents', item); return { ok: true, project: p.name }; },
    addNote(text) { const t = clip(text, LIMITS.text); if (!t) return { ok: false, error: 'There is no note text.' }; const p = ensureProject(); push(p, 'notes', { text: t, saved: nowIso(clock) }); return { ok: true, project: p.name }; },
    rememberQuestion(q, action) { const t = clip(q, 300); if (!t) return; state.recent = [{ q: t, action: clip(action || 'ask', 20), t: nowIso(clock) }, ...state.recent.filter((r) => r.q !== t)].slice(0, LIMITS.recent); write(); },
    recent: () => state.recent.slice(),
    addGap(q) { const t = clip(q, 300); if (!t) return; const g = state.gaps.find((x) => x.q.toLowerCase() === t.toLowerCase()); if (g) { g.count = Math.min(999, g.count + 1); g.t = nowIso(clock); } else state.gaps.unshift({ q: t, t: nowIso(clock), count: 1 }); state.gaps = state.gaps.slice(0, LIMITS.gaps); write(); },
    gaps: () => state.gaps.slice(),
    clearGaps() { state.gaps = []; write(); },
    exportJSON() { return JSON.stringify({ ...state, exported: nowIso(clock), note: IN_BROWSER_NOTICE }, null, 1); },
    importJSON(text, { merge = true } = {}) {
      let o; try { o = JSON.parse(String(text || '')); } catch { return { ok: false, error: 'That is not valid JSON.' }; }
      const v = validate(o); if (!v.ok) return v;
      if (!merge) state = v.state;
      else {
        for (const [n, p] of Object.entries(v.state.projects)) { if (!state.projects[n]) { if (Object.keys(state.projects).length >= LIMITS.projects) continue; state.projects[n] = p; continue; } const cur = state.projects[n]; for (const l of ['systems', 'quantities', 'documents', 'notes']) for (const it of p[l]) if (!cur[l].some((x) => same(x, it))) cur[l].push(it); cur.updated = p.updated || cur.updated; }
        state.recent = [...v.state.recent, ...state.recent].filter((r, i, a) => a.findIndex((x) => x.q === r.q) === i).slice(0, LIMITS.recent);
        for (const g of v.state.gaps) if (!state.gaps.some((x) => x.q.toLowerCase() === g.q.toLowerCase())) state.gaps.push(g);
        state.gaps = state.gaps.slice(0, LIMITS.gaps);
        if (!state.current) state.current = v.state.current;
      }
      write(); return { ok: true, projects: Object.keys(v.state.projects).length };
    },
    clearAll() { state = empty(); try { storage && storage.removeItem(KEY); } catch { persistent = false; } },
  };
  return api;
}
