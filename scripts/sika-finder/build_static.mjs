// T23: one static HTML page per tile x surface x place combination, a hub, sitemap.xml, robots.txt and the noscript fallback.
// Real text, no JavaScript needed. Uses the same model as the app (assets/lib/finder/model.js), so a page and the app never disagree.
// Usage: node scripts/sika-finder/build_static.mjs [--index] [--base https://host/path/]
//   --index  drops noindex (for a live deployment; NOT used in the demo). --base sets the absolute base used in the sitemap.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve, sheetModel, chipFor, ROLE_LABEL } from '../../public/demo/sika-210c0c/assets/lib/finder/model.js';
import { fmtQty, fmt, packText, ESTIMATE_LINE, DEMO_LINE, NO_RATE_TEXT } from '../../public/demo/sika-210c0c/assets/lib/finder/calc.js';

const PORTAL = fileURLToPath(new URL('../../public/demo/sika-210c0c/', import.meta.url));
const args = process.argv.slice(2);
const INDEXABLE = args.includes('--index');
const bi = args.indexOf('--base');
const BASE = (bi >= 0 ? args[bi + 1] : 'https://titanos.tech/demo/sika-210c0c/').replace(/\/?$/, '/');
const S = JSON.parse(fs.readFileSync(path.join(PORTAL, 'data/finder/systems.json'), 'utf8'));
const SEL = JSON.parse(fs.readFileSync(path.join(PORTAL, 'data/finder/selector.json'), 'utf8'));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plain = (s) => String(s ?? '').replace(/[–—]/g, '-');
const e = (s) => esc(plain(s));
const a = (href, text) => `<a href="${esc(href)}" rel="noopener noreferrer">${e(text)}</a>`;
const ROBOTS = INDEXABLE ? '' : '<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">\n<meta name="googlebot" content="noindex, nofollow">\n';
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'">\n<meta name="referrer" content="no-referrer">`;
const CSS = 'body{font:16px/1.5 Barlow,"Helvetica Neue",Helvetica,Arial,sans-serif;margin:0;color:#000;background:#fff}header,main,footer{max-width:62rem;margin:0 auto;padding:.8rem 1rem}header{border-bottom:4px solid #ffc510}h1{font-size:1.9rem;font-weight:300;line-height:1.2}h2{font-size:1.35rem;margin-top:1.6rem}h3{font-size:1.05rem;margin:1rem 0 .2rem}q{quotes:"\\201C" "\\201D"}a{color:#2e688e}.chip{font-size:.75rem;border:1px solid #666;padding:0 .3rem;white-space:nowrap}.demo{background:#f5f5f5;border-left:4px solid #ffc510;padding:.5rem .8rem}.small{font-size:.9rem;color:#333}footer{border-top:2px solid #000;margin-top:2rem}li{margin:.25rem 0}';
const head = (title, desc, canon) => `<!doctype html>\n<html lang="en-AU">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${e(title)} | Sika Australia product portal demo</title>\n<meta name="description" content="${e(desc)}">\n${ROBOTS}${CSP}\n<link rel="canonical" href="${esc(canon)}">\n<style>${CSS}</style>\n</head>\n<body>\n`;
const demoBox = '<p class="demo"><strong>Demo.</strong> This page is a design and function demonstration built by TITANOS for Sika Australia. It is not an official Sika Australia page. Product names, sentences and links come from the public website aus.sika.com, read on 2026-10-30.</p>';
const foot = `<footer><p>${e(DEMO_LINE)}</p><p><strong>${e(ESTIMATE_LINE)}</strong></p></footer>\n</body>\n</html>\n`;

const keys = Object.keys(S.systems).sort();
const pages = [];
const toolsHref = (sel, extra = '') => `../../#/system?tile=${sel.tile}&sub=${sel.sub}&loc=${sel.loc}${extra}`;

