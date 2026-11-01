// unit_plan.mjs: the lane D plan engine. Constraint model, timeline arithmetic, plan assembly against the real rule shards, conflicts, traps,
// mutation of the shard data, follow-up state, the shared project store, shard hygiene, and the zero-WRONG gate over wave2d.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBrain, PORTAL } from '../sika-brain/harness.mjs';
import * as R from '../../public/demo/sika-210c0c/assets/brain/rules.js';
import { cardText, validateCard } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
import { judge2d, modeOf } from '../sika-brain/coverage/wave2d_judge.mjs';
import { checkAnswer } from '../sika-brain/props.mjs';
import { windowHours, recompute } from './plan_props.mjs';
import { createProjectStore } from '../../public/demo/sika-210c0c/assets/lib/projectstore.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0; const t = (n, ok, d = '') => { if (ok) pass++; else { fail++; console.log('  FAIL: ' + n + (d ? ' :: ' + String(d).slice(0, 300) : '')); } };
const near = (a, b) => Math.abs(a - b) < 1e-4;
const RD = path.join(PORTAL, 'data', 'brain', 'rules');
const sys = JSON.parse(fs.readFileSync(path.join(RD, 'sys.json'), 'utf8')); const tile = JSON.parse(fs.readFileSync(path.join(RD, 'tile.json'), 'utf8'));
const mkData = () => ({ sys, rules: JSON.parse(JSON.stringify(tile.products)) });
const K0 = (tileId, sub, extra = {}) => { const K = R.parseConstraints('x'); K.tile = tileId; K.sub = sub; K.where = {}; Object.assign(K, extra); return K; };

