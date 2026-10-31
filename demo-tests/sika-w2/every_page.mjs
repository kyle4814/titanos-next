// every_page.mjs: "the bot is on every page". Walks every *.html under the portal (363 sheets, the selector hub, index.html) and asserts the advisor entry.
//   static pages: the floating button and the phone bar entry, both a link to the SAME deep link as the QR (#/ask?system=<slug>), the loader script, hidden when printed
//   sheets and hub also carry the QR (screen and paper copies on sheets) and its relative link equals the advisor entry's link
//   index.html: no static entry; the portal chrome builds the header and phone bar Advisor entries and app.js mounts the panel (checked in the sources)
// Mutations (in a temp copy): strip the button from one sheet, change one deep link, drop the loader script: each must be caught.
// usage: node every_page.mjs [portalDir]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.resolve(process.argv[2] || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
let fails = 0; const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).slice(0, 200) : '')); };

function walk(dir) { const out = []; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) out.push(...walk(p)); else if (e.name.endsWith('.html')) out.push(p); } return out; }

/** Returns a list of problems for one static page (empty = good). */
export function problems(portal, file) {
  const rel = path.relative(portal, file).split(path.sep).join('/'); const html = fs.readFileSync(file, 'utf8'); const bad = [];
  if (rel === 'index.html') return bad;
  const hub = rel === 'systems/index.html'; const slug = hub ? '' : rel.split('/')[1]; const root = hub ? '../' : '../../';
  const link = root + '#/ask' + (slug ? '?system=' + encodeURIComponent(slug) : '');
  const blk = (html.match(/<!--adv-->[\s\S]*?<!--\/adv-->/g) || []);
  if (blk.length !== 1) return [`advisor block count ${blk.length}`];
  const b = blk[0];
  const btn = /<a class="adv-btn" id="adv-open" href="([^"]*)"[^>]*data-adv-open[^>]*>[\s\S]*?Ask the advisor<\/a>/.exec(b);
  if (!btn) bad.push('no floating Ask the advisor button'); else if (btn[1] !== link) bad.push('button link ' + btn[1] + ' want ' + link);
  const bar = /<nav class="mbar adv-mbar"[\s\S]*?<\/nav>/.exec(b);
  if (!bar) bad.push('no phone bar'); else {
    const ask = /<a class="adv-mbar-ask" href="([^"]*)"[^>]*data-adv-open[^>]*>[\s\S]*?Ask the advisor<\/a>/.exec(bar[0]);
    if (!ask) bad.push('no phone bar advisor entry'); else if (ask[1] !== link) bad.push('phone link ' + ask[1]);
    if (!bar[0].includes('#/products') || !bar[0].includes('#/documents')) bad.push('phone bar missing Find a Product / SDS and TDS');
  }
  if (!new RegExp(`<script type="module" src="${root.replace(/\./g, '\\.')}assets/lib/sheet-advisor\\.js"></script>`).test(b)) bad.push('no loader script');
  if (!/data-adv-title="[^"]+"/.test(b)) bad.push('no system title');
  if (slug && !b.includes(`data-adv-system="${slug}"`)) bad.push('system slug missing');
  // the QR on the page opens the same address
  const qr = /<!--qr-->[\s\S]*?<a class="qr-link" href="([^"]*)"/.exec(html);
  if (!qr) bad.push('no QR'); else if (qr[1] !== link) bad.push('QR link ' + qr[1] + ' differs from the advisor link');
  if (!hub && !/<!--qrp-->/.test(html)) bad.push('no paper QR');
  // hidden when printed, and the hub (which links its CSS) links advisor.css; sheets inline it
  if (hub) { if (!html.includes('assets/advisor.css')) bad.push('hub does not link advisor.css'); } else if (!html.includes('.adv-btn{') || !/@media print\{\.adv-btn,\.adv-mbar\{display:none!important\}\}/.test(html)) bad.push('advisor css not inlined or print rule missing');
  return bad;
}

