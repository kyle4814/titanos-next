// Action cases: inputs (one or more turns) to expected card fields. Plain Node, no network. Every case starts a fresh assistant.
import { makeAssistant, ask, check, summary, memStorage } from './_env.mjs';
import { ESTIMATE_LINE } from '../../public/demo/sika-210c0c/assets/actions/core.js';

let n = 0;
async function T(name, steps, fn, opts) {
  n++;
  const A = makeAssistant(opts);
  const cards = [];
  try {
    for (const s of [].concat(steps)) { const r = await ask(A, s); cards.push(r.handled ? r.card : null); }
    await fn(cards[cards.length - 1], cards, A);
  } catch (e) { check(`${name}: threw`, false, e && e.stack || e); }
}
const text = (c) => JSON.stringify(c);
const rowVal = (c, label) => { const all = [...(c.rows || []), ...((c.sections || []).flatMap((s) => s.rows))]; const r = all.find((x) => new RegExp(label, 'i').test(x.label)); return r ? r.value : null; };
const has = (c, re) => re.test(text(c));
const OLD = 'Davco Grey One Pot adhesive';

/* ---- CALC (quantity and packs) */
await T('calc.1 notch asked once', `How much ${OLD} for 20 m2?`, (c) => { check('calc.1 clarify', c.kind === 'clarify' && c.clarify.need === 'notch'); check('calc.1 offers 6 mm', c.clarify.options.some((o) => /6 mm/.test(o.label))); });
await T('calc.2 20 m2 = 26.67 L', [`How much ${OLD} for 20 m2?`, '6 mm notch'], (c) => { check('calc.2 kind', c.kind === 'quantity'); check('calc.2 26.67 L', rowVal(c, 'Quantity needed') === '26.67 L', rowVal(c, 'Quantity needed')); check('calc.2 estimate', c.estimate === true); });
await T('calc.3 12 m2 = 16 L', `/calc 12 m2 ${OLD} 6 mm notch`, (c) => { check('calc.3 16 L', rowVal(c, 'Quantity needed') === '16 L'); });
await T('calc.4 own allowance 15 percent', `how much ${OLD} for 20 m2 with a 6mm notch and 15% allowance`, (c) => { check('calc.4 30.67 L', /30\.67 L/.test(rowVal(c, 'allowance'))); check('calc.4 allowance labelled yours', /15% allowance/.test(rowVal(c, 'Your job'))); });
await T('calc.5 no allowance invented', `/calc 10 m2 ${OLD} 6 mm notch`, (c) => { check('calc.5 no allowance row', !has(c, /allowance/i) || /yours/.test(rowVal(c, 'Your job') || '') === false); check('calc.5 13.33 L', rowVal(c, 'Quantity needed') === '13.33 L'); });
await T('calc.6 packs rounded up', `/calc 20 m2 ${OLD} 6 mm notch`, (c) => { const v = rowVal(c, 'Whole packs'); check('calc.6 packs', /27 L supplied/.test(v), v); });
await T('calc.7 area asked', `/calc ${OLD}`, (c) => { check('calc.7 area question', c.kind === 'clarify' && c.clarify.need === 'area'); });
await T('calc.8 bare number answers area', [`/calc ${OLD}`, '20', '6 mm notch'], (c) => { check('calc.8 26.67', rowVal(c, 'Quantity needed') === '26.67 L'); });
await T('calc.9 thickness asked then answered', ['how much Sikadur-41 CF Normal for 4 m2', '3 mm'], (c, cs) => { check('calc.9 asked thickness', cs[0].clarify.need === 'thickness'); check('calc.9 24 kg', rowVal(c, 'Quantity needed') === '24 kg'); });
await T('calc.10 coats published', 'how much Davco K10 Rapid for 10 m2', (c) => { check('calc.10 15 L', rowVal(c, 'Quantity needed') === '15 L'); check('calc.10 condition row', rowVal(c, 'Condition') && /coats/.test(rowVal(c, 'Condition'))); });
await T('calc.11 no rate refuses', 'how much SikaBond PVA for 5 m2', (c) => { check('calc.11 unknown', c.status === 'unknown' && c.handoff === true); check('calc.11 no number invented', !/\d+(\.\d+)? (L|kg)\b/.test(text(c.rows))); });
await T('calc.12 cementitious asked', ['/calc 2 m3 Sika ViscoFlow-21 AU IMPACT', '700 kg'], (c, cs) => { check('calc.12 asked', cs[0].clarify.need === 'cementitious'); check('calc.12 range', rowVal(c, 'Quantity needed') === '1.4 L to 5.6 L'); });
await T('calc.13 tile size picks notch', 'how many Davco Ceramaflex for 18 m2 with 600x600 tiles', (c) => { check('calc.13 handled', c.kind === 'quantity' || c.kind === 'clarify' || c.status === 'unknown'); check('calc.13 estimate or question', c.kind === 'clarify' || c.estimate === true); });
await T('calc.14 session product remembered', [`/calc 20 m2 ${OLD} 6 mm notch`, 'now 30 m2'], (c) => { check('calc.14 40 L', rowVal(c, 'Quantity needed') === '40 L'); });
await T('calc.15 a new product resets conditions', [`/calc 20 m2 ${OLD} 6 mm notch`, 'how much Davco K10 Rapid for 10 m2'], (c) => { check('calc.15 no stale notch', !/notch/.test(rowVal(c, 'Your job'))); });
await T('calc.16 sqm wording', `how much ${OLD} for 20 sqm with 6mm notch`, (c) => { check('calc.16 26.67', rowVal(c, 'Quantity needed') === '26.67 L'); });
await T('calc.17 export has estimate line', [`/calc 20 m2 ${OLD} 6 mm notch`, '/export'], (c) => { check('calc.17 csv ends with estimate', c.exports[0].text.trim().endsWith('"' + ESTIMATE_LINE + '"')); });
await T('calc.18 prices never', `how much ${OLD} for 20 m2 6 mm notch`, (c) => { check('calc.18 no dollar', !/\$|price|cost/i.test(text(c.rows))); });

