// Job builder: the 2.4 x 1.8 bathroom, quantities against the system finder's own model (the one the selector's system sheets use), citations,
// the estimate sentence, no prices, one clarifying question, and the write-through to the shared project store (items, system, quantities).
import { makeAssistant, ask, data, config, memStorage, check, summary } from './_env.mjs';
import { ESTIMATE_LINE, cardCells, cardCsv, cardText } from '../../public/demo/sika-210c0c/assets/actions/core.js';
import { sheetModel } from '../../public/demo/sika-210c0c/assets/lib/finder/model.js';
import { createProjectStore } from '../../public/demo/sika-210c0c/assets/lib/projectstore.js';
import { estimateNote } from '../../public/demo/sika-210c0c/assets/lib/terms.js';
import { ASK_TS } from '../../public/demo/sika-210c0c/assets/actions/job.js';

const S = await data.systems();
const Q = 'bathroom 2.4 x 1.8, walls to 1.8 m, over concrete';
const A = makeAssistant();
const r = await ask(A, Q);
const c = r.card;
check('job.1 handled by the actions layer', r.handled === true);
check('job.2 typed job card', c.kind === 'job' && c.action === 'job' && c.status === 'published', c.kind);
check('job.3 floor and walls', c.job.systems.map((s) => s.id).join() === 'floor,wall');
check('job.4 areas', c.job.room.floorArea === 4.32 && c.job.room.wallArea === 15.12, JSON.stringify(c.job.room));
check('job.5 the card carries the estimate flag and the sentence is the portal sentence', c.estimate === true && ESTIMATE_LINE === estimateNote(config), estimateNote(config));
check('job.6 csv ends with the estimate sentence', cardCsv(c).trim().endsWith('"' + ESTIMATE_LINE + '"'));
check('job.7 an Add all button', c.buttons.some((b) => b.command === '/jobadd'));
check('job.8 no allowance applied by default', c.job.allowance === 0);

// quantities match the quantity module (sheetModel) within rounding, for the same inputs
let compared = 0;
for (const sy of c.job.systems) {
  const m = sheetModel(S, sy.sel, { area: sy.area, length: sy.length || undefined, allowancePct: 0 });
  check(`job.9 ${sy.id} sheet model resolves`, m.ok);
  for (const l of sy.lines) {
    const row = m.rows.find((x) => x.role === l.role); compared++;
    check(`job.10 ${sy.id}/${l.role} same product as the sheet`, row && row.product && row.product.id === l.productId, `${row && row.product && row.product.id} vs ${l.productId}`);
    if (row.calc.ok) {
      check(`job.11 ${sy.id}/${l.role} same quantity as the sheet`, l.status === 'worked' && Math.abs(l.low - row.calc.low) < 0.005 && Math.abs(l.high - row.calc.high) < 0.005 && l.unit === row.calc.unit, `${l.low}-${l.high} ${l.unit} vs ${row.calc.low}-${row.calc.high} ${row.calc.unit}`);
      const sug = row.calc.packs && row.calc.packs.suggested;
      check(`job.12 ${sy.id}/${l.role} same pack count as the sheet`, sug ? l.count === sug.mix.reduce((a, x) => a + x.count, 0) : l.count == null, `${l.count}`);
    } else check(`job.11 ${sy.id}/${l.role} not worked in the sheet means ask TS here`, l.status === 'ask');
  }
}
check('job.13 compared ten lines (5 floor, 5 wall)', compared === 10, String(compared));
// an independent hand calculation, not through the model: "20kg bag covers approximately N m2" -> kg = area / N * 20
for (const sy of c.job.systems) {
  const ad = sy.lines.find((l) => l.role === 'adhesive' && l.status === 'worked');
  const m = ad && /(\d+(?:\.\d+)?)\s*kg bag[^.]*?covers approximately\s*(\d+(?:\.\d+)?)\s*m2/i.exec(ad.rate.text);
  if (m) check(`job.14 ${sy.id} adhesive kg by hand = ${sy.area} / ${m[2]} x ${m[1]}`, Math.abs(ad.low - (sy.area / parseFloat(m[2])) * parseFloat(m[1])) < 0.01, `${ad.low}`);
}

