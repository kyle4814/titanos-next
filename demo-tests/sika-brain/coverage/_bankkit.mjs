// _bankkit.mjs: shared helpers for the wave 2 lane A bank generators. Every expectation is read from the published data at build time and the build THROWS when the data does not back it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PORTAL = process.env.SIKA_PORTAL || path.join(HERE, '..', '..', '..', 'public', 'demo', 'sika-210c0c');
export const rd = (rel) => JSON.parse(fs.readFileSync(path.join(PORTAL, rel), 'utf8'));
export const products = rd('data/products.json');
export const kb = rd('data/brain/kb.json');
const shardCache = new Map();
export const shard = (id) => { if (!shardCache.has(id)) { const f = path.join(PORTAL, 'data/brain/p/' + id + '.json'); if (!fs.existsSync(f)) throw new Error('unknown product id ' + id); shardCache.set(id, JSON.parse(fs.readFileSync(f, 'utf8'))); } return shardCache.get(id); };
export const clean = (s) => String(s || '').replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim();
export const P = { T: 'tiler', B: 'builder', C: 'concreter', W: 'waterproofer', S: 'specifier', D: 'distributor', H: 'diy home owner', X: 'sika counter staff' };
export const HERE_DIR = HERE;
export const problems = [];
// selectors (same grammar as judge.mjs): c:<category substring>, n:<regex>, i:<comma ids>
export const TA = ['c:tile-stone-installationsystems/tile-adhesives', 'i:sikaceram-880-easyepoxy'];
export const TG = ['c:tile-stone-installationsystems/tile-grouts'];
export const TW = ['c:tile-stone-installationsystems/waterproofing', 'i:sikaceram-sealingmembranea,sikalastic-1k,sikalastic-1-komponent,sikatile-111-rapidproof,sikalastic-moistureseal,sika-sealtape-b,sika-sealtape-f,sikalastic-488-au'];
export const LV = ['c:flooring/cement-levellingsystems'];
export const SS = ['c:sealants-adhesives'];
export const CO = ['c:concrete/'];
export const CR = ['c:concrete-repair-protection'];
export const RS = ['c:flooring/resin-flooring'];
export const WP = ['c:waterproofing', 'c:tile-stone-installationsystems/waterproofing', 'i:sikaceram-sealingmembranea'];
export const RF = ['c:roofing', 'c:waterproofing'];
export const GA = ['c:grouts-anchoring'];
export const ST = ['c:structural-strengthening'];
export const MAR = ['c:industry/marine', 'c:sealants-adhesives'];
export const AUTO = ['c:industry/automotive', 'c:industry/transportation', 'c:sealants-adhesives'];
export const hasSec = (id, rx) => (shard(id).d.sec || []).find((x) => rx.test(x.l) && x.t && x.t.length > 3);
const norm = (s) => clean(s).toLowerCase();
export function mk(out, split, ctr) {
  const add = (persona, category, q, type, exp = {}, messy = '', src = '') => out.push({ persona: P[persona], category, q, type, exp, messy, split, src: src || 'hand-written; allowed set is the documented category' });
  const attr = (persona, category, q, id, labelRx, messy = '') => { const s = hasSec(id, labelRx); if (!s) throw new Error(`data does not back attr ${id} ${labelRx}`); add(persona, category, q, 'attr', { product: id, label: String(labelRx), contains: s.t.slice(0, 60), has: true }, messy, `products shard ${id} d.sec "${s.l}"`); };
  const noattr = (persona, category, q, id, labelRx, messy = '') => { if (hasSec(id, labelRx)) throw new Error(`data HAS attr ${id} ${labelRx}`); const sh = shard(id); if (labelRx.test(JSON.stringify(sh.d) + JSON.stringify(sh.tm || {}))) throw new Error(`text mentions ${labelRx} for ${id}`); add(persona, category, q, 'attr', { product: id, label: String(labelRx), has: false }, messy, `products shard ${id}: no field matching ${labelRx} in d.sec, d.a, d.us, tm`); };
  const time = (persona, category, q, id, key, messy = '') => { const sh = shard(id); if (!(sh.tm && sh.tm[key] && sh.tm[key].length)) throw new Error(`data does not back time ${id} ${key}`); add(persona, category, q, 'time', { product: id, key }, messy, `shard ${id} tm.${key}`); };
  const notime = (persona, category, q, id, key, messy = '') => { const sh = shard(id); if (sh.tm && sh.tm[key] && sh.tm[key].length) throw new Error(`data HAS time ${id} ${key}`); add(persona, category, q, 'time', { product: id, key, has: false }, messy, `shard ${id}: tm.${key} empty`); };
  const rate = (persona, category, q, id, messy = '') => { const sh = shard(id); if (!(sh.r && sh.r.facts && (sh.r.facts.consumption || []).length)) throw new Error(`data does not back rate ${id}`); add(persona, category, q, 'rate', { product: id }, messy, `shard ${id} r.facts.consumption`); };
  const doc = (persona, category, q, id, ty, messy = '') => { const sh = shard(id); if (!(sh.dc || []).some((d) => d.ty === ty && d.ok)) throw new Error(`data does not back doc ${id} ${ty}`); add(persona, category, q, 'doc', { product: id, docType: ty }, messy, `shard ${id} dc type ${ty}`); };
  const prod = (persona, category, q, id, messy = '') => { shard(id); add(persona, category, q, 'product', { products: [id] }, messy, `products.json ${id}`); };
  const calc = (persona, category, q, id, messy = '') => { const sh = shard(id); if (!(sh.r && sh.r.facts && (sh.r.facts.consumption || []).some((f) => f.calc))) throw new Error(`no calc_ready rate for ${id}`); add(persona, category, q, 'calc', { product: id }, messy, `shard ${id} r.facts.consumption calc_ready`); };
  const cmp = (persona, category, q, ids, messy = '') => { ids.forEach(shard); add(persona, category, q, 'compare', { products: ids }, messy, 'products.json ' + ids.join(',')); };
  const compat = (persona, category, q, id, verdict = 'any', messy = '') => { shard(id); add(persona, category, q, 'compat', { product: id, verdict }, messy, `shard ${id} compatibility rules`); };
  const biz = (persona, category, q, urlRx, must, messy = '', nodata = false) => { const rx = new RegExp(urlRx, 'i'); const pg = kb.pages.filter((p) => rx.test(p.u)); if (!pg.length) throw new Error('no kb page for ' + urlRx); if (must && !pg.some((p) => norm(JSON.stringify(p)).includes(norm(must)))) throw new Error(`kb page ${urlRx} lacks "${must}"`); add(persona, category, q, 'business', Object.assign({ url: urlRx, must }, nodata ? { nodata: true } : {}), messy, 'kb.json page ' + pg[0].u); };
  const system = (persona, category, q, slug, messy = '') => { if (!fs.existsSync(path.join(PORTAL, 'systems', slug))) throw new Error('no system ' + slug); add(persona, category, q, 'system', { slug }, messy, `portal systems/${slug}`); };
  const wrap = (fn, name) => (...a) => { try { return fn(...a); } catch (e) { if (!process.env.COLLECT) throw e; problems.push(name + ' ' + JSON.stringify(a[2]) + ' :: ' + e.message); } };
  return Object.fromEntries(Object.entries({ add, attr, noattr, time, notime, rate, doc, prod, calc, cmp, compat, biz, system }).map(([n, f]) => [n, wrap(f, n)]));
}
export function finish(out, outFile, idPrefix, existingQs = new Set()) {
  const seen = new Set(existingQs); const res = [];
  for (const b of out) { const k = b.q.toLowerCase().replace(/\s+/g, ' ').trim(); if (seen.has(k)) continue; seen.add(k); let id = idPrefix + hash(b.orig || b.q).toString(36).padStart(7, '0').slice(0, 7); while (res.some((x) => x.id === id)) id += 'x'; b.id = id; delete b.orig; res.push(b); }
  fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
  const by = (f) => res.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
  console.log(path.basename(outFile), res.length, 'messy', res.filter((x) => x.messy).length, JSON.stringify(by((x) => x.type)));
  return res;
}
// ---- messy mutators: deterministic, meaning-preserving rewrites in the way people really type on a phone, talk to a mic, or shout across a counter.
const DROP = { adhesive: 'adhsv', adhesives: 'adhsvs', waterproofing: 'waterprofing', waterproof: 'watrproof', membrane: 'membrain', sealant: 'sealent', primer: 'primmer', bathroom: 'bthrm', shower: 'shwr', concrete: 'conc', levelling: 'levelin', leveller: 'levler', compound: 'compond', cement: 'cmnt', product: 'prod', recommended: 'recomended', specification: 'spec', difference: 'diffrence' };
const SLANG = [[/\badhesive\b/, 'glue'], [/\bwaterproofing\b/, 'tanking'], [/\bsealant\b/, 'caulk'], [/\bsmoothing compound\b/, 'smoothing stuff'], [/\bwhat is\b/, 'whats'], [/\bhow much\b/, 'how much'], [/\bdata sheet\b/, 'tds'], [/\bsafety data sheet\b/, 'sds'], [/\bwhich\b/, 'wat'], [/\bfor\b/, 'fr']];
const FILL = ['hey mate ', 'um ', 'yeah so ', 'righto ', 'quick one ', 'sorry to bug you ', 'g day ', 'hi ', 'ok so '];
const TAIL = [' thanks', ' cheers', ' pls', ' thx', ' mate', ' asap', ' ta'];
const UNITS = [[/(\d+)\s*m2\b/, '$1 sqm'], [/(\d+)\s*square metres?/, '$1 sqm'], [/(\d+)\s*m2\b/, '$1 square meters'], [/(\d+)mm\b/, '$1 mm'], [/(\d{2,4})x(\d{2,4})/, '$1 by $2'], [/(\d+)\s*mm\b/, (m, n) => (Number(n) >= 10 && Number(n) % 10 === 0 ? `${Number(n) / 10}cm` : m)]];
const swapAt = (s, i) => (s.length > i + 1 ? s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2) : s);
export function messify(q, k) {
  const m = k % 8; const w = q.split(' ');
  const longest = w.reduce((b, x, j) => (x.length > w[b].length ? j : b), 0);
  const tryDrop = () => { for (let j = 0; j < w.length; j++) if (DROP[w[j]]) { const c = w.slice(); c[j] = DROP[w[j]]; return c.join(' '); } return null; };
  const tryUnit = () => { for (const [rx, to] of UNITS) if (rx.test(q)) return q.replace(rx, to); return null; };
  const trySlang = () => { for (const [rx, to] of SLANG) if (rx.test(q) && q.replace(rx, to) !== q) return q.replace(rx, to); return null; };
  const typo = () => { const c = w.slice(); const x = c[longest]; if (x.length > 5 && /^[a-z]+$/.test(x)) { c[longest] = swapAt(x, 2 + (k % Math.max(1, x.length - 4))); return c.join(' '); } return null; };
  const vowel = () => { const c = w.slice(); const j = c.findIndex((x) => x.length > 5 && /^[a-z]+$/.test(x)); if (j < 0) return null; c[j] = c[j].replace(/[aeiou]/, ''); return c.join(' '); };
  const tries = [[typo, 'typo'], [() => FILL[k % FILL.length] + q.toLowerCase() + TAIL[k % TAIL.length], 'voice'], [tryDrop, 'typo'], [trySlang, 'slang'], [tryUnit, 'units'], [vowel, 'typo'], [() => q.replace(/[?.,']/g, '').replace(/\band\b/g, 'n').replace(/\bto\b/g, '2').replace(/\byou\b/g, 'u'), 'sms'], [() => FILL[(k + 3) % FILL.length] + (trySlang() || q).toLowerCase(), 'voice']];
  for (let i = 0; i < tries.length; i++) { const [f, tag] = tries[(m + i) % tries.length]; const r = f(); if (r && r !== q) return [r, tag]; }
  return [q + ' pls', 'sms'];
}
// turn a share of the clean items into messy ones (replace the wording, keep the ground truth); eligible types only. Stable: the choice and the rewrite depend only on the question text hash.
export const hash = (str) => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
export function messifyTo(out, frac, types = ['best', 'product', 'attr', 'time', 'rate', 'doc', 'list', 'nodata', 'calc', 'compat', 'compare', 'business', 'system']) {
  for (const b of out) { b.orig = b.q; if (b.messy || !types.includes(b.type)) continue; const h = hash(b.q); if (h % 1000 >= frac * 1000) continue; const [q2, tag] = messify(b.q, h >>> 4); if (q2 === b.q) continue; b.q = q2; b.messy = tag; b.src += ' | reworded messy:' + tag; }
}
