// add_qr.mjs: puts a small QR code on every one-page system sheet and on the selector hub. The QR opens the portal advisor pre-loaded with
// that system (#/ask?system=<slug>). Generated at build time as one inline SVG path (no image file, no network, no script on the sheet).
// Idempotent: the screen block lives between <!--qr--> markers (top of the sheet) and the paper copy between <!--qrp--> markers (top of the print summary). The base address is configurable: argv[3], env SIKA_QR_BASE, or the private preview host.
// The page text holds no host name (the hygiene gate forbids external addresses): the link is relative and the absolute address is encoded in the QR only.
// usage: node add_qr.mjs [portalDir] [baseUrl]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from './vendor/qrcode.mjs';

export const DEFAULT_BASE = 'https://preview.sika-preview.pages.dev/';
export const CAPTION = 'Scan to ask about this system';
export const HUB_CAPTION = 'Scan to ask about tiling systems';
const HERE = path.dirname(fileURLToPath(import.meta.url));

export function askUrl(base, slug) { const b = base.endsWith('/') ? base : base + '/'; return b + '#/ask' + (slug ? '?system=' + encodeURIComponent(slug) : ''); }

/** Returns { svg, size, url } for one text. The SVG is one path of unit squares plus a 2-module quiet zone. */
export function qrSvg(text) {
  const q = qrcode(0, 'M'); q.addData(text, 'Byte'); q.make();
  const n = q.getModuleCount(), quiet = 2; let d = '';
  for (let r = 0; r < n; r++) { let c = 0; while (c < n) { if (!q.isDark(r, c)) { c++; continue; } let e = c; while (e < n && q.isDark(r, e)) e++; d += `M${c + quiet} ${r + quiet}h${e - c}v1h-${e - c}z`; c = e; } }
  const s = n + quiet * 2;
  return { size: n, url: text, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#000"/></svg>` };
}

export function block(base, slug, hub, tag = 'qr') {
  const url = askUrl(base, slug);             // the absolute address lives only inside the QR pixels
  const rel = (hub ? '../' : '../../') + '#/ask' + (slug ? '?system=' + encodeURIComponent(slug) : '');   // the link around it is relative, so it works on any host
  const cap = hub ? HUB_CAPTION : CAPTION;
  const q = qrSvg(url);
  return `<!--${tag}--><aside class="qr-card"><a class="qr-link" href="${rel}" aria-label="${hub ? 'Ask about tiling systems' : 'Ask about this system'}: opens the product advisor">${q.svg}</a><p class="qr-cap">${cap}</p></aside><!--/${tag}-->`;
}

export function run(portal, base) {
  const sysDir = path.join(portal, 'systems'); let n = 0;
  for (const e of fs.readdirSync(sysDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const f = path.join(sysDir, e.name, 'index.html'); if (!fs.existsSync(f)) continue;
    n += put(f, block(base, e.name, false), block(base, e.name, false, 'qrp'));
  }
  n += put(path.join(sysDir, 'index.html'), block(base, '', true), null);
  return n;
}
function put(f, blk, printBlk) {
  let html = fs.readFileSync(f, 'utf8');
  html = html.replace(/<!--qr-->[\s\S]*?<!--\/qr-->/, '').replace(/<!--qrp-->[\s\S]*?<!--\/qrp-->/, '');
  if (!html.includes('<div class="sheet-head">')) throw new Error('no sheet-head in ' + f);
  html = html.replace('<div class="sheet-head">', (m) => m + blk);
  // the paper copy: the print summary is the only part of a sheet that prints, so the code goes at its top right as well
  const PS = '<section class="print-sheet" aria-label="Print summary">\n';
  if (printBlk) { if (!html.includes(PS)) throw new Error('no print summary in ' + f); html = html.replace(PS, (m) => m + printBlk); }
  fs.writeFileSync(f, html); return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const portal = path.resolve(process.argv[2] || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
  const base = process.argv[3] || process.env.SIKA_QR_BASE || DEFAULT_BASE;
  console.log('qr codes placed on', run(portal, base), 'pages; base', base);
}