for (const key of keys) {
  const [tile, sub, loc] = key.split('|'); const sel = { tile, sub, loc };
  const r = resolve(S, sel); const m = sheetModel(S, sel, { area: 10, allowancePct: 0 });
  const slug = r.slug; const canon = `/demo/sika-210c0c/s/${slug}/`;
  const desc = `${r.title}. The ordered system of products named in Sika Australia's published documentation, the sentence behind each, and what the published text rules out.`;
  let h = head(r.title, desc, canon);
  h += `<header><p class="small"><a href="../">All systems</a> &middot; <a href="../../">Portal home</a></p></header>\n<main id="main">\n`;
  h += `<h1>${e(r.title)}</h1>\n<p>${e(r.locLabel)}. This is the order of work from the published documentation: ${r.steps.map((s) => s.label.toLowerCase()).join(', then ')}. Each product below is named because its own published text says so, and the sentence is quoted with its source.</p>\n${demoBox}\n`;
  h += `<p><a href="${esc(toolsHref(sel))}">Open this system in the finder</a> to choose between the options and add products to a project, or <a href="${esc(toolsHref(sel).replace('#/system', '#/sheet'))}">make a one page sheet</a> for your area.</p>\n`;
  r.steps.forEach((st, i) => {
    h += `<section>\n<h2>Step ${i + 1}: ${e(st.label)}</h2>\n`;
    if (!st.options.length) { h += `<p>I do not have a matching product in the published pages.${st.note ? ' ' + e(st.note) : ''}</p>\n</section>\n`; return; }
    h += '<ul>\n';
    for (const o of st.options) {
      const ev = o.evidence[0];
      h += `<li><h3>${a(o.url, o.name)}</h3>\n<p class="small">${e(o.reason)}</p>\n`;
      if (ev) h += `<p><q>${e(ev.sentence)}</q> ${a(ev.url, 'source')} <span class="chip">${e(chipFor(ev.url))}</span></p>\n`;
      if (o.rate && o.rate.text) h += `<p class="small">Published rate: <q>${e(o.rate.text)}</q> ${a(o.rate.sourceUrl, 'source')} <span class="chip">${e(chipFor(o.rate.sourceUrl))}</span></p>\n`;
      else h += `<p class="small">${NO_RATE_TEXT}.</p>\n`;
      if (o.cautions[0]) h += `<p class="small">Note from the page: <q>${e(o.cautions[0].sentence)}</q></p>\n`;
      const docs = []; if (o.docs.pds) docs.push(a(o.docs.pds, 'Data sheet')); if (o.docs.sds) docs.push(a(o.docs.sds, 'Safety data sheet'));
      if (docs.length) h += `<p class="small">${docs.join(' &middot; ')}</p>\n`;
      h += '</li>\n';
    }
    h += '</ul>\n</section>\n';
  });
  // a worked example so a reader without scripts sees real quantities
  const rowsQ = m.rows.filter((x) => !x.empty && x.calc && x.calc.ok);
  h += '<section>\n<h2>Example quantities for 10 m2</h2>\n<p class="small">Worked from the first product in each step, no allowance added. Packs are rounded up. Use the sheet for your own area.</p>\n';
  if (rowsQ.length) {
    h += '<ul>\n' + rowsQ.map((x) => { const c = x.calc; const q = c.low === c.high ? fmtQty(c.low, c.unit) : fmtQty(c.low, c.unit) + ' to ' + fmtQty(c.high, c.unit); const pk = (c.packs && c.packs.options || []).map(packText).join('; '); return `<li><strong>${e(x.label)}</strong>, ${e(x.product.name)}: ${e(q)}${pk ? '. Packs, rounded up: ' + e(pk) : ''}</li>`; }).join('\n') + '\n</ul>\n';
  } else h += `<p>${NO_RATE_TEXT}.</p>\n`;
  h += '</section>\n';
  if (r.ruledOut.length) {
    h += '<section>\n<h2>Ruled out by their own text</h2>\n<ul>\n' + r.ruledOut.map((x) => `<li><strong>${e(x.name)}</strong> (${e(x.roleLabel.toLowerCase())}): <q>${e(x.quote)}</q> ${a(x.url, 'source')}</li>`).join('\n') + '\n</ul>\n</section>\n';
  }
  h += '<section>\n<h2>Not covered</h2>\n<ul>\n' + m.notCovered.map((t) => `<li>${e(t)}</li>`).join('\n') + '\n</ul>\n</section>\n';
  h += '<section>\n<h2>Sources (read 2026-10-30)</h2>\n<ol class="small">\n' + m.sources.map((s) => `<li>${e(s.text)}: ${a(s.url, s.url)}</li>`).join('\n') + '\n</ol>\n</section>\n</main>\n' + foot;
  pages.push({ slug, key, html: h, title: r.title, tile, sub, loc });
}

