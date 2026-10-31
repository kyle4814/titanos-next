// "My projects": the products for a job with their quantities, kept in this browser only (localStorage), never sent anywhere.
// This is the portal's window on the ONE project store the advisor also uses (lib/projectstore.js): products the advisor adds appear here with
// where they came from, and edits made here are seen by the advisor on its next turn. The old keys are read once by the store and left alone.
import { createProjectStore, sharedStorage, onProjectChange, announceChange, KEY, DEFAULT_PROJECT } from './projectstore.js';
export { UNITS } from './projectstore.js';

export const projectStore = createProjectStore(sharedStorage(), null, { origin: 'portal' });
try { window.addEventListener('storage', (e) => { if (e.key === null || e.key === KEY) { projectStore.list(); announceChange('other'); } }); } catch { /* not in a page */ }

export const projects = {
  list: () => projectStore.items(),
  count: () => projectStore.itemCount(),
  has: (id) => projectStore.hasItem(id),
  add(id, fields) { if (!projects.has(id)) projectStore.addItem({ id, qty: 1, unit: 'pack', ...fields }); },
  remove(id) { projectStore.removeItem(id); },
  set(id, patch) { projectStore.setItem(id, patch); },
  clear() { projectStore.clearItems(); },
  toggle(id, name) { projects.has(id) ? projects.remove(id) : projects.add(id, name ? { name } : undefined); return projects.has(id); },
  onChange(fn) { return onProjectChange(fn); },
};
export { DEFAULT_PROJECT };
