// run_qa.mjs: runs tests/qa_fixture.json against the engine, prints a table, writes qa_result.json, exits non-zero on any failure.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine } from './_engine.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(HERE, 'golden_fixture.json'), 'utf8'));
const { data, assistant } = await loadEngine({ layered: true });
const pById = new Map(data.products.map(p => [p.id, p]));
const dById = new Map(data.documents.map(d => [d.id, d]));
const phrase = `From ${data.config.company.publishedDocsPhrase}.`;
const cp = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const r2 = (x) => String(Math.round(x * 100) / 100);
const ok = (d) => !d.http || d.http.status === 200;

function textOf(ans) {
  const out = [];
  for (const b of ans.blocks) {
    if (b.type === 'text') out.push(b.text);
    if (b.type === 'ask') out.push(b.question);
    if (b.type === 'facts') for (const r of b.rows) out.push(r.label + ' ' + r.value);
    if (b.type === 'products') for (const i of b.items) out.push(i.reason);
  }
  return out.join('\n');
}
const productIds = (ans) => ans.blocks.filter(b => b.type === 'products').flatMap(b => b.items.map(i => i.id));
const topProduct = (ans) => productIds(ans)[0] || (ans.blocks.find(b => b.type === 'docs') && (dById.get(ans.blocks.find(b => b.type === 'docs').items[0].id) || { products: [] }).products[0]) || (ans.state && ans.state.productId) || '-';

function walkStrings(o, fn, key = '') { if (typeof o === 'string') { if (key !== 'url') fn(o); } else if (Array.isArray(o)) o.forEach(x => walkStrings(x, fn, key)); else if (o && typeof o === 'object') for (const k of Object.keys(o)) walkStrings(o[k], fn, k); }

