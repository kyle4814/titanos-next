// cards.js: builders for each typed answer card. Every number a card shows is inside a fact sentence, a fact version, a product name,
// the visitor's own question, or a calculation that carries its inputs (calc) so it can be recomputed.
import { card, fact, CHIPS, NOT_KNOWN } from './schema.js';
import { numbersIn } from './text.js';
import { normaliseFact, quantity, packRange, packRangeText, doseBasisText, inputFor, fmtQty, fmtK, DOSE_KINDS } from '../lib/finder/calc.js';

export const prod = (s) => ({ id: s.id, name: s.n, url: s.u });
const num = (x) => (Math.round((x + 1e-9) * 100) / 100).toString();
const srcFact = (f, text) => fact({ source_url: f.s ? f.s.u : '', page: f.s ? f.s.p : null, sentence: text == null ? f.text : text, doc_type: f.s ? f.s.t : '', doc_version: f.s ? f.s.v : '' });
const chipOf = (f) => (f.s && (f.s.t === 'PDS' || f.s.t === 'SDS') ? CHIPS.DATASHEET : CHIPS.PAGE);
const where = (f) => (f.s && f.s.t === 'WEB' ? 'product page' : 'data sheet') + (f.s && f.s.p ? ', page ' + f.s.p : '');
const dsLink = (sh) => (sh.r && sh.r.ds && sh.r.ds.url ? [{ label: 'Open the data sheet', url: sh.r.ds.url }] : (sh.dc || []).filter((d) => d.ok && d.ty === 'product_data_sheet').slice(0, 1).map((d) => ({ label: 'Open the data sheet', url: d.u })));

export function unknown(question, sh, reason, missing = [], extra = {}) {
  return card({ type: 'unknown', status: 'UNKNOWN', title: sh ? sh.n : 'Not in the published documentation', product: sh ? prod(sh) : null, headline: NOT_KNOWN, facts: [], source: null, chip: CHIPS.UNKNOWN,
    links: sh ? dsLink(sh).concat([{ label: 'Product page', url: sh.u }]) : [], handoff: { question, product: sh ? sh.n : '', reason, missing }, followups: extra.followups || [] });
}

export function productCard(sh, sentence, why, withPack = false) {
  const f = fact({ source_url: sh.u, page: null, sentence: sentence || sh.d.t || sh.n, doc_type: 'WEB' });
  return card({ type: 'product', title: sh.n, product: prod(sh), headline: sh.d.t || sh.d.s || '', lines: [why ? { label: 'Why this one', text: why } : null, withPack && sh.d.pk ? { label: 'Packaging', text: sh.d.pk } : null].filter(Boolean),
    facts: [f, (sh.d.t || sh.d.s) && (sh.d.t || sh.d.s) !== f.sentence ? fact({ source_url: sh.u, sentence: sh.d.t || sh.d.s, doc_type: 'WEB' }) : null, sh.d.pk ? fact({ source_url: sh.u, page: null, sentence: sh.d.pk, doc_type: 'WEB' }) : null].filter(Boolean), source: f, chip: CHIPS.PAGE, links: [{ label: 'Open the product page', url: sh.u }], followups: [`Coverage of ${sh.n}`, `Data sheet for ${sh.n}`, `Safety data sheet for ${sh.n}`] });
}

const DOC_LABEL = { product_data_sheet: 'Product data sheet', safety_data_sheet: 'Safety data sheet', brochure: 'Brochure', environmental_product_declaration: 'Environmental product declaration', certificate: 'Certificate', system_data_sheet: 'System data sheet', guide: 'Guide', technical_information: 'Technical information' };
export function documentCard(sh, docs, wantLabel) {
  const facts = docs.map((d) => fact({ source_url: d.u, page: null, sentence: `${d.tl || DOC_LABEL[d.ty] || 'Document'}: ${d.t}`, doc_type: d.ty, doc_version: d.v }));
  return card({ type: 'document', title: `${wantLabel} for ${sh.n}`, product: prod(sh), headline: `The published ${wantLabel.toLowerCase()} for ${sh.n}.`,
    lines: docs.map((d) => ({ label: d.tl || DOC_LABEL[d.ty] || 'Document', text: d.t + (d.v ? ', ' + d.v : '') })), facts, chip: CHIPS.DATASHEET, links: docs.map((d) => ({ label: `${d.tl || DOC_LABEL[d.ty] || 'Document'}: ${d.t}`, url: d.u })),
    followups: [`Coverage of ${sh.n}`, `How long does ${sh.n} take to cure`] });
}

