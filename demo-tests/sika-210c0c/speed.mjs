// speed.mjs (apply/speed): per-route weight and speed, same method as weight.mjs (T08): Chrome DevTools Fast 3G (1.6 Mbit/s down, 562.5 ms latency),
// cache off, 390x844 mobile, median of 3, bytes = CDP encodedDataLength, served gzip level 6 by a local static server. Adds first contentful paint,
// bytes at the moment of the answer ("at answer") and bytes when the network has been quiet for 3 s ("settled", includes the deferred web fonts),
// and a desktop profile (1366x768, no throttling).
// usage (Windows node): node.exe speed.mjs [portalDir] [outFile] [runs=3] [routeFilter]
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './_browser.mjs';
import { PORTAL, ROOT } from './_env.mjs';
const root = process.argv[2] || PORTAL; const outFile = process.argv[3] || path.join(ROOT, 'receipts', 'speed_latest.json'); const RUNS = +(process.argv[4] || 3); const FILTER = process.argv[5] || '';
const srv = await serve(root, { gzip: true }); const base = srv.base; const browser = await launch();
const NET = { offline: false, latency: 562.5, downloadThroughput: Math.round(1.6 * 1024 * 1024 / 8 * 0.9), uploadThroughput: Math.round(750 * 1024 / 8 * 0.9) };
const slug = 'porcelain-on-concrete-internal-wet-floor';
const READY = 'main:not([aria-busy]) h1';
const ROUTES = [
  { id: 'home', name: 'home (#/)', go: (p, b) => p.goto(b + '#/', { waitUntil: 'commit' }), ready: READY, targetBytes: 80000 },
  { id: 'selector_flow', name: 'selector flow: cold load of #/selector, three choices, Show my system, first answer on the sheet', go: async (p, b) => {
    await p.goto(b + '#/selector', { waitUntil: 'commit' }); await p.getByLabel(/^porcelain/i).first().check({ force: true }); await p.getByLabel(/^concrete$/i).first().check({ force: true }); await p.getByLabel(/wet area floor/i).first().check({ force: true });
    await p.locator('#sel-go').click(); }, ready: 'ol.steps > li', targetBytes: 100000, targetMsFast3g: 1500 },
  { id: 'sheet_direct', name: 'system sheet opened directly', go: (p, b) => p.goto(b + 'systems/' + slug + '/', { waitUntil: 'commit' }), ready: 'ol.steps > li', targetBytes: 150000 },
  { id: 'product', name: 'product page (#/product/davco-grey-one-potadhesive)', go: (p, b) => p.goto(b + '#/product/davco-grey-one-potadhesive', { waitUntil: 'commit' }), ready: READY, targetBytes: 150000 },
  { id: 'advisor_beat3', name: 'advisor: cold load of home, open the advisor, ask "Can I use Davco Grey One Pot over my old tiles?", first answer with a quoted data sheet sentence', go: async (p, b) => {
    await p.goto(b + '#/', { waitUntil: 'commit' }); await p.waitForSelector('main:not([aria-busy]) h1', { timeout: 120000 }); await p.locator('#tri-advisor:visible, .mbar button:visible').first().click();
    await p.locator('#asst-q').fill('Can I use Davco Grey One Pot over my old tiles?'); await p.locator('#asst-q').press('Enter'); }, ready: '.asst-log .msg--bot:has-text("suitable")', targetBytes: 600000 },
  { id: 'finder', name: 'finder (#/products)', go: (p, b) => p.goto(b + '#/products', { waitUntil: 'commit' }), ready: READY, targetBytes: 150000 },
  { id: 'category', name: 'category (#/category/construction/tile-stone-installationsystems)', go: (p, b) => p.goto(b + '#/category/construction/tile-stone-installationsystems', { waitUntil: 'commit' }), ready: READY, targetBytes: 150000 },
  { id: 'documents', name: 'documents (#/documents)', go: (p, b) => p.goto(b + '#/documents', { waitUntil: 'commit' }), ready: READY, targetBytes: 150000 },
  { id: 'guides', name: 'guides (#/guides)', go: (p, b) => p.goto(b + '#/guides', { waitUntil: 'commit' }), ready: READY, targetBytes: 150000 },
  { id: 'projects', name: 'projects (#/projects)', go: (p, b) => p.goto(b + '#/projects', { waitUntil: 'commit' }), ready: READY, targetBytes: 150000 },
  { id: 'about', name: 'about (#/about)', go: (p, b) => p.goto(b + '#/about', { waitUntil: 'commit' }), ready: READY, targetBytes: 150000 },
  { id: 'selector', name: 'selector page (#/selector)', go: (p, b) => p.goto(b + '#/selector', { waitUntil: 'commit' }), ready: READY, targetBytes: 150000 },
].filter((r) => !FILTER || r.id === FILTER || FILTER.split(',').includes(r.id));

