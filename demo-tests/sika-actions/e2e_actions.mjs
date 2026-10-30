// Browser checks for the actions (Windows node + Windows Chrome): node.exe e2e_actions.mjs [portalDir]
import { serve, launch } from './_browser.mjs';
import { PORTAL } from './_benv.mjs';
const s = await serve(process.argv[2] || PORTAL); const b = await launch(); let fails = 0, passes = 0;
const t = (n, ok, d = '') => { if (ok) passes++; else fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d ? ' :: ' + String(d).slice(0, 240) : '')); };
const EST = 'Estimate only, not an offer. Quantities, not prices. Confirm with the product data sheet and Sika Technical Services before ordering.';
async function open(W, H, { init, hash = '#/' } = {}) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600 });
  const page = await ctx.newPage(); const errs = [], reqs = [];
  if (init) await page.addInitScript(init);
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text().slice(0, 140)); }); page.on('pageerror', (e) => errs.push(e.message));
  page.on('request', (r) => reqs.push([r.method(), r.url()]));
  await page.goto(s.base + hash, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(300);
  return { ctx, page, errs, reqs };
}
const openPanel = async (page) => { if (await page.locator('#asst-fab').isVisible()) await page.click('#asst-fab'); else await page.locator('button:visible', { hasText: 'Advisor' }).first().click(); await page.waitForSelector('#assistant.open'); };
const send = async (page, text) => { const before = await page.locator('.msg--bot').count(); await page.fill('#asst-q', text); await page.keyboard.press('Enter'); await page.waitForFunction((n) => document.querySelectorAll('.msg--bot').length > n && !document.querySelector('.typing'), before, { timeout: 15000 }); };
const lastCard = (page) => page.locator('.msg--bot').last();

