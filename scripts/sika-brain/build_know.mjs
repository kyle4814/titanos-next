// build_know.mjs: the business and advisor knowledge, compiled from Sika Australia's own public pages (the crawl cache) and the product data.
//   Called by build_brain.mjs after the product shards. Writes data/brain/kb.json (page lines + certification lines) and data/brain/adv/<category>.json (evidence sentences per product).
//   Inputs: SIKA_CRAWL (default /home/tech2/klinge-kernel/state/sika/crawl/cache), PORTAL data/products.json. Public text only; nothing is fetched here.
import fs from 'node:fs';
import path from 'node:path';

const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&reg;/g, '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
function htmlLines(h) {
  h = h.replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<\/(p|div|li|h\d|tr|section|br|a|span|td|th)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ');
  return decode(h).split('\n').map((x) => x.replace(/[®™]/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
}
const SKIP_URL = /\.xml$|\/international-reference-projects|\/industry\/events|\/industry\/news|A-Tradies|state-of-origin|competition|thank-you|\/Contact\.sitemap/i;
export function buildKnow({ PORTAL, OUT, products, CRAWL }) {
  CRAWL = CRAWL || process.env.SIKA_CRAWL || '/home/tech2/klinge-kernel/state/sika/crawl/cache';
  const wr = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o)); return fs.statSync(f).size; };
  const out = { kb: 0, adv: 0, pages: 0, lines: 0, prodLines: 0, crawl: false };
  const productUrls = new Set(products.map((p) => p.url));
  const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const productNames = new Set(products.map((p) => norm(p.name)));
  // ---- page lines
  const pages = []; const spm = new Set(); const spmLines = [];
  if (fs.existsSync(CRAWL)) {
    out.crawl = true;
    const all = []; const freq = new Map();
    for (const f of fs.readdirSync(CRAWL)) { if (!f.endsWith('.json')) continue; const d = JSON.parse(fs.readFileSync(path.join(CRAWL, f), 'utf8')); if (d.status && d.status !== 200) continue; const u = (d.final || d.url || '').split('#')[0]; if (!/^https:\/\/aus\.sika\.com\/en\//.test(u)) continue; const L = htmlLines(d.text || ''); const tm = /<title>([\s\S]*?)<\/title>/i.exec(d.text || ''); const title = tm ? decode(tm[1]).replace(/\s+/g, ' ').replace(/\s*[|\u2013-]\s*Sika.*$/i, '').trim() : ''; all.push({ u, L, title }); for (const x of new Set(L)) freq.set(x, (freq.get(x) || 0) + 1); }
    const bp = new Set([...freq].filter(([, c]) => c > all.length * 0.25).map(([x]) => x));
    all.sort((a, b) => (a.u < b.u ? -1 : 1));
    for (const { u, L, title } of all) {
      if (productUrls.has(u)) { for (const x of L) if (/Sustainabl(y|e) (Impactful|Portfolio)|Portfolio Management \(SPM\)/i.test(x) && !spm.has(x) && spm.size < 3) { spm.add(x); spmLines.push({ u, x: x.slice(0, 400) }); } continue; }
      if (SKIP_URL.test(u)) continue;
      const keep = []; const seen = new Set();
      for (const x of L) { if (bp.has(x) || seen.has(x)) continue; seen.add(x); if (x.length < 3 || /^(PDF|Document|Download|Email|Get in touch|Related Interests|Click here)\b/i.test(x)) continue; keep.push(x.slice(0, 700)); }
      const tiny = /terms-and-conditions|b2b-e-shop|SikaTile-distributors|concrete-repair-contact|imprint|legal-notice|where-to-buy|\/Contact/i.test(u);
      if (keep.join('').length < (tiny ? 15 : 120)) continue;
      if (productNames.has(norm(keep[0] || ''))) continue; // an alternate address of a product page
      const kind = /\/local-projects\//.test(u) ? 'project' : /\/knowledge-hub/.test(u) ? 'article' : /\/home-owners/.test(u) ? 'diy' : /\/industry\//.test(u) ? 'industry' : /\/construction\//.test(u) ? 'range' : 'site';
      const cap = kind === 'project' || kind === 'article' ? 5000 : 14000; let n = 0; const lines = [];
      for (const x of keep) { n += x.length; if (n > cap) break; lines.push(x); }
      const t = (title && title.length > 2 ? title : lines[0]).slice(0, 120); if (title && lines[0] !== title) lines.unshift(title);
      pages.push({ u, t, k: kind, l: lines });
    }
  }
  // ---- product certification and sustainability lines (corpus-wide questions: which products are Green Star certified, low VOC, ...)
  const CODE = /\b(AS ?(\/?NZS)? ?\d{3,5}(\.\d+)?|AS ?ISO ?\d{3,5}|ISO ?\d{3,5}|EN ?\d{3,5}|C[12]T?E?S?[12]?\b|class (I{1,3}|IV|[1-4])\b|CG[12]|R2T?|D1E?|D2E?|S1|S2)/;
  const prod = []; const KEEP = /^(certificates and test reports|approvals \/ certificates|sustainability|product declaration|volatile organic compound \(voc\) content)$/i; const ATTR = /\b(voc|green star|sustainab|recycl|epd|low emission|food (grade|safe|contact)|potable|nsf|watermark|ecolabel)\b/i;
  for (const p of products) {
    const name = String(p.name).replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim();
    const add = (l, x) => { x = String(x || '').replace(/[®™]/g, '').replace(/\s+/g, ' ').trim(); if (x.length > 3 && x.length <= 400) prod.push({ p: p.id, n: name, u: p.url, l, x }); };
    for (const s of p.sections || []) for (const it of s.items || []) if (KEEP.test(it.label) || (s.title === 'Sustainability / Certifications / Approvals')) add(it.label, it.text);
    for (const a of [...(p.attributes || []), ...(p.advantages || [])]) if (ATTR.test(a)) add('Published feature', a);
    for (const s of p.sections || []) if (/\?$/.test(s.title || '')) for (const it of s.items || []) add(s.title, it.text);
    for (const s of p.sections || []) for (const it of s.items || []) if (CODE.test(String(it.text))) { const seg = String(it.text).split(/(?<=[.;])\s+|\s+[\u2022\u00b7]\s+/).find((x) => CODE.test(x)); if (seg) add('Published standard', seg); }
  }
  for (const s of spmLines) { const pr = products.find((q) => q.url === s.u); prod.push({ p: pr ? pr.id : 'sika-spm', n: pr ? String(pr.name).replace(/[®™©]/g, '') : 'Sika', u: s.u, l: 'Published', x: s.x }); }
  const seenP = new Set(); const prodU = prod.filter((e) => { const k = e.p + '|' + e.x; if (seenP.has(k)) return false; seenP.add(k); return true; });
  out.pages = pages.length; out.lines = pages.reduce((s, p) => s + p.l.length, 0); out.prodLines = prodU.length;
  out.kb = wr(path.join(OUT, 'kb.json'), { v: 1, pages, prod: prodU });
  // ---- advisor evidence, one shard per top category
  const top2 = (c) => c.split('/').slice(0, 2).join('/');
  const slug = (c) => c.replace(/\//g, '__');
  const clean = (s) => String(s || '').replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim();
  const byCat = new Map();
  const SEC_KEEP = /^(layer thickness|thickness|consumption|application|substrate quality|equipment|pot life|ambient air temperature|compatibility|applied product ready for use|waiting time to overcoating|dimensions|yield|recommended dosage|packaging)$/i;
  for (const p of products) {
    const ev = []; const seen = new Set();
    const push = (k, t) => { t = clean(t); if (t.length < 8 || seen.has(t)) return; seen.add(t); ev.push({ k, t: t.slice(0, 600) }); };
    push('summary', p.summary); for (const x of p.usage || []) push('usage', x); for (const x of p.attributes || []) push('feature', x); for (const x of p.advantages || []) push('feature', x);
    let thick = null;
    for (const s of p.sections || []) for (const it of s.items || []) {
      if (SEC_KEEP.test(it.label)) push('sec:' + it.label, it.text);
      if (/^(layer thickness|thickness)$/i.test(it.label) && !thick) { const nums = [...String(it.text).matchAll(/(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*mm/gi)].flatMap((m) => [m[1], m[2]]).filter(Boolean).map(Number); if (nums.length) thick = { max: Math.max(...nums), t: clean(it.text).slice(0, 280) }; }
    }
    const e = { id: p.id, n: clean(p.name), u: p.url, sub: p.category.split('/').slice(2).join('/'), tg: clean(p.tagline || '').slice(0, 200), pk: clean(p.packaging).slice(0, 200), ev: ev.slice(0, 40), th: thick };
    const c = top2(p.category); if (!byCat.has(c)) byCat.set(c, []); byCat.get(c).push(e);
  }
  for (const [c, list] of byCat) out.adv += wr(path.join(OUT, 'adv', slug(c) + '.json'), { v: 1, id: c, products: list });
  return out;
}