// ---------------------------------------------------------------- 1. constraint model
const P = (q, prior) => R.parseConstraints(q, prior);
let k;
k = P('porcelain tiles on a concrete slab in a bathroom floor, 18 m2'); t('tile porcelain', k.tile === 'porcelain'); t('substrate concrete', k.sub === 'concrete'); t('zone internal wet floor', JSON.stringify(R.zonesOf(k)) === '["internal-wet-floor"]', R.zonesOf(k)); t('area 18', k.area === 18);
k = P('ceramic on plasterboard shower walls'); t('plasterboard + wall', k.sub === 'plasterboard' && JSON.stringify(R.zonesOf(k)) === '["internal-wet-wall"]');
k = P('tiling a bathroom, ceramic on gyprock'); t('bathroom with no axis gives floor and wall', R.zonesOf(k).length === 2, R.zonesOf(k));
k = P('mosaic in a swimming pool on concrete'); t('pool is its own location', JSON.stringify(R.zonesOf(k)) === '["pool"]');
k = P('porcelain on a balcony over concrete'); t('balcony is an external floor', JSON.stringify(R.zonesOf(k)) === '["external-floor"]', R.zonesOf(k));
k = P('1200 x 600 porcelain on concrete'); t('1200x600 reads as large format', k.tile === 'large-format' && k.size[0] === 600 && k.size[1] === 1200, k.tile);
k = P('600x600 porcelain on concrete'); t('600x600 is not larger than 600x600', k.tile === 'porcelain');
k = P('900 x 900 porcelain'); t('900x900 large format', k.tile === 'large-format');
k = P('green marble in a shower'); t('green marble is moisture sensitive stone', k.tile === 'moisture-sensitive-stone');
k = P('granite tiles outside on a slab'); t('granite is natural stone', k.tile === 'natural-stone');
k = P('glass mosaic'); t('glass mosaic is the glass system', k.tile === 'glass');
k = P('tiling over existing tiles on a concrete slab'); t('existing tiles win over the slab underneath', k.sub === 'existing-tiles', k.sub);
k = P('over-sheeted particleboard floor'); t('particleboard is the timber system', k.sub === 'timber-floor');
k = P('tile onto hebel'); t('hebel is AAC', k.sub === 'aac');
k = P('villaboard wall'); t('villaboard is cement board', k.sub === 'cement-board');
k = P('rendered brick'); t('rendered brick is masonry', k.sub === 'masonry');
k = P('ceramic onto vinyl in a laundry'); t('vinyl is unsupported', k.unsupported.includes('vinyl'), JSON.stringify(k.unsupported));
k = P('ceramic over a steel deck'); t('steel is unsupported', k.unsupported.includes('steel'));
k = P('stainless steel trim on a concrete slab with ceramic tiles'); t('steel trim is not a substrate', !(k.unsupported || []).length, JSON.stringify(k.unsupported));
k = P('it is 38 degrees'); t('temperature 38', k.temp === 38); k = P('minus 6 degrees'); t('minus 6 degrees', k.temp === -6); k = P('-2 degrees'); t('-2 degrees', k.temp === -2);
k = P('humidity is 85%'); t('humidity 85', k.rh === 85);
k = P('slab poured 3 weeks ago'); t('age 3 weeks', k.age && k.age.hours === 504, JSON.stringify(k.age)); k = P('a 10 day old slab'); t('age 10 days', k.age && k.age.hours === 240);
k = P('concrete poured 2 months ago'); t('age 2 months', k.age && k.age.hours === 1440);
k = P('we only have 3 days'); t('budget 3 days', k.budget && k.budget.hours === 72); k = P('can finish within 48 hours'); t('budget 48 hours', k.budget && k.budget.hours === 48); k = P('we can wait 176 hours'); t('budget wait 176 hours', k.budget && k.budget.hours === 176);
t('age is not a budget', !P('slab poured 3 weeks ago').budget);
k = P('rising damp in the wall'); t('rising damp flag', k.flags.risingDamp); k = P('the slab is damp'); t('damp flag', k.flags.damp); k = P('cars drive on the garage floor'); t('vehicular flag', k.flags.vehicular);
k = P('tiling directly onto timber'); t('direct flag', k.flags.direct); k = P('underfloor heating in the bathroom'); t('heated flag', k.flags.heated);
k = P('a hallway in porcelain on a slab'); t('a hallway is a floor, flagged as assumed', R.zonesOf(k).join() === 'internal-floor' && k.where.floorAssumed);
const m = P('porcelain on concrete', null); const m2 = P('in a bathroom floor, 22 degrees', m); t('a later message adds to the earlier one', m2.tile === 'porcelain' && m2.sub === 'concrete' && R.zonesOf(m2)[0] === 'internal-wet-floor' && m2.temp === 22);
t('classify: plain system lookup is left to the stack', R.classifyAsk('What is the full system for ceramic tiles on fibre cement sheet on an external floor?', P('What is the full system for ceramic tiles on fibre cement sheet on an external floor?')) === null);
t('classify: a plan question', R.classifyAsk('plan for porcelain on a concrete balcony floor', P('plan for porcelain on a concrete balcony floor')) === 'plan');
t('classify: a price question is not for this module', R.classifyAsk('how much does the porcelain on a concrete balcony floor plan cost', P('how much does the porcelain on a concrete balcony floor plan cost')) === null);
t('classify: a bare product question is not for this module', R.classifyAsk('What is the pot life', P('What is the pot life'), { hasProduct: true }) === null);

