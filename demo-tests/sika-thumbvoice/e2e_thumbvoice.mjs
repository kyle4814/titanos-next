// Thumb bar and device voice input (charter rows sika-mobile-thumbbar, sika-voice-phone). Windows node + Windows Chrome:
//   node.exe e2e_thumbvoice.mjs [portalDir]
// Phone 390x844 with touch: four bar targets of 44 px or more, each goes or opens the right thing, live Project badge, no content hidden, the
// assistant sheet does not collide with the bar. Desktop 1366: no bar. Voice: a fake SpeechRecognition is injected; with none, no voice control exists.
import { serve, launch } from '../sika-actions/_browser.mjs';
import { PORTAL } from '../sika-actions/_benv.mjs';
const s = await serve(process.argv[2] || PORTAL); const b = await launch(); let fails = 0, passes = 0;
const t = (n, ok, d = '') => { if (ok) passes++; else fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d ? ' :: ' + String(d).slice(0, 300) : '')); };
const KEY = 'sika-demo-210c0c-voice';
const FAKE = (mode) => `(() => { const MODE = ${JSON.stringify(mode)};
  class SR { constructor() { this.lang = ''; window.__srInstances = (window.__srInstances || 0) + 1; window.__srLast = this; }
    start() { window.__srStarts = (window.__srStarts || 0) + 1; window.__srLang = this.lang; setTimeout(() => {
      if (MODE === 'ok') { const r = [{ transcript: 'epoxy grout for a shower floor', confidence: 0.9 }]; r.isFinal = true; this.onresult && this.onresult({ resultIndex: 0, results: [r] }); }
      else if (MODE === 'denied') this.onerror && this.onerror({ error: 'not-allowed' });
      else if (MODE === 'nospeech') this.onerror && this.onerror({ error: 'no-speech' });
      this.onend && this.onend(); }, 60); }
    stop() {} abort() {} }
  window.SpeechRecognition = SR; window.webkitSpeechRecognition = SR; })();`;
async function open(W, H, { init, hash = '#/' } = {}) {
  const phone = W < 600; const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: phone, hasTouch: phone });
  const page = await ctx.newPage(); const errs = [];
  if (init) await page.addInitScript(init);
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(s.base + hash, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(400);
  return { ctx, page, errs };
}
const box = (page, sel) => page.locator(sel).first().boundingBox();

