// w2_browser.mjs: wave 2 in a real browser (Windows Chrome via playwright-core, same setup as the other suites).
//   A. QR address opens the advisor on that system (greeting card naming it, three suggested questions that fire through the advisor's own form)
//   B. data quality page (counts match the data file, print mode, no sideways scroll, PDF link works)
//   C. install as an app (manifest, polite prompt rules) and outdoor mode (toggle, persistence, prefers-contrast, tap targets, no sideways scroll)
//   D. offline after the first visit
// usage (Windows node): node.exe w2_browser.mjs <portalDir> <outDir> [A|B|C|D ...]
import fs from 'node:fs';
import { serve, launch } from '../sika-210c0c/_browser.mjs';
import { PORTAL } from '../sika-210c0c/_env.mjs';
const [, , t0, outDir = './w2_out', ...only] = process.argv; fs.mkdirSync(outDir, { recursive: true });
const root = t0 || PORTAL; const s = await serve(root); const b = await launch(); let fails = 0;
const want = (k) => !only.length || only.includes(k);
const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).slice(0, 240) : '')); };
const gift = JSON.parse(fs.readFileSync(root + '/data/gift/data_quality.json', 'utf8'));
const SIZES = [[1440, 900], [390, 844]];
const ctxFor = (W, H, extra = {}) => b.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600, serviceWorkers: 'block', ...extra });
const watch = (page, errs) => { page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); }); page.on('pageerror', (e) => errs.push(e.message.slice(0, 140))); };
const noScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

