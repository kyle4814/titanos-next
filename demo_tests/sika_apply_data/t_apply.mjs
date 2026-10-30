// Node tests for the data blocks: T04 provenance, T15 page-cited rates, T16 safety quotes, T20 draft specification, T21 published times, T03 link health.
import fs from 'node:fs';
import { setup, check, summary, textOf, rd, exists, FIXTURE, PORTAL } from './_env.mjs';
import { timesOf, programmeLines, programmeOf, STEPS } from '../../public/demo/sika-210c0c/assets/assistant/times.js';
import { supplyClause, draftText, claimsCompliance, DRAFT_LABEL, referencesLines } from '../../public/demo/sika-210c0c/assets/assistant/clause.js';
import { CHIPS, pickSds, safetyAnswer, rateFacts, rateBlock, STATUS } from '../../public/demo/sika-210c0c/assets/assistant/apply.js';
import { plain } from '../../public/demo/sika-210c0c/assets/assistant/answer.js';

const S = setup();
const nzs = (s) => plain(String(s)).toLowerCase().replace(/[^a-z0-9]+/g, '');

/* ---------------- T04 provenance */
{
  const qs = FIXTURE.questions.map((q) => q.q);
  let blocks = 0, needing = 0, bad = [];
  const asks = [...qs, 'Can I use Davco Grey One Pot over my old tiles?', 'What PPE for Davco Grey One Pot?', 'How long before I can grout Davco Grey One Pot?', 'How much Davco Grey One Pot for 20 m2', 'What is the coverage of Davco Grey One Pot?', 'storage for Davco Trojan Mastic'];
  let st = null;
  const checkAnswer = (a, q) => {
    check('T04 answer has the contract fields: ' + q, ['intent', 'query', 'blocks', 'citations', 'followups', 'state', 'debug'].every((f) => f in a));
    for (const b of a.blocks) {
      blocks++;
      const txt = b.type === 'text' ? b.text : b.type === 'facts' ? b.rows.map((r) => r.value).join(' ') : b.type === 'quote' ? b.lines.map((l) => l.quantity + l.basis).join(' ') : null;
      if (txt === null) continue;
      if (b.type === 'text' && !(/\d|not suitable/i.test(txt))) continue;
      needing++;
      const ok = (b.evidence && b.evidence.length >= 1) || b.chip === CHIPS.unknown;
      if (!ok) bad.push(q + ' :: ' + txt.slice(0, 80));
      if (b.evidence && b.evidence.length) check('T04 PUBLISHED status has a chip: ' + q, b.status === STATUS.PUBLISHED && !!b.chip);
    }
    check('T04 no "signed" in assistant output: ' + q, !/\bsigned\b/i.test(JSON.stringify(a.blocks)));
    check('T04 no "approved by" in output: ' + q, !/approved by (sika|the company)/i.test(textOf(a)));
    check('T04 no em/en dash in output: ' + q, !/[\u2013\u2014]/.test(JSON.stringify(a.blocks)));
  };
  for (const q of asks) checkAnswer(await S.ask(q, null), q);
  for (const sc of FIXTURE.scenarios || []) { let s2 = null; for (const t of sc.turns) { const a = await S.ask(t.q, s2); s2 = a.state; checkAnswer(a, sc.id + ': ' + t.q); } }
  check(`T04 every factual block (${needing} of ${blocks}) has evidence or the Not-in-the-published-data chip`, bad.length === 0, bad.slice(0, 3).join(' | '));
  // the headline case
  const a = await S.ask('Can I use Davco Grey One Pot over my old tiles?', null);
  const blk = a.blocks.find((b) => b.evidence && b.evidence.length && /is not suitable for tiling over concrete, waterproofing membranes or existing ceramic tiles/.test(b.text || ''));
  check('T04 old tiles: the data sheet sentence is in the answer', !!blk, textOf(a));
  check('T04 old tiles: answer starts with No', !!blk && /^No\./.test(blk.text));
  check('T04 old tiles: evidence link starts with https://aus.sika.com/', !!blk && blk.evidence.every((e) => e.url.startsWith('https://aus.sika.com/')));
  check('T04 old tiles: evidence quote contains the sentence', !!blk && blk.evidence.some((e) => /is not suitable for tiling over concrete, waterproofing membranes or existing ceramic tiles/.test(e.quote)));
  check('T04 old tiles: evidence has the PDF page', !!blk && blk.evidence.some((e) => e.page === 1 && /\.pdf$/.test(e.url)));
  check('T04 old tiles: chip text', !!blk && blk.chip === CHIPS.sheet);
  // an answer the data cannot give says so
  const u = await S.ask('Can I use Davco Grey One Pot over timber decking?', null);
  check('T04 unknown substrate does not invent a yes', !/^Yes/.test(textOf(u)) , textOf(u).slice(0, 200));
  // a yes
  const y = await S.ask('Can I use Davco Grey One Pot on plasterboard?', null);
  const yb = y.blocks.find((b) => b.verdict);
  check('T04 plasterboard: a yes quotes the data sheet', !!yb && yb.verdict === 'yes' && yb.evidence.length > 0, textOf(y).slice(0, 300));
  // verbatim: each quoted evidence in compat answers is in the lane text
  const compat = rd('k/davco-grey-one-potadhesive').compat;
  check('T04 evidence quotes are lane sentences', (blk ? blk.evidence : []).every((e) => compat.some((r) => nzs(r.text).includes(nzs(e.quote).replace(/\.\.\.$/, '')))));
  // the code can never emit SIGNED
  check('T04 STATUS has no SIGNED', !('SIGNED' in STATUS) && !Object.values(CHIPS).some((c) => /signed/i.test(c)));
}

