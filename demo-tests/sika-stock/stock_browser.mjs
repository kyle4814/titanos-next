// stock_browser.mjs: category cards, category page and no-packshot product pages draw the stock photo with caption and credit; offline shows the SVG fallback.
// usage (Windows node): node.exe stock_browser.mjs <portalDir> <outDir>
import fs from 'node:fs';
import { serve, launch } from '../sika-210c0c/_browser.mjs';
import { PORTAL } from '../sika-210c0c/_env.mjs';
const [, , t0, outDir = './stock_out'] = process.argv; fs.mkdirSync(outDir, { recursive: true });
const root = t0 || PORTAL; const s = await serve(root); const b = await launch(); let fails = 0;
const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).slice(0, 240) : '')); };
const rd = (f) => JSON.parse(fs.readFileSync(root + '/data/' + f, 'utf8').replace(/^﻿/, ''));
const prods = rd('products.json'); const cats = rd('categories.json');
const ill = prods.find((p) => p.image && p.image.illustrative); const pack = prods.find((p) => p.image && !p.image.illustrative);
const l12 = cats.filter((c) => c.level <= 2).length;
const cat = cats.find((c) => c.id === ill.category); const l2 = cats.find((c) => c.level === 2 && c.children && c.children.length > 1 && c.image);
for (const [W, H] of [[1366, 768], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600 }); const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); }); page.on('pageerror', (e) => errs.push(e.message));
  const sz = `${W}x${H}`;
  // category page: hero photo with credit, category cards with photos
  await page.goto(s.base + '#/category/' + l2.id, { waitUntil: 'load' }); await page.waitForSelector('.cat-card img.packshot'); await page.evaluate(async () => { for (const c of document.querySelectorAll('.cat-card')) { c.scrollIntoView({ block: 'center' }); await new Promise((r) => setTimeout(r, 250)); } window.scrollTo(0, 0); }); await page.waitForTimeout(600); // lazy images: bring every card into view first
  const cp = await page.evaluate(() => { const cards = [...document.querySelectorAll('.cat-card')]; const imgs = cards.map((c) => c.querySelector('img.packshot')).filter(Boolean); const hero = document.querySelector('.cat-hero img'); const cl = document.querySelector('.cat-hero .credit-line');
    return { cards: cards.length, imgs: imgs.length, noAlt: imgs.filter((i) => !i.alt).length, noSize: imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length, decoded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length, ph: cards.filter((c) => c.querySelector('.ph')).length,
      hero: !!hero && hero.complete && hero.naturalWidth > 0 && !!hero.alt, credit: cl ? cl.innerText : '', creditVisible: !!cl && cl.getBoundingClientRect().height > 0 && getComputedStyle(cl).visibility !== 'hidden', ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  t(`${sz} category cards show photos with alt, width, height, decoded, no placeholder`, cp.cards > 0 && cp.imgs === cp.cards && cp.noAlt === 0 && cp.noSize === 0 && cp.decoded === cp.imgs && cp.ph === 0, JSON.stringify(cp));
  t(`${sz} category page shows the hero photo and a one-line credit (author, licence)`, cp.hero && cp.creditVisible && /Photo:/.test(cp.credit) && cp.credit.includes(l2.image.credit.license), cp.credit);
  await page.screenshot({ path: `${outDir}/cat_${sz}.png` });
  t(`${sz} category page: no horizontal scroll`, cp.ov <= 1, cp.ov);
  // a category page with illustrative product cards
  await page.goto(s.base + '#/category/' + ill.category, { waitUntil: 'load' }); await page.waitForSelector('.product-card'); await page.waitForTimeout(700);
  const pc = await page.evaluate((id) => { const cards = [...document.querySelectorAll('.product-card')]; const tagged = cards.filter((c) => c.querySelector('.stock-tag')); return { cards: cards.length, tagged: tagged.length, ok: tagged.every((c) => { const i = c.querySelector('img.packshot--stock'); return i && i.alt && i.getAttribute('width') && i.getAttribute('height') && i.naturalWidth > 0 && /Illustrative photo, not the product/.test(c.querySelector('.stock-tag').innerText); }) }; }, ill.id);
  t(`${sz} illustrative product cards carry the caption, alt, size and a decoded photo`, pc.tagged > 0 && pc.ok, JSON.stringify(pc));
  // product page without a packshot
  await page.goto(s.base + '#/product/' + ill.id, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy]) .pdp-media img.packshot'); await page.waitForTimeout(500);
  const pp = await page.evaluate(() => { const i = document.querySelector('.pdp-media img.packshot'); const tag = document.querySelector('.pdp-media .stock-tag'); const cl = document.querySelector('.pdp .credit-line'); return { alt: i.alt, w: i.getAttribute('width'), h: i.getAttribute('height'), ok: i.complete && i.naturalWidth > 0, tag: tag ? tag.innerText : '', credit: cl ? cl.innerText : '', creditVisible: !!cl && cl.getBoundingClientRect().height > 0, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  t(`${sz} no-packshot product page: img with alt, width, height, decoded`, /^Illustrative photo of .+, not the product$/.test(pp.alt) && pp.w && pp.h && pp.ok, JSON.stringify(pp));
  t(`${sz} product page: caption "Illustrative photo, not the product" and a visible credit line with author and licence`, pp.tag === 'Illustrative photo, not the product' && pp.creditVisible && pp.credit.includes(ill.image.credit.license) && pp.credit.includes(ill.image.credit.author.slice(0, 20)), pp.credit);
  await page.screenshot({ path: `${outDir}/pdp_${sz}.png` });
  t(`${sz} product page: no horizontal scroll`, pp.ov <= 1, pp.ov);
  // a packshot product keeps its packshot and has no stock caption
  await page.goto(s.base + '#/product/' + pack.id, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy]) .pdp-media img.packshot'); await page.waitForTimeout(300);
  const ps = await page.evaluate(() => ({ stock: !!document.querySelector('.pdp-media .stock-tag'), credit: !!document.querySelector('.pdp .credit-line'), shot: !!document.querySelector('.pdp-media--shot') }));
  t(`${sz} a packshot product has no stock caption or credit`, !ps.stock && !ps.credit && ps.shot, JSON.stringify(ps));
  // home: the photo mosaic below the hero (lazy tiles, alt, size, label, credit, stacked on the phone), shots saved for the receipt
  await page.goto(s.base + '#/', { waitUntil: 'load' }); await page.waitForSelector('.mosaic .mosaic-tile'); await page.waitForFunction(() => [...document.querySelectorAll('.mosaic-credit')].every((e) => e.textContent.startsWith('Photo:')), null, { timeout: 15000 }).catch(() => {});
  const mo = await page.evaluate(() => { const m = document.querySelector('.mosaic'); const tiles = [...m.querySelectorAll('.mosaic-tile')]; const hero = document.querySelector('.hero').getBoundingClientRect();
    const imgs = tiles.map((a) => a.querySelector('img'));
    return { tiles: tiles.length, noImg: imgs.filter((i) => !i).length, noAlt: imgs.filter((i) => i && !i.alt).length, noSize: imgs.filter((i) => i && (!i.getAttribute('width') || !i.getAttribute('height'))).length, notLazy: imgs.filter((i) => i && i.getAttribute('loading') !== 'lazy').length,
      noLabel: tiles.filter((a) => !/Illustrative photo/.test(a.querySelector('.mosaic-tag').textContent)).length, noCredit: tiles.filter((a) => !/^Photo: .+, .+/.test(a.querySelector('.mosaic-credit').textContent) || !a.title.includes(a.querySelector('.mosaic-credit').textContent)).length,
      belowHero: m.getBoundingClientRect().top >= hero.bottom - 1, cols: new Set(tiles.map((a) => Math.round(a.getBoundingClientRect().left))).size, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  t(`${sz} home mosaic: a tile for every root and level 2 category, each with img, alt, width, height, loading=lazy, label and credit`, mo.tiles === l12 && mo.noImg + mo.noAlt + mo.noSize + mo.notLazy + mo.noLabel + mo.noCredit === 0, JSON.stringify(mo));
  t(`${sz} home mosaic: below the hero, no horizontal scroll, ${W < 600 ? 'stacked in one column' : 'several columns'}`, mo.belowHero && mo.ov <= 1 && (W < 600 ? mo.cols === 1 : mo.cols >= 3), JSON.stringify(mo));
  await page.evaluate(() => document.querySelector('.mosaic').scrollIntoView({ block: 'start' })); await page.waitForTimeout(1500);
  const dec = await page.evaluate(() => { const r = innerHeight; const vis = [...document.querySelectorAll('.mosaic img')].filter((i) => i.getBoundingClientRect().top < r); return { vis: vis.length, decoded: vis.filter((i) => i.complete && i.naturalWidth > 0).length }; });
  t(`${sz} home mosaic: the tiles in view have loaded and decoded`, dec.vis > 0 && dec.decoded === dec.vis, JSON.stringify(dec));
  await page.screenshot({ path: `${outDir}/mosaic_${W}.png` });
  // credits page reachable from About
  await page.goto(s.base + '#/about', { waitUntil: 'load' }); await page.waitForSelector('a[href="#/credits"]'); await page.click('a[href="#/credits"]'); await page.waitForSelector('.credits-list li');
  const cr = await page.evaluate(() => ({ n: document.querySelectorAll('.credits-list li').length, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  t(`${sz} About links to the photo credits page, one line per photograph`, cr.n > 20 && cr.ov <= 1, JSON.stringify(cr));
  const onlineErrs = errs.slice(); // console errors while online; going offline below makes the browser log its own failed service worker update
  // offline: the SVG fallback, no stock images requested
  await page.goto(s.base + '#/product/' + ill.id, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy]) .pdp-media img.packshot');
  await page.goto(s.base + '#/category/' + ill.category, { waitUntil: 'load' }); await page.waitForSelector('.product-card');
  await ctx.setOffline(true); await page.evaluate(() => { window.dispatchEvent(new Event('offline')); });
  await page.goto(s.base + '#/product/' + ill.id); await page.waitForTimeout(800);
  const off = await page.evaluate(() => ({ ph: document.querySelectorAll('.pdp-media .ph').length, img: document.querySelectorAll('.pdp-media img').length, tag: document.querySelectorAll('.stock-tag').length, online: navigator.onLine }));
  t(`${sz} offline: product page shows the SVG placeholder, no photo, no stale caption`, off.ph === 1 && off.img === 0 && off.tag === 0 && off.online === false, JSON.stringify(off));
  await ctx.setOffline(false);
  t(`${sz} no console errors while online`, onlineErrs.filter((e) => !/Failed to load resource|net::ERR/i.test(e)).length === 0, onlineErrs.join(' | '));
  await ctx.close();
}
await b.close(); s.close(); console.log(fails ? `STOCK BROWSER ${fails} failed` : 'STOCK BROWSER GREEN'); process.exit(fails ? 1 : 0);
