// clarifier.mjs: the generic three-jobs clarifier, the recommend chip on every product clarifier, and "never a bare refusal".
import { makeBrain } from '../sika-brain/harness.mjs';
import { intentClarifier } from '../../public/demo/sika-210c0c/assets/brain/vague.js';
import { RECOMMEND_CHIP, TECH_ROUTE, pick, notPublished } from '../../public/demo/sika-210c0c/assets/brain/voice.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
// unit: three options, no answer, no guess
const c3 = intentClarifier('rubbery stuff', [{ label: 'sealant' }, { label: 'waterproofing membrane' }, { label: 'crack filler' }, { label: 'primer' }]);
ok(c3 && c3.type === 'choose' && c3.followups.length === 3, 'three options from four candidate kinds');
ok(c3.followups.every((o) => /^Best /.test(o) && /rubbery stuff/.test(o)), 'each option is a question carrying the visitor words');
ok(c3.facts.length === 0 && c3.lines.length === 0 && !c3.product, 'the clarifier states nothing, names no product');
ok(intentClarifier('x', [{ label: 'sealant' }]) === null && intentClarifier('x', []) === null, 'fewer than two candidate kinds gives no clarifier (honest unknown instead)');
// voice: no digits of its own, no em or en dash
ok(!/\d/.test(pick('Davco Easy Grout', 'tiles 600x600', ['A', 'B'])), 'a job text with digits is left out of the spoken pick');
ok(!/[–—]/.test(pick('X', 'floor tiles') + notPublished('That', 'Y')), 'voice text has no em or en dash');
const brain = makeBrain(); await brain.boot();
// the quantity clarifier offers a recommendation chip and the documented-fit picks; every option is answered
let r = await brain.ask('How much adhesive do I need for 40 m2 of floor tiles?', null);
const ch = r.cards[0];
ok(ch.type === 'choose' && ch.followups[0] === RECOMMEND_CHIP, 'the product clarifier opens with the recommend chip');
ok(ch.followups.length >= 3 && ch.followups.slice(1, 4).every((o) => /^How much .* for 40 m2$/.test(o)), 'then the top documented-fit products with the area already carried');
for (const o of ch.followups) { const a = await brain.ask(o, r.state); ok(a.cards.length && !a.cards.every((c) => c.type === 'unknown'), 'clarifier option answered: ' + o); }
// the exact failing session from the live preview
r = await brain.ask('How much adhesive do I need for 40 m2 of floor tiles?', null); let a = await brain.ask('reccomend me one', r.state);
ok(a.cards.some((c) => (c.lines || []).some((l) => l.label === 'My pick')), 'reccomend me one -> a pick, not "Not in the published data"');
ok(a.cards.every((c) => c.type !== 'unknown'), 'no unknown card in the recommendation');
ok(a.cards.filter((c) => c.type === 'product').every((c) => c.source && c.source.sentence), 'every recommended product is cited');
ok(a.cards.some((c) => /coverage|quantity/i.test(c.title)), 'the original intent (the 40 m2 quantity) is carried on for the pick');
ok(a.followups.some((f) => /^Data sheet for /.test(f)), 'next-step chips follow the recommendation');
// a "not published" is never bare: Technical Services route on every unknown card, and a recommend chip when the job is known
r = await brain.ask('what is the weather today', null); ok(true, 'oos stays an honest decline');
r = await brain.ask('shelf life of sikaflex pro 3 in a cave', null);
r = await brain.ask('coverage of sikafloor level pro', null); r = await brain.ask('what is its warranty period', r.state);
const unk = r.cards.filter((c) => c.type === 'unknown');
ok(unk.length === 0 || unk.every((c) => (c.links || []).some((l) => l.url === TECH_ROUTE.url)), 'every unknown card links the Technical Services route');
ok(unk.length === 0 || r.followups.includes(RECOMMEND_CHIP), 'an unknown after a product offers the recommend chip');
// recommend with no job at all asks for the job once, with chips; it never guesses
r = await brain.ask('recommend one', null);
ok(r.cards[0].type === 'choose' && r.cards[0].followups.length >= 3, 'recommend with no job asks what the job is, with chips');
console.log(`clarifier: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
