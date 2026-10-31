// run_golden.mjs: runs every generated golden question, scores it, runs the property checks, prints pass rates per intent. Exit 1 under the bar.
import fs from 'node:fs';
import { makeBrain } from './harness.mjs';
import { generate } from './golden_gen.mjs';
import { checkAnswer, expectedQuantity } from './props.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
const BAR = Number(process.env.GOLDEN_BAR || 0.95);
const Q = generate().filter((x, i) => !process.env.GOLDEN_LIMIT || i % Math.ceil(Q_N() / Number(process.env.GOLDEN_LIMIT)) === 0);
function Q_N() { return generate().length; }
const brain = makeBrain();
const strip = (x) => norm(x).replace(/^\u2026 /, '').replace(/ \u2026$/, '');
const shownIn = (c, sentences) => !!c && c.facts.some((f) => f.sentence && sentences.some((s) => norm(s).includes(strip(f.sentence))));
const prodIds = (a) => a.cards.filter((c) => c.product).map((c) => c.product.id);
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
function judge(x, a) {
  const c0 = a.cards[0]; const e = x.exp; const txt = a.cards.map(cardText).join('\n');
  switch (x.kind) {
    case 'name': { const ids = a.cards.filter((c) => c.type === 'product').map((c) => c.product.id); return ids.slice(0, e.top).includes(e.product) || (a.cards.length > 1 && ids.includes(e.product)); }
    case 'typo': case 'describe': return a.cards.filter((c) => c.type === 'product').slice(0, e.top).some((c) => c.product.id === e.product);
    case 'tree': return a.cards.some((c) => c.product && e.products.includes(c.product.id));
    case 'rate': return !!c0 && c0.type === 'rate' && shownIn(c0, e.sentences);
    case 'rate-none': return !!c0 && c0.type === 'unknown' && c0.status === 'UNKNOWN';
    case 'pds': case 'sds': if (e.none) return !!c0 && c0.type === 'unknown'; return a.cards.some((c) => c.type === 'document' && e.urls.every((u) => c.links.some((l) => l.url === u)));
    case 'cure': case 'open': case 'pot': case 'recoat': return !!c0 && c0.type === 'time' && shownIn(c0, e.sentences);
    case 'time-none': return !!c0 && c0.type === 'unknown';
    case 'calc': { const rate = e.facts.map((f) => ({ f, q: expectedQuantity(f.parsed, f.calc_ready, e.area) })).filter((z) => z.q); if (rate.length) return !!c0 && c0.type === 'calculation' && Math.abs(c0.calc.outputs[0].need_max - rate[0].q.hi) < 1e-6 && c0.product.id === e.product; return !!c0 && c0.type !== 'calculation'; }
    case 'compat-yes': return !!c0 && c0.type === 'compatibility' && /^(Yes\.|Only under)/.test(c0.headline) && shownIn(c0, e.sentences);
    case 'compat-no': return !!c0 && c0.type === 'compatibility' && /^No\./.test(c0.headline) && shownIn(c0, e.sentences);
    case 'compat-unknown': return !!c0 && c0.status === 'UNKNOWN';
    case 'system': return !!c0 && c0.type === 'system' && c0.links.some((l) => l.url.includes(e.slug));
    case 'price': return !!c0 && c0.status === 'UNKNOWN';
    case 'oos': return !!c0 && c0.status === 'UNKNOWN' && !a.cards.some((c) => c.type === 'product');
  }
  return false;
}
const per = {}, fails = [], propBad = [];
let n = 0; const t0 = Date.now(); const lat = [];
for (const x of Q) {
  const a = await brain.ask(x.q, null); n++; lat.push(a.ms);
  const ok = judge(x, a); const k = x.intent === 'unknown' ? 'out of scope' : x.intent; const key = k;
  per[key] = per[key] || { n: 0, ok: 0, kinds: {} }; per[key].n++; per[key].kinds[x.kind] = per[key].kinds[x.kind] || { n: 0, ok: 0 }; per[key].kinds[x.kind].n++;
  if (ok) { per[key].ok++; per[key].kinds[x.kind].ok++; } else fails.push({ kind: x.kind, q: x.q, got: a.cards.map((c) => c.type + ':' + (c.product ? c.product.id : c.title)).slice(0, 4), headline: a.cards[0] && a.cards[0].headline.slice(0, 80) });
  for (const b of checkAnswer(x.q, a)) propBad.push({ q: x.q, rule: b[0], detail: b[1] });
}
const ok = Object.values(per).reduce((s, v) => s + v.ok, 0);
console.log(`GOLDEN ${ok}/${n} = ${(100 * ok / n).toFixed(2)}%  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
for (const [k, v] of Object.entries(per)) console.log(`  ${k.padEnd(13)} ${v.ok}/${v.n} ${(100 * v.ok / v.n).toFixed(1)}%  ` + Object.entries(v.kinds).map(([kk, vv]) => `${kk} ${vv.ok}/${vv.n}`).join(', '));
lat.sort((a, b) => a - b); console.log(`  latency in node: p50 ${lat[Math.floor(lat.length * 0.5)]} ms, p95 ${lat[Math.floor(lat.length * 0.95)]} ms, max ${lat[lat.length - 1]} ms`);
console.log(`PROPERTY TEST: ${propBad.length} violations over ${n} answers`);
for (const b of propBad.slice(0, 15)) console.log('  ', b.rule, b.q, '::', b.detail);
fs.writeFileSync(process.env.GOLDEN_OUT || new URL('./last_run.json', import.meta.url).pathname, JSON.stringify({ n, ok, per, fails: fails.slice(0, 400), propBad: propBad.slice(0, 5000), at: new Date().toISOString() }, null, 1));
process.exit(ok / n >= BAR && propBad.length === 0 ? 0 : 1);
