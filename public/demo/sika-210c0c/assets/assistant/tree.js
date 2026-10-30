// tree.js: problem-to-product decision tree derived from the categories and from facet mentions in the product text. No hand-authored product lists.

/** Build the tree nodes. ctx: {products, categories, FACETS, slotProducts(selection)->{adhesive:[ids]}, facetCount(dim,id)->n, productsIn(catId)->ids}. */
export function buildTree(ctx) {
  const { categories, FACETS, productsIn, facetCount, tileAdhesives } = ctx;
  const nodes = {};
  const byId = new Map(categories.map(c => [c.id, c]));
  const kids = (c) => (c.children || []).map(id => byId.get(id)).filter(c2 => c2 && productsIn(c2.id).length);
  const roots = categories.filter(c => !c.parent && productsIn(c.id).length);
  nodes.root = { id: 'root', question: 'What are you working on?', options: [] };
  for (const r of roots) for (const c of kids(r)) {
    nodes.root.options.push({ label: c.name, value: c.id, next: 'cat:' + c.id });
  }
  nodes.root.options.push({ label: 'Tiling (guided: tile, surface and location)', value: 'tile', next: 'tile:type' });
  const addCat = (c) => {
    const ch = kids(c);
    const node = { id: 'cat:' + c.id, question: `Which type of ${c.name.toLowerCase()} do you need?`, options: [] };
    if (!ch.length) { node.options.push({ label: `All ${c.name}`, value: c.id, productIds: productsIn(c.id) }); }
    for (const k of ch) {
      const sub = kids(k);
      if (sub.length) { node.options.push({ label: k.name, value: k.id, next: 'cat:' + k.id }); addCat(k); }
      else node.options.push({ label: k.name, value: k.id, productIds: productsIn(k.id) });
    }
    const direct = productsIn(c.id).filter(id => !ch.some(k => productsIn(k.id).includes(id)));
    if (direct.length && ch.length) node.options.push({ label: `Other ${c.name}`, value: c.id + '#other', productIds: direct });
    nodes[node.id] = node;
  };
  for (const r of roots) for (const c of kids(r)) addCat(c);
  // tile path
  const tt = FACETS.tileType.filter(f => facetCount('tileType', f.id) > 0 && f.id !== 'unglazed' || f.id === 'unglazed' && facetCount('tileType', f.id) > 0);
  const sub = FACETS.substrate.filter(f => facetCount('substrate', f.id) > 0 && f.id !== 'membrane' && f.id !== 'glass' && f.id !== 'steel');
  const loc = FACETS.location.filter(f => ['wet-area', 'external', 'internal', 'floor', 'wall', 'pool'].includes(f.id));
  nodes['tile:type'] = { id: 'tile:type', question: 'What type of tile?', options: tt.map(t => ({ label: t.label, value: 'tileType=' + t.id, next: 'tile:substrate:' + t.id })) };
  for (const t of tt) {
    nodes['tile:substrate:' + t.id] = { id: 'tile:substrate:' + t.id, question: 'What are you tiling onto?', options: sub.map(s => ({ label: s.label, value: 'substrate=' + s.id, next: `tile:location:${t.id}:${s.id}` })) };
    for (const s of sub) {
      nodes[`tile:location:${t.id}:${s.id}`] = { id: `tile:location:${t.id}:${s.id}`, question: 'Where is it going?', options: loc.map(l => ({ label: l.label, value: 'location=' + l.id, productIds: tileAdhesives({ tileType: [t.id], substrate: [s.id], location: [l.id] }) })) };
    }
  }
  return { root: 'root', nodes };
}
