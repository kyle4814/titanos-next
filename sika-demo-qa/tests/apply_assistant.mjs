// apply_assistant.mjs: node ACCEPT checks for T06 (hand-off), T22 (problem solver), T14 (rule ledger), T11 (insights), T19 (offline).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { plain } from '../src/answer.js';
import { make, check, summary, rd } from './_load.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c');
const { data, assistant } = make();
const byId = new Map(data.products.map(p => [p.id, p]));

// ---------- T06 hand-off ----------
{
  const q = 'Can I tile over a heated floor with Davco Grey One Pot?';
  const a = assistant.ask(q, null);
  const h = a.blocks.find(b => b.type === 'handoff');
  check('T06 heated floor question returns a handoff block', !!h);
  check('T06 handoff text includes the question', !!h && h.text.includes(q));
  check('T06 handoff text includes the product name', !!h && /Davco Grey One Pot/.test(h.text));
  check('T06 handoff names the uncovered term', !!h && /heated/.test(h.reason));
  check('T06 contact link and footer phone come from config', !!h && h.contact.url === data.config.links.contact && h.contact.phone === '+61 2 9725 1145', h && JSON.stringify(h.contact));
  check('T06 note says nothing is sent and no promise of a reply', !!h && /does not send anything/.test(h.note) && /not a promise/.test(h.note));
  check('T06 no invented email address', !!h && !/@/.test(JSON.stringify(h)));
  check('T06 no em or en dashes', !!h && !/[\u2013\u2014]/.test(JSON.stringify(h)));
  const o = assistant.ask('Who won the footy grand final last year?', null);
  check('T06 out of scope gets a handoff', o.blocks.some(b => b.type === 'handoff'));
  check('T06 where to buy / price gets a handoff', assistant.ask('What is the price of Davco Grey One Pot', null).blocks.some(b => b.type === 'handoff'));
  check('T06 answered quote has no handoff', !assistant.ask('How much Davco Trojan Mastic for 40 m2?', null).blocks.some(b => b.type === 'handoff'));
  check('T06 answered compatibility has no handoff', !assistant.ask('Can I use Davco Grey One Pot over concrete?', null).blocks.some(b => b.type === 'handoff'));
  check('T06 greeting has no handoff', !assistant.ask('hello', null).blocks.some(b => b.type === 'handoff'));
}
{ // degrade: a config with no links or footer must not throw
  const { createAssistant } = await import('../src/engine.js');
  const bare = createAssistant({ products: data.products, documents: data.documents, categories: data.categories, pages: data.pages, config: { company: data.config.company } });
  let h = null, err = null; try { h = bare.ask('Who won the footy grand final last year?', null).blocks.find(b => b.type === 'handoff'); } catch (e) { err = e; }
  check('T06 bare config does not throw', !err, err && err.message);
  check('T06 bare config still hands off with empty phone', !!h && h.contact.phone === '');
}

// ---------- T22 problem solver ----------
const qa = JSON.parse(fs.readFileSync(path.join(HERE, 'qa_apply_assistant.json'), 'utf8'));
const pj = data.knowledge && data.knowledge.problems;
check('T22 problems.json is present with 10 chips', !!pj && pj.chips.length === 10, pj && pj.chips.length);
if (pj) {
  for (const c of pj.chips) {
    check(`T22 chip ${c.id} has passages or is declared empty (hand-off only)`, Array.isArray(c.items) && c.products.length === new Set(c.items.map(i => i.product)).size);
    for (const i of c.items) {
      const raw = JSON.parse(fs.readFileSync(path.join(PORTAL, 'data', 'p', i.product + '.json'), 'utf8'));
      const pool = [].concat(raw.usage || [], raw.attributes || [], (raw.sections || []).flatMap(s => (s.items || []).map(x => x.text)));
      check(`T22 ${c.id}: quote is a substring of ${i.product}`, pool.some(t => String(t).includes(i.quote)), i.quote.slice(0, 80));
      check(`T22 ${c.id}: source url is the product page`, i.url === raw.url);
    }
  }
  for (const k of qa.problem) {
    const a = assistant.ask(k.q, null);
    check(`T22 ${k.id} "${k.q}" gets intent problem`, a.intent === 'problem', a.intent);
    const f = a.blocks.find(b => b.type === 'facts');
    check(`T22 ${k.id} shows passages iff the data has them`, !!f === k.hasItems);
    check(`T22 ${k.id} ends with the hand-off`, a.blocks.some(b => b.type === 'handoff'));
    if (f) check(`T22 ${k.id} every shown passage is verbatim product text`, f.rows.every(r => { const q = r.value.replace(/^"|"$/g, ''); return !!r.source.url && pj.chips.find(c => c.id === k.chip).items.some(i => plain(i.quote) === q && i.url === r.source.url); }));
    check(`T22 ${k.id} does not claim a diagnosis`, !/\byour (problem|issue) is\b|\bthe cause is\b|\bcaused by\b/i.test(JSON.stringify(a.blocks)));
    check(`T22 ${k.id} no dashes`, !/[\u2013\u2014]/.test(JSON.stringify(a)));
  }
  for (const k of qa.notProblem) check(`T22 ${k.id} "${k.q}" is not hijacked by the problem intent`, assistant.ask(k.q, null).intent === k.intent, assistant.ask(k.q, null).intent);
}
{ // degrade: no problems file means the intent is off and the old behaviour stays
  const { createAssistant } = await import('../src/engine.js');
  const off = createAssistant({ products: data.products, documents: data.documents, categories: data.categories, pages: data.pages, config: data.config });
  check('T22 without problems.json the intent is off', off.ask('My tiles sound hollow', null).intent !== 'problem');
}

