// T09 ACCEPT, browser part: the "Can I use this on or over...?" panel.
import { launch, BASE, newTally, ready } from '../browser.mjs';
const T = newTally('t09_browser');
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const external = []; const errors = [];
await ctx.route('**/*', (r) => { const u = new URL(r.request().url()); if (u.host === new URL(BASE).host || u.protocol === 'data:') return r.continue(); external.push(u.href); return r.abort(); });
const page = await ctx.newPage();
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
await page.goto(BASE + '#/product/davco-grey-one-potadhesive'); await ready(page); await page.waitForSelector('.finder-cani');
const chips = page.locator('.finder-cani button[data-id]');
T.ok('twelve chips, all buttons', (await chips.count()) === 12);
const verdict = async (id) => { await page.click(`.finder-cani button[data-id="${id}"]`); await page.waitForTimeout(120); return page.locator('#cani-out').innerText(); };
let o = await verdict('concrete'); T.ok('concrete: NO with the exclusion quoted', /NO/.test(o) && /not suitable for tiling over concrete/.test(o), o);
T.ok('concrete chip is aria-pressed', (await page.getAttribute('.finder-cani button[data-id="concrete"]', 'aria-pressed')) === 'true' && (await page.locator('.finder-cani button[aria-pressed="true"]').count()) === 1);
o = await verdict('existing-tiles'); T.ok('existing tiles: NO', /NO/.test(o));
o = await verdict('membrane'); T.ok('waterproofing membrane: NO', /NO/.test(o));
o = await verdict('plasterboard'); T.ok('plasterboard: YES quoting plasterboard', /YES/.test(o) && /plasterboard/.test(o));
o = await verdict('fibre-cement'); T.ok('fibre cement sheet: YES', /YES/.test(o));
o = await verdict('render-brick'); T.ok('render or brick: YES quoting "rendered brickwork and blockwork"', /YES/.test(o) && /rendered brickwork and blockwork/.test(o));
o = await verdict('external'); T.ok('external: NO quoting "suitable for use on internal applications only"', /NO/.test(o) && /suitable for use on internal applications only/.test(o));
o = await verdict('heated-floor'); T.ok('heated floor: NOT STATED with a hand-off, and no quote or "probably"', /NOT STATED/.test(o) && /Ask Technical Services/.test(o) && !/probably/i.test(o) && !/“/.test(o), o);
o = await verdict('timber'); T.ok('timber: NOT STATED', /NOT STATED/.test(o));
T.ok('verdict shows an icon and a word, not colour alone', (await page.locator('#cani-out svg').count()) >= 1 && /NOT STATED|YES|NO/.test(o));
T.ok('a quoted verdict carries a source link and status chip', (await verdict('concrete'), (await page.locator('#cani-out a[href^="https://aus.sika.com"]').count()) === 1 && /From the published product page/.test(await page.locator('#cani-out').innerText())));
// keyboard: tab to a chip and press Space
await page.locator('.finder-cani button[data-id="internal"]').focus(); await page.keyboard.press('Space'); await page.waitForTimeout(150);
T.ok('keyboard: Space on a focused chip selects it and shows the verdict', (await page.getAttribute('.finder-cani button[data-id="internal"]', 'aria-pressed')) === 'true' && /YES/.test(await page.locator('#cani-out').innerText()));
T.ok('verdict is announced in the live region', /Internal: YES/.test(await page.locator('#live').innerText()), await page.locator('#live').innerText());
// a non tile product has no panel
await page.goto(BASE + '#/product/sika-mix'); await ready(page); await page.waitForSelector('.finder-calc, .finder-panels');
T.ok('non tile product has no can-I-use panel', (await page.locator('.finder-cani').count()) === 0);
// phone
const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p3 = await c3.newPage();
await p3.goto(BASE + '#/product/davco-grey-one-potadhesive'); await ready(p3); await p3.waitForSelector('.finder-cani');
const ov = await p3.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
T.ok('no horizontal scroll at 390 px', ov.sw <= ov.cw + 1, JSON.stringify(ov));
T.ok('no external requests', external.length === 0, external.join(' '));
T.ok('no console errors', errors.length === 0, errors.join(' | '));
await b.close();
T.done();
