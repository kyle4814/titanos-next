// Regression tests for the bugs the simulated-user hunt found (2026-10-31). Each one fails on 500fd8713 and passes on the fix.
// usage (Windows node): node.exe regress.mjs <baseUrl>
import { launch } from './lib.mjs';

const base0 = process.argv[2]; const base = base0.endsWith('/') ? base0 : base0 + '/';
const browser = await launch(); let pass = 0, fail = 0;
const t = (name, ok, detail = '') => { if (ok) pass++; else fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' :: ' + String(detail).slice(0, 240))); };
const open = async (w, h, opts = {}) => { const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...opts }); const p = await ctx.newPage(); return { ctx, p }; };
const ready = async (p) => { await p.waitForFunction(() => document.querySelector('main') && !document.querySelector('main[aria-busy]') && document.querySelector('main').innerText.length > 30, null, { timeout: 20000 }); await p.waitForTimeout(150); };
const over = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// R1 the skip link must not become a route (P1: it landed on "We could not find that page")
{ const { ctx, p } = await open(1440, 900); await p.goto(base + '#/products'); await ready(p);
  await p.keyboard.press('Tab'); const first = await p.evaluate(() => document.activeElement.className); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  const o = await p.evaluate(() => ({ hash: location.hash, text: document.querySelector('main').innerText.slice(0, 80), focus: document.activeElement.id }));
  t('R1 skip link is the first Tab stop', /skip/.test(first), first);
  t('R1 skip link keeps the page (no "could not find")', !/could not find/i.test(o.text) && /Find a product/.test(o.text), JSON.stringify(o));
  t('R1 skip link moves focus to main', o.focus === 'main', JSON.stringify(o));
  await p.evaluate(() => { location.hash = '#nowhere'; }); await p.waitForTimeout(400);
  t('R1 a plain in-page anchor is not a route', !/could not find/i.test(await p.locator('main').innerText()), await p.locator('main').innerText());
  await ctx.close(); }

// R2 a very long unbroken search string must not push the finder sideways (P2: page 4,000 px wide)
for (const w of [1440, 390]) { const { ctx, p } = await open(w, 800); await p.goto(base + '#/products?q=' + 'a'.repeat(400)); await ready(p); t(`R2 long search string, ${w} px wide, no sideways scroll`, (await over(p)) <= 1, await over(p)); await ctx.close(); }

// R3 widths from 1024 to 1200 (iPad landscape, small laptops): the header must fit (P1: every page scrolled sideways, meta links wrapped and clipped)
for (const w of [1024, 1080, 1100, 1180, 1200]) { const { ctx, p } = await open(w, 768); for (const h of ['#/', '#/products', '#/product/sikafloor-263-sl']) { await p.goto(base + h); await ready(p); t(`R3 ${w} px ${h} no sideways scroll`, (await over(p)) <= 1, await over(p)); }
  const lines = await p.evaluate(() => [...document.querySelectorAll('.hdr-meta li a')].map((a) => { const w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.textContent.trim().length > 2) { const r = document.createRange(); r.selectNodeContents(n); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size; } return 1; }));
  t(`R3 ${w} px meta links stay on one line`, lines.length >= 5 && lines.every((n) => n === 1), JSON.stringify(lines)); await ctx.close(); }

// R4 the not-found page has a heading level one (P3 a11y)
{ const { ctx, p } = await open(1440, 900); await p.goto(base + '#/product/does-not-exist-xyz'); await ready(p); t('R4 not-found page has exactly one h1', (await p.locator('h1').count()) === 1, await p.locator('h1').count()); await ctx.close(); }

// R5 the Add to project button's accessible name contains its visible text (WCAG 2.5.3, voice control)
{ const { ctx, p } = await open(1440, 900); await p.goto(base + '#/product/sikafloor-263-sl'); await ready(p); const b = p.locator('.pdp button[aria-pressed]').first(); const vis = (await b.innerText()).trim(); const nm = await b.getAttribute('aria-label');
  t('R5 add button name starts with its visible text', nm.toLowerCase().startsWith(vis.toLowerCase()), `visible "${vis}" name "${nm}"`); await b.click(); const vis2 = (await b.innerText()).trim(); const nm2 = await b.getAttribute('aria-label'); t('R5 pressed state keeps name and text aligned', nm2.toLowerCase().startsWith(vis2.toLowerCase()), `visible "${vis2}" name "${nm2}"`); await ctx.close(); }

