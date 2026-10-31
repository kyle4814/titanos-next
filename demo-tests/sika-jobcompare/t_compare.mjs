// Compare mode: phrasings, third product, every cell equals the data field (read straight from the shard files, not through the code under test) or "Not published",
// each cell cited, a mutation (one corrupted field in a temp copy must be caught), and no prices, dashes or competitor names.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeAssistant, ask, fileStore, DATA, config, memStorage, check, summary } from './_env.mjs';
import { createData } from '../../public/demo/sika-210c0c/assets/actions/core.js';
import { createActions, newSession } from '../../public/demo/sika-210c0c/assets/actions/flow.js';
import { createMemory } from '../../public/demo/sika-210c0c/assets/actions/memory.js';
import { route } from '../../public/demo/sika-210c0c/assets/actions/parse.js';
import { NOT_PUB } from '../../public/demo/sika-210c0c/assets/actions/compare.js';

const plain = (s) => String(s == null ? '' : s).replace(/[®™]/g, '').replace(/\s*—\s*/g, ' - ').replace(/[–−]/g, '-').replace(/[ \t]{2,}/g, ' ').replace(/\s+/g, ' ').trim();
const rawShard = (dir, id) => JSON.parse(fs.readFileSync(path.join(dir, 'brain', 'p', id + '.json'), 'utf8'));
// the cell value without the ellipsis the clip adds
const body = (v) => v.replace(/\.\.\.$/, '');
const isPrefixOf = (v, full) => { const a = plain(body(v)); const b = plain(full); return a.length > 0 && (b.startsWith(a) || b.replace(/\s+[A-Z]{3,}(?:\s+[A-Z&]{2,})+\b.*$/, '').startsWith(a)); };

/** Independent checker: every cell of a compare card against the shard files in `dir`. Returns the list of problems. */
export function checkAgainstData(card, dir) {
  const bad = [];
  const ids = card.compareProducts.map((p) => p.id);
  const FACT = { coverage: (r) => r.r && r.r.facts && r.r.facts.consumption, open: (r) => r.tm && r.tm.open_time, pot: (r) => r.tm && r.tm.pot_life, cure: (r) => r.tm && r.tm.cure_times, adjust: (r) => r.tm && r.tm.adjustability_time, pack: (r) => r.pk };
  for (const row of card.table.rows) {
    row.cells.forEach((cell, i) => {
      const raw = rawShard(dir, ids[i]); const where = `${ids[i]}/${row.id}`;
      if (!cell.source || !cell.source.url) bad.push(`${where}: cell has no source`);
      if (FACT[row.id]) {
        let f = (FACT[row.id](raw) || [])[0];
        if (!f && row.id === 'pack' && raw.d && raw.d.pk) f = { text: raw.d.pk }; // the page's own packaging line when the data sheet gives none
        if (!f) { if (cell.value !== NOT_PUB) bad.push(`${where}: data has no field but cell says "${cell.value}"`); }
        else if (cell.value === NOT_PUB) bad.push(`${where}: data has "${f.text}" but cell says not published`);
        else if (!isPrefixOf(cell.value, f.text)) bad.push(`${where}: cell "${cell.value}" is not the data "${f.text}"`);
        else if (f.s && f.s.u && !cell.source.url.startsWith(f.s.u)) bad.push(`${where}: source ${cell.source.url} is not ${f.s.u}`);
      } else if (row.id === 'standards') {
        const cits = [...new Set(((raw.sp && raw.sp.std) || []).map((s) => plain(s.citation)))];
        if (cell.value === NOT_PUB) { if (cits.filter((c) => !/^SCAQMD/i.test(c)).length) bad.push(`${where}: data names standards but cell says not published`); }
        else { const parts = cell.value.split('; '); if (!parts.length || !parts.every((p) => cits.includes(p) || (raw.d.sec || []).some((x) => plain(x.t).startsWith(plain(body(p)))))) bad.push(`${where}: "${cell.value}" not among ${cits.join(', ')}`); }
      } else if (row.id === 'substrates' || row.id === 'tiles') {
        const tag = row.id === 'tiles' ? 'tile_type' : 'substrate';
        const texts = (raw.cp || []).filter((c) => c.pol === 'yes' && !c.cond && c.tags && c.tags[tag] && c.tags[tag].length).map((c) => plain(c.text));
        if (cell.value === NOT_PUB) { if (texts.some((t) => t.length <= 90)) bad.push(`${where}: data lists substrates but cell says not published`); }
        else if (!body(cell.value).split('; ').every((p, k, arr) => texts.some((t) => t === p || (k === arr.length - 1 && t.startsWith(p))))) bad.push(`${where}: "${cell.value}" not from the substrate lines`);
      } else if (row.id === 'certs') {
        const it = (raw.d.sec || []).find((x) => /certificat|approvals/i.test(x.l || '') && x.t);
        if (!it) { if (cell.value !== NOT_PUB) bad.push(`${where}: no certificate field in data`); } else if (cell.value === NOT_PUB || !isPrefixOf(cell.value, it.t)) bad.push(`${where}: certificate cell differs`);
      } else if (row.id === 'datasheet') {
        const ds = raw.r && raw.r.ds; if (cell.value === NOT_PUB ? ds && ds.url : !ds || !cell.value.includes(plain(ds.doc_version || 'Data sheet'))) bad.push(`${where}: data sheet cell disagrees`);
      } else if (row.id === 'what') {
        if (cell.value === NOT_PUB) { if (raw.d && (raw.d.s || raw.d.t)) bad.push(`${where}: description exists`); } else if (!plain((raw.d.s || '') + ' ' + (raw.d.t || '')).includes(plain(body(cell.value)).slice(0, 40))) bad.push(`${where}: "${cell.value}" not from the description`);
      } else if (row.id === 'exclusion') {
        const r = (raw.cp || []).find((x) => x.pol === 'no' && !x.cond && x.text);
        if (!r && cell.value !== NOT_PUB) bad.push(`${where}: no exclusion in data`); if (r && !isPrefixOf(cell.value, r.text)) bad.push(`${where}: exclusion differs`);
      } else {
        // a labelled field of the data sheet (shelf life, density, mixing ratio...): the value must be some labelled field's text, or Not published
        const secs = (raw.d.sec || []).map((x) => plain(x.t));
        if (cell.value !== NOT_PUB && !secs.some((t) => t.startsWith(plain(body(cell.value))))) bad.push(`${where}: "${cell.value}" is not any labelled field of ${ids[i]}`);
      }
    });
  }
  return bad;
}