async function once(r, profile) {
  const fast = profile === 'fast3g';
  const ctx = await browser.newContext(fast ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 768 } }); const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (fast) await cdp.send('Network.emulateNetworkConditions', NET);
  const urls = new Map(); const files = []; let bytes = 0;
  cdp.on('Network.requestWillBeSent', (e) => urls.set(e.requestId, e.request.url));
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; files.push({ url: (urls.get(e.requestId) || '?').replace(base, ''), bytes: e.encodedDataLength }); });
  await page.addInitScript(() => { window.__fcp = null; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__fcp = e.startTime; }).observe({ type: 'paint', buffered: true }); });
  const t0 = Date.now(); await r.go(page, base); await page.waitForSelector(r.ready, { timeout: 120000 }); const ms = Date.now() - t0;
  const atAnswer = bytes; const filesAtAnswer = files.length;
  let fcp = await page.evaluate(() => window.__fcp).catch(() => null);
  if (fcp == null) { await page.waitForTimeout(300); fcp = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null).catch(() => null); }
  await page.waitForTimeout(fast ? 3500 : 1200); // let the deferred fonts and the idle work settle
  const out = { ms, fcp: fcp == null ? null : Math.round(fcp), bytesAtAnswer: atAnswer, requestsAtAnswer: filesAtAnswer, bytesSettled: bytes, requestsSettled: files.length, files: files.map((f) => ({ file: f.url, bytes: f.bytes })) };
  await ctx.close(); return out;
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const results = [];
for (const r of ROUTES) {
  const row = { id: r.id, route: r.name, targetBytes: r.targetBytes, targetMsFast3g: r.targetMsFast3g || null };
  for (const profile of ['fast3g', 'desktop']) {
    const runs = []; for (let i = 0; i < RUNS; i++) runs.push(await once(r, profile));
    const m = [...runs].sort((a, b) => a.ms - b.ms)[Math.floor(runs.length / 2)];
    row[profile] = { median_ms_to_answer: m.ms, median_fcp_ms: med(runs.map((x) => x.fcp ?? 99999)), all_ms: runs.map((x) => x.ms), all_fcp: runs.map((x) => x.fcp), bytes_at_answer: m.bytesAtAnswer, requests_at_answer: m.requestsAtAnswer, bytes_settled: m.bytesSettled, requests_settled: m.requestsSettled, files: m.files.sort((a, b) => b.bytes - a.bytes) };
  }
  results.push(row);
  const f = row.fast3g, d = row.desktop;
  console.log(`${r.id}: fast3g answer ${f.median_ms_to_answer} ms, FCP ${f.median_fcp_ms} ms, ${f.bytes_at_answer} B at answer (${f.requests_at_answer} req), ${f.bytes_settled} B settled | desktop answer ${d.median_ms_to_answer} ms, FCP ${d.median_fcp_ms} ms`);
}
await browser.close(); srv.close();
const out = { generated: new Date().toISOString(), tool: 'speed.mjs (playwright-core + Windows Chrome, CDP Network.emulateNetworkConditions)', profile: { name: 'DevTools Fast 3G', ...NET }, cache: 'disabled (cold load)', runs: RUNS, served_with: 'local static server, gzip level 6 for html, js, css, json', routes: results };
fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log('SPEED RECEIPT written ' + outFile);