// every line is cited, or says ask Technical Services
const cells = cardCells(c);
for (const s of c.sections) for (const row of s.rows) {
  const ln = row.line;
  const cited = row.source && row.source.url && row.source.sentence;
  check(`job.15 line "${row.label}" (${ln && ln.label}) is cited or says ask Technical Services`, cited || new RegExp(ASK_TS, 'i').test(row.value), row.value);
  if (ln && ln.status === 'worked') check(`job.16 "${row.label}" worked line cites its coverage sentence`, ln.rate && ln.rate.url && ln.rate.text && row.source.url === ln.rate.url, JSON.stringify(ln.rate));
  if (ln && ln.status === 'ask') check(`job.17 "${row.label}" ask line says so`, new RegExp(ASK_TS, 'i').test(row.value));
}
check('job.18 a bond breaker line ships as ask Technical Services', c.sections.some((s) => s.rows.some((x) => x.label === 'Bond breaker' && new RegExp(ASK_TS).test(x.value))));
for (const x of cells) {
  const v = String(x.value || '');
  if (/\d/.test(v) && !(x.input || x.meta || x.name)) check(`job.19 number has a source sentence: ${v.slice(0, 50)}`, x.source && x.source.url && x.source.sentence);
  check(`job.20 no price or dash in: ${v.slice(0, 40)}`, !/[—–]/.test(v) && !/\$\s?\d|\bprice\b/i.test(v));
}
const all = cardText(c);
check('job.21 no competitor named', !/\b(ardex|mapei|laticrete|weber|bostik|bunnings)\b/i.test(all));
check('job.22 the estimate sentence is in the printed text', all.includes(ESTIMATE_LINE));

// no allowance unless the visitor gives one; with one the numbers rise by that percent
const A2 = makeAssistant(); const c2 = (await ask(A2, Q + ', 10% waste')).card;
const f1 = c.job.systems[0].lines.find((l) => l.role === 'membrane'), f2 = c2.job.systems[0].lines.find((l) => l.role === 'membrane');
check('job.23 with a typed 10% allowance the membrane quantity is 10% higher', f1 && f2 && Math.abs(f2.high - f1.high * 1.1) < 0.01, `${f1 && f1.high} -> ${f2 && f2.high}`);
check('job.24 the allowance is shown as the visitor\'s own', c2.rows.some((x) => /allowance/i.test(x.label) && x.input));

// one clarifying question, with chips, then the job
const A3 = makeAssistant();
const q1 = (await ask(A3, 'bathroom 2.4 x 1.8, over concrete')).card;
check('job.25 missing wall height: one clarifying question', q1.kind === 'clarify' && q1.clarify.need === 'height' && q1.clarify.options.length >= 4, q1.clarify && q1.clarify.question);
const q2 = (await ask(A3, 'walls to 1.8 m')).card;
check('job.26 the answer completes the job', q2.kind === 'job' && q2.job.room.wallArea === 15.12, q2.kind);
const A4 = makeAssistant(); await ask(A4, 'bathroom 2.4 x 1.8, over concrete');
const q3 = (await ask(A4, '2.1')).card; check('job.27 a bare number answers the wall height question', q3.kind === 'job' && q3.job.room.height === 2.1, q3.kind);
const A5 = makeAssistant(); await ask(A5, 'bathroom 2.4 x 1.8, over concrete');
const q4 = (await ask(A5, 'Floor only')).card; check('job.28 "Floor only" gives a floor-only list', q4.kind === 'job' && q4.job.systems.length === 1 && q4.job.systems[0].id === 'floor', q4.kind);
const A6 = makeAssistant(); const b1 = (await ask(A6, 'bathroom 2.4 x 1.8')).card;
check('job.29 height and surface both missing: still ONE question, with combined chips', b1.kind === 'clarify' && b1.clarify.need === 'height+substrate' && b1.clarify.options.length >= 2);
const b2 = (await ask(A6, 'blah')).card; check('job.30 a second round never asks again', b2.kind !== 'clarify', b2.kind);
const A7 = makeAssistant(); const d1 = (await ask(A7, '/job')).card; check('job.31 /job alone asks for the size', d1.kind === 'clarify' && d1.clarify.need === 'dims');
const A8 = makeAssistant(); const e1 = (await ask(A8, 'bathroom 2.4 x 1.8, over concrete, walls to 1.8 m, moisture sensitive stone')).card;
check('job.32 moisture sensitive stone: no invented system, ask Technical Services', e1.status === 'unknown' && /Technical Services/i.test(e1.notes.join(' ')));
const A9 = makeAssistant(); const g1 = (await ask(A9, '/job balcony 3 x 2 m on screed')).card; check('job.33 balcony: external floor system', g1.kind === 'job' && g1.job.systems[0].sel.loc === 'external-floor');
const A10 = makeAssistant(); const h1 = (await ask(A10, '/job bathroom 2.4 x 1.8 walls to 2.1 m, plasterboard walls and concrete floor, porcelain')).card;
check('job.34 two substrates: floor on concrete, walls on plasterboard', h1.kind === 'job' && h1.job.systems[0].sel.sub === 'concrete' && h1.job.systems[1].sel.sub === 'plasterboard' && h1.job.systems[0].sel.tile === 'porcelain');

