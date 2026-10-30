// insights-core.js (T11): the pure part of "Insights and gap list". No DOM, no network. Everything is kept in THIS browser only
// (localStorage wrapped in try/catch). Day-level dates, no identifiers, emails and phone numbers are removed before anything is stored.
export const PREFIX = 'sika-demo-210c0c-';
export const KEY = PREFIX + 'insights';
export const OUTCOMES = ['ANSWERED_WITH_SOURCE', 'NOT_IN_PUBLISHED_DATA', 'OUT_OF_SCOPE', 'CLARIFY'];
const CAP = 300;

const EMAIL = /[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+/g;
const PHONE = /(?:\+?\d[\d\s().-]{6,}\d)/g;
/** Remove anything that looks like an email address or a phone number, and cap the length. */
export function redact(text) {
  return String(text == null ? '' : text).replace(EMAIL, '[removed]').replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 7 ? '[removed]' : m)).replace(/\s+/g, ' ').trim().slice(0, 200);
}

/** Outcome of one advisor answer (the object engine.ask returns). Greetings are not questions: null. */
export function outcomeOf(a) {
  if (!a || a.intent === 'greeting') return null;
  if (a.intent === 'out_of_scope') return 'OUT_OF_SCOPE';
  if (a.intent === 'clarify' || a.intent === 'help') return 'CLARIFY';
  const blocks = a.blocks || [];
  const handoff = blocks.some((b) => b.type === 'handoff');
  const noPassages = a.intent === 'problem' && !blocks.some((b) => b.type === 'facts');
  if (handoff && (a.intent !== 'problem' || noPassages)) return 'NOT_IN_PUBLISHED_DATA';
  if (a.intent === 'where_to_buy' || a.intent === 'contact') return 'NOT_IN_PUBLISHED_DATA';
  return a.citations && a.citations.length ? 'ANSWERED_WITH_SOURCE' : 'NOT_IN_PUBLISHED_DATA';
}

const day = () => new Date().toISOString().slice(0, 10);
const empty = () => ({ v: 1, q: [], combos: {}, views: {} });

/** storage = { get(key, def), set(key, val) -> boolean }. Any failure degrades to "nothing stored", never to an error. */
export function createInsights(storage) {
  let st = null; const subs = new Set();
  const load = () => { if (!st) { let v = null; try { v = storage.get(KEY, null); } catch { v = null; } st = v && v.v === 1 && Array.isArray(v.q) ? v : empty(); st.combos = st.combos || {}; st.views = st.views || {}; } return st; };
  const save = () => { try { storage.set(KEY, st); } catch { /* storage full or blocked: the view just stays empty */ } subs.forEach((f) => { try { f(); } catch { /* a view error never breaks recording */ } }); };
  return {
    question(text, outcome) { if (!OUTCOMES.includes(outcome)) return false; const t = redact(text); if (!t) return false; const s = load(); s.q.push({ d: day(), t, o: outcome }); if (s.q.length > CAP) s.q.splice(0, s.q.length - CAP); save(); return true; },
    combo(label) { const t = redact(label); if (!t) return false; const s = load(); s.combos[t] = (s.combos[t] || 0) + 1; save(); return true; },
    view(id) { const k = String(id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 80); if (!k) return false; const s = load(); s.views[k] = (s.views[k] || 0) + 1; save(); return true; },
    data() { return load(); },
    counts() { const c = Object.fromEntries(OUTCOMES.map((o) => [o, 0])); for (const r of load().q) c[r.o] = (c[r.o] || 0) + 1; return c; },
    gaps() { return load().q.filter((r) => r.o === 'NOT_IN_PUBLISHED_DATA' || r.o === 'OUT_OF_SCOPE'); },
    topCombos(n = 5) { return Object.entries(load().combos).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n); },
    topViews(n = 5) { return Object.entries(load().views).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n); },
    clear() { st = empty(); save(); },
    onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

/** CSV of the gap list. A cell that starts with = + - or @ is prefixed so a spreadsheet never runs it as a formula. */
export function gapCsv(rows) {
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  return ['date,question,outcome'].concat(rows.map((r) => [r.d, r.t, r.o].map(cell).join(','))).join('\r\n') + '\r\n';
}