// R6 offline mode: after the worker has control and the network drops, a tile product page (first visit to that page) still renders (P1)
{ const { ctx, p } = await open(1440, 900, { serviceWorkers: 'allow' }); await p.goto(base + '#/about'); await ready(p);
  const ctl = await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 25000 }).then(() => true).catch(() => false); t('R6 service worker takes control', ctl);
  if (ctl) { await p.waitForFunction(async () => { for (const k of await caches.keys()) if (await (await caches.open(k)).match('dist/actions-panels.js')) return true; return false; }, null, { timeout: 15000 }).catch(() => {}); await ctx.setOffline(true); await p.goto(base + '#/product/davco-ceramacrete'); await p.waitForTimeout(1500); const txt = await p.locator('main').innerText(); t('R6 product page renders offline (no "could not load its data")', /Davco/.test(txt) && !/could not load/i.test(txt), txt.slice(0, 120)); await ctx.setOffline(false); }
  await ctx.close(); }

// R7 the same data sheet sentence is not shown twice in the Rates table (P2: 33 products carried exact repeats from the extractor)
{ const { ctx, p } = await open(1440, 900); for (const id of ['sikagrout-hes', 'sikagrout-212-hpau', 'sikafloor-purcemhb-22']) { await p.goto(base + '#/product/' + id + '?tab=rates'); await ready(p); await p.waitForTimeout(400);
    const rows = await p.evaluate(() => [...document.querySelectorAll('[role=tabpanel] table')].filter((t) => /Published rate|What it is/i.test(t.closest('div')?.parentElement?.innerText || t.innerText)).flatMap((t) => [...t.querySelectorAll('tbody tr')].map((r) => r.innerText.replace(/\s+/g, ' ').trim())).filter(Boolean));
    const dup = rows.filter((r, i) => rows.indexOf(r) !== i); t(`R7 ${id} rates table has no repeated row`, rows.length > 0 && dup.length === 0, dup[0] || 'no rows found'); }
  await ctx.close(); }

// R8 the remove button on a filter pill keeps its 26 px square even when the search text is very long (my own R2 fix squeezed it to 6 px at first)
{ const { ctx, p } = await open(390, 800); await p.goto(base + '#/products?q=' + 'a'.repeat(300)); await ready(p); const w = await p.evaluate(() => Math.round(document.querySelector('.pill button').getBoundingClientRect().width)); t('R8 pill remove button is at least 24 px wide', w >= 24, w); await ctx.close(); }

// R9 no mojibake in document titles (P2: "SDS SikaGuniteA-circumflex GP" in 17 safety data sheet titles, 95 stray characters in 48 data files)
{ const { ctx, p } = await open(1440, 900); await p.goto(base + '#/documents?q=sikagunite'); await ready(p); await p.waitForTimeout(500); const txt = await p.locator('main').innerText(); t('R9 documents hub shows SikaGunite SDS title without stray characters', /SDS SikaGunite/.test(txt) && !/\u00c2/.test(txt), txt.slice(0, 200));
  const raw = await (await fetch(base + 'data/documents.json')).text(); t('R9 documents.json has no stray A-circumflex', !/\u00c2/.test(raw), (raw.match(/.{0,20}\u00c2.{0,10}/) || [''])[0]); await ctx.close(); }

// R10 a space typed before a pause is kept (P1: "tile ", a 300 ms pause, then "adhesive" searched for "tileadhesive" because the box was reset to the trimmed URL copy)
for (const [route, id] of [['#/products', '#finder-q'], ['#/documents', '#doc-q'], ['#/guides', '#guide-q']]) { const { ctx, p } = await open(1440, 900); await p.goto(base + route); await ready(p); await p.locator(id).click(); await p.keyboard.type('tile ', { delay: 40 }); await p.waitForTimeout(900); await p.keyboard.type('adhesive', { delay: 40 }); await p.waitForTimeout(900);
  const v = await p.locator(id).inputValue(); t(`R10 ${route} search keeps the space typed before a pause`, v === 'tile adhesive', JSON.stringify(v)); await ctx.close(); }

