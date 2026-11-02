// unit_missing.mjs: the MISSING pass (2026-11-02). Questions the published data CAN answer that the brain did not: "what is X used for" with filler, facts that sit in the
// pipe-separated Typical Product Data table, category list asks, timber and engineered stone systems, industry and project pages named by their own title, overcoat and pot life,
// role and symptom clarifiers, a product's own primer. Every block fails on base 2e8900c64. The guards at the end are the false positives found on the way and must stay false.
import { makeBrain } from './harness.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
let pass = 0, fail = 0; const t = (n, ok, d = '') => { if (ok) pass++; else { fail++; console.log('  FAIL: ' + n + (d ? ' :: ' + String(d).slice(0, 260) : '')); } };
const b = makeBrain(); const txt = (a) => a.cards.map(cardText).join('\n'); const first = (a) => a.cards[0];

// 1. "what is X used for" with a greeting or filler in front, and the bare "X use": the product card, not a compatibility refusal
for (const [q, id] of [['quick one whats sika boom g used for', 'sika-boom-g'], ['g day what is sikagard-62 used for mate', 'sikagard-62'], ['righto whats sikaforce-710 l100 used for', 'sikaforce-710-l100'], ['sikadur 30 use', 'sikadur-30']]) {
  const a = await b.ask(q, null); t(`used-for "${q}" gives the product card`, first(a).type === 'product' && first(a).product && first(a).product.id === id, first(a).type + ' ' + (first(a).product && first(a).product.id));
}
{ const a = await b.ask('can i use sikadur 30 over paint', null); t('a real compatibility question still goes to compatibility', first(a).type === 'compatibility', first(a).type); }

// 2. facts that live in the Typical Product Data table or under a label the lexicon lacked
for (const [q, rx] of [['shelf life of sikaflex-268 powercure', /9 months/], ['mix ratio for sikaforce-420 l105', /100 : 25/], ['what is the chemical base of sika floorjoint pb-30 pdrs', /carbon fibre/i],
  ['does sikalastic 1k bridge cracks', /0,50 mm/], ['insulation value of sika boom g', /0\.033/], ['whats the thermal codnuctivity of sika boom g', /0\.033/], ['shelf lyfe of davco k10 plus', /12 months/],
  ['quick one sag flow of sika anchorfix 3030', /Non-sag/]]) {
  const a = await b.ask(q, null); t(`attribute "${q}" quotes the published value`, first(a).type === 'info' && rx.test(txt(a)), first(a).type + ' ' + txt(a).slice(0, 120));
}
{ const a = await b.ask('shelf life of davco ultraflex', null); t('a shelf life the page does not give stays an honest unknown', first(a).type === 'unknown', first(a).type); }

// 3. category list asks: the products filed under the named category, in the category (typos and the parent word tolerated)
const catOf = async (a) => { const c = first(a); const names = new Set((c.links || []).map((l) => l.label)); return names; };
for (const [q, cat] of [['what sanitary sealants does sika have', 'construction/sealants-adhesives/sanitary-sealants'], ['list the saintary sealants products', 'construction/sealants-adhesives/sanitary-sealants'], ['what basement sheet membranes does sika have', 'construction/waterproofing/basement-sheet-membranes'],
  ['what precast concrete products does sika have', 'construction/concrete/pre-cast'], ['list the liquid roof membranes products', 'construction/roofing/liquid-applied-membranes'], ['what pvc sheet membranes for tunnels does sika have', 'construction/waterproofing/pvc-sheet-membranesfortunnelsandcrosspassages'],
  ['what sealant cleaners activators and primers does sika have', 'construction/sealants-adhesives/cleaners-activatorsprimers'], ['what floor joints does sika have', 'construction/flooring/floor-joints'], ['what sbsoil drainage does sika have', 'construction/landscape-buildingproducts/subsoil-drainage']]) {
  const a = await b.ask(q, null); const names = await catOf(a); const core = b.core(); const inCat = core.P.filter((p) => (p.c === cat || p.c.startsWith(cat + '/')) && names.has(p.n)).length;
  t(`category list "${q}" names 3+ products from ${cat}`, inCat >= Math.min(3, core.P.filter((p) => p.c === cat || p.c.startsWith(cat + '/')).length), `${first(a).type} ${first(a).title} in-category ${inCat}`);
}
{ const a = await b.ask('what waterproofing does sika sell for tiled areas', null); t('a list ask with a job on the end is not the plain category list', !/filed under/.test(first(a).headline || ''), first(a).headline); }