function generic(ans, errs) {
  for (const f of ['intent', 'query', 'blocks', 'citations', 'followups', 'state', 'debug']) if (!(f in ans)) errs.push('missing field ' + f);
  if (!ans.debug || !Array.isArray(ans.debug.tokens) || !Array.isArray(ans.debug.matched) || typeof ans.debug.ms !== 'number') errs.push('bad debug');
  const last = ans.blocks[ans.blocks.length - 1];
  if (!ans.blocks.some(b => b.type === 'text' && b.text === phrase)) errs.push('missing publishedDocsPhrase sentence');
  const types = ['text', 'products', 'docs', 'facts', 'quote', 'ask', 'steps', 'handoff'];
  for (const b of ans.blocks) if (!types.includes(b.type)) errs.push('bad block type ' + b.type);
  walkStrings(ans, s => { if (/[\u2013\u2014]/.test(s)) errs.push('em/en dash in: ' + s.slice(0, 50)); if (/[\u{1F000}-\u{1FFFF}☀-➿]/u.test(s)) errs.push('emoji in: ' + s.slice(0, 50)); });
  for (const c of ans.citations) { if (!c.label || !/^https?:\/\//.test(c.url) || !['page', 'pdf'].includes(c.kind)) errs.push('bad citation ' + JSON.stringify(c)); if (c.kind === 'pdf') { const d = data.documents.find(x => x.url === c.url); if (d && !ok(d)) errs.push('citation to unchecked/bad document'); } }
  for (const b of ans.blocks) {
    if (b.type === 'products') for (const i of b.items) { if (!pById.has(i.id)) errs.push('unknown product id ' + i.id); if (!i.reason) errs.push('empty reason'); }
    if (b.type === 'docs') for (const i of b.items) { const d = dById.get(i.id); if (!d) errs.push('unknown doc ' + i.id); else if (!ok(d)) errs.push('offered a doc that is not http 200'); }
    if (b.type === 'quote') { if (!Array.isArray(b.assumptions)) errs.push('quote without assumptions'); for (const l of b.lines) if (!l.source || !l.source.url || !l.basis || !l.quantity) errs.push('quote line missing source/basis/quantity'); }
  }
  if (!['out_of_scope', 'greeting', 'help'].includes(ans.intent) && !ans.citations.length) errs.push('no citations');
}

function consText(pid, label) { const p = pById.get(pid); const s = p.sections.find(x => x.title === 'Consumption'); return s ? s.items.map(i => i.text).join('\n') : ''; }

function calcExpect(spec, ans, errs) {
  const q = ans.blocks.find(b => b.type === 'quote');
  if (spec.calc === 'noRate') {
    const txt = consText(spec.productId).replace(/²/g, '2');
    if (/m2\s*(\/|per)\s*(l|litre|kg|bag|pail)|per\s*m2|kg\s*\/\s*m2|l\s*\/\s*m2/i.test(txt)) errs.push('fixture invalid: product does publish a per-area rate');
    if (q && q.lines.length) errs.push('invented a quote line where no rate is published');
    if (!ans.blocks.some(b => b.type === 'ask')) errs.push('no honest ask');
    if (!/do not give a rate/.test(textOf(ans))) errs.push('no plain statement that no rate is published');
    if (/\b\d+(\.\d+)?\s*(l|kg|packs?|pails?)\b/i.test(ans.blocks.filter(b => b.type === 'text').map(b => b.text).join(' ').replace(/\d+\s*m2/g, ''))) errs.push('numbers in a no-rate answer');
    return;
  }
  if (spec.calc === 'bagCover') {
    if (!q || !q.lines.length) { errs.push('no quote block'); return; }
    const line = q.lines.find(l => l.productId === spec.productId); if (!line) { errs.push('no line for ' + spec.productId); return; }
    const txt = consText(spec.productId).replace(/²/g, '2');
    const m = /(\d+)\s*kg\s+bags?\b[^.]{0,60}?covers?\s+approximately\s+(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*m/i.exec(txt);
    if (!m) { errs.push('fixture: bag cover not found in product text'); return; }
    const kg = m[1], lo0 = parseFloat(m[2]), hi0 = parseFloat(m[3] || m[2]);
    const lo = Math.ceil(spec.area / hi0 - 1e-9), hi = Math.ceil(spec.area / lo0 - 1e-9);
    const want = (lo === hi ? `${lo} ` : `${lo} to ${hi} `) + `x ${kg} kg`;
    if (!(line.packs || '').toLowerCase().includes(want)) errs.push(`packs "${line.packs}" should include "${want}"`);
    return;
  }
  if (!q || !q.lines.length) { errs.push('no quote block'); return; }
  const line = q.lines.find(l => l.productId === spec.productId);
  if (!line) { errs.push('no line for ' + spec.productId); return; }
  const txt = consText(spec.productId).replace(/²/g, '2');
  const allow = 1 + (spec.allowancePct || 0) / 100;
  if (spec.calc === 'areaPerPack') {
    const m = /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*m2\s*per\s*bag/i.exec(txt); if (!m) { errs.push('fixture: rate not found'); return; }
    const lo = Math.ceil(spec.area * allow / parseFloat(m[2]) - 1e-9), hi = Math.ceil(spec.area * allow / parseFloat(m[1]) - 1e-9);
    const want = lo === hi ? `${lo} ` : `${lo} to ${hi} `;
    if (!(line.packs || '').startsWith(want)) errs.push(`packs "${line.packs}" should start with "${want}"`);
  } else if (spec.calc === 'yieldThickness') {
    const m = /(\d+)\s*L\s*-\s*(\d+)\s*m2\s*@\s*(\d+)\s*mm/i.exec(txt); if (!m) { errs.push('fixture: yield not found'); return; }
    const V = +m[1], A = +m[2], t0 = +m[3]; const litres = V / (A * t0) * spec.area * spec.thickness; const packs = Math.ceil(litres / V - 1e-9);
    if (!line.quantity.startsWith(`${r2(litres)} L`)) errs.push(`quantity "${line.quantity}" should start with ${r2(litres)} L`);
    if (!(line.packs || '').startsWith(`${packs} x`)) errs.push(`packs "${line.packs}" should start with ${packs} x`);
  } else if (spec.calc === 'perAreaRange') {
    const m = /(\d+)\s*litre.*?covers approximately\s*(\d+)\s*-\s*(\d+)\s*m/i.exec(txt); if (!m) { errs.push('fixture: rate not found'); return; }
    const lo = +m[1] / +m[3] * spec.area * allow, hi = +m[1] / +m[2] * spec.area * allow;
    if (!line.quantity.startsWith(`${r2(lo)} to ${r2(hi)} L`)) errs.push(`quantity "${line.quantity}" should start with "${r2(lo)} to ${r2(hi)} L"`);
    const pw = `${Math.ceil(lo - 1e-9)} to ${Math.ceil(hi - 1e-9)} x`; if (!(line.packs || '').startsWith(pw)) errs.push(`packs "${line.packs}" should start with "${pw}"`);
  }
}

function evaluate(spec, ans) {
  const errs = [];
  generic(ans, errs);
  if (spec.unknown) {
    const t = textOf(ans);
    if (!['out_of_scope', 'contact', 'where_to_buy', 'help', 'find_product', 'compatibility', 'documents'].includes(ans.intent)) errs.push('odd intent ' + ans.intent);
    if (/\$\s?\d|\bAUD\b|\b\d+\s*(weeks?|years?|months?)\b/i.test(t)) errs.push('invented a price, warranty or duration: ' + (t.match(/\$\s?\d[^ ]*|\b\d+\s*(weeks?|years?|months?)\b/i) || [''])[0]);
    if (/\b(in stock|available now|stock level)\b/i.test(t)) errs.push('claimed stock');
    if (/better than|superior to/i.test(ans.blocks.filter(b => b.type === 'text').map(b => b.text).join(' '))) errs.push('made a comparison claim');
    const own = ans.blocks.filter(b => b.type === 'text' || b.type === 'ask' || b.type === 'handoff').map(b => b.text || b.question || (b.title + ' ' + (b.reason || ''))).join(' '); const declined = /\b(do not|does not|not in the published|cannot|can.?t|not hold|not stated|technical services|contact)\b/i.test(own) || ans.blocks.some(b => b.type === 'ask' || (b.type === 'text' && /contact/i.test(b.text)));
    if (!declined) errs.push('neither declined nor handed off');
  } else if (spec.intent && ans.intent !== spec.intent) errs.push(`intent ${ans.intent} != ${spec.intent}`);
  const ids = productIds(ans);
  if (spec.anyOf) { const top = ids.slice(0, spec.top || 3); if (!spec.anyOf.some(id => top.includes(id))) errs.push(`none of ${spec.anyOf.join('|')} in top ${spec.top || 3} (${top.join(',')})`); }
  if (spec.allOf) for (const id of spec.allOf) if (!ids.includes(id)) errs.push('missing ' + id);
  if (spec.noneOf) for (const id of spec.noneOf) if (ids.includes(id)) errs.push('excluded product offered: ' + id);
  if (spec.mustRuleOut) for (const id of spec.mustRuleOut) if (!textOf(ans).includes(pById.get(id).name.replace(/[®™]/g, ''))) errs.push('did not explain ruling out ' + id);
  if (spec.docType) {
    const dd = ans.blocks.filter(b => b.type === 'docs').flatMap(b => b.items.map(i => dById.get(i.id)));
    const want = data.documents.filter(d => d.products.includes(spec.docProduct) && d.type === spec.docType && ok(d)).map(d => d.id).sort();
    const got = dd.filter(d => d && d.type === spec.docType).map(d => d.id).sort();
    if (!want.length) errs.push('fixture: no such document in data');
    if (JSON.stringify(want) !== JSON.stringify(got)) errs.push(`docs ${got.join(',')} != expected ${want.join(',')}`);
    if (dd.some(d => d && !d.products.includes(spec.docProduct))) errs.push('document for a different product');
  }
  if (spec.factsFrom) {
    const p = pById.get(spec.factsFrom); const s = p.sections.find(x => x.title === 'Consumption'); if (!s) errs.push('fixture: no Consumption section');
    else { const f = ans.blocks.filter(b => b.type === 'facts').flatMap(b => b.rows).map(r => cp(r.value)).join('|'); for (const it of s.items) if (!f.includes(cp(it.text).slice(0, 30))) errs.push('published text not shown: ' + it.label); }
  }
  if (spec.textHas && !textOf(ans).toLowerCase().includes(spec.textHas.toLowerCase())) errs.push('missing text: ' + spec.textHas);
  if (spec.calc) calcExpect(spec, ans, errs);
  if (spec.askArea && !ans.blocks.some(b => b.type === 'ask')) errs.push('did not ask for the area');
  if (spec.askThickness && !ans.blocks.some(b => b.type === 'ask' && /thickness/i.test(b.question))) errs.push('did not ask for thickness');
  return errs;
}

const results = []; let fails = 0;
for (const spec of fixture.questions) {
  const ans = await assistant.ask(spec.q);
  const errs = evaluate(spec, ans);
  if (errs.length) fails++;
  results.push({ id: spec.id, question: spec.q, expectedIntent: spec.intent || '(unknown)', intent: ans.intent, top: topProduct(ans), pass: !errs.length, errors: errs, ms: ans.debug.ms });
}
for (const sc of fixture.scenarios || []) {
  let state = null; const errs = [];
  for (const [i, t] of sc.turns.entries()) { const ans = await assistant.ask(t.q, state); state = ans.state; const e = evaluate(t, ans); e.forEach(x => errs.push(`turn ${i + 1}: ${x}`)); }
  if (errs.length) fails++;
  results.push({ id: sc.id, question: sc.turns.map(t => t.q).join(' > '), expectedIntent: sc.turns[sc.turns.length - 1].intent, intent: '(multi-turn)', top: '-', pass: !errs.length, errors: errs, ms: 0 });
}
const pad = (s, n) => String(s).length > n ? String(s).slice(0, n - 1) + '~' : String(s).padEnd(n);
console.log(pad('id', 4), pad('question', 52), pad('intent', 14), pad('top product', 30), 'result');
for (const r of results) console.log(pad(r.id, 4), pad(r.question, 52), pad(r.intent, 14), pad(r.top, 30), r.pass ? 'PASS' : 'FAIL');
for (const r of results) for (const e of r.errors) console.log(`  [${r.id}] ${e}`);
const qs = results.filter(r => !r.id.startsWith('s'));
console.log(`\n${qs.filter(r => r.pass).length}/${qs.length} questions pass; scenarios ${results.filter(r => r.id.startsWith('s') && r.pass).length}/${results.filter(r => r.id.startsWith('s')).length}; stats ${JSON.stringify(assistant.stats())}`);
fs.writeFileSync(path.join(HERE, 'golden_result.json'), JSON.stringify({ generated: new Date().toISOString(), stats: assistant.stats(), products: data.products.length, results }, null, 1));
process.exit(fails ? 1 : 0);
