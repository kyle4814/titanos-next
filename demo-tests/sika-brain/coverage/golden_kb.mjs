// golden_kb.mjs: every published Sika Australia page that is not a product page, asked by its own title in plain words; the answer must come from that page (or a page that carries the same line).
import { makeBrain, rd } from '../harness.mjs';
const kb = rd('data/brain/kb.json'); const b = makeBrain(); await b.boot();
const pages = kb.pages.filter((p) => (process.env.KINDS || 'site,diy,article').split(',').includes(p.k) && p.t.split(' ').length >= 2 && p.t.length < 90);
const TPL = [(t) => t, (t) => `tell me about ${t}`, (t) => `what does sika say about ${t}`];
let tot = 0, ok = 0, unk = 0; const per = {}; const bad = [];
for (const p of pages) {
  const q = TPL[(tot + p.t.length) % 3](p.t.toLowerCase()); const a = await b.ask(q); tot++;
  per[p.k] = per[p.k] || { n: 0, ok: 0 }; per[p.k].n++;
  const urls = a.cards.flatMap((c) => [...(c.links || []).map((l) => l.url), ...c.facts.map((f) => f.source_url)]);
  const wrongHit = a.cards.some((c) => c.status === 'PUBLISHED' && c.product && /^(sika|davco)/.test(c.product.id)) && !urls.includes(p.u);
  const hit = urls.includes(p.u) || a.cards.some((c) => c.type !== 'unknown' && c.title && c.title.toLowerCase().includes(p.t.toLowerCase().slice(0, 25)));
  if (hit) { ok++; per[p.k].ok++; } else { if (a.cards.every((c) => c.status === 'UNKNOWN')) unk++; bad.push(`${p.k} "${q}" => ${a.cards[0] ? a.cards[0].type + ':' + (a.cards[0].product ? a.cards[0].product.id : a.cards[0].title) : 'none'}`); }
}
console.log(`GOLDEN KB ${ok}/${tot} = ${(100 * ok / tot).toFixed(1)}%  (declined ${unk})`); for (const [k, v] of Object.entries(per)) console.log(`  ${k.padEnd(9)} ${v.ok}/${v.n} ${(100 * v.ok / v.n).toFixed(1)}%`);
for (const x of bad.slice(0, Number(process.env.SHOW || 12))) console.log('  miss', x);
process.exit(ok / tot >= Number(process.env.BAR || 0.8) ? 0 : 1);