// 4. timber floor and engineered stone have system sheets
for (const [q, slug] of [['what goes under mosaic tiles on a timber floor on a shower floor inside', 'mosaic-on-timber-floor-internal-wet-floor'], ['tiling system for engineered stone over cement sheet on an internal wall', 'engineered-stone-on-cement-board-internal-wall'],
  ['engineered stone on brick on an outdoor floor what products', 'engineered-stone-on-masonry-external-floor'], ['what is the full system for ceramic tiles on a timber floor on an internal floor', 'ceramic-on-timber-floor-internal-floor']]) {
  const a = await b.ask(q, null); t(`system sheet "${q}"`, a.intent === 'system' && first(a).type !== 'unknown' && JSON.stringify(first(a)).includes(slug.split('-on-')[0].split('-')[0]), first(a).type + ' ' + first(a).title);
}

// 5. industry and project pages named by their own title; the dropped-letter typo
for (const [q, title] of [['dishwasher sealing', /Dishwasher/], ['elevator bonding and sealing', /Elevator/], ['coffs harbour bypass sika', /Coffs Harbour Bypass/], ['food grade flooring at kerry ingredients', /Kerry/], ['how do i rplace a balustrade', /replace a balustrade/i], ['where is the bim content', /BIM/]]) {
  const a = await b.ask(q, null); t(`page "${q}"`, first(a).type === 'info' && title.test(first(a).title), first(a).type + ' ' + first(a).title);
}
{ const a = await b.ask('i need to bond teak decking on a boat', null); t('a "i need" job ask still gets products, not the page', a.cards.some((c) => c.product) || /advice/.test(first(a).type), first(a).type + ' ' + first(a).title); }

// 6. overcoat and pot life
{ const a = await b.ask('how long to wait before overcoating sikafloor-359 au', null); t('overcoat wait is the published 4 hours', /4 h/.test(txt(a)) && /overcoat/i.test(txt(a)), txt(a).slice(0, 120)); }
{ const a = await b.ask('pot life of sikafloor multidur es-24', null); t('a pot life the data lacks is an honest unknown', first(a).type === 'unknown', first(a).type); }
{ const a = await b.ask('when can i recoat sikfaloor purcem hb-22', null); t('recoat with a structured time table keeps the table', first(a).type === 'time', first(a).type); }

// 7. clarifiers for a role and for a symptom
for (const q of ['i am an architect where do i start', 'im an applicator where do i start', 'tiles are coming off', 'my deck is rotting']) {
  const a = await b.ask(q, null); const c = first(a); const n = c.choices ? c.choices.length : (c.followups || []).length; t(`clarifier "${q}"`, c.type === 'choose' && n >= 2 && n <= 4, c.type + ' ' + n);
}

// 8. a product's own primer
{ const a = await b.ask('What primer for Sikafloor Level Pro?', null); t('primer for a named product is its own primer product', first(a).product && first(a).product.id === 'sikafloor-level-proprimer', first(a).product && first(a).product.id); }

// 9. the false positives found on the way
{ const a = await b.ask('sikaplast-82 scm impact what does it do', null); t('"impact" is not the MPa unit', first(a).type === 'product', first(a).type); }
{ const a = await b.ask('Tell me about Sika Mix', null); t('a product called Mix is not a mixing ratio ask', !/mixing ratio/i.test(txt(a)), txt(a).slice(0, 100)); }
{ const a = await b.ask('Tell me about Sikaflex-400 Fire', null); t('a product called Fire is not a fire-rating ask', first(a).type === 'product', first(a).type); }
{ const a = await b.ask('concerte repair mortar', null); t('a repair mortar ask is not swallowed by an article title', first(a).type === 'advice' || a.cards.some((c) => c.product), first(a).type + ' ' + first(a).title); }

console.log(`unit_missing: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