// write-through to the project store
const st = memStorage(); const A11 = makeAssistant({ storage: st });
await ask(A11, Q);
const add = (await ask(A11, '/jobadd')).card;
check('job.35 add all confirms', /added to my project/i.test(add.title), add.title);
const portal = createProjectStore(st, () => new Date('2026-10-31T10:00:00Z'), { origin: 'portal' }); // what the portal's cart page reads
const p = portal.currentProject();
const ids = [...new Set(c.job.cart.filter((l) => l.productId).map((l) => l.productId))];
check('job.36 every product is in the project items', ids.every((id) => p.items.some((i) => i.id === id)), JSON.stringify(p.items.map((i) => i.id)));
check('job.37 one line per product (floor and wall share products)', p.items.length === ids.length, `${p.items.length} vs ${ids.length}`);
check('job.38 both systems saved', p.systems.length === 2 && p.systems.every((s) => s.slug && s.steps.adhesive && s.steps.adhesive.length), JSON.stringify(p.systems.map((s) => s.slug)));
check('job.39 worked quantities saved', p.quantities.length >= 4 && p.quantities.every((q) => q.rows[0].url && q.rows[0].phrase));
// a shared product is worked on the SUMMED area: adhesive on 4.32 + 15.12 m2
const adhId = c.job.systems[0].lines.find((l) => l.role === 'adhesive').productId;
const adhCart = c.job.cart.find((l) => l.productId === adhId && l.role === 'adhesive');
const mAll = sheetModel(S, c.job.systems[0].sel, { area: 4.32 + 15.12, length: c.job.systems[0].length + c.job.systems[1].length, allowancePct: 0 });
const ra = mAll.rows.find((x) => x.role === 'adhesive');
check('job.40 the shared adhesive is worked on the summed area', adhCart && ra.product.id === adhId && Math.abs(adhCart.high - ra.calc.high) < 0.01, `${adhCart && adhCart.high} vs ${ra.calc.high}`);
const item = p.items.find((i) => i.id === adhId);
check('job.41 cart item carries need, basis and the coverage sentence', item.need && item.basis && item.phrase && item.url, JSON.stringify(item).slice(0, 200));
const askItems = p.items.filter((i) => /Technical Services/.test(i.note));
check('job.42 a line with no published rate goes in marked ask Technical Services', askItems.length >= 1 && askItems.every((i) => i.qty === 1), JSON.stringify(askItems.map((i) => i.id)));
const again = await ask(A11, '/jobadd'); const p2 = createProjectStore(st, null, { origin: 'portal' }).currentProject();
check('job.43 adding twice does not duplicate', p2.items.length === p.items.length && p2.systems.length === 2, `${p2.items.length} ${p2.systems.length}`);
const cartShow = (await ask(A11, "what's in my project")).card;
check('job.44 the advisor reads the job back', cartShow.kind === 'memory' && cartShow.sections && cartShow.sections[0].rows.length === ids.length);
const noJob = (await ask(makeAssistant(), '/jobadd')).card; check('job.45 /jobadd with no job says so', /No job list yet/.test(noJob.title));

// regression: a job sentence does not leave a tile size behind in the session
const A12 = makeAssistant(); await ask(A12, Q);
check('job.46 session facets keep no tile size from "2.4 x 1.8"', !A12.session.facets.tileSize && !A12.session.facets.length, JSON.stringify(A12.session.facets));
summary('t_job');