export function rateCard(sh, question) {
  const st = (sh.r && sh.r.status) || '';
  const facts = ((sh.r && sh.r.facts && sh.r.facts.consumption) || []);
  if (!facts.length) {
    const seeDs = /see data sheet|method statement/i.test(st);
    return unknown(question, sh, seeDs ? 'The data sheet text mentions coverage but no figure could be read from it reliably. Please read the data sheet or ask Technical Services.' : 'Neither the published data sheet nor the product page gives a coverage or consumption figure for this product.', ['consumption rate']);
  }
  const shown = facts.slice(0, 4);
  return card({ type: 'rate', title: `Published coverage for ${sh.n}`, product: prod(sh), headline: 'The published consumption, quoted exactly as written. Figures are theoretical and the data sheet does not include wastage.',
    lines: shown.map((f) => ({ label: `${f.label || 'Consumption'} (${where(f)})`, text: f.text, fact: f.id })), facts: shown.map((f) => srcFact(f)), chip: chipOf(shown[0]), links: dsLink(sh),
    followups: [`How much ${sh.n} do I need for my area`, `How long does ${sh.n} take to cure`] });
}

const TIME_TITLE = { open_time: 'Open time', adjustability_time: 'Adjustability time', pot_life: 'Pot life', skin_tack_times: 'Skin or tack time', cure_times: 'Cure, setting or waiting time', recoat_times: 'Recoat time' };
export function timeCard(sh, kinds, question) {
  const rows = []; for (const k of kinds) for (const f of (sh.tm && sh.tm[k]) || []) rows.push({ k, f });
  if (!rows.length) return unknown(question, sh, 'The published documentation gives no time of this kind for this product.', kinds.map((k) => TIME_TITLE[k]));
  const shown = rows.slice(0, 6);
  return card({ type: 'time', title: `Published times for ${sh.n}`, product: prod(sh), headline: 'The published times, quoted as written, with the conditions they were measured under.',
    lines: shown.map(({ k, f }) => ({ label: `${f.label || TIME_TITLE[k]} (${where(f)})`, text: f.text, fact: f.id })), facts: shown.map(({ f }) => srcFact(f)), chip: chipOf(shown[0].f), links: dsLink(sh) });
}

export function safetyCard(sh, topic, question) {
  const sds = sh.sf && sh.sf.sds && sh.sf.sds[0];
  if (!sds) return unknown(question, sh, 'No safety data sheet is linked for this product in the published documentation.', ['safety data sheet'], {});
  const ver = `Revision ${sds.revision_date}, version ${sds.version}`;
  const lines = [], facts = [];
  const add = (label, t, s) => { if (!t) return; lines.push({ label, text: t }); facts.push(fact({ source_url: (s && s.u) || sds.url, page: s ? s.p : null, sentence: t, doc_type: 'SDS', doc_version: (s && s.v) || ver })); };
  if (sds.signal_word && sds.signal_word.value) add('Signal word', sds.signal_word.text, sds.signal_word.s);
  const want = (re) => !topic || re.test(topic);
  if (want(/hazard|dangerous|toxic|flammable|safe/)) for (const h of (sds.hazard_statements || []).slice(0, 4)) add('Hazard', h.text, h.s);
  if (want(/ppe|glove|mask|respirator|goggle|protect|ventilation/)) { for (const k of ['respiratory', 'hands', 'eyes', 'skin_body']) { const p = sds.ppe && sds.ppe[k]; if (p) add(p.label, p.text, p.s); } }
  if (want(/stor/)) for (const st of (sds.storage || []).slice(0, 2)) add(st.label, st.text, st.s);
  if (!lines.length) for (const st of (sds.handling || []).slice(0, 2)) add(st.label, st.text, st.s);
  if (!lines.length) return unknown(question, sh, 'The safety data sheet does not state this. Please read section 4 to 8 of the safety data sheet.', [topic || 'safety']);
  return card({ type: 'safety', title: `Safety information for ${sh.n}`, product: prod(sh), headline: `Quoted from the safety data sheet, ${ver}. Check the current safety data sheet before use.`, lines, facts, chip: CHIPS.DATASHEET, links: [{ label: 'Open the safety data sheet', url: sds.url }] });
}

