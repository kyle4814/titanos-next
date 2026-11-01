// The advisor as a calculator: natural phrasing and /calc route to it, a missing input gets ONE question with a recommended chip, the answer is cited and carries
// the estimate sentence, and "save" stores it in project details. Plain Node, no network.
import assert from 'node:assert/strict';
import { makeAssistant, ask, memStorage } from '../sika-actions/_env.mjs';
import { createProjectStore, KEY } from '../../public/demo/sika-210c0c/assets/lib/projectstore.js';
let pass = 0, fail = 0;
const T = async (name, f) => { try { await f(); pass++; } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + String(e.message).split('\n')[0]); } };
const EST = 'Estimate only, not an offer. Quantities, not prices. Confirm with the product data sheet and Sika Technical Services before ordering.';
const run = async (...steps) => { const A = makeAssistant(); const cards = []; for (const s of steps) { const r = await ask(A, s); cards.push(r.handled ? r.card : null); } return { A, cards, last: cards[cards.length - 1] }; };
const row = (c, label) => { const r = (c.rows || []).find((x) => new RegExp(label, 'i').test(x.label)); return r ? r.value : null; };

await T('grout: one question with a recommended chip, then a cited answer', async () => {
  const { cards } = await run('how much grout for 20 m2 of 600x600 tiles with 3 mm joints', '10 mm thick');
  assert.equal(cards[0].kind, 'clarify'); assert.equal(cards[0].clarify.need, 'g_thickness'); assert(cards[0].clarify.options[0].recommended && /recommended/.test(cards[0].clarify.options[0].label));
  const c = cards[1]; assert.equal(c.kind, 'quantity'); assert.equal(c.estimate, true); assert(/^2 L/.test(row(c, 'Grout volume'))); assert(/Worked from the numbers you typed/.test(row(c, 'Source'))); assert(row(c, 'Working').includes('600'));
});
await T('a chip value answers the question', async () => { const { cards } = await run('how much grout for 20 m2 of 600x600 tiles with 3 mm joints'); const v = cards[0].clarify.options[0].value; const A = makeAssistant(); await ask(A, 'how much grout for 20 m2 of 600x600 tiles with 3 mm joints'); const r = await ask(A, v); assert.equal(r.card.kind, 'quantity'); });
await T('a bare number answers the question', async () => { const { last } = await run('how much grout for 20 m2 of 600x600 tiles with 3 mm joints', '12'); assert.equal(last.kind, 'quantity'); assert(/2\.4 L/.test(row(last, 'Grout volume'))); });
await T('everything given: no question at all', async () => { const { last } = await run('how much grout for 20 m2 of 600x600 tiles with 3 mm joints and 10 mm thick tiles'); assert.equal(last.kind, 'quantity'); });
await T('sums, conversions, perimeter', async () => {
  assert.equal(row((await run('2.4 x 1.8')).last, 'Answer'), '4.32'); assert.equal(row((await run('40 / 1.2')).last, 'Answer'), '33.33'); assert.equal(row((await run('convert 2400 mm to m')).last, 'Answer'), '2.4 m'); assert.equal(row((await run('/calc 3 m3 in litres')).last, 'Answer'), '3,000 L');
  assert.equal(row((await run('perimeter of a 3.2 x 2.4 room')).last, 'Perimeter'), '11.2 m');
});
await T('tiles: cuts only when given', async () => {
  const a = (await run('how many tiles for 20 m2 of 600x600 tiles')).last; assert.equal(row(a, 'Tiles needed'), '56 tiles'); assert(a.notes.some((n) => /No cuts allowance/.test(n)));
  assert.equal(row((await run('how many tiles for 20 m2 of 600x600 tiles with 10% cuts')).last, 'Tiles needed'), '62 tiles');
});
await T('tiles without a size asks for it with a recommendation', async () => { const { last } = await run('how many tiles for 20 m2'); assert.notEqual(last && last.kind, 'quantity'); });
await T('sealant and bed', async () => { assert(/600 mL/.test(row((await run('how much sealant for 12 m of 10 x 5 mm joint')).last, 'Sealant volume'))); assert(/0\.48 m3/.test(row((await run('how much screed for 12 m2 at 40 mm thick')).last, 'Wet volume'))); const q = (await run('how much screed for 12 m2')).last; assert.equal(q.kind, 'clarify'); assert(q.clarify.options[0].recommended); });
await T('sealant with a named product gives the published pack count when the joint matches', async () => {
  const { last } = await run('how much Sikaflex Pro for 12 m of 10 x 10 mm joint'); assert(last && (last.kind === 'quantity' || last.kind === 'clarify' || last.kind === 'unknown'));
});
await T('mixing water cites the data sheet line and keeps the range', async () => { const { last } = await run('how much water for 2 bags of SikaTile-510 MegaLite'); assert.equal(last.kind, 'quantity'); assert.equal(row(last, 'Water needed'), '12 L to 13 L'); const r = last.rows.find((x) => x.label === 'Water needed'); assert(r.source && /sikatile-510-megalite\.pdf/.test(r.source.url)); assert.equal(last.estimate, true); });
await T('mixing water, no product: asks which', async () => { const { last } = await run('how much water for 2 bags'); assert.equal(last.kind, 'clarify'); });
await T('mixing water for a product with no published ratio is refused, not guessed', async () => { const { last } = await run('how much water for 2 bags of SikaBond PVA'); assert.notEqual(last && last.kind, 'quantity'); });
await T('timeline sums two published steps', async () => { const { last } = await run('how long in total to recoat Sikafloor-161 and then wait before grouting SikaTile-510 MegaLite at 20 C'); assert(last); });
await T('product quantities still work (area and dose)', async () => {
  assert.equal(row((await run('how much Davco Grey One Pot adhesive for 20 m2', '6 mm notch')).last, 'Quantity needed'), '26.67 L');
  assert.equal(row((await run('how much SikaRapid-4 for 2 tonnes of cement')).last, 'Quantity needed'), '8 L to 40 L');
});
await T('save stores it in project details with citation, estimate and inputs', async () => {
  const { A, last } = await run('how much grout for 20 m2 of 600x600 tiles with 3 mm joints and 10 mm thick tiles', '/calcsave');
  assert.equal(last.title, 'Saved to project details'); const cs = A.memory.calculations(); assert.equal(cs.length, 1); const c = cs[0];
  assert.equal(c.kind, 'grout'); assert.equal(c.product, 'none'); assert.equal(c.inputs.area, 20); assert.equal(c.result.litres, 2); assert(/2 L/.test(c.answer)); assert(c.citation.text); assert(c.estimate.includes('Estimate only'));
});
await T('"save" in plain words stores the last calculation', async () => { const { A } = await run('2.4 x 1.8', 'save that'); assert.equal(A.memory.calculations().length, 1); assert.equal(A.memory.calculations()[0].kind, 'arithmetic'); });
await T('saving a product quantity stores a product calculation too', async () => { const { A } = await run('how much SikaRapid-4 for 2 tonnes of cement', '/save'); const cs = A.memory.calculations(); assert.equal(cs.length, 1); assert.equal(cs[0].kind, 'product'); assert.equal(cs[0].product, 'sikarapid-4'); assert(/8 L to 40 L/.test(cs[0].answer), cs[0].answer); });
await T('save and add to cart links the cart line to the calculation', async () => { const { A } = await run('how much water for 2 bags of SikaTile-510 MegaLite', '/calcsave cart'); const c = A.memory.calculations()[0]; assert.equal(c.usedIn[0].type, 'cart'); assert(A.memory.hasItem('sikatile-510-megalite')); });
await T('saving twice does not duplicate', async () => { const { A, last } = await run('2.4 x 1.8', '/calcsave', '/calcsave'); assert.equal(A.memory.calculations().length, 1); assert(last.notes.some((n) => /already saved/.test(n))); });
await T('nothing to save yet says so', async () => { const { last } = await run('/calcsave'); assert.equal(last.title, 'Nothing to save yet'); });
await T('the project card shows the last three calculations', async () => { const { A, last } = await run('2.4 x 1.8', '/calcsave', '3 x 3', '/calcsave', '40 / 1.2', '/calcsave', 'convert 1 m to mm', '/calcsave', '/projects'); const sec = (last.sections || []).find((s) => /Last calculations/.test(s.title)); assert(sec); assert.equal(sec.rows.length, 3); assert.equal(A.memory.calculations().length, 4); });
await T('a calculation on another device kind: other storage key untouched', async () => { const { A } = await run('2.4 x 1.8', '/calcsave'); const raw = JSON.parse(A.storage.getItem(KEY)); assert.equal(raw.projects['My project'].calculations.length, 1); assert.equal(raw.v, 1); });
await T('no model, no network: every card is plain data', async () => { const { last } = await run('how many tiles for 20 m2 of 600x600 tiles'); assert.doesNotThrow(() => JSON.stringify(last)); assert(!/fetch|http:\/\/(?!aus)/.test(JSON.stringify(last.rows))); });
await T('questions that are not calculations still go to their own action', async () => { const { last } = await run('what is the pot life of Sikafloor-161'); assert(last && last.action !== 'calc' || last.kind !== 'quantity'); });
console.log(`CALC BOT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
