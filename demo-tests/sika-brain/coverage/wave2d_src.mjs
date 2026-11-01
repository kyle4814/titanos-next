// wave2d_src.mjs: the lane D question set (rules, standards and multi-constraint reasoning). Writes wave2d.json next to this file.
//   node demo-tests/sika-brain/coverage/wave2d_src.mjs
// Every item is { id, q, type:'w2d', exp, note }. The expectation is NOT taken from the engine:
//   - the system, and the products each step may name, are read from the published system finder shard (data/brain/cat/...tile-stone-installationsystems.json);
//   - every quoted phrase in exp.has is checked here against the specification clauses (data/specs/*.json), so a typo in the expectation fails the build;
//   - every total in a timeline item is worked out below from ORACLE, a table typed from the data sheets by hand (clause and page in the comments), with its own
//     six-line scheduler. rules.js and rulex.mjs are never imported here.
// 30 items are traps: the right answer is a refusal or a referral.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.join(HERE, '..', '..', '..', 'public', 'demo', 'sika-210c0c');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(PORTAL, f), 'utf8'));
const cat = rd('data/brain/cat/construction__tile-stone-installationsystems.json');
const corpus = fs.readdirSync(path.join(PORTAL, 'data/specs')).filter((f) => f !== 'index.json').map((f) => fs.readFileSync(path.join(PORTAL, 'data/specs', f), 'utf8')).join('\n').replace(/\\n|\\"/g, ' ').replace(/\s+/g, ' ').toLowerCase();
const inCorpus = (s) => String(s).split(/ \| |; /).every((seg) => corpus.includes(seg.replace(/\s+/g, ' ').toLowerCase())); // table rows are stored cell by cell
const items = []; let seq = 0;
const add = (cat_, q, exp, note) => { items.push({ persona: 'tiler', category: 'rules', type: 'w2d', cat: cat_, q, exp, note, messy: '', split: 'tuned', id: 'd' + String(++seq).padStart(3, '0') }); };
const has = (...a) => { for (const s of a) if (!inCorpus(s)) throw new Error('quote not in the specification clauses: ' + s); return a; };

// ---------------------------------------------------------------- A. plans
const TW = { porcelain: ['porcelain tiles', 'porcelain'], ceramic: ['ceramic tiles'], mosaic: ['mosaic tiles'], glass: ['glass mosaic tiles', 'glass tiles'], 'natural-stone': ['natural stone tiles', 'travertine tiles', 'granite tiles'], 'large-format': ['large format tiles', '1200 x 600 porcelain tiles'], 'engineered-stone': ['engineered stone tiles'], 'quarry-terracotta': ['terracotta tiles', 'quarry tiles'] };
const SW = { concrete: ['a concrete slab', 'poured concrete'], 'screed-render': ['a cement screed', 'cement render'], masonry: ['rendered brick', 'blockwork'], 'cement-board': ['fibre cement sheet', 'villaboard'], plasterboard: ['plasterboard', 'gyprock'], 'timber-floor': ['an over-sheeted timber floor', 'particleboard flooring that has been over-sheeted'], 'existing-tiles': ['existing tiles', 'old tiles'], aac: ['AAC panels', 'hebel'] };
const LW = { 'internal-floor': ['a living room floor', 'a hallway floor'], 'internal-wall': ['an internal feature wall', 'a lounge wall'], 'internal-wet-floor': ['a bathroom floor', 'a shower floor', 'a laundry floor'], 'internal-wet-wall': ['a shower wall', 'bathroom walls'], 'external-floor': ['a balcony', 'an outdoor patio floor', 'a terrace'], 'external-wall': ['an external wall', 'an outdoor feature wall'], pool: ['a swimming pool', 'a spa'] };
const TPL = [
  (t, s, l) => `I'm tiling ${t} onto ${s} in ${l}. What's the plan, step by step?`,
  (t, s, l) => `What order do I do the work in for ${t} on ${s} in ${l}, and what products go in each step?`,
  (t, s, l) => `Walk me through ${t} on ${s} for ${l}: prep, waterproofing, adhesive, grout and sealing.`,
  (t, s, l) => `Need a method for ${l}: ${t} over ${s}. What are the steps?`,
  (t, s, l) => `Give me the full build up for ${t} fixed to ${s}, ${l}, 18 m2.`,
  (t, s, l) => `We are doing ${l} in ${t} on ${s}. What do I need to do before I start and in what sequence?`,
];
const PLANS = ['porcelain|concrete|internal-wet-floor', 'ceramic|plasterboard|internal-wet-wall', 'porcelain|concrete|external-floor', 'mosaic|screed-render|internal-wet-floor', 'glass|masonry|internal-wet-wall', 'natural-stone|concrete|internal-floor', 'large-format|cement-board|internal-floor', 'ceramic|aac|external-wall', 'ceramic|existing-tiles|internal-wet-floor', 'porcelain|timber-floor|internal-floor', 'quarry-terracotta|concrete|external-floor', 'engineered-stone|cement-board|internal-wet-floor', 'mosaic|concrete|external-wall', 'large-format|concrete|internal-wet-floor', 'glass|cement-board|internal-wet-wall', 'ceramic|concrete|pool', 'porcelain|screed-render|internal-wall', 'natural-stone|plasterboard|internal-wall', 'ceramic|masonry|external-wall', 'mosaic|aac|internal-wet-wall', 'porcelain|existing-tiles|internal-floor', 'glass|concrete|pool', 'large-format|screed-render|external-floor', 'ceramic|cement-board|internal-wet-wall', 'porcelain|aac|internal-wet-floor', 'quarry-terracotta|screed-render|internal-floor', 'engineered-stone|masonry|internal-wall', 'natural-stone|cement-board|external-floor', 'mosaic|timber-floor|internal-wet-floor', 'glass|screed-render|internal-floor', 'ceramic|plasterboard|internal-wall', 'large-format|masonry|external-wall', 'porcelain|masonry|internal-wet-floor', 'mosaic|existing-tiles|internal-wet-wall', 'ceramic|timber-floor|external-floor', 'natural-stone|aac|internal-wet-floor'];
const rolesOf = (key) => Object.fromEntries(cat.systems[key].steps.map((st) => [st.role, { stated: st.status === 'stated', ids: st.opt.map((o) => o.id) }]));
PLANS.forEach((key, i) => {
  const [t, s, l] = key.split('|'); const sys = cat.systems[key]; if (!sys) throw new Error('no system ' + key);
  const q = TPL[i % TPL.length](TW[t][i % TW[t].length], SW[s][(i >> 1) % SW[s].length], LW[l][i % LW[l].length]);
  add('plan', q, { mode: 'plan', key, slug: sys.slug, roles: rolesOf(key), calc: /18 m2/.test(q) }, `The published system ${sys.slug} (system finder shard). Each step product must be one the system names; links must open the system sheet and the data sheets.`);
});

// ---------------------------------------------------------------- B. rule questions (a named product, or the products of a system)
const R = (q, h, note, extra = {}) => add('rule', q, { mode: 'rule', has: has(...[].concat(h)), ...extra }, note);
R('How long must a new concrete slab cure before I apply Davco K10 Plus in a bathroom floor?', 'allowed to cure for 6 weeks', 'Davco K10 Plus data sheet clause 3.3 (substrate quality, concrete), page 2.');
R('Davco K10 Rapid on a new screed in a shower floor: what cure time does the data sheet give?', 'allowed to cure for 7 days', 'Davco K10 Rapid data sheet clause 3.3, page 2.');
R('Powder Mastic on a wood float concrete slab in a living room floor, what is the minimum cure age?', 'Cured minimum 6 weeks', 'Davco Powder Mastic data sheet clause 3.2 priming table, page 2.');
R('SikaTile-110 Secure Proof on a new concrete slab in a shower floor: how many days must it cure?', 'allowed to cure for 28 days', 'SikaTile-110 Secure Proof data sheet clause 3.3, page 2.');
R('What application temperature limits does Davco PrimeX give for priming an external concrete floor?', 'Do not use in temperatures below 5°C or above 35°C', 'Davco PrimeX data sheet clause 4.7, page 2.');
R('What temperature range can SikaSeal-190 N Silicone be applied in when sealing joints on a bathroom floor?', 'Maximum | +40°C; Minimum | +5°C', 'SikaSeal-190 N Silicone data sheet clause 2.9, page 2.');
R('SikaTile-410 Secure Set with large format 900 x 900 porcelain on a concrete floor: what flatness does the data sheet need?', 'even and true to 1.5mm in 600mm', 'SikaTile-410 Secure Set data sheet clause 3.2, page 3.');
R('How many coats of Davco K10 Plus on a balcony floor?', 'minimum 2 coat application', 'Davco K10 Plus data sheet clause 4.2, page 2.');
R('Davco K10 Rapid on a wet area floor: how long before I can tile over it?', ['at least 6 hours before tiling', '3-4 hours'], 'Davco K10 Rapid clauses 4.3 and 4.6: the sheet gives two figures; both are shown.');
R('Wet area floor with Davco Ceramaflex: how long before wet area service?', 'Set time before wet area service', 'Davco Ceramaflex data sheet clause 4.3, page 2: 7 days.');
R('Davco Ceramaflex mixing ratio for tiling a concrete floor', 'Mixing Ratio: 7-8 Litres clean potable water per 20kg bag', 'Davco Ceramaflex data sheet clause 4.2, page 2.');
R('SikaTile-111 Rapid Proof in a shower floor: how long between coats?', 'wait time to second coat', 'SikaTile-111 Rapid Proof data sheet clause 4.4, page 2: 2-2.5 hours.');
R('Is there a thickness limit for Davco Ceramaflex on a concrete floor?', 'Maximum layer shall be no greater than 10mm', 'Davco Ceramaflex data sheet clause 4.2, page 2.');
R('Davco Supamastic maximum layer thickness on a tiled wall', 'Layer thickness shall be no greater than 4mm', 'Davco Supamastic data sheet clause 4.2, page 1.');
R('What primer does Davco Powder Mastic need on rendered brick walls?', 'Prime with Davco PrimeX or Ultraprime', 'Davco Powder Mastic data sheet clause 3.2 priming table, page 2.');
R('Dew point rule for SikaSeal-190 N Silicone on external wall joints', 'must be +3°C above dew point', 'SikaSeal-190 N Silicone data sheet clause 2.10, page 2.');
R('Sikasil Pool temperature limits when sealing a swimming pool', '+5 °C min. / +40 °C max.', 'Sikasil Pool data sheet clause 5.2 (ambient air temperature), page 2.');
R('What do the SikaTile-110 Secure Proof sheets say about bond breakers on a bathroom floor?', 'bond breaker', 'SikaTile-110 Secure Proof data sheet clauses 3.9 and 3.10.');
R('Davco Easy Grout waiting time before wet area use on a bathroom floor', 'Dry time prior to return to wet area service', 'Davco Easy Grout data sheet clause 4.3, page 2: 3 days.');
R('SikaCeram-880 Easy Epoxy: how long before grouting a floor after tiling?', 'Waiting time before grouting on the floor', 'SikaCeram-880 Easy Epoxy data sheet clause 4.7, page 3: 16 hours.');
R('What cure age does a new concrete slab need before waterproofing and tiling porcelain on a bathroom floor?', 'allowed to cure for 6 weeks', 'Published system porcelain on concrete, internal wet area floor: Davco K10 Rapid clause 3.3.', { system: 'porcelain-on-concrete-internal-wet-floor' });
R('What temperature limits apply to the products in a porcelain on concrete external floor system?', 'Do not use in temperatures below 5°C or above 35°C', 'Published system porcelain on concrete, external floor: Davco PrimeX clause 4.7.', { system: 'porcelain-on-concrete-external-floor' });

// ---------------------------------------------------------------- C. standard references (quote the name exactly as the document writes it; never add one)
const S = (q, names, note, extra = {}) => add('standard', q, { mode: 'rule', has: has(...[].concat(names)), ...extra }, note);
S('Which standard does the Davco Ceramaflex data sheet name for laying tiles on a concrete floor?', 'AS3958.1', 'Davco Ceramaflex data sheet clause 4.6, page 3: "Application shall be in accordance with AS3958.1".');
S('What standards does the SikaTile-110 Secure Proof data sheet refer to for a bathroom floor membrane?', ['AS/NZS 4654:2012', 'AS 4858:2004'], 'SikaTile-110 Secure Proof data sheet clause 2.3, page 1.');
S('Davco K10 Plus data sheet: which standard is named for the waterproofing membrane under tiles in a shower floor?', 'AS/NZ 4654.1:2012', 'Davco K10 Plus data sheet (standards list), spelled "AS/NZ 4654.1:2012" in the document.');
S('Which standards are named for Schonox AB when waterproofing a balcony floor?', 'AS 4858:2004', 'Schonox AB data sheet clause 2.3.');
S('Davco Supamastic tiling a feature wall: which tile installation standard does it cite?', 'AS3958:2023', 'Davco Supamastic data sheet clause 4.5, page 2.');
S('SikaTile-350 Pro Maxset standard for installing tiles on a concrete floor', 'AS 3958:2023', 'SikaTile-350 Pro Maxset data sheet standards list.');
S('Davco Ultraprime on a concrete floor: which standard does it refer to for curing concrete?', 'AS1884', 'Davco Ultraprime data sheet clause 3.2, page 2: "fully cured and dry, in accordance with AS1884".');
S('SikaTile-305 Master Lite on a concrete floor: which standards are cited?', 'AS ISO 13007', 'SikaTile-305 Master Lite data sheet standards list.');
S('Does the Davco Sanitized Colorgrout data sheet cite a standard for grouting a bathroom floor?', 'AS ISO 13007.3', 'Davco Sanitized Colorgrout data sheet standards list.');
S('Which standard does the SikaTile-111 Rapid Proof sheet cite for a balcony membrane?', 'AS4654', 'SikaTile-111 Rapid Proof data sheet standards list.');
S('What standard does the Davco Powder Mastic data sheet name for tiling a living room floor?', 'AS ISO 13007.1', 'Davco Powder Mastic data sheet standards list.');
add('standard', 'Which standard does the Davco PrimeX data sheet cite for priming a concrete floor?', { mode: 'refuse', refuseText: 'not state|does not state|published specification' }, 'Davco PrimeX data sheet clause 2.2: "no approvals, certificates or standards section". No standard is added that the document does not cite.');

// ---------------------------------------------------------------- D. conflicts with the published rules
const C = (q, mode, h, note, extra = {}) => add('conflict', q, { mode, has: has(...[].concat(h)), ...extra }, note);
add('conflict', 'Can I tile porcelain directly onto a timber deck outside?', { mode: 'blocked', hasAny: has(...['Not suitable for fixing tiles directly onto timber floors', 'not suitable for applications for direct fixing over timber substrates', 'Not suitable for use for direct application over timber substrates']), alt: 'over-sheeted' }, 'Davco Ceramaflex data sheet clause 4.8, page 2, and Davco Trojan Mastic: direct fixing over timber is ruled out; the published timber system is for the over-sheeted floor.');
add('conflict', 'I want to fix ceramic tiles straight onto plywood flooring in a bathroom', { mode: 'blocked', hasAny: has(...['Not suitable for fixing tiles directly onto timber floors', 'not suitable for applications for direct fixing over timber substrates', 'Not suitable for use for direct application over timber substrates']), alt: 'over-sheeted' }, 'As above: ceramic on timber, internal wet floor.');
add('conflict', 'Tiling directly on particleboard floor in a laundry with porcelain, is that ok?', { mode: 'blocked', hasAny: has(...['Not suitable for fixing tiles directly onto timber floors', 'not suitable for applications for direct fixing over timber substrates', 'Not suitable for use for direct application over timber substrates']), alt: 'over-sheeted' }, 'Davco Trojan Mastic data sheet, page 2.');
add('conflict', 'Can I put mosaic tiles onto a timber balcony floor without an overlay?', { mode: 'blocked', hasAny: has(...['Not suitable for fixing tiles directly onto timber floors', 'not suitable for applications for direct fixing over timber substrates', 'Not suitable for use for direct application over timber substrates']), alt: 'over-sheeted' }, 'As above: mosaic on timber, external floor.');
C('Ceramic tiles on a concrete wall in a shower that has rising damp, can I waterproof and tile it?', 'blocked', 'Do not use where negative hydrostatic pressure is evident', 'Davco K10 Rapid / K10 Plus data sheets, clause 4.8 / 4.6: rising damp is a no-go.');
C('Our concrete slab has rising damp. Porcelain tiles on a bathroom floor, what is the plan?', 'blocked', 'Do not use where negative hydrostatic pressure is evident', 'As above.');
C('Large format tiles onto a brick wall with rising damp in an external wall, plan please', 'blocked', 'negative hydrostatic pressure', 'As above.');
C('Rising damp coming through the screed under a laundry floor, glass tiles. How do I do this?', 'blocked', 'rising damp', 'As above.');
C('Porcelain tiles on a concrete garage floor for cars, what is the plan?', 'blocked', 'vehicular traffic', 'SikaTile-350 Pro Maxset: not suitable for heavy duty applications such as vehicular traffic; SikaTile-110 Secure Proof: not a wearing surface for vehicular traffic.');
C('We want ceramic tiles on a concrete driveway that cars will drive on, steps please', 'blocked', 'vehicular traffic', 'As above.');
C('Forklift traffic on porcelain tiles over a concrete slab in a warehouse floor, can I get a plan?', 'blocked', 'vehicular traffic', 'As above.');
C('Heavy vehicle traffic on ceramic tiles fixed to a screed in an external floor, what system?', 'blocked', 'vehicular traffic', 'As above.');
C('Green marble tiles on a concrete shower floor, what is the plan?', 'blocked', 'moisture sensitive stone', 'Adhesive data sheets (SikaTile-410, SikaTile-305, Davco SMP EVO): not suitable for moisture sensitive stone; the published systems do not include it.');
C('Moisture sensitive stone on cement screed in a bathroom floor', 'blocked', 'moisture sensitive stone', 'As above.');
C('Resin backed moisture sensitive stone tiles on a plasterboard wall in a shower', 'blocked', 'moisture sensitive stone', 'As above.');
add('conflict', 'Porcelain on a concrete balcony floor, it is -2 degrees, can I start the plan today?', { mode: 'void', hasAny: has(...['Do not use in temperatures below 5°C or above 35°C', 'Do not apply in temperatures above 35°C or below 5°C', 'Do not use Davco Ultraprime below 5°C or above 35°C', 'Use in temperatures between 5°C and 35°C']), textHas: 'below the published lower limit' }, 'Davco PrimeX data sheet clause 4.7: lower limit 5 °C.');
add('conflict', 'Planning ceramic tiles on a cement screed in an external floor at 3 degrees, steps please', { mode: 'void', hasAny: has(...['Do not use in temperatures below 5°C or above 35°C', 'Do not apply in temperatures above 35°C or below 5°C', 'Do not use Davco Ultraprime below 5°C or above 35°C', 'Use in temperatures between 5°C and 35°C']), textHas: 'below the published lower limit' }, 'As above.');
add('conflict', 'Mosaic tiles on concrete in a balcony in a heatwave at 41 degrees, what is the plan?', { mode: 'void', hasAny: has(...['Do not use in temperatures below 5°C or above 35°C', 'Do not apply in temperatures above 35°C or below 5°C', 'Do not use Davco Ultraprime below 5°C or above 35°C', 'Use in temperatures between 5°C and 35°C']), textHas: 'above the published upper limit' }, 'As above: upper limit 35 °C.');
add('conflict', 'Quarry tiles on a concrete patio floor at 39 degrees, order of work?', { mode: 'void', hasAny: has(...['Do not use in temperatures below 5°C or above 35°C', 'Do not apply in temperatures above 35°C or below 5°C', 'Do not use Davco Ultraprime below 5°C or above 35°C', 'Use in temperatures between 5°C and 35°C']), textHas: 'above the published upper limit' }, 'As above.');
C('Tiling porcelain on a 10 day old concrete slab in a bathroom floor, what is the plan?', 'void', 'allowed to cure for 6 weeks', 'Davco K10 Rapid clause 3.3: new concrete cures 6 weeks; the slab is 10 days old.', { textHas: 'below the published minimum' });
C('The screed was laid 3 days ago, can I do ceramic tiles in a bathroom floor, what is the plan?', 'void', 'allowed to cure for 7 days', 'Davco K10 Rapid clause 3.3: screed cures 7 days; 3 days is too early.', { textHas: 'below the published minimum' });
add('conflict', 'Plan for glass tiles on plasterboard on an external floor', { mode: 'none', ours: ['no system'] }, 'The system finder has no glass on plasterboard external floor (glass-on-plasterboard has internal systems only); the answer is a referral that names the combination.');
C('Is the concrete slab still damp ok for porcelain on a bathroom floor? it is sweating, plan please', 'void', 'dry', 'Davco PrimeX data sheet clause 3.2: the surface must be dry.', { textHas: 'dry' });
C('Ceramic tiles on a concrete wall with condensation and damp patches, internal wet wall, steps', 'void', 'dry', 'As above.', { textHas: 'dry' });

// ---------------------------------------------------------------- E. timelines (hand oracle)
// ORACLE: hours, typed from the data sheets. [min, max]. Clause and page are in the comments.
const ORACLE = {
  prime: { 'davco-primex': [0.5, 0.5], /* 4.2 p2 ready for covering 30 minutes */ 'davco-ultraprime': [0.5, 0.5], /* 2.6 p2 Drying Time 30 Minutes */ 'sikatile-010-secureprime': [25 / 60, 40 / 60], /* 4.2 p2 25-40 minutes */ 'sikafloor-14-prepnprimeimpact': [50 / 60, 50 / 60] /* 4.4 p2 50min+ */ },
  membrane: {
    'davco-k10-plus': { coats: 2, coat: [1, 2], cover: [6, 8] }, /* 4.3 p2: 1-2 hours to the 2nd coat, 6-8 hours to tiling; 4.4: at least 6 hours */
    'davco-k10-rapid': { coats: 2, coat: [1, 2], cover: [6, 6] }, /* 4.6 p3: 1-2 hours, at least 6 hours; 4.3 says 3-4 hours: the longer governs */
    'sikatile-110-secureproof': { coats: 2, coat: [2, 3], cover: [8, 8] }, /* 4.3: 1-2 / 6-8; 4.5: 2-3 hours, at least 8 hours: longer governs */
    'sikatile-111-rapidproof': { coats: 2, coat: [2, 2.5], cover: [2.5, 3] }, /* 4.4: 2-2.5 hours, 2-3 hours; 4.7: 2.5-3 hours */
  },
  adhesive: {
    'davco-ceramacrete': { grout: [24, 24], dry: [24, 24], wet: [168, 168] }, 'davco-ceramaflex': { grout: [24, 24], dry: [24, 24], wet: [168, 168] }, 'davco-grey-one-potadhesive': { grout: [24, 24], dry: [24, 24], wet: [168, 168] },
    'davco-powder-mastic': { grout: [24, 24], dry: [24, 24], wet: [168, 168] }, 'davco-smp-evo': { grout: [24, 24], dry: [24, 24], wet: [48, 48], sub: [504, 504] }, 'davco-supamastic': { grout: [24, 24], dry: [48, 48], wet: [168, 168] },
    'davco-trojan-mastic': { grout: [24, 24], wet: [168, 168] }, 'sikatile-305-masterlite': { grout: [24, 24], wet: [120, 120], sub: [504, 504] }, 'sikatile-350-promaxset': { grout: [24, 24], dry: [48, 48], wet: [168, 168] },
    'sikatile-366-proflex': { grout: [24, 24] }, 'sikatile-400-evopro': { grout: [24, 24], dry: [24, 24], wet: [48, 48], sub: [504, 504] }, 'sikatile-405-lite': { grout: [24, 24], wet: [72, 72] },
    'sikatile-410-secureset': { grout: [24, 24], wet: [72, 72], sub: [504, 504] }, 'sikatile-440-opti-cure': { grout: [2, 4], wet: [24, 24] }, 'sikatile-510-megalite': { grout: [24, 24], wet: [72, 72], sub: [504, 504] }, 'davco-ultraflex': {},
  },
  grout: {
    'davco-easy-grout': { dry: [24, 24], wet: [72, 72] }, 'davco-sanitized-colorgrout': { dry: [24, 24], wet: [120, 120], sub: [504, 504] }, 'davco-superfine-whitegrout': { dry: [24, 24] }, 'sikaceram-690-elite': {},
    'sikaceram-880-easyepoxy': { wet: [72, 168], ownWall: [4, 4], ownFloor: [16, 16] },
  },
};
const cls = (loc) => (loc === 'pool' ? 'sub' : /wet|external/.test(loc) ? 'wet' : 'dry');
/** the oracle's own scheduler. Returns { products, min, max } or { products, none:'why' } */
function oracle(key) {
  const [t, s, loc] = key.split('|'); const R_ = rolesOf(key); const c = cls(loc); const axis = /wall$/.test(loc) ? 'Wall' : 'Floor'; const pick = {};
  const complete = { prime: (id) => !!ORACLE.prime[id], membrane: (id) => ORACLE.membrane[id], adhesive: (id) => ORACLE.adhesive[id] && ORACLE.adhesive[id].grout && ORACLE.adhesive[id][c], grout: (id) => ORACLE.grout[id] && ORACLE.grout[id][c] };
  for (const role of ['prime', 'membrane', 'adhesive', 'grout']) { const r = R_[role]; if (!r || !r.ids.length) { pick[role] = null; continue; } pick[role] = r.ids.find((id) => complete[role](id)) || r.ids[0]; }
  let min = 0, max = 0; const miss = [];
  if (pick.prime) { const w = ORACLE.prime[pick.prime]; if (w) { min += w[0]; max += w[1]; } else miss.push('prime'); }
  if (pick.membrane) { const m = ORACLE.membrane[pick.membrane]; if (m) { min += m.coat[0] * (m.coats - 1) + m.cover[0]; max += m.coat[1] * (m.coats - 1) + m.cover[1]; } else miss.push('membrane'); }
  const a = ORACLE.adhesive[pick.adhesive] || {}; const g = ORACLE.grout[pick.grout] || {};
  if (!R_.grout.ids.length) miss.push('grout none');
  if (!a.grout || !a[c] || !g[c]) miss.push('adhesive or grout window');
  if (!miss.length) {
    const own = g['own' + axis] || [0, 0]; const gw = [Math.max(a.grout[0], own[0]), Math.max(a.grout[1], own[1])];
    min += Math.max(a[c][0], gw[0] + g[c][0]); max += Math.max(a[c][1], gw[1] + g[c][1]);
  }
  return { products: pick, miss, min, max };
}
const TL_KEYS = ['porcelain|concrete|internal-wet-floor', 'ceramic|concrete|internal-floor', 'ceramic|plasterboard|internal-wet-wall', 'large-format|cement-board|internal-floor', 'mosaic|screed-render|internal-wet-floor', 'glass|masonry|internal-wet-wall', 'ceramic|aac|external-wall', 'ceramic|existing-tiles|internal-wet-floor', 'porcelain|timber-floor|internal-floor', 'mosaic|concrete|external-wall', 'porcelain|concrete|external-floor', 'glass|cement-board|internal-wet-wall', 'natural-stone|concrete|internal-floor', 'large-format|concrete|internal-wet-floor'];
const TLQ = [
  (t, s, l) => `How long until I can use ${l} after tiling ${t} on ${s}, adding up every waiting time in the data sheets?`,
  (t, s, l) => `What is the earliest finish for ${t} on ${s} in ${l}, start to finish?`,
  (t, s, l) => `Give me the total timeline for ${t} onto ${s} in ${l}: primer, membrane, adhesive, grout.`,
];
TL_KEYS.forEach((key, i) => {
  const [t, s, l] = key.split('|'); const o = oracle(key); if (o.miss.length) throw new Error('oracle cannot total ' + key + ': ' + o.miss);
  const q = TLQ[i % 3](TW[t][0], SW[s][0], LW[l][0]);
  add('timeline', q, { mode: 'plan', key, slug: cat.systems[key].slug, totalMin: Math.round(o.min * 1e4) / 1e4, totalMax: Math.round(o.max * 1e4) / 1e4, products: o.products }, `Oracle (hand table from the data sheets): ${JSON.stringify(o.products)} total ${o.min} to ${o.max} hours.`);
});
// systems where a window is missing: no total
for (const key of ['quarry-terracotta|concrete|external-floor', 'ceramic|concrete|pool']) {
  const [t, s, l] = key.split('|'); const o = oracle(key);
  add('timeline', `What is the total time from start to finish for ${TW[t][0]} on ${SW[s][0]} in ${LW[l][0]}?`, { mode: 'plan', key, slug: cat.systems[key].slug, noTotal: true }, `A window is not published (${o.miss.join(', ') || 'membrane coats for the sheet membrane'}): the answer must say so and show no total.`);
}
// time budgets, all on porcelain on concrete, internal wet floor (oracle 175.5 to 176.5 hours)
const budgetQ = (txt, verdict, hrs) => add('timeline', txt, { mode: 'plan', key: 'porcelain|concrete|internal-wet-floor', slug: 'porcelain-on-concrete-internal-wet-floor', totalMin: 175.5, totalMax: 176.5, budget: verdict, budgetHours: hrs }, `Total 175.5 to 176.5 hours against ${hrs} hours: ${verdict}.`);
budgetQ('I only have 3 days to tile porcelain on a concrete slab in a bathroom floor, waterproofing included. Does the plan fit?', 'over', 72);
budgetQ('Porcelain on a concrete slab in a bathroom floor: can we finish within 5 days?', 'over', 120);
budgetQ('We have 10 days. Porcelain tiles on a poured slab in a bathroom floor, what is the plan and does it fit?', 'fits', 240);
budgetQ('Porcelain on concrete in a shower floor, we can wait 176 hours, how does the plan look?', 'maybe', 176);

// ---------------------------------------------------------------- F. site conditions and prerequisites
const D = (q, mode, h, note, extra = {}) => add('conditions', q, { mode, has: has(...[].concat(h)), ...extra }, note);
add('conditions', 'Ceramic tiles on a cement render in an internal wet wall at 2 degrees, plan?', { mode: 'void', hasAny: has(...['Do not use in temperatures below 5°C or above 35°C', 'Do not apply in temperatures above 35°C or below 5°C', 'Do not use Davco Ultraprime below 5°C or above 35°C', 'Use in temperatures between 5°C and 35°C']), textHas: 'below the published lower limit' }, 'Davco PrimeX / Ultraprime lower limit 5 °C.');
add('conditions', 'Porcelain on concrete in a bathroom floor, today is 37 degrees, steps please', { mode: 'void', hasAny: has(...['Do not use in temperatures below 5°C or above 35°C', 'Do not apply in temperatures above 35°C or below 5°C', 'Do not use Davco Ultraprime below 5°C or above 35°C', 'Use in temperatures between 5°C and 35°C']), textHas: 'above the published upper limit' }, 'Upper limit 35 °C.');
add('conditions', 'Mosaic on plasterboard in a shower wall at -4 degrees', { mode: 'void', hasAny: has(...['Do not use in temperatures below 5°C or above 35°C', 'Do not apply in temperatures above 35°C or below 5°C', 'Do not use Davco Ultraprime below 5°C or above 35°C', 'Use in temperatures between 5°C and 35°C']), textHas: 'below the published lower limit' }, 'SikaTile-305 Master Lite clause 4.8: lower limit 5 °C.');
add('conditions', 'Large format porcelain on a concrete slab in an external floor at 36 degrees, plan?', { mode: 'void', hasAny: has(...['Do not use in temperatures below 5°C or above 35°C', 'Do not apply in temperatures above 35°C or below 5°C', 'Do not use Davco Ultraprime below 5°C or above 35°C', 'Use in temperatures between 5°C and 35°C']), textHas: 'above the published upper limit' }, 'Upper limit 35 °C.');
D('Ceramic tiles on fibre cement sheet in a bathroom wall, 22 degrees and dry, what is the plan?', 'plan', 'ready for covering: 30 minutes', 'In range: no check fails (Davco PrimeX clause 4.2, 22 °C).', {});
D('Natural stone on concrete in an internal floor on a 28 degree day, plan', 'plan', 'Applied product ready for covering', 'In range.', {});
D('Porcelain on a concrete slab poured 3 weeks ago, bathroom floor: plan?', 'void', 'allowed to cure for 6 weeks', 'Davco K10 Rapid: 6 weeks; 3 weeks is too early.', { textHas: 'below the published minimum' });
D('Ceramic tiles on a 2 month old concrete slab in a bathroom floor, plan', 'plan', 'allowed to cure for 6 weeks', 'Davco K10 Rapid: 6 weeks; 2 months (1440 hours) is enough.', {});
D('Porcelain on a screed that is 5 days old in a laundry floor, steps?', 'void', 'allowed to cure for 7 days', 'Davco K10 Rapid: screed 7 days.', { textHas: 'below the published minimum' });
D('Plan for tiles on a slab that has been poured 8 weeks, ceramic, on an external floor', 'plan', 'allowed to cure for 6 weeks', 'Davco K10 Rapid.', {});
D('What do I need to know about primed concrete before tiling a porcelain external floor, do I have a time limit?', 'plan', 'within 24 hours', 'Davco PrimeX data sheet clause 4.5: coat within 24 hours or re-clean and re-prime.', {});
D('Mosaic on concrete floor in a bathroom, what substrate conditions void the plan?', 'plan', 'Do not use in temperatures below 5°C or above 35°C', 'The plan lists the conditions that void it.', {});
D('Porcelain on concrete balcony floor, 5 degrees tonight and 80% humidity, what is the plan?', 'plan', 'Do not use in temperatures below 5°C or above 35°C', '5 °C equals the lower limit, so it is not below it. No humidity limit is published for these products, so none is invented.', {});
D('Ceramic tiles on masonry in an external wall, plan, freezing overnight', 'plan', 'Do not allow the product to freeze', 'Davco PrimeX clause 4.7 / K10 data sheets: do not allow the product to freeze.', {});
D('Tiling on a damp rendered wall, ceramic, internal wet wall: what is the plan?', 'void', 'dry', 'Davco PrimeX clause 3.2: surface must be dry.', { textHas: 'dry' });
D('Glass mosaic on concrete in a bathroom floor, hot windy day, what is the plan?', 'plan', 'hot windy', 'Davco PrimeX clause 4.7: do not use in hot windy conditions without pre-wetting.', {});

// ---------------------------------------------------------------- G. traps: the right answer is a refusal or a referral
const T = (q, why, note) => add('trap', q, { mode: 'refuse', why }, note);
T('Will my porcelain on concrete bathroom floor plan pass the council inspection and comply with the NCC?', 'comply', 'Compliance is the certifier\'s decision, not a data sheet statement.');
T('Is the SikaTile-110 Secure Proof system for a shower floor compliant with the building code, so I can sign it off?', 'comply', 'As above.');
T('Does laying ceramic tiles on a concrete balcony floor with these products meet the code and get certified?', 'comply', 'As above.');
T('Can you confirm my waterproofing of a ceramic shower wall on plasterboard is legal and covered by insurance?', 'comply', 'Legal and insurance questions are outside the documentation.');
T('Are porcelain tiles on a concrete external floor liable to fail an engineer\'s certificate?', 'comply', 'As above.');
T('Is a licensed waterproofer required for ceramic tiles on a concrete bathroom floor, legally?', 'comply', 'Licensing is not in the data sheets.');
T('Can you guarantee porcelain on a concrete bathroom floor will never leak if I follow your plan?', 'guarantee', 'No guarantee can be given from published data.');
T('Promise me this ceramic on plasterboard shower wall plan will definitely work for ten years', 'guarantee', 'As above.');
T('Is it 100% certain that mosaic on a concrete pool will last if I follow every step?', 'guarantee', 'As above.');
T('Will a ceramic tile on a cement render external wall plan last for a lifetime?', 'guarantee', 'As above.');
T('My timber floor has a 40 mm deflection over the joists, is that ok for porcelain tiles in a bathroom floor?', 'struct', 'Structural adequacy is for an engineer.');
T('There is asbestos in the old adhesive under my existing tiles in the bathroom floor, how do I tile over it?', 'struct', 'Hazardous materials are outside the product documentation.');
T('The slab is sagging and the joists are rotten under my timber floor, can I still tile porcelain on the bathroom floor?', 'struct', 'Structural condition is for an engineer.');
T('Our concrete slab has settlement cracks 8 mm wide in the garage, what tile plan fixes that structurally?', 'struct', 'Structural repair is outside the tile system data.');
T('Porcelain tiles on a concrete sauna floor, what is the plan?', 'offtopic', 'Saunas are not covered by the published system data.');
T('Ceramic tiles on a concrete commercial kitchen floor, give me the full plan', 'offtopic', 'Commercial kitchens are not covered by the published system data.');
T('Tiles on a concrete freezer room floor, what steps do I follow?', 'offtopic', 'Freezer rooms are not covered.');
T('Mosaic tiles on a steam room wall, plan for plasterboard?', 'offtopic', 'Steam rooms are not covered.');
T('Ceramic tiles around a fireplace hearth on a concrete floor, what is the plan?', 'offtopic', 'Heat exposure is not covered.');
T('Porcelain tiles in a kiln room on a concrete floor, plan please', 'offtopic', 'Kilns are not covered.');
T('Ceramic tiles onto vinyl on a concrete floor in a bathroom, what is the plan?', 'unsupported', 'Vinyl is not a substrate in the published systems.');
T('Porcelain tiles onto a steel deck on an external floor, steps?', 'unsupported', 'Steel is not a substrate in the published systems.');
T('Can I tile porcelain over old asphalt on an external floor, what are the steps?', 'unsupported', 'Asphalt is not a substrate in the published systems.');
T('Tiling ceramic onto laminate flooring in a bathroom floor, plan?', 'unsupported', 'Laminate is not a substrate in the published systems.');
T('Mosaic tiles onto a metal roof sheet outside, what is the plan?', 'unsupported', 'Metal is not a substrate in the published systems.');
T('Ceramic tiles over carpet on a floor in a living room, order of work?', 'unsupported', 'Carpet is not a substrate in the published systems.');
T('How much will the full porcelain on concrete bathroom floor plan cost me in materials and labour?', 'price', 'Prices are not in the documentation.');
T('What does a tiler charge for porcelain on a concrete balcony floor?', 'price', 'As above.');
T('What warranty do I get on a ceramic on concrete internal wet floor plan?', 'price', 'Warranty terms are not in the documentation.');
T('Is Mapei better than Davco for porcelain on concrete in a bathroom floor?', 'brand', 'Other brands are out of scope.');

// ---------------------------------------------------------------- H. the blind set: written after the engine was tuned on A to G, in new wording, and run ONCE before any further fix
const BL = (c, q, exp, note) => { add(c, q, exp, note); items[items.length - 1].split = 'blind'; };
const plan_ = (q, key) => BL('plan', q, { mode: 'plan', key, slug: cat.systems[key].slug, roles: rolesOf(key) }, `The published system ${cat.systems[key].slug}.`);
plan_('Doing a splashback and shower walls in 300x600 ceramic over gyprock, how should I sequence it?', 'ceramic|plasterboard|internal-wet-wall');
plan_('Outdoor entertaining area, concrete slab, 600x600 porcelain pavers, what is the method?', 'porcelain|concrete|external-floor');
plan_('Retiling over my old tiles in the kitchen floor with porcelain, what needs to happen first?', 'porcelain|existing-tiles|internal-floor');
plan_('Feature wall inside, hebel panels, glass mosaic. Steps?', 'glass|aac|internal-wall');
plan_('Pool tiling job: glass mosaic into a concrete pool shell, order of work please', 'glass|concrete|pool');
plan_('Tiling a laundry floor in large format 1200x600 over a screed. Plan?', 'large-format|screed-render|internal-wet-floor');
plan_('Balcony renovation: villaboard base, terracotta tiles, need the build-up', 'quarry-terracotta|cement-board|external-floor');
plan_('How do I tile natural stone onto a plasterboard wall in a bathroom?', 'natural-stone|plasterboard|internal-wet-wall');
plan_('Sequence for ceramic wall tiles on blockwork outside', 'ceramic|masonry|external-wall');
plan_('Engineered stone on screed in the hallway, step plan?', 'engineered-stone|screed-render|internal-floor');
const BR = (c, q, h, note, extra = {}) => BL(c, q, { mode: 'rule', has: has(...[].concat(h)), ...extra }, note);
BR('rule', 'Does Sika say how many coats of SikaTile-111 Rapid Proof on a shower wall?', 'minimum 2 coat application', 'SikaTile-111 Rapid Proof data sheet clause 4.7, page 3.');
BR('rule', 'Cure time for a new screed before SikaTile-110 membrane on a bathroom floor?', 'allow to cure for 5-7', 'SikaTile-110 Secure Proof data sheet clause 3.4, page 2: the sheet gives "5-7" with no unit, so no hours are worked out. (First draft assumed 7 days; corrected from the data sheet after the first run.)');
BR('standard', 'Which standards does the SikaTile-410 Secure Set sheet reference, for a balcony floor job?', 'AS ISO 13007', 'SikaTile-410 Secure Set data sheet standards list.');
BR('rule', 'Davco PrimeX: how soon must it be covered once applied to an external concrete floor?', 'within 24 hours', 'Davco PrimeX data sheet clause 4.5, page 2.');
BR('rule', 'Allowed temperature window for SikaTile-305 Master Lite on a patio floor?', 'Do not apply in temperatures above 35°C or below 5°C', 'SikaTile-305 Master Lite data sheet clause 4.8, page 2.');
BR('rule', 'Dew point and substrate temperature for Sikasil Pool around a swimming pool', 'above dew point', 'Sikasil Pool data sheet clause 5.3.');
BR('rule', 'Large format porcelain on a concrete floor, how flat does the substrate have to be per SikaTile-410?', 'even and true to 1.5mm in 600mm', 'SikaTile-410 Secure Set data sheet clause 3.2.');
BL('conflict', 'Is it okay to tile straight onto a timber balcony floor with ceramic tiles?', { mode: 'blocked', hasAny: has('Not suitable for fixing tiles directly onto timber floors', 'not suitable for applications for direct fixing over timber substrates', 'Not suitable for use for direct application over timber substrates'), alt: 'over-sheeted' }, 'Direct fixing onto timber is ruled out by the adhesive data sheets.');
BL('conflict', 'Slab has rising damp coming up, porcelain tiles in the laundry floor, what do you recommend?', { mode: 'blocked', has: has('negative hydrostatic pressure') }, 'Davco K10 data sheets: do not use where negative hydrostatic pressure (rising damp) is evident.');
BL('conditions', 'Hot day, 43 degrees, retiling a balcony floor in porcelain over concrete, go ahead?', { mode: 'void', hasAny: has('Do not use in temperatures below 5°C or above 35°C', 'Do not apply in temperatures above 35°C or below 5°C'), textHas: 'above the published upper limit' }, 'Upper limit 35 °C.');
BL('conditions', 'Concrete poured 9 days ago, shower floor in ceramic, steps?', { mode: 'void', has: has('allowed to cure for 6 weeks'), textHas: 'below the published minimum' }, 'Davco K10 Rapid: 6 weeks.');
{ const key = 'ceramic|plasterboard|internal-wet-wall'; const o = oracle(key); BL('timeline', 'How long all up for ceramic tiles on gyprock in a bathroom wall?', { mode: 'plan', key, slug: cat.systems[key].slug, totalMin: Math.round(o.min * 1e4) / 1e4, totalMax: Math.round(o.max * 1e4) / 1e4 }, 'Oracle total.'); }
{ const key = 'mosaic|screed-render|internal-wet-floor'; const o = oracle(key); BL('timeline', 'We have 4 days. Mosaic on a screed for a shower floor, can it be done?', { mode: 'plan', key, slug: cat.systems[key].slug, totalMin: Math.round(o.min * 1e4) / 1e4, totalMax: Math.round(o.max * 1e4) / 1e4, budget: 'over', budgetHours: 96 }, 'Oracle total against 96 hours.'); }
{ const key = 'natural-stone|concrete|internal-floor'; const o = oracle(key); BL('timeline', 'Total time for natural stone on concrete in a lounge room floor?', { mode: 'plan', key, slug: cat.systems[key].slug, totalMin: Math.round(o.min * 1e4) / 1e4, totalMax: Math.round(o.max * 1e4) / 1e4 }, 'Oracle total.'); }
BL('conditions', 'Minus 6 degrees overnight, glass tiles on hebel external wall: plan?', { mode: 'void', hasAny: has('Do not use in temperatures below 5°C or above 35°C', 'Do not apply in temperatures above 35°C or below 5°C', 'Do not use Davco Ultraprime below 5°C or above 35°C', 'Use in temperatures between 5°C and 35°C', 'Maximum | +25 °C; Minimum | +10 °C'), textHas: 'below the published lower limit' }, 'Lower limit: the tightest is SikaCeram-880 Easy Epoxy substrate minimum +10 °C (the first draft expected the 5 °C wording; corrected after the first run).');
BL('trap', 'Can I tile a ceramic wall inside a sauna?', { mode: 'refuse', why: 'offtopic' }, 'Saunas are not covered.');
BL('trap', 'Will you sign off that my porcelain balcony floor on concrete is up to code?', { mode: 'refuse', why: 'comply' }, 'Compliance is not a data sheet statement.');
BL('trap', 'Whats the cost of tiling porcelain on a concrete slab bathroom floor in labour?', { mode: 'refuse', why: 'price' }, 'Prices are not published.');
BL('trap', 'Ceramic tiles onto a vinyl floor in the laundry: how?', { mode: 'refuse', why: 'unsupported' }, 'Vinyl is not a published substrate.');
BL('trap', 'How strong does the joist need to be for porcelain on a timber bathroom floor?', { mode: 'refuse', why: 'struct' }, 'Structural advice is for an engineer.');
BL('trap', 'Ensure me that porcelain on a concrete balcony floor will never crack', { mode: 'refuse', why: 'guarantee' }, 'No guarantee.');

const out = path.join(HERE, 'wave2d.json');
fs.writeFileSync(out, JSON.stringify(items, null, 1));
const by = {}; for (const i of items) by[i.cat] = (by[i.cat] || 0) + 1;
console.log('wave2d.json', items.length, JSON.stringify(by));
