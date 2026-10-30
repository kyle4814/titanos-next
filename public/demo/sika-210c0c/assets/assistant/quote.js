// quote.js: turn an area / volume / length plus a product's own published rate into quantities and rounded-up pack counts.
import { productRates, parsePacks, convert, fmtNum, canonUnit } from './rates.js';

const f = (n) => { const r = Math.round(n * 100) / 100; return String(r); };
const range = (lo, hi, unit) => (Math.abs(hi - lo) < 1e-9 ? `${f(lo)} ${unit}` : `${f(lo)} to ${f(hi)} ${unit}`);
const plural = (w, n) => (n === 1 ? w : /(box|x)$/.test(w) ? w + 'es' : w + 's');

/** Pack-count text for an amount range in a rate unit against the product's pack sizes (rounds UP). */
export function packText(lo, hi, unit, packs, want) {
  const usable = packs.filter(p => !p.bulk && convert(1, unit, p.unit) != null);
  let list = usable;
  if (want) { const w = packs.filter(p => p.unit === want.unit && Math.abs(p.size - want.size) < 1e-6); if (w.length && convert(1, unit, w[0].unit) != null) list = w; else return { text: '', none: true, wanted: !w.length }; }
  if (!list.length) return { text: '', none: true };
  const opts = list.slice(0, 4).map(p => {
    const a = Math.ceil(convert(lo, unit, p.unit) / p.size - 1e-9), b = Math.ceil(convert(hi, unit, p.unit) / p.size - 1e-9);
    const n = Math.max(a, 1), m = Math.max(b, 1);
    return `${n === m ? n : n + ' to ' + m} x ${fmtNum(p.size)} ${p.unit} ${p.word}`;
  });
  return { text: opts.join(' or '), none: false };
}

/** Candidate rates for a product (cached by caller). */
export function ratesFor(product) { return productRates(product); }

function pickRates(rates, req, kinds) {
  let r = rates.filter(x => kinds.includes(x.kind));
  return r;
}

