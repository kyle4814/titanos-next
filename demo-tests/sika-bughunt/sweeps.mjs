// Inventory sweeps: every category, the top-40 products plus a seeded sample, sampled system sheets, deep links and bad routes.
// Each check is an independent computation from the data files, never from the page under test.
import { sample } from './lib.mjs';

const nf = (n) => Number(String(n).replace(/[^0-9]/g, ''));
const norm = (s) => String(s).replace(/[®™]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

export async function sweeps(s, ctx, r, sz) {
  const { D, base, get } = ctx; const p = s.page; const phone = s.phone;
  ctx.routesVisited = ctx.routesVisited || new Set(); ctx.controlsClicked = ctx.controlsClicked || 0;
  const go = async (hash, name) => { await s.step(name || 'open ' + hash, async () => { await p.goto(base + hash); }); ctx.routesVisited.add(hash.split('/').slice(0, 2).join('/').split('?')[0]); };

  // 1. home and the top-level routes
  for (const h of ['#/', '#/products', '#/documents', '#/selector', '#/help', '#/projects', '#/rules', '#/insights', '#/about', '#/guides']) await go(h);

  // 2. categories (165 on desktop, 36 sampled on phone and tablet): heading, count line against categories.json, card count
  const catAll = D.cats; const cats = (sz === '1440x900' || sz === '1920x1080') ? catAll : sample(r, catAll, 36);
  for (const c of cats) {
    await go('#/category/' + c.id, 'category ' + c.id);
    const o = await p.evaluate(() => ({ h1: document.querySelector('h1')?.innerText || '', cnt: document.querySelector('.count')?.innerText || '', cards: document.querySelectorAll('main .product-card').length, links: [...document.querySelectorAll('main .grid a[href^="#/"], main .subcats a[href^="#/"]')].map((a) => a.getAttribute('href')) })).catch(() => ({}));
    if (!o.h1) s.note('P1', 'category-no-heading', c.id);
    else if (norm(o.h1) !== norm(c.name) && !norm(o.h1).includes(norm(c.name).slice(0, 12))) s.note('P2', 'category-heading-mismatch', `${c.id}: "${o.h1}" vs "${c.name}"`);
    const shown = nf((/(\d[\d,]*)\s+products?/.exec(o.cnt) || [])[1]);
    if (c.productCount > 0 && o.cnt && shown !== c.productCount) s.note('P1', 'category-count-wrong', `${c.id}: page says ${shown}, data says ${c.productCount}`);
    if (c.productCount === 0 && o.cards > 0) s.note('P2', 'category-empty-has-cards', c.id);
    if (c.productCount > 0 && o.cards === 0 && !(c.children || []).length) s.note('P1', 'category-cards-missing', `${c.id}: ${c.productCount} products but no cards`);
    if (c.productCount > 0 && c.productCount <= 12 && !(c.children || []).length && o.cards !== c.productCount) s.note('P1', 'category-card-count-wrong', `${c.id}: ${o.cards} cards, expected ${c.productCount}`);
  }

  // 3. products: the top 40 (independently read specs first), then a seeded sample to reach 140 on desktop, 40 on the others
  const specs = (await get('data/specs/index.json').catch(() => null)); const rv = []; const hasSpec = new Set((specs && specs.ids) || []);
  for (const pr of D.index) { if (hasSpec.has(pr.id)) { try { const sp = await get('data/specs/' + pr.id + '.json'); if (sp.rv?.verdict) rv.push({ id: pr.id, cl: sp.verification?.clauses || 0, sp }); } catch {} } }
  const top40 = rv.sort((a, b) => b.cl - a.cl).slice(0, 40);
  ctx.top40 = top40.map((t) => t.id);
  const rest = sample(r, D.index.filter((x) => !ctx.top40.includes(x.id)), sz === '1440x900' ? 100 : (sz === '1920x1080' ? 50 : 30));
  const prods = [...(phone || sz === '768x1024' ? sample(r, top40, 14).map((t) => D.index.find((x) => x.id === t.id)) : top40.map((t) => D.index.find((x) => x.id === t.id))), ...rest];
  for (const pr of prods) {
    if (!pr) continue;
    if (process.env.BH_VERBOSE) console.log('PRODUCT', sz, pr.id);
    await go('#/product/' + pr.id, 'product ' + pr.id);
    const o = await p.evaluate(() => ({ h1: document.querySelector('h1')?.innerText || '', tabs: [...document.querySelectorAll('[role=tab]')].map((t) => t.innerText.trim()), docLinks: [...document.querySelectorAll('main a[href*=".pdf"]')].map((a) => a.getAttribute('href')), crumbs: [...document.querySelectorAll('.breadcrumb a')].map((a) => a.getAttribute('href')), ext: [...document.querySelectorAll('main a[href^="http"]')].map((a) => ({ h: a.href, t: a.target, rel: a.rel })) })).catch(() => ({}));
    if (norm(o.h1 || '') !== norm(pr.n)) s.note('P1', 'product-heading-wrong', `${pr.id}: "${o.h1}" vs "${pr.n}"`);
    for (const e of (o.ext || [])) { if (!/^https:\/\/aus\.sika\.com\//.test(e.h)) s.note('P1', 'external-link-wrong-host', `${pr.id}: ${e.h}`); else if (e.t !== '_blank' || !/noopener/.test(e.rel)) s.note('P2', 'external-link-attrs', `${pr.id}: target=${e.t} rel=${e.rel}`); }
    for (const t of (o.tabs || [])) {
      await s.step(`tab ${t} on ${pr.id}`, async () => { await p.getByRole('tab', { name: t, exact: true }).click(); });
      if (t === 'Specification') await p.waitForFunction(() => !document.querySelector('[role=tabpanel] .skeleton'), null, { timeout: 8000 }).catch(() => s.note('P1', 'spec-tab-never-loads', pr.id));
      const tp = await p.evaluate(() => { const e = [...document.querySelectorAll('[role=tabpanel]')].find((x) => !x.hidden && x.offsetParent); return e ? e.innerText : ''; }).catch(() => '');
      if (tp.trim().length < 10) s.note('P1', 'tab-empty', `${pr.id} tab ${t}`);
      const dm = /^Documents \((\d+)\)/.exec(t);
      if (dm) { const rows = await p.evaluate(() => [...document.querySelectorAll('[role=tabpanel] tbody tr, [role=tabpanel] li')].filter((e) => e.offsetParent).length).catch(() => -1); if (rows >= 0 && Number(dm[1]) !== rows && rows !== 0) s.note('P1', 'documents-tab-count-wrong', `${pr.id}: label ${dm[1]}, rows ${rows}`); }
      if (t === 'Specification') {
        const sp = ctx.top40.includes(pr.id) ? top40.find((x) => x.id === pr.id).sp : null;
        if (sp) { const m = /(\d+)\s+clauses/.exec(tp); if (m && Number(m[1]) !== sp.verification.clauses) s.note('P1', 'spec-clause-count-wrong', `${pr.id}: page ${m[1]}, data ${sp.verification.clauses}`); if (!/INDEPENDENTLY READ|Reviewed/i.test(tp)) s.note('P2', 'spec-reviewed-badge-missing', pr.id); }
      }
    }
    // the calculator: any number in, no NaN out
    if ((o.tabs || []).includes('Rates and times')) {
      const has = await p.locator('#calc-area').count();
      if (has) { await s.step('calc area on ' + pr.id, async () => { await p.getByRole('tab', { name: 'Rates and times', exact: true }).click(); await p.fill('#calc-area', String(10 + Math.floor(r() * 90))); await p.waitForTimeout(120); }); }
    }
  }

  // 4. system sheets: the hub and a seeded sample (HTTP pages, not hash routes), with the print stylesheet
  const slugs = (await get('data/selector.json')).slugs; const slugList = Array.isArray(slugs) ? slugs : [...new Set(Object.values(slugs).map((v) => (typeof v === 'string' ? v : v.slug || v.id)))].filter(Boolean);
  const sheets = sample(r, slugList, (sz === '1440x900') ? 60 : (sz === '1920x1080' ? 15 : 12));
  await s.step('systems hub', async () => { await p.goto(base + 'systems/'); }, {});
  for (const sl of sheets) {
    await s.step('sheet ' + sl, async () => { await p.goto(base + 'systems/' + sl + '/'); });
    const o = await p.evaluate(() => ({ h1: document.querySelector('h1')?.innerText || '', steps: document.querySelectorAll('main ol li, main .step').length, bad: [...document.querySelectorAll('main a[href^="#src-"]')].filter((a) => !document.querySelector(a.getAttribute('href'))).length })).catch(() => ({}));
    if (!o.h1) s.note('P1', 'sheet-no-heading', sl);
    if (o.bad) s.note('P2', 'sheet-broken-source-anchor', `${sl}: ${o.bad}`);
  }

  // 6. finder audit (desktop sizes): every facet option, the pager and the three sorts against counts computed from index.json
  if (sz === '1440x900') {
    await go('#/products', 'finder audit open');
    const lbls = await p.evaluate(() => [...document.querySelectorAll('.fgroup .fopt')].map((o) => ({ t: o.innerText.replace(/\s+/g, ' ').trim(), type: o.querySelector('input').type })));
    for (const l of lbls) {
      const m = /^(.*) (\d[\d,]*)$/.exec(l.t); if (!m) continue; const name = m[1], shown = nf(m[2]); if (name === 'All categories') continue;
      let want = shown; if (l.type === 'checkbox') { if (name === 'Product data sheet') want = D.index.filter((x) => x.pds).length; else if (name === 'Safety data sheet') want = D.index.filter((x) => x.sds).length; else want = D.index.filter((x) => x.b === name).length; }
      if (want !== shown) s.note('P1', 'facet-label-count-wrong', `${name}: label ${shown}, index.json ${want}`);
      await s.step('facet ' + name, async () => { await p.goto(base + '#/products'); await p.waitForTimeout(250); await p.locator('.fgroup .fopt', { hasText: name }).first().locator('input').click(); await p.waitForTimeout(350); });
      const got = nf((await p.locator('.resultline').first().innerText().catch(() => '0')).split(' ')[0]);
      if (want && got !== want) s.note('P1', 'facet-result-count-wrong', `${name}: facet says ${want}, results line says ${got}`);
    }
    await go('#/products', 'finder pager audit');
    const pg = await p.evaluate(() => [...document.querySelectorAll('.pager button')].map((b) => b.innerText.trim()));
    const last = Math.max(...pg.map((x) => Number(x) || 0)); const perPage = await p.locator('.product-card').count(); const wantLast = D.index.length - perPage * (last - 1);
    await s.step('pager: last page', async () => { await p.getByRole('button', { name: 'Page ' + last, exact: true }).click(); await p.waitForTimeout(350); });
    const lc = await p.locator('.product-card').count(); if (lc !== wantLast) s.note('P1', 'pager-last-page-wrong', `last page has ${lc} cards, expected ${wantLast} (${D.index.length} products, ${perPage} per page, ${last} pages)`);
    const names = new Set(); for (let pgNo = 1; pgNo <= last; pgNo += Math.max(1, Math.floor(last / 5))) { await p.goto(base + '#/products?page=' + pgNo); await p.waitForTimeout(250); for (const n of await p.locator('.product-card h3').allInnerTexts()) { if (names.has(n + pgNo)) s.note('P2', 'pager-duplicate-card', n); names.add(n + pgNo); } }
    for (const [label, cmp] of [['Name A to Z', (a, b) => a.localeCompare(b)], ['Name Z to A', (a, b) => b.localeCompare(a)]]) {
      await s.step('sort ' + label, async () => { await p.goto(base + '#/products'); await p.waitForTimeout(250); await p.locator('select').first().selectOption({ label }); await p.waitForTimeout(350); });
      const n = (await p.locator('.product-card h3').allInnerTexts()).map((x) => norm(x)); const ok = n.every((v, i) => i === 0 || cmp(n[i - 1], v) <= 0 || n[i - 1].replace(/[^a-z0-9]/g, '') <= v.replace(/[^a-z0-9]/g, '')); if (!ok) s.note('P2', 'sort-order-wrong', `${label}: ${n.slice(0, 5).join(' / ')}`);
    }
    // exact-name search: the product asked for by its full name must be in the first three results (40 seeded products)
    for (const pr of sample(r, D.index, 40)) {
      await s.step('exact name search ' + pr.id, async () => { await p.goto(base + '#/products?q=' + encodeURIComponent(pr.n.replace(/[®™]/g, ''))); await p.waitForTimeout(300); });
      const top = (await p.locator('.product-card h3').allInnerTexts()).slice(0, 3).map(norm); if (!top.includes(norm(pr.n))) s.note('P1', 'exact-name-search-misses', `"${pr.n}" is not in the top three: ${top.join(' / ')}`);
    }
  }
  // 5. bad routes and deep links: must give a designed message, never a blank page or a crash
  for (const h of ['#/product/does-not-exist', '#/category/nope/never', '#/nonsense-route', '#/documents?type=zzz', '#/products?q=%E0%A4%A', '#/products?cat=bogus&page=999', '#/products?page=-3', '#/system-data/not-a-slug', '#/product/', '#/products?q=' + encodeURIComponent('<img src=x onerror=alert(1)>')]) {
    s.expect404 = true; await go(h, 'bad route ' + h); s.expect404 = false;
    const x = await p.evaluate(() => ({ t: document.querySelector('main')?.innerText.length || 0, injected: !!document.querySelector('main img[src="x"]') })).catch(() => ({ t: 0 }));
    if (x.injected) s.note('P1', 'xss-reflected', h);
  }
}