// ---------- T14 rule ledger ----------
{
  const argvSave = process.argv[1];
  const BR = await import('../build_rules.mjs');
  const L = JSON.parse(fs.readFileSync(path.join(PORTAL, 'data', 'rules.json'), 'utf8'));
  const { rows } = BR.build();
  check('T14 rules.json is current: row count equals a fresh build', L.rules.length === rows.length, `${L.rules.length} vs ${rows.length}`);
  check('T14 ids are unique and stable (same ids on a rebuild)', new Set(L.rules.map(r => r.id)).size === L.rules.length && rows.every((r, i) => r.id === L.rules[i].id));
  const blobs = new Map(); const pfull = new Map(data.products.map(p => [p.id, p]));
  let bad = 0, signedBad = 0, noSrc = 0, nonPub = 0, firstBad = '';
  for (const r of L.rules) {
    if (r.type === 'CORRECTION') continue;
    if (!blobs.has(r.product_id)) blobs.set(r.product_id, BR.productBlob(pfull.get(r.product_id)));
    if (!blobs.get(r.product_id).includes(r.quote.replace(/\s+/g, ' ').trim())) { bad++; firstBad = firstBad || r.id + ' ' + r.quote.slice(0, 60); }
    if (r.signed_by || r.signed_on || r.comment) signedBad++;
    if (!/^https:\/\/aus\.sika\.com\//.test(r.source_url)) noSrc++;
    if (r.status !== 'PUBLISHED') nonPub++;
  }
  check('T14 every row quote is a substring of the product text', bad === 0, firstBad);
  check('T14 signed_by, signed_on and comment are empty on every row', signedBad === 0);
  check('T14 every row has a source url on aus.sika.com', noSrc === 0);
  check('T14 every non-correction row is status PUBLISHED, never signed or approved', nonPub === 0 && !/\b(signed off|approved by sika)\b/i.test(JSON.stringify(L.rules.map(r => r.rule))));
  // exclusion count across tile and stone products, extracted independently
  const { compileFacets, extractExclusions } = await import('../src/facets.js');
  const { FACETS } = await import('../src/synonyms.js');
  const comp = compileFacets(FACETS);
  const tileExcl = data.products.filter(p => /tile-stone/.test(p.category)).reduce((n, p) => n + extractExclusions(comp, p).length, 0);
  const ledgerExcl = L.rules.filter(r => r.type === 'EXCLUSION' && /tile-stone/.test(pfull.get(r.product_id).category)).length;
  check('T14 exclusion rows for tile and stone cover every extracted exclusion sentence', ledgerExcl >= tileExcl && tileExcl > 0, `${ledgerExcl} vs ${tileExcl}`);
  const gp = L.rules.filter(r => r.product_id === 'davco-grey-one-potadhesive');
  check('T14 Grey One Pot has at least three rows', gp.length >= 3, gp.length);
  check('T14 Grey One Pot has the "not suitable for tiling over concrete" sentence', gp.some(r => r.type === 'EXCLUSION' && /not suitable for tiling over concrete/i.test(r.quote)));
  for (const t of ['EXCLUSION', 'SUITABLE_FOR', 'CONSUMPTION', 'PACK', 'TIME', 'PRIMER']) check(`T14 type ${t} is present`, L.rules.some(r => r.type === t));
  // CSV round trip: same row count and same ids as the JSON
  const text = fs.readFileSync(path.join(PORTAL, 'data', 'rules.csv'), 'utf8');
  const recs = []; { let cur = [], f = '', q = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; } else if (c === '"') q = true; else if (c === ',') { cur.push(f); f = ''; } else if (c === '\r') { /* skip */ } else if (c === '\n') { cur.push(f); recs.push(cur); cur = []; f = ''; } else f += c; } }
  check('T14 CSV header matches the columns', recs[0].join(',') === L.columns.join(','));
  check('T14 CSV data rows equal the JSON rows', recs.length - 1 === L.rules.length && recs.slice(1).every((c, i) => c[0] === L.rules[i].id && c[10] === '' && c[11] === '' && c[12] === ''), `${recs.length - 1} vs ${L.rules.length}`);
  check('T14 the CSV the browser builds for a filtered set is the same code as the ledger CSV', BR.csv === (await import('../../public/demo/sika-210c0c/assets/lib/csv.js')).toCsv);
}

