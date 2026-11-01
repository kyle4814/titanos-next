// calc_browser.mjs: the advisor as a calculator, end to end in a real browser, 1366 and 390 wide.
// ask -> one question with a recommended chip -> cited answer with the estimate sentence -> save to project details -> Project page Calculations section -> the quote/job pack reads it.
// usage (Windows node): node.exe calc_browser.mjs <portalDir> <outDir>
import fs from 'node:fs';
import { serve, launch } from '../sika-210c0c/_browser.mjs';
import { PORTAL } from '../sika-210c0c/_env.mjs';
const [, , t0, outDir = './calc_out'] = process.argv; fs.mkdirSync(outDir, { recursive: true });
const root = t0 || PORTAL; const s = await serve(root); const b = await launch(); let fails = 0;
const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).slice(0, 300) : '')); };
const EST = 'Estimate only, not an offer. Quantities, not prices. Confirm with the product data sheet and Sika Technical Services before ordering.';
const openPanel = async (page) => { if (await page.locator('#asst-fab').isVisible()) await page.click('#asst-fab'); else await page.locator('button:visible', { hasText: 'Advisor' }).first().click(); await page.waitForSelector('#assistant.open'); };
const send = async (page, text) => { const before = await page.locator('.msg--bot').count(); await page.fill('#asst-q', text); await page.keyboard.press('Enter'); await page.waitForFunction((n) => document.querySelectorAll('.msg--bot').length > n, before, { timeout: 20000 }); await page.waitForTimeout(500); };
const last = (page) => page.locator('.msg--bot').last();
for (const [W, H] of [[1366, 768], [390, 844]]) {
  const sz = `${W}x${H}`;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 600, hasTouch: W < 600 }); const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); }); page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(s.base + '#/', { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(300);
  await openPanel(page);
  await send(page, 'how much grout for 20 m2 of 600x600 tiles with 3 mm joints');
  let txt = await last(page).innerText();
  t(`${sz} one clarifying question about the tile thickness`, /thick/i.test(txt) && (await last(page).locator('button.chip').count()) >= 2, txt.slice(0, 200));
  t(`${sz} the first chip is the recommendation`, /recommended/i.test(await last(page).locator('button.chip').first().innerText()));
  await last(page).locator('button.chip').first().click(); await page.waitForTimeout(900);
  await page.waitForFunction(() => /Grout volume/.test(document.querySelector('#assistant').innerText), null, { timeout: 15000 });
  txt = await last(page).innerText();
  t(`${sz} cited answer: 2 L of grout with the working`, /Grout volume/.test(txt) && /\b2 L\b/.test(txt) && /600/.test(txt), txt.slice(0, 400));
  t(`${sz} the source line is shown`, /Worked from the numbers you typed/.test(txt));
  t(`${sz} the estimate sentence is on the answer`, txt.includes(EST));
  await last(page).getByRole('button', { name: 'Save to project details' }).click(); await page.waitForTimeout(600);
  txt = await last(page).innerText(); t(`${sz} saved to project details`, /Saved calculation/.test(txt) && /Grout for 20 m2/.test(txt), txt.slice(0, 200));
  await page.screenshot({ path: `${outDir}/advisor_${W}.png` });
  // the project page
  await page.keyboard.press('Escape'); await page.goto(s.base + '#/projects', { waitUntil: 'load' }); await page.waitForSelector('#proj-calcs', { timeout: 15000 });
  const sec = await page.locator('#proj-calcs').innerText();
  t(`${sz} Calculations section lists it with the answer`, /Calculations/.test(sec) && /Grout for 20 m2/.test(sec) && /2 L of grout/.test(sec), sec.slice(0, 300));
  t(`${sz} it shows the working, the source and the estimate sentence`, /Working:/.test(sec) && /Source:/.test(sec) && sec.includes(EST), sec.slice(0, 500));
  t(`${sz} re-run, edit inputs and delete are there`, (await page.locator('#proj-calcs').getByRole('button', { name: 'Re-run', exact: true }).count()) === 1 && (await page.locator('#proj-calcs').getByRole('button', { name: 'Edit inputs', exact: true }).count()) === 1 && (await page.locator('#proj-calcs').getByRole('button', { name: /^Delete/ }).count()) === 1);
  // edit the inputs: 12 mm tiles -> 2.4 L
  await page.locator('#proj-calcs button', { hasText: 'Edit inputs' }).click();
  await page.fill('#proj-calcs input[name=thicknessMm]', '12'); await page.locator('#proj-calcs button', { hasText: 'Save and re-run' }).click(); await page.waitForTimeout(700);
  const sec2 = await page.locator('#proj-calcs').innerText(); t(`${sz} edit and re-run updates the answer to 2.4 L`, /2\.4 L of grout/.test(sec2), sec2.slice(0, 300));
  // the quote / job pack reads it
  t(`${sz} the job pack is offered with only a calculation in the project`, (await page.locator('#pack-copy').count()) === 1);
  await page.evaluate(() => { try { navigator.clipboard.writeText = async () => {}; } catch {} });
  await page.click('#pack-copy'); await page.waitForTimeout(400);
  const enq = await page.inputValue('#enquiry-text'); t(`${sz} the quote pack text includes the calculation`, /Calculations \(estimates/.test(enq) && /2\.4 L of grout/.test(enq), enq.slice(0, 400));
  await page.screenshot({ path: `${outDir}/project_${W}.png`, fullPage: false });
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); t(`${sz} no horizontal scroll on the project page`, ov <= 1, ov);
  // delete
  await page.locator('#proj-calcs').getByRole('button', { name: /^Delete/ }).click(); await page.waitForTimeout(500);
  t(`${sz} delete removes it`, (await page.locator('#proj-calcs').count()) === 0 && /project is empty/i.test(await page.locator('main').innerText()));
  t(`${sz} no console errors`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await b.close(); s.close(); console.log(fails ? `CALC BROWSER ${fails} failed` : 'CALC BROWSER GREEN'); process.exit(fails ? 1 : 0);
