// conv_src.mjs: generates conversations.json (scripted multi-turn tests). Expectations are written by hand from the product data, never copied from an answer.
// Turn: { q, expect: { type?, prod?, rec?, noUnknown?, has?, chip?, calc?, noProductCard? } }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = (q, expect = {}) => ({ q, expect });
const convs = [];
const add = (id, group, ...turns) => convs.push({ id, group, turns });

// ---- recommend one, after every card type (Kyle 2026-11-01). Each starter x each phrasing is its own conversation of two turns.
const PHRASES = ['recommend me one', 'reccomend me one', 'pick one for me', 'you choose', "whatever's best", 'just tell me', 'which one would you use?', 'Recommend one for me', 'suggest one', 'surprise me'];
const STARTERS = [
  ['clarifier-quantity', 'How much adhesive do I need for 40 m2 of floor tiles?', { type: 'choose' }, { type: 'rate' }],
  ['clarifier-quantity-screed', 'how much leveller for 30 m2', { type: 'advice' }, { rec: true }],
  ['range-list', 'best tile adhesive for porcelain tiles on a concrete floor inside', { type: 'product' }, { rec: true }],
  ['compare', 'compare davco k10 plus and sikalastic 1k', { type: 'comparison' }, { rec: true }],
  ['document', 'sds for davco k10 plus', { type: 'document' }, { rec: true }],
  ['rate', 'coverage of sikatile 410 secureset', { type: 'rate' }, { rec: true }],
  ['time', 'how long does sikafloor level pro take to cure', { type: 'time' }, { rec: true }],
  ['attr', 'shelf life of davco grey one pot', { has: '12 months' }, { rec: true }],
  ['advice', 'best sealant for a window', { type: 'advice' }, { rec: true }],
  ['system', 'tiling system porcelain on concrete floor inside', { type: 'system' }, { rec: true }],
];
let k = 0;
for (const [name, q, e1, e2] of STARTERS) for (const ph of PHRASES) { if (name === 'system' && ph !== PHRASES[0] && ph !== PHRASES[7]) continue; k++; add('rec-' + name + '-' + k, 'recommend', T(q, e1), T(ph, { ...e2, noUnknown: true })); }

