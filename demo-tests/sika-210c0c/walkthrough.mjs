// T07 walk-through rehearsal: performs the five beats of the Monday script (STRATEGY_2026-10-30.md section 8.2) in a real Chrome.
// usage (Windows node, because the only Chrome is the Windows one):
//   node.exe walkthrough.mjs [baseUrl|portalDir] <outDir> [sizes=1366x768,390x844]
// A beat whose feature is missing FAILS loudly. Assertions are never weakened to go green.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { serve, launch } from './_browser.mjs';
import { PORTAL } from './_env.mjs';
const [, , target0, outDir = './walkthrough_out', sizesArg = '1366x768,390x844'] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
let base, closer = () => {}, root = PORTAL;
if (target0 && /^https?:/.test(target0)) base = target0.endsWith('/') ? target0 : target0 + '/';
else { root = target0 || PORTAL; const s = await serve(root); base = s.base; closer = s.close; }
const ROUTES = { rules: process.env.WT_RULES_ROUTE || '#/rules', insights: process.env.WT_INSIGHTS_ROUTE || '#/insights', selector: process.env.WT_SELECTOR_ROUTE || '#/selector' };

const hashDir = (d) => { const h = crypto.createHash('sha256'); const walk = (p) => fs.readdirSync(p, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1).forEach((e) => { const f = path.join(p, e.name); if (e.isDirectory()) walk(f); else { h.update(path.relative(d, f)); h.update(fs.readFileSync(f)); } }); walk(d); return h.digest('hex').slice(0, 16); };
const folderHash = fs.existsSync(root) && fs.statSync(root).isDirectory() ? hashDir(root) : 'remote';
const results = []; const rec = (size, beat, ok, detail = '') => { results.push({ size, beat, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + size + ' ' + beat + (detail ? ' :: ' + String(detail).slice(0, 240) : '')); };
const browser = await launch();
const SRC = /aus\.sika\.com/;

for (const sz of sizesArg.split(',')) {
  const [W, H] = sz.split('x').map(Number); const phone = W < 600;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: phone, isMobile: phone, acceptDownloads: true });
  const page = await ctx.newPage();
  const baseHost = new URL(base).host;
  await ctx.route('**/*', (r) => { const u = new URL(r.request().url()); return (u.host === baseHost || u.protocol === 'data:' || u.protocol === 'blob:') ? r.continue() : r.abort(); });
  const ready = async () => { await page.waitForSelector('main:not([aria-busy])', { timeout: 30000 }); await page.waitForTimeout(200); };
  const shot = (n) => page.screenshot({ path: `${outDir}/${sz}_${n}.png`, fullPage: true });
  const beat = async (name, fn) => { try { await fn(); } catch (e) { rec(sz, name, false, e.message.split('\n')[0]); try { await shot(name.slice(0, 6).replace(/\W/g, '') + '_FAIL'); } catch {} } };
  const lastBot = async () => { const m = page.locator('.asst-log .msg--bot'); await m.last().waitFor({ timeout: 15000 }); await page.waitForTimeout(500); return m.last(); };
  const ask = async (q) => {
    if (!(await page.locator('#assistant[aria-hidden="false"]').count())) { await page.locator('button:visible:has-text("Advisor")').first().click(); }
    const before = await page.locator('.asst-log .msg--bot').count();
    await page.fill('#asst-q', q); await page.press('#asst-q', 'Enter');
    await page.waitForFunction((n) => document.querySelectorAll('.asst-log .msg--bot').length > n && !document.querySelector('.asst-log .typing'), before, { timeout: 15000 }); return lastBot();
  };
  let sheetUrl = null;

  await beat('beat1 system finder', async () => {
    await page.goto(base + ROUTES.selector, { waitUntil: 'load' }); await ready();
    let picks = 0;
    for (const re of [/^porcelain/i, /^concrete$/i, /bathroom|wet area floor/i]) { await page.getByLabel(re).first().check({ force: true }); picks++; await ready(); }
    rec(sz, 'beat1 three selections or fewer', picks <= 3, picks + ' selections');
    const go = page.locator('#sel-go, a:has-text("Show my system")').first(); await go.waitFor({ timeout: 8000 });
    await go.click(); await page.waitForSelector('ol.steps li, .sheet-steps li', { timeout: 15000 });
    sheetUrl = page.url();
    const steps = await page.locator('ol.steps > li').evaluateAll((els) => els.map((e) => ({ t: e.innerText.slice(0, 60), ok: [...e.querySelectorAll('a[href]')].some((a) => /aus\.sika\.com/.test(a.href)), stated: !/not stated/i.test(e.innerText) })));
    const stated = steps.filter((s) => s.stated);
    rec(sz, 'beat1 ordered system appears', steps.length >= 3, steps.length + ' steps');
    rec(sz, 'beat1 a source link on every stated step', stated.length > 0 && stated.every((s) => s.ok), `${stated.filter((s) => s.ok).length} of ${stated.length} stated steps carry an aus.sika.com link`);
    await shot('beat1');
  });

  await beat('beat2 twelve square metres', async () => {
    if (!sheetUrl) throw new Error('beat 1 produced no sheet to enter the area on');
    await page.fill('#m2', '12'); await page.waitForTimeout(400);
    const res = await page.locator('#m2-result').innerText();
    const opts = await page.locator('ol.steps li.opt').evaluateAll((els) => els.map((e) => ({ calc: (e.querySelector('.calc') || {}).innerText || '', basis: (e.querySelector('.rate') || {}).innerText || '', link: [...e.querySelectorAll('a[href]')].some((a) => /aus\.sika\.com/.test(a.href)) })));
    const counted = opts.filter((o) => /rounded up/i.test(o.calc));
    rec(sz, 'beat2 pack counts appear', counted.length >= 1, `${counted.length} products with a pack count out of ${opts.length}; ${res.slice(0, 60)}`);
    rec(sz, 'beat2 each count has its basis sentence and link', counted.length >= 1 && counted.every((o) => o.basis.length > 20 && o.link));
    // independent check: n x size must cover the low end of the need and (n-1) x size must not cover the high end
    let okMath = counted.length > 0; const notes = [];
    for (const o of counted) {
      const need = o.calc.match(/about\s+([\d.,]+)\s*(?:to\s*([\d.,]+))?\s*(litres?|kg|l)\b/i); const packs = [...o.calc.matchAll(/(\d+)\s*x\s*([\d.,]+)\s*(l|kg)\b/gi)];
      if (!need || !packs.length) { okMath = false; notes.push('unparsed: ' + o.calc.slice(0, 60)); continue; }
      const lo = parseFloat(need[1].replace(/,/g, '')), hi = parseFloat((need[2] || need[1]).replace(/,/g, ''));
      for (const m of packs) { const n = +m[1], size = parseFloat(m[2]); if (!(n * size >= lo - 1e-9 && (n - 1) * size < hi - 1e-9)) { okMath = false; notes.push(`${n} x ${size} vs ${lo}-${hi}`); } }
    }
    rec(sz, 'beat2 counts are whole packs, rounded up (checked independently)', okMath, notes.slice(0, 2).join('; ') || counted.length + ' products checked');
    await shot('beat2');
  });

  await beat('beat3 Davco over old tiles', async () => {
    await page.goto(base, { waitUntil: 'load' }); await ready();
    const m = await ask('Can I use Davco Grey One Pot over my old tiles?'); const t = await m.innerText(); await shot('beat3');
    rec(sz, 'beat3 the answer says no', /\b(no|not|cannot|can.?t|do not|should not|unsuitable)\b/i.test(t.slice(0, 400)), t.slice(0, 120).replace(/\n/g, ' '));
    rec(sz, 'beat3 shows the data sheet sentence with its link', (await m.locator('a[href*="aus.sika.com"]').count()) >= 1 && /(existing|old)\s+tiles|tile over tile|over tiles/i.test(t) && /[\u201C"][^\u201D"]{25,}[\u201D"]|blockquote/i.test(await m.innerHTML() + t));
    rec(sz, 'beat3 offers suitable products', (await m.locator('a[href*="#/product/"]').count()) >= 1, (await m.locator('a[href*="#/product/"]').count()) + ' product links');
  });

  await beat('beat4 heated floor', async () => {
    const m = await ask('Can I tile over a heated floor?'); const t = await m.innerText(); await shot('beat4');
    rec(sz, 'beat4 says it is not in the published data', /not in the published (data|documentation)/i.test(t), t.slice(0, 120).replace(/\n/g, ' '));
    rec(sz, 'beat4 shows the hand-off block (Technical Services)', /technical services/i.test(t) && (await m.locator('a[href], button').count()) >= 1);
  });

  await beat('beat5 rules and insights views', async () => {
    await page.goto(base + ROUTES.rules, { waitUntil: 'load' }); await ready();
    if (/could not find that page/i.test(await page.locator('main').innerText())) throw new Error('rules view missing: ' + ROUTES.rules + ' is the not-found page');
    const rows = await page.locator('table tbody tr').count(); const linked = await page.locator('table tbody tr:has(a[href*="aus.sika.com"])').count();
    rec(sz, 'beat5 rules view shows rows with source links', rows > 0 && linked === rows, `${linked} of ${rows} rows linked`);
    await shot('beat5_rules');
    await page.goto(base + ROUTES.insights, { waitUntil: 'load' }); await ready();
    const txt = await page.locator('main').innerText(); await shot('beat5_insights');
    if (/could not find that page/i.test(txt)) throw new Error('insights view missing: ' + ROUTES.insights + ' is the not-found page');
    rec(sz, 'beat5 gap list shows the beat 4 question', /heated floor/i.test(txt), txt.slice(0, 100).replace(/\n/g, ' '));
  });

  await beat('print one A4 page', async () => {
    if (!sheetUrl) throw new Error('no sheet to print');
    await page.goto(sheetUrl, { waitUntil: 'load' }); await page.waitForSelector('ol.steps li'); await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    const s = pdf.toString('latin1'); const pages = (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
    fs.writeFileSync(`${outDir}/${sz}_sheet.pdf`, pdf);
    rec(sz, 'print sheet is one A4 page', pages === 1, pages + ' page(s) from printToPDF');
    await page.emulateMedia({ media: 'screen' });
  });
  await ctx.close();
}
await browser.close(); closer();
const pass = results.filter((r) => r.ok).length;
console.log(`WALKTHROUGH RECEIPT folder ${folderHash} date ${new Date().toISOString().slice(0, 10)} pass ${pass}/${results.length}`);
process.exit(pass === results.length ? 0 : 1);