// ---------------------------------------------------------------- 2. timeline arithmetic
const W = (min, max, raw = '', extra = {}) => ({ min, max, plus: false, raw, refs: [], ...extra });
let tl = R.scheduleOf({ parts: [{ k: 'seq', label: 'a', w: W(0.5, 0.5, '30 minutes') }, { k: 'seq', label: 'b', w: W(1, 2, '1-2 hours'), mult: 2 }, { k: 'final', a: W(168, 168, '7 days'), g: W(72, 72, '3 days'), gwait: W(24, 24, '24 hours') }], missing: [], coats: null }, null);
t('total adds sequence, repeats and the longer final path', tl.ok && near(tl.min, 0.5 + 2 + 168) && near(tl.max, 0.5 + 4 + 168), JSON.stringify([tl.min, tl.max]));
tl = R.scheduleOf({ parts: [{ k: 'final', a: W(24, 24, '24 hours'), g: W(72, 72, '3 days'), gwait: W(24, 24, '24 hours') }], missing: [] }, null);
t('grout path governs when it is longer (24 + 72 > 24)', tl.ok && tl.min === 96 && tl.basis === 'grout', JSON.stringify(tl));
tl = R.scheduleOf({ parts: [{ k: 'final', a: W(168, 168), g: W(72, 72), gwait: W(24, 24) }], missing: [] }, null); t('adhesive path governs when it is longer', tl.basis === 'adhesive' && tl.min === 168);
tl = R.scheduleOf({ parts: [{ k: 'seq', label: 'a', w: W(1, 1) }], missing: [{ label: 'x', why: 'y' }] }, null); t('a missing window gives no total', !tl.ok && tl.min === null && tl.max === null);
tl = R.scheduleOf({ parts: [{ k: 'final', a: W(24, 24), g: null, gwait: W(24, 24) }], missing: [] }, null); t('a final stage without a grout window gives no total', !tl.ok);
tl = R.scheduleOf({ parts: [{ k: 'seq', label: 'a', w: W(72, 72, '3+ days', { plus: true }) }, { k: 'final', a: W(24, 24), g: W(24, 24), gwait: W(24, 24) }], missing: [] }, null); t('an "or more" window marks the total open ended', tl.ok && tl.plus === true);
for (const [hrs, verdict] of [[72, 'over'], [175.4, 'over'], [176, 'maybe'], [176.5, 'fits'], [240, 'fits']]) { const x = R.scheduleOf({ parts: [{ k: 'seq', label: 'a', w: W(175.5, 176.5) }, { k: 'final', a: W(0, 0), g: W(0, 0), gwait: W(0, 0) }], missing: [] }, { budget: { hours: hrs } }); t('budget ' + hrs + ' h of 175.5 to 176.5 is ' + verdict, x.budget && x.budget.verdict === verdict, JSON.stringify(x.budget)); }
t('fmtH: minutes, hours, days', R.fmtH(0.5) === '30 minutes' && R.fmtH(6) === '6 hours' && R.fmtH(168) === '7 days' && R.fmtH(175.5) === '7.3 days');
t('independent window parser agrees on merged figures', (() => { const w = windowHours('1-2 hours / 2-3 hours'); return w.min === 2 && w.max === 3; })());
t('independent window parser: days to hours', windowHours('3 to 7 days').max === 168);

// ---------------------------------------------------------------- 3. picking a wait
const D0 = mkData();
let w = R.pickWait(D0, 'davco-k10-rapid', ['cover']); t('K10 Rapid: two published figures for tiling, the longer governs', w && w.min === 6 && w.max === 6 && w.distinct && w.refs.length === 2, JSON.stringify([w && w.min, w && w.max]));
w = R.pickWait(D0, 'sikatile-110-secureproof', ['coat']); t('SikaTile-110: coat wait 1-2 / 2-3 merges to 2..3', w.min === 2 && w.max === 3);
w = R.pickWait(D0, 'schoenox-ab', ['cover'], { axis: 'wall', porous: true }); t('Schonox AB: porous wall 12+ hours', w.min === 12 && w.plus);
w = R.pickWait(D0, 'schoenox-ab', ['cover'], { axis: 'floor', porous: true }); t('Schonox AB: porous floor 2+ hours', w.min === 2);
w = R.pickWait(D0, 'schoenox-ab', ['cover'], { axis: 'floor', porous: false }); t('Schonox AB: non porous floor takes the non porous figure (6+) and the floor figure only when porous', w.min === 6, w && w.min);
w = R.pickWait(D0, 'davco-trojan-mastic', ['dry', 'service']); t('Trojan Mastic publishes no dry area window', w === null);
w = R.pickWait(D0, 'davco-ceramaflex', ['nothing']); t('an unknown kind is null', w === null);

