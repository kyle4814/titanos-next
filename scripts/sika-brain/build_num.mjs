// build_num.mjs: the data sheet field extractor. Reads the page-marked data sheet rows (lanes/specs/by_product) and the product shards, and writes
//   data/brain/num/<product>.json   cited, normalised numeric facts (pot life, open time, set and cure times, compressive and adhesion strength, VOC,
//                                   shelf life, layer thickness, service temperature, movement, pack sizes) and thickness-aware coverage rates
//   data/brain/num/index.json       one compact line per product and field, used to order products by a published figure
// Called by build_brain.mjs after the product shards (that script clears data/brain first, so this must run after it). Idempotent: same inputs, same bytes.
//   node scripts/sika-brain/build_num.mjs            (stand-alone re-run over an already built data/brain)
// No network, no model. A row that cannot be read safely is dropped, never guessed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIELDS, extractRow, rankValue, packs as parsePackText, toNum } from './num_extract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const clamp = (s, n = 260) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
const r4 = (x) => Math.round(x * 10000) / 10000;

/** Thickness-aware coverage: "1 bag will cover approximately 12m2 at 1mm", "12 L = 4m2 at 3mm", "5kg bag ... 2.5m2 at 1mm". Returns kg per m2 per mm or null. */
export function thicknessRate(text, packList) {
  const t = String(text || '').replace(/[ ]/g, ' ').replace(/\s+/g, ' ').trim();
  const N = '(\\d+(?:\\.\\d+)?)';
  let V = null, A = null, T = null, packKg = null, basis = '';
  let m;
  if ((m = t.match(new RegExp(`${N}\\s*(?:l|litres?|ltr)\\s*(?:=|-|\\u2013)\\s*${N}\\s*m(?:2|\\u00b2)\\s*(?:at|@)\\s*${N}\\s*mm`, 'i')))) { V = +m[1]; A = +m[2]; T = +m[3]; }
  else if ((m = t.match(new RegExp(`${N}\\s*(?:l|litres?|ltr)\\s*(?:=|-|\\u2013)\\s*${N}\\s*mm\\s*(?:at|@)\\s*${N}\\s*m(?:2|\\u00b2)`, 'i')))) { V = +m[1]; T = +m[2]; A = +m[3]; }
  else if ((m = t.match(new RegExp(`${N}\\s*(?:l|litres?|ltr)\\s*per\\s*bag\\s*\\(\\s*${N}\\s*m(?:2|\\u00b2)\\s*(?:at|@)\\s*${N}\\s*mm`, 'i')))) { V = +m[1]; A = +m[2]; T = +m[3]; }
  if (V != null) {
    if (!(V > 0 && A > 0 && T > 0) || Math.abs(V - A * T) / V > 0.03) return null; // litres must equal m2 x mm, or the statement is not what it looks like
    const kg = (packList || []).filter((p) => p.unit === 'kg');
    if (kg.length !== 1 || (packList || []).length !== kg.length) return null; // the yield is only per bag when the data sheet lists exactly one bag size
    packKg = kg[0].amount; basis = `the data sheet gives the yield without naming the pack; the only pack size listed is ${packKg} kg, so it is read as per ${packKg} kg bag`;
    return { unit: 'kg', per_mm: r4(packKg / (A * T)), exact: packKg / (A * T), pack_kg: packKg, cover_m2: A, at_mm: T, basis };
  }
  const cnt = t.match(new RegExp(`${N}\\s*(bag|kit)s?\\s*(?:will\\s*)?cover\\w*\\s*(?:approx\\w*\\s*)?${N}\\s*m(?:2|\\u00b2)\\s*(?:at|@)\\s*${N}\\s*mm`, 'i'));
  if (cnt && !/\bkg\s*$/i.test(t.slice(0, cnt.index))) { if (+cnt[1] !== 1) return null; }
  const bag = cnt && !/\bkg\s*$/i.test(t.slice(0, cnt.index)) ? cnt
    : t.match(new RegExp(`(?:${N}\\s*kg\\s*)?(?:bag|kit)s?\\b[^.]{0,30}?\\bcover\\w*\\s*(?:approx\\w*\\s*)?${N}\\s*m(?:2|\\u00b2)\\s*(?:at|@)\\s*${N}\\s*mm`, 'i'));
  if (bag) {
    // two shapes: [kg?] bag ... cover A m2 at T mm   and   1 bag will cover A m2 at T mm
    let kg = null, a, tt;
    if (bag.length === 4) { kg = bag[1] != null ? +bag[1] : null; a = +bag[2]; tt = +bag[3]; }
    else { const cnt = +bag[1]; a = +bag[3]; tt = +bag[4]; if (cnt !== 1) return null; }
    if (kg == null) { const ks = (packList || []).filter((p) => p.unit === 'kg'); if (ks.length !== 1 || (packList || []).length !== ks.length) return null; kg = ks[0].amount; }
    if (!(kg > 0 && a > 0 && tt > 0)) return null;
    return { unit: 'kg', per_mm: r4(kg / (a * tt)), exact: kg / (a * tt), pack_kg: kg, cover_m2: a, at_mm: tt, basis: `one ${kg} kg bag covers ${a} m2 at ${tt} mm, as written` };
  }
  return null;
}

