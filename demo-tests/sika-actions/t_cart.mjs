// The project cart: ONE project model shared by the portal's "My projects" page and the advisor. Model, migration of both old stores, every cart phrase,
// the job pack, and the portal-to-advisor round trip. Plain Node, no network, no model.
import { makeAssistant, ask, check, summary, memStorage } from './_env.mjs';
import { createMemory } from '../../public/demo/sika-210c0c/assets/actions/memory.js';
import { createProjectStore, KEY, LEGACY_PORTAL_KEY, LEGACY_ACTIONS_KEY, qtyFromRows, buildJobPack, sharedStorage, onProjectChange, cleanItem, jobBasis } from '../../public/demo/sika-210c0c/assets/lib/projectstore.js';
import { parseQty } from '../../public/demo/sika-210c0c/assets/actions/cart.js';
import { route } from '../../public/demo/sika-210c0c/assets/actions/parse.js';

const OLD = 'Davco Grey One Pot adhesive';
const clock = () => new Date('2026-10-31T10:00:00Z');
const txt = (c) => JSON.stringify(c);
const rowsOf = (c) => [...(c.rows || []), ...((c.sections || []).flatMap((s) => s.rows))].map((r) => `${r.label}: ${r.value}`).join(' | ');

// ---- the old actions memory, exactly as the code before this branch wrote it
const oldActions = () => ({ v: 1, current: 'Smith bathroom', projects: { 'Smith bathroom': { name: 'Smith bathroom', created: '2026-10-30T09:00:00.000Z', updated: '2026-10-30T09:30:00.000Z',
  systems: [{ title: 'System: porcelain tiles on concrete, wet area', slug: 'porcelain-on-concrete-internal-wet-floor', env: 'wet_area', tile: 'porcelain', substrate: 'concrete', steps: { adhesive: ['sikatile-410-secureset'] }, saved: '2026-10-30T09:10:00.000Z' }],
  quantities: [{ productId: 'davco-grey-one-potadhesive', name: OLD, job: { area: 20, notch: '6 mm' }, rows: [{ low: 26.67, high: 26.67, unit: 'L', packs: '1 x 10 L + 4 x 4 L + 1 x 1 L (27 L supplied, 333.3 mL over)', phrase: 'cover approximately 7.5m2', url: 'https://aus.sika.com/x.pdf#page=2' }], saved: '2026-10-30T09:20:00.000Z' }],
  documents: [{ title: 'Data sheet', url: 'https://aus.sika.com/d.pdf', saved: '2026-10-30T09:25:00.000Z' }], notes: [{ text: 'grout colour to confirm', saved: '2026-10-30T09:26:00.000Z' }] } },
  recent: [{ q: 'how much grout', action: 'calc', t: '2026-10-30T09:00:00.000Z' }], gaps: [{ q: 'does it cure under water', t: '2026-10-30T09:05:00.000Z', count: 2 }] });
const oldPortal = () => [{ id: 'davco-grey-one-potadhesive', qty: 5, unit: 'pail', note: 'check colour' }, { id: 'davco-easy-grout', qty: 2, unit: 'bag', note: '' }];