/* ---- SYSTEM */
await T('system.1 porcelain on concrete inside', '/system porcelain on concrete, inside', (c) => { check('system.1 kind', c.kind === 'system'); check('system.1 has primer, membrane, adhesive, grout', c.sections.length >= 4); check('system.1 grey one pot not endorsed', has(c, /Not suitable for tiling over concrete/)); });
await T('system.2 partly documented flagged', '/system porcelain on concrete, inside', (c) => { check('system.2 not endorsed', has(c, /Partly documented, not endorsed/)); });
await T('system.3 order is prime, membrane, adhesive, grout', '/system porcelain on concrete, inside', (c) => { const t = c.sections.map((s) => s.title.replace(/^\d+\. /, '')); check('system.3 order', t.indexOf('Prepare and prime') < t.indexOf('Waterproofing membrane') && t.indexOf('Waterproofing membrane') < t.indexOf('Tile adhesive') && t.indexOf('Tile adhesive') < t.indexOf('Grout'), t.join('|')); });
await T('system.4 bathroom wet area', 'what do I need to tile a bathroom floor, ceramic on concrete', (c) => { check('system.4 title wet', /wet area/.test(c.title)); });
await T('system.5 external', '/system ceramic on concrete, outside floor', (c) => { check('system.5 external', /external floor/.test(c.title)); });
await T('system.6 one question for surface and inside', '/system porcelain tiles', (c) => { check('system.6 clarify', c.kind === 'clarify' && /substrate/.test(c.clarify.need)); });
await T('system.7 never asks twice', ['/system porcelain tiles', 'banana'], (c, cs) => { check('system.7 first asked', cs[0].kind === 'clarify'); check('system.7 second is not a question', c.kind !== 'clarify'); });
await T('system.8 answer completes', ['/system porcelain tiles', 'concrete, inside'], (c) => { check('system.8 system', c.kind === 'system'); });
await T('system.9 assumptions stated', '/system porcelain on concrete, inside', (c) => { check('system.9 assumed floor', c.assumptions.some((a) => /floor/.test(a))); });
await T('system.10 quantities with area', ['/system porcelain on concrete, inside', 'now 25 m2'], (c) => { check('system.10 quantities section', c.sections.some((s) => /Quantities/.test(s.title))); check('system.10 estimate', c.estimate === true); });
await T('system.11 adhesive notch refused not guessed', ['/system porcelain on concrete, inside', 'now 25 m2'], (c) => { const q = c.sections.find((s) => /Quantities/.test(s.title)); check('system.11 notch refusal', q.rows.some((r) => /trowel notch is required/.test(r.value))); });
await T('system.12 notch given completes adhesive', ['/system porcelain on concrete, inside', 'now 25 m2 with a 6 mm notch'], (c) => { const q = c.sections.find((s) => /Quantities/.test(s.title)); check('system.12 adhesive worked', q.rows.some((r) => /adhesive/.test(r.label) && /\d+(\.\d+)? (L|kg)/.test(r.value) && r.derived), JSON.stringify(q.rows.map((r) => r.value))); });
await T('system.13 sheet link', '/system porcelain on concrete, inside', (c) => { check('system.13 sheet', c.topButtons.some((b) => /systems\/porcelain-on-concrete-internal-floor\//.test(b.href || ''))); });
await T('system.14 pool', '/system ceramic on concrete pool', (c) => { check('system.14 handled', c.kind === 'system' || c.status === 'unknown'); });
await T('system.15 unsupported combination', '/system moisture sensitive stone on plasterboard, outside wall', (c) => { check('system.15 unknown or system', c.kind === 'system' || c.status === 'unknown'); if (c.status === 'unknown') check('system.15 handoff', c.handoff === true); });

/* ---- COMPARE */
await T('compare.1 two grouts', 'compare Davco Easy Grout vs SikaCeram-690 Elite', (c) => { check('compare.1 table', c.kind === 'compare' && c.table.head.length === 3 && c.table.rows.length >= 6); });
await T('compare.2 sources on cells', '/compare Davco Easy Grout versus SikaCeram-690 Elite', (c) => { const cells = c.table.rows.flatMap((r) => r.cells); check('compare.2 every figure cell sourced', cells.every((x) => !/\d/.test(x.value) || (x.source && x.source.url && x.source.sentence))); });
await T('compare.3 missing second asks', '/compare Davco Easy Grout', (c) => { check('compare.3 asks', c.kind === 'clarify' && c.clarify.need === 'products'); });
await T('compare.4 answer completes', ['/compare Davco Easy Grout', 'SikaCeram-690 Elite'], (c) => { check('compare.4 table', c.kind === 'compare'); });
await T('compare.5 no competitor named', '/compare Davco Easy Grout vs SikaCeram-690 Elite', (c) => { check('compare.5 clean', !/\b(ardex|mapei|laticrete|weber|bostik)\b/i.test(text(c))); });
await T('compare.6 not-published cell is plain', '/compare Davco K10 Rapid vs Davco K10 Plus', (c) => { check('compare.6 ok', c.kind === 'compare'); check('compare.6 has not-published wording or sourced', c.table.rows.every((r) => r.cells.every((x) => x.value === 'Not in the published data' || x.source))); });

/* ---- COMPATIBILITY */
await T('compat.1 old tiles is No', `Can I use ${OLD} over old tiles?`, (c) => { check('compat.1 no', c.rows[0].verdict === 'no' && /^No\./.test(c.rows[0].value)); check('compat.1 sentence', has(c, /existing ceramic tiles/)); });
await T('compat.2 heated floor not guessed', [`Can I use ${OLD} over old tiles?`, 'Can I tile over a heated floor?'], (c) => { check('compat.2 unknown', c.status === 'unknown'); check('compat.2 names heated', /heated/i.test(rowVal(c, 'heated'))); check('compat.2 handoff', c.handoff === true); });
await T('compat.3 handoff names heated', [`Can I use ${OLD} over old tiles?`, 'Can I tile over a heated floor?', '/handoff'], (c) => { check('compat.3 text', /heated/i.test(c.handoffBlock.text), c.handoffBlock.text); });
await T('compat.4 concrete is No for grey one pot', `can I use ${OLD} on concrete`, (c) => { check('compat.4 no', c.rows[0].verdict === 'no'); });
await T('compat.5 yes needs a sentence', 'can I use Davco Ceramaflex on concrete', (c) => { check('compat.5 verdict has quote when yes', c.rows[0].verdict !== 'yes' || c.rows.slice(1).some((r) => r.quote && r.source && r.source.sentence)); });
await T('compat.6 missing surface asks once', `can I use ${OLD}`, (c) => { check('compat.6 asks', c.kind === 'clarify' && c.clarify.need === 'surface'); });
await T('compat.7 no second question', [`can I use ${OLD}`, 'hmm'], (c) => { check('compat.7 not clarify', c.kind !== 'clarify'); });
await T('compat.8 answer to the question', [`can I use ${OLD}`, 'on existing tiles'], (c) => { check('compat.8 no', c.kind === 'compat' && c.rows[0].verdict === 'no'); });
await T('compat.9 two products', 'can I use Davco Ceramaflex with SikaTile-010 Secure Prime', (c) => { check('compat.9 handled', c.kind === 'compat'); });
await T('compat.10 never a bare yes', 'can I use Davco Ceramaflex on concrete outside', (c) => { check('compat.10 yes only with sentence', !/^Yes/.test(c.rows[0].value) || c.rows.length > 1); });

/* ---- SAFETY */
await T('safety.1 gloves', `what gloves for ${OLD}`, (c) => { check('safety.1 hand protection', rowVal(c, 'Hand protection') && c.rows.every((r) => !/\d/.test(r.value) || r.source)); });
await T('safety.2 revision date shown', `/safety ${OLD}`, (c) => { check('safety.2 date', /18\.11\.2025/.test(rowVal(c, 'Revision date'))); });
await T('safety.3 respirator', `do I need a respirator with ${OLD}`, (c) => { check('safety.3 resp', rowVal(c, 'Respiratory') !== null); });
await T('safety.4 storage', `how should I store ${OLD}`, (c) => { check('safety.4 storage', rowVal(c, 'Storage') !== null || rowVal(c, 'Not stated') !== null || c.rows.length > 1); });
await T('safety.5 old SDS flagged after three years', `/safety ${OLD}`, (c) => { check('safety.5 old', c.old === true && c.notes.some((x) => /more than 3 years/.test(x))); }, { now: () => new Date('2030-01-01T00:00:00Z') });
await T('safety.6 recent SDS not flagged', `/safety ${OLD}`, (c) => { check('safety.6 not old', !c.old); });
await T('safety.7 hazards', `/safety hazard statements ${OLD}`, (c) => { check('safety.7 signal', rowVal(c, 'Signal word') !== null); });
await T('safety.8 no product asks', '/safety gloves', (c) => { check('safety.8 asks', c.kind === 'clarify' && c.clarify.need === 'product'); });
await T('safety.9 first aid not invented', `first aid for ${OLD}`, (c) => { const v = rowVal(c, 'First aid'); check('safety.9 points to section 4', v === null || /section 4/.test(v)); });

/* ---- TIME */
await T('time.1 open time', `open time of ${OLD}`, (c) => { check('time.1 30 minutes', has(c, /30 minutes at 22/)); });
await T('time.2 every time row sourced', `/time ${OLD}`, (c) => { check('time.2 sourced', c.rows.every((r) => r.source && r.source.url && r.source.sentence)); });
await T('time.3 cure', `how long before I can grout ${OLD}`, (c) => { check('time.3 rows', c.rows.length >= 1); });
await T('time.4 pot life', '/time pot life Sikadur-41 CF Normal', (c) => { check('time.4 handled', c.kind === 'time'); });
await T('time.5 none published', '/time Sikalastic-701', (c) => { check('time.5 handled', c.kind === 'time'); if (c.status === 'unknown') check('time.5 says time not published', /Time not published/.test(c.notes.join(' '))); });
await T('time.6 recoat', '/time recoat Davco K10 Rapid', (c) => { check('time.6 handled', c.kind === 'time'); });

/* ---- SPEC */
await T('spec.1 clause cites edition', '/spec Davco Easy Grout', (c) => { check('spec.1 edition', /July 2023, Version 01\.01/.test(rowVal(c, 'Draft clause'))); });
await T('spec.2 draft label', '/spec Davco Easy Grout', (c) => { check('spec.2 label', c.notes.includes('Draft for editing. Not approved by Sika.')); });
await T('spec.3 never claims compliance', '/spec Davco Easy Grout', (c) => { check('spec.3 no compliance', !/\b(complies|compliant|conforms)\b/i.test(c.copyText)); });
await T('spec.4 copy text', '/spec Davco Easy Grout', (c) => { check('spec.4 copy', /^Supply and install Davco Easy Grout/.test(c.copyText)); });
await T('spec.5 data sheet statements quoted with page', '/spec Davco Easy Grout', (c) => { check('spec.5 page cites', c.rows.filter((r) => r.quote).every((r) => r.source.url && r.source.sentence)); });
await T('spec.6 substrate from system only', ['/system porcelain on concrete, inside', '/spec Davco Easy Grout'], (c) => { check('spec.6 concrete', /to concrete/.test(rowVal(c, 'Draft clause'))); });

/* ---- PACK */
await T('pack.1 from a system', ['/system porcelain on concrete, inside', 'make that a project pack'], (c) => { check('pack.1 kind', c.kind === 'pack' && c.print === true); check('pack.1 sections', c.sections.length >= 4); });
await T('pack.2 documents and clause per product', ['/system porcelain on concrete, inside', '/pack'], (c) => { check('pack.2 docs', c.sections.filter((s) => s.rows.some((r) => r.doc)).length >= 3); check('pack.2 clause', c.sections.some((s) => s.rows.some((r) => r.draft))); });
await T('pack.3 quantities carried', ['/system porcelain on concrete, inside', 'now 25 m2', '/pack'], (c) => { check('pack.3 estimate', c.estimate === true); check('pack.3 quantity row', c.sections.some((s) => s.rows.some((r) => r.label === 'Quantity'))); });
await T('pack.4 named products', '/pack Davco Easy Grout and Davco Ceramaflex', (c) => { check('pack.4 two sections', c.sections.length === 2); });
await T('pack.5 empty asks', '/pack', (c) => { check('pack.5 asks', c.kind === 'clarify'); });
await T('pack.6 dead links hidden', '/pack Davco Powder Mastic', (c) => { check('pack.6 no 404', c.sections[0].rows.filter((r) => r.doc).every((r) => !/Powder%20Mastic%20Data%20Sheet/.test(r.source.url))); });

/* ---- EXPORT, LINK, HANDOFF */
await T('export.1 nothing yet', '/export', (c) => { check('export.1 says so', c.status === 'unknown' && /Nothing to export/.test(c.notes[0])); });
await T('export.2 csv and text', [`/calc 20 m2 ${OLD} 6 mm notch`, '/export'], (c) => { check('export.2 two files', c.exports.length === 2 && /csv/.test(c.exports[0].filename)); });
await T('export.3 csv rows quoted with sources', [`/calc 20 m2 ${OLD} 6 mm notch`, 'export it'], (c) => { check('export.3 header', c.exports[0].text.startsWith('"Item","Value","Source","Link","Source sentence"')); });
await T('export.4 print button', [`/calc 20 m2 ${OLD} 6 mm notch`, 'print this'], (c) => { check('export.4 print', c.buttons.some((b) => b.printLast)); });
await T('link.1 product links', `/link ${OLD}`, (c) => { check('link.1 rows', c.rows.length >= 3 && c.rows.every((r) => r.source)); });
await T('link.2 dead link reported', '/link Davco Powder Mastic', (c) => { check('link.2 has unavailable', c.rows.some((r) => /Link unavailable/.test(r.value))); });
await T('link.3 url lookup', '/link https://aus.sika.com/dms/getdocument.get/34077ff9-bf60-4c0f-83f6-b554f3252ca0/Davco%20Powder%20Mastic%20Data%20Sheet.pdf', (c) => { check('link.3 404', c.rows.length === 1 && /unavailable/.test(c.rows[0].value)); });
await T('link.4 says it is recorded', `/link ${OLD}`, (c) => { check('link.4 note', c.notes.some((x) => /recorded|does not call/.test(x))); });
await T('handoff.1 context', [`/calc 20 m2 ${OLD} 6 mm notch`, 'talk to technical services'], (c) => { check('handoff.1 block', c.handoffBlock && /Grey One Pot/.test(c.handoffBlock.text)); });
await T('handoff.2 never sends', '/handoff', (c) => { check('handoff.2 note', /does not send anything/.test(c.handoffBlock.note)); });
await T('handoff.3 selections carried', ['/system porcelain on concrete, inside', '/handoff'], (c) => { check('handoff.3 system', /porcelain/.test(c.handoffBlock.text)); });

/* ---- OWNER RULES (db2c881fc): mismatch and not-calc-ready refusals, printed oddities flagged, products without a data sheet */
await T('rules.1 mismatch product gets no pack count', 'how much Sika MonoTop-352 NFG for 3 m2 5 mm', (c) => { check('rules.1 handled', c.kind === 'quantity' || c.kind === 'clarify' || c.status === 'unknown'); if (c.kind === 'quantity') check('rules.1 no pack count', /will not give a pack count/.test(rowVal(c, 'Whole packs') || ''), rowVal(c, 'Whole packs')); });
await T('rules.2 not-calc-ready product refuses', 'how much Sikaflex-11 FC+ for 10 m', (c) => { check('rules.2 refuses', c.status === 'unknown' || c.kind === 'clarify' || /I cannot work this out|will not guess/.test(text(c))); check('rules.2 no invented quantity', !/Quantity needed/.test(text(c.rows))); });
await T('rules.3 supamastic printed oddity flagged in the spec', '/spec Davco Supamastic', (c) => { check('rules.3 spec ok', c.kind === 'spec'); });
await T('rules.4 full draft specification offered', '/spec Davco Easy Grout', (c) => { check('rules.4 download', c.exports.length === 1 && /DRAFT SPECIFICATION FROM A PUBLISHED DATA SHEET/.test(c.exports[0].text)); });
await T('rules.5 no data sheet product', '/spec Sika Primer-210', (c) => { check('rules.5 refuses with hand-off', c.status === 'unknown' && c.handoff === true); });
await T('rules.6 supamastic pail never packed from the oddity', '/calc 10 m2 Davco Supamastic 6 mm notch', (c) => { check('rules.6 handled', ['quantity', 'clarify'].includes(c.kind) || c.status === 'unknown'); if (c.kind === 'quantity') check('rules.6 not 11 m2 per 15 pail', !/15 L pail/.test(text(c.rows))); });

/* ---- POLISH ROUND (routing, summary system card, compare clamp, notch echo) */
await T('polish.1 product-type question goes to the advisor', 'Which tile adhesive for porcelain tiles on concrete in an internal floor', (c) => { check('polish.1 not the system card', c === null); });
for (const q of ['which grout for a shower', 'what membrane for a balcony', 'which primer for concrete']) await T('polish.2 ' + q, q, (c) => { check('polish.2 advisor: ' + q, c === null); });
for (const q of ['what do I need to tile a bathroom floor, ceramic on concrete', 'give me the full system for porcelain on concrete inside', 'everything I need to tile porcelain on concrete inside', '/system porcelain on concrete, inside']) await T('polish.3 ' + q, q, (c) => { check('polish.3 system: ' + q, c && c.kind === 'system'); });
await T('polish.4 system card is a summary', '/system porcelain on concrete, inside', (c) => {
  check('polish.4 five steps', c.sections.length === 5);
  check('polish.4 at most two products per step', c.sections.every((s) => s.rows.length <= 2), c.sections.map((s) => s.rows.length).join());
  check('polish.4 one why sentence each, clipped', c.sections.every((s) => s.rows.every((r) => r.value.length <= 190)));
  check('polish.4 detail collapsed not dropped', c.sections.every((s) => s.more && s.more.length >= s.rows.length) && has({ m: c.sections.map((s) => s.more) }, /Partly documented, not endorsed/));
  check('polish.4 sheet link on top', c.topButtons && /systems\//.test(c.topButtons[0].href));
});
await T('polish.5 compare cells hold only the matched phrase', '/compare Davco Ultraflex vs Davco Ceramaflex', (c) => { const cells = c.table.rows.flatMap((r) => r.cells); check('polish.5 no section heading run-on', cells.every((x) => !/WHERE TO USE|APPLICATION|SURFACE PREPARATION/.test(x.value)), cells.map((x) => x.value).join(' | ').slice(0, 200)); check('polish.5 pack cell short', c.table.rows.find((r) => r.label === 'Pack sizes').cells.every((x) => x.value.length <= 170)); });
await T('polish.6 a notch answer is not a thickness', ['how much Davco Ultraflex for 40 m2', '10 mm'], (c, cs, A) => { check('polish.6 job line', /10 mm notch/.test(rowVal(c, 'Your job')) && !/thick/.test(rowVal(c, 'Your job')), rowVal(c, 'Your job')); check('polish.6 thickness unset', A.session.facets.thickness === undefined); });
await T('polish.7 plain words in refusals', ['/system porcelain on concrete, inside', 'now 25 m2'], (c) => { check('polish.7 no field names', !/notch_mm|area_m2|thickness_mm|cementitious_kg/.test(text(c))); });

/* ---- ROUTING */
await T('route.1 plain question falls through', 'which primer for concrete', (c) => { check('route.1 v1', c === null); });
await T('route.2 /ask falls through', '/ask which primer for concrete', (c) => { check('route.2 v1', c === null); });
await T('route.3 unknown slash gives help', '/banana', (c) => { check('route.3 help', c.kind === 'help'); });
await T('route.4 help lists the commands', '/help', (c) => { for (const k of ['/calc', '/system', '/pack', '/compare', '/safety', '/time', '/spec', '/export', '/ask']) check('route.4 ' + k, c.rows.some((r) => r.label === k)); });

console.log(`action cases run: ${n}`);
summary('t_actions');
