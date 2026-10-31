// t_extract.mjs: the data sheet field extractor on 48 real rows (label | value) copied from the page-marked data sheet text (lanes/specs/by_product),
// each with its expected normalised value written by hand from the printed text, plus mutation checks: corrupt one unit and the test must fail.
import { extractRow, rankValue, durations, strengths, thickness } from '../../scripts/sika-brain/num_extract.mjs';
import { thicknessRate } from '../../scripts/sika-brain/build_num.mjs';
let pass = 0, fail = 0;
const t = (name, ok, detail = '') => { if (ok) pass++; else { fail++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); } };
const J = (x) => JSON.stringify(x);
// [source product, label, value, id, check(v) -> bool, readable expectation]
const D = (lo, hi, at) => (v) => v.items[0].min_lo === lo && v.items[0].min_hi === hi && (at === undefined || v.at_c === at);
const S = (lo, hi, age) => (v) => v.items.some((x) => x.mpa_lo === lo && x.mpa_hi === hi && x.age_days === age);
const CASES = [
  ['davco-ceramacrete', 'Pot Life', '40 Minutes', 'pot_life', D(40, 40), '40 min'],
  ['sikadur-55-slv', 'Pot Life', '~20 minutes', 'pot_life', D(20, 20), '20 min'],
  ['sikagrout-9610', 'Pot Life', '3 hours', 'pot_life', D(180, 180), '3 h = 180 min'],
  ['sikatile-405-lite', 'Pot Life', '2.5 hours at 23°C and 50% relative humidity.', 'pot_life', D(150, 150, 23), '2.5 h at 23 C'],
  ['sikafloor-level-pro', 'Pot Life', '18 minutes @ 23°C', 'pot_life', D(18, 18, 23), '18 min at 23 C'],
  ['davco-trojan-mastic', 'Open Time', '30 minutes at 23°C and 50% relative humidity.', 'open_time', D(30, 30, 23), '30 min'],
  ['davco-ceramacrete', 'Open Time', '7 minutes', 'open_time', D(7, 7), '7 min'],
  ['sikafloor-level-pro', 'Initial set time', '55-95 Minutes @ 23°C', 'initial_set', D(55, 95, 23), '55 to 95 min'],
  ['sikafloor-050-rampandpatch', 'Initial set time', '20 minutes @ 23°C', 'initial_set', D(20, 20, 23), '20 min'],
  ['sikafloor-050-rampandpatch', 'Final set time', '25 minutes @ 23°C', 'final_set', D(25, 25, 23), '25 min'],
  ['sika-monotop-352nfg', 'Final set time', '~ 6 hours', 'final_set', D(360, 360), '6 h = 360 min'],
  ['davco-superfine-whitegrout', 'Curing Time', '24 hours at 23°C & 50% RH.', 'cure_time', D(1440, 1440, 23), '24 h'],
  ['sikafloor-550-pa', 'Curing time', 'Approx. 24 hrs at ±23oC', 'cure_time', D(1440, 1440), '24 h'],
  ['sikaflex-112-crystalclear', 'Skinning time', '~10 min (23 °C / 50 % r.h.)', 'skin_time', D(10, 10, 23), '10 min'],
  ['4649', 'Skinning time', '170 minutes approx. (23 °C / 50% r.h.)', 'skin_time', D(170, 170, 23), '170 min'],
  ['sikalastic-851', 'Waiting time to overcoating', '1–2 min at +20 °C', 'overcoat_wait', D(1, 2, 20), '1 to 2 min'],
  ['sika-filler-101', 'Waiting time to overcoating', '~4 hours', 'overcoat_wait', D(240, 240), '4 h'],
  ['lanko-145-floor-leveller', 'Compressive Strength', '1 day cure – 14MPa to 16 MPa 28 day cure – 25MPa to 30MPa', 'compressive', (v) => S(14, 16, 1)(v) && S(25, 30, 28)(v), '14 to 16 MPa at 1 d, 25 to 30 MPa at 28 d'],
  ['sikafloor-21-purcem', 'Compressive strength', '~50 N/mm² (28 days at +23 °C / 50 % r.h.)', 'compressive', S(50, 50, 28), '50 MPa at 28 d (N/mm2 = MPa)'],
  ['sikafloor-215-rapidscreed', 'Compressive strength', '~22 MPa at 1 day; ~40 MPa at 28 days', 'compressive', (v) => S(22, 22, 1)(v) && S(40, 40, 28)(v), '22 MPa 1 d, 40 MPa 28 d'],
  ['sika-anchorfix-1', 'Compressive strength', '~60 N/mm² (7 days, +20 °C)', 'compressive', S(60, 60, 7), '60 MPa at 7 d'],
  ['sikafloor-050-rampandpatch', 'Compressive strength', '1 day cure ~ 30MPa; 28 day cure ~ 40MPa', 'compressive', (v) => S(30, 30, 1)(v) && S(40, 40, 28)(v), '30 MPa 1 d, 40 MPa 28 d'],
  ['sika-monotop-910n', 'Compressive strength', '~50 MPa after 28 days', 'compressive', S(50, 50, 28), '50 MPa 28 d'],
  ['sikafloor-level-pro', 'Compressive strength', '1 day cure > 10MPa; 28 day cure > 25MPa', 'compressive', (v) => S(10, 10, 1)(v) && S(25, 25, 28)(v), '10 and 25 MPa'],
  ['sikafloor-94', 'Compressive strength', '> 40 MPa', 'compressive', S(40, 40, null), '40 MPa, age not printed'],
  ['sikagard-720-epocem', 'Flexural-strength', '> 5 N/mm² (28 days / +20 °C / 50 % r.h)', 'flexural', S(5, 5, 28), '5 MPa 28 d'],
  ['lanko-136-rapid-patchingmortar', 'Tensile adhesion strength', '≥ 2.0 MPa', 'tensile_adhesion', S(2, 2, null), '2 MPa'],
  ['sikafloor-235-esd', 'Tensile adhesion strength', '> 1.5 N/mm² (failure in concrete)', 'tensile_adhesion', S(1.5, 1.5, null), '1.5 MPa'],
  ['davco-smp-evo', 'Volatile organic compound (VOC) content', 'Low VOC - 7g/L (SCAQMD method 304-91)', 'voc', (v) => v.items[0].gl_lo === 7, '7 g/L'],
  ['sikagard-705-l', 'Volatile organic compound (VOC) content', '~327 g/l', 'voc', (v) => v.items[0].gl_lo === 327, '327 g/L'],
  ['1671', 'Shelf life', '15 months from the date of production', 'shelf_life', (v) => v.months_lo === 15, '15 months'],
  ['sika-rugasol-fc', 'Shelf life', 'Protected from direct sunlight and frost, the shelf life is 12 months.', 'shelf_life', (v) => v.months_lo === 12, '12 months'],
  ['sikafloor-level-pro', 'Shelf life', 'Unopened bags can be stored for up to 9 months in a cool, dry and weather proof environment.', 'shelf_life', (v) => v.months_lo === 9, '9 months'],
  ['s-drain-pvc', 'Shelf life', '5 years', 'shelf_life', (v) => v.months_lo === 60, '5 years = 60 months'],
  ['davco-ceramaflex', 'Layer Thickness', 'Maximum layer shall be no greater than 10mm.', 'layer', (v) => v.items[0].mm_hi === 10, '10 mm'],
  ['sika-monotop-723n', 'Layer thickness', 'min. 1 mm / max. 5 mm', 'layer', (v) => v.items[0].mm_lo === 1 && v.items[1].mm_hi === 5, '1 mm min, 5 mm max'],
  ['sikafloor-level-top', 'Layer thickness', '1 - 30mm or 10 - 50mm when bulked with 1-2mm aggregate', 'layer', (v) => v.items[0].mm_lo === 1 && v.items[0].mm_hi === 30 && v.items[1].mm_hi === 50, '1 to 30 mm'],
  ['4649', 'Service temperature', '−40 °C to +70 °C', 'service_temp', (v) => v.c_lo === -40 && v.c_hi === 70, '-40 to 70 C'],
  ['sikaflex-400-fire', 'Service temperature', '−40 °C to + 70 °C', 'service_temp', (v) => v.c_lo === -40 && v.c_hi === 70, '-40 to 70 C'],
  ['abelflex', 'Service temperature', '-40° C Min / +95° C Max (ISO 1856)', 'service_temp', (v) => v.c_lo === -40 && v.c_hi === 95, '-40 to 95 C'],
  ['sikaflex-400-fire', 'Movement capability', '±25 % (ISO 9047); ±35 % (ASTM C 719)', 'movement', (v) => v.items[0].pct_lo === 25, '25 %'],
  ['sikagard-550-w-elastic', 'Solid content by volume', '~ 53%', 'solids_vol', (v) => v.items[0].pct_lo === 53, '53 %'],
  ['sikalastic-777', 'Shore A hardness', '70 Shore A', 'shore', (v) => v.value === 70 && v.scale === 'A', '70 A'],
  ['1671', 'Shore A hardness', '~37 (after 28 days)', 'shore', (v) => v.value === 37 && v.scale === 'A', '37 A, scale from the label'],
  ['4649', 'Curing rate', '3 mm/24 hours approx. (23 °C / 50% r.h.)', 'cure_rate', (v) => v.mm_lo === 3 && v.per_hours === 24, '3 mm per 24 h'],
  ['sikaseal-roof-gutter', 'Curing rate', '~3-4 mm per 24 hours (+23°C / 50% r.h.)', 'cure_rate', (v) => v.mm_lo === 3 && v.mm_hi === 4, '3 to 4 mm per 24 h'],
  ['sika-monotop-fc', 'Packaging', '15kg bag', 'pack_sizes', (v) => v.items[0].amount === 15 && v.items[0].unit === 'kg' && v.items[0].container === 'bag', '15 kg bag'],
  ['4649', 'Packaging', '310 ml cartridge, 12 cartridges per box; 600 ml foil pack, 20 foil packs per box', 'pack_sizes', (v) => v.items.some((x) => x.amount === 310 && x.unit === 'mL') && v.items.some((x) => x.amount === 600 && x.unit === 'mL'), '310 mL and 600 mL'],
];
for (const [pid, label, value, id, ok, want] of CASES) {
  const x = extractRow(label, value);
  t(`${pid} | ${label} | ${value.slice(0, 40)} -> ${id} ${want}`, !!x && x.id === id && ok(x.v), J(x));
}
t('at least 40 real snippets', CASES.length >= 40, String(CASES.length));
// a rate is not a time: "3 mm / 24 hours" must never become a 24 hour cure time
t('curing rate 3 mm per 24 h is NOT read as a 24 hour curing time', (extractRow('Curing rate', '~3.5mm / 24 hours At 23°C / 50 % R.H.') || {}).id === 'cure_rate');
// a flattened table is never read (the columns are lost)
t('a flattened table row is dropped, not guessed', extractRow('Compressive strength', 'Time | Compressive strength 1 hour | ~ 5 MPa 24 hours | ~ 7 MPa') === null);
t('a row with no unit gives null', extractRow('Pot Life', 'see data sheet') === null && extractRow('Compressive strength', 'high') === null);
t('hours are not confused with a word: "5 hot" is not 5 h', durations('5 hot days').length === 0 || durations('5 hot').length === 0);
t('rankValue: compressive compares only 28 day figures', rankValue('compressive', extractRow('Compressive strength', '~60 N/mm² (7 days, +20 °C)').v) === null && rankValue('compressive', extractRow('Compressive strength', '~50 MPa after 28 days').v).hi === 50);
// thickness-aware coverage (kg per m2 per mm) from the sentence and the one listed bag size
{
  const a = thicknessRate('1 bag will cover approximately 12m2 at 1mm of thickness.', [{ amount: 20, unit: 'kg' }]);
  t('1 bag covers 12 m2 at 1 mm, 20 kg bag -> 1.6667 kg/m2/mm', a && Math.abs(a.exact - 20 / 12) < 1e-9 && a.pack_kg === 20, J(a));
  const b = thicknessRate('12 Litres - 4m2 @ 3mm thickness', [{ amount: 20, unit: 'kg' }]);
  t('12 L = 4 m2 at 3 mm (volume checks out), one 20 kg bag -> 20/12 kg/m2/mm', b && Math.abs(b.exact - 20 / 12) < 1e-9, J(b));
  t('litres that do not equal m2 x mm are refused', thicknessRate('12 Litres - 5m2 @ 3mm thickness', [{ amount: 20, unit: 'kg' }]) === null);
  t('a yield with two bag sizes is refused (which bag?)', thicknessRate('12L - 4m2 @ 3mm', [{ amount: 20, unit: 'kg' }, { amount: 5, unit: 'kg' }]) === null);
  const c = thicknessRate('A 5kg bag with cover approximately 2.5m2 at 1mm of thickness (dependant of mix consistency and substrate flatness).', [{ amount: 5, unit: 'kg' }]);
  t('5 kg bag covers 2.5 m2 at 1 mm -> 2 kg/m2/mm', c && Math.abs(c.exact - 2) < 1e-9, J(c));
  t('2 bags is refused, only 1 bag is a stated basis', thicknessRate('2 bag will cover approximately 12m2 at 1mm', [{ amount: 20, unit: 'kg' }]) === null);
}
// ---- mutation: corrupt one unit in a real snippet and the check must fail (proves the checks read the unit)
const MUT = [
  ['Pot Life', '3 hours', 'pot_life', D(180, 180), (s) => s.replace('hours', 'minutes')],
  ['Pot Life', '18 minutes @ 23°C', 'pot_life', D(18, 18, 23), (s) => s.replace('minutes', 'hours')],
  ['Compressive strength', '~50 N/mm² (28 days at +23 °C / 50 % r.h.)', 'compressive', S(50, 50, 28), (s) => s.replace('28 days', '7 days')],
  ['Compressive strength', '~50 MPa after 28 days', 'compressive', S(50, 50, 28), (s) => s.replace('MPa', 'kPa')],
  ['Shelf life', '5 years', 'shelf_life', (v) => v.months_lo === 60, (s) => s.replace('years', 'months')],
  ['Volatile organic compound (VOC) content', '~327 g/l', 'voc', (v) => v.items[0].gl_lo === 327, (s) => s.replace('g/l', 'mg/l')],
  ['Layer thickness', 'min. 1 mm / max. 5 mm', 'layer', (v) => v.items[0].mm_lo === 1 && v.items[1].mm_hi === 5, (s) => s.replace('5 mm', '5 m')],
  ['Service temperature', '-40° C Min / +95° C Max (ISO 1856)', 'service_temp', (v) => v.c_lo === -40 && v.c_hi === 95, (s) => s.replace('+95', '+59')],
  ['Curing rate', '3 mm/24 hours approx.', 'cure_rate', (v) => v.mm_lo === 3 && v.per_hours === 24, (s) => s.replace('mm', 'cm')],
];
for (const [label, value, id, ok, mut] of MUT) {
  const safe = (f) => { try { return !!f(); } catch { return false; } };
  const good = extractRow(label, value); const goodOk = !!good && good.id === id && safe(() => ok(good.v));
  const m = mut(value); const bad = extractRow(label, m); const badOk = !!bad && bad.id === id && safe(() => ok(bad.v));
  t(`mutation: "${value}" passes, "${m}" must fail`, goodOk && !badOk, J({ goodOk, badOk, bad }));
}
console.log(`t_extract: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