// ================= model and migration
{
  const st = memStorage(); st.setItem(LEGACY_ACTIONS_KEY, JSON.stringify(oldActions())); st.setItem(LEGACY_PORTAL_KEY, JSON.stringify(oldPortal()));
  const aBefore = st.getItem(LEGACY_ACTIONS_KEY), pBefore = st.getItem(LEGACY_PORTAL_KEY);
  const m = createMemory(st, clock); const p = m.currentProject();
  check('migration: both stores populated, project name kept', m.current() === 'Smith bathroom' && p.name === 'Smith bathroom');
  check('migration: system, document, note carried over', p.systems.length === 1 && p.documents.length === 1 && p.notes[0].text === 'grout colour to confirm');
  check('migration: worked quantity record kept', p.quantities.length === 1 && p.quantities[0].rows[0].phrase === 'cover approximately 7.5m2');
  check('migration: recent questions and gaps kept', m.recent().length === 1 && m.gaps()[0].count === 2);
  const g = p.items.find((i) => i.id === 'davco-grey-one-potadhesive'); const e = p.items.find((i) => i.id === 'davco-easy-grout');
  check('migration: portal cart lines present', !!g && !!e && p.items.length === 2);
  check('migration: the cart quantity the visitor set wins, the worked-out facts are merged in', g.qty === 5 && g.unit === 'pail' && g.note === 'check colour' && g.need === '26.67 L' && /4 x 4 L/.test(g.packs) && g.url.includes('x.pdf'));
  check('migration: a cart-only line keeps its quantity and unit', e.qty === 2 && e.unit === 'bag');
  check('migration: old keys untouched (byte for byte)', st.getItem(LEGACY_ACTIONS_KEY) === aBefore && st.getItem(LEGACY_PORTAL_KEY) === pBefore);
  check('migration: new key written', !!st.getItem(KEY) && JSON.parse(st.getItem(KEY)).model === 2 && m.loadedFrom() === 'migrated');
  // once: later changes to the old keys are not merged again, and a reload reads the new key
  st.setItem(LEGACY_PORTAL_KEY, JSON.stringify([{ id: 'sikaflex-11-fc', qty: 9, unit: 'pack' }]));
  const m2 = createMemory(st, clock); check('migration happens once (old keys are a backup, not a feed)', m2.items().length === 2 && !m2.hasItem('sikaflex-11-fc') && m2.loadedFrom() === 'storage');
  m2.clearAll(); const m3 = createMemory(st, clock); check('clear all does not bring the old data back', m3.items().length === 0 && m3.list().length === 0);
}
{ // the other combinations
  const a = memStorage(); a.setItem(LEGACY_PORTAL_KEY, JSON.stringify(oldPortal())); const ma = createMemory(a, clock);
  check('migration: portal cart only goes into "My project"', ma.current() === 'My project' && ma.items().length === 2 && ma.items()[0].from === 'portal');
  const b = memStorage(); b.setItem(LEGACY_ACTIONS_KEY, JSON.stringify(oldActions())); const mb = createMemory(b, clock);
  check('migration: advisor memory only: quantity becomes a cart line', mb.items().length === 1 && mb.items()[0].id === 'davco-grey-one-potadhesive' && mb.items()[0].qty === 6 && mb.items()[0].from === 'migrated');
  const c = memStorage(); const mc = createMemory(c, clock); check('migration: both empty writes nothing', mc.list().length === 0 && c.getItem(KEY) === null);
  const d = memStorage(); d.setItem(LEGACY_PORTAL_KEY, '[]'); d.setItem(LEGACY_ACTIONS_KEY, JSON.stringify({ v: 1, current: '', projects: {}, recent: [], gaps: [] })); check('migration: both present but empty writes nothing', createMemory(d, clock).list().length === 0 && d.getItem(KEY) === null);
}
{ // corrupt and hostile
  const a = memStorage(); a.setItem(LEGACY_PORTAL_KEY, '{not json'); a.setItem(LEGACY_ACTIONS_KEY, JSON.stringify(oldActions())); const m = createMemory(a, clock);
  check('corrupt portal key: the advisor memory still migrates', m.items().length === 1 && m.currentProject().systems.length === 1);
  const b = memStorage(); b.setItem(LEGACY_ACTIONS_KEY, '}{'); b.setItem(LEGACY_PORTAL_KEY, JSON.stringify(oldPortal())); const mb = createMemory(b, clock);
  check('corrupt advisor key: the portal cart still migrates', mb.items().length === 2);
  const c = memStorage(); c.setItem(LEGACY_ACTIONS_KEY, '[1,2'); c.setItem(LEGACY_PORTAL_KEY, 'nope'); let threw = false; try { const mc = createMemory(c, clock); mc.addItem({ id: 'x1', name: 'X', qty: 2 }); } catch { threw = true; }
  check('both old keys corrupt: starts empty and still works', !threw);
  const d = memStorage(); d.setItem(KEY, '{broken'); d.setItem(LEGACY_PORTAL_KEY, JSON.stringify(oldPortal())); check('corrupt new key falls back to the old backup', createMemory(d, clock).items().length === 2);
  const e = memStorage(); e.setItem(KEY, JSON.stringify({ v: 9, projects: {} })); check('unknown version in the new key is ignored', createMemory(e, clock).list().length === 0);
  const h = memStorage(); h.setItem(LEGACY_PORTAL_KEY, JSON.stringify([null, 3, 'x', { id: '' }, { id: '__proto__', qty: 1 }, { id: 'ok-1', qty: 'NaN', unit: '<img src=x onerror=1>' }, { id: 'big', qty: 1e12 }, { id: 'neg', qty: -4 }]));
  const mh = createMemory(h, clock); const its = mh.items();
  check('hostile portal lines: junk dropped, numbers clamped', its.map((i) => i.id).join() === 'ok-1,big,neg' && its.find((i) => i.id === 'ok-1').qty === 1 && its.find((i) => i.id === 'big').qty === 99999 && its.find((i) => i.id === 'neg').qty === 1);
  check('hostile unit text is plain text only', !/[<>]/.test(its[0].unit) || its[0].unit.length <= 20);
  check('cleanItem rejects a prototype key and an empty id', cleanItem({ id: '__proto__' }) === null && cleanItem({ id: '' }) === null);
}
{ // blocked localStorage: the portal side and the advisor side share the tab store
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('blocked'); } };
  let threw = false, m;
  try { m = createMemory(bad, clock); m.addItem({ id: 'p1', name: 'P One', qty: 3, unit: 'bag' }); m.saveQuantity({ productId: 'p2', name: 'P Two', rows: [{ low: 1, high: 1, unit: 'L', packs: '1 x 1 L' }] }); m.items(); } catch { threw = true; }
  check('blocked storage: nothing throws', !threw); check('blocked storage: kept for this tab, not persistent', m.items().length === 2 && m.persistent() === false);
  const sh = sharedStorage(); sh.removeItem && ['x'].forEach(() => 0);
  const one = createProjectStore(sh, clock, { origin: 'portal' }), two = createProjectStore(sh, clock, { origin: 'bot' });
  one.addItem({ id: 'shared-1', name: 'S', qty: 1 }); check('tab-only store: the portal and the advisor see the same project', two.hasItem('shared-1'));
  one.clearAll();
}
{ // read-through, both directions, with change notices
  const st = memStorage(); const portal = createProjectStore(st, clock, { origin: 'portal' }); const bot = createMemory(st, clock);
  const seen = []; const off = onProjectChange((i) => seen.push(i.origin));
  bot.addItem({ id: 'davco-easy-grout', name: 'Davco Easy Grout', qty: 4, unit: 'bag', question: 'grout for a bathroom' });
  check('advisor add is visible to the portal store on its next read', portal.getItem('davco-easy-grout').qty === 4 && portal.getItem('davco-easy-grout').question === 'grout for a bathroom');
  portal.setItem('davco-easy-grout', { qty: 7 });
  check('a portal edit is visible to the advisor on its next turn', bot.getItem('davco-easy-grout').qty === 7);
  portal.removeItem('davco-easy-grout'); check('a portal removal is visible to the advisor', !bot.hasItem('davco-easy-grout'));
  check('change notices carry who wrote', seen.includes('bot') && seen.includes('portal')); off();
  const p = portal.addItem({ id: 'z', name: 'Z', qty: 1 }); check('add: new line then update in place (one line per product)', p.added && portal.addItem({ id: 'z', qty: 3 }).updated && portal.items().length === 1 && portal.getItem('z').qty === 3);
  portal.setItem('z', { qty: 9 }); check('set quantity clears a stale pack breakdown', (portal.addItem({ id: 'w', qty: 6, packs: '1 x 10 L + 4 x 4 L' }), portal.setItem('w', { qty: 2 }), portal.getItem('w').packs === ''));
}
{ // quantities from the existing quote module's rows
  check('qty: mixed packs sum their counts', JSON.stringify(qtyFromRows([{ low: 26.67, high: 26.67, unit: 'L', packs: '1 x 10 L + 4 x 4 L + 1 x 1 L (27 L supplied, 333.3 mL over)' }])) === JSON.stringify({ qty: 6, unit: 'pack', packs: '1 x 10 L + 4 x 4 L + 1 x 1 L', need: '26.67 L' }));
  check('qty: no pack text uses the need in its unit', (() => { const r = qtyFromRows([{ low: 2.1, high: 3.2, unit: 'kg', packs: null }]); return r.qty === 4 && r.unit === 'kg' && r.need === '2.1 to 3.2 kg'; })());
  check('basis reads as plain words', jobBasis({ area_m2: 20, notch_mm: 6, waste_pct: 10 }) === 'area 20 m2, notch 6 mm, allowance 10%' && jobBasis({ weird_key: 'x' }) === 'weird key x');
  check('qty: nothing worked out is 1 pack', qtyFromRows([]).qty === 1);
  const pq = (t, n = []) => parseQty(t, n);
  check('parse: 12 bags', pq('add 12 bags').qty === 12 && pq('add 12 bags').unit === 'bag');
  check('parse: units by word', pq('add 3 pails').unit === 'pail' && pq('add 2 litres').unit === 'litre' && pq('add 25 kg').unit === 'kg' && pq('add 4 x cartridges').unit === 'cartridge');
  check('parse: a measurement is not a quantity', pq('add Davco Easy Grout for 20 m2').qty === null && pq('add grout 3 mm joints').qty === null);
  check('parse: digits in a product name are not a quantity', pq('add 2 of Sikadur-41 CF Normal', ['Sikadur-41 CF Normal']).qty === 2 && pq('add Sikaflex-11 FC to my project', ['Sikaflex-11 FC']).qty === null);
  check('parse: to N and by N', pq('change quantity to 8').qty === 8 && pq('increase it by 3').qty === 3);
  check('parse: decimals round up and say so', pq('add 2.5 litres').qty === 3 && pq('add 2.5 litres').rounded === true);
  check('parse: absurd quantity flagged', pq('add 0 bags').bad === true && pq('add 100000 bags').bad === true);
}

