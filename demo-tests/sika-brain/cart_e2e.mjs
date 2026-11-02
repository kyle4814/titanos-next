// cart_e2e.mjs: a product-less quantity ask in the chat panel, chips to the exact grout answer, "Add 3 x 2 L pails to my quote", then the quote (My projects) shows 3 x 2 L.
//   BASE=http://127.0.0.1:8751/ WSLENV=BASE node.exe cart_e2e.mjs x <outDir>     Screenshots at 390 and 1366 px.
import fs from 'node:fs';
import { launch } from './_browser.mjs';
const [, , , outDir = './shots_cart'] = process.argv; fs.mkdirSync(outDir, { recursive: true });
const base = process.env.BASE; if (!base) { console.log('FAIL set BASE to the portal server'); process.exit(1); }
const b = await launch(); let fails = 0;
const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).replace(/\s+/g, ' ').slice(0, 300) : '')); };
const settle = (page, before) => page.waitForFunction((n) => document.querySelectorAll('.asst-log .msg--bot').length > n && !document.querySelector('.asst-log .typing'), before, { timeout: 15000 });
const ask = async (page, q) => { const before = await page.locator('.asst-log .msg--bot').count(); await page.fill('#asst-q', q); await page.press('#asst-q', 'Enter'); await settle(page, before); return page.locator('.asst-log .msg--bot').last(); };
const tap = async (page, label) => { const before = await page.locator('.asst-log .msg--bot').count(); await page.locator('.asst-log .msg--bot').last().locator('button.chip', { hasText: label }).first().click(); await settle(page, before); return page.locator('.asst-log .msg--bot').last(); };
for (const [W, H] of [[390, 844], [1366, 768]]) {
  const sz = `${W}`; const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600 }); const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text().slice(0, 140)); }); page.on('pageerror', (e) => errs.push(e.message));
  await ctx.route('**/*', (route) => { const u = new URL(route.request().url()); if (u.host === new URL(base).host || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue(); return route.abort(); });
  await page.goto(base + '?actions=off#/', { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(300);
  await page.locator('button:visible:has-text("Advisor")').first().click();
  let a = await ask(page, 'how much grout for 20 m2'); let txt = await a.innerText();
  t(`${sz} bare grout ask: asks which product, chips for the grid grouts`, /Which product/i.test(txt) && (await a.locator('button.chip', { hasText: 'Davco Easy Grout' }).count()) >= 1 && (await a.locator('button.chip', { hasText: 'SikaCeram-690 Elite' }).count()) >= 1, txt);
  await page.waitForTimeout(800); await a.evaluate((e) => e.scrollIntoView({ block: 'end' })); await page.waitForTimeout(400); await page.screenshot({ path: `${outDir}/1_which_product_${sz}.png` });
  a = await tap(page, 'Davco Easy Grout'); txt = await a.innerText();
  t(`${sz} chip: asks the tile size, with the table rows as chips`, /tile size/i.test(txt) && (await a.locator('button.chip', { hasText: '300x100x10mm' }).count()) >= 1, txt);
  a = await tap(page, '300x100x10mm'); txt = await a.innerText();
  t(`${sz} chip: the tile is known, the three joint widths are shown with a chip each`, /joint width/i.test(txt) && (await a.locator('button.chip', { hasText: '3 mm joint' }).count()) >= 1, txt);
  a = await tap(page, '3 mm joint'); txt = await a.innerText();
  t(`${sz} Easy Grout 20 m2, 300x100, 3 mm joint (by chips): 20 / 7 = 2.86 rounded up to 3 x 2 L pail`, /20 m2 \/ 7 m2 per 2 L pail = 2\.86, rounded up to 3/.test(txt) && /3 x 2 L pail/.test(txt), txt);
  const btn = a.locator('button.chip', { hasText: 'Add 3 x 2 L pails to my quote' }); t(`${sz} the add-to-quote button is there`, (await btn.count()) === 1);
  await a.evaluate((e) => e.scrollIntoView({ block: 'end' })); await page.waitForTimeout(400); await page.screenshot({ path: `${outDir}/2_answer_with_add_${sz}.png` });
  await btn.click(); await page.waitForTimeout(500);
  t(`${sz} after the tap: confirmation with a link to the quote`, /Added 3 x 2 L pails to your quote/.test(await a.innerText()) && (await a.locator('a', { hasText: 'See my quote' }).count()) === 1, await a.innerText());
  await page.screenshot({ path: `${outDir}/3_added_${sz}.png` });
  const stored = await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('sika-demo-210c0c-project-v2') || '{}'); const p = (o.projects || {})[o.current] || { items: [] }; return p.items; });
  t(`${sz} the shared project store holds exactly 3 x 2 L pail of Davco Easy Grout`, stored.length === 1 && stored[0].id === 'davco-easy-grout' && stored[0].qty === 3 && stored[0].packs === '3 x 2 L pail', JSON.stringify(stored));
  await page.evaluate(() => { if (window.__asstClose) window.__asstClose(); location.hash = '#/projects'; }); await page.waitForTimeout(900);
  const body = await page.locator('main').innerText();
  t(`${sz} My projects and quotes shows Davco Easy Grout, 3 x 2 L pail`, /Davco\W*Easy Grout/.test(body) && /3 x 2 L pail/.test(body), body.slice(0, 400));
  await page.evaluate(() => { const e = [...document.querySelectorAll('main *')].find((x) => /Easy Grout/.test(x.textContent) && x.children.length < 3); if (e) e.scrollIntoView({ block: 'center' }); }); await page.waitForTimeout(500); await page.screenshot({ path: `${outDir}/4_quote_${sz}.png` });
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); t(`${sz} no horizontal scroll`, ov <= 1, ov);
  t(`${sz} no console errors or warnings`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await b.close(); console.log(fails ? `CART E2E FAILURES ${fails}` : 'CART E2E GREEN'); process.exit(fails ? 1 : 0);
