// loader.js: lazy shard loader. fetchJson(url) must resolve to the parsed JSON or null (never throw on a 404).
// A missing shard returns null and the caller falls back (the UI falls back to the v1 advisor).
export function createLoader({ base = 'data/brain/', fetchJson, seed = {} }) {
  const cache = new Map(Object.entries(seed)); // seed: rel path -> promise already in flight (started before the modules finished loading)
  const get = (rel) => { let p = cache.get(rel); if (!p) { p = Promise.resolve().then(() => fetchJson(base + rel)).catch(() => null); cache.set(rel, p); } return p; };
  return {
    manifest: () => get('manifest.json'), kb: () => get('kb.json'), advisor: (cid) => get('adv/' + String(cid).replace(/\//g, '__') + '.json'), core: () => get('core.json'), tree: () => get('tree.json'), rules: () => get('rules.json'),
    numIndex: () => get('num/index.json'), num: (id) => get('num/' + encodeURIComponent(id) + '.json'),
    product: (id) => get('p/' + encodeURIComponent(id) + '.json'),
    category: (cid) => get('cat/' + String(cid).replace(/\//g, '__') + '.json'),
    spec: (id) => fetchJson('data/specs/' + encodeURIComponent(id) + '.json'),
    ruleShard: (name) => get('rules/' + name + '.json'), // lane D: rule shards (sys, tile, idx, o0..o5), fetched when a plan or rule question is asked, never preloaded
    loaded: () => [...cache.keys()],
  };
}