/* ---------------- T15 page-cited rates */
{
  const gp = rd('k/davco-grey-one-potadhesive');
  const f = rateFacts(gp);
  check('T15 Grey One Pot fact equals the data sheet phrase', f.length === 1 && f[0].text === '10 Litres of Davco Grey One Pot adhesive cover approximately 7.5m2 (based on a 6mm notched trowel)', f.map((x) => x.text).join('|'));
  check('T15 Grey One Pot fact cites version and page', f[0].s.v === 'November 2023, Version 01.02' && f[0].s.p === 2 && f[0].s.t === 'PDS');
  const a = await S.ask('What is the coverage of Davco Grey One Pot?', null);
  const rb = a.blocks.find((b) => b.rates);
  check('T15 consumption answer shows the page-cited rate block', !!rb && /page 2/.test(rb.rows[0].source.label) && /November 2023, Version 01\.02/.test(rb.rows[0].source.label) && rb.rows[0].source.url.endsWith('#page=2'));
  const mm = JSON.parse(fs.readFileSync(new URL('./rates_mismatch.json', import.meta.url), 'utf8'));
  check('T15 mismatch log exists with counts', mm.compared > 0 && mm.match + mm.mismatch + mm.engine_missing === mm.compared, JSON.stringify({ c: mm.compared, m: mm.match, x: mm.mismatch, e: mm.engine_missing }));
  const tile = mm.mismatches.filter((m) => m.category.includes('tile-stone'));
  const EXPLAINED = { 'davco-supamastic': 'unit inferred by the lane (15 Pail read as 15 L); the engine parsed only the 4 L line', 'sikaceram-880-easyepoxy': 'sentence "1.6 kg/m2 and mm layer thickness" read per mm by the lane, flat by the engine' };
  check('T15 every tile and stone mismatch is explained', tile.every((m) => EXPLAINED[m.id]), tile.map((m) => m.id).join(','));
  console.log(`  T15 info: compared ${mm.compared}, match ${mm.match}, mismatch ${mm.mismatch}, engine missing ${mm.engine_missing}; tile and stone mismatches ${tile.length} (${tile.map((m) => m.id).join(', ')})`);
  check('T15 mismatch ids reach the data index', mm.mismatches.every((m) => S.idx.rate_mismatch.includes(m.id)));
  const q = await S.ask('How much SikaCeram 880 EasyEpoxy for 20 m2', null);
  check('T15 a mismatched product gets no computed pack count', !q.blocks.some((b) => b.type === 'quote') && q.blocks.some((b) => b.rates), JSON.stringify(q.blocks.map((b) => b.type)));
  // every displayed rate cites its source; PDS facts carry version and page
  let n = 0, pds = 0, web = 0, badc = [];
  for (const p of S.products) { if (!exists('k/' + p.id)) continue; const rb2 = rateBlock(p.name, rd('k/' + p.id)); if (!rb2) continue; for (const r of rb2.rows) { n++; const e = r.evidence[0]; if (e.kind === 'pds') { pds++; if (!e.page || !(e.version || /version not stated/.test(e.label))) badc.push(p.id); } else { web++; if (!e.url) badc.push(p.id); } } }
  check(`T15 all ${n} displayed rates cite a source (${pds} data sheet with version and page, ${web} product page)`, badc.length === 0, badc.slice(0, 3).join(','));
  // unverified raw facts never shown: every shown fact id exists in the lane output
  const lane = JSON.parse(fs.readFileSync('/home/tech2/klinge-kernel/state/sika/lanes/knowledge/rates.json', 'utf8'));
  const ids = new Set(); for (const p of Object.values(lane.products)) for (const g of Object.values(p.facts)) for (const x of g) ids.add(x.id);
  let missing = 0; for (const p of S.products) { if (!exists('k/' + p.id)) continue; for (const x of rateFacts(rd('k/' + p.id))) if (!ids.has(x.id)) missing++; }
  check('T15 every shown fact id is in the lane rates.json', missing === 0, missing);
}

