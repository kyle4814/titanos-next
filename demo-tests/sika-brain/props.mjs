// props.mjs: property checks run over EVERY generated answer.
// P1 no number in any answer without a source: every number a visitor can read is in a fact sentence or version, a product name, the question, or a recomputed calculation.
// P2 a PUBLISHED fact carries a sentence and a URL. P3 a PUBLISHED card carries a source line. P4 cards validate against the schema.
// P6 no passage in a card is longer than 280 characters. P5 no competitor name, no "signed", no dash characters, no compliance claim and no price outside a quoted sentence.
import fs from 'node:fs';
import { cardText, validateCard } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
import { numbersIn } from '../../public/demo/sika-210c0c/assets/brain/text.js';
import { planCheck } from '../sika-brain2d/plan_props.mjs'; // lane D: plan cards carry recomputable derived numbers
const LANES = process.env.SIKA_LANES || '/home/tech2/klinge-kernel/state/sika/lanes';
let LR = null;
const laneFacts = () => { if (LR) return LR; const r = JSON.parse(fs.readFileSync(`${LANES}/knowledge/rates.json`, 'utf8')).products; LR = new Map(); for (const p of Object.values(r)) for (const fs_ of Object.values(p.facts)) for (const f of fs_) LR.set(f.id, f); return LR; };
let PK = null;
const packsOf = (pid) => { if (!PK) { PK = JSON.parse(fs.readFileSync(`${LANES}/knowledge/rates.json`, 'utf8')).products; } return ((PK[pid] && PK[pid].facts.pack_sizes) || []).flatMap((f) => (f.parsed && f.parsed.sizes) || []); };
const r2 = (x) => String(Math.round((x + 1e-9) * 100) / 100);
/** independent re-implementation of the quantity maths (does not import cards.js) */
export function expectedQuantity(parsed, calcReady, area, thickness) {
  if (!calcReady || !parsed || !parsed.basis_stated) return null;
  const m = parsed.model;
  // per mm / per cm of thickness: a quantity only when the thickness is given (wave 2b: never read as 1 mm by default)
  if (m === 'per_area' && (parsed.per === 'mm' || parsed.per === 'cm')) { if (!(thickness > 0) || !/^(kg|L)$/.test(parsed.unit || '') || parsed.area_unit !== 'm2') return null; const k = thickness * (parsed.per === 'cm' ? 0.1 : 1); return { unit: parsed.unit, lo: area * parsed.min * k, hi: area * parsed.max * k }; }
  if (m === 'pack_covers_area' && parsed.area_min > 0) return { unit: parsed.unit, lo: area * parsed.amount / parsed.area_max, hi: area * parsed.amount / parsed.area_min };
  if (m === 'area_per_unit' && parsed.min > 0 && /^(L|kg)$/.test(parsed.unit || '')) return { unit: parsed.unit, lo: area / parsed.max, hi: area / parsed.min };
  if (m === 'per_area' && /^(kg|L)$/.test(parsed.unit || '') && parsed.area_unit === 'm2' && !(parsed.coats_max > 1)) return { unit: parsed.unit, lo: area * parsed.min, hi: area * parsed.max };
  return null;
}
const COMPETITORS = /\b(mapei|ardex|laticrete|bostik|fosroc|dunlop|parchem|sikkens|bmcc|sealer?s? plus|ardit)\b/i;
export function checkAnswer(question, ans) {
  const bad = []; const qn = new Set(numbersIn(question));
  for (const c of ans.cards) {
    const v = validateCard(c); if (v.length) bad.push(['P4', v.join(',')]);
    for (const f of c.facts) if (f.status === 'PUBLISHED' && (!f.sentence || !f.source_url)) bad.push(['P2', f.sentence.slice(0, 40)]);
    if (c.type !== 'choose' && c.status === 'PUBLISHED' && !(c.source && c.source.sentence)) bad.push(['P3', c.title]);
    for (const l of c.lines || []) if (l.text.length > 280) bad.push(['P6', 'line over 280: ' + l.text.length]);
    for (const f of c.facts) if (f.sentence.length > 280) bad.push(['P6', 'fact over 280: ' + f.sentence.length]);
    if (c.table) for (const r of c.table.rows) for (const x of r) if (x.length > 280) bad.push(['P6', 'table cell over 280']);
    const text = cardText(c);
    const allowed = new Set(qn);
    for (const f of c.facts) { for (const n of numbersIn(f.sentence)) allowed.add(n); for (const n of numbersIn(f.doc_version)) allowed.add(n); if (f.page != null) allowed.add(String(f.page)); }
    if (c.product) for (const n of numbersIn(c.product.name)) allowed.add(n);
    for (const l of c.links || []) for (const n of numbersIn(l.label)) allowed.add(n);
    if (c.table) for (const col of c.table.cols) for (const n of numbersIn(col)) allowed.add(n);
    if (c.type === 'system') { for (const n of numbersIn(c.title)) allowed.add(n); for (const r of c.table.rows) for (const n of numbersIn(r[1])) allowed.add(n); } // product names in a system table are identifiers, like a card's product name
    for (const l of c.lines || []) if (l.label === 'Primer it names' || /^(Left out|Not published, so left out)$/.test(l.label)) for (const n of numbersIn(l.text)) allowed.add(n); // names of catalogue products
    if (c.calc && c.calc.inputs.area_m2 === undefined && ('cement_kg' in c.calc.inputs)) { // dosage card: every quantity must be a published sentence number x the size you gave / the stated basis, and pack counts the ceiling of that over a published pack
      const I = c.calc.inputs; const sizes = [I.cement_kg, I.mix_kg, I.water_l, I.volume_m3].filter((x) => x); const sn = [...new Set(c.facts.flatMap((f) => numbersIn(f.sentence)))].map(Number).filter((x) => Number.isFinite(x)); for (const x of [...sn]) for (const y of [...sn]) { if (x !== y) { sn.push(x + y); sn.push(Math.abs(x - y)); } } // "350 ml +/- 100 ml" is 250 to 450
      const qs = new Set(); for (const s of sn) for (const z of sizes) for (const u of [1, 0.001, 0.01, 1000]) for (const P of [1, 20, 100, 200, 1000]) qs.add(s * z * u / P);
      for (const q of qs) { allowed.add(r2(q)); allowed.add(String(Math.round(q * 1e4) / 1e4)); for (const id of I.facts) for (const sz of packsOf(id.split(':')[0])) allowed.add(String(Math.ceil(q / Number(sz.amount) - 1e-9))); }
      for (const z of sizes) { allowed.add(r2(z)); allowed.add(r2(z / 1000)); allowed.add(Number(z).toLocaleString('en-AU').replace(/\s/g, '')); }
      for (const s of sn) for (const k of [1, 1000]) allowed.add(r2(s * k)); // the published figures, restated with thousands separators or in the next unit
      for (const p of I.packs || []) allowed.add(String(Number(p.amount)));
    } else
    if (c.calc) { // recompute from the lane's own parsed facts
      const area = c.calc.inputs.area_m2; allowed.add(r2(area));
      if (c.calc.inputs.thickness_mm != null) allowed.add(r2(c.calc.inputs.thickness_mm));
      for (const row of (c.calc.inputs.rows || [])) { // wave 2b product-less quantity card: every row re-derived here, independently of numq.js and calc.js
        const b = row.basis || {}; const th = c.calc.inputs.thickness_mm; const sn = new Set(numbersIn(row.sentence || ''));
        let lo, hi, unit;
        if (b.k === 'per_m2_mm') {
          if (!(th > 0)) { bad.push(['P1-num', 'per-mm rate without a thickness ' + row.id]); continue; }
          if (b.derived) { // litres or area at a thickness: the three printed numbers must be in the cited sentence, and the pack must be a listed size
            const d = b.derived; if (!sn.has(String(d.cover_m2)) || !sn.has(String(d.at_mm)) || !(sn.has(String(d.pack_kg)) || packsOf(row.id.split(':')[0]).some((x) => x.unit === 'kg' && x.amount === d.pack_kg))) { bad.push(['P1-num', 'derived rate numbers not in the sentence ' + row.id]); continue; }
            lo = hi = d.pack_kg / (d.cover_m2 * d.at_mm) * area * th; unit = 'kg';
          } else { if (!(sn.has(String(b.per_mm_lo)) || sn.has(String(Math.round(b.per_mm_lo * 10 * 1e6) / 1e6)))) { bad.push(['P1-num', 'rate not in the sentence ' + row.id]); continue; } lo = b.per_mm_lo * area * th; hi = b.per_mm_hi * area * th; unit = b.unit; }
        } else {
          const lf = laneFacts().get(row.fact); if (!lf) { bad.push(['P1-calc', 'fact not in lane ' + row.fact]); continue; }
          const q = expectedQuantity(lf.parsed, lf.calc_ready, area, th); if (!q) { bad.push(['P1-calc', 'calc from a fact that is not calc-ready ' + row.fact]); continue; }
          lo = q.lo; hi = q.hi; unit = q.unit;
        }
        allowed.add(r2(lo)); allowed.add(r2(hi));
        for (const sz of packsOf(row.id.split(':')[0])) { allowed.add(String(Number(sz.amount))); if (sz.unit === unit) allowed.add(String(Math.ceil(hi / sz.amount - 1e-9))); }
        for (const n2 of sn) allowed.add(n2);
      }
      for (const id of (c.calc.inputs.facts || [])) {
        const lf = laneFacts().get(id); if (!lf) { bad.push(['P1-calc', 'fact not in lane ' + id]); continue; }
        const q = expectedQuantity(lf.parsed, lf.calc_ready, area, c.calc.inputs.thickness_mm); if (!q) { bad.push(['P1-calc', 'calc from a fact that is not calc-ready ' + id]); continue; }
        allowed.add(r2(q.lo)); allowed.add(r2(q.hi)); if (lf.parsed && lf.parsed.model === 'pack_covers_area' && lf.parsed.area_max > 0) { allowed.add(r2(area / lf.parsed.area_max)); allowed.add(String(Math.ceil(area / lf.parsed.area_max - 1e-9))); allowed.add(String(lf.parsed.area_max)); allowed.add(String(lf.parsed.amount)); } // trowel table: the working line shows area / m2 per bag
        for (const s of packsOf(id.split(':')[0])) { allowed.add(String(Number(s.amount))); if (s.unit === q.unit) allowed.add(String(Math.ceil(q.hi / s.amount - 1e-9))); }
      }
    }
    if (c.calc && c.calc.inputs.grid) { // published coverage grid (tile x joint): every cell re-derived here from the lane's own parsed fact, independently of grid.js
      const area = c.calc.inputs.area_m2; allowed.add(r2(area));
      for (const g of c.calc.inputs.grid) {
        const lf = laneFacts().get(g.fact); const pp = lf && lf.parsed; if (!pp || !pp.basis_stated || pp.tile_size !== g.tile || pp.joint_width_mm !== g.joint) { bad.push(['P1-grid', 'cell not in lane ' + g.fact]); continue; }
        let need, unit, extra = [];
        if (pp.model === 'grout_area_per_pack') { const ex = area / pp.area_m2; need = ex * pp.pack.amount; unit = pp.pack.unit; extra = [r2(ex), String(Math.ceil(ex - 1e-9)), String(pp.pack.amount), String(pp.area_m2)]; }
        else if (pp.model === 'grout_kg_per_m2' && lf.calc_ready) { need = area * pp.kg_per_m2; unit = 'kg'; extra = [String(pp.kg_per_m2)]; }
        else { bad.push(['P1-grid', 'cell is not a computable grid model ' + g.fact]); continue; }
        allowed.add(r2(need)); for (const e of extra) allowed.add(e); allowed.add(String(g.joint));
        for (const sz of packsOf(g.fact.split(':')[0])) { allowed.add(String(Number(sz.amount))); if (sz.unit === unit) allowed.add(String(Math.max(1, Math.ceil(need / sz.amount - 1e-9)))); }
      }
      for (const l of c.lines || []) if (l.fact) for (const n of numbersIn(l.text)) allowed.add(n);
      // strict, per line: the pack counts and the rounded values are checked on their OWN line against the value recomputed for THAT cell (a number that is merely allowed elsewhere on the card does not pass)
      const exp = c.calc.inputs.grid.map((g) => { const lf = laneFacts().get(g.fact); const pp = lf && lf.parsed; if (!pp) return null; let need, unit, work;
        if (pp.model === 'grout_area_per_pack') { const ex = area / pp.area_m2; need = ex * pp.pack.amount; unit = pp.pack.unit; work = { ex: r2(ex), up: String(Math.ceil(ex - 1e-9)), per: [r2(pp.area_m2), r2(pp.pack.amount)] }; }
        else if (pp.model === 'grout_kg_per_m2') { need = area * pp.kg_per_m2; unit = 'kg'; work = { total: r2(need), rate: r2(pp.kg_per_m2) }; } else return null;
        const packs = packsOf(g.fact.split(':')[0]).filter((x) => x.unit === unit).map((x) => ({ size: r2(x.amount), count: String(Math.max(1, Math.ceil(need / x.amount - 1e-9))) }));
        return { need: r2(need), unit, work, packs }; });
      const checkPacks = (txt, e, where) => { for (const m of String(txt).matchAll(/(\d+) x (\d+(?:\.\d+)?) (L|kg)\b/g)) { const pk = e.packs.find((x) => x.size === m[2]); if (!pk || pk.count !== m[1] || m[3] !== e.unit) bad.push(['P1-grid-pack', `${where}: "${m[0]}" but the recomputed pack count is ${pk ? pk.count + ' x ' + pk.size : 'no such published size'}`]); } };
      const checkWork = (txt, e, where) => { const w = e.work; const t = String(txt); if (w.ex !== undefined) { const m = t.match(/= (\d+(?:\.\d+)?), rounded up to (\d+)/); const pm = t.match(/\/ (\d+(?:\.\d+)?) m2 per (\d+(?:\.\d+)?) /); if (!m || m[1] !== w.ex || m[2] !== w.up || !pm || pm[1] !== w.per[0] || pm[2] !== w.per[1]) bad.push(['P1-grid-work', `${where}: "${t}" but the recomputed working is ${w.ex}, rounded up to ${w.up}`]); } else { const m = t.match(/x (\d+(?:\.\d+)?) kg per m2 = (\d+(?:\.\d+)?) kg/); if (!m || m[1] !== w.rate || m[2] !== w.total) bad.push(['P1-grid-work', `${where}: "${t}" but the recomputed total is ${w.total} kg`]); } };
      const tbl = c.table; const ci = (name) => (tbl ? tbl.cols.indexOf(name) : -1);
      if (tbl && tbl.rows.length === exp.length) tbl.rows.forEach((r, i) => { const e = exp[i]; if (!e) return; if (ci('Packs, rounded up') >= 0) checkPacks(r[ci('Packs, rounded up')], e, 'table row ' + (i + 1)); if (ci('Working') >= 0) checkWork(r[ci('Working')], e, 'table row ' + (i + 1)); if (ci('Quantity') >= 0 && r[ci('Quantity')].split(' ')[0] !== e.need) bad.push(['P1-grid-qty', `table row ${i + 1}: quantity ${r[ci('Quantity')]} but recomputed ${e.need} ${e.unit}`]); });
      else if (tbl) bad.push(['P1-grid', 'table rows do not match the cells used']);
      if (!tbl && exp.length === 1 && exp[0]) for (const l of c.lines || []) { if (l.label === 'Packs, rounded up') checkPacks(l.text, exp[0], 'Packs line'); if (l.label === 'Working') checkWork(l.text, exp[0], 'Working line'); }
      if (!tbl && exp.length === 1 && exp[0] && !(c.lines || []).some((l) => l.label === 'Packs, rounded up' && /\d+ x /.test(l.text)) && !(c.lines || []).some((l) => /different unit/.test(l.text))) bad.push(['P1-grid', 'no pack line to check']);
    }
    if (c.calc && c.calc.inputs.facts && c.calc.inputs.area_m2 !== undefined && c.type === 'calculation') { // notched trowel table (per bag): the working and the bag count are checked on their own line or table row
      const area = c.calc.inputs.area_m2; const tf = c.calc.inputs.facts.map((id) => laneFacts().get(id)).filter((f) => f && f.parsed && f.parsed.model === 'pack_covers_area' && f.parsed.condition_kind === 'notched trowel size');
      if (tf.length && tf.length === c.calc.inputs.facts.length) {
        const ex = tf.map((f) => { const e = area / f.parsed.area_max; return { work: `${r2(area)} m2 / ${r2(f.parsed.area_max)} m2 per ${r2(f.parsed.amount)} ${f.parsed.unit} bag = ${r2(e)}, rounded up to ${Math.ceil(e - 1e-9)}`, pack: `${Math.ceil(e - 1e-9)} x ${r2(f.parsed.amount)} ${f.parsed.unit} bag` }; });
        if (c.table && c.table.rows.length === ex.length) { const iw = c.table.cols.indexOf('Working'), ip = c.table.cols.indexOf('Packs, rounded up'); c.table.rows.forEach((r, i) => { if (iw >= 0 && r[iw] !== ex[i].work) bad.push(['P1-trowel', `row ${i + 1} working "${r[iw]}" but recomputed "${ex[i].work}"`]); if (ip >= 0 && r[ip] !== ex[i].pack) bad.push(['P1-trowel', `row ${i + 1} packs "${r[ip]}" but recomputed "${ex[i].pack}"`]); }); }
        else if (!c.table && ex.length === 1) for (const l of c.lines || []) { if (l.label === 'Working' && l.text !== ex[0].work) bad.push(['P1-trowel', `working "${l.text}" but recomputed "${ex[0].work}"`]); if (l.label === 'Packs, rounded up' && l.text !== ex[0].pack) bad.push(['P1-trowel', `packs "${l.text}" but recomputed "${ex[0].pack}"`]); }
        else bad.push(['P1-trowel', 'table rows do not match the facts used']);
      }
    }
    if (c.type === 'plan') { const pc = planCheck(c, question); for (const n of pc.allowed) allowed.add(n); for (const b of pc.bad) bad.push(b); } // lane D
    for (const n of numbersIn(text)) if (!allowed.has(n)) bad.push(['P1', `${n} in "${text.replace(/\s+/g, ' ').slice(0, 120)}"`]);
    // P5 over the words that are ours (everything except the quoted sentences)
    let ours = [c.title, c.headline, c.handoff && c.handoff.reason, ...(c.lines || []).filter((l) => !l.fact).map((l) => l.label + ' ' + l.text)].filter(Boolean).join(' ');
    for (const f of [...c.facts].sort((a, b) => b.sentence.length - a.sentence.length)) if (f.sentence) ours = ours.split(f.sentence).join(' '); // longest first: a short quote can sit inside a longer one
    if (c.product) ours = ours.split(c.product.name).join(' ');
    if (COMPETITORS.test(ours)) bad.push(['P5', 'competitor ' + ours.match(COMPETITORS)[0]]);
    if (/\bsigned\b/i.test(text)) bad.push(['P5', 'signed']);
    if (/[–—]/.test(ours)) bad.push(['P5', 'dash']);
    if (/\b(complies|compliant|conforms|certified|approved by)\b/i.test(ours)) bad.push(['P5', 'compliance claim in our words']);
    if (/[$]|\baud\b|\bdollars?\b/i.test(ours)) bad.push(['P5', 'price']);
  }
  return bad;
}
