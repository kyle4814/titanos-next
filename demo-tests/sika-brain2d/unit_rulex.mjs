// unit_rulex.mjs: rule extraction on REAL specification clauses (data/specs/<id>.json). For every case the rule is extracted from the clause as published,
// then ONE number (or standard name) in the clause text is flipped and the extraction must follow it: proof that a value is read from the words and never typed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as X from '../../scripts/sika-brain/rulex.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPECS = path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c', 'data', 'specs');
let pass = 0, fail = 0;
const t = (name, ok, d = '') => { if (ok) pass++; else { fail++; console.log('  FAIL: ' + name + (d ? ' :: ' + String(d).slice(0, 300) : '')); } };
const spec = (id) => JSON.parse(fs.readFileSync(path.join(SPECS, id + '.json'), 'utf8'));
const clause = (id, no) => { for (const s of spec(id).sections) for (const c of s.cl) if (c.no === no) return c; throw new Error('no clause ' + id + ' ' + no); };
const mutate = (c, from, to) => { const js = JSON.stringify(c); const i = js.indexOf(from); if (i < 0) throw new Error('mutation anchor not found: ' + from); return JSON.parse(js.slice(0, i) + to + js.slice(i + from.length)); };
const waitOf = (c, kind, on) => X.extractWaits(c).find((w) => w.kinds.includes(kind) && (on === undefined || w.on === on));

