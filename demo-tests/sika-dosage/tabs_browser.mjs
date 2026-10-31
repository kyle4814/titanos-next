// tabs_browser.mjs: the product page tab strip is never clipped. usage (Windows node): node.exe tabs_browser.mjs <portalDir> [outDir] [--measure]
import fs from 'node:fs';
import { serve, launch } from '../sika-210c0c/_browser.mjs';
import { PORTAL } from '../sika-210c0c/_env.mjs';
const [, , t0, outDir = './tabs_out'] = process.argv; fs.mkdirSync(outDir, { recursive: true });
const root = t0 || PORTAL; const s = await serve(root); const b = await launch(); let fails = 0;
const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).slice(0, 300) : '')); };
const measure = process.argv.includes('--measure');
const WIDTHS = [[1280, 800], [1366, 768], [1440, 900], [1920, 1080], [390, 844]];
for (const [W, H] of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 600, hasTouch: W < 600 }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(s.base + '#/product/sikarapid-4?tab=documents', { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy]) [role=tablist]'); await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const list = document.querySelector('[role=tablist]'); const vw = document.documentElement.clientWidth; const lr = list.getBoundingClientRect();
    const btns = [...list.querySelectorAll('[role=tab]')]; const act = list.querySelector('[aria-selected=true]');
    const inView = (el) => { const x = el.getBoundingClientRect(); return x.left >= lr.left - 1 && x.right <= lr.right + 1 && x.left >= -1 && x.right <= vw + 1; };
    const ar = act.getBoundingClientRect();
    const rows = new Set(btns.map((x) => Math.round(x.getBoundingClientRect().top)));
    return { vw, listL: lr.left, listR: lr.right, scrollW: list.scrollWidth, clientW: list.clientWidth, scrollable: list.scrollWidth > list.clientWidth + 1, overflowX: getComputedStyle(list).overflowX, n: btns.length, clipped: btns.filter((x) => !inView(x)).map((x) => x.textContent.trim()), activeName: act.textContent.trim(), activeVisible: inView(act), activeR: Math.round(ar.right), rows: rows.size, pageOverflow: document.documentElement.scrollWidth - vw };
  });
  console.log(`INFO ${W}x${H} ` + JSON.stringify(r));
  if (!measure) {
    t(`${W}: the strip is scrollable or wraps (overflow-x ${r.overflowX}, rows ${r.rows}, scrollW ${r.scrollW} vs ${r.clientW})`, r.overflowX !== 'visible' && (r.scrollable || r.rows > 1 || r.clipped.length === 0));
    t(`${W}: the active tab (${r.activeName}) is inside the viewport after load`, r.activeVisible, JSON.stringify(r));
    t(`${W}: every tab is inside the viewport or reachable by scrolling the strip`, r.clipped.length === 0 || r.scrollable, r.clipped.join(','));
    t(`${W}: the page itself does not scroll sideways`, r.pageOverflow <= 1, r.pageOverflow);
    // reach the first tab and the last tab by scrolling the strip, then keyboard arrows move the active tab into view
    await page.evaluate(() => { document.querySelector('[role=tablist]').scrollLeft = 0; }); await page.waitForTimeout(150);
    await page.focus('[role=tab][aria-selected=true]'); await page.keyboard.press('Home'); await page.waitForTimeout(450);
    const home = await page.evaluate(() => { const l = document.querySelector('[role=tablist]').getBoundingClientRect(), a = document.querySelector('[role=tab][aria-selected=true]').getBoundingClientRect(); return { name: document.querySelector('[role=tab][aria-selected=true]').textContent.trim(), ok: a.left >= l.left - 1 && a.right <= l.right + 1 }; });
    t(`${W}: Home selects the first tab and it is in view`, home.name === 'Overview' && home.ok, JSON.stringify(home));
    await page.keyboard.press('End'); await page.waitForTimeout(450);
    const end = await page.evaluate(() => { const l = document.querySelector('[role=tablist]').getBoundingClientRect(), a = document.querySelector('[role=tab][aria-selected=true]').getBoundingClientRect(); return { name: document.querySelector('[role=tab][aria-selected=true]').textContent.trim(), ok: a.left >= l.left - 1 && a.right <= l.right + 1 }; });
    t(`${W}: End selects the last tab (Documents) and it is in view`, /^Documents/.test(end.name) && end.ok, JSON.stringify(end));
    const aff = await page.evaluate(() => { const w = document.querySelector('.tabs'); return { more: w.dataset.more || '', hasFade: getComputedStyle(w, '::after').content !== 'none' || getComputedStyle(w, '::before').content !== 'none' }; });
    if (r.scrollable) t(`${W}: an edge affordance is present while the strip overflows`, aff.hasFade, JSON.stringify(aff));
    await page.screenshot({ path: `${outDir}/tabs_${W}.png`, clip: { x: 0, y: 0, width: W, height: Math.min(H, 700) } });
    t(`${W}: no page errors`, errs.length === 0, errs.join('|'));
  }
  await ctx.close();
}
await b.close(); s.close(); console.log(fails ? `TABS BROWSER ${fails} failed` : 'TABS BROWSER GREEN'); process.exit(fails ? 1 : 0);