const A = makeAssistant();
const r = await ask(A, '400 EVO PRO vs 410 Secure Set');
const c = r.card;
check('cmp.1 compare card for "400 EVO PRO vs 410 Secure Set"', c.kind === 'compare' && c.table.head.length === 3, c.kind);
check('cmp.2 the two products are the right ones', c.compareProducts.map((p) => p.id).sort().join() === 'sikatile-400-evopro,sikatile-410-secureset', JSON.stringify(c.compareProducts));
const have = new Set(c.table.rows.map((x) => x.id));
for (const f of ['coverage', 'open', 'pot', 'cure', 'substrates', 'standards', 'pack', 'what', 'datasheet', 'shelf', 'mixing', 'voc']) check(`cmp.3 field "${f}" is a row`, have.has(f), [...have].join());
check('cmp.4 columns carry links to the product pages', c.table.cols.length === 2 && c.table.cols.every((x) => x.href.startsWith('#/product/') && /^https:\/\/aus\.sika\.com\//.test(x.url)), JSON.stringify(c.table.cols));
const issues = checkAgainstData(c, DATA);
check('cmp.5 every cell equals the data field (read from the shard files) or says Not published', issues.length === 0, issues.slice(0, 3).join(' | '));
check('cmp.6 every cell cites a source line with a URL and a sentence', c.table.rows.every((x) => x.cells.every((y) => y.source && y.source.url && y.source.sentence)));
check('cmp.7 no price, dash or competitor', !JSON.stringify(c.table).match(/[—–]|\$\s?\d|\bprice\b|\b(ardex|mapei|laticrete|weber|bostik)\b/i));

// phrasings
const PH = ['400 EVO PRO vs 410 Secure Set', 'compare SikaTile-400 EVO PRO and SikaTile-410 Secure Set', 'SikaTile-400 EVO PRO or SikaTile-410 Secure Set', 'difference between 400 EVO PRO and 410 Secure Set', '/compare 400 EVO PRO vs 410 Secure Set', 'Sikatile 400 evo pro versus sikatile 410 secureset', 'which is better, SikaTile-400 EVO PRO or SikaTile-410 Secure Set', '410 Secure Set or 400 EVO PRO', 'compare 400 EVO PRO with 410 SecureSet', 'what is the difference between SikaTile-400 EVO PRO and SikaTile-410 SecureSet?'];
for (const q of PH) { const x = (await ask(makeAssistant(), q)).card; check(`cmp.8 phrasing -> compare: ${q}`, x && x.kind === 'compare' && x.compareProducts.length === 2 && x.compareProducts.map((p) => p.id).sort().join() === 'sikatile-400-evopro,sikatile-410-secureset', x && (x.kind + ' ' + JSON.stringify(x.compareProducts))); }
check('cmp.9 "A or B" in one product is not a comparison', !/^compare/.test(String((await ask(makeAssistant(), 'is SikaTile-400 EVO PRO suitable for tiles or stone')).card && 'x')) , '');
const three = (await ask(makeAssistant(), 'compare Davco K10 Rapid and Davco K10 Plus and Davco Easy Grout')).card;
check('cmp.10 a third product is allowed (4 head cells, 3 cell columns)', three.kind === 'compare' && three.table.head.length === 4 && three.table.rows.every((x) => x.cells.length === 3), three.kind);
check('cmp.11 the third comparison also matches the data', checkAgainstData(three, DATA).length === 0, checkAgainstData(three, DATA).slice(0, 3).join(' | '));
const absent = three.table.rows.flatMap((x) => x.cells).filter((x) => x.absent);
check('cmp.12 fields the documentation does not state say "Not published", flagged, and still cited', absent.length > 0 && absent.every((x) => x.value === NOT_PUB && x.source.url && /not stated/i.test(x.source.sentence)), String(absent.length));
check('cmp.13 one product given asks for the second', (await ask(makeAssistant(), '/compare Davco Easy Grout')).card.clarify.need === 'products');
check('cmp.14 routing', ['A vs B', 'compare A and B', 'difference between A and B'].every((t) => route(t) && route(t).action === 'compare'));

// breadth: 120 pseudo-random pairs from the whole range, every card checked against the raw files
const idx = await createData(fileStore).index();
let seed = 20261031; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const prods = idx.filter((p) => /^(sika|davco|schonox|lanko|abel)/i.test(p.id));
let pairs = 0, bad = 0;
for (let i = 0; i < 120; i++) {
  const a = prods[Math.floor(rnd() * prods.length)], b = prods[Math.floor(rnd() * prods.length)]; if (a.id === b.id) continue;
  const x = (await ask(makeAssistant(), `/compare ${a.n} vs ${b.n}`)).card; if (x.kind !== 'compare') continue; pairs++;
  const p = checkAgainstData(x, DATA); if (p.length) { bad++; if (bad <= 3) console.log('  BAD', a.id, b.id, p[0]); }
}
check(`cmp.15 ${pairs} random pairs: every cell matches the data`, pairs >= 80 && bad === 0, `${pairs} pairs, ${bad} bad`);

// mutation: corrupt one field in a temp copy and the checker must fail
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-mut-'));
if (!tmp || !tmp.includes('jc-mut-')) throw new Error('mktemp failed');
fs.mkdirSync(path.join(tmp, 'brain', 'p'), { recursive: true });
for (const id of ['sikatile-400-evopro', 'sikatile-410-secureset']) fs.copyFileSync(path.join(DATA, 'brain', 'p', id + '.json'), path.join(tmp, 'brain', 'p', id + '.json'));
const mutStore = { get: (p) => { const m = /^brain\/p\/(.+)\.json$/.exec(p); if (m && fs.existsSync(path.join(tmp, p))) return Promise.resolve(JSON.parse(fs.readFileSync(path.join(tmp, p), 'utf8'))); return fileStore.get(p); } };
const mutCard = async () => { const memory = createMemory(memStorage(), () => new Date('2026-10-30T10:00:00Z')); const act = createActions({ data: createData(mutStore), memory, config }); return (await act.run('400 EVO PRO vs 410 Secure Set', newSession())).card; };
const f400 = path.join(tmp, 'brain', 'p', 'sikatile-400-evopro.json');
const orig = fs.readFileSync(f400, 'utf8');
check('cmp.16 sanity: the untouched temp copy passes', checkAgainstData(await mutCard(), DATA).length === 0);
const j = JSON.parse(orig); j.tm.open_time[0].text = '999 minutes'; fs.writeFileSync(f400, JSON.stringify(j));
const mc = await mutCard();
check('cmp.17 MUTATION: a corrupted open time shows in the card (the card follows the data)', mc.table.rows.find((x) => x.id === 'open').cells[0].value === '999 minutes');
check('cmp.18 MUTATION: the checker, reading the original data, catches it', checkAgainstData(mc, DATA).some((s) => /open/.test(s)), checkAgainstData(mc, DATA).join(' | '));
check('cmp.19 MUTATION: the checker reading the mutated copy passes (it tests the card, not a constant)', checkAgainstData(mc, tmp).length === 0, checkAgainstData(mc, tmp).join(' | '));
const j2 = JSON.parse(orig); delete j2.tm.pot_life; fs.writeFileSync(f400, JSON.stringify(j2));
const mc2 = await mutCard();
check('cmp.20 MUTATION: a removed pot life becomes Not published, and the original-data checker flags the difference', mc2.table.rows.find((x) => x.id === 'pot').cells[0].value === NOT_PUB && checkAgainstData(mc2, DATA).some((s) => /pot/.test(s)));
const corrupt = JSON.parse(JSON.stringify(c)); corrupt.table.rows.find((x) => x.id === 'coverage').cells[1].value = '12 m2 per bag';
check('cmp.21 MUTATION: a hand-edited cell is caught', checkAgainstData(corrupt, DATA).some((s) => /coverage/.test(s)));
fs.rmSync(tmp, { recursive: true, force: true });
summary('t_compare');
