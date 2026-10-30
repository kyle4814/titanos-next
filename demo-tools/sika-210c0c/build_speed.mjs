// build_speed.mjs: speed build for the Sika demo portal (apply/speed). Idempotent; sources are never changed by it.
//   1. JS: bundles the module graph into assets/dist/main.js (everything the first screen needs) and assets/dist/lazy.js (the advisor engine and
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
  code = code.replace(/__IMURL__/g, `new URL(${JSON.stringify('../' + id)},import.meta.url).href`);
  if (/import\.meta|\bimport\s*\(/.test(code.replace(/new URL\([^)]*import\.meta\.url\)\.href/g, ''))) throw new Error('unhandled import.meta or import() in ' + id);
  mods.set(id, { code, deps, dyn });
  for (const d of [...deps, ...dyn]) await load(d);
}
await load('app.js');
const reach = (roots) => { const seen = new Set(); const st = [...roots]; while (st.length) { const i = st.pop(); if (seen.has(i)) continue; seen.add(i); for (const d of mods.get(i).deps) st.push(d); } return seen; };
const mainSet = reach(['app.js']);
const lazyRoots = new Set(); for (const i of mainSet) for (const d of mods.get(i).dyn) if (!mainSet.has(d)) lazyRoots.add(d);
const lazySet = reach(lazyRoots); for (const i of mainSet) lazySet.delete(i);
// a module loaded dynamically from the lazy chunk may itself be in main: fine. Anything dynamic from lazy modules must be in main or lazy.
for (const i of lazySet) for (const d of mods.get(i).dyn) if (!mainSet.has(d) && !lazySet.has(d)) throw new Error('dynamic target outside both chunks: ' + d);
const wrap = (ids) => [...ids].sort().map((id) => `${JSON.stringify(id)}:function(exports,__r,__l){${mods.get(id).code}\n}`).join(',\n');
const runtime = `const R=globalThis.__sk||(globalThis.__sk={m:{},c:{},p:{}});
const __r=(id)=>{let c=R.c[id];if(c)return c.exports;const f=R.m[id];if(!f)throw new Error('module not loaded: '+id);c=R.c[id]={exports:{}};f(c.exports,__r,__l);return c.exports};
const __l=(id)=>R.m[id]?Promise.resolve(__r(id)):(R.p.lazy||(R.p.lazy=import(new URL('lazy.js',import.meta.url).href))).then(()=>__r(id));
`;
const minify = async (code) => (await swc.minify(Buffer.from(code), Buffer.from(JSON.stringify({ compress: true, mangle: true, module: true })))).code;
const mainSrc = runtime + `Object.assign(R.m,{\n${wrap(mainSet)}\n});\n__r("app.js");\n`;
const lazySrc = `const R=globalThis.__sk||(globalThis.__sk={m:{},c:{},p:{}});\nObject.assign(R.m,{\n${wrap(lazySet)}\n});\n`;
const mainMin = await minify(mainSrc), lazyMin = await minify(lazySrc);
wr(path.join(A, 'dist', 'main.js'), mainMin); wr(path.join(A, 'dist', 'lazy.js'), lazyMin);
console.log(`dist/main.js ${mainMin.length} B (${mainSet.size} modules), dist/lazy.js ${lazyMin.length} B (${lazySet.size} modules)`);

// ---------- 2. CSS ----------
const css = (f) => lcss.transform({ filename: f, code: Buffer.from(rd(path.join(A, f))), minify: true }).code.toString();
const portalRaw = rd(path.join(A, 'portal.css'));
const faces = portalRaw.split('\n').filter((l) => l.startsWith('@font-face'));
if (faces.length) throw new Error('portal.css still holds @font-face rules: they belong in fonts/fonts.css (deferred)');
const portalCss = css('portal.css');
const inlineCss = portalCss + css('finder.css');
const sheetCss = css('sheet.css');
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
  html = put(html, 'head', `<link rel="modulepreload" href="assets/dist/main.js"><link rel="preload" href="data/config.json" as="fetch" crossorigin="anonymous"><link rel="preload" href="data/s/cats.json" as="fetch" crossorigin="anonymous"><style>${inlineCss}</style>`, '</head>');
  html = html.replace(/<script type="module" src="[^"]*"><\/script>/, '<script type="module" src="assets/dist/main.js"></script>');
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