// ---- thumb bar, phone
{
  const { ctx, page, errs } = await open(390, 844);
  const bar = page.locator('nav.mbar');
  t('phone: bar is visible', await bar.isVisible());
  const labels = ['Search', 'Ask', 'Project', 'Sheets'];
  const items = bar.locator('> a, > button');
  t('phone: exactly four targets', (await items.count()) === 4, await items.count());
  for (let i = 0; i < 4; i++) {
    const it = items.nth(i); const bb = await it.boundingBox(); const txt = (await it.innerText()).replace(/\s+/g, ' ');
    t(`phone: target ${labels[i]} text`, txt.includes(labels[i]), txt);
    t(`phone: target ${labels[i]} is 44 px or more (${bb && Math.round(bb.width)}x${bb && Math.round(bb.height)})`, bb && bb.width >= 44 && bb.height >= 44);
  }
  const bb = await bar.boundingBox();
  t('phone: bar is pinned to the bottom edge', Math.abs(bb.y + bb.height - 844) <= 1, JSON.stringify(bb));
  t('phone: bar has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  // routes
  await items.nth(0).click(); await page.waitForTimeout(400); t('phone: Search goes to the finder', /#\/products/.test(page.url()), page.url());
  await page.goto(s.base + '#/'); await page.waitForSelector('main:not([aria-busy])');
  await items.nth(2).click(); await page.waitForTimeout(400); t('phone: Project goes to my projects', /#\/projects/.test(page.url()), page.url());
  await items.nth(3).click(); await page.waitForTimeout(400); t('phone: Sheets goes to the system selector', /#\/selector/.test(page.url()), page.url());
  // badge
  const badge = bar.locator('.count-pill');
  t('phone: Project badge present and 0 on a fresh browser', (await badge.count()) === 1 && (await badge.innerText()).trim() === '0', await badge.count());
  await page.goto(s.base + '#/products'); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(300);
  await page.locator('main a[href^="#/product/"]').first().click(); await page.waitForSelector('button:has-text("Add to project")'); await page.locator('button:has-text("Add to project")').first().click(); await page.waitForTimeout(300);
  t('phone: Project badge counts the added item live', (await badge.innerText()).trim() === '1', await badge.innerText());
  t('phone: badge is in the accessible name', /1/.test((await items.nth(2).getAttribute('aria-label')) || ''), await items.nth(2).getAttribute('aria-label'));
  // content not hidden: scroll to the bottom, the last footer element must sit above the bar
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(200);
  const bot = await page.evaluate(() => { const last = [...document.querySelectorAll('.footbar')].pop() || document.body; return last.getBoundingClientRect().bottom; });
  t('phone: the end of the page clears the bar', bot <= bb.y + 1, `page end ${Math.round(bot)} vs bar top ${Math.round(bb.y)}`);
  // Ask opens the sheet
  await page.goto(s.base + '#/'); await page.waitForSelector('main:not([aria-busy])');
  await items.nth(1).click(); await page.waitForSelector('#assistant.open'); await page.waitForTimeout(400);
  t('phone: Ask opens the assistant sheet', true);
  const geo = await page.evaluate(() => { const i = document.querySelector('#asst-q').getBoundingClientRect(); const cx = i.x + i.width / 2, cy = i.y + i.height / 2; const top = document.elementFromPoint(cx, cy); const m = document.querySelector('nav.mbar').getBoundingClientRect(); const mt = document.elementFromPoint(m.x + m.width / 2, m.y + m.height / 2); return { bottom: i.bottom, ih: innerHeight, inputOnTop: top && top.id === 'asst-q', barUnderSheet: !!(mt && mt.closest('#assistant')) }; });
  t('phone: sheet input is fully inside the viewport', geo.bottom <= geo.ih + 0.5, JSON.stringify(geo));
  t('phone: sheet input is not covered by the bar', geo.inputOnTop, JSON.stringify(geo));
  t('phone: the bar is under the open sheet, not over it', geo.barUnderSheet, JSON.stringify(geo));
  t('phone: no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}
// ---- desktop 1366: nothing new renders
{
  const { ctx, page } = await open(1366, 768);
  const r = await page.evaluate(() => { const n = document.querySelector('nav.mbar'); return n ? { display: getComputedStyle(n).display, h: n.getBoundingClientRect().height } : null; });
  t('desktop 1366: no bar rendered', !r || r.display === 'none' || r.h === 0, JSON.stringify(r));
  t('desktop 1366: no extra bottom padding on the body', await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom) === 0), await page.evaluate(() => getComputedStyle(document.body).paddingBottom));
  const triad = await page.locator('.triad .tri').allInnerTexts();
  t('desktop 1366: header triad unchanged', triad.map((x) => x.trim()).join('|') === 'Find a Product|SDS & TDS|Advisor', triad.join('|'));
  t('desktop 1366: voice is off by default and its mic is not shown', !(await page.locator('#asst-mic').isVisible().catch(() => false)));
  await ctx.close();
}
// ---- voice: no SpeechRecognition => absent
{
  const { ctx, page } = await open(390, 844, { init: 'delete window.SpeechRecognition; delete window.webkitSpeechRecognition;' });
  await page.locator('nav.mbar > button').first().click(); await page.waitForSelector('#assistant.open');
  t('voice: no SpeechRecognition => no toggle in the DOM', (await page.locator('#asst-voice-toggle').count()) === 0);
  t('voice: no SpeechRecognition => no mic button in the DOM', (await page.locator('#asst-mic').count()) === 0);
  t('voice: the send form is intact without voice', (await page.locator('#assistant form.asst-form button[type=submit]').count()) === 1);
  await ctx.close();
}
// ---- voice: fake engine
{
  const { ctx, page, errs } = await open(390, 844, { init: FAKE('ok') });
  await page.locator('nav.mbar > button').first().click(); await page.waitForSelector('#assistant.open'); await page.waitForTimeout(300);
  const tog = page.locator('#asst-voice-toggle'); const mic = page.locator('#asst-mic');
  t('voice: toggle appears when the browser has SpeechRecognition', (await tog.count()) === 1 && await tog.isVisible());
  t('voice: OFF by default (pressed=false, no stored value)', (await tog.getAttribute('aria-pressed')) === 'false' && (await page.evaluate((k) => localStorage.getItem(k), KEY)) === null);
  t('voice: mic is hidden while off', !(await mic.isVisible().catch(() => false)));
  const note = (await page.locator('#assistant').innerText());
  t('voice: the device-only wording is on the panel', /nothing leaves your device except what your browser's own speech service does/i.test(note));
  await tog.click(); await page.waitForTimeout(200);
  t('voice: one tap enables (pressed=true, mic visible)', (await tog.getAttribute('aria-pressed')) === 'true' && await mic.isVisible());
  t('voice: choice is persisted under the demo key prefix', (await page.evaluate((k) => localStorage.getItem(k), KEY)) === 'on');
  const mb = await mic.boundingBox(); t(`voice: mic target is 44 px or more (${Math.round(mb.width)}x${Math.round(mb.height)})`, mb.width >= 44 && mb.height >= 44);
  const before = await page.locator('.msg--user').count();
  await mic.click(); await page.waitForFunction(() => document.querySelector('#asst-q').value.length > 0, null, { timeout: 5000 }).catch(() => {});
  t('voice: transcript fills the input', (await page.inputValue('#asst-q')) === 'epoxy grout for a shower floor', await page.inputValue('#asst-q'));
  t('voice: listens in en-AU', (await page.evaluate(() => window.__srLang)) === 'en-AU', await page.evaluate(() => window.__srLang));
  await page.waitForTimeout(600);
  t('voice: no auto-send', (await page.locator('.msg--user').count()) === before && (await page.inputValue('#asst-q')).length > 0);
  await page.keyboard.press('Enter'); await page.waitForFunction((n) => document.querySelectorAll('.msg--user').length > n, before, { timeout: 8000 }).catch(() => {});
  t('voice: the user sends it, then it goes through the normal path', (await page.locator('.msg--user').last().innerText()).includes('epoxy grout'));
  t('voice: no page errors', errs.length === 0, errs.join(' | '));
  // persistence across reload
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.locator('nav.mbar > button').first().click(); await page.waitForSelector('#assistant.open'); await page.waitForTimeout(300);
  t('voice: stays enabled after a reload', await page.locator('#asst-mic').isVisible());
  await page.locator('#asst-voice-toggle').click(); await page.waitForTimeout(150);
  t('voice: one tap turns it off again', !(await page.locator('#asst-mic').isVisible()) && (await page.evaluate((k) => localStorage.getItem(k), KEY)) !== 'on');
  await ctx.close();
}
for (const [mode, re, name] of [['denied', /permission/i, 'permission denied'], ['nospeech', /no speech/i, 'no speech']]) {
  const { ctx, page } = await open(390, 844, { init: FAKE(mode) + `localStorage.setItem(${JSON.stringify(KEY)}, 'on');` });
  await page.locator('nav.mbar > button').first().click(); await page.waitForSelector('#assistant.open'); await page.waitForTimeout(300);
  await page.locator('#asst-mic').click(); await page.waitForTimeout(500);
  const msg = page.locator('#asst-voice-msg'); const txt = (await msg.innerText().catch(() => '')).trim();
  t(`voice: ${name} shows one plain line`, re.test(txt) && !txt.includes('\n'), txt);
  t(`voice: ${name} leaves the input empty`, (await page.inputValue('#asst-q')) === '');
  await ctx.close();
}
console.log(`THUMBVOICE E2E: ${passes} passed, ${fails} failed`);
await b.close(); s.close(); process.exit(fails ? 1 : 0);