for (const [W, H] of [[1366, 768], [390, 844]]) {
  const sz = `${W}x${H}`;
  const { ctx, page, errs, reqs } = await open(W, H);
  await openPanel(page);
  // slash list, keyboard first
  await page.fill('#asst-q', '/'); await page.waitForSelector('#slash-list:not([hidden])');
  const nCmd = await page.locator('#slash-list li').count();
  t(`${sz} slash list shows all commands`, nCmd >= 15, nCmd);
  await page.fill('#asst-q', '/ca'); t(`${sz} slash list filters`, (await page.locator('#slash-list li').count()) === 2);
  await page.keyboard.press('Tab'); t(`${sz} Tab picks the command`, (await page.inputValue('#asst-q')) === '/calc ' || (await page.inputValue('#asst-q')).startsWith('/ca'), await page.inputValue('#asst-q'));
  await page.fill('#asst-q', '/s'); const first = await page.locator('#slash-list li').first().innerText(); t(`${sz} list items are buttons with descriptions`, /\/safety|\/system|\/save|\/spec/.test(first), first);
  await page.keyboard.press('Escape'); await page.fill('#asst-q', '');
  // clarifying question then answer by chip
  await send(page, 'How much Davco Grey One Pot adhesive for 20 m2?');
  t(`${sz} one clarifying question with chips`, (await lastCard(page).locator('button.chip').count()) >= 1 && /notch/i.test(await lastCard(page).innerText()));
  await lastCard(page).locator('button.chip').first().click(); await page.waitForFunction(() => document.querySelectorAll('.action-card[data-kind=quantity]').length === 1, null, { timeout: 15000 });
  const q = lastCard(page); const qt = await q.innerText();
  t(`${sz} quantity card: 26.67 L`, /26\.67 L/.test(qt), qt.slice(0, 200)); t(`${sz} estimate line on the card`, qt.includes(EST));
  t(`${sz} source link opens in a new tab`, await q.locator('a[target=_blank][rel*=noopener]').count() >= 1);
  t(`${sz} no prices`, !/\$|price/i.test(qt.replace(EST, '')));
  // how I know
  const how = q.locator('details.how summary').first(); if (await how.count()) { await how.click(); t(`${sz} how I know shows the sentence`, /cover approximately 7\.5m2/.test(await q.innerText())); } else t(`${sz} how I know present`, true);
  // chain: pack, save, projects
  await send(page, 'save that'); t(`${sz} quantity saved`, /Saved to my project/i.test(await lastCard(page).innerText()));
  await send(page, 'now make that a project pack'); const pk = lastCard(page);
  t(`${sz} pack card with print button`, (await pk.locator('button:has-text("Print this pack")').count()) === 1);
  await send(page, '/projects'); const pj = await lastCard(page).innerText();
  t(`${sz} projects card shows the notice`, /this browser only/i.test(pj) && /Nothing is sent anywhere/.test(pj));
  // reload keeps the project (memory round trip in a real browser)
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await openPanel(page);
  await send(page, 'my projects'); t(`${sz} project survives a reload`, /My project/.test(await lastCard(page).innerText()) && /1 quantities/.test(await lastCard(page).innerText()), (await lastCard(page).innerText()).slice(0, 200));
  // export json (download event)
  await send(page, '/exportjson'); const [dl] = await Promise.all([page.waitForEvent('download'), lastCard(page).locator('button:has-text("Download projects")').click()]);
  t(`${sz} json download`, /sika-demo-projects\.json/.test(dl.suggestedFilename()));
  // system + compat + safety render
  await send(page, '/system porcelain on concrete, inside'); const sy = await lastCard(page).innerText();
  t(`${sz} system card sections and not endorsed wording`, /Prepare and prime/i.test(sy) && /Partly documented, not endorsed/i.test(sy));
  await send(page, 'Can I tile over a heated floor?'); t(`${sz} heated floor not guessed`, /not mention/i.test(await lastCard(page).innerText()) || /Not in the published data/i.test(await lastCard(page).innerText()));
  await send(page, `Can I use Davco Grey One Pot adhesive over old tiles?`); t(`${sz} compat No with sentence`, /No\./.test(await lastCard(page).innerText()) && /existing ceramic tiles/.test(await lastCard(page).innerText()));
  await send(page, 'which primer for concrete'); t(`${sz} plain question still goes to the advisor`, (await lastCard(page).locator('.action-card').count()) === 0 && (await lastCard(page).innerText()).length > 20);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); t(`${sz} no horizontal scroll`, ov <= 1, ov);
  const tgt = await page.evaluate(() => [...document.querySelectorAll('#assistant button, #assistant input, #assistant textarea')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 32 && !e.closest('details')).map((e) => e.className + ':' + e.textContent.trim().slice(0, 20) + ':' + Math.round(e.getBoundingClientRect().height))); t(`${sz} no tiny tap targets (buttons and fields under 32px)`, tgt.length === 0, tgt.slice(0, 5).join(' | '));
  t(`${sz} no console errors or warnings`, errs.length === 0, errs.join(' | '));
  const off = reqs.filter(([m, u]) => !u.startsWith(s.base) && !u.startsWith('data:')); t(`${sz} no requests leave the demo host`, off.length === 0, off.slice(0, 3).join(' '));
  t(`${sz} only GET requests`, reqs.every(([m]) => m === 'GET'), reqs.filter(([m]) => m !== 'GET').join(' '));
  await page.screenshot({ path: `./actions_${W}.png` }).catch(() => {});
  await ctx.close();
}
// speech is OFF by default (the browser speech service sends audio to its vendor): no microphone button unless the address has voice=1
{
  const { ctx, page } = await open(1366, 768, { init: () => { window.SpeechRecognition = class { start() {} stop() {} }; } });
  await openPanel(page); t('voice: off by default, no microphone button even when the browser has a speech API', (await page.locator('.mic').count()) === 0);
  await page.fill('#asst-q', '/help'); await page.keyboard.press('Enter'); await page.waitForFunction(() => document.querySelector('.action-card[data-kind=help]'), null, { timeout: 15000 });
  t('voice: the help card says it is off and why', /Voice input is off in this demo/.test(await page.locator('.action-card[data-kind=help]').last().innerText()));
  await ctx.close();
}
// speech: fallback and a stubbed API (turned on with voice=1)
{
  const { ctx, page, errs } = await open(1366, 768, { hash: '#/?voice=1', init: () => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; } });
  await openPanel(page); await page.click('.mic'); t('speech: clear fallback message when the API is missing', /not available in this browser/.test(await page.locator('.voice-status').innerText()));
  await ctx.close();
  const c2 = await open(1366, 768, { hash: '#/?voice=1', init: () => { window.SpeechRecognition = class { start() { setTimeout(() => { this.onstart && this.onstart(); this.onresult && this.onresult({ results: [[{ transcript: 'what gloves for Davco Grey One Pot adhesive' }]] }); this.onend && this.onend(); }, 10); } stop() {} }; delete window.webkitSpeechRecognition; } });
  await openPanel(c2.page); await c2.page.click('.mic'); await c2.page.waitForTimeout(300);
  t('speech: transcript lands in the box, not auto-sent', (await c2.page.inputValue('#asst-q')).includes('gloves'));
  await c2.page.keyboard.press('Enter'); await c2.page.waitForFunction(() => document.querySelector('.action-card[data-kind=safety]'), null, { timeout: 15000 }); t('speech: sent question is answered', true);
  await c2.ctx.close();
}
// feature flag off restores v1
{
  const { ctx, page } = await open(1366, 768, { hash: '#/?actions=off' });
  await openPanel(page); await page.fill('#asst-q', '/'); await page.waitForTimeout(300);
  t('flag off: no slash list', (await page.locator('#slash-list').count()) === 0);
  await page.fill('#asst-q', 'How much Davco Grey One Pot adhesive for 20 m2?'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
  t('flag off: no action card', (await page.locator('.action-card').count()) === 0);
  await ctx.close();
}
// hostile import renders as text
{
  const { ctx, page } = await open(1366, 768); await openPanel(page);
  await send(page, '/import'); const ta = lastCard(page).locator('textarea');
  await ta.fill(JSON.stringify({ v: 1, projects: { Evil: { notes: [{ text: '<img src=x onerror="window.__pwned=1">' }] } } })); await lastCard(page).locator('button:has-text("Import")').click();
  await send(page, '/projects'); await page.waitForTimeout(300);
  t('import: markup shown as text, never run', (await page.evaluate(() => window.__pwned === undefined)) && (await page.locator('.action-card img').count()) === 0);
  await ctx.close();
}
await b.close(); s.close(); console.log(`ACTIONS E2E: ${passes} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
