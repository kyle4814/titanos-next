// dosage_src.mjs: question shapes for products dosed by cement mass, percent of cement, concrete volume or mix mass ("how much SikaRapid-4 for 2 tonnes of cement").
// Expected text comes from the published data (the dose sentence the card must quote), never from the assistant. Writes dosage.json next to this file.
//   node demo-tests/sika-brain/coverage/dosage_src.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normaliseFact, inputFor, DOSE_KINDS } from '../../../public/demo/sika-210c0c/assets/lib/finder/calc.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = process.env.SIKA_PORTAL || path.join(HERE, '..', '..', '..', 'public', 'demo', 'sika-210c0c');
const rd = (rel) => JSON.parse(fs.readFileSync(path.join(PORTAL, rel), 'utf8'));
const products = rd('data/products.json');
const SIZE = { cement: ['2 tonnes of cement', '1000 kg of cement', '500 kg of binder'], volume: ['10 m3 of concrete', '3 cubic metres'], mix: ['100 kg of mix'], water: ['200 L of water'] };
const FORM = [(n, s) => `how much ${n} for ${s}`, (n, s) => `how many litres of ${n} do I need for ${s}`, (n, s) => `calculate ${n} dose for ${s}`];
const out = [];
for (const p of products) {
  const r = rd('data/finder/r/' + p.id + '.json'); const facts = (r.consumption || []).map((x) => ({ x, n: normaliseFact(x) })).filter((y) => y.n.ok);
  if (!facts.length || !facts.every((y) => DOSE_KINDS.includes(y.n.kind))) continue;
  const key = inputFor(facts[0].n); const sizes = SIZE[key]; if (!sizes) continue;
  const name = String(p.name).replace(/[®™]/g, '');
  out.push({ persona: key === 'volume' ? 'concreter' : 'builder', category: 'dosage quantity', q: FORM[0](name, sizes[0]), type: 'calc', exp: { product: p.id, has: true, contains: facts[0].x.text }, messy: '' });
  if (out.length % 6 === 0) out.push({ persona: 'concreter', category: 'dosage quantity', q: FORM[1 + (out.length % 2)](name, sizes[sizes.length > 1 ? 1 : 0]), type: 'calc', exp: { product: p.id, has: true, contains: facts[0].x.text }, messy: '' });
}
out.forEach((b, i) => { b.id = 'd' + String(i + 1).padStart(3, '0'); b.split = i % 5 === 0 ? 'blind' : 'tuned'; });
fs.writeFileSync(path.join(HERE, 'dosage.json'), JSON.stringify(out, null, 1));
console.log('dosage', out.length);
