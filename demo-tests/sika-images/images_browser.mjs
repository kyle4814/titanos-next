// images_browser.mjs: product cards and the product page draw the picture. usage (Windows node): node.exe images_browser.mjs <portalDir> <outDir>
import fs from 'node:fs';
import { serve, launch } from '../sika-210c0c/_browser.mjs';
import { PORTAL } from '../sika-210c0c/_env.mjs';
const [, , t0, outDir = './images_out'] = process.argv; fs.mkdirSync(outDir, { recursive: true });
const root = t0 || PORTAL; const s = await serve(root); const b = await launch(); let fails = 0;
const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).slice(0, 220) : '')); };
const prods = JSON.parse(fs.readFileSync(root + '/data/products.json', 'utf8').replace(/^\uFEFF/, ''));
const withImg = prods.find((p) => p.image); const without = prods.find((p) => !p.image);
for (const [W, H] of [[1366, 768], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600 }); const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); }); page.on('pageerror', (e) => errs.push(e.message));
  const sz = `${W}x${H}`;
  await page.goto(s.base + '#/product/' + withImg.id, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy]) .pdp-media img.packshot'); await page.waitForTimeout(400);
  const pi = await page.evaluate(() => { const i = document.querySelector('.pdp-media img.packshot'); return { alt: i.alt, w: i.getAttribute('width'), h: i.getAttribute('height'), ok: i.complete && i.naturalWidth > 0, nat: i.naturalWidth, box: i.getBoundingClientRect().width }; });
  t(`${sz} product page shows the picture (alt, width, height, decoded)`, pi.alt === withImg.name && pi.w && pi.h && pi.ok, JSON.stringify(pi));
  await page.screenshot({ path: `${outDir}/pdp_${sz}.png` });
  // a card: the related products on the page, plus a category page
  await page.goto(s.base + '#/category/' + withImg.categoryPath.join('/'), { waitUntil: 'load' }); await page.waitForSelector('.product-card img.packshot'); await page.waitForTimeout(500);
  const ci = await page.evaluate(() => { const c = [...document.querySelectorAll('.product-card')]; const imgs = c.map((x) => x.querySelector('img.packshot')).filter(Boolean); return { cards: c.length, imgs: imgs.length, noAlt: imgs.filter((i) => !i.alt).length, noSize: imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length, lazy: imgs.every((i) => i.loading === 'lazy'), boxes: new Set(c.map((x) => { const r = x.querySelector('.card-media').getBoundingClientRect(); return innerWidth < 640 ? Math.round(r.width) : Math.round(r.height); })).size }; });
  t(`${sz} cards: pictures have alt, width/height and lazy loading`, ci.imgs > 0 && ci.noAlt === 0 && ci.noSize === 0 && ci.lazy, JSON.stringify(ci));
  t(`${sz} cards: every picture box is a fixed size (height on grids, width on phone rows), so no layout shift`, ci.boxes === 1, JSON.stringify(ci));
  if (without) { await page.goto(s.base + '#/product/' + without.id, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy]) .pdp-media'); const ph = await page.locator('.pdp-media .ph').count(); t(`${sz} a product without a picture keeps the placeholder`, ph === 1); }
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); t(`${sz} no horizontal scroll`, ov <= 1, ov);
  t(`${sz} no console errors`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await b.close(); s.close(); console.log(fails ? `IMAGES BROWSER ${fails} failed` : 'IMAGES BROWSER GREEN'); process.exit(fails ? 1 : 0);