const pages = walk(PORTAL).sort();
const sheets = pages.filter((p) => /systems\/[^/]+\/index\.html$/.test(p.split(path.sep).join('/')));
t('363 system sheets', sheets.length === 363, sheets.length);
t('every html page is a sheet, the hub or the portal shell', pages.length === 365, `${pages.length} html files`);
const withAdv = [], failing = [];
for (const p of pages) { const pr = problems(PORTAL, p); if (!pr.length && !p.endsWith(path.join(path.basename(PORTAL), 'index.html'))) withAdv.push(p); if (pr.length) failing.push(path.relative(PORTAL, p) + ': ' + pr.join('; ')); }
t(`advisor entry on all 364 static pages (363 sheets + hub), ${withAdv.length} found`, withAdv.length === 364 && failing.length === 0, failing.slice(0, 3).join(' | '));
// the portal shell: Advisor in the header and phone bar is built by chrome.js, mounted by app.js
const chrome = fs.readFileSync(path.join(PORTAL, 'assets/lib/chrome.js'), 'utf8'), app = fs.readFileSync(path.join(PORTAL, 'assets/app.js'), 'utf8');
t('index.html: header and phone bar Advisor entries come from chrome.js, the panel is mounted by app.js', /icon\('chat'(, '[^']*')?\), '(Advisor|Ask)'\)/.test(chrome) && /openAssistant\(undefined, e\.currentTarget\)/.test(chrome) && /class: 'mbar'/.test(chrome) && /mountAssistant\(cfg\)/.test(app));
// the deep link is one the portal handles
t('the portal handles #/ask?system=', /ask/.test(fs.readFileSync(path.join(PORTAL, 'assets/lib/views3.js'), 'utf8') + fs.readFileSync(path.join(PORTAL, 'assets/app.js'), 'utf8')));
// the sheet loader exists and uses the real panel
const loader = fs.readFileSync(path.join(PORTAL, 'assets/lib/sheet-advisor.js'), 'utf8');
t('loader mounts the real assistant with the portal config and falls back to the link', /mountAssistant\(await data\.config\(\)\)/.test(loader) && /window\.location\.href = el\.href/.test(loader));
// precache keeps the loader
t('the offline cache lists the loader and advisor.css is inlined (not a separate cache entry needed)', fs.readFileSync(path.join(PORTAL, 'sw.js'), 'utf8').includes('assets/lib/sheet-advisor.js'));

// ---- mutations, in a temp copy of five pages ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'everypage-')); if (!tmp || !tmp.startsWith(os.tmpdir())) { console.log('FAIL no temp dir'); process.exit(1); }
try {
  const pick = sheets[0], hubf = path.join(PORTAL, 'systems/index.html');
  const copy = (f) => { const d = path.join(tmp, path.relative(PORTAL, f)); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(f, d); return d; };
  const a = copy(pick), h = copy(hubf);
  t('mutation base: untouched copies are clean', problems(tmp, a).length === 0 && problems(tmp, h).length === 0, problems(tmp, a).join(';'));
  const orig = fs.readFileSync(a, 'utf8');
  fs.writeFileSync(a, orig.replace(/<a class="adv-btn"[\s\S]*?<\/a>/, '')); t('mutation: the floating button stripped from one sheet is caught', problems(tmp, a).some((x) => /floating/.test(x)), problems(tmp, a).join(';'));
  fs.writeFileSync(a, orig.replace(/(<a class="adv-btn"[^>]*href=")[^"]*/, '$1../../#/wrong')); t('mutation: a wrong deep link is caught', problems(tmp, a).some((x) => /button link/.test(x)));
  fs.writeFileSync(a, orig.replace(/<script type="module" src="[^"]*sheet-advisor\.js"><\/script>/, '')); t('mutation: a missing loader script is caught', problems(tmp, a).some((x) => /loader/.test(x)));
  fs.writeFileSync(a, orig.replace(/<!--qr-->[\s\S]*?<!--\/qr-->/, '')); t('mutation: a missing QR is caught', problems(tmp, a).some((x) => /no QR/.test(x)));
  fs.writeFileSync(a, orig.replace(/@media print\{\.adv-btn,\.adv-mbar\{display:none!important\}\}/, '')); t('mutation: a missing print rule is caught', problems(tmp, a).some((x) => /print rule/.test(x)));
  const ho = fs.readFileSync(h, 'utf8'); fs.writeFileSync(h, ho.replace(/<!--adv-->[\s\S]*?<!--\/adv-->/, '')); t('mutation: the hub without the entry is caught', problems(tmp, h).length > 0);
} finally { if (tmp.startsWith(os.tmpdir() + path.sep)) fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(fails ? `EVERY PAGE ${fails} failed` : 'EVERY PAGE GREEN'); process.exit(fails ? 1 : 0);
