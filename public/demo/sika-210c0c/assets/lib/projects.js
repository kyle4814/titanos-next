// "My projects": a list of products with quantities, kept in this browser only (localStorage), never sent anywhere.
import { store } from './util.js';
const KEY = 'sika-demo-210c0c-projects';
let items = store.get(KEY, []);
if (!Array.isArray(items)) items = [];
const subs = new Set();
const save = () => { store.set(KEY, items); subs.forEach((f) => f()); };
export const projects = {
  list: () => items.slice(),
  count: () => items.length,
  has: (id) => items.some((i) => i.id === id),
  add(id) { if (!projects.has(id)) { items.push({ id, qty: 1, unit: 'pack', note: '' }); save(); } },
  remove(id) { items = items.filter((i) => i.id !== id); save(); },
  set(id, patch) { const it = items.find((i) => i.id === id); if (it) { Object.assign(it, patch); save(); } },
  clear() { items = []; save(); },
  toggle(id) { projects.has(id) ? projects.remove(id) : projects.add(id); return projects.has(id); },
  onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
};
