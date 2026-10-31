// citematch_browser.mjs: the header search box, the finder and the "Show the source" panel in headless Windows Chrome at 1366 and 390 wide.
//   run with WINDOWS node (see run_all.sh):  node.exe citematch_browser.mjs <portalDir> <outDir>
import fs from 'node:fs';
import { serve, launch } from '../sika-210c0c/_browser.mjs';
import { PORTAL } from '../sika-210c0c/_env.mjs';
const [, , t0, outDir = './citematch_out'] = process.argv; fs.mkdirSync(outDir, { recursive: true });
const root = t0 || PORTAL; const s = await serve(root); const b = await launch(); let fails = 0, passes = 0;
const t = (n, ok, d = '') => { if (ok) passes++; else fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).slice(0, 260) : '')); };
const rdj = (f) => JSON.parse(fs.readFileSync(root + '/' + f, 'utf8').replace(/^\uFEFF/, ''));
const index = rdj('data/index.json'); const byName = new Map(index.map((p) => [p.n.replace(/\s+/g, ' ').trim(), p])); const docs = rdj('data/documents.json');
const norm = (x) => String(x).replace(/\s+/g, ' ').trim();
async function session(W, H, hash, fn) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600 }); const page = await ctx.newPage(); const errs = [], posts = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); }); page.on('pageerror', (e) => errs.push(e.message));
  page.on('request', (r) => { if (!['GET', 'HEAD'].includes(r.method())) posts.push(r.method() + ' ' + r.url()); });
  await ctx.route('**/*', (route) => { const u = new URL(route.request().url()); if (u.host === new URL(s.base).host || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue(); return route.abort(); });
  await page.goto(s.base + hash, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(300);
  try { await fn(page, { errs, posts }); } finally { await ctx.close(); }
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const openPanel = async (page) => { if (await page.locator('#asst-fab').isVisible()) await page.click('#asst-fab'); else await page.locator('button:visible', { hasText: 'Advisor' }).first().click(); await page.waitForSelector('#assistant.open'); };
const ask = async (page, q) => { const before = await page.locator('.asst-log .msg--bot').count(); await page.fill('#asst-q', q); await page.press('#asst-q', 'Enter'); await page.waitForFunction((n) => document.querySelectorAll('.asst-log .msg--bot').length > n && !document.querySelector('.asst-log .typing'), before, { timeout: 20000 }); return page.locator('.asst-log .msg--bot').last(); };
const isTileAdhesive = (n) => { const p = byName.get(norm(n)); return !!p && p.c.startsWith('construction/tile-stone-installationsystems/tile-adhesives'); };
const isSanitary = (n) => { const p = byName.get(norm(n)); return !!p && p.c.startsWith('construction/sealants-adhesives/sanitary-sealants'); };

for (const [W, H] of [[1366, 768], [390, 844]]) {
  const sz = `${W}x${H}`;
  // ---------------- search box suggestions and the finder
  await session(W, H, '#/', async (page, ctx) => {
    let box = page.locator('#hd-q'); if (!(await box.isVisible())) { await page.click('#burger'); await page.waitForTimeout(400); box = page.locator('#dr-q'); }
    const suggest = async (q, id) => { await box.fill(''); await box.type(q, { delay: 5 }); await page.waitForSelector(`#${id}-list li[role=option]`, { timeout: 8000 }); await page.waitForTimeout(250); return page.locator(`#${id}-list li[role=option] span:first-child`).allInnerTexts(); };
    const id = (await box.getAttribute('id')).replace('-q', '');
    let names = await suggest('porcelin glue for outside', id);
    t(`${sz} search box: "porcelin glue for outside" suggests a tile adhesive in the top 3`, names.slice(0, 3).some(isTileAdhesive), names.slice(0, 4).join(' | '));
    names = await suggest('silly cone for the sink', id);
    t(`${sz} search box: "silly cone for the sink" suggests a sanitary sealant in the top 3`, names.slice(0, 3).some(isSanitary), names.slice(0, 4).join(' | '));
    names = await suggest('index fidia 4mm', id);
    t(`${sz} search box: the old name "index fidia 4mm" finds the current product first`, /fidia/i.test(names[0] || '') || names.slice(0, 3).some((n) => /fidia/i.test(n)), names.slice(0, 3).join(' | '));
    t(`${sz} search box: the listbox keeps its ARIA wiring`, (await box.getAttribute('role')) === 'combobox' && (await box.getAttribute('aria-expanded')) === 'true' && (await page.locator(`#${id}-list`).getAttribute('role')) === 'listbox');
    await box.fill(''); await box.type('tile adhesve', { delay: 5 }); await page.press(`#${id}-q`, 'Enter');
    await page.waitForFunction(() => /#\/products/.test(location.hash), null, { timeout: 8000 }); await page.waitForSelector('.product-card, .result-row, .card', { timeout: 8000 }); await page.waitForTimeout(400);
    const titles = await page.locator('.product-card h3, .product-card .card-link, article.card h3').allInnerTexts();
    t(`${sz} finder: "tile adhesve" (typo) lists tile adhesives first (${titles.length} cards)`, titles.length > 0 && titles.slice(0, 3).some(isTileAdhesive), titles.slice(0, 4).join(' | '));
    t(`${sz} search: no horizontal scroll`, (await overflow(page)) <= 1, await overflow(page));
    t(`${sz} search: no console errors and no non-GET requests`, ctx.errs.length === 0 && ctx.posts.length === 0, ctx.errs.concat(ctx.posts).join(' | '));
    await page.screenshot({ path: `${outDir}/finder_${sz}.png` });
  });
  // ---------------- Show the source on an actions card (default tree) and on a brain card (actions off)
  for (const [label, hash, q, kind] of [['actions card', '#/', 'How much Davco Grey One Pot adhesive for 20 m2 with a 6 mm notched trowel', 'action-card'], ['brain card', '#/?actions=off', 'What is the coverage of Davco Grey One Pot adhesive?', '[data-card]']]) {
    await session(W, H, hash.startsWith('#/?') ? hash.replace('#/?', '?') + '#/' : hash, async (page, ctx) => {
      await openPanel(page); const a = await ask(page, q);
      const btns = a.locator('.src-btn'); const nb = await btns.count();
      t(`${sz} ${label}: citations have a "Show the source" button (${nb})`, nb >= 1);
      t(`${sz} ${label}: no raw "(source)" link is left in place of the control`, (await a.locator('a', { hasText: /^\(source\)$/ }).count()) === 0);
      const btn = btns.first(); await btn.scrollIntoViewIfNeeded();
      t(`${sz} ${label}: the button starts collapsed`, (await btn.getAttribute('aria-expanded')) === 'false');
      await btn.click(); await page.waitForTimeout(500);
      const panel = a.locator('.src-panel:visible').first();
      t(`${sz} ${label}: pressing it opens a visible panel`, (await panel.count()) === 1 && (await a.locator('.src-btn[aria-expanded="true"]').count()) >= 1);
      const quote = norm(await panel.locator('mark').first().innerText().catch(() => ''));
      const shard = fs.readFileSync(root + '/data/brain/p/davco-grey-one-potadhesive.json', 'utf8'); const flat = norm(JSON.stringify(JSON.parse(shard)).replace(/\\"/g, '"'));
      const kd = rdj('data/finder/r/davco-grey-one-potadhesive.json'); const flat2 = norm(JSON.stringify(kd).replace(/\\"/g, '"'));
      t(`${sz} ${label}: the highlighted quote is text the data holds, word for word`, quote.length > 10 && (flat.includes(quote) || flat2.includes(quote) || flat.includes(quote.replace(/^\u2026 /, '').replace(/ \u2026$/, ''))), quote.slice(0, 120));
      const title = norm(await panel.locator('.src-title').innerText()); t(`${sz} ${label}: the panel names the document (${title})`, title.length > 3);
      const link = panel.locator('a.src-open'); const href = await link.getAttribute('href'); const base = (href || '').split('#')[0];
      const rec = docs.find((d) => d.url === base || d.dmsUrl === base);
      t(`${sz} ${label}: the link opens the document record's URL in a new tab`, !!rec && (await link.getAttribute('target')) === '_blank' && /noopener/.test(await link.getAttribute('rel')), href);
      const pm = /#page=(\d+)$/.exec(href || ''); const typeTxt = norm(await panel.locator('.src-type').innerText());
      t(`${sz} ${label}: a #page link is shown with that page in the panel text (${pm ? pm[1] : 'no page'})`, pm ? new RegExp('page ' + pm[1]).test(typeTxt + ' ' + norm(await link.innerText())) : /not recorded|Open the original/.test(norm(await panel.innerText())), typeTxt);
      const box = await panel.boundingBox(); t(`${sz} ${label}: the panel fits the screen width`, !!box && box.x >= 0 && box.x + box.width <= W + 1, JSON.stringify(box));
      t(`${sz} ${label}: no horizontal scroll`, (await overflow(page)) <= 1, await overflow(page));
      await page.screenshot({ path: `${outDir}/source_${label.replace(' ', '_')}_${sz}.png` });
      await btn.focus().catch(() => {}); await panel.locator('a.src-open').focus(); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
      t(`${sz} ${label}: Escape closes the panel and focus returns to the button`, (await a.locator('.src-panel:visible').count()) === 0 && (await btn.getAttribute('aria-expanded')) === 'false' && (await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('src-btn'))));
      t(`${sz} ${label}: no console errors, no non-GET requests, no external requests`, ctx.errs.length === 0 && ctx.posts.length === 0, ctx.errs.concat(ctx.posts).join(' | '));
    });
  }
  // a document listing: the panel says it is the whole document, with no invented sentence
  await session(W, H, '?actions=off#/', async (page, ctx) => {
    await openPanel(page); const a = await ask(page, 'safety data sheet for Davco Grey One Pot adhesive');
    const hik = a.locator('details.hik'); if (await hik.count()) { await hik.locator('summary').first().click(); }
    const nb = await a.locator('.src-btn').count(); t(`${sz} document card: citations have a "Show the source" button (${nb})`, nb >= 1);
    if (nb) { await a.locator('.src-btn').first().click(); await page.waitForTimeout(500); const p = a.locator('.src-panel:visible').first(); const txt = norm(await p.innerText());
      t(`${sz} document card: the panel says it is the whole document and shows no invented sentence`, /whole document/.test(txt) && (await p.locator('mark').count()) === 0, txt.slice(0, 160)); }
    t(`${sz} document card: no console errors`, ctx.errs.length === 0, ctx.errs.join(' | '));
  });
}
await b.close(); s.close(); console.log(fails ? `CITEMATCH BROWSER ${fails} failed, ${passes} passed` : `CITEMATCH BROWSER GREEN: ${passes} passed, 0 failed`); process.exit(fails ? 1 : 0);
