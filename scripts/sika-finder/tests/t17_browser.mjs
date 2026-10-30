// T17 ACCEPT, browser part: the system finder page.
import { launch, BASE, newTally, ready } from '../browser.mjs';
const T = newTally('t17_browser');
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const external = []; const errors = [];
await ctx.route('**/*', (r) => { const u = new URL(r.request().url()); if (u.host === new URL(BASE).host || u.protocol === 'data:') return r.continue(); external.push(u.href); return r.abort(); });
const page = await ctx.newPage();
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
await page.goto(BASE + '#/system'); await ready(page); await page.waitForSelector('.finder-form');
T.ok('system finder is in the header meta bar', (await page.locator('.hdr-meta a', { hasText: 'System finder' }).count()) >= 1);
await page.goto(BASE); await ready(page); await page.waitForSelector('.helpbtns');
T.ok('home page has a System finder button', (await page.locator('.helpbtns a', { hasText: 'System finder' }).count()) === 1);
await page.goto(BASE + '#/system'); await ready(page); await page.waitForSelector('.finder-form');
// three selections reach the result; the third is made with the keyboard
await page.locator('#q-tile button[data-id="porcelain"]').click(); await page.waitForTimeout(250);
await page.locator('#q-sub button[data-id="concrete"]').click(); await page.waitForTimeout(250);
await page.locator('#q-loc button[data-id="internal-floor"]').focus(); await page.keyboard.press('Enter'); await page.waitForSelector('.finder-stepcard', { timeout: 8000 });
const steps = await page.locator('.finder-stepcard').count();
T.ok('three selections reach the result with at least three steps', steps >= 3, steps);
T.ok('the chips are buttons with aria-pressed', (await page.locator('#q-tile button[aria-pressed="true"]').count()) === 1);
const txt1 = await page.locator('#finder-result').innerText();
T.ok('adhesive card quotes the published sentence with a source link and chip', /Porcelain/.test(txt1) && /From the published product page|From a published data sheet/.test(txt1) && (await page.locator('.finder-opt a[href^="https://aus.sika.com"]').count()) >= 3);
T.ok('Ruled out by their own text lists Davco Grey One Pot with its quote', /Ruled out by their own text/.test(txt1) && /Grey One Pot[^\n]*not suitable for tiling over concrete/.test(txt1.replace(/\n/g, ' ').replace(/\s+/g, ' ')) , txt1.slice(-700));
T.ok('a slot with no published product says so', txt1.includes('I do not have a matching product in the published pages.'));
const url = page.url();
T.ok('the choice lives in the URL', /tile=porcelain/.test(url) && /sub=concrete/.test(url) && /loc=internal-floor/.test(url), url);
await page.reload(); await ready(page); await page.waitForSelector('.finder-stepcard');
T.ok('reloading the URL restores the result', (await page.locator('#finder-result').innerText()) === txt1);
// add to project, make my sheet, ask the advisor
await page.locator('.finder-opt button', { hasText: 'Add to project' }).first().click();
T.ok('Add to project works from a product card', (await page.locator('.finder-opt button[aria-pressed="true"]').count()) >= 1);
await page.fill('#f-m2', '12'); 
T.ok('Make my sheet link carries the system and the area', /sheet\?.*tile=porcelain.*m2=12/.test(await page.getAttribute('#f-sheet', 'href')));
await page.click('#f-sheet'); await page.waitForSelector('#sheet');
T.ok('Make my sheet opens the sheet for the same system', /Porcelain tiles on concrete/.test(await page.locator('#sheet h1').innerText()) && /Area 12 m2/.test(await page.locator('#sheet').innerText()));
await page.goBack(); await ready(page); await page.waitForSelector('#f-ask');
await page.click('#f-ask'); await page.waitForTimeout(600);
T.ok('Ask the advisor opens the advisor panel', (await page.locator('.assistant:visible, [role="dialog"]:visible').count()) >= 1);
// choosing another adhesive updates the sheet link
await page.keyboard.press('Escape');
// phone: no horizontal scroll
const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p3 = await c3.newPage();
await p3.goto(url); await ready(p3); await p3.waitForSelector('.finder-stepcard');
const o = await p3.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
T.ok('no horizontal scroll at 390 px', o.sw <= o.cw + 1, JSON.stringify(o));
// pair with no system
await page.goto(BASE + '#/system?tile=moisture-sensitive-stone&sub=concrete&loc=internal-floor'); await ready(page);
T.ok('an unsupported combination says the documentation does not support it', /does not support a complete system/.test(await page.locator('#finder-result').innerText()));
T.ok('no external requests', external.length === 0, external.join(' '));
T.ok('no console errors', errors.length === 0, errors.join(' | '));
await b.close();
T.done();