// ---- follow-ups after an attribute, time, business, comparison and quantity answer
add('fu-doc-after-attr', 'followup', T('shelf life of sikafloor level pro', { prod: 'sikafloor-level-pro' }), T('and the SDS?', { type: 'document', prod: 'sikafloor-level-pro' }));
add('fu-pot-after-doc', 'followup', T('data sheet for davco k10 plus', { prod: 'davco-k10-plus' }), T('what about its pot life?', { prod: 'davco-k10-plus' }));
add('fu-area-after-calc', 'followup', T('how much sikafloor level pro for 10 m2', { prod: 'sikafloor-level-pro', qty: true }), T('same for 20 m2', { prod: 'sikafloor-level-pro', qty: true }));
add('fu-area-after-product', 'followup', T('tell me about davco k10 plus', { prod: 'davco-k10-plus' }), T('and for 30 m2?', { prod: 'davco-k10-plus', qty: true }));
add('fu-area-after-time', 'followup', T('how long does sikafloor level pro take to cure', { prod: 'sikafloor-level-pro' }), T('what about 25 m2', { prod: 'sikafloor-level-pro', qty: true }));
add('fu-second-after-compare', 'followup', T('compare davco k10 plus and sikalastic 1k', { type: 'comparison' }), T('the second one', { prod: 'sikalastic-1k' }));
add('fu-first-after-compare', 'followup', T('compare davco k10 plus and sikalastic 1k', { type: 'comparison' }), T('the first one', { prod: 'davco-k10-plus' }));
add('fu-second-then-sds', 'followup', T('compare davco k10 plus and sikalastic 1k', { type: 'comparison' }), T('the second one', { prod: 'sikalastic-1k' }), T('and the sds?', { type: 'document', prod: 'sikalastic-1k' }));
add('fu-second-after-advice', 'followup', T('best screed for 100 m2 at 5 mm', { type: 'advice' }), T('the second one', { prod: 'sikafloor-level-top' }));
add('fu-third-after-advice', 'followup', T('best screed for 100 m2 at 5 mm', { type: 'advice' }), T('the third one', { prod: 'sikafloor-level-ultra' }));
add('fu-pack-after-product', 'followup', T('tell me about sikatile 410 secureset', { prod: 'sikatile-410-secureset' }), T('in a bag?', { prod: 'sikatile-410-secureset' }));
add('fu-pail-after-product', 'followup', T('tell me about davco grey one pot', { prod: 'davco-grey-one-potadhesive' }), T('in a pail?', { prod: 'davco-grey-one-potadhesive' }));
add('fu-sds-after-product', 'followup', T('tell me about lanko 173 floor leveller', { prod: 'lanko-173-floor-leveller' }), T('and the SDS?', { type: 'document', prod: 'lanko-173-floor-leveller' }));
add('fu-coverage-after-product', 'followup', T('tell me about sikatile 400 evopro', { prod: 'sikatile-400-evopro' }), T('what about coverage?', { prod: 'sikatile-400-evopro' }));
add('fu-pds-after-sds', 'followup', T('sds for sikatile 410 secureset', { type: 'document' }), T('and the data sheet?', { type: 'document', prod: 'sikatile-410-secureset' }));
add('fu-back', 'followup', T('tell me about davco k10 plus', { prod: 'davco-k10-plus' }), T('tell me about sikalastic 1k', { prod: 'sikalastic-1k' }), T('go back', { prod: 'davco-k10-plus' }));
add('fu-env-after-advice', 'followup', T('best sealant for a window', { type: 'advice' }), T('what about outdoors?', { noUnknown: true }));
add('fu-where-then-hours', 'followup', T('where can I buy sika', { type: 'info' }), T('opening hours', { has: 'not in the documentation' }));
add('fu-contact-then-area', 'followup', T('who do I contact at sika', { type: 'info' }), T('contact for flooring', { has: 'flooring' }));
add('fu-names-then-sds', 'followup', T('davco lanko 173', { prod: 'lanko-173-floor-leveller' }), T('and the sds?', { type: 'document', prod: 'lanko-173-floor-leveller' }));
add('fu-names-force950', 'followup', T('sikafiber force 950', { prod: 'sikafiber-novomesh-950' }), T('and the sds?', { type: 'document', prod: 'sikafiber-novomesh-950' }));
add('fu-recommend-no-job', 'followup', T('recommend one', { type: 'choose' }), T('Recommend a tile adhesive', { noUnknown: true }));
add('fu-quantity-then-other-area', 'followup', T('how much davco k10 plus for 10 m2', { prod: 'davco-k10-plus', qty: true }), T('and for 40 m2?', { prod: 'davco-k10-plus', qty: true }), T('and the SDS?', { type: 'document', prod: 'davco-k10-plus' }));
add('fu-rate-then-time', 'followup', T('coverage of sikafloor level pro', { prod: 'sikafloor-level-pro' }), T('what about its pot life?', { prod: 'sikafloor-level-pro' }), T('and the SDS?', { type: 'document', prod: 'sikafloor-level-pro' }));
add('fu-history-then-product', 'followup', T('who owns davco', { has: 'parex' }), T('tell me about davco k10 plus', { prod: 'davco-k10-plus' }));
add('fu-ordinal-then-area', 'followup', T('best screed for 100 m2 at 5 mm', { type: 'advice' }), T('the first one', { prod: 'sikafloor-level-pro' }), T('same for 20 m2', { prod: 'sikafloor-level-pro', qty: true }));
// ---- honest: a follow-up with nothing to resolve against never guesses a product
add('fu-ordinal-no-context', 'honest', T('the second one', { noProductCard: true }));
add('fu-area-no-context', 'honest', T('same for 20 m2', { noProductCard: true }));
add('fu-pail-no-context', 'honest', T('in a pail?', { noProductCard: true }));
add('fu-rec-off-topic', 'honest', T('can you recommend a good tiler in brisbane', { type: 'unknown' }));

fs.writeFileSync(path.join(HERE, 'conversations.json'), JSON.stringify(convs, null, 1));
console.log(convs.length + ' conversations, ' + convs.reduce((s, c) => s + c.turns.length, 0) + ' turns');
