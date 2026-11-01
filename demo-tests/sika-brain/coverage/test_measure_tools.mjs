// test_measure_tools.mjs: tests for the wave 2 lane A tooling (judge system branch, messify, validate_bank, triage). Exit 1 on any failure.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { judge, makeSelectors } from './judge.mjs';
import { messify, hash } from './_bankkit.mjs';
import { triage } from './triage_w2a.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)); let n = 0, bad = 0;
const t = (name, fn) => { n++; try { fn(); } catch (e) { bad++; console.log('FAIL', name, '::', e.message); } };
const card = (o) => Object.assign({ type: 'system', title: 'x', headline: 'x', facts: [], links: [], lines: [] }, o);
const sel = makeSelectors([{ id: 'p1', n: 'P1', c: 'construction/x' }]);
const SLUG = 'porcelain-on-concrete-internal-wet-floor';
t('judge system: right slug is ANSWERED', () => assert.equal(judge({ type: 'system', exp: { slug: SLUG } }, { cards: [card({ links: [{ url: 'https://x/systems/' + SLUG + '/' }] })] }, sel).cls, 'ANSWERED'));
t('judge system: another system sheet is WRONG', () => assert.equal(judge({ type: 'system', exp: { slug: SLUG } }, { cards: [card({ links: [{ url: 'https://x/systems/glass-on-aac-internal-floor/' }] })] }, sel).cls, 'WRONG'));
t('judge system: a product page link (installationsystems/) is NOT a system sheet (tooling must not manufacture a WRONG)', () => assert.equal(judge({ type: 'system', exp: { slug: SLUG } }, { cards: [card({ type: 'product', product: { id: 'p1' }, links: [{ url: 'https://aus.sika.com/en/construction/tile-stone-installationsystems/tile-adhesives/sikatile-400-evopro.html' }] })] }, sel).cls, 'UNHANDLED'));
t('judge system: decline is UNHANDLED when the sheet exists', () => assert.equal(judge({ type: 'system', exp: { slug: SLUG } }, { cards: [{ type: 'unknown', status: 'UNKNOWN', title: 'u', headline: 'u', facts: [] }] }, sel).cls, 'UNHANDLED'));
t('judge list: core must supply the listed products', () => { const s2 = makeSelectors([{ id: 'a', n: 'A', c: 'construction/k/core' }, { id: 'b', n: 'B', c: 'construction/k/other' }]); const mkc = (id) => ({ type: 'product', title: id, headline: id, product: { id }, facts: [], links: [], source: { sentence: 's', source_url: 'u' } }); const it = { type: 'list', exp: { allowed: ['c:construction'], core: ['c:construction/k/core'], min: 1 } }; assert.equal(judge(it, { cards: [mkc('a')] }, s2).cls, 'ANSWERED'); assert.equal(judge(it, { cards: [mkc('b')] }, s2).cls, 'UNHANDLED'); });
t('messify: always changes the text, deterministic', () => { for (const q of ['tile adhesive for a balcony', 'how much davco k10 plus for 25 m2', 'sealant', 'what is sikaflex pro plus used for']) for (let k = 0; k < 24; k++) { const [a, tag] = messify(q, k); assert.notEqual(a, q); assert.ok(tag); assert.deepEqual(messify(q, k), [a, tag]); } });
t('hash is stable', () => assert.equal(hash('abc'), hash('abc')));
t('validate_bank: fails on an unsupported expectation, passes on a supported one', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-')); assert.ok(dir && dir.length > 5);
  const f = path.join(dir, 'bad.json'); fs.writeFileSync(f, JSON.stringify([{ id: 'x1', q: 'q', type: 'attr', exp: { product: 'no-such-product', has: true, contains: 'zzz' } }, { id: 'x2', q: 'q2', type: 'best', exp: {} }]));
  const r = spawnSync('node', [path.join(HERE, 'validate_bank.mjs'), f], { encoding: 'utf8' }); assert.equal(r.status, 1); assert.match(r.stdout, /unknown product no-such-product/); assert.match(r.stdout, /no allowed set/);
  const g = path.join(dir, 'good.json'); fs.writeFileSync(g, JSON.stringify([{ id: 'x3', q: 'q3', type: 'product', exp: { products: ['davco-ultraflex'] } }])); assert.equal(spawnSync('node', [path.join(HERE, 'validate_bank.mjs'), g], { encoding: 'utf8' }).status, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
t('triage: unsupported product is BRAIN-WRONG, wrong page is MISSING, non-WRONG is null', () => {
  assert.equal(triage({ cls: 'ANSWERED' }), null);
  assert.equal(triage({ cls: 'WRONG', id: 'zz', type: 'best', why: 'outside the documented fit: x', first: 'product:x', messy: '' }).c, 'BRAIN-WRONG');
  assert.equal(triage({ cls: 'WRONG', id: 'zz', type: 'business', why: 'answer without the right page', first: 'info:x', messy: '' }).c, 'MISSING');
  assert.equal(triage({ cls: 'WRONG', id: 'zz', type: 'nodata', why: 'answered something the data cannot answer: P', first: 'product:p', messy: '', text: 'Price $45.00 per bag' }).c, 'BRAIN-WRONG');
});
t('bank shape: 1,000+ rows, 35+ percent messy, every row has persona, category, q, type, exp, id', () => { const b = JSON.parse(fs.readFileSync(path.join(HERE, 'bank.json'), 'utf8')); assert.ok(b.length >= 1000, 'bank ' + b.length); assert.ok(b.filter((x) => x.messy).length / b.length >= 0.35); for (const x of b) for (const k of ['persona', 'category', 'q', 'type', 'exp', 'id']) assert.ok(x[k] !== undefined, x.id + ' lacks ' + k); assert.equal(new Set(b.map((x) => x.id)).size, b.length, 'duplicate ids'); });
t('blind4 shape: 150+ rows, 35+ percent messy, split blind4, no overlap with any other bank question', () => { const b4 = JSON.parse(fs.readFileSync(path.join(HERE, 'blind4.json'), 'utf8')); assert.ok(b4.length >= 150); assert.ok(b4.filter((x) => x.messy).length / b4.length >= 0.35); assert.ok(b4.every((x) => x.split === 'blind4')); const other = new Set(); for (const f of ['bank', 'blind2', 'blind3', 'extra', 'wild', 'wild2']) for (const x of JSON.parse(fs.readFileSync(path.join(HERE, f + '.json'), 'utf8'))) other.add(x.q.toLowerCase().replace(/\s+/g, ' ').trim()); for (const x of b4) assert.ok(!other.has(x.q.toLowerCase().replace(/\s+/g, ' ').trim()), 'overlap: ' + x.q); });
console.log(`test_measure_tools: ${n - bad}/${n} passed`); process.exit(bad ? 1 : 0);
