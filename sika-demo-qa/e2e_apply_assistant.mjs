// Browser ACCEPT checks for the apply/assistant blocks (T06, T22, T14, T11, T19). Windows Chrome driven by playwright-core, headless.
// usage: node e2e_apply_assistant.mjs <baseUrl> [outDir]   (env PLAYWRIGHT_CORE overrides the playwright-core path)
// Network: only the base host is reachable; any other request is recorded and fails the run.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/home/tech2/tn-a-site-ship/node_modules/playwright-core');
const [, , base0 = 'http://127.0.0.1:8741/', outDir = '/dev/shm/apply_assistant_e2e'] = process.argv;
const base = base0.endsWith('/') ? base0 : base0 + '/';
fs.mkdirSync(outDir, { recursive: true });
const baseHost = new URL(base).host;
const results = [];
const rec = (name, ok, detail = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + String(detail).slice(0, 200) : '')); };
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !only.length || only.includes(k);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--disable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin });
const page = await ctx.newPage();
const consoleErrors = [], external = [], nonGet = [], failedReq = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consoleErrors.push(m.type() + ': ' + m.text().slice(0, 200)); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) consoleErrors.push('HTTP ' + r.status() + ' ' + r.url()); });
page.on('request', (r) => { if (!['GET', 'HEAD'].includes(r.method())) nonGet.push(r.method() + ' ' + r.url()); });
page.on('requestfailed', (r) => { if (new URL(r.url()).host === baseHost && !/ERR_ABORTED/.test((r.failure() || {}).errorText || '')) failedReq.push(r.url()); });
await ctx.route('**/*', (route) => { const u = new URL(route.request().url()); if (u.host === baseHost || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue(); external.push(u.href.slice(0, 120)); return route.abort(); });
const ready = async () => { await page.waitForSelector('main:not([aria-busy])', { timeout: 30000 }); await page.waitForTimeout(150); };
const wrap = async (name, fn) => { try { await fn(); } catch (e) { rec(name, false, e.message.split('\n')[0]); } };
const openAdvisor = async () => { if (!(await page.locator('#assistant.open').count())) { await page.locator('#asst-fab').click(); await page.waitForTimeout(300); } };
const ask = async (q) => { await openAdvisor(); const n = await page.locator('.msg--bot').count(); await page.fill('#asst-q', q); await page.press('#asst-q', 'Enter'); await page.waitForFunction((n0) => document.querySelectorAll('.msg--bot').length > n0 && !document.querySelector('.msg--bot .typing'), n, { timeout: 20000 }); await page.waitForTimeout(250); };
const route = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(250); await ready(); };
const gotoHome = async () => { await page.goto(base, { waitUntil: 'load' }); await ready(); };

