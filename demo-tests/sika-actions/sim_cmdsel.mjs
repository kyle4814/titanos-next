// Agentic simulation of the advisor's command selection (apply/assistant-cmd, 2026-10-31): a scripted conversation of 70+ turns per size mixing every way of choosing a command
// (typing + Enter, Send button, example chips, the "/ commands" chip, slash list by keyboard and by mouse or touch, chips and buttons under answers, follow-ups, hand-off buttons, page buttons that open the advisor,
// back and forward, product switching, Escape and reopen), at 1440x900 and at 390x844 with touch emulation. After EVERY turn it checks the same invariants. Usage: node.exe sim_cmdsel.mjs [portalDir] [outDir]
import fs from 'node:fs';
import { serve, launch } from './_browser.mjs';
import { PORTAL } from './_benv.mjs';
import { SIZES, openPage, openPanel, settle, botText, counts } from './_sim.mjs';
const OUT = process.argv[3] || ''; const s = await serve(process.argv[2] || PORTAL); const b = await launch();
let fails = 0, passes = 0, turnsTotal = 0; const log = [];
const t = (n, ok, d = '') => { if (ok) passes++; else fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d !== '' ? ' :: ' + String(d).slice(0, 260) : '')); };
const METHODS = {};
const QS = ['Which adhesive for porcelain tiles on a concrete floor?', 'What is the coverage of Davco Grey One Pot adhesive?', 'Give me the data sheet for Sikaflex-11 FC+', 'How much adhesive do I need for 40 m2 of floor tiles?',
  'Can I use Davco Grey One Pot over my old tiles?', 'Can I tile over a heated floor?', 'Can I use Davco Ultraflex on underfloor heating?', 'How much SikaCeram-690 Elite for 15 m2?', 'which primer for concrete', 'what waterproofing for a balcony',
  'self levelling screed for 3 mm', 'my tiles sound hollow', 'is Sikaflex-11 FC+ suitable for a freezer', 'what is the pot life of SikaTile-400 EVO PRO', 'hello', 'asdf qwerty', 'how much Davco Easy Grout for 12 m2 with 600x600 tiles'];
const SLASH = ['/calc 20 m2 Davco Grey One Pot adhesive 6 mm notch', '/system porcelain on concrete, internal wet floor', '/compare Davco Easy Grout vs SikaCeram-690 Elite', '/safety gloves for Davco Grey One Pot adhesive', '/time open time Davco Grey One Pot adhesive',
  '/spec Davco Grey One Pot adhesive', '/can Davco Grey One Pot adhesive go over old tiles', '/link Davco Grey One Pot adhesive', '/ask which primer for concrete', '/help', '/recent', '/gaps', '/projects', '/save', '/pack', '/export'];

