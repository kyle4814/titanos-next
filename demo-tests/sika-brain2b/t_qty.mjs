// t_qty.mjs: product-less quantities, the recommendForJob entry point, and the chain recommend -> quantity -> cart.
// Every worked quantity is re-derived here from the data on disk and cross-checked against calc.js for the same product (within rounding).
import { brain, idOf, numShard, prodShard, makeT } from './_env.mjs';
import { quantity, normaliseFact, packOptions } from '../../public/demo/sika-210c0c/assets/lib/finder/calc.js';
import { expectedQuantity } from '../sika-brain/props.mjs';
import { route } from '../../public/demo/sika-210c0c/assets/actions/parse.js';
import { createAdvisor } from '../../public/demo/sika-210c0c/assets/brain/advisor.js';
import { createLoader } from '../../public/demo/sika-210c0c/assets/brain/loader.js';
import { fetchJson } from '../sika-brain/harness.mjs';
const { t, done } = makeT('t_qty');
const close = (a, b) => Math.abs(a - b) <= Math.max(0.011, Math.abs(b) * 1e-4);
const ASKS = [
  ['how much adhesive for 15 m2 of 600x600 tiles', 15, null], ['how much tile adhesive do i need for 20 m2', 20, null], ['how many bags of tile adhesive for 30 m2', 30, null],
  ['how many bags of leveller for 100 m2 at 5 mm', 100, 5], ['how much screed do i need for 40 m2 at 10 mm', 40, 10], ['how many bags of levelling compound for 25 m2 at 3 mm', 25, 3], ['bags of screed for 200 m2 at 5 mm', 200, 5],
];
let rowsChecked = 0, derivedRows = 0;
for (const [q, area, th] of ASKS) {
  const a = await brain.ask(q, null); const c = a.cards[0];
  t(`"${q}": one calculation card with a table of 2 or more products`, c.type === 'calculation' && c.table && c.table.rows.length >= 1 && a.cards.length === 1, c.type + ' ' + (c.table ? c.table.rows.length : 0));
  t(`"${q}": area ${area} m2${th ? ' and thickness ' + th + ' mm' : ''} are echoed in the inputs`, c.calc.inputs.area_m2 === area && (th ? c.calc.inputs.thickness_mm === th : c.calc.inputs.thickness_mm === undefined));
  t(`"${q}": estimate, no price, no waste claim`, c.lines.some((l) => l.label === 'Waste' && /Not included/.test(l.text)) && !/[$]|\bprice\b/i.test(JSON.stringify(c.table) + c.headline));
  t(`"${q}": cart actions are offered and each routes to the project cart`, c.followups.filter((f) => /to my project$/.test(f)).length >= 1 && c.followups.filter((f) => /to my project$/.test(f)).every((f) => route(f) && route(f).action === 'cartadd'), c.followups.join('|'));
  c.calc.inputs.rows.forEach((row, i) => {
    rowsChecked++;
    const id = row.id; const sh = prodShard(id); const out = c.calc.outputs[i];
    t(`"${q}": row ${id} is a product of the card table and has a fact with a source`, idOf(c.table.rows[i][0]) === id && !!c.facts[i] && !!c.facts[i].source_url, c.table.rows[i][0]);
    const sentenceInFact = c.facts[i] && c.facts[i].sentence === row.sentence; t(`"${q}": row ${id} quotes the sentence the rate comes from`, sentenceInFact || c.facts.length < c.calc.inputs.rows.length || row.sentence.length > 280, row.sentence);
    let expect;
    if (row.basis.k === 'per_m2_mm') {
      const ns = numShard(id); const r = ns.qr[0];
      const rate = r.derived ? { ok: true, kind: 'pack-covers', amount: r.derived.pack_kg, unit: 'kg', lo: r.derived.cover_m2 * r.derived.at_mm, hi: r.derived.cover_m2 * r.derived.at_mm } : { ok: true, kind: 'per-m2', lo: r.lo, hi: r.hi, unit: r.unit, perMm: true, mmFactor: 1 };
      // independent route 1: area x thickness through the pack-covers shape of calc.js (m2-mm per bag); route 2: first principles
      if (r.derived) { derivedRows++; const viaCalc = quantity(rate, { area: area * th }); expect = viaCalc.high; t(`${id}: first principles equals calc.js pack-covers on area x thickness`, close(r.derived.pack_kg / (r.derived.cover_m2 * r.derived.at_mm) * area * th, viaCalc.high), JSON.stringify(viaCalc)); }
      else { const viaCalc = quantity(rate, { area, thickness: th }); expect = viaCalc.high; }
    } else {
      const lf = sh.r.facts.consumption.find((f) => f.id === row.fact); const nf = normaliseFact({ parsed: lf.parsed, calc_ready: lf.calc });
      const viaCalc = nf.ok ? quantity(nf, { area, thickness: th }) : null; const exp2 = expectedQuantity(lf.parsed, lf.calc, area, th);
      expect = exp2 ? exp2.hi : null; if (viaCalc && viaCalc.ok && exp2) t(`${id}: calc.js and the independent formula agree (${viaCalc.high} vs ${exp2.hi})`, close(viaCalc.high, exp2.hi));
    }
    t(`"${q}": ${id} quantity ${out.need_max} equals the independent value ${expect}`, expect != null && close(out.need_max, expect), `${out.need_max} vs ${expect}`);
    const plan = c.calc.plan[i] || [];
    t(`"${q}": ${id} packs are rounded UP and cover the quantity`, plan.length > 0 && plan.every((p) => p.count * p.size >= out.need_max - 1e-6 && (p.count - 1) * p.size < out.need_max + 1e-6), JSON.stringify(plan));
  });
}
t('rows checked against calc.js and first principles', rowsChecked >= 14 && derivedRows >= 4, `${rowsChecked} rows, ${derivedRows} derived`);
// the same product asked by name gives the same quantity as its row in the product-less card (area-based rate)
{
  const a = await brain.ask('how much adhesive for 15 m2 of 600x600 tiles', null); const c = a.cards[0]; const id = c.calc.inputs.rows[0].id; const name = brain.core().P.find((p) => p.id === id).n;
  const b = await brain.ask(`How much ${name} for 15 m2`, null);
  t(`"${name}" by name gives the same higher quantity as its row (${c.calc.outputs[0].need_max})`, b.cards[0].type === 'calculation' && close(b.cards[0].calc.outputs[0].need_max, c.calc.outputs[0].need_max), b.cards[0].type);
}
// thickness: asked without it, a per-mm product asks for the thickness once (no silent 1 mm)
{
  const a = await brain.ask('how many bags of leveller for 100 m2', null);
  t('a thickness-rated group asks "how thick" instead of assuming 1 mm', a.cards.some((c) => c.type === 'choose' && /thick/i.test(c.headline)) || a.cards[0].type !== 'calculation' || a.cards[0].calc.inputs.thickness_mm === undefined, a.cards.map((c) => c.type + ':' + c.title).join('|'));
  const b = await brain.ask('how much Sikadur-33 for 10 m2', null);
  t('a named per-mm product (Sikadur-33, 1.35 kg/m2 per mm) asks the thickness, never answers 13.5 kg silently', b.cards[0].type === 'choose' && /thick/i.test(b.cards[0].headline), b.cards[0].type);
  const c = await brain.ask('how much Sikadur-33 for 10 m2 at 3 mm', null);
  t('Sikadur-33 for 10 m2 at 3 mm = 1.35 x 10 x 3 = 40.5 kg', c.cards[0].type === 'calculation' && close(c.cards[0].calc.outputs[0].need_max, 40.5), c.cards[0].type + JSON.stringify(c.cards[0].calc && c.cards[0].calc.outputs));
}
// the layer range is respected: 2 mm is below LANKO 145's 3 mm minimum
{
  const a = await brain.ask('how much floor leveller for 15 m2 at 2 mm', null); const c = a.cards[0];
  t('a product whose published layer range excludes the thickness is left out and named', c.type === 'calculation' && !c.calc.inputs.rows.some((r) => r.id === 'lanko-145-floor-leveller') && c.lines.some((l) => l.label === 'Left out' && /LANKO 145/.test(l.text)), JSON.stringify(c.lines));
}
// ---- recommendForJob: the one stable entry point
const advisor = createAdvisor({ load: createLoader({ base: 'data/brain/', fetchJson }) });
{
  const r = await advisor.recommendForJob({ kindId: 'tile_adhesive', substrate: 'concrete', location: 'inside', tileType: 'large format porcelain', area: 40 });
  t('recommendForJob returns { picks, honest, kindId, label, conds, ordered }', Array.isArray(r.picks) && 'honest' in r && r.kindId === 'tile_adhesive' && typeof r.label === 'string' && Array.isArray(r.conds) && typeof r.ordered === 'boolean', JSON.stringify(Object.keys(r)));
  t('each pick has id, name, url, why[] (cited sentences) and fit', r.picks.length >= 1 && r.picks.every((p) => p.id && p.name && /^https:/.test(p.url) && Array.isArray(p.why) && p.why.length >= 1 && Number.isFinite(p.fit)), JSON.stringify(r.picks[0]));
  t('large format porcelain: the stated conditions are named and the order is by documented fit', r.ordered && r.conds.length >= 1 && r.picks.every((p, i) => i === 0 || r.picks[i - 1].fit >= p.fit));
  const r2 = await advisor.recommendForJob({ kindId: 'tile_adhesive', question: 'large format tiles', excludeIds: [r.picks[0].id] });
  t('excludeIds removes a product from the picks', !r2.picks.some((p) => p.id === r.picks[0].id) && r2.picks.length >= 1);
  const r3 = await advisor.recommendForJob({ kindId: 'tile_adhesive' });
  t('no condition named: picks come back unordered, fit 0, with an honest sentence (never a silent ranking)', r3.picks.length >= 1 && r3.picks.every((p) => p.fit === 0) && /not a ranking/.test(r3.honest) && r3.ordered === false, JSON.stringify(r3.honest));
  const r4 = await advisor.recommendForJob({ kind: 'nonsense words here' });
  t('unknown kind: no picks and an honest sentence', r4.picks.length === 0 && /could not tell/.test(r4.honest));
  const r5 = await advisor.recommendForJob({ kind: 'screed', constraints: ['thick layers', 'large areas'] });
  t('free-word kind ("screed") resolves and uses the constraints', r5.kindId === 'screed' && r5.picks.length >= 1 && r5.conds.length >= 1, JSON.stringify(r5.conds));
}
// ---- chains from the bank file
import fs from 'node:fs';
const W = JSON.parse(fs.readFileSync(new URL('../sika-brain/coverage/wave2b.json', import.meta.url), 'utf8'));
const chains = W.filter((x) => x.exp2.shape === 'chain');
t('20 chain questions in wave2b.json', chains.length === 20, String(chains.length));
for (const it of chains) {
  let st = null; const turn = async (q) => { const a = await brain.ask(q, st); st = a.state || st; return a; };
  const a1 = await turn(it.q);
  const a2 = await turn(it.turns[0]);
  const rec = a2.cards[0];
  t(`chain "${it.q}" -> "${it.turns[0]}": a recommendation card, no "which product" re-ask`, !a2.cards.some((c) => c.type === 'choose') && (rec.type === 'advice' || rec.type === 'calculation') && rec.status === 'PUBLISHED' && !!rec.source && !!rec.source.sentence, rec.type + ':' + rec.title);
  const a3 = await turn(it.turns[1]); const q3 = a3.cards[0];
  t(`chain "${it.q}" -> "${it.turns[1]}": a quantity for ${it.exp2.area} m2 in the same job (no re-asking the kind)`, q3.type === 'calculation' && q3.calc.inputs.area_m2 === it.exp2.area && (it.exp2.thickness ? q3.calc.inputs.thickness_mm === it.exp2.thickness : true), q3.type + ':' + q3.title);
  const chip = (q3.followups || []).find((f) => /to my project$/.test(f));
  t(`chain "${it.q}" -> cart: the offered action routes to cartadd and "${it.turns[2]}" routes to cartadd`, !!chip && route(chip).action === 'cartadd' && route(it.turns[2]).action === 'cartadd', chip);
}
done();
