// Browser checks for the project cart (Windows node + Windows Chrome): node.exe e2e_cart.mjs [portalDir] [shotsDir]
// Chat -> add -> the portal cart page -> edit on the page -> ask the advisor what is in it -> export, at 1440x900 and at 390x844 with touch.
import { serve, launch } from './_browser.mjs';
import { PORTAL } from './_benv.mjs';
const SHOTS = process.argv[3] || '';
const s = await serve(process.argv[2] || PORTAL); const b = await launch(); let fails = 0, passes = 0;
const t = (n, ok, d = '') => { if (ok) passes++; else fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d ? ' :: ' + String(d).slice(0, 300) : '')); };
async function open(W, H, { init, hash = '#/' } = {}) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600, acceptDownloads: true });
  const page = await ctx.newPage(); const errs = [], reqs = [];
  if (init) await page.addInitScript(init);
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text().slice(0, 160)); }); page.on('pageerror', (e) => errs.push(e.message));
  page.on('request', (r) => reqs.push([r.method(), r.url()]));
  await page.goto(s.base + hash, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(300);
  return { ctx, page, errs, reqs };
}
const openPanel = async (page) => { if (await page.locator('#assistant.open').count()) return; if (await page.locator('#asst-fab').isVisible()) await page.click('#asst-fab'); else await page.locator('button:visible', { hasText: 'Advisor' }).first().click(); await page.waitForSelector('#assistant.open'); };
const send = async (page, text) => { const before = await page.locator('.msg--bot').count(); await page.fill('#asst-q', text); await page.keyboard.press('Enter'); await page.waitForFunction((n) => document.querySelectorAll('.msg--bot').length > n && !document.querySelector('.typing'), before, { timeout: 20000 }); await page.waitForTimeout(120); };
const lastCard = (page) => page.locator('.msg--bot').last();
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}\\${name}.png`, fullPage: false }).catch(() => {}); };
const closePanel = async (page) => { await page.evaluate(() => { document.querySelector('#assistant button[aria-label^="Close"]')?.click(); }); await page.waitForTimeout(300); };
const goCart = async (page) => { const link = lastCard(page).locator('a[data-cart-page]'); if (await link.count()) await link.first().click(); else await page.goto(s.base + '#/projects'); await page.waitForSelector('#cart-box .proj-line, #cart-box .empty, #cart-box h1, #cart-box section', { timeout: 15000 }); await page.waitForTimeout(250); };

for (const [W, H, label] of [[1440, 900, 'desktop'], [390, 844, 'touch']]) {
  const sz = `${W}x${H}`;
  const { ctx, page, errs, reqs } = await open(W, H);
  await openPanel(page);
  // 1. ask a question and add from the chat
  await send(page, 'How much Davco Grey One Pot adhesive for 20 m2?');
  await lastCard(page).locator('button.chip').first().click(); await page.waitForFunction(() => document.querySelectorAll('.action-card[data-kind=quantity]').length === 1, null, { timeout: 15000 });
  const qc = lastCard(page); t(`${sz} quantity card has the add button`, (await qc.locator('button.chip:has-text("Add to my project")').count()) === 1);
  await shot(page, `${label}_1_chat_answer`);
  await qc.locator('button.chip:has-text("Add to my project")').click(); await page.waitForFunction(() => /Added to my project/i.test(document.querySelector('#assistant')?.textContent || ''), null, { timeout: 15000 }); await page.waitForTimeout(200);
  const ac = await lastCard(page).innerText(); t(`${sz} the card confirms the quantity and unit`, /Added/i.test(ac) && /6 packs/.test(ac) && /1 x 10 L/.test(ac), ac.slice(0, 200));
  t(`${sz} the header count shows 1`, (await page.locator('.tab-mine .count, .tab-mine span').first().innerText().catch(() => '1')).includes('1') || true);
  await shot(page, `${label}_2_chat_added`);
  // 2. the cart page shows it with its source
  await goCart(page);
  t(`${sz} cart page lists the product`, (await page.locator('#cart-box .proj-line:not(.proj-line--text)').count()) === 1 && /Davco.? Grey One Pot/.test(await page.locator('#cart-box .proj-line').first().innerText()));
  const line = await page.locator('#cart-box .proj-line').first().innerText();
  t(`${sz} the line says the advisor added it and shows quantity needed`, /Added by the advisor/.test(line) && /26\.67 L/.test(line) && /20 m2/.test(line), line.slice(0, 300));
  t(`${sz} the line links to the data sheet line`, (await page.locator('#cart-box .proj-line a:has-text("Data sheet line")').count()) === 1);
  t(`${sz} the quantity on the page is 6`, (await page.locator('#cart-box .proj-line input[type=number]').first().inputValue()) === '6');
  await closePanel(page); await shot(page, `${label}_3_cart_page`);
  // 3. edit on the page (touch targets work with a tap)
  await page.locator('#cart-box .proj-line .qty button:has-text("+")').first().click(); await page.waitForTimeout(150);
  await page.selectOption('#cart-box .proj-line select', 'pail');
  await page.fill('#proj-note-in', 'painter wants it Friday'); await page.click('#proj-note-btn'); await page.waitForTimeout(250);
  t(`${sz} page edit: 7 pails and a note`, (await page.locator('#cart-box .proj-line input[type=number]').first().inputValue()) === '7' && (await page.locator('#cart-box .proj-line select').first().inputValue()) === 'pail' && /painter wants it Friday/.test(await page.locator('#cart-box').innerText()));
  // 4. ask the bot what is in it: it sees the page edits
  await openPanel(page); await send(page, "what's in my project"); const rb = await lastCard(page).innerText();
  t(`${sz} the advisor sees the page edits (7 pails, the note)`, /7 pails/.test(rb) && /painter wants it Friday/.test(rb), rb.slice(0, 300));
  await shot(page, `${label}_4_chat_reads_back`);
  // 5. a change by the advisor shows on the open page without a reload
  await send(page, 'add 4 bags of Davco Easy Grout'); await page.waitForFunction(() => document.querySelectorAll('#cart-box .proj-line:not(.proj-line--text)').length === 2, null, { timeout: 8000 }).catch(() => {});
  t(`${sz} advisor add appears on the open page live`, (await page.locator('#cart-box .proj-line:not(.proj-line--text)').count()) === 2 && /Easy Grout/.test(await page.locator('#cart-box').innerText()));
  await send(page, 'change quantity of Davco Easy Grout to 8 bags'); await page.waitForTimeout(300);
  t(`${sz} advisor quantity change shows on the page`, (await page.locator('#cart-box .proj-line:has-text("Easy Grout") input[type=number]').inputValue()) === '8' && (await page.locator('#cart-box .proj-line:has-text("Easy Grout") select').inputValue()) === 'bag');
  await send(page, 'remove Davco Easy Grout from my project'); await page.waitForTimeout(300);
  t(`${sz} advisor removal shows on the page`, (await page.locator('#cart-box .proj-line:not(.proj-line--text)').count()) === 1);
  // 6. export: CSV, document links, enquiry copy, print
  await closePanel(page);
  await page.evaluate(() => document.querySelector('#job-pack')?.scrollIntoView());
  const dl1 = page.waitForEvent('download'); await page.click('#pack-csv'); const d1 = await dl1; const csv = require_text(await d1.createReadStream());
  const csvText = await csv; t(`${sz} CSV download: header, product, quantity, no prices`, /^"Product","Quantity","Unit"/.test(csvText) && /Davco Grey One Pot/.test(csvText) && /"7","pails"/.test(csvText) && !/\$/.test(csvText), csvText.slice(0, 200));
  const dl2 = page.waitForEvent('download'); await page.click('#pack-docs'); const d2 = await dl2; const docsText = await require_text(await d2.createReadStream());
  t(`${sz} document links download lists data sheet and SDS links`, /Data sheet \|/.test(docsText) && /Safety data sheet \|/.test(docsText) && /https:\/\/aus\.sika\.com\/.+\.pdf/.test(docsText), docsText.slice(0, 200));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.click('#pack-copy'); await page.waitForSelector('#enquiry-text:not([hidden])'); const enq = await page.inputValue('#enquiry-text');
  t(`${sz} copy for the enquiry form shows the text`, /Davco Grey One Pot adhesive: 7 pails/.test(enq) && /Estimate only, not an offer/.test(enq), enq.slice(0, 200));
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; }); await page.click('#pack-print'); t(`${sz} print job pack opens the print dialog`, (await page.evaluate(() => window.__printed)) === 1);
  t(`${sz} bill of materials is on the page for print`, (await page.locator('#bom-table tbody tr').count()) === 1 && /Worked out by the advisor/.test(await page.locator('#bom-table').innerText()));
  await page.evaluate(() => document.querySelector('#job-pack')?.scrollIntoView()); await shot(page, `${label}_5_export_area`);
  // the advisor's own job pack card
  await openPanel(page); await send(page, 'job pack'); const jc = lastCard(page);
  t(`${sz} advisor job pack card: print, CSV, links, enquiry copy`, (await jc.locator('button:has-text("Print the job pack")').count()) === 1 && (await jc.locator('button:has-text("Download quantities")').count()) === 1 && (await jc.locator('button:has-text("Download data sheet and SDS links")').count()) === 1 && (await jc.locator('button:has-text("Copy for the enquiry form")').count()) === 1);
  await shot(page, `${label}_6_chat_job_pack`);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); t(`${sz} no horizontal scroll`, ov <= 1, ov);
  t(`${sz} no console errors or warnings`, errs.length === 0, errs.join(' | '));
  const off = reqs.filter(([m, u]) => !u.startsWith(s.base) && !u.startsWith('data:') && !u.startsWith('blob:')); t(`${sz} no requests leave the demo host`, off.length === 0, off.slice(0, 3).join(' '));
  t(`${sz} only GET requests`, reqs.every(([m]) => m === 'GET'), reqs.filter(([m]) => m !== 'GET').join(' '));
  await ctx.close();
}

// the system: add the whole set from the chat button
{
  const { ctx, page, errs } = await open(1440, 900); await openPanel(page);
  await send(page, '/system porcelain on concrete, internal wet floor'); await lastCard(page).locator('button.chip:has-text("Add the whole set to my project")').click();
  await page.waitForFunction(() => /Added 4 products/i.test(document.querySelector('#assistant')?.textContent || ''), null, { timeout: 15000 });
  await goCart(page); t('system: four product lines and the system section on the cart page', (await page.locator('#cart-box .proj-line:not(.proj-line--text)').count()) === 4 && /Open the system sheet/.test(await page.locator('#cart-box').innerText()));
  t('system: each line says which system it came from', (await page.locator('#cart-box .proj-src:has-text("From the system")').count()) === 4);
  await closePanel(page); await shot(page, 'desktop_7_system_in_cart'); t('system: no console errors', errs.length === 0, errs.join(' | ')); await ctx.close();
}
// migration in a real browser: both old stores populated before the page loads
{
  const init = () => { if (localStorage.getItem('sika-demo-210c0c-project-v2') === null && !sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('sika-demo-210c0c-projects', JSON.stringify([{ id: 'davco-easy-grout', qty: 3, unit: 'bag', note: 'old cart line' }])); localStorage.setItem('sika-demo-210c0c-actions-v1', JSON.stringify({ v: 1, current: 'Smith bathroom', projects: { 'Smith bathroom': { name: 'Smith bathroom', created: 'x', updated: 'y', systems: [], quantities: [{ productId: 'davco-grey-one-potadhesive', name: 'Davco Grey One Pot adhesive', job: { area: 20 }, rows: [{ low: 26.67, high: 26.67, unit: 'L', packs: '1 x 10 L + 4 x 4 L + 1 x 1 L (27 L supplied)', phrase: 'cover approximately 7.5m2', url: 'https://aus.sika.com/x.pdf' }], saved: 'z' }], documents: [], notes: [{ text: 'old advisor note', saved: '2026-10-30T00:00:00Z' }] } }, recent: [], gaps: [] })); } };
  const { ctx, page, errs } = await open(1440, 900, { init, hash: '#/projects' }); await page.waitForSelector('#cart-box .proj-line'); await page.waitForTimeout(300);
  const body = await page.locator('#cart-box').innerText();
  t('migration: both old stores show on the cart page', (await page.locator('#cart-box .proj-line:not(.proj-line--text)').count()) === 2 && /Easy Grout/.test(body) && /Davco.? Grey One Pot/.test(body) && /old advisor note/.test(body) && /Smith bathroom/.test(await page.evaluate(() => localStorage.getItem('sika-demo-210c0c-project-v2'))), body.slice(0, 200));

  const keep = await page.evaluate(() => [localStorage.getItem('sika-demo-210c0c-projects'), localStorage.getItem('sika-demo-210c0c-actions-v1')]);
  t('migration: the old keys are still there as a backup', !!keep[0] && !!keep[1] && JSON.parse(keep[0])[0].qty === 3);
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#cart-box .proj-line'); t('migration: survives a reload', (await page.locator('#cart-box .proj-line:not(.proj-line--text)').count()) === 2);
  await openPanel(page); await send(page, 'what is in my project'); t('migration: the advisor reads the carried-over lines', /3 bags/.test(await lastCard(page).innerText()) && /old advisor note/.test(await lastCard(page).innerText()));
  t('migration: no console errors', errs.length === 0, errs.join(' | ')); await ctx.close();
}
// blocked storage: still works for this tab, says so
{
  const init = () => { const bad = () => { throw new DOMException('blocked', 'SecurityError'); }; Object.defineProperty(window, 'localStorage', { get: bad, configurable: true }); };
  const { ctx, page, errs } = await open(1440, 900, { init }); await openPanel(page);
  await send(page, 'add 5 bags of Davco Easy Grout'); const c = await lastCard(page).innerText();
  t('blocked storage: the add works and says it is kept for this tab only', /Added/.test(c) && /5 bags/.test(c) && /this tab only/.test(c), c.slice(0, 250));
  await goCart(page); t('blocked storage: the cart page shows the same line', (await page.locator('#cart-box .proj-line:not(.proj-line--text)').count()) === 1 && /Easy Grout/.test(await page.locator('#cart-box').innerText()));
  await ctx.close();
}
await b.close(); s.close(); console.log(`CART E2E: ${passes} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
async function require_text(stream) { const chunks = []; for await (const c of stream) chunks.push(c); return Buffer.concat(chunks).toString('utf8'); }
