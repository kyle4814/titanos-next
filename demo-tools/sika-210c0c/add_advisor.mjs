// add_advisor.mjs (wave 2, "bot on every page"): gives every static page (363 system sheets and the selector hub) a working advisor entry.
//   desktop: a floating "Ask the advisor" button, bottom right, styled like the portal's own Product advisor button (advisor.css)
//   phone:   the portal's bottom bar pattern (Find a Product / SDS and TDS / Ask the advisor), 44 px or taller targets
//   both are plain links to the same deep link the QR code uses (#/ask?system=<slug>, which the portal already handles), so they work with scripts off
//   and when printed the entry is hidden and the QR stays. assets/lib/sheet-advisor.js turns the link into the REAL assistant panel on the page.
// Idempotent: the block lives between <!--adv--> markers before </body>; on the hub (which links its stylesheets) the advisor.css and qr.css links sit between <!--adv-css--> markers.
// usage: node add_advisor.mjs [portalDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LABEL = 'Ask the advisor';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const ICON = '<svg class="i i--sm" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 4h16v12H8l-4 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

export function deepLink(root, slug) { return root + '#/ask' + (slug ? '?system=' + encodeURIComponent(slug) : ''); }

export function block(root, slug, title) {
  const href = deepLink(root, slug);
  const data = `data-adv-open data-adv-system="${esc(slug)}" data-adv-title="${esc(title)}"`;
  return `<!--adv--><a class="adv-btn" id="adv-open" href="${href}" ${data}><span class="dot" aria-hidden="true"></span>${LABEL}</a>`
    + `<nav class="mbar adv-mbar" aria-label="Quick tools"><a href="${root}#/products">${ICON}Find a Product</a><a href="${root}#/documents">${ICON}SDS and TDS</a>`
    + `<a class="adv-mbar-ask" href="${href}" ${data}>${ICON}${LABEL}</a></nav>`
    + `<script type="module" src="${root}assets/lib/sheet-advisor.js"></script><!--/adv-->\n`;
}

function titleOf(html) { const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/); return m ? m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : ''; }

function put(f, root, slug, hub) {
  let html = fs.readFileSync(f, 'utf8');
  html = html.replace(/<!--adv-->[\s\S]*?<!--\/adv-->\n?/, '').replace(/<!--adv-css-->[\s\S]*?<!--\/adv-css-->\n?/, '');
  const title = hub ? 'tiling systems' : titleOf(html) || slug.replace(/-/g, ' ');
  if (!html.includes('</body>')) throw new Error('no </body> in ' + f);
  html = html.replace('</body>', () => block(root, slug, title) + '</body>');
  if (hub) {   // the hub links its stylesheets, so it gets the two small files linked; sheets get them inlined by build_speed.mjs
    html = html.replace('</head>', () => `<!--adv-css--><link rel="stylesheet" href="${root}assets/qr.css"><link rel="stylesheet" href="${root}assets/advisor.css"><!--/adv-css-->\n</head>`);
  }
  fs.writeFileSync(f, html); return 1;
}

export function run(portal) {
  const sysDir = path.join(portal, 'systems'); let n = 0;
  for (const e of fs.readdirSync(sysDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const f = path.join(sysDir, e.name, 'index.html'); if (fs.existsSync(f)) n += put(f, '../../', e.name, false);
  }
  n += put(path.join(sysDir, 'index.html'), '../', '', true);
  return n;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const portal = path.resolve(process.argv[2] || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
  console.log('advisor entry placed on', run(portal), 'pages');
}
