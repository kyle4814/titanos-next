// Regression tests for how a visitor SELECTS a command in the advisor (apply/assistant-cmd, 2026-10-31): the "/ commands" chip, the slash list, chips under answers, buttons under older answers.
// Run with Windows node + Windows Chrome like e2e_actions.mjs: node.exe e2e_cmdsel.mjs [portalDir]. Each size runs with touch emulation on the phone.
import { serve, launch } from './_browser.mjs';
import { PORTAL } from './_benv.mjs';
import { SIZES, openPage, openPanel, settle, botText, ask, press, counts } from './_sim.mjs';
const s = await serve(process.argv[2] || PORTAL); const b = await launch(); let fails = 0, passes = 0;
const t = (n, ok, d = '') => { if (ok) passes++; else fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d !== '' ? ' :: ' + String(d).slice(0, 260) : '')); };
const listShown = (page) => page.locator('#slash-list:not([hidden])').count();
for (const [W, H] of SIZES) {
  const sz = `${W}x${H}`;
  const { ctx, page, errs, touch } = await openPage(b, s.base, W, H); await openPanel(page);
  // C1: the "/ commands" chip opens the list and it STAYS open (the input blur timer used to close it 120 ms later)
  await press(touch, page.locator('.asst-sugg .chip', { hasText: '/ commands' })); await page.waitForTimeout(500);
  t(`${sz} C1 "/ commands" chip: list still open after 500 ms`, (await listShown(page)) === 1, await listShown(page));
  t(`${sz} C1 chip leaves "/" in the box and focus in the box`, (await page.inputValue('#asst-q')) === '/' && (await page.evaluate(() => document.activeElement.id)) === 'asst-q');
  // C3: arrow keys keep the highlighted command inside the visible part of the list
  const inView = () => page.evaluate(() => { const l = document.getElementById('slash-list'), on = l.querySelector('li.on'); if (!on) return 'none'; const a = l.getBoundingClientRect(), r = on.getBoundingClientRect(); return r.top >= a.top - 1 && r.bottom <= a.bottom + 1; });
  await page.fill('#asst-q', ''); await page.fill('#asst-q', '/'); await page.waitForSelector('#slash-list:not([hidden])');
  let bad = [];
  for (let i = 0; i < 20; i++) { await page.keyboard.press('ArrowDown'); const v = await inView(); if (v !== true) bad.push('down' + i); }
  t(`${sz} C3 ArrowDown x20: highlighted command always visible`, bad.length === 0, bad.join(','));
  bad = []; for (let i = 0; i < 20; i++) { await page.keyboard.press('ArrowUp'); const v = await inView(); if (v !== true) bad.push('up' + i); }
  t(`${sz} C3 ArrowUp x20 (wraps to the last): highlighted command always visible`, bad.length === 0, bad.join(','));
  // C7: Shift+Tab leaves the box, it does not pick a command
  await page.fill('#asst-q', '/'); await page.waitForSelector('#slash-list:not([hidden])'); await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(300);
  t(`${sz} C7 Shift+Tab does not pick a command`, (await page.inputValue('#asst-q')) === '/', await page.inputValue('#asst-q'));
  await page.fill('#asst-q', ''); await page.locator('#asst-q').focus();
  // C2: a command sent with Enter or Send leaves no stale list behind
  const n0 = await page.locator('.msg--bot').count();
  await page.fill('#asst-q', '/help'); await page.waitForSelector('#slash-list:not([hidden])'); await page.keyboard.press('Enter'); await settle(page, n0);
  t(`${sz} C2 Enter on a full command: list closed, box empty, aria-expanded false`, (await listShown(page)) === 0 && (await page.inputValue('#asst-q')) === '' && (await page.getAttribute('#asst-q', 'aria-expanded')) === 'false', `${await listShown(page)} ${await page.getAttribute('#asst-q', 'aria-expanded')}`);
  const n1 = await page.locator('.msg--bot').count();
  await page.fill('#asst-q', '/recent'); await page.waitForSelector('#slash-list:not([hidden])'); await press(touch, page.locator('.asst-form button[type=submit]')); await settle(page, n1);
  t(`${sz} C2 Send button on a full command: list closed`, (await listShown(page)) === 0 && (await page.getAttribute('#asst-q', 'aria-expanded')) === 'false');
  // C4: one activation = one question, even on a double click / double tap
  const c0 = await counts(page);
  const chip = page.locator('.asst-sugg .chip').nth(1);
  if (touch) await page.evaluate(async () => { const c = document.querySelectorAll('.asst-sugg .chip')[1]; c.click(); await new Promise((r) => setTimeout(r, 150)); c.click(); }); /* two taps 150 ms apart, timed inside the page so a busy machine cannot stretch the gap */ else await chip.dblclick();
  await settle(page, c0.bot); await page.waitForTimeout(1500);
  const c1 = await counts(page);
  t(`${sz} C4 double activation of an example chip sends ONE question`, c1.user - c0.user === 1 && c1.bot - c0.bot === 1, `user +${c1.user - c0.user} bot +${c1.bot - c0.bot}`);
  t(`${sz} C4 typing indicator gone`, c1.typing === 0);
  // C5: a notch chip left under an old answer must not bend a newer job for another product
  await ask(page, 'How much Davco Grey One Pot adhesive for 20 m2?');
  const oldChip = page.locator('.action-card[data-kind=clarify] .chip', { hasText: '6 mm notch' }).last();
  t(`${sz} C5 notch question has its chip`, (await oldChip.count()) === 1);
  const second = await ask(page, 'How much SikaCeram-690 Elite for 15 m2?');
  t(`${sz} C5 second job answered`, /SIKACERAM-690 ELITE/i.test(second), second.slice(0, 80));
  const n2 = await page.locator('.msg--bot').count(); await press(touch, oldChip); await settle(page, n2);
  const staleAns = await botText(page);
  t(`${sz} C5 old notch chip answers the DAVCO job, not SikaCeram`, /DAVCO GREY ONE POT/i.test(staleAns.slice(0, 80)) && /6 mm notch/.test(staleAns), staleAns.slice(0, 160));
  // C6: buttons under an older answer act on THAT answer
  await ask(page, 'How much Davco Grey One Pot adhesive for 25 m2 with a 6 mm notch?');
  const cardA = page.locator('.action-card[data-kind=quantity]').filter({ hasText: /Davco Grey One Pot/i }).last();
  t(`${sz} C6 older quantity card present`, (await cardA.count()) === 1);
  await ask(page, 'How much SikaCeram-690 Elite for 30 m2?');
  let n3 = await page.locator('.msg--bot').count(); await press(touch, cardA.locator('.chip', { hasText: 'Save to my project' })); await settle(page, n3);
  const sv = await botText(page); t(`${sz} C6 Save under the Davco card saves the Davco quantity`, /Quantity for Davco Grey One Pot/i.test(sv) && !/SikaCeram/i.test(sv), sv.slice(0, 160));
  n3 = await page.locator('.msg--bot').count(); await press(touch, cardA.locator('.chip', { hasText: 'project pack' })); await settle(page, n3);
  const pk = await botText(page); t(`${sz} C6 Make a project pack under the Davco card is the Davco pack`, /PROJECT PACK: DAVCO GREY ONE POT/i.test(pk.slice(0, 60)), pk.slice(0, 120));
  n3 = await page.locator('.msg--bot').count(); await press(touch, cardA.locator('.chip', { hasText: 'Export CSV or print' })); await settle(page, n3);
  const ex = await botText(page); t(`${sz} C6 Export under the Davco card exports the Davco card`, /EXPORT: QUANTITY FOR DAVCO GREY ONE POT/i.test(ex.slice(0, 60)), ex.slice(0, 120));
  await page.evaluate(() => { window.__printed = null; window.print = () => { const p = document.getElementById('actions-print'); window.__printed = p ? p.innerText : 'no print box'; }; });
  await press(touch, page.locator('.action-card[data-kind=export]').last().locator('.chip', { hasText: 'Print this result' })); await page.waitForTimeout(300);
  const pr = await page.evaluate(() => window.__printed); t(`${sz} C6 Print this result prints the exported (Davco) card`, /Davco Grey One Pot/i.test(pr || '') && !/SikaCeram/i.test(pr || ''), String(pr).slice(0, 120));
  // C8: the command rows of the /help answer: each Use button names its command, one tap sends exactly that command
  await ask(page, '/help'); { const uses = page.locator('.action-card[data-kind=help]').last().locator('.chip[data-command]'); const names = await uses.evaluateAll((a) => a.map((x) => x.getAttribute('aria-label') || x.textContent));
    t(`${sz} C8 help card Use buttons have distinct accessible names`, names.length >= 15 && new Set(names).size === names.length, names.slice(0, 3).join(','));
    const c0 = await counts(page); await uses.nth(1).scrollIntoViewIfNeeded(); await press(touch, uses.nth(1)); await settle(page, c0.bot); const c1 = await counts(page);
    t(`${sz} C8 one tap on Use sends exactly one /system`, c1.user - c0.user === 1 && c1.bot - c0.bot === 1 && (await page.locator('.msg--user').last().innerText()) === '/system'); }
  t(`${sz} no console errors or warnings`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await b.close(); s.close(); console.log(`CMDSEL E2E: ${passes} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