/* ---------------- T16 safety */
{
  const k = rd('k/davco-grey-one-potadhesive'); const sds = pickSds(k);
  check('T16 Grey One Pot SDS revision date from the lane (18.11.2025)', sds && sds.revision_date === '18.11.2025', sds && sds.revision_date);
  const a = await S.ask('What PPE for Davco Grey One Pot?', null);
  check('T16 PPE answer intent', a.intent === 'safety');
  const facts = a.blocks.find((b) => b.type === 'facts' && b.safety);
  check('T16 PPE answer has quoted lines with sources', !!facts && facts.rows.length >= 3 && facts.rows.every((r) => r.missing || (r.source && /\/sds-davco-grey-onepotadhesive\.pdf$/.test(r.source.url))), JSON.stringify(facts && facts.rows.map((r) => r.label)));
  check('T16 quoted-from line', a.blocks.some((b) => /Quoted from the safety data sheet dated 18\.11\.2025/.test(b.text || '')) && a.blocks.some((b) => /Check the current SDS before use/.test(b.text || '')));
  check('T16 gloves row is verbatim from the lane', facts.rows.some((r) => /Butyl rubber\/nitrile rubber gloves/.test(r.value)));
  const h = await S.ask('What are the hazards of Davco Grey One Pot', null);
  const hrow = h.blocks.find((b) => b.safety);
  check('T16 no hazard statements says Not stated in this SDS', hrow.rows.some((r) => r.value === 'Not stated in this SDS'), JSON.stringify(hrow.rows.map((r) => r.value)));
  const fa = await S.ask('First aid for Davco Trojan Mastic', null);
  check('T16 first aid is not invented', fa.blocks.some((b) => b.safety && b.rows.some((r) => r.label === 'First aid' && /Not stated/.test(r.value))), textOf(fa).slice(0, 300));
  const nm = await S.ask('What PPE for tile adhesive?', null);
  check('T16 a question that names no product does not get a product SDS', nm.intent !== 'safety', nm.intent);
  for (const q of ['Does Sikafloor-264 give protection against chemicals?', 'Is Davco Grey One Pot safe to use on tiles over concrete?', 'Which Sikaflex is for glass?']) { const r = await S.ask(q, null); check('T16 does not hijack: ' + q, r.intent !== 'safety', r.intent); }
  for (const q of ['What gloves for Davco Trojan Mastic?', 'Do I need a respirator with Sikafloor-264?', 'How should I store Davco Easy Grout?']) { const r = await S.ask(q, null); check('T16 answers: ' + q, r.intent === 'safety' && r.blocks.some((b) => b.safety), r.intent); }
  const none = S.products.find((p) => exists('k/' + p.id) && !pickSds(rd('k/' + p.id)));
  if (none) { const r = safetyAnswer(none.name, rd('k/' + none.id), 'ppe'); check('T16 product without an SDS says so', r[0].status === STATUS.UNKNOWN && /No safety data sheet/.test(r[0].text)); }
  // no medical advice, no emergency number unless quoted
  let bad = 0; for (const p of S.products.slice(0, 200)) { if (!exists('k/' + p.id)) continue; const r = safetyAnswer(p.name, rd('k/' + p.id), 'ppe hazard storage first aid'); const t = JSON.stringify(r); if (/\b000\b|triple zero|call an ambulance|seek medical/i.test(t.replace(/Not stated in this SDS extract[^"]*/g, ''))) { const raw = JSON.stringify(rd('k/' + p.id).safety); if (!/seek medical|\b000\b/i.test(raw)) bad++; } }
  check('T16 no advice text beyond the SDS words', bad === 0, bad);
}

/* ---------------- T21 times */
{
  const k = rd('k/davco-grey-one-potadhesive'); const lines = programmeLines(k); const by = Object.fromEntries(lines.map((l) => [l.step, l]));
  check('T21 open time 30 minutes', /^30 minutes/.test(by.open.text) && /30 minutes at 22/.test(by.open.quote));
  check('T21 adjustability 15 to 25 minutes', by.adjust.text === '15 to 25 minutes' && /15-25 minutes/.test(by.adjust.quote));
  check('T21 setting time 24 hours before grouting', /^24 hours/.test(by.grout.text) && /before grouting/.test(by.grout.quote));
  check('T21 dry area service 24 hours', by.dry.text === '24 hours' && /dry area service/.test(by.dry.quote));
  check('T21 wet area service minimum 7 days', by.wet.text === 'minimum 7 days' && /wet area service/.test(by.wet.quote));
  check('T21 steps with no published time say so', by.foot.text === 'Time not published' && by.pot.text === 'Time not published' && by.recoat.text === 'Time not published');
  check('T21 the conditions show beside the time', /22 degrees C/.test(by.open.text));
  // property: no time is ever output that is not in the source text
  let outNums = 0, bad = [], prods = 0, yielding = 0, adhGrout = 0;
  for (const p of S.products) {
    if (!exists('k/' + p.id)) continue; const kk = rd('k/' + p.id); prods++;
    const ts = timesOf(kk); if (ts.length) yielding++;
    if (/tile-stone-installationsystems\/(tile-adhesives|tile-grouts)/.test(p.category)) { adhGrout++; }
    for (const t of ts) {
      if (!t.amount) continue; const src = nzs(t.text);
      const nums = (t.amount.match(/\d+(\.\d+)?/g) || []);
      for (const n of nums) { outNums++; if (!new RegExp('(^|[^0-9.])' + n.replace('.', '\\.') + '([^0-9]|$)').test(plain(kk.times[t.kind].find((f) => f.id === t.id).text).replace(/,/g, ''))) bad.push(p.id + ':' + n); }
    }
  }
  check(`T21 property: all ${outNums} printed time figures occur in their source sentence`, bad.length === 0, bad.slice(0, 5).join(','));
  let adhY = 0, adhN = 0; for (const p of S.products) { if (!exists('k/' + p.id) || !/tile-stone-installationsystems\/(tile-adhesives|tile-grouts)/.test(p.category)) continue; (timesOf(rd('k/' + p.id)).length ? adhY++ : adhN++); }
  console.log(`  T21 info: ${yielding} of ${prods} products with a lane file yield at least one time; tile adhesives and grouts: ${adhY} of ${adhY + adhN} yield at least one time`);
  check('T21 report share computed', adhY + adhN > 0);
  const a = await S.ask('How long before I can grout Davco Grey One Pot?', null);
  check('T21 advisor answers a grouting time with the sentence and source', a.intent === 'times' && a.blocks.some((b) => b.rows && b.rows.some((r) => /24 hours \(before grouting\)/.test(r.value) && r.source && /page 2/.test(r.source.label))), textOf(a).slice(0, 300));
  const a2 = await S.ask('What is the pot life of Davco Grey One Pot?', null);
  check('T21 advisor says time not published for a missing time', a2.blocks.some((b) => b.rows && b.rows.some((r) => r.value === 'Time not published')), textOf(a2).slice(0, 300));
}

/* ---------------- T20 draft specification */
{
  const spec = JSON.parse(fs.readFileSync(PORTAL + '/data/spec/davco-smp-evo.json', 'utf8'));
  const c = supplyClause({ product: 'Davco SMP EVO', substrate: 'concrete', title: spec.datasheet.title, version: spec.datasheet.version ? 'Version ' + spec.datasheet.version : null, date: spec.datasheet.issued });
  check('T20 clause embeds the data sheet title, version and date', /Davco SMP EVO, Version 01\.01, September 2022\.$/.test(c) && /^Supply and install Davco SMP EVO to concrete in accordance with the manufacturer's data sheet/.test(c), c);
  let n = 0, bad = [], noComp = 0, stdBad = 0;
  const cat = rd('index'); const ds = rd('documents');
  for (const p of S.products) {
    const f = PORTAL + '/data/spec/' + p.id + '.json'; if (!fs.existsSync(f)) continue; n++;
    const sp = JSON.parse(fs.readFileSync(f, 'utf8')); const t = draftText(sp);
    if (!t.startsWith(DRAFT_LABEL)) bad.push(p.id + ' label');
    const ed = sp.datasheet.edition || ''; if (ed && !t.includes(ed.split(',')[0])) bad.push(p.id + ' edition ' + ed);
    if (claimsCompliance(t.replace(/Draft for specifier review[^\n]*\n?/, ''))) noComp++;
    for (const r of referencesLines(sp.standards)) if (!(sp.standards || []).some((s) => r.startsWith(plain(s.citation)))) stdBad++;
  }
  check(`T20 ${n} draft texts carry the label and the data sheet edition`, bad.length === 0, bad.slice(0, 4).join(' | '));
  console.log(`  T20 info: ${n} products have a draft specification; ${noComp} contain a compliance word in the data sheet's own quoted wording`);
  check('T20 references list only standards the data sheet cites', stdBad === 0);
  check('T20 supply clause never claims compliance', !claimsCompliance(c));
  const sm = JSON.parse(fs.readFileSync(PORTAL + '/data/spec/davco-smp-evo.json', 'utf8'));
  check('T20 no standard text reproduced beyond the citation', draftText(sm).includes('These standards are not reproduced here.') || !(sm.standards || []).length);
}

/* ---------------- T03 link health */
{
  const st = rd('stats'); const ds = rd('doc_status'); const docs = rd('documents');
  check('T03 stats has docs_link_ok, docs_link_failed, docs_link_unchecked', ['docs_link_ok', 'docs_link_failed', 'docs_link_unchecked'].every((k) => typeof st[k] === 'number'));
  check('T03 ok + failed + unchecked = documents', st.docs_link_ok + st.docs_link_failed + st.docs_link_unchecked === docs.length, JSON.stringify(st));
  check('T03 unchecked fell below the full list', st.docs_link_unchecked < docs.length);
  check('T03 tile and stone documents are all checked', st.docs_link_unchecked_tile_stone === 0, st.docs_link_unchecked_tile_stone);
  const failed = docs.filter((d) => ds[d.id] && ds[d.id].status !== 200);
  check('T03 there are known non-200 links', failed.length > 0 && failed.length === st.docs_link_failed, failed.length);
  // never offered: library list (docOk), assistant documents, and the safety/draft bundles
  const S2 = setup();
  const failedIds = new Set(failed.map((d) => d.id)); let offered = 0; const prods = new Set(failed.flatMap((d) => d.products || []));
  for (const pid of [...prods].slice(0, 12)) { const p = S2.products.find((x) => x.id === pid); if (!p) continue; for (const q of [`datasheet for ${p.name}`, `${p.name} SDS`, `${p.name} documents`]) { const a = await S2.ask(q, null); for (const b of a.blocks) if (b.type === 'docs') for (const it of b.items) if (failedIds.has(it.id)) offered++; } }
  check(`T03 a known 404 document is never offered by the advisor (${prods.size} products with a failed document)`, offered === 0, offered);
  check('T03 the failed ones are real 404 or error codes', failed.every((d) => ds[d.id].status >= 400));
}
summary('t_apply');