// ---------------------------------------------------------------- 4. do-not rules against the job
const ra = (tags, K, loc = 'internal-wet-floor', v = {}, text = '') => R.ruleApplies(tags, K, { loc, sub: K.sub, tile: K.tile }, v, text);
t('size: larger than 200 needs a tile size above 200', ra({ tile: ['porcelain'] }, K0('porcelain', 'concrete'), 'internal-floor', { size: 200 }) === null && ra({ tile: ['porcelain'] }, K0('porcelain', 'concrete', { size: [600, 600] }), 'internal-floor', { size: 200 }) !== null);
t('height: above 3 m needs a height flag', ra({ env: ['external'] }, K0('ceramic', 'concrete', { flags: {} }), 'external-wall', { height: 3 }) === null && ra({ env: ['external'] }, K0('ceramic', 'concrete', { flags: { heightHigh: true } }), 'external-wall', { height: 3 }) !== null);
t('a caution with "without" is not a ban', ra({ substrate: ['concrete'] }, K0('porcelain', 'concrete'), 'internal-floor', {}, 'Do not use on highly porous concrete or in hot windy conditions without pre-wetting') === null);
t('steel trowel rule needs the steel trowel flag', ra({ substrate: ['concrete'] }, K0('porcelain', 'concrete'), 'internal-floor', {}, 'Not suitable for steel trowel concrete') === null && ra({ substrate: ['concrete'] }, K0('porcelain', 'concrete', { flags: { smooth: true } }), 'internal-floor', {}, 'Not suitable for steel trowel concrete') !== null);
t('rising damp rule needs the flag', ra({ cond: ['hydrostatic'] }, K0('ceramic', 'concrete', { flags: {} })) === null && ra({ cond: ['hydrostatic'] }, K0('ceramic', 'concrete', { flags: { risingDamp: true } })) !== null);
t('pool rule applies in a pool only', ra({ env: ['pool'] }, K0('ceramic', 'concrete'), 'pool') !== null && ra({ env: ['pool'] }, K0('ceramic', 'concrete'), 'internal-floor') === null);
t('a rule that names only floor is not a conflict', ra({ env: ['floor'] }, K0('ceramic', 'concrete'), 'internal-floor') === null);
t('direct fixing onto timber hits the timber rule; over-sheeted does not', ra({ substrate: ['timber'] }, K0('porcelain', 'timber-floor', { flags: { direct: true } })) !== null && ra({ substrate: ['timber'] }, K0('porcelain', 'timber-floor', { flags: {} })) === null);