// ================= the advisor: every phrase
const newA = () => makeAssistant();
const grey = `/calc 20 m2 ${OLD} 6 mm notch`;
{ // quantity -> add -> read back -> change -> remove
  const A = newA(); const q = await ask(A, grey);
  check('calc card carries an add button', (q.card.buttons || []).some((b) => b.command === '/add' && /add to my project/i.test(b.label)));
  let r = await ask(A, 'add this to my project');
  check('"add this to my project" adds the worked quantity', r.handled && /Added/.test(rowsOf(r.card)) && /6 packs/.test(rowsOf(r.card)) && /1 x 10 L/.test(rowsOf(r.card)), rowsOf(r.card));
  check('the card confirms project, quantity and unit', /Project: My project/.test(rowsOf(r.card)));
  const it = A.memory.getItem('davco-grey-one-potadhesive');
  check('item: quantity, unit, need, source line and the question that produced it', it.qty === 6 && it.unit === 'pack' && it.need === '26.67 L' && /7\.5m2/.test(it.phrase) && /\.pdf/.test(it.url) && /20 m2/.test(it.question), JSON.stringify(it));
  check('item came from the advisor and records the quantity too (saved for later)', it.from === 'bot' && A.memory.currentProject().quantities.length === 1);
  r = await ask(A, 'add this to my project'); check('adding the same worked quantity again changes nothing', /Already in my project/.test(rowsOf(r.card)) && A.memory.items().length === 1 && A.memory.getItem(it.id).qty === 6);
  r = await ask(A, 'add 12 bags'); check('"add 12 bags" applies to the product in the conversation', A.memory.getItem(it.id).qty === 12 && A.memory.getItem(it.id).unit === 'bag' && /Changed/.test(rowsOf(r.card)) && /was 6 packs/.test(rowsOf(r.card)), rowsOf(r.card));
  check('a hand-set quantity no longer claims the worked pack breakdown', A.memory.getItem(it.id).packs === '' && A.memory.getItem(it.id).need === '26.67 L');
  r = await ask(A, `add 4 pails of Davco Easy Grout`); check('named product with quantity and unit', A.memory.getItem('davco-easy-grout') && A.memory.getItem('davco-easy-grout').qty === 4 && A.memory.getItem('davco-easy-grout').unit === 'pail', rowsOf(r.card));
  r = await ask(A, "what's in my project"); const body = rowsOf(r.card);
  check('"what\'s in my project" reads it back with quantities', r.card.title.startsWith('My project') && /12 bags/.test(body) && /4 pails/.test(body) && /need about 26\.67 L/.test(body), body);
  check('read-back counts in the summary', /2 products/.test(r.card.summary));
  r = await ask(A, `change quantity of Davco Easy Grout to 8 bags`); check('change quantity of X to N unit', A.memory.getItem('davco-easy-grout').qty === 8 && A.memory.getItem('davco-easy-grout').unit === 'bag' && /was 4 pails/.test(rowsOf(r.card)), rowsOf(r.card));
  r = await ask(A, 'make it 9 bags'); check('"make it 9 bags" changes the last item touched', A.memory.getItem('davco-easy-grout').qty === 9, rowsOf(r.card));
  r = await ask(A, 'increase Davco Easy Grout by 3'); check('increase by N', A.memory.getItem('davco-easy-grout').qty === 12);
  r = await ask(A, 'reduce Davco Easy Grout by 20'); check('cannot go below one: says how to remove instead', A.memory.getItem('davco-easy-grout').qty === 12 && /remove/i.test(txt(r.card.notes)));
  r = await ask(A, 'add 2 more Davco Easy Grout'); check('"add 2 more" adds to the quantity', A.memory.getItem('davco-easy-grout').qty === 14, String(A.memory.getItem('davco-easy-grout').qty));
  r = await ask(A, 'remove Davco Easy Grout from my project'); check('remove X from my project', !A.memory.hasItem('davco-easy-grout') && A.memory.hasItem(it.id) && /Removed/.test(rowsOf(r.card)));
  r = await ask(A, 'remove Davco Easy Grout'); check('removing something that is not in the project changes nothing', A.memory.items().length === 1 && !(r.handled && /Removed/.test(r.card.title)));
  check('no prices anywhere in the cart cards', ![q, r].some((x) => /\$|price|AUD/i.test(txt(x.card))));
}
{ // a system: the whole set
  const A = newA(); const s = await ask(A, '/system porcelain on concrete, internal wet floor');
  check('system card carries "add the whole set"', (s.card.buttons || []).some((b) => b.command === '/add' && /whole set/i.test(b.label)));
  await ask(A, 'now 25 m2'); const r = await ask(A, 'add the whole set to my project'); const items = A.memory.items(); const proj = A.memory.currentProject();
  check('whole set: the first product of every step is in the cart', items.length === 4 && items.every((i) => i.from === 'bot' && /porcelain/.test(i.systemTitle)), items.map((i) => i.id).join());
  check('whole set: the system is saved with it, and the card names each product', proj.systems.length === 1 && r.card.rows.filter((x) => x.productId).length === 4);
  check('whole set: quantities worked out are used; others are marked "not worked out yet"', items.some((i) => i.need) && /Quantity not worked out yet/.test(rowsOf(r.card)) === items.some((i) => !i.need), items.map((i) => [i.id, i.qty, i.need]).join(';'));
  const again = await ask(A, 'add the whole set to my project'); check('adding the set twice duplicates nothing', A.memory.items().length === 4 && /Already in my project/.test(rowsOf(again.card)));
  const p = await ask(A, '/pack'); check('the pack card also offers the add button', (p.card.buttons || []).some((b) => b.command === '/add'));
}
{ // save that = add: a saved system puts its products in the cart too
  const A = newA(); await ask(A, '/new Smith bathroom'); await ask(A, '/system porcelain on concrete, inside'); const r = await ask(A, 'save that');
  check('"save that" after a system also fills the cart', A.memory.items().length >= 3 && r.card.title === 'Saved to my project' && r.card.rows.some((x) => x.productId), String(A.memory.items().length));
  const B = newA(); await ask(B, grey); const r2 = await ask(B, 'save that'); check('"save that" after a quantity shows the cart line', B.memory.hasItem('davco-grey-one-potadhesive') && r2.card.rows.some((x) => /In my project/.test(x.label)));
}
{ // clarify, soft phrases, safety
  const A = newA(); let r = await ask(A, 'add 12 bags');
  check('no product known: one question, with the quantity kept', r.handled && r.card.kind === 'clarify' && /Which product/.test(r.card.clarify.question));
  r = await ask(A, 'Davco Easy Grout'); check('the answer completes the add', A.memory.getItem('davco-easy-grout') && A.memory.getItem('davco-easy-grout').qty === 12, rowsOf(r.card));
  r = await ask(newA(), 'add this to my project'); check('nothing to add yet is said plainly', r.handled && /Nothing to add yet/.test(r.card.title));
  for (const t of ['remove old adhesive from concrete', 'add primer to concrete', 'set the thickness to 5 mm', 'add water to the mix', 'change the colour']) { const x = await ask(newA(), t); check(`not a cart phrase, goes on to the advisor: ${t}`, !(x.handled && /project|cart/i.test(x.card.title) && x.card.action === 'memory'), x.handled && x.card.title); }
  const E = newA(); r = await ask(E, "what's in my project"); check('empty project reads back as empty', /empty/i.test(r.card.title));
  r = await ask(E, 'remove everything from my project'); check('"remove everything" is refused with the safe route', /will not empty/.test(r.card.title));
  check('route: cart phrases are claimed', ['add this to my project', 'add 12 bags', "what's in my project", 'change quantity to 8', 'job pack', 'copy for the enquiry form', 'export my project'].every((t) => /^cart/.test((route(t) || {}).action)));
  check('route: older phrases keep their meaning', route('make that a project pack').action === 'pack' && route('my projects').action === 'projects' && route('save that').action === 'save' && route('/new Foo').action === 'newproject');
  check('slash: /cart /add /jobpack', route('/cart').action === 'cartshow' && route('/add').action === 'cartadd' && route('/jobpack').action === 'cartpack' && route('/remove x').action === 'cartremove' && route('/qty x 3').action === 'cartqty');
}
{ // a page edit is seen by the advisor on its next turn
  const st = memStorage(); const A = makeAssistant({ storage: st }); await ask(A, grey); await ask(A, 'add this to my project');
  const portal = createProjectStore(st, clock, { origin: 'portal' });
  check('the portal store sees the advisor line with its source', portal.getItem('davco-grey-one-potadhesive').from === 'bot' && !!portal.getItem('davco-grey-one-potadhesive').url);
  portal.setItem('davco-grey-one-potadhesive', { qty: 3, unit: 'pail' }); portal.addNote('painter wants it Friday'); portal.addItem({ id: 'davco-easy-grout', name: 'Davco Easy Grout', qty: 2, unit: 'bag' });
  const r = await ask(A, 'what is in my project'); const body = rowsOf(r.card);
  check('the advisor reads the page edits: quantity, unit, a new line and a note', /3 pails/.test(body) && /Davco Easy Grout: 2 bags/.test(body) && /painter wants it Friday/.test(body), body);
  portal.removeItem('davco-easy-grout'); const r2 = await ask(A, 'what is in my project'); check('and a removal on the page', !/Easy Grout/.test(rowsOf(r2.card)));
}

