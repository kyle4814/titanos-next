// T05 hygiene gate: scans PORTAL and ASSIST (files only, never fetches). Exit 0 prints HYGIENE GREEN.
// usage: node hygiene.mjs [portalDir] [assistDir]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PORTAL as P0, ASSIST as A0, LINT_DIR } from './_env.mjs';
const PORTAL = process.argv[2] || P0, ASSIST = process.argv[3] || A0;

// AI-tell lists are READ from the house linter sources at run time (ast), never copied here.
function loadTells() {
  const py = `
import ast, json, sys
out = {}
for f, names in ((sys.argv[1] + '/send_pack.py', ['TELLS']), (sys.argv[1] + '/content_lint.py', ['PHRASES'])):
    tree = ast.parse(open(f, encoding='utf8').read())
    for n in tree.body:
        if isinstance(n, ast.Assign) and getattr(n.targets[0], 'id', '') in names and isinstance(n.value, ast.Call):
            a = n.value.args[0]
            out[n.targets[0].id] = ast.literal_eval(a)
print(json.dumps(out))`;
  try { return JSON.parse(execFileSync('python3', ['-I', '-c', py, LINT_DIR], { encoding: 'utf8' })); } catch (e) { return null; }
}
const tells = loadTells();

const problems = [];
const bad = (file, line, rule, detail) => problems.push({ file: path.relative(path.dirname(PORTAL), file), line, rule, detail });
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.name === 'node_modules' || e.name === '.git' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
// apply/speed: assets/dist holds generated bundles of the source modules below it. It IS scanned (competitor names, external URLs, analytics, AI-tell words,
// emoji, placeholders); only the dash scan (swc writes escapes as literal characters) and the per-module size budget skip it, because the sources are scanned and budgeted.
const GENERATED = /[\\/]assets[\\/]dist[\\/]/;
const files = [...walk(PORTAL), ...(fs.existsSync(ASSIST) ? walk(ASSIST) : [])];
const ext = (f) => path.extname(f).toLowerCase();
const CODE = new Set(['.js', '.mjs', '.html', '.css']);
const DATA = new Set(['.json']);