if (want('A')) for (const [W, H] of SIZES) {
  const ctx = await ctxFor(W, H); const page = await ctx.newPage(); const errs = []; watch(page, errs); const sz = `${W}x${H}`;
  // a real sheet, its own QR address with the local base swapped in, as a phone would open it
  const slug = 'porcelain-on-concrete-external-floor';
  await page.goto(s.base + 'systems/' + slug + '/', { waitUntil: 'load' });
  const qr = await page.evaluate(() => { const a = document.querySelector('.qr-card'); const r = a.querySelector('svg').getBoundingClientRect(); return { url: a.querySelector('a.qr-link').href, w: r.width, h: r.height, cap: a.querySelector('.qr-cap').textContent, visible: r.width > 0 }; });
  t(`${sz} sheet shows the QR and caption`, qr.visible && /ask about this system/i.test(qr.cap), JSON.stringify(qr));
  await page.screenshot({ path: `${outDir}/sheet_qr_${sz}.png` });
  const h1 = await page.locator('h1').first().innerText();
  await page.goto(s.base, { waitUntil: 'load' }); await page.goto(qr.url, { waitUntil: 'load' }); await page.waitForSelector('.ask-greet', { timeout: 15000 });
  const g = await page.evaluate(() => { const e = document.querySelector('.ask-greet'); const log = document.querySelector('#assistant .asst-log'); return { text: e.textContent, chips: [...e.querySelectorAll('button.chip')].map((c) => c.textContent), inLog: log.contains(e), open: document.getElementById('assistant').classList.contains('open'), h1: document.querySelector('main h1').textContent }; });
  t(`${sz} the QR address opens the advisor with a greeting that names the system`, g.inLog && g.open && g.text.includes(h1), JSON.stringify({ h1, text: g.text.slice(0, 120), open: g.open }));
  t(`${sz} the greeting offers three suggested questions`, g.chips.length === 3, g.chips.join(' | '));
  await page.screenshot({ path: `${outDir}/ask_${sz}.png` });
  // a suggested question goes through the advisor's own form and gets an answer
  const before = await page.locator('#assistant .msg--user').count();
  await page.locator('.ask-greet button.chip').first().click();
  await page.waitForFunction((n) => document.querySelectorAll('#assistant .msg--user').length > n, before, { timeout: 5000 });
  await page.waitForFunction(() => !document.querySelector('#assistant .typing') && document.querySelectorAll('#assistant .msg--bot').length >= 3, null, { timeout: 25000 });
  const ans = await page.evaluate(() => { const m = [...document.querySelectorAll('#assistant .msg--bot')].pop(); return m.textContent.trim(); });
  t(`${sz} a suggested question is sent and answered`, ans.length > 20 && !/could not run/.test(ans), ans.slice(0, 160));
  await page.screenshot({ path: `${outDir}/ask_answer_${sz}.png` });
  // hub address and an unknown slug
  const errsBefore = errs.length;
  await page.goto(s.base + '#/ask', { waitUntil: 'load' }); await page.waitForFunction(() => /tiling systems/.test((document.querySelector('.ask-greet') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
  t(`${sz} the general address (hub QR) opens a general greeting`, /Asking about: tiling systems/.test(await page.locator('.ask-greet').first().textContent()));
  await page.goto(s.base + '#/ask?system=no-such-system-x', { waitUntil: 'load' }); await page.waitForFunction(() => /no such system x/.test((document.querySelector('.ask-greet') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
  t(`${sz} an unknown system still opens politely (the one expected 404 for its sheet is not counted below)`, /no such system x/.test(await page.locator('.ask-greet').first().textContent()) && (await page.locator('.ask-page .notice').count()) === 1);
  errs.splice(errsBefore, errs.length);
  await page.goto(s.base + '#/ask?system=' + encodeURIComponent('<img src=x onerror=alert(1)>'), { waitUntil: 'load' }); await page.waitForTimeout(600);
  t(`${sz} a hostile parameter is ignored, nothing injected`, (await page.locator('main img[src="x"]').count()) === 0 && (await page.locator('.ask-greet').count()) >= 1);
  t(`${sz} no sideways scroll`, (await noScroll(page)) <= 1);
  t(`${sz} no console errors`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}

if (want('B')) for (const [W, H] of SIZES) {
  const ctx = await ctxFor(W, H); const page = await ctx.newPage(); const errs = []; watch(page, errs); const sz = `${W}x${H}`;
  await page.goto(s.base + '#/about/data-quality', { waitUntil: 'load' }); await page.waitForSelector('.dq-page .dq-sum');
  const sum = await page.evaluate(() => [...document.querySelectorAll('.dq-sum li strong')].map((e) => +e.textContent.replace(/,/g, '')));
  const c = gift.counts;
  t(`${sz} gift page summary counts match the data file`, JSON.stringify(sum) === JSON.stringify([c.noPhoto, c.specIssuePlaces, c.reported404, c.noRate]), JSON.stringify(sum));
  const rows = await page.evaluate(() => ({ spec: document.querySelectorAll('.dq-table')[0].querySelectorAll('tbody tr').length, dead: document.querySelectorAll('.dq-table')[1].querySelectorAll('tbody tr').length, photo: document.querySelectorAll('.dq-page details .dq-cols li a[href^="#/product/"]').length }));
  t(`${sz} spec table has ${c.specIssuePlaces} rows and the not found table ${c.reported404}`, rows.spec === c.specIssuePlaces && rows.dead === c.reported404, JSON.stringify(rows));
  const lis = await page.evaluate(() => document.querySelectorAll('.dq-page details .dq-cols li').length);
  t(`${sz} product lists hold ${c.noPhoto} no-photo and ${c.noRate} no-rate products`, lis === c.noPhoto + c.noRate, lis);
  const txt = await page.locator('.dq-page').innerText();
  t(`${sz} no em or en dashes on the page`, !/[\u2013\u2014]/.test(txt));
  t(`${sz} the PDF link points at a file that exists`, await page.evaluate(async () => { const a = document.querySelector('a[download]'); const r = await fetch(a.getAttribute('href')); const u = new Uint8Array(await r.arrayBuffer()); return r.ok && u.length > 20000 && String.fromCharCode(u[0], u[1], u[2], u[3]) === '%PDF'; }));
  t(`${sz} no sideways scroll`, (await noScroll(page)) <= 1);
  await page.screenshot({ path: `${outDir}/gift_${sz}.png` });
  await page.goto(s.base + '#/about/data-quality?print=1', { waitUntil: 'load' }); await page.waitForSelector('.dq-page .dq-sum'); await page.waitForTimeout(300);
  t(`${sz} print mode opens every list`, (await page.locator('details.dq-list:not([open])').count()) === 0);
  await page.goto(s.base + '#/about', { waitUntil: 'load' }); await page.waitForSelector('a[href="#/about/data-quality"]');
  t(`${sz} the About page links to the gift page`, true);
  t(`${sz} no console errors`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}

const prods = JSON.parse(fs.readFileSync(root + '/data/products.json', 'utf8').replace(/^\uFEFF/, '')); const pid = prods.find((p) => p.image).id;
const ROUTES = ['#/', '#/products', '#/category/' + prods[0].categoryPath.join('/'), '#/product/' + pid, '#/documents', '#/guides', '#/projects', '#/about', '#/selector', '#/help', '#/ask?system=porcelain-on-concrete-external-floor', '#/about/data-quality'];
const visibleToggle = (page) => page.locator('[data-outdoor-toggle]:visible').first();
async function clickToggle(page, mobile) {
  if (mobile) { await page.locator('#burger').click(); await page.waitForSelector('.drawer.open [data-outdoor-toggle], .drawer[aria-hidden="false"] [data-outdoor-toggle]', { timeout: 4000 }).catch(() => {}); }
  await visibleToggle(page).click();
  if (mobile) { await page.keyboard.press('Escape'); }
}
if (want('C')) {
  // ---- manifest and icons
  { const ctx = await ctxFor(1440, 900); const page = await ctx.newPage(); await page.goto(s.base, { waitUntil: 'load' });
    const link = await page.evaluate(() => { const l = document.querySelector('link[rel="manifest"]'); return l ? l.getAttribute('href') : null; });
    t('index.html links the manifest', link === 'manifest.webmanifest', link);
    const m = await page.evaluate(async () => { const r = await fetch('manifest.webmanifest'); const j = await r.json(); const icons = []; for (const i of j.icons) { const x = await fetch(i.src); const u = new Uint8Array(await x.arrayBuffer()); const dv = new DataView(u.buffer); icons.push([i.sizes, i.purpose, x.status, u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47 ? 'png' : 'not png', dv.getUint32(16) + 'x' + dv.getUint32(20)]); } return { ct: r.headers.get('content-type'), j, icons }; });
    t('manifest has the install essentials (name, short_name, start_url, scope, standalone, theme, 192 and 512 icons, one maskable)', m.j.name && m.j.short_name && m.j.start_url === './' && m.j.scope === './' && m.j.display === 'standalone' && /^#/.test(m.j.theme_color) && m.j.icons.some((i) => i.sizes === '192x192') && m.j.icons.some((i) => i.sizes === '512x512') && m.j.icons.some((i) => i.purpose === 'maskable'), JSON.stringify(m.j).slice(0, 160));
    t('every manifest icon loads, is a real PNG and has the size the manifest says', m.icons.every((i) => i[2] === 200 && i[3] === 'png' && i[4] === i[0]), JSON.stringify(m.icons));
    await ctx.close(); }
  // ---- outdoor mode
  for (const [W, H] of SIZES) {
    const mobile = W < 600; const sz = `${W}x${H}`;
    const ctx = await ctxFor(W, H); const page = await ctx.newPage(); const errs = []; watch(page, errs);
    await page.goto(s.base, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])');
    t(`${sz} outdoor mode starts off and the stylesheet is not loaded`, !(await page.evaluate(() => document.documentElement.classList.contains('outdoor'))) && (await page.locator('#outdoor-css').count()) === 0);
    await page.screenshot({ path: `${outDir}/normal_${sz}.png` });
    await clickToggle(page, mobile); await page.waitForTimeout(500);
    const on = await page.evaluate(() => ({ cls: document.documentElement.classList.contains('outdoor'), ls: localStorage.getItem('sika-demo-210c0c-outdoor'), fs: getComputedStyle(document.documentElement).fontSize, css: !!document.getElementById('outdoor-css'), pressed: [...document.querySelectorAll('[data-outdoor-toggle]')].map((b) => b.getAttribute('aria-pressed')) }));
    t(`${sz} the toggle turns outdoor mode on (class, stored choice, bigger text)`, on.cls && on.ls === 'on' && on.css && parseFloat(on.fs) >= 20 && on.pressed.every((x) => x === 'true'), JSON.stringify(on));
    await page.screenshot({ path: `${outDir}/outdoor_home_${sz}.png` });
    await page.reload({ waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.waitForTimeout(300);
    t(`${sz} outdoor mode is still on after a reload (persisted in this browser)`, await page.evaluate(() => document.documentElement.classList.contains('outdoor')));
    // every route: no sideways scroll, every tap target 44 px or more
    const bad = []; const wide = [];
    for (const r of ROUTES) {
      await page.goto(s.base + r, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(450);
      if ((await noScroll(page)) > 1) wide.push(r);
      const small = await page.evaluate(() => { const sel = 'button, .btn, .chip, .tri, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, summary, .mbar a, .burger, .totop.show'; const out = [];
        for (const e of document.querySelectorAll(sel)) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (!r.width || !r.height || cs.visibility === 'hidden' || e.closest('[hidden],[aria-hidden="true"],.visually-hidden') || r.bottom < 0) continue; if (r.height < 43.5 || r.width < 43.5) out.push((e.id || e.className || e.tagName).toString().slice(0, 30) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); } return out.slice(0, 5); });
      if (small.length) bad.push(r + ' -> ' + small.join(', '));
    }
    t(`${sz} outdoor mode: no sideways scroll on ${ROUTES.length} routes`, wide.length === 0, wide.join(' '));
    t(`${sz} outdoor mode: every button, chip, field and bar item is 44 px or more`, bad.length === 0, bad.join(' | '));
    await page.goto(s.base + '#/products', { waitUntil: 'load' }); await page.waitForTimeout(600); await page.screenshot({ path: `${outDir}/outdoor_products_${sz}.png` });
    await page.goto(s.base, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])');
    await clickToggle(page, mobile); await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])');
    t(`${sz} turning it off persists too`, await page.evaluate(() => !document.documentElement.classList.contains('outdoor') && localStorage.getItem('sika-demo-210c0c-outdoor') === 'off'));
    t(`${sz} no console errors`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // prefers-contrast: more turns it on with no stored choice, and an explicit off wins
  { const ctx = await ctxFor(390, 844, { contrast: 'more' }); const page = await ctx.newPage(); await page.goto(s.base, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])');
    t('prefers-contrast: more turns outdoor mode on by itself', await page.evaluate(() => document.documentElement.classList.contains('outdoor') && localStorage.getItem('sika-demo-210c0c-outdoor') === null));
    await clickToggle(page, true); await page.reload({ waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])');
    t('an explicit off beats prefers-contrast', await page.evaluate(() => !document.documentElement.classList.contains('outdoor')));
    await ctx.close(); }
  // ---- the polite install card (fake clock, synthetic beforeinstallprompt)
  async function fireBip(page) { await page.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; return Promise.resolve(); }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); }); }
  const hops = async (page, n) => { for (let i = 0; i < n; i++) { await page.evaluate((i) => { location.hash = '#/' + ['products', 'documents', 'guides', 'about', 'projects', 'help'][i % 6]; }, i); await page.waitForTimeout(120); } };
  for (const [W, H] of SIZES) {
    const sz = `${W}x${H}`; const ctx = await ctxFor(W, H); const page = await ctx.newPage(); await page.clock.install(); const errs = []; watch(page, errs);
    await page.goto(s.base, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.clock.fastForward(5000); await page.waitForTimeout(300); await fireBip(page);
    await hops(page, 2); await page.clock.fastForward(40000); await page.waitForTimeout(200);
    t(`${sz} install card stays away after only 2 pages (not real use yet)`, (await page.locator('.install-card').count()) === 0);
    await hops(page, 3); await page.clock.fastForward(1000); await page.waitForTimeout(300);
    t(`${sz} install card appears after real use (4+ pages, 30 s)`, (await page.locator('.install-card').count()) === 1);
    const geo = await page.evaluate(() => { const c = document.querySelector('.install-card').getBoundingClientRect(); const mb = document.querySelector('.mbar'); const m = mb && getComputedStyle(mb).display !== 'none' ? mb.getBoundingClientRect() : null; const bs = [...document.querySelectorAll('.install-card button')].map((b) => { const r = b.getBoundingClientRect(); return Math.round(r.height); }); return { cardBottom: c.bottom, mbarTop: m ? m.top : null, left: c.left, right: c.right, vw: innerWidth, bs }; });
    t(`${sz} install card sits above the bottom bar, inside the screen, buttons 44 px or more`, (geo.mbarTop === null || geo.cardBottom <= geo.mbarTop) && geo.left >= 0 && geo.right <= geo.vw && geo.bs.every((x) => x >= 44), JSON.stringify(geo));
    await page.screenshot({ path: `${outDir}/install_${sz}.png` });
    await page.locator('.install-card button', { hasText: 'Not now' }).click();
    t(`${sz} "Not now" closes it and remembers`, (await page.locator('.install-card').count()) === 0 && (await page.evaluate(() => !!localStorage.getItem('sika-demo-210c0c-install-no'))));
    await page.reload({ waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.clock.fastForward(5000); await fireBip(page); await hops(page, 5); await page.clock.fastForward(60000); await page.waitForTimeout(300);
    t(`${sz} after "Not now" it never comes back`, (await page.locator('.install-card').count()) === 0);
    t(`${sz} no console errors`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  { const ctx = await ctxFor(390, 844); const page = await ctx.newPage(); await page.clock.install();
    await page.goto(s.base, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])'); await page.clock.fastForward(5000); await fireBip(page);
    await page.evaluate(() => document.getElementById('asst-fab').click()); await page.waitForTimeout(200); await hops(page, 5); await page.clock.fastForward(60000); await page.waitForTimeout(300);
    t('install card never covers an open advisor', (await page.locator('.install-card').count()) === 0);
    await page.evaluate(() => window.__asstClose && window.__asstClose()); await page.waitForTimeout(200); await hops(page, 1); await page.clock.fastForward(1000); await page.waitForTimeout(300);
    t('after the advisor closes the card may show, and Add to home screen calls the browser prompt', (await page.locator('.install-card').count()) === 1);
    await page.locator('.install-card button.ic-yes').click(); await page.waitForTimeout(300);
    t('the Add button triggers the real install prompt once', (await page.evaluate(() => window.__prompted)) === 1);
    await ctx.close(); }
}
if (want('D')) {
  // ---- offline after the first visit
  const ctx = await ctxFor(390, 844, { serviceWorkers: 'allow' }); const page = await ctx.newPage(); const errs = []; watch(page, errs);
  await page.goto(s.base, { waitUntil: 'load' }); await page.waitForSelector('main:not([aria-busy])');
  const FILES = JSON.parse(/const FILES = (\[.*?\]);/s.exec(fs.readFileSync(root + '/sw.js', 'utf8'))[1]); let ready = 0; for (let i = 0; i < 120 && ready < FILES.length; i++) { ready = await page.evaluate(async () => { const k = (await caches.keys()).filter((x) => x.startsWith('sika-demo-210c0c-')); if (!k.length) return 0; return (await (await caches.open(k[0])).keys()).length; }); if (ready < FILES.length) await page.waitForTimeout(1000); }
  t('the service worker cached every file in its list after the first visit', ready === FILES.length, ready + ' of ' + FILES.length + ' files');
  const keys = await page.evaluate(async () => { const k = (await caches.keys()).find((x) => x.startsWith('sika-demo-210c0c-')); const c = await caches.open(k); return (await c.keys()).map((r) => new URL(r.url).pathname.replace(/^\/+/, '')); });
  t('no product pictures, icons or sheets were precached', !keys.some((k) => /^assets\/img\//.test(k) || /\.(png|jpg|webp|svg)$/.test(k) || /^systems\//.test(k)), keys.filter((k) => /\.(png|jpg|webp)$/.test(k)).slice(0, 3).join(','));
  t('the new modules (ask, outdoor, install) are in the offline cache', ['assets/lib/ask-system.js', 'assets/lib/outdoor.js', 'assets/lib/pwa.js', 'assets/outdoor.css', 'assets/pwa.css', 'assets/qr.css'].every((k) => keys.includes(k)), keys.filter((k) => /ask|outdoor|pwa|qr/.test(k)).join(','));
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(500);
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' }).catch(() => {}); await page.waitForSelector('main:not([aria-busy])', { timeout: 20000 }).catch(() => {});
  const home = await page.evaluate(() => ({ h1: (document.querySelector('main h1') || {}).textContent || '', err: !!document.querySelector('.error-state, .empty-state'), len: document.querySelector('main').innerText.length }));
  t('offline: the home page loads from the cache', home.len > 200 && !home.err, JSON.stringify(home).slice(0, 160));
  await page.goto(s.base + '#/ask?system=porcelain-on-concrete-external-floor'); await page.waitForSelector('.ask-greet', { timeout: 15000 }).catch(() => {});
  t('offline: the QR address still opens the advisor with the greeting', (await page.locator('.ask-greet').count()) >= 1 && (await page.locator('.ask-greet button.chip').count()) === 3);
  await page.screenshot({ path: `${outDir}/offline_ask_390x844.png` });
  await page.goto(s.base + '#/products'); await page.waitForSelector('.product-card', { timeout: 15000 }).catch(() => {});
  t('offline: the product list works', (await page.locator('.product-card').count()) > 5);
  await page.evaluate(() => { localStorage.setItem('sika-demo-210c0c-outdoor', 'on'); }); await page.reload({ waitUntil: 'load' }).catch(() => {}); await page.waitForSelector('main:not([aria-busy])', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(500);
  t('offline: outdoor mode loads from the cache and keeps its look', await page.evaluate(() => document.documentElement.classList.contains('outdoor') && !!document.getElementById('outdoor-css') && parseFloat(getComputedStyle(document.documentElement).fontSize) >= 20));
  await page.screenshot({ path: `${outDir}/offline_outdoor_390x844.png` });
  t('offline: no sideways scroll', (await noScroll(page)) <= 1);
  t('offline: no console errors besides refused network calls', errs.filter((e) => !/Failed to load resource|net::ERR|offline|Failed to fetch/i.test(e)).length === 0, errs.join(' | '));
  await ctx.close();
}
await b.close(); s.close(); console.log(fails ? `W2 BROWSER ${fails} failed` : 'W2 BROWSER GREEN'); process.exit(fails ? 1 : 0);
