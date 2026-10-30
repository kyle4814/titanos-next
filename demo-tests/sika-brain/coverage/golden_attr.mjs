// golden_attr.mjs: every product x every attribute label it publishes, asked in plain words; the card must quote the published text (or say it is not given). Exits 1 under the bar.
import { makeBrain, rd } from '../harness.mjs';
import { cardText } from '../../../public/demo/sika-210c0c/assets/brain/schema.js';
const norm = (s) => String(s).toLowerCase().replace(/[®™]/g, '').replace(/\s+/g, ' ').trim();
const clean = (s) => String(s).replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const products = rd('data/products.json'); const b = makeBrain(); await b.boot();
const G = [[/^shelf life$/i, (n) => `shelf life of ${n}`, 'shelf'], [/^storage conditions$/i, (n) => `how should i store ${n}`, 'storage'], [/^density$/i, (n) => `density of ${n}`, 'density'], [/^ambient air temperature$/i, (n) => `what air temperature can i apply ${n} in`, 'ambient'], [/^substrate temperature$/i, (n) => `substrate temperature for ${n}`, 'substrate temp'], [/^mixing ratio$/i, (n) => `mix ratio for ${n}`, 'mixing'], [/^layer thickness$/i, (n) => `how thick can i apply ${n}`, 'thickness'], [/^service temperature$/i, (n) => `service temperature of ${n}`, 'service temp'], [/^compressive strength$/i, (n) => `compressive strength of ${n}`, 'compressive'], [/^(volatile organic compound \(voc\) content)$/i, (n) => `voc content of ${n}`, 'voc'], [/^reaction to fire$/i, (n) => `reaction to fire classification for ${n}`, 'fire'], [/^chemical resistance$/i, (n) => `chemical resistance of ${n}`, 'chemical'], [/^waiting time to overcoating$/i, (n) => `how long to wait before overcoating ${n}`, 'overcoat'], [/^composition$/i, (n) => `what is ${n} made of`, 'composition']];
const per = {}; let tot = 0, ok = 0; const bad = [];
for (const p of products) {
  const sh = rd('data/brain/p/' + p.id + '.json'); const name = clean(sh.n);
  for (const [re, tpl, key] of G) {
    const its = (sh.d.sec || []).filter((x) => re.test(x.l) && x.t && x.t.length > 2); if (!its.length) continue;
    const a = await b.ask(tpl(name)); tot++; per[key] = per[key] || { n: 0, ok: 0 }; per[key].n++;
    const mine = a.cards.filter((c) => c.product && c.product.id === p.id); const txt = norm(a.cards.map(cardText).join(' ') + ' ' + a.cards.flatMap((c) => c.facts.map((f) => f.sentence)).join(' '));
    const segsOf = (t) => String(t).split(/(?<=[.!?])\s+|\s+\|\s+/).map((x) => norm(x)).filter((x) => x.length >= 12).concat(String(t).length < 40 ? [norm(t)] : []);
    const hit = mine.length && its.some((it) => segsOf(it.t).some((g) => txt.includes(g.slice(0, 24))));
    if (hit) { ok++; per[key].ok++; } else bad.push(`${key} ${tpl(name)} => ${a.cards[0] ? a.cards[0].type + ':' + (a.cards[0].product ? a.cards[0].product.id : a.cards[0].title) : 'none'}`);
  }
}
console.log(`GOLDEN ATTR ${ok}/${tot} = ${(100 * ok / tot).toFixed(1)}%`); for (const [k, v] of Object.entries(per)) console.log(`  ${k.padEnd(14)} ${v.ok}/${v.n} ${(100 * v.ok / v.n).toFixed(1)}%`);
for (const x of bad.slice(0, Number(process.env.SHOW || 12))) console.log('  miss', x);
process.exit(ok / tot >= Number(process.env.BAR || 0.9) ? 0 : 1);
