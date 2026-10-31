// Browser checks for the job builder and compare mode (Windows node + Windows Chrome): node.exe e2e_jobcompare.mjs [portalDir] [shotsDir]
// 1366x768 desktop and 390x844 touch: ask in the advisor panel, read the card, add all to the project, see it on the cart page; compare two and three products.
import { serve, launch } from './_browser.mjs';
import { PORTAL } from './_benv.mjs';
const SHOTS = process.argv[3] || '';
const s = await serve(process.argv[2] || PORTAL); const b = await launch(); let fails = 0, passes = 0;
const t = (n, ok, d = '') => { if (ok) passes++; else fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d ? ' :: ' + String(d).slice(0, 300) : '')); };
async function open(W, H) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600 });
  const page = await ctx.newPage(); const errs = [], reqs = [];
  page.on('console', (m) => { if (['error'].includes(m.type())) errs.push(m.text().slice(0, 160)); }); page.on('pageerror', (e) => errs.push(e.message));
  page.on('request', (r) => reqs.push(r.url()));
  await page.goto(s.base + '#/', { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(300);
  return { ctx, page, errs, reqs };
}
const openPanel = async (page) => { if (await page.locator('#assistant.open').count()) return; if (await page.locator('#asst-fab').isVisible()) await page.click('#asst-fab'); else await page.locator('button:visible', { hasText: /advisor/i }).first().click(); await page.waitForSelector('#assistant.open'); };
const send = async (page, text) => { const before = await page.locator('.msg--bot').count(); await page.fill('#asst-q', text); await page.keyboard.press('Enter'); await page.waitForFunction((n) => document.querySelectorAll('.msg--bot').length > n && !document.querySelector('.msg--bot .typing'), before, { timeout: 20000 }); };
const lastCard = (page) => page.locator('.msg--bot').last();
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}\\${name}.png`, fullPage: false }).catch(() => {}); };
const overflow = (page) => page.evaluate(() => { const c = [...document.querySelectorAll('.msg--bot')].pop(); const a = document.querySelector('#assistant'); return { card: c.scrollWidth - c.clientWidth, panel: a.scrollWidth - a.clientWidth, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });

for (const [W, H, label] of [[1366, 768, 'desktop'], [390, 844, 'phone']]) {
  const sz = `${W}x${H}`;
  const { ctx, page, errs, reqs } = await open(W, H);
  await openPanel(page);
  // ---------------- job builder
  await send(page, 'bathroom 2.4 x 1.8, walls to 1.8 m, over concrete');
  const jc = lastCard(page);
  t(`${sz} job: a job card`, (await jc.locator('.action-card[data-kind=job], [data-kind=job]').count()) >= 1 || (await jc.getAttribute('data-kind')) === 'job', await jc.innerText());
  const lines = jc.locator('.job-line');
  const n = await lines.count();
  t(`${sz} job: floor and wall lines (5 + 5) and the bond breaker`, n === 11, String(n));
  const txt = await jc.innerText();
  t(`${sz} job: names the whole system`, /Prepare and prime/.test(txt) && /Waterproofing membrane/.test(txt) && /Tile adhesive/.test(txt) && /Grout/.test(txt) && /Movement joint sealant/.test(txt) && /Bond breaker/.test(txt), txt.slice(0, 200));
  let uncited = 0; for (let i = 0; i < n; i++) { const l = lines.nth(i); const lt = await l.innerText(); const links = await l.locator('a[href^="http"]').count(); if (!(links >= 1 || /Ask Technical Services/.test(lt))) uncited++; if (/\d/.test(lt) && !/Ask Technical Services/.test(lt) && links < 1) uncited++; }
  t(`${sz} job: every line has its source link or says ask Technical Services`, uncited === 0, String(uncited));
  t(`${sz} job: the estimate sentence is on the card`, /Estimate only, not an offer\. Quantities, not prices\./.test(txt));
  t(`${sz} job: Add all button`, (await jc.locator('button:has-text("Add all to my project")').count()) === 1);
  const prodLinks = await jc.locator('.job-line a.link[href^="#/product/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')))].length);
  const o1 = await overflow(page); t(`${sz} job: no sideways overflow`, o1.card <= 1 && o1.panel <= 1 && o1.doc <= 1, JSON.stringify(o1));
  await shot(page, `${label}_job_card`);
  await jc.locator('button:has-text("Add all to my project")').click();
  await page.waitForFunction(() => /Job list added to my project/i.test([...document.querySelectorAll('.msg--bot')].pop()?.textContent || ''), null, { timeout: 15000 });
  t(`${sz} job: confirmed in chat`, /added to my project/i.test(await lastCard(page).innerText()));
  await page.evaluate(() => document.querySelector('#assistant button[aria-label^="Close"]')?.click()); await page.waitForTimeout(250);
  await page.goto(s.base + '#/projects'); await page.waitForSelector('#cart-box .proj-line', { timeout: 10000 });
  const cartN = await page.locator('#cart-box .proj-line:not(.proj-line--text)').count();
  t(`${sz} job: the cart page lists every product (${prodLinks})`, cartN === prodLinks && cartN >= 5, `${cartN} vs ${prodLinks}`);
  const cartTxt = await page.locator('#cart-box').innerText();
  t(`${sz} job: cart lines say the advisor added them and carry a quantity need`, (cartTxt.match(/Added by the advisor/g) || []).length === cartN && /m2/.test(cartTxt), cartTxt.slice(0, 200));
  await shot(page, `${label}_job_cart`);
  await openPanel(page);
  // one clarifying question with chips
  await send(page, 'bathroom 2.4 x 1.8, over concrete');
  const q = lastCard(page); t(`${sz} job: one clarifying question with chips`, /how high/i.test(await q.innerText()) && (await q.locator('button.chip').count()) >= 4, await q.innerText());
  await q.locator('button.chip:has-text("Walls to 2.1 m")').click();
  await page.waitForFunction(() => /Walls/.test([...document.querySelectorAll('.msg--bot')].pop()?.textContent || '') && document.querySelectorAll('.job-line').length >= 11, null, { timeout: 15000 });
  t(`${sz} job: the chip completes the list (walls 2.1 m)`, /2\.1 m high/.test(await lastCard(page).innerText()));
  // ---------------- compare
  await send(page, '400 EVO PRO vs 410 Secure Set');
  const cc = lastCard(page);
  t(`${sz} compare: a comparison card`, (await cc.locator('.cmp').count()) === 1);
  const heads = await cc.locator('.cmp-head [role=columnheader]').allInnerTexts();
  t(`${sz} compare: both products named in the header`, heads.some((x) => /400 EVO PRO/.test(x)) && heads.some((x) => /410 Secure Set/.test(x)), heads.join('|'));
  const rows = cc.locator('.cmp-row[data-field]'); const rn = await rows.count();
  const fields = await rows.evaluateAll((r) => r.map((x) => x.getAttribute('data-field')));
  for (const f of ['coverage', 'open', 'pot', 'cure', 'substrates', 'standards']) t(`${sz} compare: field ${f} present`, fields.includes(f), fields.join());
  const cells = cc.locator('.cmp-row[data-field] [role=cell]'); const cn = await cells.count(); let noCite = 0, absentOk = 0, absentN = 0;
  for (let i = 0; i < cn; i++) { const c = cells.nth(i); const ln = await c.locator('a[href^="http"]').count(); if (ln < 1) noCite++; if ((await c.getAttribute('class') || '').includes('cmp-absent')) { absentN++; if (/Not published/.test(await c.innerText())) absentOk++; } }
  t(`${sz} compare: every cell (${cn}) carries a source link`, noCite === 0 && cn === rn * 2, `${noCite} without, ${cn} cells, ${rn} rows`);
  t(`${sz} compare: unpublished cells say Not published`, absentN === absentOk);
  const hl = await cc.locator('.cmp-head a.link[href^="#/product/"]').count(); t(`${sz} compare: header links to the product pages`, hl === 2 || W < 600, String(hl));
  const o2 = await overflow(page); t(`${sz} compare: no sideways overflow`, o2.card <= 1 && o2.panel <= 1 && o2.doc <= 1, JSON.stringify(o2));
  const geo = await cc.evaluate((root) => { const r = root.querySelector('.cmp-row[data-field]'); const cs = [...r.querySelectorAll('[role=cell]')].map((c) => c.getBoundingClientRect()); const pb = getComputedStyle(r.querySelector('[role=cell]'), '::before').content; const head = getComputedStyle(root.querySelector('.cmp-head')).display; return { sameRow: Math.abs(cs[0].top - cs[1].top) < 4, stacked: cs[1].top > cs[0].top + 4, before: pb, head }; });
  if (W < 600) t(`${sz} compare: columns stack and each cell names its product`, geo.stacked && /SikaTile-4\d\d/.test(geo.before) && geo.head === 'none', JSON.stringify(geo));
  else t(`${sz} compare: columns sit side by side`, geo.sameRow, JSON.stringify(geo));
  await shot(page, `${label}_compare`);
  await send(page, 'compare 400 EVO PRO, 410 Secure Set and Davco Powder Mastic');
  const c3 = lastCard(page); t(`${sz} compare: a third product gives three columns`, (await c3.locator('.cmp-head [role=columnheader]').count()) === 4 && (await c3.locator('.cmp-row[data-field="coverage"] [role=cell]').count()) === 3);
  const o3 = await overflow(page); t(`${sz} compare: three columns, no sideways overflow`, o3.card <= 1 && o3.panel <= 1 && o3.doc <= 1, JSON.stringify(o3));
  await shot(page, `${label}_compare3`);
  await send(page, 'SikaTile-400 EVO PRO or SikaTile-410 Secure Set');
  t(`${sz} compare: "A or B" also compares`, (await lastCard(page).locator('.cmp').count()) === 1);
  t(`${sz} no console errors`, errs.length === 0, errs.join(' | '));
  const foreign = reqs.filter((u) => !u.startsWith(s.base) && !u.startsWith('data:') && !u.startsWith('blob:')); t(`${sz} no requests leave the page`, foreign.length === 0, foreign.slice(0, 3).join(' '));
  await ctx.close();
}
await b.close(); s.close();
console.log(`JOBCOMPARE E2E: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
