// build_speed.mjs: speed build for the Sika demo portal (apply/speed). Idempotent; sources are never changed by it.
//   1. JS: bundles the module graph into dist/main.js (everything the first screen needs) and dist/lazy.js (the advisor engine and
//      the data-panel modules, fetched on demand), transpiled with swc (module graph resolved here) and minified. The original files under
//      assets/ stay in place and keep working on their own (tests import them directly).
//   2. CSS: portal.css + finder.css minified and inlined into index.html (between the speed:css markers); the six @font-face rules live in
//      assets/fonts/fonts.css and are attached after the page has loaded, so web fonts never block or compete with the first screen.
//   3. Sheets: the 363 static system sheets get the same inline CSS and the deferred font stylesheet (between the speed markers).
//   4. Data: data/s/* split files (see split_data.mjs, run from here).
// usage: node build_speed.mjs [portalDir]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { splitData } from './split_data.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.resolve(process.argv[2] || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
const NM = process.env.SPEED_NODE_MODULES || '/home/tech2/titanos_launch/titanos-next/node_modules';
const req = createRequire(NM + '/x.js');
const swc = req('@next/swc-linux-x64-gnu');
const lcss = req('lightningcss');
const A = path.join(PORTAL, 'assets');
const rd = (f) => fs.readFileSync(f, 'utf8');
const wr = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

