// persist.js: the conversation context survives a page reload. The session state is plain JSON, kept in sessionStorage (this tab only, gone when it closes).
// Every call is wrapped: private mode or a blocked store just means no memory, never an error.
export const STATE_KEY = 'sika-brain-state-v1';
export function loadBrainState(store) { try { const raw = (store || globalThis.sessionStorage).getItem(STATE_KEY); const v = raw ? JSON.parse(raw) : null; return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; } }
export function saveBrainState(st, store) { try { const s = store || globalThis.sessionStorage; if (st) s.setItem(STATE_KEY, JSON.stringify(st)); else s.removeItem(STATE_KEY); } catch { /* no storage: the conversation just starts fresh after a reload */ } }
