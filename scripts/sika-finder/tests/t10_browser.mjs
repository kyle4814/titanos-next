// T10 ACCEPT: keepable system sheet. porcelain over concrete, internal floor, 12 m2.
import { launch, BASE, newTally, ready } from '../browser.mjs';
const T = newTally('t10_browser');
const URL1 = BASE + '#/sheet?tile=porcelain&sub=concrete&loc=internal-floor&m2=12';
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const external = []; const errors = [];
await ctx.route('**/*', (r) => { const u = new URL(r.request().url()); if (u.host === new URL(BASE).host || u.protocol === 'data:') return r.continue(); external.push(u.href); return r.abort(); });
const page = await ctx.newPage();
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
await page.goto(URL1); await ready(page);
const text1 = await page.locator('#sheet').innerText();
const rows = await page.locator('#sheet table tbody tr').count();
T.ok('at least three step rows', rows >= 3, rows);
const rowsWithUrl = await page.$$eval('#sheet table tbody tr', (trs) => trs.filter((tr) => [...tr.querySelectorAll('a[href]')].some((a) => /^https:\/\/aus\.sika\.com\//.test(a.href))).length);
const rowsNoProduct = await page.locator('#sheet table tbody tr:has(td[colspan])').count();
T.ok('at least three step rows carry a source URL, and every row with a product does', rowsWithUrl >= 3 && rowsWithUrl + rowsNoProduct === rows, `${rowsWithUrl} + ${rowsNoProduct} empty slots / ${rows}`);
T.ok('footer sentence present', text1.includes("Built from Sika Australia's public data sheets on 2026-10-30. Not an official Sika document. Technical Services decides suitability."));
T.ok('estimate line present on screen', text1.includes('Estimate only, not an offer. Quantities, not prices. Confirm with the product data sheet and Sika Technical Services before ordering.'));
T.ok('says demo built from published documentation', /demo/i.test(text1) && /public data sheets/.test(text1));
T.ok('no dollar prices', !/\$\s?\d/.test(text1));
T.ok('adhesive packs rounded up: 12 m2 of Ceramaflex = 1 x 20 kg', /1 x 20 kg/.test(text1), text1.match(/Packs[^\n]*/g));
T.ok('product with no rate says rate not published, ask Technical Services', text1.includes('Rate not published, ask Technical Services'));
T.ok('status chip words, never "approved" or "signed"', /From a published data sheet|From the published product page/.test(text1) && !/approved by|signed/i.test(text1));
await page.emulateMedia({ media: 'print' });
const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
T.ok('printed sheet is exactly one A4 page', pages === 1, 'pages=' + pages);
const printText = await page.evaluate(() => document.body.innerText);
T.ok('print view carries the estimate line', printText.includes('Estimate only, not an offer.'));
T.ok('print view hides site chrome', !(await page.locator('.site-header').isVisible()));
await page.emulateMedia({ media: 'screen' });
// the longest system (wet area floor, five steps) also prints on one page
const p4 = await ctx.newPage(); await p4.goto(BASE + '#/sheet?tile=porcelain&sub=concrete&loc=internal-wet-floor&m2=12.5&allow=10'); await ready(p4);
await p4.emulateMedia({ media: 'print' });
const pdf4 = await p4.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
const pages4 = (pdf4.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
T.ok('wet area sheet with allowance prints on one A4 page', pages4 === 1, 'pages=' + pages4);
await p4.close();
// a copied link restores the same sheet in a fresh context
const href = page.url();
const ctx2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p2 = await ctx2.newPage(); await p2.goto(href); await ready(p2);
const text2 = await p2.locator('#sheet').innerText();
T.ok('fresh context gives identical innerText', text1 === text2);
// phone width: no horizontal scroll
const ctx3 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p3 = await ctx3.newPage(); await p3.goto(href); await ready(p3);
const o = await p3.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
T.ok('no horizontal scroll at 390 px', o.sw <= o.cw + 1, JSON.stringify(o));
// unsupported combination says so
await page.goto(BASE + '#/sheet?tile=moisture-sensitive-stone&sub=concrete&loc=internal-floor&m2=5'); await ready(page);
T.ok('unsupported combination says the data does not support it', /does not support a complete system/.test(await page.locator('main').innerText()));
T.ok('no external requests', external.length === 0, external.join(' '));
T.ok('no console errors', errors.length === 0, errors.join(' | '));
await b.close();
T.done();