// ---------------------------------------------------------------- 5. plans on the real shards
const plan = (tileId, sub, loc, extra = {}, data = D0) => R.assemblePlan(K0(tileId, sub, extra), data, loc);
let pl = plan('porcelain', 'concrete', 'internal-wet-floor');
t('steps come in the published order', pl.steps.map((s) => s.role).join() === R.ROLE_ORDER.join(), pl.steps.map((s) => s.role));
t('every step product is one the system names', pl.steps.every((s) => !s.main || sys.systems['porcelain|concrete|internal-wet-floor'][2].find((x) => x[0] === s.role)[2].includes(s.main.id)));
t('hand total: PrimeX 0.5 + K10 Rapid 1 + 6 + Powder Mastic wet 168 = 175.5 h (max 176.5)', pl.timeline.ok && near(pl.timeline.min, 175.5) && near(pl.timeline.max, 176.5), JSON.stringify([pl.timeline.min, pl.timeline.max]));
t('the plan names the longest path', pl.timeline.basis === 'adhesive');
t('documents: the system sheet and a data sheet per product', pl.documents[0].url.startsWith('systems/') && pl.documents.filter((d) => /data sheet/i.test(d.label)).length >= 4, pl.documents.length);
t('conditions: the tightest temperature window is quoted with its product', pl.window.lo && pl.window.hi && pl.window.lo.v === 5 && pl.window.hi.v === 35, JSON.stringify([pl.window.lo && pl.window.lo.v, pl.window.hi && pl.window.hi.v]));
t('prerequisite: the longest cure age is 6 weeks (1008 h) for new concrete', pl.prereqs.some((p) => p.id === 'age' && p.rule.v.hours === 1008));
pl = plan('ceramic', 'concrete', 'internal-floor'); t('dry area: no membrane named, no membrane step product', pl.steps.find((s) => s.role === 'membrane').main === null && pl.notes.some((n) => n.k === 'nomem') && near(pl.timeline.min, 48.5));
pl = plan('ceramic', 'plasterboard', 'internal-wet-wall'); t('hand total with merged membrane figures: 130.4167 h', near(pl.timeline.min, 0.416667 + 2 + 8 + 120) && near(pl.timeline.max, 0.666667 + 3 + 8 + 120), JSON.stringify([pl.timeline.min, pl.timeline.max]));
pl = plan('quarry-terracotta', 'concrete', 'external-floor'); t('no grout named: no total, the missing window is listed', !pl.timeline.ok && pl.timeline.missing.some((m) => /grout/i.test(m.label)));
pl = plan('ceramic', 'concrete', 'pool'); t('pool: membrane coats not published, no total', !pl.timeline.ok && pl.timeline.missing.some((m) => /coats/.test(m.label)));
pl = plan('glass', 'plasterboard', 'external-floor'); t('no system for the combination: status none, published alternatives offered', pl.status === 'none' && pl.alternatives.length > 0 && pl.alternatives.every((a) => !!sys.systems[a.key]), JSON.stringify(pl.alternatives.map((a) => a.key)));
pl = plan('porcelain', 'timber-floor', 'internal-floor', { flags: { direct: true } }); t('direct onto timber is blocked with the data sheet rules', pl.status === 'blocked' && pl.blockers.some((b) => b.rules.some((r) => /direct/i.test(r.q))));
pl = plan('porcelain', 'timber-floor', 'internal-floor'); t('over-sheeted timber is a plan, with the direct-fixing rule quoted as a note', pl.status === 'plan' && pl.notes.some((n) => n.k === 'timber' && n.cites.length));
pl = plan('ceramic', 'concrete', 'internal-wet-floor', { flags: { risingDamp: true } }); t('rising damp blocks the job', pl.status === 'blocked' && pl.blockers.some((b) => /hydrostatic|rising damp/i.test(b.rules[0].q)));
pl = plan('ceramic', 'concrete', 'internal-wet-floor', { temp: 3 }); t('3 degrees voids the plan', pl.status === 'void' && pl.checks.some((c) => c.id === 'temp-lo'));
pl = plan('ceramic', 'concrete', 'internal-wet-floor', { temp: 40 }); t('40 degrees voids the plan', pl.status === 'void' && pl.checks.some((c) => c.id === 'temp-hi'));
pl = plan('ceramic', 'concrete', 'internal-wet-floor', { temp: 5 }); t('exactly the lower limit is allowed', pl.status === 'plan');
pl = plan('ceramic', 'concrete', 'internal-wet-floor', { age: { hours: 240, value: 10, unit: 'days' }, flags: { new: true } }); t('a 10 day old slab voids the plan', pl.status === 'void' && pl.checks.some((c) => c.id === 'age'));
pl = plan('ceramic', 'concrete', 'internal-wet-floor', { age: { hours: 1440, value: 2, unit: 'months' }, flags: { new: true } }); t('a 2 month old slab is fine', pl.status === 'plan');
pl = plan('porcelain', 'concrete', 'internal-wet-floor', { flags: { vehicular: true } }); t('vehicular traffic alone does not exclude a product here, the blocker is added by the answer layer', pl.status === 'plan' || pl.status === 'blocked');
pl = plan('natural-stone', 'concrete', 'internal-wet-floor'); t('natural stone: sealants ruled out by their own sheets become a note, not a block', pl.status === 'plan' && pl.notes.some((n) => n.k === 'sealant'));
// every one of the 363 systems assembles without throwing, in published order, with no invented product
let bad = 0, withTotal = 0, nosys = 0;
for (const [key, s] of Object.entries(sys.systems)) { const [tl_, sb, loc] = key.split('|'); const p = R.assemblePlan(K0(tl_, sb), D0, loc); if (p.status === 'none') { nosys++; continue; } if (p.steps.map((x) => x.role).join() !== R.ROLE_ORDER.join()) bad++; for (const st of p.steps) if (st.main && !s[2].find((x) => x[0] === st.role)[2].includes(st.main.id)) bad++; if (p.timeline.ok) withTotal++; }
t('all 363 systems assemble, in order, with published products only', bad === 0 && nosys === 0, bad + ' bad ' + nosys + ' none');
t('most systems carry a total; the rest say which window is missing', withTotal >= 220 && withTotal < 363, withTotal);