// ---------- T11 insights and gap list ----------
{
  const IC = await import('../../public/demo/sika-210c0c/assets/lib/insights-core.js');
  const mem = () => { const m = new Map(); return { get: (k, d) => (m.has(k) ? JSON.parse(m.get(k)) : d), set: (k, v) => { m.set(k, JSON.stringify(v)); return true; }, _m: m }; };
  const ins = IC.createInsights(mem());
  const qs = ['Can I use Davco Grey One Pot over concrete?', 'How much Davco Trojan Mastic for 40 m2?', 'Can I tile over a heated floor with Davco Grey One Pot?', 'Who won the footy grand final last year?', 'What is the price of Davco Grey One Pot'];
  const got = qs.map(q => IC.outcomeOf(assistant.ask(q, null)));
  check('T11 two answered questions are ANSWERED_WITH_SOURCE', got[0] === 'ANSWERED_WITH_SOURCE' && got[1] === 'ANSWERED_WITH_SOURCE', got.join(','));
  check('T11 the heated floor question is NOT_IN_PUBLISHED_DATA', got[2] === 'NOT_IN_PUBLISHED_DATA', got[2]);
  check('T11 the footy question is OUT_OF_SCOPE', got[3] === 'OUT_OF_SCOPE', got[3]);
  check('T11 a price question is NOT_IN_PUBLISHED_DATA', got[4] === 'NOT_IN_PUBLISHED_DATA', got[4]);
  check('T11 a greeting is not recorded as a question', IC.outcomeOf(assistant.ask('hello', null)) === null);
  qs.slice(0, 3).forEach((q, i) => ins.question(q, got[i]));
  check('T11 three questions give three rows', ins.data().q.length === 3);
  check('T11 the third is in the gap list and the first two are not', ins.gaps().length === 1 && ins.gaps()[0].t === qs[2]);
  const csvText = IC.gapCsv(ins.gaps());
  check('T11 the gap CSV has a header and exactly one data row', csvText.split('\r\n').filter(Boolean).length === 2 && csvText.startsWith('date,question,outcome'));
  check('T11 dates are day level only', ins.data().q.every(r => /^\d{4}-\d{2}-\d{2}$/.test(r.d)));
  ins.question('call me on 0412 345 678 or email kyle@example.com about Grey One Pot', 'NOT_IN_PUBLISHED_DATA');
  ins.question('Ring +61 2 9725 1145 please', 'CLARIFY');
  const stored = JSON.stringify([...Object.values(Object.fromEntries(ins.data().q.map((r, i) => [i, r.t])))]);
  check('T11 no email address is stored', !/@/.test(stored), stored);
  check('T11 no phone number is stored', !/\d[\d\s()-]{6,}\d/.test(stored), stored);
  check('T11 an unknown outcome is refused', ins.question('x y z', 'BOGUS') === false);
  check('T11 formula-looking questions are neutralised in the CSV', IC.gapCsv([{ d: '2026-10-30', t: '=HYPERLINK("http://x")', o: 'OUT_OF_SCOPE' }]).includes('"\'=HYPERLINK'));
  ins.combo('porcelain / concrete'); ins.combo('porcelain / concrete'); ins.combo('ceramic / plasterboard'); ins.view('davco-grey-one-potadhesive');
  check('T11 most used combination comes first', ins.topCombos()[0][0] === 'porcelain / concrete' && ins.topCombos()[0][1] === 2);
  check('T11 product views are counted by id', ins.topViews()[0][0] === 'davco-grey-one-potadhesive');
  ins.clear();
  check('T11 Clear empties the store', ins.data().q.length === 0 && Object.keys(ins.data().combos).length === 0 && Object.keys(ins.data().views).length === 0);
  const bad = IC.createInsights({ get() { throw new Error('blocked'); }, set() { throw new Error('blocked'); } });
  let thrown = null; try { bad.question('anything here', 'CLARIFY'); bad.clear(); bad.view('x'); } catch (e) { thrown = e; }
  check('T11 blocked storage never throws', !thrown, thrown && thrown.message);
  check('T11 the store key uses the demo prefix', IC.KEY === 'sika-demo-210c0c-insights');
  check('T11 no network call in the module', !/fetch\(|XMLHttpRequest|sendBeacon/.test(fs.readFileSync(path.join(PORTAL, 'assets', 'lib', 'insights-core.js'), 'utf8') + fs.readFileSync(path.join(PORTAL, 'assets', 'lib', 'insights.js'), 'utf8')));
}

// ---------- T19 offline mode ----------
{
  const SW = await import('../build_sw.mjs');
  const fresh = SW.build();
  const onDisk = fs.readFileSync(path.join(PORTAL, 'sw.js'), 'utf8');
  check('T19 sw.js on disk is current (run build_all.sh after any portal file change)', onDisk === fresh.src, 'hash ' + fresh.hash);
  check('T19 cache name carries the hash of every cached file', new RegExp(`const CACHE = PREFIX \\+ '${fresh.hash}'`).test(onDisk));
  check('T19 every listed file exists', fresh.files.every(f => fs.existsSync(path.join(PORTAL, f))));
  check('T19 shell, engine, advisor data, rules and problems are cached', ['index.html', 'assets/app.js', 'assets/assistant/engine.js', 'data/products.json', 'data/index.json', 'data/categories.json', 'data/documents.json', 'data/pages.json', 'data/rules.json', 'data/knowledge/problems.json', 'assets/lib/offline.js'].every(f => fresh.files.includes(f)));
  const tile = data.products.filter(p => /tile-stone/.test(p.category)).map(p => 'data/p/' + p.id + '.json');
  check('T19 exactly the tile and stone product files are cached', tile.length === 37 && tile.every(f => fresh.files.includes(f)) && fresh.files.filter(f => f.startsWith('data/p/')).length === tile.length && fresh.files.filter(f => /^data\/specs\/(?!index)/.test(f)).every(f => tile.includes(f.replace('specs/', 'p/'))), tile.length);
  check('T19 no PDF and no CSV is cached', !fresh.files.some(f => /\.(pdf|csv)$/i.test(f)));
  check('T19 cache size is under 8 MB (TARGET)', fresh.bytes < 8 * 1048576, (fresh.bytes / 1048576).toFixed(2) + ' MB');
  check('T19 the worker has no background sync, push or analytics', !/addEventListener\('(sync|periodicsync|push|notificationclick)'|\.sync\b|pushManager|analytics|sendBeacon|importScripts/i.test(onDisk.split('\n').filter(l => !l.startsWith('//')).join('\n').replace(/const FILES = .*/, '')));
  check('T19 the worker only handles same-origin GET', /req\.method !== 'GET'\) return/.test(onDisk) && /url\.origin !== self\.location\.origin\) return/.test(onDisk));
  const OF = await import('../../public/demo/sika-210c0c/assets/lib/offline.js');
  const st = await OF.initOffline();
  check('T19 where service workers are unavailable the portal degrades with a stated reason', st.supported === false && st.ready === false && /service workers|https/.test(st.reason), st.reason);
  check('T19 the register call is guarded (a host that refuses it only sets a reason)', /catch \(e\) \{ state\.supported = false/.test(fs.readFileSync(path.join(PORTAL, 'assets', 'lib', 'offline.js'), 'utf8')));
}

if (!process.env.APPLY_PART) summary('apply_assistant');
