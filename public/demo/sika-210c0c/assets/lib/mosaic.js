// The home page photo mosaic ("Explore the range"): which categories get a tile and exactly what each tile says. Pure data, no DOM, so a test can check it.
// Every tile is an illustrative Creative Commons photo of a category (never a product picture); the credit is the author and licence saved from Wikimedia Commons.
const nf = new Intl.NumberFormat('en-AU');
const SLUG = (c) => (c && (c.im || (c.image && (/img\/s\/(.+)-480\.webp$/.exec(c.image.src) || [])[1]))) || null;

/** The root and level 2 categories in tree order (a root, then its children), each with a photo. */
export function mosaicCats(categories) {
  const byId = new Map(categories.map((c) => [c.id, c])); const out = [];
  for (const r of categories.filter((c) => c.level === 1)) { out.push(r); for (const id of r.children || []) { const k = byId.get(id); if (k && k.level === 2) out.push(k); } }
  return out.filter((c) => SLUG(c));
}

export const creditText = (cr) => (cr && cr.author && cr.license ? `Photo: ${cr.author}, ${cr.license}, Wikimedia Commons` : '');

/** What one tile shows. `cr` is the credit record from the full categories file; the first paint has none and the tile says where it will be. */
export function mosaicSpec(c, cr) {
  const slug = SLUG(c); const credit = creditText(cr);
  return {
    id: c.id, href: '#/category/' + c.id, name: c.name, root: c.level === 1,
    count: `${nf.format(c.productCount)} product${c.productCount === 1 ? '' : 's'}`,
    img: { src: `assets/img/s/${slug}-480.webp`, src2x: `assets/img/s/${slug}-960.webp`, width: 480, height: 320, alt: `Illustrative photo for ${c.name}`, loading: 'lazy' },
    tag: 'Illustrative photo', credit,
    title: `${c.name}. Illustrative photo, not a product. ` + (credit || 'Photo credit: shown on the category page.'),
  };
}