/** Compute a quote for one product. Returns {lines[], needs:[{key, question, options?}], assumptions[], noRate:boolean}. */
export function quoteProduct(product, rates, req, src) {
  const packs = parsePacks(product.packaging);
  const allow = (req.allowancePct || 0) / 100;
  const out = { lines: [], needs: [], assumptions: [], noRate: false };
  const A = req.area, V = req.volume, L = req.length;
  const base = { product: product.name, productId: product.id, source: src };
  const asm = (s) => { if (!out.assumptions.includes(s)) out.assumptions.push(s); };
  const userRates = req.userRate ? [req.userRate] : [];
  const all = userRates.length ? userRates : rates;
  if (!all.length) { out.noRate = true; return out; }
  const areaRates = pickRates(all, req, ['per_area', 'area_per_pack']);
  const m3Rates = pickRates(all, req, ['per_m3']);
  const cemRates = pickRates(all, req, ['per_100kg', 'pct_binder']);
  const tables = pickRates(all, req, ['joint_table', 'grout_table', 'linear_per_pack']);
  let produced = false;

  if (A != null && areaRates.length) {
    // dedupe identical rate+basis
    const seen = new Set();
    const chosen = areaRates.filter(r => { const k = r.kind + r.unit + r.low + r.high + r.basis + r.perMm; if (seen.has(k)) return false; seen.add(k); return true; });
    const useful = chosen.length > 4 ? chosen.slice(0, 4) : chosen;
    for (const r of useful) {
      if (r.kind === 'area_per_pack') {
        const lo = Math.ceil(A * (1 + allow) / r.high - 1e-9), hi = Math.ceil(A * (1 + allow) / r.low - 1e-9);
        out.lines.push({ ...base, quantity: `${range(A / r.high, A / r.low, r.pack + 's')} (area ${f(A)} m2 at ${range(r.low, r.high, 'm2 per ' + r.pack)})`, packs: `${lo === hi ? lo : lo + ' to ' + hi} ${plural(r.pack, hi)}${packs.filter(p => !p.bulk).length ? ' (' + packs.filter(p => !p.bulk).slice(0, 2).map(p => fmtNum(p.size) + ' ' + p.unit).join(' or ') + ' ' + (packs[0].word) + ')' : ''}`,
          basis: `Published rate ${range(r.low, r.high, 'm2 per ' + r.pack)}${r.basis ? ', ' + r.basis : ''}`, note: 'Rounded up to whole packs.' });
        produced = true; continue;
      }
      let mult = 1, parts = [];
      if (r.perMm) {
        const t = req.thickness;
        if (t == null) { out.needs.push({ key: 'thickness', question: `This rate is per mm of thickness (${range(r.low, r.high, r.unit + ' per m2 per mm')}). What layer thickness in mm do you need?` }); continue; }
        mult *= t; parts.push(`${f(t)} mm thick`);
      }
      if (r.perLayer || /coat|layer/i.test(r.basis)) { const c = req.coats || 1; mult *= c; parts.push(`${c} coat${c === 1 ? '' : 's'}`); if (!req.coats) asm('1 coat or layer assumed (you can say "2 coats").'); }
      let lo = r.low * A * mult * (1 + allow), hi = r.high * A * mult * (1 + allow);
      let unit = r.unit; if (unit === 'g' && lo >= 1000) { lo /= 1000; hi /= 1000; unit = 'kg'; } if (unit === 'ml' && lo >= 1000) { lo /= 1000; hi /= 1000; unit = 'L'; }
      let pk = packText(lo, hi, unit, packs, req.pack);
      let note = 'Rounded up to whole packs.';
      if (r.yieldPerPack) {
        const single = packs.filter(p => !p.bulk && (!req.pack || (p.unit === req.pack.unit && Math.abs(p.size - req.pack.size) < 1e-6)));
        if (single.length >= 1 && r.yieldPerPack.unit === 'L') {
          const p0 = single[0];
          const a = Math.ceil(lo / r.yieldPerPack.amount - 1e-9), b = Math.ceil(hi / r.yieldPerPack.amount - 1e-9);
          pk = { text: `${a === b ? a : a + ' to ' + b} x ${fmtNum(p0.size)} ${p0.unit} ${p0.word}`, none: false };
          asm(`The page lists a yield of ${f(r.yieldPerPack.amount)} L; this is read as the yield of one ${fmtNum(p0.size)} ${p0.unit} ${p0.word}. Check the datasheet to confirm.`);
        }
      }
      if (pk.none && !packs.length) note = 'No pack sizes are published on the product page, so I cannot round to packs.';
      else if (pk.none) note = pk.wanted ? 'The pack size you asked for is not in the published packaging; shown in the rate unit only.' : 'Pack size cannot be converted to the rate unit from the published text (mass and volume are not interchangeable here).';
      out.lines.push({ ...base, quantity: range(lo, hi, unit) + (parts.length ? ` (${parts.join(', ')})` : ''), packs: pk.text || undefined,
        basis: `Published rate ${range(r.low, r.high, unit0(r))}${r.basis ? ', ' + r.basis : ''}${req.userRate ? ' (rate supplied by you)' : ''}`, note });
      produced = true;
    }
  } else if (A != null && !areaRates.length && !m3Rates.length && !tables.length && !cemRates.length) { out.noRate = true; }
  else if (A == null && areaRates.length && V == null && L == null) out.needs.push({ key: 'area', question: 'How many square metres (m2) is the job?' });

  if (V != null && m3Rates.length) {
    for (const r of m3Rates.slice(0, 3)) {
      let lo = r.low * V * (1 + allow), hi = r.high * V * (1 + allow), unit = r.unit;
      if (unit === 'ml' && hi >= 1000) { lo /= 1000; hi /= 1000; unit = 'L'; }
      let pk = unit === 'bag' || unit === 'piece' ? { text: `${Math.ceil(lo - 1e-9)}${Math.ceil(hi - 1e-9) !== Math.ceil(lo - 1e-9) ? ' to ' + Math.ceil(hi - 1e-9) : ''} ${unit}s`, none: false } : packText(lo, hi, unit, packs, req.pack);
      out.lines.push({ ...base, quantity: range(lo, hi, unit === 'bag' ? 'bags' : unit), packs: pk.text || undefined, basis: `Published dosage ${range(r.low, r.high, r.unit + ' per m3')}${r.basis ? ', ' + r.basis : ''}`, note: 'Rounded up to whole packs. Dosage depends on the mix; the page says to confirm by trials.' });
      produced = true;
    }
  } else if (V != null && cemRates.length) {
    if (req.cementitious == null) out.needs.push({ key: 'cementitious', question: `The published dosage is per 100 kg of cementitious material, so I need the cementitious content of your mix. What is it in kg per m3 (for example 350)?` });
    else for (const r of cemRates.slice(0, 2)) {
      const mass = req.cementitious * V; let lo, hi, unit;
      if (r.kind === 'per_100kg') { lo = r.low * mass / 100; hi = r.high * mass / 100; unit = r.unit; } else { lo = r.low / 100 * mass; hi = r.high / 100 * mass; unit = 'kg'; }
      lo *= 1 + allow; hi *= 1 + allow;
      if (unit === 'ml' && hi >= 1000) { lo /= 1000; hi /= 1000; unit = 'L'; }
      const pk = packText(lo, hi, unit, packs, req.pack);
      out.lines.push({ ...base, quantity: range(lo, hi, unit), packs: pk.text || undefined, basis: `Published dosage ${range(r.low, r.high, r.kind === 'pct_binder' ? '% by weight of binder' : r.unit + ' per 100 kg cementitious')}, ${f(req.cementitious)} kg/m3 cementitious x ${f(V)} m3`, note: 'Rounded up to whole packs.' });
      produced = true;
    }
    if (produced) asm(`Cementitious content of ${f(req.cementitious)} kg per m3 as you stated.`);
  }

  if (tables.length) for (const t of tables) tableQuote(t, product, packs, req, out, base, asm, A, L) && (produced = true);
  if (!produced && !out.needs.length && !out.noRate) {
    if (A == null && V == null && L == null) out.needs.push({ key: 'area', question: 'How many square metres (m2), cubic metres (m3) or linear metres is the job?' });
    else out.noRate = true;
  }
  if (allow) asm(`Allowance of ${f(req.allowancePct)} percent added as you asked.`); else asm('Allowance for waste: 0 percent (you can say "add 10% waste"). The published rates are theoretical and do not include surface porosity, profile or wastage.');
  return out;
}

