// T18 (b) property tests over every answer for every golden case, plus a sweep of one consumption question per product.
// P1 every digit sequence in answer text appears in a cited source text or in the user's input (computed pack counts excepted)
// P2 every citation URL exists in documents.json, pages.json or is a product page
// P3 no em or en dash, registered mark, trade mark or emoji
// P4 no "signed", "guarantee" or "approved" unless quoting a source
// P5 95% of answers in under 100 ms
// Env PROPS_ENGINE_DATA=<dir> builds the engine from a different data folder than the source texts (used by the mutation test).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PORTAL, ROOT } from './_env.mjs';
const rdFrom = (dir, f) => JSON.parse(fs.readFileSync(path.join(dir, f + '.json'), 'utf8'));
const srcDir = path.join(PORTAL, 'data'), engDir = process.env.PROPS_ENGINE_DATA || srcDir;
const src = { products: rdFrom(srcDir, 'products'), documents: rdFrom(srcDir, 'documents'), pages: rdFrom(srcDir, 'pages') };
const { createAssistant } = await import(pathToFileURL(path.join(PORTAL, 'assets/assistant/engine.js')).href);
const assistant = createAssistant({ products: rdFrom(engDir, 'products'), documents: rdFrom(engDir, 'documents'), categories: rdFrom(engDir, 'categories'), pages: rdFrom(engDir, 'pages'), config: rdFrom(srcDir, 'config') });
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'golden_fixture.json'), 'utf8'));

const strings = (o, out = []) => { if (typeof o === 'string') out.push(o); else if (typeof o === 'number') out.push(String(o)); else if (Array.isArray(o)) o.forEach((x) => strings(x, out)); else if (o && typeof o === 'object') Object.values(o).forEach((x) => strings(x, out)); return out; };
const pById = new Map(src.products.map((p) => [p.id, p])); const dById = new Map(src.documents.map((d) => [d.id, d]));
const urlSet = new Set(); for (const p of src.products) { if (p.url) urlSet.add(p.url); if (p.canonicalUrl) urlSet.add(p.canonicalUrl); }
for (const d of src.documents) { if (d.url) urlSet.add(d.url); if (d.dmsUrl) urlSet.add(d.dmsUrl); } for (const g of src.pages) if (g.url) urlSet.add(g.url);
const urlToProduct = new Map(src.products.flatMap((p) => [[p.url, p.id], [p.canonicalUrl, p.id]]));
const norm = (s) => String(s).replace(/²/g, '2').replace(/(\d),(\d{3})/g, '$1$2');
const nrm2 = (s) => norm(s).replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2');
const digits = (s) => [...new Set((nrm2(s).match(/\d+(?:\.\d+)?/g) || []).map((x) => String(+x)))]; // numeric value, so 0.400, 8.70 and 25.0 match 0.4, 8.7 and 25
const near = (x, set, tol) => { for (const y of set) if (Math.abs(+y - x) <= tol) return true; return false; };

function answerText(ans) { // text a person reads, quote lines excluded from P1 where the number is computed (pack counts, quantities)
  const out = [];
  for (const b of ans.blocks) {
    if (b.type === 'text') out.push(b.text);
    else if (b.type === 'ask') out.push(b.question);
    else if (b.type === 'facts') b.rows.forEach((r) => out.push(r.label + ' ' + r.value));
    else if (b.type === 'products') b.items.forEach((i) => out.push(i.reason || ''));
    else if (b.type === 'quote') { (b.assumptions || []).forEach((a) => out.push(a)); b.lines.forEach((l) => out.push(l.basis || '')); }
    else if (b.type === 'steps') strings(b, out);
  }
  return out.filter(Boolean);
}
function sourceText(ans) {
  const ids = new Set(); const out = [];
  for (const b of ans.blocks) {
    if (b.type === 'products') b.items.forEach((i) => ids.add(i.id));
    if (b.type === 'facts' && b.productId) ids.add(b.productId);
    if (b.type === 'quote') b.lines.forEach((l) => l.productId && ids.add(l.productId));
    if (b.type === 'docs') b.items.forEach((i) => { const d = dById.get(i.id); if (d) { out.push(...strings([d.title, d.description, d.version])); (d.products || []).forEach((p) => ids.add(p)); } });
    if (b.type === 'steps') strings(b).forEach(() => {});
  }
  const body = norm(answerText(ans).join(' ')).toLowerCase().replace(/[®™]/g, '');
  for (const p of src.products) if (p.name && body.includes(norm(p.name).toLowerCase().replace(/[®™]/g, ''))) ids.add(p.id); // products the answer names (ruled out or offered)
  if (ans.state && ans.state.productId) ids.add(ans.state.productId);
  if (ans.state && ans.state.productIds) ans.state.productIds.forEach((i) => ids.add(i));
  for (const c of ans.citations || []) { const p = urlToProduct.get(c.url); if (p) ids.add(p); }
  for (const id of ids) { const p = pById.get(id); if (p) out.push(...strings(p)); }
  return out.join('\n');
}