export function buildNum({ portal, lanes, log = () => {} }) {
  const OUT = path.join(portal, 'data', 'brain', 'num');
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const PDIR = path.join(portal, 'data', 'brain', 'p'); const SPEC = path.join(lanes, 'specs', 'by_product');
  const ids = fs.readdirSync(PDIR).filter((f) => f.endsWith('.json')).map((f) => decodeURIComponent(f.slice(0, -5))).sort();
  const TM = { pot_life: 'pot_life', open_time: 'open_time', cure_times: 'cure_time', recoat_times: 'overcoat_wait', skin_tack_times: 'skin_time', adjustability_time: 'adjust_time' };
  const fieldById = new Map(FIELDS.map((f) => [f.id, f]));
  const index = { v: 1, f: {} }; const stats = { products: 0, withFacts: 0, withNewFacts: 0, fromPds: 0, byField: {}, byFieldNew: {}, rates: 0, ratesProducts: 0 };
  for (const id of ids) {
    const sh = JSON.parse(fs.readFileSync(path.join(PDIR, encodeURIComponent(id) + '.json'), 'utf8'));
    const sf = path.join(SPEC, id + '.json'); const spec = fs.existsSync(sf) ? JSON.parse(fs.readFileSync(sf, 'utf8')) : null;
    const ds = spec && spec.datasheet ? spec.datasheet : null;
    const pdsSrc = (page) => ({ t: 'PDS', u: ds.url, v: ds.edition || '', p: page == null ? null : page });
    const webSrc = { t: 'WEB', u: sh.u, v: '', p: null };
    const onPage = new Set(); for (const it of (sh.d && sh.d.sec) || []) for (const f of FIELDS) if (f.label.test(String(it.l || '').replace(/\s*\(.*$/, '').trim())) onPage.add(f.id);
    if ((sh.pk && sh.pk.length) || (sh.d && sh.d.pk)) onPage.add('pack_sizes');
    const got = {}; const add = (fid, rec) => { const a = got[fid] = got[fid] || []; if (a.length < 3 && !a.some((x) => x.t === rec.t)) a.push(rec); };
    if (spec && ds) {
      for (const sec of Object.values(spec.clauses || {})) for (const c of sec.clauses || []) for (const r of c.rows || []) {
        const x = extractRow(r.label, r.value); if (!x) continue;
        add(x.id, { l: String(r.label).replace(/\s+/g, ' ').trim(), t: clamp(r.value), v: x.v, s: pdsSrc(r.page) });
      }
    }
    for (const it of (sh.d && sh.d.sec) || []) { // the product page's own labelled fields fill what the data sheet rows did not
      const x = extractRow(it.l, it.t); if (!x || (got[x.id] && got[x.id].length)) continue;
      add(x.id, { l: String(it.l).replace(/\s+/g, ' ').trim(), t: clamp(it.t), v: x.v, s: webSrc });
    }
    for (const [k, fid] of Object.entries(TM)) { // times the earlier build already read with a page and version
      if (got[fid] && got[fid].length) continue;
      for (const f of (sh.tm && sh.tm[k]) || []) {
        const p = f.parsed; if (!p || p.model !== 'duration' || p.min == null) continue;
        const k2 = { s: 1 / 60, sec: 1 / 60, min: 1, mins: 1, minute: 1, minutes: 1, h: 60, hr: 60, hrs: 60, hour: 60, hours: 60, d: 1440, day: 1440, days: 1440, week: 10080, weeks: 10080 }[String(p.unit).toLowerCase()]; if (!k2) continue;
        add(fid, { l: f.label || fieldById.get(fid).what, t: clamp(f.text), v: { items: [{ min_lo: r4(p.min * k2), min_hi: r4((p.max == null ? p.min : p.max) * k2), unit: String(p.unit), print: `${p.min}${p.max != null && p.max !== p.min ? ' to ' + p.max : ''} ${p.unit}`, q: null }], at_c: null }, s: { t: f.s && f.s.t ? f.s.t : 'WEB', u: f.s && f.s.u ? f.s.u : sh.u, v: f.s ? f.s.v : '', p: f.s && f.s.p != null ? f.s.p : null } });
      }
    }
    // thickness-aware coverage rates
    const packList = (got.pack_sizes && got.pack_sizes[0] && got.pack_sizes[0].v.items) || [];
    const shPacks = parsePackText(((sh.pk || []).map((p) => p.text).join(' ; ')) || String((sh.d && sh.d.pk) || ''));
    const rates = [];
    const facts = ((sh.r && sh.r.facts && sh.r.facts.consumption) || []);
    for (const f of facts) {
      const p = f.parsed || {};
      if (p.model === 'per_area' && (p.per === 'mm' || p.per === 'cm') && p.area_unit === 'm2' && f.calc && p.basis_stated && /^(kg|L)$/.test(p.unit || '')) {
        const k = p.per === 'cm' ? 0.1 : 1;
        rates.push({ k: 'per_m2_mm', unit: p.unit, lo: r4(p.min * k), hi: r4(p.max * k), per: p.per, t: clamp(f.text), fact: f.id, s: { t: f.s.t, u: f.s.u, v: f.s.v || '', p: f.s.p == null ? null : f.s.p } });
        continue;
      }
      const tr = thicknessRate(f.text, shPacks.length ? shPacks : packList);
      if (tr) rates.push({ k: 'per_m2_mm', unit: tr.unit, lo: tr.per_mm, hi: tr.per_mm, exact: tr.exact, derived: { pack_kg: tr.pack_kg, cover_m2: tr.cover_m2, at_mm: tr.at_mm, basis: tr.basis }, t: clamp(f.text), fact: f.id, s: { t: f.s.t, u: f.s.u, v: f.s.v || '', p: f.s.p == null ? null : f.s.p } });
    }
    const rec = { v: 1, id, n: sh.n, ds: ds ? { u: ds.url, v: ds.edition || '', pages: ds.pages || null } : null, f: got };
    if (rates.length) { rec.qr = rates.slice(0, 3); stats.rates += rates.length; stats.ratesProducts++; }
    stats.products++;
    const fids = Object.keys(got);
    if (fids.length || rates.length) {
      fs.writeFileSync(path.join(OUT, encodeURIComponent(id) + '.json'), JSON.stringify(rec));
      if (fids.length) stats.withFacts++;
      let anyNew = false;
      for (const fid of fids) {
        stats.byField[fid] = (stats.byField[fid] || 0) + 1;
        const isNew = !onPage.has(fid) && got[fid].some((x) => x.s.t === 'PDS'); if (isNew) { anyNew = true; stats.byFieldNew[fid] = (stats.byFieldNew[fid] || 0) + 1; }
        if (got[fid].some((x) => x.s.t === 'PDS')) stats.fromPds++;
        const rv = rankValue(fid, got[fid][0].v); const ent = rv ? [rv.lo, rv.hi, rv.at_c == null ? 0 : rv.at_c] : null;
        if (ent) { (index.f[fid] = index.f[fid] || {})[id] = ent; }
      }
      if (anyNew) stats.withNewFacts++;
    }
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
  log(`num: ${stats.withFacts} of ${stats.products} products with cited numeric facts (${stats.withNewFacts} with a data sheet fact the product page lacks), ${stats.ratesProducts} with a thickness rate`);
  return stats;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const PORTAL = process.env.SIKA_PORTAL || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c');
  const LANES = process.env.SIKA_LANES || '/home/tech2/klinge-kernel/state/sika/lanes';
  const st = buildNum({ portal: PORTAL, lanes: LANES, log: console.log });
  console.log(JSON.stringify(st));
}
