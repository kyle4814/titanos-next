// pwa_check.mjs: install as an app + outdoor mode, the parts that need no browser: manifest, icons, no logo files, service worker rules and the stale-sw
// comparison (both copies of build_sw.mjs), the 8 MB cache budget, the install-prompt rules (with a mutation check) and the outdoor-mode decision table.
// usage: node pwa_check.mjs [portalDir]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.resolve(process.argv[2] || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
const QA_SW = process.env.QA_SW || '/home/tech2/klinge-kernel/state/sika/qa_root/sika-demo-qa/build_sw.mjs';
let fails = 0; const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).slice(0, 220) : '')); };
const rd = (f) => fs.readFileSync(path.join(PORTAL, f), 'utf8');
// ---- manifest and icons
const m = JSON.parse(rd('manifest.webmanifest'));
t('manifest: name, short_name, start_url, scope, id, display standalone, background and theme colours, language', !!(m.name && m.short_name && m.start_url === './' && m.scope === './' && m.id && m.display === 'standalone' && /^#[0-9a-f]{6}$/i.test(m.background_color) && /^#[0-9a-f]{6}$/i.test(m.theme_color) && m.lang === 'en-AU'));
t('manifest: short_name fits a home screen label (12 characters or fewer)', m.short_name.length <= 12, m.short_name);
const png = (f) => { const b = fs.readFileSync(path.join(PORTAL, f)); return b.slice(0, 8).toString('hex') === '89504e470d0a1a0a' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
t('manifest: icons exist, are real PNGs and match their declared sizes (192, 512, one maskable)', m.icons.every((i) => { const d = png(i.src); return d && `${d[0]}x${d[1]}` === i.sizes; }) && m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512') && m.icons.some((i) => i.purpose === 'maskable'));
const iconFiles = fs.readdirSync(path.join(PORTAL, 'assets', 'img', 'app'));
t('no logo files: icon names are plain and the folder holds only the four generated PNGs', iconFiles.length === 4 && iconFiles.every((f) => /^(icon-192|icon-512|icon-maskable-512|apple-touch-icon)\.png$/.test(f)), iconFiles.join(','));
t('no Sika wordmark or logo in the manifest', !/logo|wordmark/i.test(JSON.stringify(m)) && !/sika/i.test(m.name + m.short_name));
const html = rd('index.html');
t('index.html: manifest link (with credentials, so a gated preview still serves it), apple touch icon, theme colour', /<link rel="manifest" href="manifest\.webmanifest" crossorigin="use-credentials">/.test(html) && /rel="apple-touch-icon" href="assets\/img\/app\/apple-touch-icon\.png"/.test(html) && /name="theme-color"/.test(html));
// ---- service worker
const sw = rd('sw.js'); const FILES = JSON.parse(/const FILES = (\[.*?\]);/s.exec(sw)[1]); const BYTES = +/const BYTES = (\d+)/.exec(sw)[1];
t('service worker: the cache stays under the 8 MB budget (the existing T19 test)', BYTES < 8 * 1048576, `${BYTES} bytes, ${(8 * 1048576 - BYTES)} bytes of headroom`);
t('service worker: no images in the precache (no png, jpg, webp, svg, no assets/img, no sheets)', !FILES.some((f) => /\.(png|jpe?g|webp|gif|svg|ico)$/.test(f) || f.startsWith('assets/img/') || f.startsWith('systems/')));
t('service worker: ask, outdoor and install modules and their stylesheets are cached for offline use', ['assets/lib/ask-system.js', 'assets/lib/outdoor.js', 'assets/lib/pwa.js', 'assets/outdoor.css', 'assets/pwa.css', 'assets/qr.css'].every((f) => FILES.includes(f)));
t('service worker: the network-only data quality page files are left out of the cache', !FILES.includes('assets/lib/data-quality.js') && !FILES.includes('assets/dq.css') && !FILES.some((f) => f.startsWith('data/gift/')));
const mjsOut = (script, portal) => spawnSync(process.execPath, ['-e', `process.argv[2]=${JSON.stringify(portal)};import(${JSON.stringify(pathToFileURL(script).href)}).then(m=>process.stdout.write(m.build().src))`], { encoding: 'utf8', maxBuffer: 5e7 });
const repoSw = path.join(HERE, '..', '..', 'demo-tools', 'sika-210c0c', 'build_sw.mjs');
const a = mjsOut(repoSw, PORTAL), b = mjsOut(QA_SW, PORTAL);
t('stale-sw: sw.js on disk equals what the repo build_sw.mjs would write now', a.status === 0 && a.stdout === sw, a.stderr);
t('stale-sw: the qa_root copy of build_sw.mjs (used by the stale-sw test) writes the same bytes', b.status === 0 && b.stdout === sw, b.stderr);
t('service worker: still no sync, no push, no analytics', !/addEventListener\('(sync|periodicsync|push|notificationclick)'|analytics|beacon|registration\.sync/i.test(sw.replace(/^\/\/.*$/gm, '')));
// mutation: a stale sw.js (one file changed) must be detected by the same comparison
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'pwa-fixture-')); if (!tmp.includes('pwa-fixture-')) process.exit(2);
try { fs.cpSync(path.join(PORTAL, 'assets', 'lib', 'pwa.js'), path.join(tmp, 'pwa.js')); const stale = sw.replace(/const CACHE = PREFIX \+ '[0-9a-f]+'/, "const CACHE = PREFIX + '0000000000'"); t('mutation: a sw.js with another cache hash is seen as stale', stale !== a.stdout); } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
// ---- install prompt rules
const pwaFile = path.join(PORTAL, 'assets', 'lib', 'pwa.js'); const pwaSrc = fs.readFileSync(pwaFile, 'utf8');
const load = async (src) => import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
const P = await load(pwaSrc); const ok = { views: P.NEED_VIEWS, msOnPage: P.NEED_MS, dismissed: false, standalone: false, canInstall: true, advisorOpen: false };
t('install rules: offered once the browser can install and there has been real use', P.shouldOffer(ok) === true);
const rules = [['too few pages', { views: P.NEED_VIEWS - 1 }], ['too soon', { msOnPage: P.NEED_MS - 1 }], ['dismissed', { dismissed: true }], ['already installed', { standalone: true }], ['browser cannot install', { canInstall: false }], ['advisor open', { advisorOpen: true }]];
for (const [n, o] of rules) t(`install rules: not offered when ${n}`, P.shouldOffer({ ...ok, ...o }) === false);
t('install rules: real use is 4 pages and 30 seconds', P.NEED_VIEWS === 4 && P.NEED_MS === 30000);
const mut = await load(pwaSrc.replace('views >= NEED_VIEWS', 'views >= 0'));
t('mutation: removing the "real use" rule is caught by the rules above', mut.shouldOffer({ ...ok, views: 0 }) === true && P.shouldOffer({ ...ok, views: 0 }) === false);
const mut2 = await load(pwaSrc.replace('!dismissed &&', ''));
t('mutation: removing the "dismissed stays dismissed" rule is caught', mut2.shouldOffer({ ...ok, dismissed: true }) === true && P.shouldOffer({ ...ok, dismissed: true }) === false);
t('no tracking: the new modules make no network call except same-origin data and no beacon, no XHR, no external address', ['assets/lib/pwa.js', 'assets/lib/outdoor.js', 'assets/lib/ask-system.js', 'assets/lib/data-quality.js'].every((f) => !/sendBeacon|XMLHttpRequest|https?:\/\/|WebSocket|gtag|analytics/i.test(rd(f).replace(/\/\/ .*$/gm, ''))));
// ---- outdoor mode decision table (stubbed browser globals)
const store = {}; globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
let more = false; globalThis.matchMedia = () => ({ matches: more, addEventListener() {} });
const O = await import(pathToFileURL(path.join(PORTAL, 'assets', 'lib', 'outdoor.js')).href);
const KEY = 'sika-demo-210c0c-outdoor';
const cases = [[null, false, false], [null, true, true], ['on', false, true], ['off', true, false], ['on', true, true], ['off', false, false]];
for (const [v, mo, want] of cases) { delete store[KEY]; if (v) store[KEY] = v; more = mo; t(`outdoor: stored ${v}, device asks for more contrast ${mo} -> ${want ? 'on' : 'off'}`, O.outdoorOn() === want); }
const css = rd('assets/outdoor.css');
t('outdoor.css: every rule is scoped to html.outdoor (or is the toggle itself), so loading it changes nothing by itself', css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((x) => x.trim()).filter(Boolean).every((blk) => /html\.outdoor|\.od-toggle|\.hdr-meta \.od-toggle|@media/.test(blk.split('{')[0] + (blk.includes('@media') ? '@media' : ''))));
t('outdoor.css: 48 px minimum for controls (brief: 44) and a 125 percent root size', /min-height:48px/.test(css) && /font-size:125%/.test(css));
t('outdoor.css is its own file and is not inlined into the shell', !/html\.outdoor/.test(rd('index.html')) && !/html\.outdoor/.test(fs.readFileSync(path.join(PORTAL, 'assets', 'portal.css'), 'utf8')));
console.log(fails ? `PWA CHECK ${fails} failed` : 'PWA CHECK GREEN'); process.exit(fails ? 1 : 0);
