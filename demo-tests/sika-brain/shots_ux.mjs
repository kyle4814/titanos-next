// shots_ux.mjs: before/after screenshots of the chat panel as a conversation (open, hi, bathroom, chip tap, answer) at 390 and 1366 px. Same run pattern as convo_e2e.mjs.
//   BASE=http://127.0.0.1:8751/ WSLENV=BASE node.exe shots_ux.mjs x <outDir> <prefix>      (prefix: before or after)
import fs from 'node:fs';
import { launch } from './_browser.mjs';
const [, , , outDir = './shots_ux', pre = 'after'] = process.argv; fs.mkdirSync(outDir, { recursive: true });
const base = process.env.BASE; if (!base) { console.log('FAIL set BASE'); process.exit(1); }
const b = await launch();
for (const [W, H] of [[390, 844], [1366, 768]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600 }); const page = await ctx.newPage();
  await ctx.route('**/*', (r) => { const u = new URL(r.request().url()); return u.host === new URL(base).host || u.protocol === 'data:' || u.protocol === 'blob:' ? r.continue() : r.abort(); });
  await page.goto(base + '?actions=off#/', { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(300);
  await page.locator('button:visible:has-text("Advisor")').first().click(); await page.waitForTimeout(900);
  const shot = async (n) => page.screenshot({ path: `${outDir}/${pre}_${n}_${W}.png` });
  const settle = async (n) => { await page.waitForFunction((k) => document.querySelectorAll('.asst-log .msg--bot').length > k && !document.querySelector('.asst-log .typing'), n, { timeout: 15000 }); await page.waitForTimeout(700); };
  const bots = () => page.locator('.asst-log .msg--bot').count();
  await shot('1_open');
  let n = await bots(); await page.fill('#asst-q', 'hi'); await page.press('#asst-q', 'Enter'); await settle(n); await shot('2_hi');
  n = await bots(); await page.fill('#asst-q', 'what do you recommend for my bathroom'); await page.press('#asst-q', 'Enter'); await settle(n); await shot('3_bathroom');
  n = await bots(); await page.locator('.asst-log .msg--bot').last().locator('button.chip', { hasText: 'Sealant around the bath' }).first().click(); await page.waitForTimeout(150); await shot('4_chip_tapped'); await settle(n); await shot('5_answer');
  await ctx.close();
}
await b.close(); console.log('SHOTS DONE ' + pre);
