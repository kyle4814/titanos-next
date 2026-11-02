// walk_integrated.mjs: the integration walk (2026-11-02) in headless Windows Chrome: open the panel -> "hi" -> "what do you recommend for my bathroom" -> tap a chip
// -> "how much for 12 m2" -> add to quote (when the answer offers it) -> New chat -> reload. Screenshots at 390 and 1366 px. Report only: prints what each step showed.
//   BASE=http://127.0.0.1:8751/ WSLENV=BASE node.exe walk_integrated.mjs x <outDir>
import fs from 'node:fs';
import { launch } from './_browser.mjs';
const [, , , outDir = './shots_integrated'] = process.argv; fs.mkdirSync(outDir, { recursive: true });
const base = process.env.BASE; if (!base) { console.log('FAIL set BASE to the portal server'); process.exit(1); }
const b = await launch();
const say = (s, x) => console.log(s + ' :: ' + String(x).replace(/\s+/g, ' ').slice(0, 400));
const lastBot = (page) => page.locator('.asst-log .msg--bot').last();
const waitBot = async (page, before) => { await page.waitForFunction((n) => document.querySelectorAll('.asst-log .msg--bot').length > n && !document.querySelector('.asst-log .msg--typing'), before, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(500); };
const ask = async (page, q) => { const n = await page.locator('.asst-log .msg--bot').count(); await page.fill('#asst-q', q); await page.press('#asst-q', 'Enter'); await waitBot(page, n); return lastBot(page); };
for (const [W, H] of [[390, 844], [1366, 768]]) {
  const sz = String(W); const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600 }); const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text().slice(0, 140)); }); page.on('pageerror', (e) => errs.push(e.message));
  await ctx.route('**/*', (route) => { const u = new URL(route.request().url()); if (u.host === new URL(base).host || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue(); return route.abort(); });
  await page.goto(base + '?actions=off#/', { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(300);
  await page.locator('button:visible:has-text("Advisor")').first().click(); await page.locator('.asst-log .msg--welcome').waitFor({ timeout: 8000 });
  await page.screenshot({ path: `${outDir}/1_open_${sz}.png` }); say(`${sz} 1 open`, await page.locator('.asst-log').innerText());
  let a = await ask(page, 'hi'); await page.screenshot({ path: `${outDir}/2_hi_${sz}.png` }); say(`${sz} 2 hi`, await a.innerText());
  a = await ask(page, 'what do you recommend for my bathroom'); await page.screenshot({ path: `${outDir}/3_bathroom_${sz}.png` }); say(`${sz} 3 bathroom`, await a.innerText());
  const chips = a.locator('button.chip'); const nc = await chips.count(); say(`${sz} 3 chips`, nc ? (await chips.allInnerTexts()).join(' | ') : '(none)');
  if (nc) { const n = await page.locator('.asst-log .msg--bot').count(); const label = await chips.first().innerText(); await chips.first().click(); await waitBot(page, n); a = lastBot(page); await page.screenshot({ path: `${outDir}/4_chip_${sz}.png` }); say(`${sz} 4 chip "${label}"`, await a.innerText()); }
  a = await ask(page, 'how much for 12 m2'); await page.screenshot({ path: `${outDir}/5_how_much_${sz}.png` }); say(`${sz} 5 how much for 12 m2`, await a.innerText());
  for (let i = 0; i < 2 && !(await page.locator('.asst-log button[data-cart]').count()); i++) { const c = lastBot(page).locator('button.chip'); if (!(await c.count())) break; const n = await page.locator('.asst-log .msg--bot').count(); const label = await c.first().innerText(); await c.first().click(); await waitBot(page, n); say(`${sz} 5b chip "${label}"`, await lastBot(page).innerText()); }
  const cart = page.locator('.asst-log button[data-cart]');
  if (await cart.count()) { const label = await cart.first().innerText(); await cart.first().click(); await page.waitForTimeout(600); await page.screenshot({ path: `${outDir}/6_added_${sz}.png` }); say(`${sz} 6 add to quote "${label}"`, await page.locator('.asst-log .cart-msg').last().innerText()); }
  else { await page.screenshot({ path: `${outDir}/6_no_cart_${sz}.png` }); say(`${sz} 6 add to quote`, 'no add-to-quote button was offered on this path'); }
  const saved = await page.evaluate(() => sessionStorage.getItem('sika-brain-state-v1') !== null);
  await page.locator('#asst-new').click(); await page.waitForTimeout(500); await page.screenshot({ path: `${outDir}/7_new_chat_${sz}.png` });
  const cleared = await page.evaluate(() => sessionStorage.getItem('sika-brain-state-v1') === null); say(`${sz} 7 new chat`, `saved before: ${saved}; cleared after: ${cleared}; log: ` + await page.locator('.asst-log').innerText());
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(400);
  await page.locator('button:visible:has-text("Advisor")').first().click(); await page.locator('.asst-log .msg--welcome').waitFor({ timeout: 8000 }).catch(() => {});
  a = await ask(page, 'the floor'); await page.screenshot({ path: `${outDir}/8_reload_${sz}.png` }); say(`${sz} 8 after reload, "the floor" (no carried bathroom expected)`, await a.innerText());
  const q = await page.evaluate(() => { try { return localStorage.length; } catch { return -1; } }); say(`${sz} console errors/warnings`, errs.length ? errs.join(' | ') : 'none');
  await ctx.close();
}
await b.close(); console.log('WALK DONE');
