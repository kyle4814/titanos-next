// Loads the finder data files once. Same-host files only, paths relative to this module so the portal works under any URL prefix.
const base = new URL('../../../data/finder/', import.meta.url);
const cache = new Map();
export function getJSON(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(new URL(name, base)).then((r) => { if (!r.ok) throw new Error(name + ': HTTP ' + r.status); return r.json(); }).catch((e) => { cache.delete(name); throw e; }));
  }
  return cache.get(name);
}
export const systems = () => getJSON('systems.json');
export const rateIndex = () => getJSON('r/index.json');
export const rateFor = (id) => getJSON('r/' + encodeURIComponent(id) + '.json');
