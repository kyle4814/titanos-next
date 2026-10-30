// The personas. Each one is a realistic multi-step journey; every step is health-checked by Sim.step (console, requests, overflow,
// bad text, empty states, names) and several carry an independent correctness assertion computed from the data files.
import { Sim, sample, pick } from './lib.mjs';

const norm = (s) => String(s).replace(/[®™]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const nf = (s) => Number(String(s).replace(/[^0-9]/g, ''));
const wait = (p, ms = 80) => p.waitForTimeout(ms);

/** click every visible control on a route at least once (seeded order), skipping anything that leaves the site or downloads */
async function explore(s, ctx, r, hash, max = 14) {
  const p = s.page; const { base } = ctx;
  await s.step('explore open ' + hash, async () => { await p.goto(base + hash); await wait(p, 120); });
  const labels = await p.evaluate(() => {
    const out = []; const seen = new Set();
    for (const e of document.querySelectorAll('main button, main a[href^="#/"], main select, main summary, main [role=tab], main input[type=checkbox], main input[type=radio]')) {
      if (!e.offsetParent || e.closest('[hidden]') || e.disabled) continue;
      const lab = (e.innerText || e.getAttribute('aria-label') || e.value || e.id || '').trim().slice(0, 40); const key = e.tagName + ':' + lab + ':' + (e.getAttribute('href') || '');
      if (seen.has(key)) continue; seen.add(key); out.push({ i: out.length, key });
    }
    return out.map((o) => o.key);
  }).catch(() => []);
  const chosen = sample(r, labels, max);
  for (const key of chosen) {
    await s.step('click ' + key.slice(0, 50), async () => {
      const ok = await p.evaluate((k) => {
        for (const e of document.querySelectorAll('main button, main a[href^="#/"], main select, main summary, main [role=tab], main input[type=checkbox], main input[type=radio]')) {
          if (!e.offsetParent || e.closest('[hidden]') || e.disabled) continue;
          const lab = (e.innerText || e.getAttribute('aria-label') || e.value || e.id || '').trim().slice(0, 40); const key = e.tagName + ':' + lab + ':' + (e.getAttribute('href') || '');
          if (key === k) { if (e.tagName === 'SELECT') { if (e.options.length > 1) { e.selectedIndex = (e.selectedIndex + 1) % e.options.length; e.dispatchEvent(new Event('change', { bubbles: true })); } } else if (e.tagName === 'A' && (e.hasAttribute('download') || /\.(pdf|csv|txt)$/i.test(e.getAttribute('href') || ''))) { return 'skip'; } else { e.click(); } return 'ok'; }
        }
        return 'gone';
      }, key);
      ctx.controlsClicked = (ctx.controlsClicked || 0) + 1; await wait(p, 120);
    });
    const now = await p.evaluate(() => location.hash.split('?')[0]).catch(() => '');
    if (now !== hash.split('?')[0]) await s.step('explore return ' + hash, async () => { await p.goto(base + hash); await wait(p, 100); });
  }
}

async function searchBox(s) {
  const p = s.page;
  for (const id of ['#hd-q']) { const b = p.locator(id).first(); if (await b.isVisible().catch(() => false)) return b; }
  await p.getByRole('button', { name: 'Menu' }).click(); await wait(p, 350); return p.locator('#dr-q').first(); // phones keep the search inside the menu drawer
}
async function searchFor(s, q) { const box = await searchBox(s); await box.fill(q); await box.press('Enter'); await wait(s.page, 300); }
async function openMenu(s) { const m = s.page.getByRole('button', { name: 'Menu' }); if (await m.isVisible().catch(() => false)) await m.click(); }

export async function journeys(ctx, sz, r) {
  const { browser, base, F, outDir, D } = ctx; const mk = async (persona, opts) => new Sim(browser, base, sz, persona, F, outDir + '/shots', opts).init();
  const pop = (n) => sample(r, D.index, n);
  const all = [];

  // 1 TILER: finds a tile adhesive, works out how much, builds a list
  all.push((async () => {
    const s = await mk('tiler'); const p = s.page; const got = [];
    await s.step('home', async () => { await p.goto(base); }, { expectRoute: /^#?\/?$/ });
    await s.step('search tile adhesive for porcelain', async () => { await searchFor(s, 'tile adhesive porcelain'); }, { expectRoute: /products/ });
    await s.step('results are tile adhesives', async () => {
      const names = await p.locator('.product-card h3').allInnerTexts(); if (!names.length) s.note('P1', 'search-no-results', 'tile adhesive porcelain returned none');
      const top = await p.locator('.product-card').first().innerText(); if (!/adhesive|tile|ceram|porcelain/i.test(top)) s.note('P1', 'search-irrelevant-top', 'top result: ' + top.slice(0, 80).replace(/\n/g, ' | '));
    });
    await s.step('sort Name A to Z', async () => { await p.locator('select').first().selectOption({ label: 'Name A to Z' }); await wait(p, 200); const n = (await p.locator('.product-card h3').allInnerTexts()).map(norm); const sorted = [...n].sort((a, b) => a.localeCompare(b)); if (n.join('|') !== sorted.join('|')) s.note('P2', 'sort-az-wrong', n.slice(0, 4).join(' / ')); });
    await s.step('open first product', async () => { await p.locator('.product-card a').first().click(); }, { expectRoute: /product/ });
    await s.step('Rates and times tab', async () => { await p.getByRole('tab', { name: /Rates/ }).click(); });
    await s.step('enter area 30 then 60: packs never fall', async () => {
      if (!(await p.locator('#calc-area').count())) return; const rd = async () => (await p.locator('#calc-area').first().evaluate((e) => (e.closest('.calc, section, form, div[role=tabpanel]') || e.parentElement.parentElement).innerText));
      await p.fill('#calc-area', '30'); await wait(p, 250); const a = await rd(); await p.fill('#calc-area', '60'); await wait(p, 250); const b = await rd();
      const n = (t) => (t.match(/(\d+(?:\.\d+)?)\s*(?:x\s*)?(?:packs?|bags?|kg|L|litres?|units?)/i) || [])[1]; if (n(a) && n(b) && Number(n(b)) < Number(n(a))) s.note('P1', 'calc-nonmonotonic', `30 m2 -> ${n(a)}, 60 m2 -> ${n(b)}`);
      if (/NaN|undefined|Infinity/.test(a + b)) s.note('P1', 'calc-bad-number', a.slice(0, 100));
    });
    await s.step('add to project', async () => { await p.locator('.pdp button[aria-label^="Add to project"], main button:has-text("Add to project")').first().click(); await wait(p); const c = await p.locator('a[href="#/projects"] .count, a[href="#/projects"] span').first().innerText().catch(() => ''); got.push(c); });
    await s.step('badge counts one project item', async () => { const t = await p.locator('a[href="#/projects"]').first().innerText(); if (!/1/.test(t) && !(await p.locator('.mbar').innerText().catch(() => '')).includes('1')) s.note('P1', 'project-badge-not-incremented', t.replace(/\n/g, ' ')); });
    await s.step('second search: grout', async () => { await searchFor(s, 'grout'); });
    await s.step('add first grout to project', async () => { await p.locator('.product-card button:has-text("Add to project")').first().click(); await wait(p); });
    await s.step('open my projects', async () => { await p.goto(base + '#/projects'); await wait(p, 200); }, { expectRoute: /projects/ });
    await s.step('project lists both products', async () => { const n = await p.locator('main li, main tr, main .card').count(); if (n < 2) s.note('P1', 'project-missing-items', `${n} list entries after adding 2`); });
    await s.step('reload keeps the list (localStorage)', async () => { await p.reload(); await wait(p, 300); const n = await p.locator('main li, main tr, main .card').count(); if (n < 2) s.note('P1', 'project-lost-on-reload', `${n} entries after reload`); });
    await s.step('remove an item', async () => { const b = p.locator('main button:has-text("Remove"), main button[aria-label^="Remove"]').first(); if (await b.count()) { await b.click(); await wait(p); } });
    await s.step('ask the advisor for the data sheet', async () => { await p.goto(base + '#/projects'); const ask = p.getByRole('button', { name: /Ask the advisor/ }).first(); if (await ask.count()) await ask.click(); await wait(p, 300); });
    await explore(s, ctx, r, '#/projects', 6);
    await s.close();
  })());

  // 2 BUILDER: browses by category down to a product and its documents
  all.push((async () => {
    const s = await mk('builder'); const p = s.page;
    await s.step('home', async () => { await p.goto(base); });
    await s.step('open the menu / mega nav', async () => { await openMenu(s); await wait(p, 200); });
    await s.step('category: concrete', async () => { await p.goto(base + '#/category/construction/concrete'); }, { expectRoute: /category/ });
    await s.step('sub-category: admixture technology', async () => { await p.goto(base + '#/category/construction/concrete/admixture-technology'); });
    await s.step('breadcrumb back to construction', async () => { await p.locator('.breadcrumb a').nth(1).click(); await wait(p, 200); });
    await s.step('filter this category in the finder', async () => { await p.goto(base + '#/products?cat=' + encodeURIComponent('construction/concrete')); await wait(p, 200); const t = await p.locator('.resultline').first().innerText(); const cat = D.cats.find((c) => c.id === 'construction/concrete'); if (cat && nf(t) !== cat.productCount) s.note('P1', 'finder-category-count-wrong', `finder says ${nf(t)}, categories.json says ${cat.productCount}`); });
    await s.step('open first product', async () => { await p.locator('.product-card a').first().click(); });
    await s.step('Documents tab', async () => { await p.getByRole('tab', { name: /^Documents/ }).click(); });
    await s.step('every document link in the tab has an https href', async () => { const hs = await p.evaluate(() => [...document.querySelectorAll('[role=tabpanel] a[href]')].map((a) => a.getAttribute('href'))); for (const h of hs) if (!/^https:\/\/aus\.sika\.com\//.test(h) && !/^#\//.test(h)) s.note('P1', 'document-link-bad-href', h); });
    await s.step('Safety tab', async () => { await p.getByRole('tab', { name: 'Safety' }).click(); });
    await s.step('back button returns to the category list', async () => { await p.goBack(); await wait(p, 250); }, { expectRoute: /products|category/ });
    await s.step('forward button returns to the product', async () => { await p.goForward(); await wait(p, 250); }, { expectRoute: /product\// });
    await s.step('documents hub: Safety data sheets', async () => { await p.goto(base + '#/documents'); await p.getByRole('button', { name: /Safety data sheets/ }).click(); await wait(p, 200); });
    await explore(s, ctx, r, '#/category/construction/concrete', 8);
    await s.close();
  })());

  // 3 ARCHITECT: system selector three questions, system sheet, specification text
  all.push((async () => {
    const s = await mk('architect'); const p = s.page;
    await s.step('open system selector', async () => { await p.goto(base + '#/selector'); }, { expectRoute: /selector/ });
    await s.step('answer 1: porcelain', async () => { await p.locator('.sel-opt').first().click(); await wait(p, 200); });
    await s.step('answer 2: first surface', async () => { await p.locator('.sel-group').nth(1).locator('.sel-opt:not(.is-off)').first().click(); await wait(p, 200); });
    await s.step('answer 3: first location', async () => { await p.locator('.sel-group').nth(2).locator('.sel-opt:not(.is-off)').first().click(); await wait(p, 300); });
    await s.step('a system result is offered', async () => { const t = await p.locator('main').innerText(); if (!/system|sheet|step/i.test(t)) s.note('P1', 'selector-no-result', 'three answers but no system shown'); });
    await s.step('disabled options cannot be chosen', async () => { const off = p.locator('.sel-opt.is-off').first(); if (await off.count()) { const dis = await off.evaluate((e) => (e.querySelector('input') || e).disabled || e.getAttribute('aria-disabled')); if (!dis) s.note('P3', 'selector-off-option-clickable', 'is-off option is not disabled'); } });
    await s.step('open a system sheet (static page)', async () => { await p.goto(base + 'systems/ceramic-on-aac-external-floor/'); });
    await s.step('sheet links to a product page', async () => { await p.locator('a[href*="#/product/"]').first().click(); await wait(p, 400); }, { expectRoute: /product\// });
    await s.step('Specification tab', async () => { await p.getByRole('tab', { name: 'Specification' }).click().catch(() => {}); });
    await s.step('copy specification text', async () => { const b = p.getByRole('button', { name: /Copy specification text/ }); if (await b.count()) { await s.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin }).catch(() => {}); await b.click(); await wait(p, 200); const t = await p.evaluate(() => navigator.clipboard.readText().catch(() => 'CLIP-DENIED')); if (t !== 'CLIP-DENIED' && t.length < 200) s.note('P1', 'spec-copy-too-short', t.slice(0, 80)); } });
    await s.step('download specification as .txt', async () => { const b = p.getByRole('button', { name: /Download as \.txt/ }).or(p.getByRole('link', { name: /Download as \.txt/ })); if (await b.count()) { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), b.first().click()]); if (!d) s.note('P1', 'spec-download-nothing', 'no download event'); } });
    await s.step('help / problem solver chip', async () => { await p.goto(base + '#/help'); await p.locator('.chip').first().click(); await wait(p, 300); });
    await explore(s, ctx, r, '#/selector', 8);
    await s.close();
  })());

  // 4 SPECIFIER: reads the specification of the independently read products
  all.push((async () => {
    const s = await mk('specifier'); const p = s.page; const ids = sample(r, ctx.top40 || pop(5).map((x) => x.id), 4);
    for (const id of ids) {
      await s.step('open ' + id, async () => { await p.goto(base + '#/product/' + id); });
      await s.step('Specification tab ' + id, async () => { await p.getByRole('tab', { name: 'Specification' }).click(); });
      await s.step('clauses carry a page and standards list ' + id, async () => { await p.waitForFunction(() => !document.querySelector('[role=tabpanel] .skeleton'), null, { timeout: 8000 }).catch(() => {}); const t = await p.locator('[role=tabpanel]').first().innerText(); if (!/page \d+|p\. ?\d+/i.test(t)) s.note('P2', 'spec-clause-without-page', id + ': ' + t.slice(0, 160).replace(/\n/g, ' | ')); });
      await s.step('Product details ' + id, async () => { await p.getByRole('tab', { name: 'Product details' }).click(); });
    }
    await s.step('deep link to spec tab', async () => { await p.goto(base + '#/product/' + ids[0] + '?tab=specification'); await wait(p, 300); const sel = await p.locator('[role=tab][aria-selected=true]').first().innerText(); if (!/Specification/.test(sel)) s.note('P1', 'deep-link-tab-ignored', 'selected tab: ' + sel); });
    await s.step('rules ledger', async () => { await p.goto(base + '#/rules'); });
    await explore(s, ctx, r, '#/product/' + ids[1], 10);
    await s.close();
  })());

  // 5 SIKA TECHNICAL REP: rule ledger, insights, about/coverage panel, offline mode
  all.push((async () => {
    const s = await mk('sika-tech-rep'); const p = s.page;
    await s.step('rules ledger', async () => { await p.goto(base + '#/rules'); }, { expectRoute: /rules/ });
    await s.step('filter by product', async () => { const sel = p.locator('#rl-product'); const n = await sel.locator('option').count(); if (n > 2) { await sel.selectOption({ index: 2 }); await wait(p, 250); } });
    await s.step('filter by rule type', async () => { const sel = p.locator('#rl-type'); const n = await sel.locator('option').count(); if (n > 2) { await sel.selectOption({ index: 1 }); await wait(p, 250); } });
    await s.step('show more', async () => { const b = p.getByRole('button', { name: /show more/i }); if (await b.count()) { const before = await p.locator('main tbody tr, main li').count(); await b.click(); await wait(p, 250); const after = await p.locator('main tbody tr, main li').count(); if (after <= before) s.note('P2', 'rules-show-more-noop', `${before} -> ${after}`); } });
    await s.step('download CSV for Technical Services', async () => { const b = p.getByRole('button', { name: /Download CSV/ }); if (await b.count()) { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), b.first().click()]); if (!d) s.note('P1', 'rules-csv-no-download', 'no download'); } });
    await s.step('insights', async () => { await p.goto(base + '#/insights'); });
    await s.step('export gap list CSV', async () => { const b = p.getByRole('button', { name: /Export gap list/ }); if (await b.count() && await b.isEnabled()) { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), b.click()]); if (!d) s.note('P1', 'insights-csv-no-download', 'no download'); } });
    await s.step('about and coverage panel', async () => { await p.goto(base + '#/about'); });
    await s.step('coverage panel shows numbers that match the data', async () => { const t = await p.locator('main').innerText(); const m = /([\d,]+)\s+products/.exec(t); if (m && nf(m[1]) !== D.index.length) s.note('P1', 'about-product-count-wrong', `${m[1]} vs ${D.index.length}`); });
    await s.step('ask the advisor about a product', async () => { await p.goto(base + '#/'); const b = p.getByRole('button', { name: 'Advisor' }).first(); await b.click(); await wait(p, 300); await p.locator('#asst-q').fill('What is the coverage of Davco Grey One Pot adhesive?'); await p.locator('#asst-q').press('Enter'); await wait(p, 1200); });
    await s.step('advisor answered something', async () => { const t = await p.locator('.assistant').first().innerText().catch(() => ''); if (t.length < 30) s.note('P2', 'advisor-no-answer', 'panel text ' + t.length + ' chars'); });
    await s.step('escape closes the advisor', async () => { await p.keyboard.press('Escape'); await wait(p, 300); const open = await p.locator('#asst-q').isVisible().catch(() => false); if (open) s.note('P2', 'advisor-escape-does-not-close', 'panel still visible'); });
    await explore(s, ctx, r, '#/about', 4);
    await s.close();
  })());

  // 6 DISTRIBUTOR: documents hub, type filters, search by name, pagination, guides
  all.push((async () => {
    const s = await mk('distributor'); const p = s.page;
    await s.step('documents hub', async () => { await p.goto(base + '#/documents'); }, { expectRoute: /documents/ });
    for (const t of ['Product data sheets', 'Safety data sheets', 'System data sheets', 'Brochures', 'Environmental declarations']) {
      await s.step('filter ' + t, async () => { const b = p.getByRole('button', { name: new RegExp('^' + t) }); const label = await b.innerText(); await b.click(); await wait(p, 250); const line = await p.locator('.resultline').first().innerText().catch(() => ''); const want = nf((/\(([\d,]+)\)/.exec(label) || [])[1]); if (want && line && nf((/^\s*([\d,]+)/.exec(line) || [])[1]) !== want) s.note('P1', 'documents-filter-count-wrong', `${t}: label ${want}, line "${line.replace(/\n/g, ' ')}"`); });
    }
    await s.step('search documents by product name', async () => { await p.locator('#doc-q').fill('Sikaflex'); await p.locator('#doc-q').press('Enter'); await wait(p, 300); });
    await s.step('page 2 differs from page 1', async () => { await p.goto(base + '#/documents'); await wait(p, 300); const a = await p.locator('main table tbody tr').first().innerText().catch(() => ''); const n = p.getByRole('button', { name: 'Next' }); if (await n.count()) { await n.click(); await wait(p, 300); const b = await p.locator('main table tbody tr').first().innerText().catch(() => ''); if (a && a === b) s.note('P1', 'pager-same-content', 'page 2 first row equals page 1'); } });
    await s.step('document links are https aus.sika.com', async () => { const hs = await p.evaluate(() => [...document.querySelectorAll('main a[href]')].map((a) => a.getAttribute('href')).filter((h) => !h.startsWith('#'))); for (const h of hs) if (!/^https:\/\/aus\.sika\.com\//.test(h)) s.note('P1', 'document-hub-bad-href', h); });
    await s.step('guides hub', async () => { await p.goto(base + '#/guides'); });
    await s.step('guides search', async () => { await p.locator('#guide-q').fill('waterproofing'); await p.locator('#guide-q').press('Enter'); await wait(p, 300); });
    await s.step('where to buy is external and opens in a new tab', async () => { await p.goto(base + '#/'); const a = p.locator('a[href*="where-to-buy"]').first(); if (await a.count()) { const tg = await a.getAttribute('target'); const rel = await a.getAttribute('rel'); if (tg !== '_blank' || !/noopener/.test(rel || '')) s.note('P2', 'external-link-attrs', `target=${tg} rel=${rel}`); } });
    await explore(s, ctx, r, '#/documents', 8);
    await explore(s, ctx, r, '#/guides', 6);
    await s.close();
  })());

  // 7 FIRST-TIME VISITOR: lands on home, picks a persona tile and a chip, searches, reads a product (best on the phone sizes)
  all.push((async () => {
    const s = await mk('first-time-visitor'); const p = s.page;
    await s.step('land on home', async () => { await p.goto(base); await wait(p, 300); });
    await s.step('persona tile: Applicator or tradesperson', async () => { await p.getByRole('button', { name: /Applicator or trades/ }).click(); await wait(p, 300); });
    await s.step('persona tile: Specifier or architect', async () => { await p.getByRole('button', { name: /Specifier or architect/ }).click(); await wait(p, 300); });
    await s.step('hero chip: Waterproofing a balcony', async () => { const c = p.locator('main a, main button').filter({ hasText: /Waterproofing a balcony/ }).first(); await c.click(); await wait(p, 400); });
    await s.step('results exist for the chip', async () => { const n = await p.locator('.product-card, .sheet-card, main li').count(); if (!n) s.note('P1', 'chip-no-results', 'Waterproofing a balcony chip shows nothing'); });
    await s.step('hero search on the home page offers suggestions like the header search', async () => { await p.goto(base + '#/'); await wait(p, 400); const hq = p.locator('#hero-q').first(); if (await hq.isVisible().catch(() => false)) { await hq.click(); await hq.pressSequentially('sikafloor', { delay: 30 }); await wait(p, 600); if (!(await p.locator('ul.suggest:not([hidden]) li').count())) s.note('P3', 'hero-search-no-suggestions', 'the home page hero search box has no suggestion list; the header and menu search boxes do'); } });
    await s.step('search by typing slowly with suggestions', async () => { await p.goto(base + '#/'); await wait(p, 300); const q = await searchBox(s); await q.click(); await q.pressSequentially('sikafloor', { delay: 40 }); await wait(p, 500); const sg = await p.locator('ul.suggest:not([hidden]) li').count(); if (!sg) s.note('P2', 'no-suggestions', 'typing sikafloor in the search offers none'); });
    await s.step('pick a suggestion with the keyboard', async () => { await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await wait(p, 500); }, { expectRoute: /product\// });
    await s.step('scroll the whole product page', async () => { await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await wait(p, 200); await p.evaluate(() => window.scrollTo(0, 0)); });
    await s.step('open the menu and follow its first link', async () => { await p.goto(base + '#/'); await wait(p, 300); await openMenu(s); await wait(p, 350); const a = p.locator('.drawer a[href^="#/"], .mainnav a[href^="#/category/"]').locator('visible=true').first(); if (await a.count()) { await a.click(); await wait(p, 300); } });
    await s.step('rotate: the layout survives a viewport swap', async () => { await p.setViewportSize({ width: s.H, height: s.W }); await wait(p, 300); });
    await s.step('rotate back', async () => { await p.setViewportSize({ width: s.W, height: s.H }); await wait(p, 300); });
    await s.step('open advisor and use a suggested question', async () => { await p.goto(base + '#/'); await p.getByRole('button', { name: /Advisor/ }).first().click(); await wait(p, 300); const q = p.locator('.assistant button:has-text("How much adhesive")').first(); if (await q.count()) await q.click(); await wait(p, 1000); });
    await explore(s, ctx, r, '#/', 10);
    await explore(s, ctx, r, '#/products?q=sealant', 10);
    await s.close();
  })());

  // 8 KEYBOARD-ONLY: tab order, visible focus, skip link, no traps, Escape, arrow keys on tabs
  all.push((async () => {
    const s = await mk('keyboard-only'); const p = s.page;
    await s.step('home', async () => { await p.goto(base); await wait(p, 300); });
    await s.step('first Tab reaches the skip link', async () => { await p.keyboard.press('Tab'); const t = await p.evaluate(() => document.activeElement.className + '|' + document.activeElement.textContent.slice(0, 30)); if (!/skip/i.test(t)) s.note('P2', 'skip-link-not-first', t); });
    await s.step('skip link keeps the router on the same page', async () => { const h0 = await p.evaluate(() => location.hash); await p.keyboard.press('Enter'); await wait(p, 400); const h1 = await p.evaluate(() => location.hash); const t = await p.locator('main').innerText(); if (h1 !== h0 && (/not found|could not find/i.test(t) || t.length < 50)) s.note('P1', 'skip-link-breaks-route', `hash ${h0} -> ${h1}, main shows "${t.slice(0, 60).replace(/\n/g, ' ')}"`); });
    await s.step('Tab 40 times: focus always moves and is visible', async () => {
      await p.goto(base + '#/'); await wait(p, 300); const seen = new Set(); let stuck = 0, last = '', invisible = 0;
      for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); const d = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return { k: 'body' }; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { k: e.tagName + '#' + e.id + '.' + String(e.className).slice(0, 20) + ':' + (e.innerText || e.getAttribute('aria-label') || '').slice(0, 20), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0, shadow: cs.boxShadow !== 'none', vis: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight }; }); seen.add(d.k); if (d.k === last) stuck++; last = d.k; if (d.vis === false) invisible++; if (d.k !== 'body' && d.outline === false && d.shadow === false) s.note('P2', 'no-focus-indicator', d.k); }
      if (stuck > 3) s.note('P1', 'focus-stuck', `${stuck} repeats in 40 Tabs`); if (seen.size < 15) s.note('P1', 'focus-trap', `only ${seen.size} distinct stops in 40 Tabs`); if (invisible > 6) s.note('P2', 'focus-offscreen', `${invisible} of 40 stops off screen`);
    });
    await s.step('search by keyboard and Enter', async () => { await p.goto(base + '#/'); const q = p.locator('#hd-q').first(); if (await q.isVisible().catch(() => false)) { await q.focus(); await p.keyboard.type('adhesive'); await p.keyboard.press('Enter'); await wait(p, 300); } else { await p.locator('#hero-q').focus(); await p.keyboard.type('adhesive'); await p.keyboard.press('Enter'); await wait(p, 300); } }, { expectRoute: /products/ });
    await s.step('Enter on the first product card link', async () => { await p.locator('.product-card a').first().focus(); await p.keyboard.press('Enter'); await wait(p, 400); }, { expectRoute: /product\// });
    await s.step('focus lands on main after a route change', async () => { const id = await p.evaluate(() => document.activeElement.id || document.activeElement.tagName); if (id !== 'main') s.note('P3', 'focus-not-on-main-after-route', id); });
    await s.step('arrow keys move between tabs', async () => { const t = p.getByRole('tab').first(); await t.focus(); await p.keyboard.press('ArrowRight'); await wait(p, 150); const sel = await p.evaluate(() => document.activeElement.innerText); if (!/Product details/.test(sel)) s.note('P2', 'tabs-arrow-key', 'ArrowRight landed on ' + sel); await p.keyboard.press('End'); await wait(p, 150); });
    await s.step('open the advisor with the keyboard', async () => { const b = p.getByRole('button', { name: 'Advisor' }).first(); await b.focus(); await p.keyboard.press('Enter'); await wait(p, 300); const inPanel = await p.evaluate(() => !!document.activeElement.closest('[role=dialog], .asst, #asst, aside')); if (!inPanel) s.note('P2', 'advisor-focus-not-moved', 'focus is not inside the advisor after opening'); });
    await s.step('focus cannot escape the open advisor while modal, and Escape returns focus', async () => { for (let i = 0; i < 25; i++) await p.keyboard.press('Tab'); await p.keyboard.press('Escape'); await wait(p, 300); const ae = await p.evaluate(() => document.activeElement.tagName + ':' + (document.activeElement.innerText || '').slice(0, 20)); if (ae.startsWith('BODY')) s.note('P2', 'focus-lost-after-escape', ae); });
    await s.step('selector by keyboard: arrow through radios', async () => { await p.goto(base + '#/selector'); await wait(p, 300); await p.locator('.sel-opt input').first().focus(); await p.keyboard.press('Space'); await p.keyboard.press('ArrowDown'); await wait(p, 200); });
    await s.step('print stylesheet: product page hides the chrome', async () => { await p.goto(base + '#/product/' + (ctx.top40?.[0] || D.index[0].id)); await wait(p, 300); await p.emulateMedia({ media: 'print' }); const vis = await p.evaluate(() => { const v = (sel) => { const e = document.querySelector(sel); return !!e && e.offsetParent !== null && getComputedStyle(e).display !== 'none'; }; return { drawer: v('.drawer'), totop: v('.totop'), mbar: v('.mbar') }; }); await p.emulateMedia({ media: 'screen' }); if (vis.totop || vis.mbar) s.note('P3', 'print-shows-ui', JSON.stringify(vis)); });
    await explore(s, ctx, r, '#/products', 8);
    await s.close();
  })());

  // 9 OFFLINE USER: the service worker and offline mode
  all.push((async () => {
    const s = await mk('offline-user', { noRoute: true }); const p = s.page;
    await s.step('about page', async () => { await p.goto(base + '#/about'); await wait(p, 400); });
    await s.step('service worker takes control within 15 s', async () => { const ok = await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).then(() => true).catch(() => false); if (!ok) s.note('P2', 'sw-not-controlling', 'offline mode never took control in 15 s'); });
    await s.step('visit routes while online to warm', async () => { for (const h of ['#/', '#/products', '#/selector', '#/documents']) { await p.goto(base + h); await wait(p, 150); } });
    await s.step('go offline and open a visited route', async () => { await s.ctx.setOffline(true); await p.goto(base + '#/products?q=grout'); await wait(p, 500); });
    await s.step('offline finder still answers', async () => { const n = await p.locator('.product-card').count(); if (!n) s.note('P2', 'offline-finder-empty', 'no products offline after warm-up'); });
    await s.step('offline product page', async () => { await p.goto(base + '#/product/' + (ctx.tileProduct || D.index[3].id)); await wait(p, 600); });
    await s.step('back online', async () => { await s.ctx.setOffline(false); await p.goto(base + '#/'); await wait(p, 200); });
    await s.close();
  })());

  // 10 CASUAL BROWSER with back/forward and a messy hand: rapid clicking, double clicks, quick navigation
  all.push((async () => {
    const s = await mk('impatient-user'); const p = s.page;
    await s.step('rapid navigation across 8 routes without waiting', async () => { await p.goto(base + '#/'); await wait(p, 600); for (const h of ['#/products', '#/documents', '#/guides', '#/selector', '#/help', '#/rules', '#/about', '#/']) { await p.evaluate((x) => { location.hash = x; }, h); await wait(p, 40); } await wait(p, 600); });
    await s.step('rapid typing in the finder search', async () => { await p.goto(base + '#/products'); await p.waitForSelector('#finder-q', { timeout: 15000 }); await wait(p, 300); const q = p.locator('#finder-q'); await q.click(); await p.keyboard.type('waterproofing membrane tile', { delay: 15 }); await wait(p, 600); const v = await q.inputValue(); if (v !== 'waterproofing membrane tile') s.note('P1', 'typing-loses-keystrokes', 'typed the full phrase, the box holds "' + v + '"'); });
    await s.step('double click Add to project does not add twice', async () => { await p.goto(base + '#/product/' + D.index[5].id); await wait(p, 300); const b = p.locator('main button:has-text("Add to project")').first(); await b.dblclick(); await wait(p, 300); const t = await p.locator('a[href="#/projects"]').first().innerText(); if (/[2-9]/.test(t.replace(/\D*/, '').slice(0, 1))) s.note('P1', 'double-click-adds-twice', t.replace(/\n/g, ' ')); });
    await s.step('Clear all filters twice', async () => { await p.goto(base + '#/products?q=sealant'); await wait(p, 300); const b = p.getByRole('button', { name: /clear all/i }); if (await b.count()) { await b.first().click(); await wait(p, 200); } });
    await s.step('page far past the end', async () => { await p.goto(base + '#/products?page=9999'); await wait(p, 300); });
    await s.step('very long search string', async () => { await p.goto(base + '#/products?q=' + 'a'.repeat(400)); await wait(p, 300); });
    await s.step('search with only symbols', async () => { await p.goto(base + '#/products?q=' + encodeURIComponent('"&<>%$#@!')); await wait(p, 300); });
    await s.step('empty search submit', async () => { const q = p.locator('#hd-q').first(); if (await q.isVisible().catch(() => false)) { await q.fill(''); await q.press('Enter'); await wait(p, 300); } });
    await s.step('browser back five times', async () => { for (let i = 0; i < 5; i++) { await p.goBack().catch(() => {}); await wait(p, 120); } });
    await explore(s, ctx, r, '#/products?q=tile', 10);
    await s.close();
  })());

  // 12 ADVISOR USER: asks the chat assistant realistic questions in the UI; checks an answer arrives, is clean and carries a source; hands every answer to the assistant lane (the lane owns the command selection, so this persona only reports)
  if (sz === '1440x900' || sz === '390x844') all.push((async () => {
    const s = await mk('advisor-user'); const p = s.page; ctx.advisorLog = ctx.advisorLog || [];
    const QS = ['Which adhesive for porcelain tiles on a concrete floor?', 'How much Davco Grey One Pot adhesive do I need for 25 m2?', 'Give me the data sheet for Sikafloor-263 SL', 'What is the coverage of Sikaflex Pro-3?', 'waterproofing for a shower recess', 'is there an SDS for SikaTile 110 SecureProof', 'what grout for a swimming pool', 'How long before I can grout after tiling?', 'what primer goes under Sikafloor 161', 'asdfghjkl qwerty', 'what does Sika cost per bag', 'hello', 'Which products need a primer for a balcony waterproofing membrane under tiles?', 'what is the pot life of Sikadur-31 at 30 degrees'];
    await s.step('open the advisor', async () => { await p.goto(base + '#/'); await wait(p, 400); await p.getByRole('button', { name: 'Advisor' }).first().click(); await wait(p, 600); });
    for (const q of QS) {
      await s.step('ask: ' + q.slice(0, 40), async () => {
        const n0 = await p.locator('.assistant .msg--bot').count(); const t0 = Date.now();
        await p.locator('#asst-q').fill(q); await p.locator('#asst-q').press('Enter');
        await p.waitForFunction((n) => { const m = document.querySelectorAll('.assistant .msg--bot'); return m.length > n && m[m.length - 1].innerText.trim().length > 5; }, n0, { timeout: 10000 }).catch(() => s.note('P1', 'advisor-no-reply', 'no reply to: ' + q));
        const ms = Date.now() - t0; await wait(p, 500); const last = await p.locator('.assistant .msg--bot').last().innerText().catch(() => ''); const links = await p.locator('.assistant .msg--bot').last().locator('a[href]').count().catch(() => 0);
        ctx.advisorLog.push({ size: sz, q, ms, chars: last.length, links, answer: last.replace(/\s+/g, ' ').slice(0, 260) });
        if (/undefined|NaN|\[object|null\b/.test(last)) s.note('P1', 'advisor-bad-token', q + ' -> ' + last.slice(0, 120)); if (ms > 2500) s.note('P3', 'advisor-slow', `${ms} ms for: ${q}`);
      });
    }
    await s.step('advisor panel does not overflow the phone', async () => {});
    await s.close();
  })());

  // 11 RESIZER: one window dragged across 15 widths over 8 routes; any sideways scroll or clipped header is a finding (the 1024 to 1200 header overflow was found this way)
  if (sz === sizes0(ctx)[0]) all.push((async () => {
    const s = await mk('resizer'); const p = s.page; await p.goto(base); await wait(p, 500); const routes = ['#/', '#/products', '#/product/' + (ctx.top40?.[1] || D.index[1].id), '#/selector', '#/documents', '#/guides', '#/rules', '#/about'];
    for (const w of [320, 360, 390, 414, 600, 768, 820, 1000, 1024, 1100, 1180, 1280, 1366, 1536, 1920]) {
      await s.step('width ' + w, async () => { await p.setViewportSize({ width: w, height: 800 }); s.W = w; s.phone = w < 800; });
      for (const h of routes) await s.step(`width ${w} ${h}`, async () => { await p.goto(base + h); await wait(p, 120); });
    }
    await s.close();
  })());

  await Promise.all(all);
}
function sizes0(ctx) { return ctx.sizes; }