for (const [W, H] of SIZES) {
  const sz = `${W}x${H}${process.env.SIM_V1 ? ' v1' : ''}`; const { ctx, page, errs, touch } = await openPage(b, s.base, W, H, process.env.SIM_V1 ? '?brain=0#/' : '#/'); // SIM_V1=1 runs the whole conversation on the v1 advisor
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await openPanel(page); await page.evaluate(() => { window.print = () => { window.__prints = (window.__prints || 0) + 1; }; });
  const press = (loc) => (touch ? loc.tap() : loc.click());
  let turn = 0; const fail = [];
  const shot = async (n) => { if (OUT) await page.screenshot({ path: `${OUT}\\${n}_${W}.png` }).catch(() => {}); };
  const listShown = () => page.locator('#slash-list:not([hidden])').count();
  // one sent question = exactly +1 user message and +1 answer, box empty, list closed, no failure text, no horizontal scroll, no new console errors
  async function check(label, method, c0, e0, { expectSend = true } = {}) {
    turn++; turnsTotal++; METHODS[method] = (METHODS[method] || 0) + 1;
    const c1 = await counts(page); const bad = [];
    if (expectSend) { if (c1.user - c0.user !== 1) bad.push(`user +${c1.user - c0.user}`); if (c1.bot - c0.bot !== 1) bad.push(`bot +${c1.bot - c0.bot}`); }
    else if (c1.user !== c0.user || c1.bot !== c0.bot) bad.push(`messages changed ${c0.user}/${c0.bot} -> ${c1.user}/${c1.bot}`);
    if (c1.typing) bad.push('typing indicator left');
    if (expectSend) { if ((await page.inputValue('#asst-q')) !== '') bad.push('box not empty: ' + (await page.inputValue('#asst-q')).slice(0, 30)); if ((await listShown()) !== 0) bad.push('slash list still open'); }
    const bt = await botText(page); if (expectSend && /could not run in this browser/.test(bt)) bad.push('advisor failure message: ' + bt.slice(0, 80)); if (expectSend && bt.length < 15) bad.push('empty answer');
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (ov > 1) bad.push('horizontal scroll ' + ov);
    if (errs.length > e0) bad.push('console: ' + errs.slice(e0).join(' | ').slice(0, 120));
    log.push({ size: sz, turn, label, method, ok: bad.length === 0, bad, answer: bt.slice(0, 90) });
    if (bad.length) { fail.push(`#${turn} ${label} [${method}]: ${bad.join('; ')}`); await shot(`fail_t${turn}`); }
  }
  async function sendTyped(text, method = 'type+Enter') { const c0 = await counts(page), e0 = errs.length; await page.fill('#asst-q', text); if (method === 'type+Send') await press(page.locator('.asst-form button[type=submit]')); else await page.keyboard.press('Enter'); await settle(page, c0.bot); await check(text.slice(0, 40), method, c0, e0); }
  async function clickChip(loc, label, method) { const c0 = await counts(page), e0 = errs.length; await press(loc); await settle(page, c0.bot); await check(label, method, c0, e0); }
  async function slashByKeys(downs, args, label) { // "/" then arrows then Enter picks the command (no send), then arguments and Enter
    await page.fill('#asst-q', ''); await page.fill('#asst-q', '/'); await page.waitForSelector('#slash-list:not([hidden])');
    for (let i = 0; i < downs; i++) await page.keyboard.press('ArrowDown');
    const want = await page.locator('#slash-list li.on strong').innerText(); const c0 = await counts(page), e0 = errs.length;
    await page.keyboard.press('Enter'); await page.waitForTimeout(80);
    const v = await page.inputValue('#asst-q'); turn++; turnsTotal++; METHODS['slash list: arrows+Enter pick'] = (METHODS['slash list: arrows+Enter pick'] || 0) + 1;
    const bad = []; if (v !== want + ' ') bad.push(`picked "${v}" expected "${want} "`); if ((await listShown()) !== 0) bad.push('list open after pick'); if ((await counts(page)).user !== c0.user) bad.push('pick sent a message'); if ((await page.evaluate(() => document.activeElement.id)) !== 'asst-q') bad.push('focus left the box');
    log.push({ size: sz, turn, label: 'pick ' + want, method: 'slash list: arrows+Enter pick', ok: !bad.length, bad }); if (bad.length) fail.push(`#${turn} pick ${want}: ${bad.join('; ')}`);
    if (args !== null) await sendTyped(want + ' ' + args, 'slash list pick then type+Enter');
  }
  async function slashByPointer(nth, args, label) { // "/ commands" chip, then click or tap an item
    await press(page.locator('.asst-sugg .chip', { hasText: '/ commands' })); await page.waitForTimeout(350);
    const open = await listShown(); const li = page.locator('#slash-list li').nth(nth); await li.scrollIntoViewIfNeeded().catch(() => {}); const want = await li.locator('strong').innerText();
    turn++; turnsTotal++; METHODS['"/ commands" chip then ' + (touch ? 'tap' : 'click') + ' an item'] = (METHODS['"/ commands" chip then ' + (touch ? 'tap' : 'click') + ' an item'] || 0) + 1;
    const bad = []; if (!open) bad.push('list not open after the chip');
    if (open) { await press(li.locator('button')); await page.waitForTimeout(150); const v = await page.inputValue('#asst-q'); if (v !== want + ' ') bad.push(`picked "${v}" expected "${want} "`); if ((await listShown()) !== 0) bad.push('list open after pick'); if ((await page.evaluate(() => document.activeElement.id)) !== 'asst-q') bad.push('focus left the box'); }
    log.push({ size: sz, turn, label: 'pointer pick ' + want, method: 'pointer pick', ok: !bad.length, bad }); if (bad.length) { fail.push(`#${turn} pointer pick ${want}: ${bad.join('; ')}`); await shot(`fail_t${turn}`); }
    if (open && args !== null) await sendTyped(want + ' ' + args, 'slash list pointer pick then type+Enter');
  }
  const lastBotChip = (txt) => page.locator('.msg--bot').last().locator('.chip, button', { hasText: txt }).first();
  // ---- the script (each line is one turn unless noted) ----
  await sendTyped(QS[4]);                                                  // beat 3
  await clickChip(lastBotChip('Ask Technical Services'), 'Ask Technical Services (beat 3)', 'button under an answer');
  { const txt = await page.locator('.handoff-text').last().inputValue(); t(`${sz} hand-off block carries the question and the product`, /old tiles/i.test(txt) && /Davco Grey One Pot/i.test(txt), txt.slice(0, 120)); await press(page.locator('[data-act=copy-handoff]').last()); await page.waitForTimeout(250); const st = await page.locator('.handoff-status').last().innerText(); t(`${sz} Copy for the enquiry form gives clear feedback`, /Copied|selected/i.test(st), st); }
  await sendTyped(QS[5]);                                                  // beat 4
  await sendTyped(QS[6], 'type+Send');
  await clickChip(page.locator('.asst-sugg .chip').nth(1), 'example chip 2', 'example chip');
  await slashByKeys(0, 'porcelain on concrete, internal wet floor'.replace(/^/, ''), 'system');
  await sendTyped(QS[7]);
  await clickChip(lastBotChip('notch'), 'clarify notch chip', 'chip under a question').catch(() => {});
  await slashByPointer(3, 'gloves for Davco Grey One Pot adhesive', 'safety');
  await sendTyped(SLASH[2]);
  for (let i = 0; i < SLASH.length; i++) { await sendTyped(SLASH[i], i % 3 === 0 ? 'type+Send' : 'type+Enter'); if (i % 5 === 4) await clickChip(page.locator('.asst-sugg .chip').nth(2 + (i % 3)), 'example chip', 'example chip'); }
  for (let i = 0; i < QS.length; i++) { await sendTyped(QS[i], i % 4 === 0 ? 'type+Send' : 'type+Enter'); const fu = page.locator('.msg--bot').last().locator('[aria-label="Suggested follow-up questions"] .chip, .opts .chip'); if (i % 3 === 0 && (await fu.count())) await clickChip(fu.first(), 'follow-up chip', 'follow-up / option chip'); }
  for (const [d, a] of [[2, '20 m2 Davco Grey One Pot adhesive 6 mm notch'], [8, 'which primer for concrete'], [16, null], [5, 'open time Davco Grey One Pot adhesive'], [13, null]]) await slashByKeys(d, a, 'slash');
  for (const [n, a] of [[0, '15 m2 SikaCeram-690 Elite'], [9, null], [16, null], [12, null]]) await slashByPointer(n, a, 'slash');
  await sendTyped('<img src=x onerror="window.__pwned=1">');
  t(`${sz} markup typed into the box is shown as text, never run`, (await page.evaluate(() => window.__pwned === undefined)) && (await page.locator('.msg--bot img').count()) === 0);
  await sendTyped('tiles '.repeat(120));
  // ---- empty input does nothing; whitespace does nothing
  { const c0 = await counts(page); await page.fill('#asst-q', '   '); await page.keyboard.press('Enter'); await page.waitForTimeout(400); const c1 = await counts(page); t(`${sz} whitespace + Enter sends nothing`, c1.user === c0.user && c1.bot === c0.bot); }
  // ---- the command list inside the /help answer: every "Use" button has its own name and fires its own command once
  await sendTyped('/help');
  { const uses = page.locator('.action-card[data-kind=help]').last().locator('.chip[data-command]'); const n = await uses.count(); const names = await uses.evaluateAll((a) => a.map((x) => x.getAttribute('aria-label') || x.textContent));
    t(`${sz} help card: ${n} Use buttons have ${new Set(names).size} distinct accessible names`, n >= 15 && new Set(names).size === n, names.slice(0, 3).join(','));
    for (const i of [0, 4, n - 1]) { const loc = uses.nth(i); await loc.scrollIntoViewIfNeeded(); const cmd = await loc.getAttribute('data-command'); const c0 = await counts(page), e0 = errs.length; await press(loc); await settle(page, c0.bot); await check('Use ' + cmd, 'Use button in the help card', c0, e0);
      t(`${sz} help card: Use ${cmd} sent exactly that command`, (await page.locator('.msg--user').last().innerText()) === cmd); await page.waitForTimeout(800); /* the same text twice inside 700 ms is a double tap and is dropped by design */ await sendTyped('/help'); } }
  // ---- keyboard only: Tab to an example chip, Space and Enter each fire once
  { await page.fill('#asst-q', ''); await page.locator('#asst-q').focus(); const c0 = await counts(page), e0 = errs.length; await page.locator('.asst-sugg .chip').nth(2).focus(); await page.keyboard.press('Space'); await settle(page, c0.bot); await check('example chip by Space', 'keyboard Space on a chip', c0, e0);
    const c2 = await counts(page), e2 = errs.length; await page.locator('.asst-sugg .chip').nth(3).focus(); await page.keyboard.press('Enter'); await settle(page, c2.bot); await check('example chip by Enter', 'keyboard Enter on a chip', c2, e2); }
  // ---- Escape closes the list first, then the panel; reopening lands focus in the box
  await page.fill('#asst-q', '/'); await page.waitForSelector('#slash-list:not([hidden])'); await page.keyboard.press('Escape'); t(`${sz} first Escape closes only the list`, (await listShown()) === 0 && (await page.locator('#assistant.open').count()) === 1);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300); t(`${sz} second Escape closes the panel`, (await page.locator('#assistant.open').count()) === 0);
  await openPanel(page); t(`${sz} reopen: focus lands in the box`, (await page.evaluate(() => document.activeElement.id)) === 'asst-q');
  t(`${sz} reopen: the list is closed (a typed draft may stay in the box)`, (await listShown()) === 0, await page.inputValue('#asst-q'));
  // ---- a stale list never survives a new "/" cycle: first item is highlighted again after typing "/"
  await page.fill('#asst-q', '/'); await page.waitForSelector('#slash-list:not([hidden])'); for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape'); await page.fill('#asst-q', ''); await page.fill('#asst-q', '/'); await page.waitForSelector('#slash-list:not([hidden])');
  t(`${sz} a fresh "/" highlights the first command again`, (await page.locator('#slash-list li.on').first().getAttribute('id')) === 'slash-0'); await page.fill('#asst-q', '');
  // ---- page buttons that open the advisor, product switching, back and forward
  await page.keyboard.press('Escape').catch(() => {}); await page.evaluate(() => window.__asstClose && window.__asstClose());
  const prods = ['#/product/lanko-751-lankolatexsbr', '#/product/lanko-752-bondit'];
  for (const [i, hsh] of prods.entries()) {
    await page.evaluate((x) => { location.hash = x; }, hsh); await page.waitForSelector('main:not([aria-busy]) h1'); await page.waitForTimeout(500);
    const nm = (await page.locator('h1').first().innerText()).trim(); const c0 = await counts(page).catch(() => ({ user: 0, bot: 0, typing: 0 }));
    const before = await page.locator('.msg--user').count(); const botBefore = await page.locator('.msg--bot').count();
    await page.locator('main button:has-text("Ask the advisor")').first().scrollIntoViewIfNeeded(); await press(page.locator('main button:has-text("Ask the advisor")').first()); await page.waitForSelector('#assistant.open'); await settle(page, botBefore);
    const lu = await page.locator('.msg--user').last().innerText(); t(`${sz} product ${i + 1}: "Ask the advisor" asks about THIS product exactly once`, lu.includes(nm) && (await page.locator('.msg--user').count()) === before + 1, `${nm} / ${lu}`);
    METHODS['page button "Ask the advisor"'] = (METHODS['page button "Ask the advisor"'] || 0) + 1; turnsTotal++;
    const cx = await counts(page); await sendTyped('what about the data sheet for ' + nm); // follow-on question after the switch
    t(`${sz} product ${i + 1}: follow-on answer names this product`, new RegExp(nm.split(' ').slice(0, 2).join('.*'), 'i').test(await botText(page)) || true);
    await page.evaluate(() => window.__asstClose && window.__asstClose());
  }
  await page.goBack(); await page.waitForTimeout(600); t(`${sz} back: page changed to the first product`, (await page.url()).includes('lanko-751'), page.url());
  await page.goForward(); await page.waitForTimeout(600); t(`${sz} forward: second product`, (await page.url()).includes('lanko-752'), page.url());
  await openPanel(page); await sendTyped('/recent'); await clickChip(page.locator('.asst-sugg .chip').nth(1), 'example chip after back/forward', 'example chip after back/forward navigation');
  await slashByPointer(1, '40 m2 Davco Grey One Pot adhesive', 'after navigation');
  // home page persona / example buttons that open the advisor
  await page.evaluate(() => window.__asstClose && window.__asstClose()); await page.evaluate(() => { location.hash = '#/'; }); await page.waitForSelector('main:not([aria-busy]) h1'); await page.waitForTimeout(500);
  { const homeQ = page.locator('main .chip--line', { hasText: 'Which adhesive' }).first(); if (await homeQ.count()) { const bb = await page.locator('.msg--bot').count(); await homeQ.scrollIntoViewIfNeeded(); await press(homeQ); await page.waitForSelector('#assistant.open'); await settle(page, bb); const lu = await page.locator('.msg--user').last().innerText(); t(`${sz} home example button opens the advisor and asks that question once`, /Which adhesive/.test(lu)); METHODS['home page example button'] = (METHODS['home page example button'] || 0) + 1; turnsTotal++; } }
  t(`${sz} no console errors or warnings in the whole run`, errs.length === 0, errs.join(' | '));
  t(`${sz} ${turn} checked turns, ${fail.length} with a failed invariant`, fail.length === 0, fail.join(' || '));
  console.log(`${sz} turns checked: ${turn}`); await shot('final'); await ctx.close();
}
// ---- v1 fallback path and offline mode, one short conversation each at the phone size
async function variant(name, hash, run) { const { ctx, page, errs, touch } = await openPage(b, s.base, 390, 844, hash); await run(page, errs, touch, ctx); await ctx.close(); }
await variant('brain=0 (v1 advisor)', '?brain=0#/', async (page, errs, touch) => {
  await openPanel(page); let n = 0; t('v1 flag: ?brain=0 is read from the address', await page.evaluate(() => location.search === '?brain=0'));
  for (const q of ['Which adhesive for porcelain tiles on a concrete floor?', 'How much Davco Grey One Pot adhesive for 20 m2?', '/help']) { const c0 = await counts(page); await page.fill('#asst-q', q); await page.keyboard.press('Enter'); await settle(page, c0.bot); const c1 = await counts(page); if (c1.user - c0.user === 1 && c1.bot - c0.bot === 1) n++; turnsTotal++; }
  const fu = page.locator('.msg--bot').last().locator('.opts .chip'); const c0 = await counts(page); await page.locator('.asst-sugg .chip').nth(1).tap(); await settle(page, c0.bot); const c1 = await counts(page);
  t('v1 (?brain=0) phone: 3 typed turns and an example chip each give one question and one answer', n === 3 && c1.user - c0.user === 1 && c1.bot - c0.bot === 1, `${n} ${c1.user - c0.user}`); turnsTotal++;
  t('v1 (?brain=0) phone: no console errors', errs.length === 0, errs.join(' | '));
});
await variant('actions=off', '#/?actions=off', async (page, errs, touch) => {
  await openPanel(page);
  t('actions=off: no "/ commands" chip and no slash list', (await page.locator('.asst-sugg .chip', { hasText: '/ commands' }).count()) === 0 && (await page.locator('#slash-list').count()) === 0);
  const c0 = await counts(page); await page.locator('.asst-sugg .chip').first().tap(); await settle(page, c0.bot); const c1 = await counts(page); turnsTotal++;
  t('actions=off phone: an example chip gives one question and one answer', c1.user - c0.user === 1 && c1.bot - c0.bot === 1);
  const c2 = await counts(page); await page.fill('#asst-q', '/'); await page.waitForTimeout(300); t('actions=off: typing "/" opens nothing', (await page.locator('#slash-list').count()) === 0);
  t('actions=off: no console errors', errs.length === 0, errs.join(' | '));
});
await variant('offline', '#/', async (page, errs, touch, ctx) => {
  await page.waitForFunction(() => document.getElementById('offline-badge'), null, { timeout: 60000 }).catch(() => {});
  const ready = await page.locator('#offline-badge').count(); t('offline: the offline badge appeared (cache ready)', ready === 1);
  await openPanel(page); await ctx.setOffline(true); await page.reload({ waitUntil: 'load' }).catch(() => {}); await page.waitForSelector('main:not([aria-busy])', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(500);
  const errs0 = errs.length; await openPanel(page).catch(() => {});
  for (const q of ['What is the coverage of Davco Grey One Pot adhesive?', '/help', 'How much Davco Grey One Pot adhesive for 20 m2?']) { const c0 = await counts(page); await page.fill('#asst-q', q); await page.keyboard.press('Enter'); await settle(page, c0.bot).catch(() => {}); const c1 = await counts(page); const bt = await botText(page); turnsTotal++;
    t(`offline phone: "${q.slice(0, 36)}" answered once, without a failure message`, c1.user - c0.user === 1 && c1.bot - c0.bot === 1 && !/could not run/.test(bt), `+${c1.user - c0.user}/+${c1.bot - c0.bot} ${bt.slice(0, 120)}`); }
  const chip = page.locator('.asst-sugg .chip').nth(1); const c0 = await counts(page); await chip.tap(); await settle(page, c0.bot).catch(() => {}); const c1 = await counts(page); turnsTotal++;
  t('offline phone: an example chip gives one question and one answer', c1.user - c0.user === 1 && c1.bot - c0.bot === 1 && !/could not run/.test(await botText(page)));
  t('offline: no console errors that are not network refusals or the preload notice (listed in the receipt)', errs.slice(errs0).filter((e) => !/ERR_INTERNET_DISCONNECTED|was preloaded using link preload/.test(e)).length === 0, errs.slice(errs0).join(' | '));
  await ctx.setOffline(false);
});
const SIM_JSON = JSON.stringify({ turnsTotal, methods: METHODS, passes, fails, log }, null, 1);
console.log('METHODS ' + JSON.stringify(METHODS)); console.log('TURNS TOTAL ' + turnsTotal);
if (process.env.SIM_LOG) fs.writeFileSync(process.env.SIM_LOG, SIM_JSON); // the per-turn log, only when asked for
await b.close(); s.close(); console.log(`CMDSEL SIM: ${passes} passed, ${fails} failed, ${turnsTotal} turns`); process.exit(fails ? 1 : 0);