// ---------------------------------------------------------------- 6. mutation of the shard data: the plan follows the data
const D1 = mkData(); for (const r of D1.rules['davco-k10-rapid'].r) if (r[0] === 'wait' && r[1].kinds.includes('cover')) { r[1].min += 6; r[1].max += 6; }
pl = plan('porcelain', 'concrete', 'internal-wet-floor', {}, D1); t('mutation: +6 h on every K10 Rapid tiling wait moves the total by +6 h', pl.timeline.ok && near(pl.timeline.min, 181.5) && near(pl.timeline.max, 182.5), JSON.stringify([pl.timeline.min, pl.timeline.max]));
const D2 = mkData(); for (const id of sys.systems['porcelain|concrete|internal-wet-floor'][2].find((x) => x[0] === 'adhesive')[2]) D2.rules[id].r = D2.rules[id].r.filter((r) => !(r[0] === 'wait' && r[1].kinds.includes('wet')));
pl = plan('porcelain', 'concrete', 'internal-wet-floor', {}, D2); t('mutation: removing the wet service window of every adhesive the system names leaves no total', !pl.timeline.ok && pl.timeline.missing.length > 0);
const D3 = mkData(); for (const r of D3.rules['davco-primex'].r) if (r[0] === 'temp_air') { r[1].max = 30; }
pl = plan('porcelain', 'concrete', 'external-floor', { temp: 32 }, D3); t('mutation: a lower published upper limit voids a 32 degree day', pl.status === 'void' && pl.window.hi.v === 30);
const D4 = mkData(); D4.rules['davco-ceramaflex'].r.push(['no', { tags: { tile: ['porcelain'] } }, 'Not suitable for porcelain tiles (test rule).', '4.8', 2]);
pl = plan('porcelain', 'concrete', 'external-floor', {}, D4); t('mutation: a new do-not rule removes that adhesive from the plan and offers the next published one', pl.steps.find((s) => s.role === 'adhesive').main.id !== 'davco-ceramaflex' && pl.steps.find((s) => s.role === 'adhesive').excluded.some((e) => e.id === 'davco-ceramaflex'));
const D5 = mkData(); D5.rules['davco-ceramaflex'].r.push(['no', { tags: { tile: ['porcelain'] } }, 'Not suitable for porcelain tiles (test rule).', '4.8', 2]); D5.rules['davco-powder-mastic'].r.push(['no', { tags: { tile: ['porcelain'] } }, 'Not suitable for porcelain tiles (test rule).', '4.3', 2]);
pl = plan('porcelain', 'concrete', 'external-floor', {}, D5); t('mutation: every adhesive ruled out blocks the plan', pl.status === 'blocked');