function unit0(r) { return `${r.unit} per m2${r.perMm ? ' per mm' : ''}`; }

function tableQuote(t, product, packs, req, out, base, asm, A, L) {
  if (t.kind === 'linear_per_pack') {
    if (L == null) { out.needs.push({ key: 'length', question: `The page gives about ${f(t.low)} m of bead per pack. How many linear metres do you need?` }); return false; }
    const n = Math.ceil(L * (1 + (req.allowancePct || 0) / 100) / t.low - 1e-9);
    const pk = packs.filter(p => !p.bulk)[0];
    out.lines.push({ ...base, quantity: `${f(L)} m of bead`, packs: `${n} x ${pk ? fmtNum(pk.size) + ' ' + pk.unit + ' ' + pk.word : 'pack'}`, basis: `Published yield ${f(t.low)} m per pack${t.basis ? ' (' + t.basis.slice(0, 80) + ')' : ''}`, note: 'Rounded up to whole packs.' });
    return true;
  }
  if (t.kind === 'joint_table') {
    if (L == null || req.width == null || req.depth == null) {
      out.needs.push({ key: 'joint', question: `Joint sealant coverage depends on joint size. Tell me the joint length in metres plus width x depth in mm (for example "20 m of 10 x 10 mm joint").`,
        options: t.rows.map(r => ({ label: `${f(r.width)} x ${f(r.depth)} mm`, value: `${f(r.width)} x ${f(r.depth)} mm joint` })) });
      return false;
    }
    const row = t.rows.find(r => r.width === req.width && r.depth === req.depth);
    if (!row) { out.needs.push({ key: 'joint', question: `The published table does not list a ${f(req.width)} x ${f(req.depth)} mm joint. Listed sizes are below.`, options: t.rows.map(r => ({ label: `${f(r.width)} x ${f(r.depth)} mm`, value: `${f(L)} m of ${f(r.width)} x ${f(r.depth)} mm joint` })) }); return false; }
    row.lengths.forEach((len, i) => {
      const n = Math.ceil(L * (1 + (req.allowancePct || 0) / 100) / len - 1e-9);
      out.lines.push({ ...base, quantity: `${f(L)} m of ${f(req.width)} x ${f(req.depth)} mm joint`, packs: `${n} x ${t.packs[i] || 'pack'}`, basis: `Published table: ${f(len)} m of joint per ${t.packs[i] || 'pack'} at ${f(row.width)} x ${f(row.depth)} mm`, note: 'Rounded up to whole packs.' });
    });
    return true;
  }
  if (t.kind === 'grout_table') {
    if (A == null) return false;
    if (!req.tile || req.joint == null) {
      out.needs.push({ key: 'tilejoint', question: `Grout use depends on tile size and joint width. Tell me both (for example "600x300 tiles, 3 mm joint").`, options: t.rows.filter(r => r.complete).slice(0, 8).map(r => ({ label: r.tile, value: `${r.tile.replace(/x\d+\s*mm$/i, '').replace(/mm/i, '')} tiles` })) });
      return false;
    }
    const row = t.rows.find(r => r.tile.replace(/\s+/g, '').toLowerCase().startsWith(req.tile));
    const ci = t.cols.findIndex(c => c === req.joint);
    if (!row || ci < 0 || row.values[ci] == null || !row.complete) { out.needs.push({ key: 'tilejoint', question: `The published grout table has no complete entry for ${req.tile} tiles with a ${f(req.joint)} mm joint. Check the datasheet for that combination.` }); return false; }
    const v = row.values[ci];
    if (t.mode === 'area_per_pack') {
      const n = Math.ceil(A * (1 + (req.allowancePct || 0) / 100) / v - 1e-9);
      out.lines.push({ ...base, quantity: `${f(A)} m2 of ${row.tile} tiles at ${f(req.joint)} mm joints`, packs: `${n} x ${t.pack || 'pack'}`, basis: `Published table: ${f(v)} m2 per ${t.pack.replace(/^.*pail$/i, m => m)}`, note: 'Rounded up to whole packs.' });
    } else {
      const kg = v * A * (1 + (req.allowancePct || 0) / 100); const pk = packText(kg, kg, 'kg', packs, req.pack);
      out.lines.push({ ...base, quantity: `${f(kg)} kg`, packs: pk.text || undefined, basis: `Published table: ${f(v)} kg per m2 for ${row.tile} tiles at ${f(req.joint)} mm joints`, note: 'Rounded up to whole packs.' });
    }
    return true;
  }
  return false;
}
