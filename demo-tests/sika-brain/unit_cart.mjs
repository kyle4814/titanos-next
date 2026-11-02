// unit_cart.mjs: product-less quantity asks ask WHICH product (chips), and a computed answer carries an "Add N x size pack to my quote" option for the shared quote cart.
// Regressions failing on 22036a3ee: no card.cart existed, and "how much grout for 20 m2" listed one grout and left the grid grouts out as "no usable published rate".
import { makeBrain, rd } from './harness.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
import { createProjectStore } from '../../public/demo/sika-210c0c/assets/lib/projectstore.js';
import { tableAsk } from '../../public/demo/sika-210c0c/assets/brain/grid.js';
let pass = 0, fail = 0; const t = (n, ok, d = '') => { if (ok) pass++; else { fail++; console.log('  FAIL: ' + n + (d ? ' :: ' + String(d).slice(0, 300) : '')); } };
const b = makeBrain(); const ask = async (q) => { const a = await b.ask(q); return { a, c: a.cards[0], x: a.cards.map(cardText).join('\n') }; };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
// 1. product-less asks
let r = await ask('how much grout for 20 m2');
t('grout bare: the card asks which product (chips for the grid grouts), alongside what computes outright', r.c.type === 'calculation' && /Which product/.test(r.x), r.c.type);
t('grout bare: chips for the grid grouts (Easy Grout, Superfine, Colorgrout, SikaCeram-690 Elite)', ['Davco Easy Grout', 'Davco Superfine White Grout', 'Davco Sanitized Colorgrout', 'SikaCeram-690 Elite'].every((n) => r.c.followups.some((f) => f === `How much ${n} for 20 m2`)), JSON.stringify(r.c.followups));
t('grout bare: every chip carries the area', r.c.followups.filter((f) => /^How much /.test(f)).every((f) => /for 20 m2$/.test(f)) && !/Left out.*(Superfine|Easy Grout|Colorgrout|690 Elite)/.test(r.x));
r = await ask('how many bags of tile adhesive for 15 m2');
t('adhesive bare: a SikaTile trowel-table chip is offered', r.c.followups.some((f) => /SikaTile-405 Lite for 15 m2/.test(f)), JSON.stringify(r.c.followups));
r = await ask('How much Davco Easy Grout for 20 m2');
t('tapping a grout chip asks the one missing thing (tile size)', r.c.type === 'choose' && /tile size/i.test(r.x));
// 2. cart option on a computed answer
r = await ask('How much Davco Easy Grout for 20 m2, 300x100 tiles, 3mm joint');
t('Easy Grout exact: exactly one cart option, 3 x 2 L pails', r.c.cart && r.c.cart.length === 1 && r.c.cart[0].label === 'Add 3 x 2 L pails to my quote' && r.c.cart[0].qty === 3 && r.c.cart[0].packs === '3 x 2 L pail' && r.c.cart[0].id === 'davco-easy-grout', JSON.stringify(r.c.cart));
t('cart option is the answer\'s own pack count (20 / 7 -> 3), not a second sum', /3 x 2 L pail/.test(r.x));
r = await ask('How much Davco Easy Grout for 40 m2, 300x100 tiles, 3mm joint'); t('mutation: 40 m2 -> 6 x 2 L pails', r.c.cart && r.c.cart[0].qty === 6 && /6 x 2 L pails/.test(r.c.cart[0].label), JSON.stringify(r.c.cart));
r = await ask('How much Davco Easy Grout for 20 m2 with 600x600 tiles'); t('a table across joints has no cart option (no single answer yet)', !r.c.cart);
r = await ask('How much SikaTile-366 Pro Flex for 20 m2 with a 10mm notched trowel'); t('trowel table: 3 x 20 kg bags', r.c.cart && r.c.cart[0].label === 'Add 3 x 20 kg bags to my quote', JSON.stringify(r.c.cart));
r = await ask('How much Davco Superfine White Grout for 20 m2, 200x200 tiles, 3mm joint'); t('kg per m2 grout: 8 kg offered as published bag sizes', r.c.cart && r.c.cart.some((o) => o.qty === 2 && /5 kg/.test(o.packs)), JSON.stringify(r.c.cart));
r = await ask('How much Davco Rejuvenation Grout for 20 m2'); t('plain rate answer carries a cart option too', r.c.cart && r.c.cart[0].qty === 1, JSON.stringify(r.c.cart));
r = await ask('How much SikaTile-510 Mega Lite for 20 m2'); t('a refusal never carries a cart option', !r.c.cart);
// 3. the option lands in the real project store as exactly that pack and count
r = await ask('How much Davco Easy Grout for 20 m2, 300x100 tiles, 3mm joint'); const o = r.c.cart[0];
const store = createProjectStore(mem(), null, { origin: 'portal' });
const add = store.addItem({ id: o.id, name: o.name, qty: o.qty, unit: o.unit, packs: o.packs, need: o.need, job: o.job, url: o.url, phrase: o.phrase });
t('store accepts it', add.ok === true && add.added === true, JSON.stringify(add));
const it = store.items()[0]; t('the quote line reads 3 packs (3 x 2 L pail)', it.qty === 3 && it.packs === '3 x 2 L pail' && it.id === 'davco-easy-grout', JSON.stringify(it));
store.addItem({ id: o.id, name: o.name, qty: o.qty, unit: o.unit, packs: o.packs }); t('pressing it twice keeps one line, not 6 pails', store.items().length === 1 && store.items()[0].qty === 3);
// 4. computable-table count
const ids = ['davco-easy-grout', 'davco-superfine-whitegrout', 'davco-sanitized-colorgrout', 'sikaceram-690-elite', 'sikatile-405-lite', 'sikatile-366-proflex', 'sikatile-374-megapro', 'sikatile-350-promaxset'];
t('11 computable tables (8 here + 3 plain-rate cards) : the 8 grid and trowel tables are recognised', ids.every((id) => tableAsk(rd(`data/brain/p/${id}.json`).r.facts.consumption)));
t('tables with no stated pack basis are not recognised (SikaTile-510, 440, 410)', ['sikatile-510-megalite', 'sikatile-440-opti-cure', 'sikatile-410-secureset'].every((id) => !tableAsk(rd(`data/brain/p/${id}.json`).r.facts.consumption)));
console.log(`unit_cart: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
