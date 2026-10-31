// qr_check.mjs: the QR on every one-page system sheet and the hub. Rasterises the real inline SVG and decodes it with jsQR (an independent decoder),
// then compares the decoded address with the sheet's own slug. Includes mutation checks (a wrong slug, a damaged code and a missing block must each be caught)
// and a fixture build with another base address (the base is configurable). usage: node qr_check.mjs [portalDir]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.resolve(process.argv[2] || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
const req = createRequire((process.env.SPEED_NODE_MODULES || '/home/tech2/titanos_launch/titanos-next/node_modules') + '/x.js');
const jsQR = req('jsqr');
const { DEFAULT_BASE, CAPTION, HUB_CAPTION, askUrl } = await import('../../demo-tools/sika-210c0c/add_qr.mjs');
let fails = 0; const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + String(d).slice(0, 200) : '')); };

/** html -> { url (data-qr-url), decoded, count, caption, error } */
export function inspect(html, tag = 'qr') {
  const blocks = html.match(new RegExp(`<!--${tag}-->[\\s\\S]*?<!--\\/${tag}-->`, 'g')) || [];
  if (blocks.length !== 1) return { count: blocks.length };
  const b = blocks[0]; const url = (/<a class="qr-link" href="([^"]*)"/.exec(b) || [])[1];   // the relative link around the code
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(b); const d = (/<path d="([^"]*)" fill="#000"/.exec(b) || [])[1];
  if (!vb || !d) return { count: 1, url, error: 'no svg path' };
  const S = +vb[1], K = 8; const px = new Uint8ClampedArray(S * K * S * K * 4).fill(255);
  for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) { const [x, y, w] = [+m[1], +m[2], +m[3]]; for (let yy = y * K; yy < (y + 1) * K; yy++) for (let xx = x * K; xx < (x + w) * K; xx++) { const o = (yy * S * K + xx) * 4; px[o] = px[o + 1] = px[o + 2] = 0; } }
  const r = jsQR(px, S * K, S * K);
  return { count: 1, url, decoded: r ? r.data : null, caption: (/<p class="qr-cap">([^<]*)<\/p>/.exec(b) || [])[1], modules: S, extern: /<img|<script|src=|xlink:href/.test(b.replace(/href="[^"]*"/g, '')) };
}
const sysDir = path.join(PORTAL, 'systems');
const slugs = fs.readdirSync(sysDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
t('363 system sheet folders', slugs.length === 363, slugs.length);
let bad = [], badCap = [], badExt = [], maxMod = 0;
const base = process.env.QR_BASE || DEFAULT_BASE;
const badPrint = [];
for (const s of slugs) {
  const html = fs.readFileSync(path.join(sysDir, s, 'index.html'), 'utf8');
  const r = inspect(html), p = inspect(html, 'qrp'); const want = askUrl(base, s);
  if (r.count !== 1 || r.decoded !== want || r.url !== '../../#/ask?system=' + s) bad.push(s + ' ' + JSON.stringify({ c: r.count, d: r.decoded, u: r.url }).slice(0, 120));
  if (p.count !== 1 || p.decoded !== want || p.caption !== CAPTION || !html.slice(0, html.indexOf('<!--qrp-->')).includes('<section class="print-sheet"') || html.indexOf('<!--qrp-->') < html.indexOf('<section class="print-sheet"')) badPrint.push(s);
  if (r.caption !== CAPTION) badCap.push(s); if (r.extern || p.extern) badExt.push(s); maxMod = Math.max(maxMod, r.modules || 0);
}
t('every one of the 363 sheets has exactly one QR that decodes to its own #/ask?system=<slug> address, and its link around it is the same address, relative', bad.length === 0, bad.slice(0, 3).join(' | '));
t('the paper copy: the print summary (the only part that prints) holds its own code with the same address and caption, inside the print section', badPrint.length === 0, badPrint.slice(0, 3));
t('every sheet carries the one-line caption', badCap.length === 0, badCap.slice(0, 3));
t('the QR is an inline SVG only (no image file, no script, no external reference)', badExt.length === 0, badExt.slice(0, 3));
const hub = inspect(fs.readFileSync(path.join(sysDir, 'index.html'), 'utf8'));

t('the hub has a QR that decodes to the general #/ask address', hub.count === 1 && hub.url === '../#/ask' && hub.decoded === askUrl(base, '') && hub.caption === HUB_CAPTION, JSON.stringify(hub).slice(0, 160));
t(`the code stays small (largest is ${maxMod - 4} modules per side; version 8 or lower)`, maxMod > 0 && maxMod - 4 <= 49, maxMod);
// mutation checks: the inspector must catch each fault
const sample = fs.readFileSync(path.join(sysDir, slugs[0], 'index.html'), 'utf8');
const swap = sample.replace(/(<a class="qr-link" href=")[^"]*/, '$1../../#/ask?system=other');
t('mutation: a link that points at another system than the code is caught', !(inspect(swap).decoded || '').endsWith(inspect(swap).url.replace('../../', '')));
t('no host name in the page text around the code (the hygiene gate forbids external addresses): the preview host appears only inside the code', !/sika-preview\.pages\.dev/.test(sample));
const dmg = sample.replace(/(<path d=")M\d+ \d+h\d+v1h-\d+z/, '$1');   // drop the first dark run of the finder pattern
t('mutation: a damaged finder pattern no longer decodes to the right address', inspect(dmg).decoded !== askUrl(base, slugs[0]));
t('mutation: a missing block is caught', inspect(sample.replace(/<!--qr-->[\s\S]*?<!--\/qr-->/, '')).count === 0);
t('mutation: a missing paper copy is caught', inspect(sample.replace(/<!--qrp-->[\s\S]*?<!--\/qrp-->/, ''), 'qrp').count === 0);
const blk = sample.match(/<!--qr-->[\s\S]*?<!--\/qr-->/)[0];
t('mutation: a doubled block is caught', inspect(sample.replace(blk, blk + blk)).count === 2);
// fixture: another base, rebuilt twice (idempotent), decoded again
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-fixture-')); if (!tmp || !tmp.includes('qr-fixture-')) { console.log('FAIL no fixture dir'); process.exit(2); }
try {
  const fx = path.join(tmp, 'p', 'systems'); fs.mkdirSync(path.join(fx, slugs[0]), { recursive: true });
  fs.copyFileSync(path.join(sysDir, slugs[0], 'index.html'), path.join(fx, slugs[0], 'index.html')); fs.copyFileSync(path.join(sysDir, 'index.html'), path.join(fx, 'index.html'));
  const run = () => spawnSync(process.execPath, [path.join(HERE, '..', '..', 'demo-tools', 'sika-210c0c', 'add_qr.mjs'), path.join(tmp, 'p'), 'http://localhost:9999/demo/sika-210c0c/'], { encoding: 'utf8' });
  const a = run(); const h1 = fs.readFileSync(path.join(fx, slugs[0], 'index.html'), 'utf8'); const b = run(); const h2 = fs.readFileSync(path.join(fx, slugs[0], 'index.html'), 'utf8');
  const r = inspect(h1);
  t('the base address is configurable (a local base is decoded back exactly)', a.status === 0 && r.decoded === `http://localhost:9999/demo/sika-210c0c/#/ask?system=${slugs[0]}`, a.stderr || r.decoded);
  t('the build step is idempotent (a second run changes nothing, one block only)', b.status === 0 && h1 === h2 && inspect(h2).count === 1);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(fails ? `QR CHECK ${fails} failed` : 'QR CHECK GREEN'); process.exit(fails ? 1 : 0);
