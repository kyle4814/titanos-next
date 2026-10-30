// Actions v2, conversation flow: routes a question to an action, remembers facets within the session, asks AT MOST ONE clarifying question
// per request (a second turn answers with what it has and says what is missing), and chains actions ("now make that a project pack").
import { route, parseNumbers, parseFacets, COMMANDS } from './parse.js';
import { findProducts, card, unknownCard, norm, plain, IN_BROWSER_NOTICE, cardCsv } from './core.js';
import * as H from './handlers.js';

export const newSession = () => ({ facets: {}, product: null, products: [], system: null, calcs: {}, compare: null, last: null, pending: null, lastQuestion: '' });

const NEED_KEY = { area: 'area', length: 'length', volume: 'volume', thickness: 'thickness', notch: 'notch', coats: 'coats' };
const MEMORY_ACTIONS = new Set(['save', 'projects', 'gaps', 'recent', 'newproject', 'note', 'useproject', 'import', 'exportjson', 'clearmemory', 'start']);
const NO_LAST = new Set(['clarify', 'export', 'memory', 'help', 'handoff']);

function updateFacets(session, text, strippedText) {
  const n = parseNumbers(text); const f = parseFacets(strippedText);
  for (const [k, v] of Object.entries(n)) session.facets[k] = v;
  for (const [k, v] of Object.entries(f)) session.facets[k] = v;
  // a wet area is a place, not a floor or a wall; keep surface for the tree key only when stated
  if (f.io === 'wet' && !f.surface) delete session.facets.surface;
}

/** Lines saved to memory from the last result. */
function saveLast(ctx) {
  const { session, memory } = ctx; const last = session.last;
  if (!memory) return card('memory', 'memory', 'Save', { status: 'unknown', notes: ['Project memory is not available in this browser.'] });
  const c = card('memory', 'memory', 'Saved to my project', { estimate: false, notice: IN_BROWSER_NOTICE });
  if (!last) { c.title = 'Nothing to save yet'; c.notes.push('Ask for a quantity, a system or a pack first, then say save.'); return c; }
  let res;
  if (last.action === 'system' && session.system) res = memory.saveSystem({ title: session.system.title, slug: session.system.slug || '', env: session.system.env, tile: session.system.tile, substrate: session.system.substrate, steps: session.system.steps });
  else if (last.action === 'calc' && session.product && session.calcs[session.product.id]) { const q = session.calcs[session.product.id]; res = memory.saveQuantity({ productId: q.id, name: q.name, job: q.job, rows: q.rows }); }
  else {
    const docs = []; for (const r of [...(last.rows || []), ...((last.sections || []).flatMap((s) => s.rows))]) if (r.doc && r.source && r.source.url) docs.push({ title: r.value, url: r.source.url });
    if (docs.length) { docs.forEach((d) => memory.saveDocument(d)); res = { ok: true, project: memory.current() }; }
    else res = memory.addNote(`${last.title}${last.copyText ? ': ' + last.copyText : ''}`);
  }
  c.rows.push({ label: 'Project', value: res.project || memory.current(), meta: true, source: null });
  c.rows.push({ label: 'Saved', value: last.title, meta: true, source: null });
  if (res.duplicate) c.notes.push('It was already saved in this project.');
  if (!memory.persistent()) c.notes.push('This browser blocked local storage, so it is kept for this tab only.');
  c.buttons = [{ label: 'My projects', command: '/projects' }];
  return c;
}