const COMP = /\b(ardex|mapei|bostik|fosroc|laticrete|weber)\b/i;
const DASH = /[–—]/;
const EMOJI = /[\u{1F000}-\u{1FFFF}☀-➿⭐⬆✅❌️]/u;
const ALLOW_URL = /^https?:\/\/(aus\.sika\.com|([a-z0-9-]+\.)?titanos\.tech|www\.w3\.org\/(2000\/svg|1999\/xlink|1999\/xhtml))\b/i;
const ANALYTICS = /document\.cookie|googletagmanager|google-analytics|\bgtag\s*\(|\bfbq\s*\(|hotjar|mixpanel|segment\.(com|io)|plausible\.io|clarity\.ms|sendBeacon|\bmatomo\b|\bumami\b|\bdataLayer\b/i;
const PLACEHOLDER = /__[A-Z][A-Z0-9_]{2,}__/;

// pull string literals out of JS so the user-facing checks ignore comments and identifiers
function jsStrings(text) {
  const out = []; const re = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1|`((?:\\.|[^`\\])*)`/g; let m;
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (s, a) => a + ' '.repeat(s.length - a.length));
  while ((m = re.exec(clean))) { const body = m[2] ?? m[3] ?? ''; const line = clean.slice(0, m.index).split('\n').length; out.push([line, body]); }
  return out;
}
function htmlText(text) {
  const out = []; const lines = text.split('\n');
  lines.forEach((l, i) => { const t = l.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' '); if (t.trim()) out.push([i + 1, t]); });
  const attr = [...text.matchAll(/\b(?:title|alt|aria-label|placeholder|content|value)="([^"]*)"/g)].map((m) => [text.slice(0, m.index).split('\n').length, m[1]]);
  return out.concat(attr);
}

let nCode = 0, nData = 0, nStr = 0;
for (const f of files) {
  const e = ext(f); const rel = f;
  const isTest = /[\\/]tests?[\\/]/.test(f) || /[\\/]tools[\\/]/.test(f);
  let text; try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
  if (!CODE.has(e) && !DATA.has(e) && e !== '.txt' && e !== '.md' && e !== '.sh') continue;
  if (e === '.txt' && f.includes('fonts')) continue;
  CODE.has(e) ? nCode++ : nData++;
  const lines = text.split('\n');
  lines.forEach((l, i) => {
    if (COMP.test(l) && !(isTest && /COMP\b|competitor/i.test(l) && /RegExp|const COMP/.test(l))) bad(f, i + 1, 'competitor name', l.trim().slice(0, 80));
    if (PLACEHOLDER.test(l)) bad(f, i + 1, 'unreplaced placeholder', (l.match(PLACEHOLDER) || [''])[0]);
    if (!isTest) {
      for (const m of l.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) if (!ALLOW_URL.test(m[0]) && !(DATA.has(e) && /^https?:\/\/([a-z0-9-]+\.)*sika\.com\//i.test(m[0])) && m[0] !== 'https://...') bad(f, i + 1, 'url to a host not allowed', m[0].slice(0, 80));
      if (CODE.has(e) && ANALYTICS.test(l)) bad(f, i + 1, 'cookie or analytics code', l.trim().slice(0, 80));
      if (CODE.has(e) && /\bfetch\(\s*['"`]https?:|new\s+(XMLHttpRequest|WebSocket|EventSource)|import\(\s*['"`]https?:|<script[^>]+src=["']https?:|<link[^>]+href=["']https?:/i.test(l)) bad(f, i + 1, 'request to an outside host', l.trim().slice(0, 80));
      if (e === '.css' && /url\(\s*['"]?https?:/i.test(l)) bad(f, i + 1, 'css pulls a remote file', l.trim().slice(0, 80));
    }
  });
  // user-facing strings (portal and engine source only, not tests or tools)
  if (!isTest && (e === '.js' || e === '.mjs' || e === '.html')) {
    const strs = e === '.html' ? htmlText(text) : jsStrings(text);
    for (const [ln, s] of strs) {
      nStr++;
      if (DASH.test(s) && !GENERATED.test(f)) bad(f, ln, 'em or en dash in a string', s.slice(0, 60));
      if (EMOJI.test(s)) bad(f, ln, 'emoji in a string', s.slice(0, 60));
      if (tells && !/^[a-z0-9\/_.:#-]+$/.test(s)) for (const k of ['TELLS', 'PHRASES']) { const m = tells[k] && new RegExp(tells[k], 'i').exec(s); if (m) bad(f, ln, 'AI-tell word or phrase', m[0] + ' in: ' + s.slice(0, 70)); }
    }
  }
}
if (!tells) bad(path.join(PORTAL, '..'), 0, 'lint lists unreadable', LINT_DIR);

// images, fonts and stylesheets: only the vendored Barlow files and the portal's own CSS may exist
for (const f of walk(PORTAL)) {
  const e = ext(f);
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.avif'].includes(e)) bad(f, 0, 'image file in portal', 'images are not copied from aus.sika.com');
  if (['.woff', '.woff2', '.ttf', '.otf', '.eot'].includes(e) && !/assets[\\/]fonts[\\/]barlow-\d+-[ni]\.woff2$/.test(f)) bad(f, 0, 'font file that is not the vendored Barlow', path.basename(f));
}
if (!fs.existsSync(path.join(PORTAL, 'assets/fonts/OFL.txt'))) bad(PORTAL, 0, 'font licence missing', 'assets/fonts/OFL.txt');

// demo posture
const idx = fs.readFileSync(path.join(PORTAL, 'index.html'), 'utf8');
const need = [['noindex meta', /<meta name="robots" content="[^"]*noindex[^"]*nofollow|<meta name="robots" content="[^"]*nofollow[^"]*noindex/i],
  ['CSP meta with default-src self', /<meta http-equiv="Content-Security-Policy" content="[^"]*default-src 'self'/i],
  ['referrer no-referrer meta', /<meta name="referrer" content="no-referrer"/i]];
for (const [n, re] of need) if (!re.test(idx)) bad(path.join(PORTAL, 'index.html'), 0, 'posture missing', n);
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(path.join(PORTAL, 'data/config.json'), 'utf8')); } catch { bad(path.join(PORTAL, 'data/config.json'), 0, 'config unreadable', ''); }
for (const k of ['ribbon', 'notice', 'preparedFor', 'builtInHours']) if (!cfg.demo || !String(cfg.demo[k] || '').trim()) bad(path.join(PORTAL, 'data/config.json'), 0, 'demo config empty', k);
const chrome = fs.readFileSync(path.join(PORTAL, 'assets/lib/chrome.js'), 'utf8');
if (!/cfg\.demo\.ribbon/.test(chrome) || !/d\.notice/.test(chrome)) bad(path.join(PORTAL, 'assets/lib/chrome.js'), 0, 'posture missing', 'ribbon or notice is not rendered');
if (/\bset-cookie\b|document\.cookie/i.test(chrome)) bad(path.join(PORTAL, 'assets/lib/chrome.js'), 0, 'cookie', 'chrome');
// apply/speed: the generated head block (inlined, minified CSS and preload links) is the portal stylesheet, not markup; the markup budget applies to the rest
const shell = Buffer.byteLength(idx.replace(/<!--speed:head-->[\s\S]*?<!--\/speed:head-->/, ''));
if (shell >= 10 * 1024) bad(path.join(PORTAL, 'index.html'), 0, 'shell over 10 KB budget (G6)', shell + ' bytes');
for (const f of walk(path.join(PORTAL, 'assets')).filter((x) => ext(x) === '.js' && !GENERATED.test(x))) { const s = fs.statSync(f).size; if (s >= 40 * 1024 && !/assistant[\\/]engine\.js$/.test(f)) bad(f, 0, 'js module over 40 KB budget (G6)', s + ' bytes'); }

if (problems.length) {
  const by = new Map(); for (const p of problems) (by.get(p.rule) || by.set(p.rule, []).get(p.rule)).push(p);
  for (const [rule, ps] of by) { console.log(`HYGIENE RED  ${rule}: ${ps.length}`); for (const p of ps.slice(0, +(process.env.HYG_MAX || 3))) console.log(`    ${p.file}:${p.line}  ${p.detail}`); }
  console.log(`HYGIENE RED: ${problems.length} problems`); process.exit(1);
}
console.log(`HYGIENE GREEN code files ${nCode}, data files ${nData}, strings checked ${nStr}, shell ${shell} bytes, tells lists ${tells ? 'read from ' + LINT_DIR : 'MISSING'}`);