export function compatCard(sh, verdict, rule, question, conds, uncovered) {
  const f = fact({ source_url: rule ? rule.s.u : '', page: rule && rule.s ? rule.s.p : null, sentence: rule ? rule.text : '', doc_type: rule && rule.s ? rule.s.t : '', doc_version: rule && rule.s ? rule.s.v : '' });
  const what = conds.length ? conds.join(' and ') : 'that';
  if (verdict === 'unknown') {
    const c = unknown(question, sh, uncovered.length ? `The published documentation for ${sh.n} does not mention ${uncovered.join(' or ')}. I will not guess.` : `The published documentation for ${sh.n} does not say whether it suits ${what}. I will not guess.`, uncovered.length ? uncovered : conds);
    if (rule) { c.lines = [{ label: 'Closest published sentence', text: rule.text }]; c.facts = [f]; c.source = f; }
    c.type = 'compatibility'; c.headline = `It does not mention ${(uncovered.length ? uncovered : conds).join(' or ') || 'that'}. I will not guess.`; return c;
  }
  const head = verdict === 'no' ? 'No.' : verdict === 'conditional' ? 'Only under the condition in its own sentence.' : 'Yes.';
  return card({ type: 'compatibility', title: `${sh.n}: ${what}`, product: prod(sh), headline: `${head} The published sentence is quoted below.`, lines: [{ label: verdict === 'no' ? 'Not suitable' : 'Suitable', text: rule.text, fact: rule.id }], facts: [f],
    chip: CHIPS.DATASHEET, links: dsLink(sh), status: 'PUBLISHED', followups: [`Coverage of ${sh.n}`, `Safety data sheet for ${sh.n}`] });
}