function projectsCard(ctx) {
  const m = ctx.memory; const c = card('memory', 'memory', 'My projects', { estimate: false, notice: IN_BROWSER_NOTICE });
  if (!m) { c.notes.push('Project memory is not available in this browser.'); return c; }
  const list = m.list();
  if (!list.length) c.notes.push('No projects yet. Say "new project Smith bathroom", or save any result and I will start one for you.');
  for (const p of list) c.rows.push({ label: p.name + (p.name === m.current() ? ' (current)' : ''), value: `${p.counts.systems} systems, ${p.counts.quantities} quantities, ${p.counts.documents} documents, ${p.counts.notes} notes`, meta: true, source: null, command: `/use ${p.name}` });
  const cur = m.currentProject();
  c.sections = [];
  if (cur) {
    const sec = (title, rows) => rows.length && c.sections.push({ title, rows });
    sec('Saved systems', cur.systems.map((s) => ({ label: s.title, value: s.slug ? `Sheet: ${s.slug}` : 'No sheet link', meta: true, source: null })));
    sec('Saved quantities', cur.quantities.map((q) => ({ label: q.name, value: q.rows.map((r) => `${r.low === r.high ? r.low : r.low + ' to ' + r.high} ${r.unit}${r.packs ? ', ' + r.packs : ''}`).join('; '), derived: true, source: q.rows[0] && q.rows[0].url ? { url: q.rows[0].url, label: 'Published rate', sentence: q.rows[0].phrase } : null })));
    sec('Saved documents', cur.documents.map((d) => ({ label: d.title, value: d.url, source: { url: d.url, label: d.title, sentence: d.title }, doc: true })));
    sec('Notes', cur.notes.map((n) => ({ label: n.saved ? n.saved.slice(0, 10) : 'Note', value: n.text, meta: true, source: null })));
  }
  c.projectsView = true;
  c.buttons = [{ label: 'Download my projects (JSON)', command: '/exportjson' }, { label: 'Import a file', command: '/import' }, { label: 'My gaps', command: '/gaps' }, { label: 'Recent questions', command: '/recent' }];
  return c;
}
const gapsCard = (ctx) => {
  const m = ctx.memory; const c = card('memory', 'memory', 'My gaps: questions I could not answer', { estimate: false, notice: IN_BROWSER_NOTICE });
  const g = m ? m.gaps() : [];
  if (!g.length) c.notes.push('No gaps recorded yet. When I cannot answer from the published data, the question lands here so you can ask Technical Services.');
  g.forEach((x) => c.rows.push({ label: x.t ? x.t.slice(0, 10) : 'Gap', value: x.q + (x.count > 1 ? `  (asked ${x.count} times)` : ''), meta: true, source: null, command: x.q }));
  if (g.length) c.buttons = [{ label: 'Ask Technical Services about the latest', command: '/handoff' }, { label: 'Clear my gaps', command: '/clear gaps' }];
  return c;
};
const recentCard = (ctx) => {
  const c = card('memory', 'memory', 'Recent questions', { estimate: false, notice: IN_BROWSER_NOTICE });
  const r = ctx.memory ? ctx.memory.recent() : [];
  if (!r.length) c.notes.push('Nothing yet.');
  r.slice(0, 15).forEach((x) => c.rows.push({ label: x.t ? x.t.slice(0, 10) : '', value: x.q, meta: true, source: null, command: x.q }));
  return c;
};