// R11 a product searched by its own full name is found even when the name has a one-letter word (P1: "Sikagard 62 T", "SikaSwell S-2", "Sikafloor-158 W Fast Barrier" returned 0 products)
{ const { ctx, p } = await open(1440, 900); for (const [q, want] of [['Sikagard 62 T', 'Sikagard-62 T'], ['SikaSwell S-2', 'SikaSwell S-2'], ['Sikafloor-158 W Fast Barrier', 'Sikafloor-158 W Fast Barrier'], ['Sika CarboShear L', 'Sika CarboShear L']]) {
    await p.goto(base + '#/products?q=' + encodeURIComponent(q)); await ready(p); await p.waitForTimeout(500); const top = (await p.locator('.product-card h3').first().innerText().catch(() => '')).replace(/[®™]/g, '');
    t(`R11 search "${q}" puts ${want} first`, top.toLowerCase() === want.toLowerCase(), top || 'no results'); }
  await ctx.close(); }

// R12 a mistyped product or system address says "not found" without requesting a file that does not exist (P1: a console 404 on #/product/does-not-exist and #/system-data/not-a-slug)
for (const [route, ok200] of [['#/product/does-not-exist', false], ['#/system-data/not-a-slug', false], ['#/product/davco-grey-one-potadhesive', true], ['#/system-data/porcelain-on-concrete-internal-wet-floor', true]]) {
  const { ctx, p } = await open(1440, 900); const bad = []; p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().replace(base, '')); }); p.on('console', (m) => { if (m.type() === 'error') bad.push('console ' + m.text().slice(0, 80)); });
  await p.goto(base + route); await ready(p); await p.waitForTimeout(600); const txt = await p.locator('main').innerText(); const h1 = await p.locator('h1').first().innerText().catch(() => '');
  t(`R12 ${route}: ${ok200 ? 'opens' : 'says not found'}, no failed request, no console error`, bad.length === 0 && (ok200 ? !/not find|not found/i.test(h1 + txt.slice(0, 120)) : /not find|not found|no system sheet/i.test(txt)), JSON.stringify([bad, txt.slice(0, 80)])); await ctx.close(); }

// R13 About states the real counts: the first "N products" is all 512, then 291 packshots and 221 illustrative (P1: it said 291 vs 512 because the stock lane changed the sentence)
{ const { ctx, p } = await open(1440, 900); const urls = []; p.on('request', (r) => urls.push(r.url())); await p.goto(base + '#/about'); await ready(p); await p.waitForTimeout(500); const txt = await p.locator('main').innerText();
  t('R13 About: first "N products" is 512, with 291 packshots and 221 illustrative; products.json not fetched', (/([\d,]+)\s+products/.exec(txt) || [])[1] === '512' && /291 show the packshot/.test(txt) && /\(221 products\)/.test(txt) && !urls.some((u) => /data\/products\.json/.test(u)), txt.slice(0, 100)); await ctx.close(); }

// R14 on a phone and a tablet the advisor is opened by a button whose accessible name says "advisor" (the thumb bar shows "Ask"; its name is "Ask the advisor") and a suggested question works
for (const [w, h] of [[390, 844], [768, 1024]]) { const { ctx, p } = await open(w, h, { hasTouch: true, isMobile: w < 600 }); await p.goto(base + '#/'); await ready(p);
  const b = p.getByRole('button', { name: /advisor/i }).first(); let ok = false; try { await b.click({ timeout: 5000 }); const q = p.locator('.assistant button:has-text("How much adhesive")').first(); await q.click({ timeout: 5000 }); ok = true; } catch { ok = false; }
  t(`R14 ${w} px: the advisor opens from a button named for the advisor and a suggested question can be pressed`, ok, ''); await ctx.close(); }

await browser.close();
console.log(`REGRESSION ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