// ---- calculation: only from a calc_ready fact; quantity and packs, never prices; waste only if the visitor gives it (never taken from Sika)
export function parsePacks(sh) {
  const out = [];
  for (const f of sh.pk || []) for (const s of (f.parsed && f.parsed.sizes) || []) out.push({ amount: s.amount, unit: s.unit, container: s.container || '' });
  const seen = new Set(); return out.filter((p) => { const k = p.amount + p.unit; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.amount - b.amount);
}
export function computeQuantity(f, area, thickness) {
  const p = f.parsed || {};
  if (!f.calc || !p.basis_stated) return null;
  // a rate "per mm" or "per cm" of thickness is only a quantity once the thickness is known; it is never read as one millimetre by default
  if (p.model === 'per_area' && (p.per === 'mm' || p.per === 'cm')) {
    if (!(thickness > 0) || !/^(L|kg)$/.test(p.unit || '') || p.area_unit !== 'm2') return null;
    const k = thickness * (p.per === 'cm' ? 0.1 : 1);
    return { unit: p.unit, need_min: area * p.min * k, need_max: area * p.max * k, basis: 'per_area_thickness', thickness_mm: thickness };
  }
  if (p.model === 'pack_covers_area' && p.area_min > 0) return { unit: p.unit, need_min: area / p.area_max * p.amount, need_max: area / p.area_min * p.amount, basis: 'pack_covers_area' };
  if (p.model === 'area_per_unit' && p.min > 0 && /^(L|kg)$/.test(p.unit || '')) return { unit: p.unit, need_min: area / p.max, need_max: area / p.min, basis: 'area_per_unit' };
  if (p.model === 'per_area' && /^(kg|L)$/.test(p.unit || '') && p.area_unit === 'm2' && !(p.coats_max > 1)) return { unit: p.unit, need_min: area * p.min, need_max: area * p.max, basis: 'per_area' };
  return null;
}
// ---- dosage products: the same maths as the product page (lib/finder/calc.js), so the advisor and the page cannot disagree
const doseFacts = (sh) => (((sh.r && sh.r.facts && sh.r.facts.consumption) || []).map((f) => ({ f, n: normaliseFact({ text: f.text, parsed: f.parsed }) })).filter((x) => x.n.ok && DOSE_KINDS.includes(x.n.kind)));
export const isDoseProduct = (sh) => { const all = ((sh.r && sh.r.facts && sh.r.facts.consumption) || []).map((f) => normaliseFact({ text: f.text, parsed: f.parsed })).filter((n) => n.ok); return all.length > 0 && all.every((n) => DOSE_KINDS.includes(n.kind)); };
export function doseNeedCard(sh) {
  const k = inputFor(doseFacts(sh)[0].n);
  const [ask, opts] = k === 'volume' ? ['How many cubic metres of concrete or mix? The dose is published per cubic metre.', [1, 5, 10].map((v) => `How much ${sh.n} for ${v} m3`)] : k === 'water' ? ['How many litres of water?', [100, 200].map((v) => `How much ${sh.n} for ${v} L of water`)] : k === 'mix' ? ['How many kg of mix?', [20, 100].map((v) => `How much ${sh.n} for ${v} kg of mix`)] : ['How many kilograms of cement or binder are in the mix? The dose is published per set mass of it.', [500, 1000, 2000].map((v) => `How much ${sh.n} for ${v} kg of cement`)];
  return chooseCard(`How much ${sh.n}?`, ask, opts);
}
export function doseCard(sh, dose, question) {
  const job = { cementKg: dose.cementKg, mixKg: dose.mixKg, waterL: dose.waterL, volume: dose.volume };
  const usable = doseFacts(sh).map((x) => ({ ...x, q: quantity(x.n, job) })).filter((x) => x.q.ok).slice(0, 3);
  if (!usable.length) return doseNeedCard(sh);
  const packs = parsePacks(sh); const lines = [], outFacts = [];
  lines.push({ label: 'Size you asked about', text: [dose.cementKg && `${fmtK(dose.cementKg)} kg of cement or binder`, dose.mixKg && `${fmtK(dose.mixKg)} kg of mix`, dose.waterL && `${fmtK(dose.waterL)} L of water`, dose.volume && `${fmtK(dose.volume)} m3`].filter(Boolean).join(', ') });
  for (const { f, n, q } of usable) {
    lines.push({ label: `Published dose (${where(f)})`, text: doseBasisText(n), fact: f.id });
    lines.push({ label: 'Quantity', text: q.limit === 'max' ? `up to ${fmtQty(q.high, q.unit)}` : q.limit === 'min' ? `at least ${fmtQty(q.low, q.unit)}` : q.low === q.high ? fmtQty(q.low, q.unit) : `${fmtQty(q.low, q.unit)} to ${fmtQty(q.high, q.unit)}`, fact: f.id });
    if (q.typical != null) lines.push({ label: 'Typical dose in the same statement', text: fmtQty(q.typical, q.unit), fact: f.id });
    if (q.unit !== 'bags') { const pr = packRange(packs.map((p) => ({ amount: p.amount, unit: p.unit })), q); lines.push({ label: 'Whole packs, rounded up', text: pr.options.length ? pr.options.map((o) => packRangeText(o, q.limit)).join('; ') : 'The published pack sizes use a different unit, so I will not convert them without a stated density.' }); }
    outFacts.push(srcFact(f));
  }
  lines.push({ label: 'Waste', text: 'Not included. The data sheet figures are theoretical; add your own allowance.' });
  return card({ type: 'calculation', title: `How much ${sh.n}`, product: prod(sh), headline: 'Worked out from the published dose below. The published range stays a range: no midpoint is picked. This is a quantity estimate only, not a price and not an offer. Confirm with the data sheet and Sika Technical Services before ordering.',
    lines, facts: outFacts, chip: CHIPS.DERIVED, links: dsLink(sh), calc: { derived: true, inputs: { cement_kg: dose.cementKg || null, mix_kg: dose.mixKg || null, water_l: dose.waterL || null, volume_m3: dose.volume || null, facts: usable.map((x) => x.f.id), packs }, outputs: usable.map((x) => ({ unit: x.q.unit, need_min: x.q.low, need_max: x.q.high, basis: x.n.kind })), plan: [] } });
}
export function calcCard(sh, area, question, thickness) {
  const facts = ((sh.r && sh.r.facts && sh.r.facts.consumption) || []);
  if (!facts.length) return unknown(question, sh, 'The published documentation gives no coverage figure for this product, so I cannot work out a quantity.', ['consumption rate']);
  const usable = facts.map((f) => ({ f, q: computeQuantity(f, area, thickness) })).filter((x) => x.q).slice(0, 2);
  if (!usable.length && !(thickness > 0) && facts.some((f) => f.calc && f.parsed && f.parsed.basis_stated && f.parsed.model === 'per_area' && (f.parsed.per === 'mm' || f.parsed.per === 'cm'))) {
    return chooseCard(`How much ${sh.n}?`, 'The published rate is per millimetre of thickness, so the quantity depends on how thick you apply it. How thick, in mm?', [3, 5, 10].map((t) => `How much ${sh.n} for ${num(area)} m2 at ${t} mm`));
  }
  if (!usable.length) { const c = rateCard(sh, question); c.headline = 'I will not turn this into a quantity: the published figure does not say what it is per (or needs a condition). Here is the sentence exactly as written. Please confirm with Technical Services.'; c.type = 'rate'; return c; }
  const packs = parsePacks(sh); const lines = [{ label: 'Area you asked about', text: `${num(area)} m2` }], outFacts = [], planOut = [];
  for (const { f, q } of usable) {
    const range = Math.abs(q.need_max - q.need_min) > 1e-9;
    lines.push({ label: `Quantity (${where(f)}${q.thickness_mm ? ', at ' + num(q.thickness_mm) + ' mm' : ''})`, text: range ? `${num(q.need_min)} to ${num(q.need_max)} ${q.unit}` : `${num(q.need_max)} ${q.unit}`, fact: f.id });
    const same = packs.filter((p) => p.unit === q.unit);
    if (same.length) {
      const plan = same.map((p) => ({ size: p.amount, unit: p.unit, container: p.container, count: Math.ceil(q.need_max / p.amount - 1e-9) }));
      planOut.push(...plan);
      lines.push({ label: 'Packs that cover the higher figure', text: plan.map((p) => `${p.count} x ${p.size} ${p.unit}${p.container ? ' ' + p.container : ''}`).join(' or ') });
    } else lines.push({ label: 'Packs', text: 'The published pack sizes use a different unit, so I will not convert them without a stated density.' });
    outFacts.push(srcFact(f));
  }
  lines.push({ label: 'Waste', text: 'Not included. The data sheet figures are theoretical; add your own allowance.' });
  return card({ type: 'calculation', title: `How much ${sh.n} for ${num(area)} m2`, product: prod(sh), headline: 'Worked out from the published rate below. This is a quantity estimate only, not a price and not an offer. Confirm with the data sheet and Sika Technical Services before ordering.',
    lines, facts: outFacts, chip: CHIPS.DERIVED, links: dsLink(sh), calc: { derived: true, inputs: { area_m2: area, ...(thickness > 0 ? { thickness_mm: thickness } : {}), facts: usable.map((x) => x.f.id), packs }, outputs: usable.map((x) => ({ unit: x.q.unit, need_min: x.q.need_min, need_max: x.q.need_max, basis: x.q.basis })), plan: planOut } });
}

export function compareCard(a, b) {
  const row = (label, fa, fb) => [label, fa, fb];
  const cons = (s) => (s.r && s.r.facts && s.r.facts.consumption && s.r.facts.consumption[0]) || null;
  const ca = cons(a), cb = cons(b);
  const facts = [], rows = [];
  rows.push(row('What it is', a.d.t || a.d.s || 'Not in the published documentation', b.d.t || b.d.s || 'Not in the published documentation'));
  facts.push(fact({ source_url: a.u, sentence: a.d.t || a.d.s, doc_type: 'WEB' }), fact({ source_url: b.u, sentence: b.d.t || b.d.s, doc_type: 'WEB' }));
  rows.push(row('Coverage', ca ? ca.text : 'Not in the published documentation', cb ? cb.text : 'Not in the published documentation'));
  if (ca) facts.push(srcFact(ca)); if (cb) facts.push(srcFact(cb));
  rows.push(row('Packaging', a.d.pk || 'Not in the published documentation', b.d.pk || 'Not in the published documentation'));
  if (a.d.pk) facts.push(fact({ source_url: a.u, sentence: a.d.pk, doc_type: 'WEB' })); if (b.d.pk) facts.push(fact({ source_url: b.u, sentence: b.d.pk, doc_type: 'WEB' }));
  return card({ type: 'comparison', title: `${a.n} and ${b.n} side by side`, product: null, headline: 'Both columns are quoted from the published documentation. Where one is silent, it says so.', table: { cols: ['', a.n, b.n] , rows }, facts: facts.filter((f) => f.sentence), chip: CHIPS.PAGE,
    links: [{ label: a.n, url: a.u }, { label: b.n, url: b.u }] });
}

export function specCard(sh, clauses, specDs, question) {
  if (!clauses.length) {
    const stds = (sh.sp && sh.sp.std) || [];
    if (!stds.length) return unknown(question, sh, 'No specification clause or standard citation is published for this product.', ['specification clause']);
    const shown = stds.slice(0, 4);
    return card({ type: 'spec', title: `Standards cited by the ${sh.n} data sheet`, product: prod(sh), headline: 'These are the data sheet\'s own sentences. A citation is not a statement of compliance; only the sentence itself says what it says.',
      lines: shown.map((s) => ({ label: s.citation + (s.page ? `, page ${s.page}` : ''), text: s.context })), facts: shown.map((s) => fact({ source_url: sh.sp.ds.url, page: s.page, sentence: s.context, doc_type: 'PDS', doc_version: sh.sp.ds.edition })), chip: CHIPS.DATASHEET, links: dsLink(sh) });
  }
  const lines = [], facts = [];
  for (const c of clauses.slice(0, 3)) {
    const srcs = (c.s || []).filter((x) => typeof x === 'string');
    lines.push({ label: `Clause ${c.no}: ${c.t}`, text: srcs[0] || c.c || '' });
    facts.push(fact({ source_url: specDs.url, page: c.p || null, sentence: srcs[0] || c.c || '', doc_type: 'PDS', doc_version: specDs.edition }));
  }
  return card({ type: 'spec', title: `Specification clauses for ${sh.n}`, product: prod(sh), headline: 'Clause headings with the data sheet sentence each one is built from. Draft for editing, not approved by Sika.', lines, facts: facts.filter((f) => f.sentence), chip: CHIPS.DATASHEET, links: dsLink(sh) });
}

export function systemCard(sys, titleExtra) {
  const rows = [], facts = [];
  for (const st of sys.steps) {
    if (!st.opt.length) { rows.push([st.label, 'Not in the published documentation', '']); continue; }
    const o = st.opt[0];
    rows.push([st.label, o.n, o.s || o.r || '']);
    if (o.s || o.r) facts.push(fact({ source_url: o.u, sentence: o.s || o.r, doc_type: 'WEB' }));
  }
  return card({ type: 'system', title: sys.title, product: null, headline: 'The published system, in order. Each product is named in its own documentation for this job; the sentence it comes from is beside it.', table: { cols: ['Step', 'Product', 'Published sentence'], rows }, facts: facts.filter((f) => f.sentence), chip: CHIPS.PAGE,
    links: [{ label: 'Open the one-page system sheet', url: `systems/${sys.slug}/` }] });
}

export function chooseCard(title, headline, options, facts = [], labels = null) {
  const c = card({ type: 'choose', title, headline, facts, source: facts.find((f) => f.sentence) || null, status: 'PUBLISHED', chip: CHIPS.PUBLISHED, followups: options });
  if (labels) c.choices = options.map((value, i) => ({ label: labels[i], value }));
  return c;
}
export function ruleCard(rule) {
  const f = fact({ source_url: rule.source_url, sentence: rule.answer, doc_type: 'RULE' });
  return card({ type: 'rule', title: 'Corrected answer', headline: rule.answer, facts: [f], chip: CHIPS.RULE, links: [{ label: 'Source for this correction', url: rule.source_url }], lines: [{ label: 'Corrected by', text: `${rule.who}, ${String(rule.corrected_at).slice(0, 10)}` }] });
}
// Lane D: the 'plan' card type (see schema.js CARD_TYPES) is built by planCard() and rulesCard() in rules.js, so the actions chunk, which shares this file, does not carry it.
export { numbersIn };