// ---------- 1. JS bundles ----------
const OPTS = { jsc: { parser: { syntax: 'ecmascript' }, target: 'es2022' }, module: { type: 'commonjs', ignoreDynamic: true, importInterop: 'none', strict: true } };
async function transform(id, src) {
  const r = await swc.transform(src, true, Buffer.from(JSON.stringify({ ...OPTS, filename: id })));
  return r.code;
}
const resolveId = (from, spec) => path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
const mods = new Map(); // id -> { code, deps:Set, dyn:Set }
async function load(id) {
  if (mods.has(id)) return;
  const src = rd(path.join(A, id));
  let code = await transform(id, src.replace(/import\.meta\.url/g, '__IMURL__'));
  const deps = new Set(), dyn = new Set();
  code = code.replace(/\brequire\((["'])(\.[^"']+)\1\)/g, (_, q, s) => { const d = resolveId(id, s); deps.add(d); return `__r(${JSON.stringify(d)})`; });
  code = code.replace(/\bimport\((["'])(\.[^"']+)\1\)/g, (_, q, s) => { const d = resolveId(id, s); dyn.add(d); return `__l(${JSON.stringify(d)})`; });
  code = code.replace(/__IMURL__/g, `new URL(${JSON.stringify('../assets/' + id)},import.meta.url).href`);
  if (/import\.meta|\bimport\s*\(/.test(code.replace(/new URL\([^)]*import\.meta\.url\)\.href/g, ''))) throw new Error('unhandled import.meta or import() in ' + id);
  mods.set(id, { code, deps, dyn });
  for (const d of [...deps, ...dyn]) await load(d);
}
await load('app.js');
const reach = (roots) => { const seen = new Set(); const st = [...roots]; while (st.length) { const i = st.pop(); if (seen.has(i)) continue; seen.add(i); for (const d of mods.get(i).deps) st.push(d); } return seen; };
const mainSet = reach(['app.js']);
// Lazy chunks by who needs them: every dynamic import target is a root; a module reachable from a set of roots goes in the chunk for exactly that set,
// so nothing is fetched for a feature that is not used (the v1 engine is not downloaded when the v2 brain answers, and the reverse).
const lazyRoots = new Set(); const lazyAll = new Set();
for (let grew = true; grew;) { grew = false; for (const i of [...mainSet, ...lazyAll]) for (const d of mods.get(i).dyn) if (!mainSet.has(d) && !lazyRoots.has(d)) { lazyRoots.add(d); for (const m of reach([d])) if (!mainSet.has(m)) lazyAll.add(m); grew = true; } }
// features: the v2 brain, the v1 engine, the actions, and the published-data panels (rates, times, clauses) used by the product and sheet pages
// the calculator kinds (gencalc) are shared by the advisor and the project page's re-run button but are not a panels feature, so category pages do not download them
// the product page's own panels (rate calculator, bill of materials) are their own feature, so category and sheet pages do not download them
const FEATURE = (id) => (id.startsWith('brain/') ? 'brain' : id === 'assistant/engine.js' ? 'engine' : id.startsWith('actions/') ? 'actions' : id === 'lib/finder/panels.js' ? 'pdppanels' : (id === 'lib/finder/gencalc.js' || id === 'lib/calcsection.js') ? 'gencalc' : 'panels');
const sig = new Map(); for (const r of [...lazyRoots].sort()) for (const m of reach([r])) if (!mainSet.has(m)) { const f = FEATURE(r); const cur = sig.get(m) || []; if (!cur.includes(f)) sig.set(m, [...cur, f].sort()); }
const chunkOf = new Map(); // signature -> { name, ids }
for (const [m, roots] of sig) { const key = roots.join('|'); if (!chunkOf.has(key)) chunkOf.set(key, { roots, ids: new Set(), name: roots.join('-') }); chunkOf.get(key).ids.add(m); }
const wrap = (ids) => [...ids].sort().map((id) => `${JSON.stringify(id)}:function(exports,__r,__l){${mods.get(id).code}\n}`).join(',\n');
const kmap = {}; for (const r of lazyRoots) kmap[r] = [...chunkOf.values()].filter((c) => c.roots.includes(FEATURE(r))).map((c) => c.name);
const runtime = `const R=globalThis.__sk||(globalThis.__sk={m:{},c:{},p:{},k:{}});
const __r=(id)=>{let c=R.c[id];if(c)return c.exports;const f=R.m[id];if(!f)throw new Error('module not loaded: '+id);c=R.c[id]={exports:{}};f(c.exports,__r,__l);return c.exports};
const __c=(n)=>R.p[n]||(R.p[n]=import(new URL(n+'.js',import.meta.url).href));
const __l=(id)=>R.m[id]?Promise.resolve(__r(id)):Promise.all((R.k[id]||[]).map(__c)).then(()=>__r(id));
Object.assign(R.k,${JSON.stringify(kmap)});
`;
const minify = async (code) => (await swc.minify(Buffer.from(code), Buffer.from(JSON.stringify({ compress: true, mangle: true, module: true })))).code;
const mainSrc = runtime + `Object.assign(R.m,{\n${wrap(mainSet)}\n});\n__r("app.js");\n`;
const chunkSrc = (set) => `const R=globalThis.__sk;\nObject.assign(R.m,{\n${wrap(set)}\n});\n`;
const mainMin = await minify(mainSrc);
fs.rmSync(path.join(A, 'dist'), { recursive: true, force: true }); fs.rmSync(path.join(PORTAL, 'dist'), { recursive: true, force: true });
// dist/ sits OUTSIDE assets/ on purpose: the offline cache lists every file under assets/, and the bundles would add 0.4 MB to it. Offline, the inline boot
// script in index.html (hashed into the CSP) loads the readable modules instead, which are cached.
wr(path.join(PORTAL, 'dist', 'main.js'), mainMin);
const sizes = [];
for (const c of chunkOf.values()) { const code = await minify(`const R=globalThis.__sk;\nObject.assign(R.m,{\n${wrap(c.ids)}\n});\n`); wr(path.join(PORTAL, 'dist', c.name + '.js'), code); sizes.push(`${c.name} ${code.length} B (${c.ids.size} modules; ${c.roots.join(', ')})`); }
fs.rmSync(path.join(A, 'boot.js'), { force: true });
console.log(`dist/main.js ${mainMin.length} B (${mainSet.size} modules)`); sizes.forEach((x) => console.log('dist/' + x));

// ---------- 2. CSS ----------
const css = (f) => lcss.transform({ filename: f, code: Buffer.from(rd(path.join(A, f))), minify: true }).code.toString();
const portalRaw = rd(path.join(A, 'portal.css'));
const faces = portalRaw.split('\n').filter((l) => l.startsWith('@font-face'));
if (faces.length) throw new Error('portal.css still holds @font-face rules: they belong in fonts/fonts.css (deferred)');
const portalCss = css('portal.css');
const inlineCss = portalCss + css('finder.css');
const sheetCss = css('sheet.css') + css('qr.css') + css('advisor.css'); // wave 2: qr.css = the QR on every sheet, advisor.css = the Ask the advisor entry
const mark = (name, body) => `<!--speed:${name}-->${body}<!--/speed:${name}-->`;
const reMark = (name) => new RegExp(`<!--speed:${name}-->[\\s\\S]*?<!--/speed:${name}-->`);
function put(html, name, body, anchor) {
  if (reMark(name).test(html)) return html.replace(reMark(name), () => mark(name, body));
  if (!anchor) throw new Error('no marker ' + name);
  return html.replace(anchor, (m) => mark(name, body) + m);
}

// ---------- index.html ----------
{
  const f = path.join(PORTAL, 'index.html'); let html = rd(f);
  html = html.replace(/<link rel="preload" href="assets\/fonts[^>]*>\n?/, '').replace(/<link rel="stylesheet" href="assets\/(portal|finder)\.css">\n?/g, '');
  // Inline boot script: the bundle when online, the readable modules when offline or if the bundle cannot be fetched. It is hashed into the CSP.
  const BOOT = "(function(){var d=document;function f(){var t=d.createElement('script');t.type='module';t.src='assets/app.js';d.head.appendChild(t)}if(navigator.onLine===false){f();return}var s=d.createElement('script');s.type='module';s.src='dist/main.js';s.onerror=f;d.head.appendChild(s)})();";
  const hash = 'sha256-' + crypto.createHash('sha256').update(BOOT).digest('base64');
  html = put(html, 'head', `<script>${BOOT}</script><link rel="preload" href="data/config.json" as="fetch" crossorigin="anonymous"><link rel="preload" href="data/cats.lite.json" as="fetch" crossorigin="anonymous"><style>${inlineCss}</style>`, '</head>');
  html = html.replace(/ ?<script type="module" src="[^"]*"><\/script>\n?/, '\n');
  html = html.replace(/script-src 'self'(?: 'sha256-[^']*')?/, `script-src 'self' '${hash}'`);
  wr(f, html);
}
// ---------- fonts.css ----------

// ---------- 3. sheets ----------
let nsheets = 0;
const sysDir = path.join(PORTAL, 'systems');
for (const e of fs.readdirSync(sysDir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const f = path.join(sysDir, e.name, 'index.html'); if (!fs.existsSync(f)) continue;
  let html = rd(f);
  html = html.replace(/<link rel="stylesheet" href="\.\.\/\.\.\/assets\/(portal|sheet)\.css">\n?/g, '');
  html = put(html, 'head', `<style>${portalCss}${sheetCss}</style>`, '</head>');
  wr(f, html); nsheets++;
}
console.log('inline css bytes', inlineCss.length, 'portal only', portalCss.length, 'sheet css', sheetCss.length, 'sheets rewritten', nsheets);

// ---------- 4. data ----------
await splitData(PORTAL);
