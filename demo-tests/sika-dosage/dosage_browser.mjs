// dosage_browser.mjs: the "How much do I need?" box on a dosage product and on an area product, 1366 and 390 wide. usage (Windows node): node.exe dosage_browser.mjs <portalDir> <outDir>
import fs from 'node:fs';
import { serve, launch } from '../sika-210c0c/_browser.mjs';
import { PORTAL } from '../sika-210c0c/_env.mjs';
const [, , t0, outDir = './dosage_out'] = process.argv; fs.mkdirSync(outDir, { recursive: true });
const root = t0 || PORTAL; const s = await serve(root); const b = await launch(); let fails = 0;
const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).slice(0, 300) : '')); };
const EST = 'Estimate only, not an offer. Quantities, not prices. Confirm with the product data sheet and Sika Technical Services before ordering.';
const type = async (page, sel, v) => { await page.fill(sel, ''); await page.fill(sel, String(v)); await page.waitForTimeout(200); };
for (const [W, H] of [[1366, 768], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 600, hasTouch: W < 600 }); const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); }); page.on('pageerror', (e) => errs.push(e.message));
  const sz = `${W}x${H}`;
  await page.goto(s.base + '#/product/sikarapid-4', { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy]) #calc-out'); await page.waitForTimeout(300);
  t(`${sz} SikaRapid-4: no Area box`, (await page.locator('#calc-area').count()) === 0);
  t(`${sz} SikaRapid-4: cement mass box present`, (await page.locator('#calc-cement').count()) === 1);
  t(`${sz} SikaRapid-4: nothing worked out before a size is typed`, /Enter a size/.test(await page.locator('#calc-out').innerText()));
  await type(page, '#calc-cement', 1000);
  const o = await page.locator('#calc-out').innerText();
  t(`${sz} SikaRapid-4: 1000 kg gives 4 L to 20 L`, /4 L to 20 L/.test(o), o.slice(0, 300));
  t(`${sz} SikaRapid-4: published range shown as published`, /400 mL to 2,000 mL per 100 kg/.test(o), o.slice(0, 300));
  t(`${sz} SikaRapid-4: packs low to high`, /1 to 2 x 10 L/.test(o) && /1 x 205 L/.test(o), o);
  t(`${sz} SikaRapid-4: cited source line with page link`, (await page.locator('#calc-out a[href*="sikarapid_-4.pdf"]').count()) >= 1 && /source, page 1/.test(o), o.slice(0, 300));
  t(`${sz} SikaRapid-4: the published sentence is quoted`, o.includes('Dosage is 400ml - 2000ml/100 kg of total cementitious material'));
  t(`${sz} SikaRapid-4: estimate sentence on the box`, (await page.locator('.finder-calc').innerText()).includes(EST));
  t(`${sz} SikaRapid-4: no "not worked out here" text`, !/not worked out here/i.test(await page.locator('.finder-calc').innerText()));
  await type(page, '#calc-cement', 2000); t(`${sz} SikaRapid-4: 2000 kg gives 8 L to 40 L`, /8 L to 40 L/.test(await page.locator('#calc-out').innerText()));
  await page.screenshot({ path: `${outDir}/rapid_${W}.png`, fullPage: false });
  await page.locator('#calc-out button', { hasText: 'Add to project with this quantity' }).first().click(); await page.waitForTimeout(200);
  // typical dose shown separately and cited (Plastiment-55: 400 ml +/- 100 ml)
  await page.goto(s.base + '#/product/sika-plastiment-55', { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy]) #calc-out'); await page.waitForTimeout(300);
  await type(page, '#calc-cement', 1000); const o3 = await page.locator('#calc-out').innerText();
  t(`${sz} Plastiment-55: range 3 L to 5 L and typical 4 L shown separately`, /3 L to 5 L/.test(o3) && /Typical dose in the same statement:\s*4 L/.test(o3), o3.slice(0, 400));
  // percent-of-cement and per-m3 products show their own input
  await page.goto(s.base + '#/product/sikacontrol-plus', { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy]) #calc-out'); await page.waitForTimeout(300);
  await type(page, '#calc-cement', 2000); t(`${sz} Sika Control PLUS (percent of cement): 2000 kg gives 20 kg to 60 kg, no Area box`, /20 kg to 60 kg/.test(await page.locator('#calc-out').innerText()) && (await page.locator('#calc-area').count()) === 0);
  await page.goto(s.base + '#/product/sika-air', { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy]) #calc-out'); await page.waitForTimeout(300);
  t(`${sz} Sika Air (per m3): volume box, no Area box`, (await page.locator('#calc-vol').count()) === 1 && (await page.locator('#calc-area').count()) === 0);
  await type(page, '#calc-vol', 10); t(`${sz} Sika Air: 10 m3 gives 0.5 L to 1.5 L`, /500 mL to 1\.5 L|0\.5 L to 1\.5 L/.test(await page.locator('#calc-out').innerText()), await page.locator('#calc-out').innerText());
  // the old flow is unchanged: an area product
  await page.goto(s.base + '#/product/davco-grey-one-potadhesive', { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy]) #calc-out'); await page.waitForTimeout(300);
  t(`${sz} area product: Area box still there, no cement box`, (await page.locator('#calc-area').count()) === 1 && (await page.locator('#calc-cement').count()) === 0);
  await type(page, '#calc-area', 20); const o2 = await page.locator('#calc-out').innerText();
  t(`${sz} area product: 20 m2 still gives 26.67 L and 3 x 10 L`, o2.includes('26.67 L') && /3 x 10 L/.test(o2), o2.slice(0, 300));
  t(`${sz} area product: estimate sentence`, (await page.locator('.finder-calc').innerText()).includes(EST));
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); t(`${sz} no horizontal scroll`, ov <= 1, ov);
  t(`${sz} no console errors`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await b.close(); s.close(); console.log(fails ? `DOSAGE BROWSER ${fails} failed` : 'DOSAGE BROWSER GREEN'); process.exit(fails ? 1 : 0);