const cases = []; // [id, user input list, answer]
for (const q of fixture.questions) cases.push([q.id, [q.q], assistant.ask(q.q)]);
for (const sc of fixture.scenarios || []) { let st = null; const said = []; sc.turns.forEach((t, i) => { said.push(t.q); const a = assistant.ask(t.q, st); st = a.state; cases.push([`${sc.id}.${i + 1}`, [...said], a]); }); }
const sweepFrom = cases.length;
for (const p of src.products) cases.push([`sweep:${p.id}`, [p.name + ' coverage'], assistant.ask(p.name.replace(/[®™]/g, '') + ' coverage')]);

let fails = 0; const log = (id, rule, d) => { fails++; if (fails <= 40) console.log(`  FAIL ${id} ${rule}: ${d}`); };
const times = [];
for (const [id, said, ans] of cases) {
  const texts = answerText(ans); const all = texts.join('\n'); const user = said.join(' ');
  times.push(ans.debug.ms);
  // P1
  const srcNums = digits(sourceText(ans)); const allowed = new Set(srcNums.concat(digits(user), ['0']));
  const quoted = ans.blocks.filter((b) => b.type === 'quote');
  const countsOk = new Set(quoted.flatMap((b) => b.lines.flatMap((l) => digits((l.packs || '') + ' ' + (l.quantity || '')))));
  const derived = (d) => { // a published rate restated per area or per pack is a ratio of two published numbers (quote lines only)
    if (!quoted.length) return false; const x = +d;
    for (const a1 of srcNums) for (const b1 of srcNums) { const q = +a1 / +b1; if (isFinite(q) && (Math.abs(q - x) <= 0.0051 || Math.abs(1 / q - x) <= 0.0051)) return true; }
    return false;
  };
  for (const d of new Set(digits(all))) if (!allowed.has(d) && !countsOk.has(d) && !derived(d)) { const t = texts.find((x) => digits(x).includes(d)) || ''; const i = nrm2(t).indexOf(d); log(id, 'P1', `number ${d} not in a cited source or the question: "...${nrm2(t).slice(Math.max(0, i - 45), i + 25).replace(/\n/g, ' ')}..."`); }
  // P2
  for (const c of ans.citations || []) if (!urlSet.has(c.url)) log(id, 'P2', 'citation not in the data: ' + c.url);
  for (const b of ans.blocks) if (b.type === 'docs') b.items.forEach((i) => { if (!dById.has(i.id)) log(id, 'P2', 'doc not in the data: ' + i.id); });
  // P3 (every string in the answer, links excluded)
  for (const s of strings(ans.blocks.concat(ans.followups || []))) { if (/https?:\/\//.test(s)) continue; if (/[–—]/.test(s)) log(id, 'P3', 'dash in: ' + s.slice(0, 60)); if (/[®™®™]/.test(s)) log(id, 'P3', 'registered or trade mark in: ' + s.slice(0, 60)); if (/[\u{1F000}-\u{1FFFF}☀-➿]/u.test(s)) log(id, 'P3', 'emoji in: ' + s.slice(0, 60)); }
  // P4: strip anything inside quotation marks (a quoted source sentence), then look
  const unq = all.replace(/[“"][^”"]*[”"]/g, ' ');
  const m = /\b(signed|guarantee[ds]?|approved)\b/i.exec(unq); if (m) log(id, 'P4', `"${m[0]}" outside a quote: ${unq.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\n/g, ' ')}`);
}
times.sort((a, b) => a - b); const p95 = times[Math.floor(times.length * 0.95) - 1]; const under = times.filter((t) => t < 100).length;
const p5ok = under / times.length >= 0.95;
if (!p5ok) log('all', 'P5', `only ${under} of ${times.length} under 100 ms`);
console.log(`PROPS cases ${sweepFrom} golden + ${cases.length - sweepFrom} sweep = ${cases.length} answers; P5 ${under}/${times.length} under 100 ms (p95 ${p95} ms, max ${times[times.length - 1]} ms); failures ${fails}`);
process.exit(fails ? 1 : 0);
