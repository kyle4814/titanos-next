// extra_src.mjs: a data-derived question set across every category (comparisons, quantities, times, documents, more attributes, "what is X used for"), with expected text taken from the published data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = process.env.SIKA_PORTAL || path.join(HERE, '..', '..', '..', 'public', 'demo', 'sika-210c0c');
const rd = (rel) => JSON.parse(fs.readFileSync(path.join(PORTAL, rel), 'utf8'));
const products = rd('data/products.json'); const shards = products.map((p) => rd('data/brain/p/' + p.id + '.json'));
const clean = (s) => String(s || '').replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim();
const P = { T: 'tiler', B: 'builder', C: 'concreter', W: 'waterproofer', S: 'specifier', D: 'distributor', H: 'diy home owner', X: 'sika counter staff' };
const personaOf = (p) => (/tile-stone/.test(p.category) ? 'T' : /concrete\//.test(p.category) || /concrete-repair/.test(p.category) ? 'C' : /waterproofing|roofing/.test(p.category) ? 'W' : /sealants|flooring|grouts/.test(p.category) ? 'B' : /industry|marine|transport/.test(p.category) ? 'X' : 'D');
let seed = 20261101; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; const pick = (a) => a[Math.floor(rnd() * a.length)];
const typo = (s) => { const w = s.split(' '); const i = w.findIndex((x) => x.length > 6 && /^[a-z]+$/.test(x)); if (i < 0) return s; w[i] = w[i].slice(0, 3) + w[i][4] + w[i][3] + w[i].slice(5); return w.join(' '); };
const out = []; const add = (p, category, q, type, exp, messy = '') => out.push({ persona: P[personaOf(p)], category, q, type, exp, messy });
const nm = (sh) => clean(sh.n).toLowerCase();
// comparisons inside a category
const byCat = new Map(); shards.forEach((sh, i) => { const c = products[i].category.split('/').slice(0, 4).join('/'); if (!byCat.has(c)) byCat.set(c, []); byCat.get(c).push(sh); });
const cats = [...byCat.entries()].filter(([, v]) => v.length >= 2);
for (let k = 0; k < 36; k++) { const [, v] = pick(cats); const a = pick(v); let b2 = pick(v); if (b2.id === a.id) continue; const tpl = pick([(x, y) => `compare ${x} and ${y}`, (x, y) => `${x} vs ${y}`, (x, y) => `difference between ${x} and ${y}`, (x, y) => `${x} or ${y} which one`]); let q = tpl(nm(a), nm(b2)); const m = k % 4 === 3; if (m) q = typo(q); add(products.find((p) => p.id === a.id), 'comparisons', q, 'compare', { products: [a.id, b2.id] }, m ? 'typo' : ''); }
// quantities from calc-ready consumption
const calc = shards.filter((sh) => sh.r && sh.r.facts && (sh.r.facts.consumption || []).some((f) => f.calc && f.parsed && f.parsed.basis_stated));
for (let k = 0; k < 30; k++) { const sh = pick(calc); const area = pick([8, 12, 15, 25, 40, 60, 120]); const tpl = pick([(n, a) => `how much ${n} for ${a} m2`, (n, a) => `how many bags of ${n} for ${a} square metres`, (n, a) => `quantity of ${n} needed for ${a}m2`, (n, a) => `${n} ${a} sqm how much`]); const m = k % 4 === 3; let q = tpl(nm(sh), area); if (m) q = typo(q); add(products.find((p) => p.id === sh.id), 'quantities', q, 'calc', { product: sh.id, area }, m ? 'typo' : ''); }
// times phrased differently
for (const kind of ['recoat_times', 'open_time', 'cure_times', 'skin_tack_times', 'adjustability_time']) { const c = shards.filter((sh) => sh.tm && sh.tm[kind] && sh.tm[kind].length); for (let k = 0; k < 6 && c.length; k++) { const sh = pick(c); const f = sh.tm[kind][0]; const tpl = { recoat_times: [(n) => `when can i recoat ${n}`, (n) => `how long before i can put a second coat on ${n}`], open_time: [(n) => `open time of ${n}`, (n) => `how long can i work ${n} before it skins`], cure_times: [(n) => `how long does ${n} take to harden`, (n) => `when can i walk on ${n}`], skin_tack_times: [(n) => `skin time ${n}`, (n) => `how long until ${n} skins over`], adjustability_time: [(n) => `how long can i adjust tiles in ${n}`, (n) => `adjustability time ${n}`] }[kind]; const m = k % 3 === 2; let q = pick(tpl)(nm(sh)); if (m) q = typo(q); add(products.find((p) => p.id === sh.id), 'times', q, 'time', { product: sh.id, contains: f.text.slice(0, 40), has: true }, m ? 'typo' : ''); } }
// documents across the whole range, including industry products
const withDoc = shards.filter((sh) => (sh.dc || []).some((d) => d.ok && d.ty === 'product_data_sheet'));
for (let k = 0; k < 24; k++) { const sh = pick(withDoc); const tpl = pick([(n) => `data sheet for ${n}`, (n) => `pds ${n}`, (n) => `where is the technical data sheet for ${n}`, (n) => `${n} tds`]); const m = k % 4 === 3; let q = tpl(nm(sh)); if (m) q = typo(q); add(products.find((p) => p.id === sh.id), 'documents', q, 'doc', { product: sh.id }, m ? 'typo' : ''); }
// more attribute labels
const more = [[/^(movement capability)$/i, 'movement', (n) => `how much movement can ${n} take`], [/^dimensions$/i, 'dimensions', (n) => `dimensions of ${n}`], [/^(chemical resistance)$/i, 'chemical', (n) => `what chemicals can ${n} handle`], [/^shore a hardness$/i, 'hardness', (n) => `how hard is ${n} cured`], [/^(density)$/i, 'density', (n) => `what does ${n} weigh`], [/^application$/i, 'steps', (n) => `how do i apply ${n}`], [/^substrate preparation$/i, 'prep', (n) => `how do i prep the surface for ${n}`], [/^cleaning of equipment$/i, 'clean', (n) => `how do i clean my tools after ${n}`], [/^equipment$/i, 'tools', (n) => `what tools for ${n}`], [/^(relative air humidity)$/i, 'humidity', (n) => `humidity limit for ${n}`]];
for (const [re, key, tpl] of more) { const c = shards.filter((sh) => (sh.d.sec || []).some((x) => re.test(x.l) && x.t && x.t.length > 3 && x.t.length < 250)); for (let k = 0; k < 3 && c.length; k++) { const sh = pick(c); const it = sh.d.sec.find((x) => re.test(x.l) && x.t); const m = k === 2; let q = tpl(nm(sh)); if (m) q = typo(q); add(products.find((p) => p.id === sh.id), 'more attributes: ' + key, q, 'attr', { product: sh.id, label: key, contains: it.t.slice(0, 60), has: true }, m ? 'typo' : ''); } }
// what is X used for / tell me about X, across all categories
for (let k = 0; k < 40; k++) { const sh = pick(shards); const tpl = pick([(n) => `what is ${n} used for`, (n) => `tell me about ${n}`, (n) => `${n} what does it do`, (n) => `is ${n} any good`, (n) => `info on ${n}`]); const m = k % 4 === 3; let q = tpl(nm(sh)); if (m) q = typo(q); add(products.find((p) => p.id === sh.id), 'what is', q, 'product', { products: [sh.id] }, m ? 'typo' : ''); }
const seen = new Set(); const res = [];
out.forEach((b) => { const key = b.q.toLowerCase(); if (seen.has(key)) return; seen.add(key); b.id = 'e' + String(res.length + 1).padStart(3, '0'); let h = 0; for (const ch of b.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; b.split = h % 5 === 0 ? 'blind' : 'tuned'; res.push(b); });
fs.writeFileSync(path.join(HERE, 'extra.json'), JSON.stringify(res, null, 1));
console.log('extra', res.length, 'messy', res.filter((x) => x.messy).length);