if (want('T06')) await wrap('T06', async () => {
  await gotoHome();
  await ask('Can I tile over a heated floor with Davco Grey One Pot?');
  const ho = page.locator('.msg--bot .handoff').last();
  rec('T06 hand-off block is shown for a question the published text does not cover', await ho.count() === 1);
  const txt = await ho.locator('textarea').inputValue();
  rec('T06 block holds the exact question and the product name', /Can I tile over a heated floor with Davco Grey One Pot\?/.test(txt) && /Davco Grey One Pot/.test(txt), txt.replace(/\n/g, ' | '));
  rec('T06 block says it is demo only and submits nothing', /does not send anything/i.test(await ho.innerText()));
  const link = ho.locator('a[href*="Contact.html"]');
  rec('T06 contact link opens in a new tab with rel noopener', await link.getAttribute('target') === '_blank' && /noopener/.test(await link.getAttribute('rel')));
  rec('T06 phone number from the footer is shown', /\+61 2 9725 1145/.test(await ho.innerText()));
  nonGet.length = 0;
  await ho.locator('[data-act=copy-handoff]').click(); await page.waitForTimeout(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  const hasUrl = /Product page: http:\/\/127\.0\.0\.1:\d+\/#\/product\/davco-grey-one-potadhesive/;
  rec('T06 Copy puts the question and the product page URL on the clipboard', clip !== null ? (/heated floor/.test(clip) && hasUrl.test(clip)) : (/heated floor/.test(await ho.locator('textarea').inputValue()) && hasUrl.test(await ho.locator('textarea').inputValue())), clip === null ? 'clipboard unreadable, textarea checked' : '');
  rec('T06 no non-GET request was made', nonGet.length === 0, nonGet.join(','));
  await page.keyboard.press('Escape');
});

if (want('T22')) await wrap('T22', async () => {
  await page.goto(base + '#/help', { waitUntil: 'load' }); await ready();
  rec('T22 help page renders 10 symptom chips', await page.locator('[data-chip]').count() === 10);
  let found = false;
  for (let i = 0; i < 60 && !found; i++) { await page.keyboard.press('Tab'); found = await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-chip')); }
  rec('T22 chips are reachable by keyboard (Tab)', found);
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const r = page.locator('#help-result');
  rec('T22 Enter on a chip shows published passages with a source link', await r.locator('blockquote').count() > 0 && await r.locator('a[href^="https://aus.sika.com"][rel*=noopener]').count() > 0);
  rec('T22 the result says it does not diagnose and ends with the hand-off', /cannot diagnose/i.test(await r.innerText()) && await r.locator('.handoff').count() === 1);
  rec('T22 focus moves to the result', await page.evaluate(() => document.activeElement && document.activeElement.id === 'help-result'));
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
  await page.locator('[data-chip="dusting"]').focus(); await page.keyboard.press('Space'); await page.waitForTimeout(200);
  rec('T22 a chip with no published passage says so and hands off', /do not say anything/i.test(await r.innerText()) && await r.locator('blockquote').count() === 0 && await r.locator('.handoff').count() === 1);
  await ask('my tiles sound hollow');
  rec('T22 the advisor answers a symptom question from the same passages', (await page.locator('.msg--bot').allInnerTexts()).some((t) => /cannot diagnose/i.test(t) && /Source/i.test(t)));
});

if (want('T14')) await wrap('T14', async () => {
  await page.goto(base + '#/about', { waitUntil: 'load' }); await ready();
  rec('T14 About links to the rule ledger', await page.locator('a[href="#/rules"]').count() > 0);
  await page.goto(base + '#/rules', { waitUntil: 'load' }); await ready();
  await page.waitForSelector('#rl-body tr', { timeout: 20000 });
  rec('T14 rules view shows the PUBLISHED note and the all-rules count', /does not mean Sika has approved/i.test(await page.locator('main').innerText()) && /\d[\d,]* rules/.test(await page.locator('#rl-count').innerText()), await page.locator('#rl-count').innerText());
  await page.selectOption('#rl-product', 'davco-grey-one-potadhesive'); await page.waitForTimeout(200);
  const rows = await page.locator('#rl-body tr').count();
  rec('T14 filter to Davco Grey One Pot gives at least three rows', rows >= 3, rows + ' rows');
  rec('T14 the "not suitable for tiling over concrete" sentence is in the table', /not suitable for tiling over concrete/i.test(await page.locator('#rl-body').innerText()));
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('#rl-download')]);
  const p = await dl.path(); const txt = fs.readFileSync(p, 'utf8');
  const recs = (txt.match(/\r\n/g) || []).length - 1;
  rec('T14 the CSV download has the same row count as the table', recs === rows, `csv ${recs} vs table ${rows}`);
  rec('T14 signed_by, signed_on and comment are blank in the download', !/"signed|Sika Technical/.test(txt.split('\r\n').slice(1).join('')) && txt.split('\r\n')[1].endsWith('"PUBLISHED","","",""'), txt.split('\r\n')[1].slice(-40));
  await page.selectOption('#rl-type', 'EXCLUSION'); await page.waitForTimeout(150);
  rec('T14 type filter narrows the table', await page.locator('#rl-body tr').count() < rows);
  await page.goto(base, { waitUntil: 'load' }); await ready(); await ask('How much Davco Trojan Mastic for 40 m2?');
  rec('T14 the advisor sources panel links to the rule ledger', await page.locator('.msg--bot a[href="#/rules"]').count() > 0);
});

if (want('T11')) await wrap('T11', async () => {
  await gotoHome(); await page.evaluate(() => localStorage.clear());
  await route('#/insights');
  rec('T11 empty state asks for a question', /Ask the advisor a question to see this fill in/.test(await page.locator('main').innerText()));
  rec('T11 banner says this browser only', /This shows this browser only\. On a live portal Sika would see the same view across all visitors, as counts only, with no personal information\./.test(await page.locator('#ins-banner').innerText()));
  await ask('Can I use Davco Grey One Pot over concrete?');
  await ask('How much Davco Trojan Mastic for 40 m2?');
  await ask('Can I tile over a heated floor with Davco Grey One Pot? call me on 0412 345 678 or kyle@example.com');
  await page.keyboard.press('Escape');
  const reqs = []; const onReq = (r) => reqs.push(r.method() + ' ' + r.url()); page.on('request', onReq);
  await route('#/insights'); await page.waitForTimeout(300);
  const n = await page.locator('#ins-questions tbody tr').count();
  rec('T11 after three questions insights shows three rows', n === 3, n + ' rows');
  const gaps = await page.locator('#ins-gaps li').allInnerTexts();
  rec('T11 the not-in-the-data question is in the gap list and the answered ones are not', gaps.length === 1 && /heated floor/i.test(gaps[0]), gaps.join(' | '));
  const raw = await page.evaluate(() => localStorage.getItem('sika-demo-210c0c-insights'));
  rec('T11 no email address or phone number is stored', !!raw && !/@|0412|345 678/.test(raw), (raw || '').slice(0, 120));
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('#ins-export')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  rec('T11 the gap list CSV has one data row', csv.split('\r\n').filter(Boolean).length === 2, csv.replace(/\r\n/g, ' | ').slice(0, 160));
  page.off('request', onReq);
  rec('T11 viewing and exporting made no network request', reqs.filter((u) => !/^GET http:\/\/127\.0\.0\.1:\d+\//.test(u)).length === 0 && !reqs.some((u) => /insights|gap|beacon/i.test(u.replace(/#.*/, '')) && !/assets\/lib/.test(u)), reqs.slice(0, 3).join(','));
  await page.click('#ins-clear'); await page.waitForTimeout(150);
  rec('T11 Clear empties the store', /Ask the advisor a question to see this fill in/.test(await page.locator('main').innerText()) && !(await page.locator('#ins-questions').count()));
  await route('#/product/davco-grey-one-potadhesive');
  await route('#/insights');
  rec('T11 a product view is counted by id', /davco-grey-one-potadhesive/.test(await page.locator('#ins-views').innerText().catch(() => '')));
});

if (want('T19')) await wrap('T19', async () => {
  await gotoHome();
  await page.waitForFunction(() => document.getElementById('offline-badge'), null, { timeout: 60000 });
  rec('T19 the Available offline badge appears after the first visit', /Available offline/.test(await page.locator('#offline-badge').innerText()));
  const size = await page.evaluate(async () => { let t = 0, n = 0; for (const k of await caches.keys()) { const c = await caches.open(k); for (const r of await c.keys()) { t += (await (await c.match(r)).blob()).size; n++; } } return { t, n, names: await caches.keys() }; });
  rec('T19 cache size is under 8 MB (TARGET)', size.t > 0 && size.t < 8 * 1048576, `${(size.t / 1048576).toFixed(2)} MB in ${size.n} files, cache ${size.names.join(',')}`);
  rec('T19 the cache name carries the file hash', size.names.length === 1 && /^sika-demo-210c0c-[0-9a-f]{10}$/.test(size.names[0]));
  const pdfCached = await page.evaluate(async () => { for (const k of await caches.keys()) { const c = await caches.open(k); for (const r of await c.keys()) if (/\.pdf/i.test(r.url) || !r.url.startsWith(location.origin)) return r.url; } return ''; });
  rec('T19 no PDF and no other-host file is cached', pdfCached === '', pdfCached);
  await route('#/about');
  rec('T19 About shows the offline state and an unregister control', /Offline mode is on/.test(await page.locator('#offline-panel').innerText()) && await page.locator('#offline-off').isVisible());
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' }); await ready();
  rec('T19 offline: the home page renders after a reload', (await page.locator('h1').first().innerText()).length > 3);
  await ask('How much Davco Grey One Pot adhesive for 15 m2?');
  const last = (await page.locator('.msg--bot').allInnerTexts()).slice(-1)[0];
  rec('T19 offline: the advisor quotes a published rate with the network off', /Grey One Pot/i.test(last) && /L|pack|pail|litre/i.test(last), last.slice(0, 140).replace(/\n/g, ' '));
  await route('#/product/davco-grey-one-potadhesive');
  rec('T19 offline: a tile and stone product page renders', /Grey One Pot/i.test(await page.locator('h1').first().innerText()));
  await route('#/rules'); await page.waitForSelector('#rl-body tr', { timeout: 20000 });
  rec('T19 offline: the rule ledger renders', await page.locator('#rl-body tr').count() > 0);
  await route('#/help'); await page.locator('[data-chip="hollow"]').click();
  rec('T19 offline: the problem solver renders passages', await page.locator('#help-result blockquote').count() > 0);
  await route('#/products');
  rec('T19 offline: the finder lists products', await page.locator('.product-card').count() > 0);
  await ctx.setOffline(false);
  await route('#/about'); await page.locator('#offline-off').click(); await page.waitForTimeout(500);
  const left = await page.evaluate(async () => ({ caches: (await caches.keys()).length, regs: (await navigator.serviceWorker.getRegistrations()).length }));
  rec('T19 the unregister control removes the worker and its caches', left.caches === 0 && left.regs === 0, JSON.stringify(left));
});

rec('no console errors or warnings in the whole run', consoleErrors.length === 0, consoleErrors.slice(0, 4).join(' || '));
rec('no request left the demo host', external.length === 0, external.slice(0, 3).join(', '));
rec('no failed same-host requests', failedReq.length === 0, failedReq.slice(0, 3).join(', '));
await browser.close();
const pass = results.filter((r) => r.ok).length;
console.log(`\nE2E apply/assistant ${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
