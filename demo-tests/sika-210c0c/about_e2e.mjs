// T02 e2e: the About page sentence carries the numbers in data/coverage.json. usage (Windows node): node.exe about_e2e.mjs [portalDir] <outDir>
import fs from 'node:fs';
import { serve, launch } from './_browser.mjs';
import { PORTAL } from './_env.mjs';
const [, , t0, outDir = './about_out'] = process.argv; fs.mkdirSync(outDir, { recursive: true });
const s = await serve(t0 || PORTAL); const b = await launch(); let fails = 0;
const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).slice(0, 220) : '')); };
for (const [W, H] of [[1366, 768], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600 }); const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text().slice(0, 120)); }); page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(s.base + '#/about', { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(300);
  const cov = await (await fetch(s.base + 'data/coverage.json')).json(); const sz = `${W}x${H}`;
  const line = await page.locator('#cov-line').innerText().catch(() => '');
  const nums = (line.match(/\d[\d,]*/g) || []).map((x) => +x.replace(/,/g, ''));
  t(`${sz} panel heading is shown`, (await page.locator('#cov-h').innerText().catch(() => '')) === 'How complete is this?');
  t(`${sz} sentence numbers equal coverage.json`, nums[0] === cov.tileStone.ratePublished && nums[1] === cov.tileStone.products && nums[2] === cov.tileStone.products - cov.tileStone.ratePublished, `${line.slice(0, 100)} | ${nums.join(',')}`);
  t(`${sz} wording says published, never "does not have"`, /published on the data sheet/i.test(line) && !/does not have|doesn.t have/i.test(line));
  t(`${sz} no console errors or warnings`, errs.length === 0, errs.join(' | '));
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); t(`${sz} no horizontal scroll`, ov <= 1, ov);
  await page.screenshot({ path: `${outDir}/about_${sz}.png`, fullPage: true }); await ctx.close();
}
await b.close(); s.close(); console.log(fails ? `ABOUT E2E ${fails} failed` : 'ABOUT E2E GREEN'); process.exit(fails ? 1 : 0);
