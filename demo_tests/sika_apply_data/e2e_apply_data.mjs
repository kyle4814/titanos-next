// Browser checks for the apply/data blocks (T03 T04 T15 T16 T20 T21). NOT RUN in the build that wrote it: no browser could be driven from that environment.
// usage: node e2e_apply_data.mjs <baseUrl>   (same setup as state/sika/e2e/e2e.mjs: playwright-core + Chrome; only the base host is reachable)
import { chromium } from 'playwright-core';
const base = (process.argv[2] || '').replace(/\/?$/, '/');
if (!/^https?:\/\//.test(base)) { console.error('usage: node e2e_apply_data.mjs <baseUrl>'); process.exit(2); }
const host = new URL(base).host; let fails = 0;
const rec = (name, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (d ? ' :: ' + String(d).slice(0, 200) : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--disable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
await ctx.route('**/*', (r) => { const u = new URL(r.request().url()); return u.host === host || u.protocol === 'data:' ? r.continue() : r.abort(); });
const page = await ctx.newPage(); const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', (e) => errs.push(e.message));
const ready = async () => { await page.waitForSelector('main:not([aria-busy])', { timeout: 30000 }); await page.waitForTimeout(200); };
const ask = async (q) => { await page.click('#asst-fab'); await page.fill('#asst-q', q); await page.press('#asst-q', 'Enter'); await page.waitForSelector('.msg--bot .chip-status', { timeout: 20000 }); await page.waitForTimeout(300); };

await page.goto(base, { waitUntil: 'load' }); await ready();
// T04
await ask('Can I use Davco Grey One Pot over my old tiles?');
const panel = page.locator('.assistant'); const msg = panel.locator('.msg--bot').last();
rec('T04 chip shown', /From a published data sheet/.test(await msg.innerText()));
await msg.locator('details.hik > summary').first().click();
const hik = await msg.locator('details.hik').first().innerText();
rec('T04 How I know quotes the sentence', /is not suitable for tiling over concrete, waterproofing membranes or existing ceramic tiles/.test(hik), hik);
rec('T04 link starts with https://aus.sika.com/', (await msg.locator('details.hik a').first().getAttribute('href')).startsWith('https://aus.sika.com/'));
rec('T04 no "signed" in advisor text', !/\bsigned\b/i.test(await panel.innerText()));
// T16
await ask('What PPE for Davco Grey One Pot?');
const t16 = await panel.locator('.msg--bot').last().innerText();
rec('T16 PPE answer quotes the SDS with date', /18\.11\.2025/.test(t16) && /Check the current SDS before use/.test(t16) && /gloves/i.test(t16), t16);
await page.keyboard.press('Escape');
await page.goto(base + '#/product/davco-grey-one-potadhesive?tab=safety', { waitUntil: 'load' }); await ready(); await page.waitForTimeout(500);
const safety = await page.locator('#tabpanel').innerText();
rec('T16 Safety tab shows revision date and SDS link', /18\.11\.2025/.test(safety) && (await page.locator('#tabpanel a[href$="sds-davco-grey-onepotadhesive.pdf"]').count()) === 1, safety.slice(0, 200));
// T15 / T21
await page.goto(base + '#/product/davco-grey-one-potadhesive?tab=rates', { waitUntil: 'load' }); await ready(); await page.waitForTimeout(300);
const rt = await page.locator('#tabpanel').innerText();
rec('T15 rate sentence with version and page', /cover approximately 7\.5m2/.test(rt) && /November 2023, Version 01\.02, page 2/.test(rt));
rec('T21 times: open 30 minutes, adjustability 15-25, wet area 7 days', /30 minutes at 22/.test(rt) && /15-25 minutes/.test(rt) && /minimum 7 days/.test(rt) && /Time not published/.test(rt));
// T20
await page.goto(base + '#/product/davco-smp-evo?tab=draftspec', { waitUntil: 'load' }); await ready(); await page.waitForSelector('#spec-text', { timeout: 10000 });
rec('T20 draft label', /Draft for editing\. Not approved by Sika\./.test(await page.inputValue('#spec-text')));
await page.click('text=Copy'); rec('T20 Copy puts the text on the clipboard', (await page.evaluate(() => navigator.clipboard.readText())).startsWith('Draft for editing'));
await page.goto(base + '#/system-data/ceramic-on-aac-internal-floor', { waitUntil: 'load' }); await ready(); await page.waitForSelector('#sheet-spec-text', { timeout: 10000 });
rec('T20 system draft specification has a clause per step', (await page.inputValue('#sheet-spec-text')).split('Supply and install').length > 3);
// T03
const failed = await (await fetch(base + 'data/doc_status.json')).json(); const docs = await (await fetch(base + 'data/documents.json')).json();
const bad = new Set(docs.filter((d) => failed[d.id] && failed[d.id].status !== 200).map((d) => d.url));
await page.goto(base + '#/documents', { waitUntil: 'load' }); await ready();
const hrefs = await page.locator('main a[href^="http"]').evaluateAll((a) => a.map((x) => x.href));
rec('T03 no failed document link is offered on page 1 of the library', !hrefs.some((h) => bad.has(h)));
rec('console clean', errs.length === 0, errs.join(' | '));
await browser.close(); process.exit(fails ? 1 : 0);
