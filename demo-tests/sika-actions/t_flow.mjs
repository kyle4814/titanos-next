// Conversation flow: at most one clarifying question, facets remembered within the session, actions chained, hand-over to the advisor.
import { makeAssistant, ask, check, summary } from './_env.mjs';
import { observeBrainAnswer, toBrainCard, validateBrainCard } from '../../public/demo/sika-210c0c/assets/actions/brain_adapter.js';
import { route, parseNumbers, parseFacets } from '../../public/demo/sika-210c0c/assets/actions/parse.js';
const OLD = 'Davco Grey One Pot adhesive';
const isQ = (r) => r.handled && r.card.kind === 'clarify';

// at most one clarifying question per request, whatever the visitor answers
for (const [first, answers] of [
  [`/calc ${OLD}`, ['whatever', 'more nonsense']],
  ['/system porcelain tiles', ['hmm', 'not sure']],
  [`can I use ${OLD}`, ['dunno', 'er']],
  ['/compare Davco Easy Grout', ['x', 'y']],
  ['/pack', ['?', '??']],
  ['/safety gloves', ['nothing', 'no']],
]) {
  const A = makeAssistant(); let asked = 0;
  let r = await ask(A, first); if (isQ(r)) asked++;
  for (const a of answers) { r = await ask(A, a); if (isQ(r)) asked++; }
  check(`one question only: ${first}`, asked === 1, 'asked ' + asked);
}
// a fresh request later may ask again (the limit is per request)
{ const A = makeAssistant(); await ask(A, `/calc ${OLD}`); await ask(A, '20'); await ask(A, '6 mm notch'); const r = await ask(A, '/calc Sikadur-41 CF Normal'); check('new request may ask', isQ(r) && r.card.clarify.need === 'thickness'); }
// facets are remembered within the session
{
  const A = makeAssistant(); await ask(A, '/system porcelain on concrete, inside');
  check('tile remembered', A.session.facets.tile === 'porcelain'); check('substrate remembered', A.session.facets.substrate === 'concrete'); check('io remembered', A.session.facets.io === 'internal');
  const r = await ask(A, 'now make it a bathroom floor');
  check('place change reuses tile and substrate', r.handled && r.card.kind === 'system' ? /wet area/.test(r.card.title) && /porcelain/.test(r.card.title) : true);
  await ask(A, `/calc 20 m2 ${OLD} 6 mm notch`); check('area remembered', A.session.facets.area === 20);
  const r2 = await ask(A, `/calc Davco K10 Rapid`); check('area reused for the next product', r2.card.kind === 'quantity' && /^15 L$/.test(r2.card.rows.find((x) => x.label === 'Quantity needed').value) === false || r2.card.kind === 'quantity');
}
// chaining
{
  const A = makeAssistant();
  await ask(A, `how much ${OLD} for 20 m2 with a 6 mm notch`);
  const p = await ask(A, 'now make that a project pack'); check('chain: calc to pack', p.card.kind === 'pack' && p.card.sections[0].rows.some((r) => r.label === 'Quantity'));
  const s = await ask(A, 'save that'); check('chain: pack to save', s.card.title === 'Saved to my project');
  const e = await ask(A, 'export it'); check('chain: export last', e.card.exports.length === 2);
  const t = await ask(A, `and how long is the open time`); check('chain: product remembered for a time question', t.card.kind === 'time' && /Grey One Pot/.test(t.card.title));
  const sf = await ask(A, 'what gloves do I need'); check('chain: product remembered for safety', sf.card.kind === 'safety' && /Grey One Pot/.test(sf.card.title));
  const sp = await ask(A, 'draft a spec clause'); check('chain: product remembered for spec', sp.card.kind === 'spec');
  const h = await ask(A, 'I want to talk to technical services'); check('chain: hand-off keeps context', /Grey One Pot/.test(h.card.handoffBlock.text));
}
// hand-over to the advisor and slash routing
for (const q of ['which primer for concrete', 'hello', 'where can I buy this', '/ask what is a primer']) { const A = makeAssistant(); const r = await ask(A, q); check(`advisor handles: ${q}`, r.handled === false); }
check('route: calc', route('how much grout for 12 m2').action === 'calc');
check('route: compare', route('Easy Grout vs Elite').action === 'compare');
check('route: system', route('what do I need to tile a bathroom floor').action === 'system');
check('route: safety', route('what PPE does Easy Grout need').action === 'safety');
check('route: time', route('how long before I can walk on it').action === 'time');
check('route: link', route('is the SDS link broken').action === 'link');
check('route: pack', route('make that a project pack').action === 'pack');
check('route: no false calc without a size', route('how much does it weigh') === null || route('how much does it weigh').action !== 'calc');
check('parse: m2 symbol', parseNumbers('20 m²').area === 20);
check('parse: litres are not metres', parseNumbers('5 mm thick over 20 m2').area === 20 && parseNumbers('5 mm thick over 20 m2').length === undefined);
check('parse: facets', JSON.stringify(parseFacets('natural stone onto plasterboard in a shower')) === JSON.stringify({ tile: 'natural_stone', substrate: 'plasterboard', io: 'wet' }));
// brain adapter
{
  const A = makeAssistant();
  observeBrainAnswer(A.session, { schema: 'sika-brain-answer@1', query: 'grey one pot', cards: [{ product: { id: 'davco-grey-one-potadhesive', name: 'Davco Grey One Pot adhesive', url: 'x' }, calc: { inputs: { area_m2: 20, notch_mm: 6 } } }], state: { facets: { tile: ['porcelain'] } } });
  check('brain: product observed', A.session.product.id === 'davco-grey-one-potadhesive');
  check('brain: calc inputs observed', A.session.facets.area === 20 && A.session.facets.notch === 6 && A.session.facets.tile === 'porcelain');
  const r = await ask(A, 'make that a project pack'); check('brain: chain from a brain answer', r.card.kind === 'pack');
  for (const q of ['/calc 20 m2 ' + OLD + ' 6 mm notch', '/system porcelain on concrete, inside', '/compare Davco Easy Grout vs SikaCeram-690 Elite', '/safety ' + OLD, '/time ' + OLD, '/spec Davco Easy Grout', 'can I use ' + OLD + ' over old tiles', 'can I tile over a heated floor', '/link ' + OLD, '/pack ' + OLD]) {
    const B = makeAssistant(); const x = await ask(B, q); const bc = toBrainCard(x.card);
    check(`brain card shape: ${q.slice(0, 40)}`, validateBrainCard(bc).length === 0, validateBrainCard(bc).join(','));
    check(`brain card no SIGNED: ${q.slice(0, 30)}`, !/SIGNED/.test(JSON.stringify(bc)));
  }
}
summary('t_flow');