// ================= the job pack
{
  const A = newA(); await ask(A, grey); await ask(A, 'add this to my project'); await ask(A, 'add 3 bags of Davco Easy Grout'); await ask(A, '/note =cmd|fake note to check the sheet is safe');
  const r = await ask(A, 'job pack'); const c = r.card;
  const csvEx = c.exports.find((x) => /csv/i.test(x.filename)), docEx = c.exports.find((x) => /documents/.test(x.filename));
  check('job pack: print button, CSV, document links, enquiry text', (c.buttons || []).some((b) => b.print) && !!csvEx && !!docEx && c.copyText && c.copyLabel === 'Copy for the enquiry form');
  check('job pack CSV: header, one row per product, quantities, the estimate line, CRLF', /^"Product","Quantity","Unit"/.test(csvEx.text) && csvEx.text.split('\r\n').length === 5 && /"Davco Easy Grout","3","bags"/.test(csvEx.text) && /Estimate only, not an offer/.test(csvEx.text));
  check('job pack: no prices (the only "price" is the estimate line saying quantities, not prices)', !/\$|AUD/i.test(csvEx.text + docEx.text + c.copyText) && !/price/i.test((csvEx.text + docEx.text + c.copyText).split('Quantities, not prices.').join('')));
  check('job pack: data sheet and SDS links from the published data', /https:\/\/aus\.sika\.com\/.+\.pdf/.test(docEx.text) && /Data sheet \|/.test(docEx.text) && /Safety data sheet \|/.test(docEx.text), docEx.text.slice(0, 300));
  check('job pack: enquiry text lists each product with its quantity', /Davco Easy Grout: 3 bags/.test(c.copyText) && /Davco Grey One Pot adhesive: 6 packs/.test(c.copyText));
  check('job pack: sections carry the same lines', c.sections[0].rows.length === 2 && c.sections.some((s) => /Data sheets/.test(s.title)));
  const emptyPack = await ask(newA(), '/jobpack'); check('job pack of an empty project says so', /Job pack/.test(emptyPack.card.title) && !emptyPack.card.exports.length);
  const p = A.memory.currentProject(); const jp = await buildJobPack({ ...p, notes: [{ text: '=HYPERLINK("x")', saved: '' }], items: [{ ...p.items[0], note: '=SUM(A1)', name: '@evil' }] }, async () => [{ type: 'product_data_sheet', title: 'T', url: 'https://aus.sika.com/a.pdf' }, { type: 'safety_data_sheet', title: 'S', url: 'https://aus.sika.com/b.pdf', http: { status: 404 } }, { type: 'brochure', title: 'B', url: 'https://aus.sika.com/c.pdf' }]);
  check('job pack CSV: formula cells are neutralised', /"'@evil"/.test(jp.csv) && /"'=SUM\(A1\)"/.test(jp.csv));
  check('job pack docs: only data sheets and SDS with a working link', jp.docs.filter((d) => d.product !== 'Saved from the advisor').length === 1 && jp.docs[0].kind === 'Data sheet');
}
summary('t_cart');
