// Browser checks for the sales engine (Windows node + Windows Chrome): node.exe e2e_sales.mjs [portalDir] [pdfDir]
// Add two products by chat, "get me a quote", the whole intake, confirm, the pack (sheet, copy, email link, print to PDF), the stockist and rep routes,
// the quotes log on the cart page, the anonymous export, staleness after a cart edit, clearing the project; at 1366 wide and at 390 wide with touch.
// Also: no request but GET to the demo's own host, no console errors, touch targets, no sideways scroll, and the one-page proof for 2, 5, 10, 18 and 30 lines.
import fs from 'node:fs';
import { serve, launch } from '../sika-actions/_browser.mjs';
import { PORTAL } from '../sika-actions/_benv.mjs';
import { createProjectStore, KEY } from '../../public/demo/sika-210c0c/assets/lib/projectstore.js';
import * as Q from '../../public/demo/sika-210c0c/assets/actions/quote.js';
const PDF = process.argv[3] || 'C:\\Users\\tech2\\AppData\\Local\\Temp\\kk_sales_pdf';
const s = await serve(process.argv[2] || PORTAL); const b = await launch(); let fails = 0, passes = 0;
const t = (n, ok, d = '') => { if (ok) passes++; else fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (!ok && d ? ' :: ' + String(d).slice(0, 300) : '')); };
const ESTIMATE = 'Estimate only, not an offer. Quantities, not prices. Confirm with the product data sheet and Sika Technical Services before ordering.';
async function open(W, H, { init, hash = '#/' } = {}) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage(); const errs = [], reqs = [];
  await page.addInitScript(() => { window.__printed = 0; window.__sikaKeepPrint = true; window.print = () => { window.__printed++; }; });
  if (init) await page.addInitScript(init);
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.text().slice(0, 160)); }); page.on('pageerror', (e) => errs.push(e.message));
  page.on('request', (r) => reqs.push([r.method(), r.url()]));
  await page.goto(s.base + hash, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(300);
  return { ctx, page, errs, reqs };
}
const openPanel = async (page) => { if (await page.locator('#assistant.open').count()) return; if (await page.locator('#asst-fab').isVisible()) await page.click('#asst-fab'); else await page.locator('#mbar-ask, #tri-advisor').locator('visible=true').first().click(); await page.waitForSelector('#assistant.open'); };
const send = async (page, text) => { const before = await page.locator('.msg--bot').count(); await page.fill('#asst-q', text); await page.keyboard.press('Enter'); await page.waitForFunction((n) => document.querySelectorAll('.msg--bot').length > n && !document.querySelector('.typing'), before, { timeout: 20000 }); await page.waitForTimeout(120); };
const chip = async (page, label) => { const before = await page.locator('.msg--bot').count(); await page.locator('.msg--bot').last().locator('button.chip', { hasText: label }).first().click(); await page.waitForFunction((n) => document.querySelectorAll('.msg--bot').length > n && !document.querySelector('.typing'), before, { timeout: 20000 }); await page.waitForTimeout(120); };
const last = (page) => page.locator('.msg--bot').last();
const closePanel = async (page) => { await page.evaluate(() => { document.querySelector('#assistant button[aria-label^="Close"]')?.click(); }); await page.waitForTimeout(300); };
const a11y = async (page, where, sz, root) => { // headings, labels, names, table headers, targets: the same checks a11y.mjs makes, on a state that has quote content in it
  const r = await page.evaluate((sel) => {
    const el = document.querySelector(sel); const vis = (e) => { const b = e.getBoundingClientRect(); const st = getComputedStyle(e); return b.width > 0 && b.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; };
    const hs = [...el.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis).map((x) => +x.tagName[1]); let skip = null; for (let i = 1; i < hs.length; i++) if (hs[i] > hs[i - 1] + 1) { skip = `h${hs[i - 1]} then h${hs[i]}`; break; }
    const lab = (e) => e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title') || (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) || e.closest('label');
    return { h1: hs.filter((x) => x === 1).length, skip, unlabelled: [...el.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(vis).filter((e) => !lab(e)).length,
      noName: [...el.querySelectorAll('button,a[href]')].filter(vis).filter((e) => !(e.innerText || '').trim() && !e.getAttribute('aria-label') && !e.getAttribute('title')).length,
      thNoScope: [...el.querySelectorAll('table th')].filter((e) => !e.getAttribute('scope')).length, tablesNoLabel: [...el.querySelectorAll('table')].filter((e) => !e.getAttribute('aria-labelledby') && !e.getAttribute('aria-label') && !e.querySelector('caption')).length,
      ariaHidden: [...el.querySelectorAll('[aria-hidden=true]')].filter((e) => e.matches('button,a,input,select,textarea') || e.querySelector('button,a[href],input')).length };
  }, root);
  t(`${sz} a11y ${where}: no more than one h1, no skipped level`, r.h1 <= 1 && !r.skip, JSON.stringify(r));
  t(`${sz} a11y ${where}: every field is labelled, every button and link has a name`, r.unlabelled === 0 && r.noName === 0, JSON.stringify(r));
  t(`${sz} a11y ${where}: table headers have a scope and tables are named`, r.thNoScope === 0 && r.tablesNoLabel === 0, JSON.stringify(r));
  t(`${sz} a11y ${where}: nothing focusable is hidden from assistive tech`, r.ariaHidden === 0, JSON.stringify(r));
};
const win = (p) => p.replace(/\//g, '\\');

for (const [W, H, label] of process.argv[4] === 'print' ? [] : [[1366, 768, 'desktop'], [390, 844, 'touch']]) { // a fourth argument 'print' runs only the one-page proof
  const sz = `${W}x${H}`;
  const { ctx, page, errs, reqs } = await open(W, H);
  await openPanel(page);
  // 1. two products by chat
  await send(page, 'add 4 bags of Davco Easy Grout');
  await send(page, '/calc 20 m2 Davco Grey One Pot adhesive 6 mm notch');
  t(`${sz} the quantity card offers the quote button once the project has a product`, (await last(page).locator('button.chip', { hasText: 'Request a quote' }).count()) === 1);
  await chip(page, 'Add to my project');
  t(`${sz} two products are in the project`, /Added/.test(await last(page).innerText()));
  // 2. start by chat
  await send(page, 'get me a quote');
  let c = last(page); let txt = await c.innerText();
  t(`${sz} the intake lists both lines and says how it works`, /Step 1 of 13/.test(txt) && /Easy Grout/.test(txt) && /Grey One Pot/.test(txt) && /skip/.test(txt) && /Estimate only, not an offer/.test(txt), txt.slice(0, 300));
  t(`${sz} the front-loaded reason is on the card`, /no prices are shown here and nothing is ordered/.test(txt));
  await chip(page, 'Yes, that is the list');
  t(`${sz} site step front-loads why we ask`, /uses the site to point you to the right branch/.test(await last(page).innerText()));
  await send(page, '12'); t(`${sz} a bad postcode is refused in plain words`, /could not read that as a postcode/.test(await last(page).innerText()));
  await send(page, 'Brisbane 4000');
  await send(page, 'in 3 weeks');
  await chip(page, 'Delivery to site');
  await chip(page, 'Builder or contractor');
  await send(page, 'Acme Builders');
  await send(page, 'Sam Smith');
  await send(page, 'sam at acme'); t(`${sz} a bad email is refused and the step stays`, /@ and a domain/.test(await last(page).innerText()) && /Step 8 of 13/.test(await last(page).innerText()));
  await send(page, 'sam@acme.com.au');
  await chip(page, 'Skip'); // phone
  await chip(page, 'Mornings');
  await send(page, 'Grout colour to confirm');
  t(`${sz} the consent line is on the card`, /Sika's team will reply by email or phone; nothing is ordered; no prices are shown here\./.test(await last(page).innerText()));
  await chip(page, 'Yes, I am happy with that');
  txt = await last(page).innerText();
  t(`${sz} the check lists every answer and ends on the permission close`, /Brisbane 4000/.test(txt) && /sam@acme\.com\.au/.test(txt) && /Mornings/.test(txt) && /would it be okay if I prepared the quote request now\?/.test(txt), txt.slice(0, 400));
  // an edit before confirming
  await chip(page, 'No, I want to change something'); await chip(page, 'Change name'); await send(page, 'Samantha Smith');
  t(`${sz} an edit returns to the check with the new value`, /Samantha Smith/.test(await last(page).innerText()) && /Step 13 of 13/.test(await last(page).innerText()));
  await chip(page, 'Yes, prepare the request');
  // 3. the pack
  c = last(page); txt = await c.innerText();
  const ref = (/SQ-\d{8}-[0-9A-Z]{4}/.exec(txt) || [''])[0];
  t(`${sz} the pack shows a reference SQ-YYYYMMDD-XXXX and the demo banner`, !!ref && /Demo: this prepares the request; it is not sent to Sika's systems from here\./.test(txt), txt.slice(0, 200));
  await c.locator('details.qr-preview summary').click();
  t(`${sz} the pack has the one-page sheet with the estimate sentence`, (await c.locator('.qr-sheet').count()) === 1 && (await c.locator('.qr-est').innerText()) === ESTIMATE);
  t(`${sz} the sheet cites the coverage line and shows no price`, /cover approximately/.test(await c.locator('.qr-sheet').innerText()) && !/\$/.test(await c.locator('.qr-sheet').innerText()));
  const mail = await c.locator('a.qr-mail').getAttribute('href');
  const body = decodeURIComponent((/body=(.*)$/.exec(mail) || [])[1] || '');
  t(`${sz} the email link goes to the one published address with the whole request`, mail.startsWith('mailto:au.technical@au.sika.com?subject=') && body.includes(ref) && /Easy Grout/.test(body) && /Grey One Pot/.test(body) && body.includes(ESTIMATE) && /Samantha Smith/.test(body), mail.slice(0, 120));
  await c.locator('button.qr-copy').click(); await page.waitForTimeout(200);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  t(`${sz} Copy puts the whole request on the clipboard`, clip.includes(ref) && clip.includes(ESTIMATE) && clip.replace(/\r\n/g, '\n') === body, clip.slice(0, 80));
  await c.locator('button.qr-print').click(); await page.waitForTimeout(250);
  t(`${sz} Download opens the print dialog on the sheet alone`, (await page.evaluate(() => window.__printed)) === 1 && (await page.locator('#qr-print .qr-sheet').count()) === 1 && (await page.evaluate(() => document.body.classList.contains('printing-quote'))));
  fs.mkdirSync(PDF, { recursive: true });
  await page.pdf({ path: `${PDF}\\${label}_two_lines.pdf`, preferCSSPageSize: true, printBackground: true });
  await page.evaluate(() => { document.body.classList.remove('printing-quote'); document.getElementById('qr-print')?.remove(); });
  await a11y(page, 'advisor pack card', sz, '#assistant .quote-card');
  t(`${sz} the pack offers the stockist and rep routes with the postcode`, (await c.locator('button.chip', { hasText: 'Find a stockist near 4000' }).count()) === 1 && (await c.locator('button.chip', { hasText: 'Talk to a Sika rep' }).count()) === 1);
  if (W < 600) {
    const over = await page.evaluate(() => { const a = document.querySelector('#assistant'); const sh = document.querySelector('#assistant .qr-sheet'); return { box: a.scrollWidth - a.clientWidth, sheet: sh.scrollWidth - sh.clientWidth }; });
    t(`${sz} no sideways scroll in the panel or the sheet`, over.box <= 1 && over.sheet <= 1, JSON.stringify(over));
    const small = await page.evaluate(() => [...document.querySelectorAll('#assistant .quote-card button, #assistant .quote-card a.chip')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 40; }).map((e) => (e.textContent || '').slice(0, 30) + ':' + Math.round(e.getBoundingClientRect().height)));
    t(`${sz} touch targets on the quote card are at least 40 px high`, small.length === 0, small.join(', '));
  }
  // 4. stockist and rep
  await chip(page, 'Find a stockist near 4000');
  txt = await last(page).innerText();
  t(`${sz} the stockist card links the published where-to-buy page and names no stockist`, /find a stockist near 4000/i.test(txt) && (await last(page).locator('a[href="https://aus.sika.com/en/where-to-buy.html"]').count()) >= 1 && /do not list one/.test(txt), 'LINKS ' + await last(page).locator('a').evaluateAll((as) => as.map((x) => x.getAttribute('href')).join(' ')));
  await chip(page, 'Talk to a Sika rep');
  txt = await last(page).innerText();
  t(`${sz} the rep card cites the published routes and admits no state offices are held`, /au\.technical@au\.sika\.com/.test(txt) && /1300 22 33 48/.test(txt) && /Wetherill Park/.test(txt) && /no state office contacts/.test(txt), txt.slice(0, 300));
  // 5. the cart page
  await closePanel(page); await page.goto(s.base + '#/projects'); await page.waitForSelector('#quote-log', { timeout: 15000 });
  await a11y(page, 'cart page with quotes', sz, 'main');
  const row = await page.locator('#quote-log tbody tr').first().innerText();
  t(`${sz} the quotes log shows reference, date, products, postcode`, row.includes(ref) && /Easy Grout/.test(row) && /4000/.test(row) && /Prepared in this demo, not sent/.test(row), row);
  t(`${sz} the log holds no name or email`, !/Samantha|sam@acme|0412|Acme/.test(await page.locator('#quote-section').innerText()));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#quote-export')]);
  const exp = fs.readFileSync(await dl.path(), 'utf8'); const sig = JSON.parse(exp);
  t(`${sz} the exported demand signal is anonymous JSON`, sig.requests === 1 && sig.rows[0].postcode === '4000' && sig.rows[0].state === 'QLD' && !/Samantha|sam@acme|0412|Acme|Mornings|Brisbane/.test(exp), exp.slice(0, 200));
  await page.locator('#quote-log button', { hasText: 'Print' }).first().click(); await page.waitForTimeout(250);
  t(`${sz} Print on the log opens the sheet for that request`, (await page.evaluate(() => window.__printed)) === 2 && (await page.locator('#qr-print .qr-sheet').getAttribute('data-ref')) === ref);
  await page.evaluate(() => { document.body.classList.remove('printing-quote'); document.getElementById('qr-print')?.remove(); });
  // 6. a cart edit makes it out of date, in the log and in the chat
  await page.locator('#cart-box .proj-line .qty button:has-text("+")').first().click(); await page.waitForTimeout(300);
  t(`${sz} a cart edit marks the request out of date in the log`, /Out of date/.test(await page.locator('#quote-log tbody tr').first().innerText()));
  await openPanel(page); await send(page, '/quote show ' + ref);
  t(`${sz} and the pack in the chat says it no longer matches`, /out of date/i.test(await last(page).innerText()) && (await last(page).locator('a.qr-mail').count()) === 0, (await last(page).innerText()).slice(0, 200));
  await closePanel(page);
  // 7. it survives a reload; "Request a quote" on the cart page opens the intake in the advisor
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#quote-log', { timeout: 15000 });
  t(`${sz} the log survives a reload`, (await page.locator('#quote-log tbody tr').count()) === 1);
  await page.click('#quote-open'); await page.waitForSelector('#assistant.open'); await page.waitForFunction(() => /Quote request: Project/i.test(document.querySelector('#assistant')?.textContent || ''), null, { timeout: 15000 });
  t(`${sz} the cart page button opens the intake`, /Step 1 of 13/.test(await last(page).innerText()));
  await send(page, 'cancel'); t(`${sz} cancel leaves the project and the request as they were`, /stopped/i.test(await last(page).innerText()));
  await closePanel(page);
  // 8. clearing the project clears the log
  await page.locator('#cart-box button:has-text("Clear project")').first().click().catch(() => {}); await page.waitForTimeout(400);
  if (await page.locator('#cart-box button:has-text("Yes")').count()) { await page.locator('#cart-box button:has-text("Yes")').first().click(); await page.waitForTimeout(300); }
  t(`${sz} clearing the project clears the quotes log`, (await page.locator('#quote-log').count()) === 0 && /Add products above first/.test(await page.locator('#quote-section').innerText()), await page.locator('#quote-section').innerText());
  // 9. privacy and health of the run
  t(`${sz} only GET requests, all to the demo's own host (nothing posts to Sika, nothing leaves)`, reqs.every(([m, u]) => m === 'GET' && (new URL(u).host === new URL(s.base).host || u.startsWith('data:'))), JSON.stringify(reqs.filter(([m, u]) => m !== 'GET' || new URL(u).host !== new URL(s.base).host).slice(0, 3)));
  t(`${sz} no console errors or warnings`, errs.length === 0, errs.join(' | '));
  const stored = await page.evaluate((key) => { const o = {}; for (const [k, v] of Object.entries(localStorage)) o[k] = v; try { const st = JSON.parse(o[key]); o[key] = JSON.stringify({ recent: st.recent, gaps: st.gaps }); } catch { /* none */ } return JSON.stringify(o); }, KEY);
  t(`${sz} the typed email and name were never kept as a question, a gap or in the insights`, !/sam@acme|Samantha|Sam Smith/.test(stored), stored.slice(0, 200));
  await ctx.close();
}

// ---- the one-page proof: 2, 5, 10, 18 and 30 lines, real Chrome print to PDF (page counts are read by print_pages.py)
for (const n of [2, 5, 10, 18, 30]) {
  const clock = () => new Date('2026-11-01T12:00:00Z'); const mem = new Map(); const store = createProjectStore({ getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) }, clock);
  for (let i = 0; i < n; i++) store.addItem({ id: 'p' + i, name: `Sikafloor Example Product Number ${i + 1} long name`, qty: 3 + i, unit: i % 2 ? 'bag' : 'pack', packs: '2 x 20 kg + 1 x 10 kg', need: '55.5 kg', basis: 'area 100 m2, thickness 3 mm', url: 'https://aus.sika.com/en/construction/example/data-sheet-' + i + '.pdf', phrase: 'will cover approximately 4.5 m2 per 20 kg bag at 3 mm thickness when used as directed in the data sheet' });
  const docs = Array.from({ length: Math.min(40, n * 2) }, (_, i) => ({ product: 'Product ' + i, kind: i % 2 ? 'Safety data sheet' : 'Data sheet', title: 'Doc ' + i, url: 'https://aus.sika.com/en/documents/doc-' + i + '-with-a-long-file-name-for-the-pdf.pdf' }));
  const rec = Q.buildRecord({ project: store.currentProject(), answers: { site: { postcode: '2164', suburb: 'Wetherill Park', text: 'Wetherill Park 2164' }, needed: { iso: '2026-11-20', text: '20 November 2026' }, delivery: 'delivery', role: 'Builder or contractor', company: 'Acme Builders Pty Ltd', name: 'Samantha Smith', email: 'sam@acme.com.au', phone: '0412 345 678', best: 'Mornings', notes: 'Access is through the rear lane. Grout colour to be confirmed with the owner on site before ordering anything at all.' }, now: clock(), docs });
  store.addQuote(rec);
  const raw = mem.get(KEY);
  const { ctx, page } = await open(1366, 768, { init: `localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(raw)})`, hash: '#/projects' });
  await page.waitForSelector('#quote-log', { timeout: 15000 });
  await page.locator('#quote-log button', { hasText: 'Print' }).first().click(); await page.waitForTimeout(250);
  const shown = (await page.locator('#qr-print .qr-sheet').count()) === 1;
  await page.pdf({ path: `${PDF}\\lines_${n}.pdf`, preferCSSPageSize: true, printBackground: true });
  t(`print proof: ${n} lines rendered the sheet`, shown);
  await ctx.close();
}
await b.close(); s.close();
console.log(`SALES E2E: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
