// Regression (R2 audit 2026-11-01): consent and confirm chips both send "yes"; the double-tap guard keyed on the value dropped a fast confirm tap.
// Clock slowed 10x so the 700 ms guard window always covers the tap. Usage: node e2e_quote_fasttap.mjs <portalDir> 0 3  -> expects DEAD 0/3.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from '/home/tech2/kk-a-demo-sika/node_modules/playwright-core/index.mjs';
const ROOT = process.argv[2], DELAY = +process.argv[3], RUNS = +(process.argv[4] || 3);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${srv.address().port}/`;
const b = await chromium.launch({ headless: true }); let dead = 0;
for (let i = 0; i < RUNS; i++) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const page = await ctx.newPage();
  await page.addInitScript(() => { window.print = () => {}; const r = Date.now.bind(Date), t0 = r(); Date.now = () => t0 + (r() - t0) / 10; });
  await page.goto(base + '#/', { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(300);
  if (!(await page.locator('#assistant.open').count())) { if (await page.locator('#asst-fab').isVisible()) await page.click('#asst-fab'); else await page.locator('#mbar-ask, #tri-advisor').locator('visible=true').first().click(); }
  await page.waitForSelector('#assistant.open');
  const wait = async (n) => { await page.waitForFunction((n) => document.querySelectorAll('.msg--bot').length > n && !document.querySelector('.typing'), n, { timeout: 20000 }); await page.waitForTimeout(120); };
  const send = async (t) => { const n = await page.locator('.msg--bot').count(); await page.fill('#asst-q', t); await page.keyboard.press('Enter'); await wait(n); };
  const chip = async (l) => { const n = await page.locator('.msg--bot').count(); await page.locator('.msg--bot').last().locator('button.chip', { hasText: l }).first().click(); await wait(n); };
  await send('add 4 bags of Davco Easy Grout'); await send('get me a quote'); await chip('Yes, that is the list');
  await send('Brisbane 4000'); await send('in 3 weeks'); await chip('Delivery to site'); await chip('Builder or contractor');
  await send('Acme Builders'); await send('Sam Smith'); await send('sam@acme.com.au'); await chip('Skip'); await chip('Mornings'); await send('Grout colour to confirm');
  const n0 = await page.locator('.msg--bot').count();
  await page.locator('.msg--bot').last().locator('button.chip', { hasText: 'Yes, I am happy with that' }).first().click();
  await page.waitForFunction((n) => document.querySelectorAll('.msg--bot').length > n, n0, { timeout: 20000 });
  await page.waitForTimeout(DELAY);
  const n1 = await page.locator('.msg--bot').count();
  await page.locator('.msg--bot').last().locator('button.chip', { hasText: 'Yes, prepare the request' }).first().click();
  let ok = true; try { await page.waitForFunction((n) => document.querySelectorAll('.msg--bot').length > n && !document.querySelector('.typing'), n1, { timeout: 8000 }); } catch { ok = false; }
  const txt = ok ? (await page.locator('.msg--bot').last().innerText()).slice(0, 80).replace(/\n/g, ' ') : '';
  if (!ok) dead++; console.log(`run ${i + 1} delay ${DELAY}ms: ${ok ? 'OK ' + txt : 'DEAD (no response in 8 s)'}`);
  await ctx.close();
}
await b.close(); srv.close(); console.log(`DEAD ${dead}/${RUNS}`); process.exit(dead ? 1 : 0);
