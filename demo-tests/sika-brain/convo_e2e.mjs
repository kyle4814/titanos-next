// convo_e2e.mjs: a real conversation in the chat panel, in headless Windows Chrome (run with WINDOWS node, against serve_wsl.mjs; see run_all.sh).
//   BASE=http://127.0.0.1:8751/ WSLENV=BASE node.exe convo_e2e.mjs x <outDir>
// hi -> "what do you recommend for my bathroom" -> tap a chip -> read the answer; then a typed follow-up. Screenshots at 390 and 1366 px.
import fs from 'node:fs';
import { launch } from './_browser.mjs';
const [, , , outDir = './shots_convo'] = process.argv; fs.mkdirSync(outDir, { recursive: true });
const base = process.env.BASE; if (!base) { console.log('FAIL set BASE to the portal server'); process.exit(1); }
const b = await launch(); let fails = 0;
const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).replace(/\s+/g, ' ').slice(0, 300) : '')); };
const ask = async (page, q) => { const before = await page.locator('.asst-log .msg--bot').count(); await page.fill('#asst-q', q); await page.press('#asst-q', 'Enter'); await page.waitForFunction((n) => document.querySelectorAll('.asst-log .msg--bot').length > n && !document.querySelector('.asst-log .typing'), before, { timeout: 15000 }); return page.locator('.asst-log .msg--bot').last(); };
const tap = async (page, label) => { const before = await page.locator('.asst-log .msg--bot').count(); await page.locator('.asst-log .msg--bot').last().locator('button.chip', { hasText: label }).first().click(); await page.waitForFunction((n) => document.querySelectorAll('.asst-log .msg--bot').length > n && !document.querySelector('.asst-log .typing'), before, { timeout: 15000 }); return page.locator('.asst-log .msg--bot').last(); };
for (const [W, H] of [[390, 844], [1366, 768]]) {
  const sz = `${W}`; const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600 }); const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text().slice(0, 140)); }); page.on('pageerror', (e) => errs.push(e.message));
  await ctx.route('**/*', (route) => { const u = new URL(route.request().url()); if (u.host === new URL(base).host || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue(); return route.abort(); });
  await page.goto(base + '?actions=off#/', { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(300);
  await page.locator('button:visible:has-text("Advisor")').first().click();
  let a = await ask(page, 'hi'); let txt = await a.innerText();
  t(`${sz} hi: a friendly reply that steers to the job, with starter chips`, /G'day/i.test(txt) && /surface and the problem/i.test(txt) && (await a.locator('button.chip').count()) >= 3 && !/not in the published/i.test(txt), txt);
  await page.screenshot({ path: `${outDir}/1_hi_${sz}.png` });
  a = await ask(page, 'what do you recommend for my bathroom'); txt = await a.innerText();
  t(`${sz} bathroom: one clarifying question with chips, not "not in the documentation"`, /Which part of the bathroom/i.test(txt) && (await a.locator('button.chip').count()) >= 4 && !/not in the published/i.test(txt), txt);
  await page.screenshot({ path: `${outDir}/2_bathroom_${sz}.png` });
  a = await tap(page, 'Sealant around the bath'); txt = await a.innerText();
  t(`${sz} chip: the answer leads with My pick and a quoted sentence`, /My pick from the data sheets: .+ says: ".+"/is.test(txt), txt);
  t(`${sz} chip: shows a Technical Services line once`, /Technical Services/.test(txt));
  await page.waitForTimeout(700); await page.screenshot({ path: `${outDir}/3_pick_${sz}.png` });
  await a.evaluate((e) => e.scrollIntoView({ block: 'start' })); await page.waitForTimeout(500); await page.screenshot({ path: `${outDir}/3b_pick_full_${sz}.png`, fullPage: false });
  a = await ask(page, 'thanks'); txt = await a.innerText(); t(`${sz} thanks: warm close, no three random jobs`, /No worries/i.test(txt) && !/which of these do you mean/i.test(txt), txt);
  a = await ask(page, 'a sealant'); txt = await a.innerText(); t(`${sz} a sealant: asks what it is for`, /What is the sealant for/i.test(txt), txt);
  a = await ask(page, 'around the bath'); txt = await a.innerText(); t(`${sz} follow-up "around the bath" joins the question`, /silicone|seal/i.test(txt) && !/Which of these|not in the published/i.test(txt), txt);
  await page.screenshot({ path: `${outDir}/4_followup_${sz}.png` });
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); t(`${sz} no horizontal scroll`, ov <= 1, ov);
  t(`${sz} no console errors or warnings`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await b.close(); console.log(fails ? `CONVO E2E FAILURES ${fails}` : 'CONVO E2E GREEN'); process.exit(fails ? 1 : 0);
