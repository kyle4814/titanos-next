// T08 weight and speed receipt: bytes over the wire (gzip as served, from CDP encodedDataLength) and time to first answer on a Fast 3G profile.
// usage (Windows node): node.exe weight.mjs [portalDir] [outFile] [runs=3]
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './_browser.mjs';
import { PORTAL, ROOT } from './_env.mjs';
const root = process.argv[2] || PORTAL; const outFile = process.argv[3] || path.join(ROOT, 'receipts', 'weight_2026-10-30.json'); const RUNS = +(process.argv[4] || 3);
const srv = await serve(root, { gzip: true }); const base = srv.base; const browser = await launch();
// DevTools "Fast 3G": 1.6 Mbit/s down, 750 Kbit/s up (x0.9 as DevTools applies), 562.5 ms latency
const NET = { offline: false, latency: 562.5, downloadThroughput: Math.round(1.6 * 1024 * 1024 / 8 * 0.9), uploadThroughput: Math.round(750 * 1024 / 8 * 0.9) };
const slug = 'porcelain-on-concrete-internal-wet-floor';

async function measure(name, drive, readySelector) {
  const runs = [];
  for (let r = 0; r < RUNS; r++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }); await cdp.send('Network.emulateNetworkConditions', NET);
    const reqs = new Map(); let bytes = 0; const files = [];
    cdp.on('Network.requestWillBeSent', (e) => reqs.set(e.requestId, e.request.url));
    cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; files.push({ url: reqs.get(e.requestId) || '?', bytes: e.encodedDataLength }); });
    const t0 = Date.now(); await drive(page, base); await page.waitForSelector(readySelector, { timeout: 120000 }); const ms = Date.now() - t0;
    await page.waitForTimeout(300); // let in-flight bytes that belong to the first answer finish
    runs.push({ ms, bytes, requests: files.length, files: files.sort((a, b) => b.bytes - a.bytes).slice(0, 8).map((f) => ({ file: f.url.replace(base, ''), bytes: f.bytes })) }); await ctx.close();
  }
  runs.sort((a, b) => a.ms - b.ms); const med = runs[Math.floor(runs.length / 2)];
  return { route: name, runs: runs.length, median_ms_to_first_answer: med.ms, bytes_over_wire_median_run: med.bytes, requests: med.requests, all_runs_ms: runs.map((r) => r.ms), all_runs_bytes: runs.map((r) => r.bytes), biggest_files: med.files };
}
const results = [];
results.push(await measure('home (#/)', (p, b) => p.goto(b + '#/', { waitUntil: 'commit' }), 'main:not([aria-busy]) h1'));
results.push(await measure('system result via the selector (cold load of #/selector, three choices, Show my system)', async (p, b) => {
  await p.goto(b + '#/selector', { waitUntil: 'commit' }); await p.getByLabel(/^porcelain/i).first().check({ force: true }); await p.getByLabel(/^concrete$/i).first().check({ force: true }); await p.getByLabel(/wet area floor/i).first().check({ force: true });
  await p.locator('#sel-go').click();
}, 'ol.steps > li'));
results.push(await measure('system sheet opened directly (cold load of systems/' + slug + '/)', (p, b) => p.goto(b + 'systems/' + slug + '/', { waitUntil: 'commit' }), 'ol.steps > li'));
results.push(await measure('product page (#/product/davco-grey-one-potadhesive)', (p, b) => p.goto(b + '#/product/davco-grey-one-potadhesive', { waitUntil: 'commit' }), 'main:not([aria-busy]) h1'));
await browser.close(); srv.close();
const sel = results[1], BUDGET = 700 * 1000;
const out = {
  generated: new Date().toISOString(), tool: 'weight.mjs (playwright-core + Windows Chrome, CDP Network.emulateNetworkConditions)', profile: { name: 'DevTools Fast 3G', ...NET }, cache: 'disabled (cold load)', viewport: '390x844 mobile',
  served_with: 'local static server with gzip level 6 for html, js, css, json (a stand-in for the host; the real host\'s compression may differ, so re-measure after deploy)',
  routes: results,
  budget_G6: { target_bytes: BUDGET, bytes_to_first_system_answer_via_selector: sel.bytes_over_wire_median_run, bytes_to_first_system_answer_direct_sheet: results[2].bytes_over_wire_median_run, one_bar_of_signal_line_allowed: sel.bytes_over_wire_median_run <= BUDGET && results[2].bytes_over_wire_median_run <= BUDGET },
  kyle_only: { note: 'Competitor HTML document sizes measured earlier today (bytes of HTML only, server rendered): 952,305; 1,937,580; 476,890. The portal is a single page app, so bytes to the first answer is the fair comparison. Not for the portal UI.', competitor_html_bytes: [952305, 1937580, 476890] },
};
fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
for (const r of results) console.log(`${r.route}: ${r.bytes_over_wire_median_run} bytes over the wire, ${r.median_ms_to_first_answer} ms to first answer (${r.requests} requests, runs ${r.all_runs_ms.join('/')} ms)`);
console.log(`WEIGHT RECEIPT written ${outFile}; one-bar line allowed: ${out.budget_G6.one_bar_of_signal_line_allowed}`);