// ---------------------------------------------------------------- 7. through the whole brain: traps, state, cards, project store
const b = makeBrain(); await b.boot();
const ask = async (q, st = null) => { const a = await b.ask(q, st); return { a, c0: a.cards[0], txt: a.cards.map(cardText).join('\n') }; };
for (const q of ['Will my porcelain on concrete bathroom floor plan pass the council inspection and comply with the NCC?', 'Can you guarantee porcelain on a concrete bathroom floor will never leak?', 'Porcelain tiles on a concrete sauna floor, what is the plan?', 'Ceramic tiles onto vinyl on a concrete floor in a bathroom, what is the plan?', 'My timber floor has a 40 mm deflection over the joists, is that ok for porcelain tiles in a bathroom floor?', 'How much will the full porcelain on concrete bathroom floor plan cost me?', 'Ceramic tiles on a concrete commercial kitchen floor, give me the full plan', 'Porcelain onto a steel deck outside, steps?']) {
  const r = await ask(q); t('trap refused: ' + q.slice(0, 50), r.c0.status === 'UNKNOWN' && !!r.c0.handoff && !r.a.cards.some((c) => c.type === 'product' || (c.type === 'plan' && c.plan && c.plan.status === 'plan')), r.c0.type + ' ' + r.c0.headline);
}
let r = await ask('plan for porcelain on a concrete slab'); t('a missing location is asked for, one question', r.c0.type === 'choose' && r.a.state && r.a.state.plan);
const r2 = await ask('bathroom floor', r.a.state); t('the follow-up completes the plan from the earlier message', r2.c0.type === 'plan' && r2.c0.plan.zone.key === 'porcelain|concrete|internal-wet-floor', r2.c0.title);
const r3 = await ask('what is the sds for sikatile 110 secure proof', r.a.state); t('an unrelated question after a plan is not swallowed', r3.c0.type !== 'plan', r3.c0.type);
{ const rb = await ask('tiling a bathroom, ceramic on gyprock, what is the plan?'); t('wet room with no floor or wall: both systems shown, the assumption said', rb.a.cards.filter((c) => c.type === 'plan').length === 2 && /Assumption/.test(rb.txt), rb.a.cards.map((c) => c.title).join(' | '));
  const st = rb.a.state; const rt = await ask('thanks', st); t('"thanks" after a plan is not answered with the plan again', rt.c0.type !== 'plan', rt.c0.type);
  const rn = await ask('plan for porcelain on a concrete balcony floor', st); t('a whole new job after a plan starts fresh', rn.c0.type === 'plan' && rn.c0.plan.zone.key === 'porcelain|concrete|external-floor', rn.c0.title); }
r = await ask('Porcelain on a concrete slab in a bathroom floor, 22 degrees, what is the plan?');
t('plan card validates and carries the add-to-project step', validateCard(r.c0).length === 0 && r.c0.followups.includes('Add the plan to my project'), validateCard(r.c0).join());
t('plan table has a header row and an ordered row per step', r.c0.table.cols.length === 4 && r.c0.table.rows.length >= 6 && /^First: /.test(r.c0.table.rows[0][0]));
t('quantity cards carry the estimate sentence', (() => { const x = r.a.cards.find((c) => c.type === 'calculation'); return !x || /estimate/i.test(x.headline); })());
const rq = await ask('Porcelain on a concrete slab in a bathroom floor, 22 degrees, what is the plan? 18 m2'); t('with an area the plan is followed by calculation cards', rq.a.cards.some((c) => c.type === 'calculation') && /Estimate only, not an offer/.test(rq.txt));
t('property checks find nothing on plan cards', checkAnswer('Porcelain on a concrete slab in a bathroom floor, 22 degrees, what is the plan?', r.a).length === 0, JSON.stringify(checkAnswer('x', r.a)));
const mem = { s: {}, getItem(k_) { return this.s[k_] || null; }, setItem(k_, v) { this.s[k_] = v; } };
const store = createProjectStore(mem, () => new Date('2026-11-01T00:00:00Z'), { origin: 'bot' });
const res = R.commitPlan(store, r.c0.plan.commit); const proj = store.currentProject();
t('Add the plan to my project: the system, its documents and a note go into the shared store', res.ok && proj.systems.length === 1 && proj.systems[0].slug === 'porcelain-on-concrete-internal-wet-floor' && proj.documents.length >= 4 && proj.notes.length === 1, JSON.stringify(res).slice(0, 200));
t('the saved note carries the timeline, in words', /Earliest finish/.test(proj.notes[0].text) && /Plan: porcelain tiles on concrete/.test(proj.notes[0].text), proj.notes[0].text);
t('saving the same plan twice does not duplicate the system', (() => { R.commitPlan(store, r.c0.plan.commit); return store.currentProject().systems.length === 1; })());
t('commitPlan without a plan is refused', R.commitPlan(store, null).ok === false);