async function memoryAction(ctx, action) {
  const m = ctx.memory; const rest = (ctx.rest || '').trim();
  if (!m && action !== 'start') return card('memory', 'memory', 'Project memory', { status: 'unknown', notes: ['Project memory is not available in this browser.'], notice: IN_BROWSER_NOTICE });
  switch (action) {
    case 'save': return saveLast(ctx);
    case 'projects': return projectsCard(ctx);
    case 'gaps': return gapsCard(ctx);
    case 'recent': return recentCard(ctx);
    case 'newproject': { const r = m.create(rest.replace(/^["']|["']$/g, '')); const c = card('memory', 'memory', r.ok ? `Project "${r.name}" is ready` : 'Could not start a project', { estimate: false, notice: IN_BROWSER_NOTICE }); if (!r.ok) c.notes.push(r.error); else c.notes.push('New saves go into this project.'); return c; }
    case 'useproject': { const r = m.use(rest); const c = card('memory', 'memory', r.ok ? `Now using "${r.name}"` : 'No such project', { estimate: false, notice: IN_BROWSER_NOTICE }); if (!r.ok) c.notes.push(r.error); return c; }
    case 'note': { const r = m.addNote(rest); const c = card('memory', 'memory', r.ok ? 'Note saved' : 'Could not save the note', { estimate: false, notice: IN_BROWSER_NOTICE }); if (!r.ok) c.notes.push(r.error); else c.rows.push({ label: 'Project', value: r.project, meta: true, source: null }); return c; }
    case 'exportjson': { const c = card('memory', 'memory', 'Download my projects', { estimate: false, notice: IN_BROWSER_NOTICE }); c.exports = [{ label: 'Download projects (JSON)', filename: 'sika-demo-projects.json', mime: 'application/json', text: m.exportJSON() }]; c.notes.push('This file stays on your computer. Import it later in this or another browser to carry on.'); return c; }
    case 'import': {
      const c = card('memory', 'memory', 'Import projects', { estimate: false, notice: IN_BROWSER_NOTICE });
      if (rest) { const r = m.importJSON(rest); c.title = r.ok ? 'Projects imported' : 'Could not import'; c.notes.push(r.ok ? 'Merged with what is already in this browser.' : r.error); } else { c.importBox = true; c.notes.push('Paste the contents of a projects file, or choose the file.'); }
      return c;
    }
    case 'clearmemory': { const what = rest.toLowerCase(); const c = card('memory', 'memory', 'Cleared', { estimate: false, notice: IN_BROWSER_NOTICE }); if (what === 'gaps') { m.clearGaps(); c.notes.push('Your gaps list is empty.'); } else if (what === 'all') { m.clearAll(); c.notes.push('All projects, recent questions and gaps in this browser are gone.'); } else { c.title = 'Clear what?'; c.notes.push('Say "/clear gaps" or "/clear all".'); } return c; }
    default: return H.help({ ...ctx, commands: COMMANDS });
  }
}

const HANDLERS = { calc: H.calc, system: H.system, pack: H.pack, compare: H.compare, compat: H.compat, safety: H.safety, time: H.time, spec: H.spec, export: H.exportAction, link: H.link, handoff: H.handoff };

/** The assistant. deps: { data, memory?, config?, now? }. run(text, session) -> { handled, card?, session }. handled=false means: hand the question to the product advisor. */
export function createActions(deps) {
  const { data, memory = null, config = null } = deps;
  async function run(text, session = newSession()) {
    text = String(text || '').trim();
    if (!text) return { handled: false, session };
    let r = route(text); let rest = r ? r.rest : text; let action = r ? r.action : null; let noAsk = false; let useText = text;
    const p = session.pending;
    if (p) {
      session.pending = null;
      if (!r || (!r.slash && r.action === p.action) || (r.slash && r.action === p.action)) {
        // the visitor is answering our question: put the original request and the answer together, once
        action = p.action; noAsk = true; useText = `${p.text} ${r && r.slash ? r.rest : text}`; rest = useText;
        const bare = /^\s*(\d+(?:[.,]\d+)?)\s*(?:m2|sqm|mm|m|%|litres?|l)?\s*$/i.exec(text);
        if (bare && NEED_KEY[p.need]) session.facets[NEED_KEY[p.need]] = parseFloat(bare[1].replace(',', '.'));
      } else if (r && r.action !== p.action) { /* a new request: drop the old question */ }
    }
    if (!action && (session.system || session.product) && text.split(/\s+/).length <= 8) { const n = parseNumbers(text); if (n.area || n.length || n.volume || n.notch || n.tileSize || n.thickness || n.coats || n.allowance != null || n.csp) { action = 'calc'; rest = text; } }
    if (!action) return { handled: false, session };
    if (r && r.unknownSlash) return { handled: true, card: H.help({ data, session, commands: COMMANDS }), session };
    // facets: numbers always, surfaces and places from the text with any product name taken out
    const hits = await findProducts(data, useText, 3);
    let stripped = norm(useText); for (const h of hits) stripped = stripped.replace(norm(h.name), ' ');
    if (!MEMORY_ACTIONS.has(action)) updateFacets(session, useText, stripped);
    if (!r || !r.slash) session.lastQuestion = text;
    const ctx = { data, session, memory, config, text: useText, rest, noAsk, now: deps.now ? deps.now() : new Date(), commands: COMMANDS };
    let c;
    try {
      if (MEMORY_ACTIONS.has(action)) c = await memoryAction(ctx, action);
      else if (action === 'help') c = H.help(ctx);
      else if (HANDLERS[action]) c = await HANDLERS[action](ctx);
      else return { handled: false, session };
    } catch (e) {
      c = unknownCard(action, 'That action hit a problem', `Something went wrong while I worked on that (${plain(e && e.message ? e.message : 'unknown error')}). Nothing was changed. Ask Technical Services if you need it urgently.`);
    }
    if (c.kind === 'clarify') session.pending = { action: c.action, text: p && noAsk ? p.text : useText, need: c.clarify.need };
    if (!NO_LAST.has(c.kind) && c.action !== 'memory') session.last = c;
    if (memory) {
      if (!MEMORY_ACTIONS.has(action) && c.kind !== 'clarify') memory.rememberQuestion(text, action);
      if (c.status === 'unknown' && c.handoff) memory.addGap(session.lastQuestion || text);
    }
    return { handled: true, card: c, session };
  }
  return { run, newSession };
}