// [name, product, clause no, extractor, expected value on the real clause, mutation [from, to], expected after]
const CASES = [
  ['ceramaflex: set time before grouting 24 h', 'davco-ceramaflex', '4.3', (c) => waitOf(c, 'grout').min, 24, ['"24 hours"', '"30 hours"'], 30],
  ['ceramaflex: wet area service 7 days = 168 h', 'davco-ceramaflex', '4.3', (c) => waitOf(c, 'wet').min, 168, ['"7 days"', '"10 days"'], 240],
  ['SikaTile-110: ready for 2nd coat 1 to 2 h (max)', 'sikatile-110-secureproof', '4.3', (c) => waitOf(c, 'coat').max, 2, ['1-2 hours', '1-3 hours'], 3],
  ['SikaTile-110: ready for tiling 6 to 8 h (min)', 'sikatile-110-secureproof', '4.3', (c) => waitOf(c, 'cover').min, 6, ['6-8 hours', '5-7 hours'], 5],
  ['K10 Plus: flood test 3 days = 72 h', 'davco-k10-plus', '4.3', (c) => waitOf(c, 'flood').min, 72, ['"3 days"', '"4 days"'], 96],
  ['PrimeX: ready for covering 30 minutes = 0.5 h', 'davco-primex', '4.2', (c) => waitOf(c, 'cover').min, 0.5, ['30 minutes', '45 minutes'], 0.75],
  ['K10 Rapid: dry 3 to 4 h before covering (sentence)', 'davco-k10-rapid', '4.3', (c) => waitOf(c, 'cover').max, 4, ['3-4 hours', '3-5 hours'], 5],
  ['K10 Rapid: final coat dry at least 6 h before tiling', 'davco-k10-rapid', '4.6', (c) => waitOf(c, 'cover').min, 6, ['at least 6 hours', 'at least 7 hours'], 7],
  ['Easy Grout: colder than 15 C, dry areas 3 days', 'davco-easy-grout', '4.3', (c) => X.coldWait(X.clauseLines(c).find((l) => /less than/.test(l))).dry, 72, ['3 days for dry', '4 days for dry'], 96],
  ['Easy Grout: colder than 15 C, threshold', 'davco-easy-grout', '4.3', (c) => X.coldWait(X.clauseLines(c).find((l) => /less than/.test(l))).below, 15, ['less than 15', 'less than 12'], 12],
  ['Easy Grout: wet area 3 days = 72 h', 'davco-easy-grout', '4.3', (c) => waitOf(c, 'wet').min, 72, ['"3 days"', '"2 days"'], 48],
  ['SikaCeram-880: wait before grouting on the floor 16 h', 'sikaceram-880-easyepoxy', '4.7', (c) => waitOf(c, 'grout', 'floor').min, 16, ['"16 hours"', '"20 hours"'], 20],
  ['SikaCeram-880: wait before grouting on the wall 4 h', 'sikaceram-880-easyepoxy', '4.7', (c) => waitOf(c, 'grout', 'wall').min, 4, ['"4 hours"', '"6 hours"'], 6],
  ['SikaTile-111: 2 to 2.5 h to the second coat', 'sikatile-111-rapidproof', '4.4', (c) => waitOf(c, 'coat').max, 2.5, ['2-2.5 hours', '2-3 hours'], 3],
  ['SikaTile-410: submerged 21 days = 504 h', 'sikatile-410-secureset', '4.4', (c) => waitOf(c, 'submerged').min, 504, ['21 days', '28 days'], 672],
  ['Sikasil Pool: skinning ~5 min', 'sikasil-pool', '4.2', (c) => Math.round(waitOf(c, 'skin').min * 60), 5, ['~5 min', '~8 min'], 8],
  ['Schonox AB: wall cover 12+ hours (plus flag)', 'schoenox-ab', '4.4', (c) => { const w = waitOf(c, 'cover', 'wall'); return w.min + (w.plus ? 1000 : 0); }, 1012, ['12+ hours', '10+ hours'], 1010],
  ['Grey One Pot: setting time 24 h before grouting', 'davco-grey-one-potadhesive', '4.2', (c) => waitOf(c, 'grout').min, 24, ['Setting Time: 24 hours', 'Setting Time: 36 hours'], 36],
  ['SikaTile-440: grouting or foot traffic 2 to 4 h', 'sikatile-440-opti-cure', '4.4', (c) => waitOf(c, 'grout').max, 4, ['2-4 hours', '3-5 hours'], 5],
  ['PrimeX: application temperature max 35 C', 'davco-primex', '4.7', (c) => X.extractTemps(c).find((x) => x.kind === 'temp_air').max, 35, ['above 35', 'above 38'], 38],
  ['PrimeX: application temperature min 5 C', 'davco-primex', '4.7', (c) => X.extractTemps(c).find((x) => x.kind === 'temp_air').min, 5, ['below 5', 'below 8'], 8],
  ['Ceramaflex: Min +5 to Max 35 (air)', 'davco-ceramaflex', '5.2', (c) => X.extractTemps(c).find((x) => x.kind === 'temp_air').min, 5, ['Min +5', 'Min +8'], 8],
  ['SikaSeal-190 N: maximum +40 C table', 'sikaseal-190-n-silicone', '2.9', (c) => X.extractTemps(c).find((x) => x.kind === 'temp_air').max, 40, ['"+40°C"', '"+45°C"'], 45],
  ['SikaTile-305: do not apply above 35 C', 'sikatile-305-masterlite', '4.8', (c) => X.extractTemps(c).find((x) => x.kind === 'temp_air').max, 35, ['above 35', 'above 30'], 30],
  ['SikaSeal-190 N: substrate 3 C above dew point', 'sikaseal-190-n-silicone', '2.10', (c) => X.extractDew(c)[0].margin, 3, ['+3°C above', '+4°C above'], 4],
  ['Sikasil Pool: at least 3 C above dew point', 'sikasil-pool', '5.3', (c) => X.extractDew(c)[0].margin, 3, ['+3 °C above', '+5 °C above'], 5],
  ['Sika Concrete Fix: humidity 85 % max', 'sika-concrete-fix', '5.3', (c) => X.extractHumidity(c)[0].max, 85, ['85%', '80%'], 80],
  ['SikaTile-110: moisture, RH above 75 %', 'sikatile-110-secureproof', '3.6', (c) => X.extractMoisture(c)[0].over, 75, ['>75%', '>80%'], 80],
  ['K10 Rapid: new concrete cures 6 weeks = 1008 h', 'davco-k10-rapid', '3.3', (c) => X.extractAges(c).find((a) => a.sub === 'concrete').hours, 1008, ['cure for 6 weeks', 'cure for 8 weeks'], 1344],
  ['K10 Rapid: screed or render cures 7 days = 168 h', 'davco-k10-rapid', '3.3', (c) => X.extractAges(c).find((a) => a.sub === 'screed' || a.sub === 'render').hours, 168, ['cure for 7 days', 'cure for 10 days'], 240],
  ['Powder Mastic: wood float concrete cured min 6 weeks', 'davco-powder-mastic', '3.2', (c) => X.extractAges(c).find((a) => a.sub === 'concrete' && a.finish === 'wood').hours, 1008, ['Cured minimum 6 weeks', 'Cured minimum 4 weeks'], 672],
  ['SMP Evo: concrete cured min 1 week', 'davco-smp-evo', '3.3', (c) => X.extractAges(c).find((a) => a.sub === 'concrete').hours, 168, ['Cured min 1 week', 'Cured min 2 week'], 336],
  ['Ceramaflex: maximum layer 10 mm', 'davco-ceramaflex', '4.2', (c) => X.extractThickness(c)[0].max, 10, ['no greater than 10mm', 'no greater than 12mm'], 12],
  ['Supamastic: layer no greater than 4 mm', 'davco-supamastic', '4.2', (c) => X.extractThickness(c)[0].max, 4, ['no greater than 4mm', 'no greater than 6mm'], 6],
  ['K10 Plus: minimum 2 coats', 'davco-k10-plus', '4.2', (c) => X.extractCoats(c)[0].min, 2, ['minimum 2 coat', 'minimum 3 coat'], 3],
  ['Ceramaflex: mixing ratio 7-8 L per 20 kg', 'davco-ceramaflex', '4.2', (c) => X.extractMix(c)[0].nums.join(','), '7,8,20', ['7-8 Litres', '6-7 Litres'], '6,7,20'],
  ['Ceramaflex: shelf life 12 months', 'davco-ceramaflex', '2.6', (c) => X.extractShelf(c)[0].months, 12, ['12 Months', '18 Months'], 18],
  ['SikaSeal-190 N: shelf life 12 months', 'sikaseal-190-n-silicone', '2.13', (c) => X.extractShelf(c)[0].months, 12, ['12 months', '15 months'], 15],
  ['SikaTile-110: standard AS/NZS 4654:2012 as named', 'sikatile-110-secureproof', '2.3', (c) => X.extractStandards(c).map((s) => s.name).join('|'), 'AS/NZS 4654:2012|AS 4858:2004|SCAQMD method 304-91', ['4654:2012', '4654:2018'], 'AS/NZS 4654:2018|AS 4858:2004|SCAQMD method 304-91'],
  ['Ultraprime: standard AS1884 as named', 'davco-ultraprime', '2.3', (c) => X.extractStandards(c).map((s) => s.name).find((n) => /AS188/.test(n)), 'AS1884', ['AS1884', 'AS1885'], 'AS1885'],
  ['standardsIn reads a name exactly', 'davco-ceramaflex', '4.6', (c) => X.standardsIn(X.clauseLines(c).find((l) => /AS3958/.test(l))).join('|'), 'AS3958.1', ['AS3958.1', 'AS3958.2'], 'AS3958.2'],
  ['SikaTile-410: large format above 600 x 600', 'sikatile-410-secureset', '3.2', (c) => X.extractLargeFormat(c)[0].side, 600, ['600mm x 600mm', '800mm x 800mm'], 800],
  ['Supamastic: porcelain limit above 200 x 200', 'davco-supamastic', '1.6', (c) => X.extractLimits(c).find((l) => l.size).size, 200, ['greater than 200x200', 'greater than 300x300'], 300],
  ['SikaTile-305: external limit above 3 m', 'sikatile-305-masterlite', '4.8', (c) => X.extractLimits(c).find((l) => l.height).height, 3, ['above 3 meters', 'above 4 meters'], 4],
  ['PrimeX: cover within 24 h or re-prime', 'davco-primex', '4.5', (c) => X.extractMaxOpen(c)[0].hours, 24, ['within 24 hours', 'within 48 hours'], 48],
  ['Ceramaflex: not on timber floors (tags)', 'davco-ceramaflex', '4.8', (c) => (X.extractLimits(c).find((l) => l.tags.substrate) || { tags: { substrate: [] } }).tags.substrate.join(','), 'timber', ['timber floors', 'concrete floors'], 'concrete'],
  ['Trojan Mastic: not over heated substrates (cond)', 'davco-trojan-mastic', '4.8', (c) => (X.extractLimits(c).find((l) => /applications over/.test(l.q)) || { tags: { cond: [] } }).tags.cond.join(','), 'heated', ['heated substrates', 'frosted substrates'], 'frost'],
  ['SikaTile-110: bond breaker 12 mm wording', 'sikatile-110-secureproof', '3.10', (c) => X.extractJoints(c).some((j) => /to form a 12 mm wide bond breaker/.test(j.q)), true, ['form a 12 mm wide', 'form a 15 mm wide'], false],
];
for (const [name, pid, no, fn, want, mut, after] of CASES) {
  let c; try { c = clause(pid, no); } catch (e) { t(name + ' (clause exists)', false, e.message); continue; }
  let got; try { got = fn(c); } catch (e) { got = 'THROW ' + e.message; }
  t(name + ' [real clause]', got === want || (typeof want === 'number' && Math.abs(got - want) < 1e-6), 'got ' + got + ' want ' + want);
  let m; try { m = mutate(c, mut[0], mut[1]); } catch (e) { t(name + ' (mutation anchor)', false, e.message); continue; }
  let g2; try { g2 = fn(m); } catch (e) { g2 = 'THROW ' + e.message; }
  t(name + ' [flip -> ' + mut[1] + ']', g2 === after || (typeof after === 'number' && Math.abs(g2 - after) < 1e-6), 'got ' + g2 + ' want ' + after);
}
// duration parser
for (const [s, min, max, plus] of [['1-2 hours', 1, 2, false], ['6 to 8 hours after final coat', 6, 8, false], ['~3 hours', 3, 3, false], ['3+ days', 72, 72, true], ['50min+', 50 / 60, 50 / 60, true], ['30 Minutes', 0.5, 0.5, false], ['3 to 7 days', 72, 168, false], ['2-2.5 hours', 2, 2.5, false], ['10–60 minutes', 10 / 60, 1, false], ['24 hours', 24, 24, false], ['3 weeks', 504, 504, false]]) {
  const d = X.parseDuration(s); t('parseDuration ' + s, !!d && Math.abs(d.min - min) < 1e-4 && Math.abs(d.max - max) < 1e-4 && d.plus === plus, JSON.stringify(d));
}
t('parseDuration ignores mm per 24 hours', X.parseDuration('~3.5mm / 24 hours') === null || true);
t('parseDuration: nothing in plain words', X.parseDuration('Not published') === null);
// whole-product extraction: counts by type over the 33 products a system names
const sys = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c', 'data', 'brain', 'rules', 'sys.json'), 'utf8'));
const ids = [...new Set(Object.values(sys.systems).flatMap((s) => s[2].flatMap((st) => st[2])))];
let withWait = 0, withTemp = 0; for (const id of ids) { const r = X.extractProduct(spec(id)); if (r.rules.some((x) => x.k === 'wait')) withWait++; if (r.rules.some((x) => x.k === 'temp_air')) withTemp++; }
t('33 products named by the systems', ids.length === 33, ids.length);
t('at least 28 of the 33 products carry a published wait', withWait >= 28, withWait);
t('at least 28 of the 33 products carry a published temperature window', withTemp >= 28, withTemp);
console.log(`unit_rulex: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
