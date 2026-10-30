// REGRESSION for the split cart (commit 500fd8713: the portal's "My projects" list and the advisor's project memory were two stores that never
// met). Uses only APIs that exist on both sides of the merge, so it FAILS on 500fd8713 and passes on the project cart branch.
import { memStorage, check, summary } from './_env.mjs';
globalThis.localStorage = memStorage(); // the browser's storage, shared by the portal module and the advisor
const { projects } = await import('../../public/demo/sika-210c0c/assets/lib/projects.js');
const { createMemory } = await import('../../public/demo/sika-210c0c/assets/actions/memory.js');
const clock = () => new Date('2026-10-31T10:00:00Z');
const bot = createMemory(globalThis.localStorage, clock);

// 1. what the advisor saves shows in the portal cart
bot.saveQuantity({ productId: 'davco-grey-one-potadhesive', name: 'Davco Grey One Pot adhesive', job: { area: 20 }, rows: [{ low: 26.67, high: 26.67, unit: 'L', packs: '1 x 10 L + 4 x 4 L + 1 x 1 L', phrase: 'cover approximately 7.5m2', url: 'https://aus.sika.com/x.pdf' }] });
check('advisor saves a quantity -> the portal cart lists it', projects.has('davco-grey-one-potadhesive') && projects.count() === 1);
check('the portal line carries the worked quantity (6 packs)', (projects.list()[0] || {}).qty === 6);

// 2. what the visitor adds on the page is in the advisor's project
projects.add('davco-easy-grout');
check('portal adds a product -> the advisor project holds it', bot.productsOf(bot.currentProject()).some((p) => p.id === 'davco-easy-grout'));

// 3. an edit on the page is seen by the advisor on its next read
projects.set('davco-easy-grout', { qty: 9, unit: 'bag' });
check('portal edits a quantity -> the advisor sees 9 bags', (bot.currentProject().items || []).some((i) => i.id === 'davco-easy-grout' && i.qty === 9 && i.unit === 'bag'));
projects.remove('davco-easy-grout');
check('portal removes a line -> the advisor no longer lists it', !bot.productsOf(bot.currentProject()).some((p) => p.id === 'davco-easy-grout'));
summary('t_cart_regression');