// write
const sdir = path.join(PORTAL, 's');
fs.rmSync(sdir, { recursive: true, force: true });
fs.mkdirSync(sdir, { recursive: true });
let largest = { slug: '', bytes: 0 }, total = 0;
for (const p of pages) {
  const d = path.join(sdir, p.slug); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'index.html'), p.html);
  const bytes = Buffer.byteLength(p.html); total += bytes;
  if (bytes > largest.bytes) largest = { slug: p.slug, bytes };
}
// hub
const label = (list, id) => (list.find((x) => x.id === id) || {}).label || id;
const tiles = SEL.questions[0].options;
let hub = head('Tiling systems from the published documentation', 'Every tile, surface and place combination with a system in Sika Australia\'s published documentation.', '/demo/sika-210c0c/s/');
hub += '<header><p class="small"><a href="../">Portal home</a></p></header>\n<main id="main">\n<h1>Tiling systems from the published documentation</h1>\n';
hub += `<p>${pages.length} combinations of tile type, surface and place, each with the ordered system of products named in Sika Australia's published documentation, the sentence behind every product, and what the published text rules out. Pick a combination below, or <a href="../#/system">use the system finder</a>.</p>\n${demoBox}\n`;
for (const t of tiles) {
  const mine = pages.filter((p) => p.tile === t.id); if (!mine.length) continue;
  hub += `<section>\n<h2>${e(t.label)}</h2>\n<ul>\n` + mine.map((p) => `<li><a href="${esc(p.slug)}/">${e(label(SEL.questions[1].options, p.sub))}: ${e(label(SEL.questions[2].options, p.loc))}</a></li>`).join('\n') + '\n</ul>\n</section>\n';
}
hub += '</main>\n' + foot;
fs.writeFileSync(path.join(sdir, 'index.html'), hub);
// sitemap and robots
const urls = [BASE + 's/', ...pages.map((p) => `${BASE}s/${p.slug}/`)];
// keep entries other lanes put in the sitemap (for example the selector lane's systems/ pages); only the /s/ entries are ours
let foreign = [];
try { foreign = [...fs.readFileSync(path.join(PORTAL, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => !u.startsWith(BASE + 's/')); } catch { /* no sitemap yet */ }
const allUrls = [...new Set([...foreign, ...urls])];
fs.writeFileSync(path.join(PORTAL, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + allUrls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n') + '\n</urlset>\n');
fs.writeFileSync(path.join(PORTAL, 'robots.txt'), INDEXABLE ? `User-agent: *\nAllow: /\nSitemap: ${BASE}sitemap.xml\n` : '# Demo for Sika Australia: not for indexing.\nUser-agent: *\nDisallow: /\n');
// noscript fallback on the app shell (one block, idempotent)
const ix = path.join(PORTAL, 'index.html'); let html = fs.readFileSync(ix, 'utf8');
const NS = '<noscript><div class="container section"><h1>Product portal demo</h1><p>This demo needs JavaScript for search and the finder. Without it you can still read every tiling system from the published documentation: <a href="s/">browse the tiling systems</a>.</p></div></noscript>';
html = html.replace(/<noscript>[\s\S]*?<\/noscript>\n?/, '');
html = html.replace('</main>', '</main>\n' + NS);
fs.writeFileSync(ix, html);
console.log(JSON.stringify({ pages: pages.length, hub: 1, sitemapUrls: urls.length, largestPage: largest, totalBytes: total, indexable: INDEXABLE, base: BASE }));
