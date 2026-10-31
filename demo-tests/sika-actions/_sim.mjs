// Shared helpers for the command-selection browser tests (e2e_cmdsel.mjs, sim_cmdsel.mjs): open the portal at a size with touch emulation on a phone, open the panel, send a question and wait for the answer.
export const SIZES = [[1440, 900], [390, 844]];
export async function openPage(b, base, W, H, hash = '#/') {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600 });
  const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text().slice(0, 160)); }); page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(base + hash, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(300);
  return { ctx, page, errs, touch: W < 600 };
}
export async function openPanel(page) {
  const fab = page.locator('#asst-fab');
  if (await fab.isVisible()) await fab.click(); else await page.locator('button:visible', { hasText: 'Advisor' }).first().click();
  await page.waitForSelector('#assistant.open'); await page.waitForFunction(() => !!document.querySelector('.asst-sugg .chip') , null, { timeout: 15000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.asst-sugg .chip')].some((c) => c.textContent.includes('/ commands')), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(200);
}
/** Wait until n0+1 bot messages exist and no typing indicator is left. */
export async function settle(page, n0, timeout = 25000) {
  await page.waitForFunction((n) => document.querySelectorAll('.msg--bot').length > n && !document.querySelector('.typing'), n0, { timeout });
  await page.waitForTimeout(120);
}
export const botText = async (page) => (await page.locator('.msg--bot').last().innerText()).replace(/\s*\n+\s*/g, ' | ');
export async function ask(page, text) {
  const n = await page.locator('.msg--bot').count();
  await page.fill('#asst-q', text); await page.keyboard.press('Enter'); await settle(page, n); return botText(page);
}
export const press = (touch, loc) => (touch ? loc.tap() : loc.click());
export const counts = (page) => page.evaluate(() => ({ user: document.querySelectorAll('.msg--user').length, bot: document.querySelectorAll('.msg--bot').length, typing: document.querySelectorAll('.typing').length }));