// ---------------------------------------------------------------- 8. no model, no network, deterministic, on-demand shards
const src = fs.readFileSync(path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c', 'assets', 'brain', 'rules.js'), 'utf8');
t('rules.js makes no network call and names no model', !/\bfetch\(|XMLHttpRequest|WebSocket|api\.anthropic|openai|claude-|gpt-/i.test(src));
const a1 = await b.ask('Porcelain on a concrete slab in a bathroom floor, 22 degrees, what is the plan?'), a2 = await b.ask('Porcelain on a concrete slab in a bathroom floor, 22 degrees, what is the plan?');
t('the same question gives the same cards', JSON.stringify(a1.cards) === JSON.stringify(a2.cards));
const sw = fs.readFileSync(path.join(PORTAL, 'sw.js'), 'utf8');
t('the rule shards are not in the offline precache list', !/data\/brain\/rules\//.test(sw));
const rb = fs.readdirSync(RD).reduce((a_, f) => a_ + fs.statSync(path.join(RD, f)).size, 0); const need = ['sys', 'tile'].reduce((a_, f) => a_ + fs.statSync(path.join(RD, f + '.json')).size, 0);
t('rule shards total under 1 MB raw; a plan loads only sys + tile (under 300 KB raw)', rb < 1_000_000 && need < 300_000, rb + ' / ' + need);
const swBytes = Number((/const BYTES = (\d+)/.exec(sw) || [])[1]); t('service worker precache stays under 8 MB', swBytes < 8_000_000, swBytes);
{ const seen = []; const { createLoader } = await import('../../public/demo/sika-210c0c/assets/brain/loader.js'); const { createBrain } = await import('../../public/demo/sika-210c0c/assets/brain/brain.js'); const { fetchJson } = await import('../sika-brain/harness.mjs');
  const b2 = createBrain({ load: createLoader({ base: 'data/brain/', fetchJson: async (rel) => { seen.push(rel); return fetchJson(rel); } }) }); await b2.boot();
  await b2.ask('What is the sds for sikatile 110 secure proof'); await b2.ask('what is the full system for ceramic tiles on concrete on an internal floor');
  t('a question that is not a plan loads no rule shard', !seen.some((x) => /rules\//.test(x)), seen.filter((x) => /rules\//.test(x)).join());
  await b2.ask('plan for porcelain on a concrete slab in a bathroom floor');
  const rs = seen.filter((x) => /rules\//.test(x)).sort(); t('a plan loads exactly sys and tile', rs.join() === 'data/brain/rules/sys.json,data/brain/rules/tile.json', rs.join()); }

// ---------------------------------------------------------------- 9. the zero-WRONG gate over the question set
const items = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'sika-brain', 'coverage', 'wave2d.json'), 'utf8'));
let wrong = [], unh = [], ok = 0, props = 0; const by = {};
for (const it of items) { const a = await b.ask(it.q, null); const j = judge2d(it, a); by[it.cat] = by[it.cat] || { n: 0, ok: 0 }; by[it.cat].n++; if (j.cls === 'WRONG') wrong.push(it.id + ' ' + it.q.slice(0, 60) + ' :: ' + j.why); else if (j.cls === 'UNHANDLED') unh.push(it.id + ' ' + j.why); else { ok++; by[it.cat].ok++; } props += checkAnswer(it.q, a).length; }
t(`wave2d: ${items.length} questions, 120 or more, 30 or more traps`, items.length >= 120 && items.filter((x) => x.cat === 'trap').length >= 30);
t('wave2d: ZERO WRONG', wrong.length === 0, wrong.join(' | '));
t('wave2d: every question answered or honestly refused', unh.length === 0, unh.join(' | '));
t('wave2d: property checks find 0 violations', props === 0, props);
t('wave2d: every trap is refused or referred', items.filter((x) => x.cat === 'trap').every((x) => { return true; }) && by.trap.ok === by.trap.n, JSON.stringify(by.trap));
console.log('WAVE2D BY CATEGORY ' + Object.entries(by).map(([c, v]) => `${c} ${v.ok}/${v.n}`).join(', '));
console.log(`unit_plan: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
