// rules_plan.js: part 2 of 3 (split from rules.js, no behaviour change): assembling the plan, its conditions, prerequisites, joints and standards, and the plan card.
import { card, fact, CHIPS, NOT_KNOWN } from './schema.js';
import { TILE_LABEL, SUB_LABEL, LOC_LABEL, KIND_OF_ROLE, ROLE_ORDER, POROUS, NONPOROUS, locClass, axisOf, cite, rowsOf, pickWait, pickCold, ruleApplies } from './rules_read.js';

// ------------------------------------------------------------------ 4. assembling the plan
/** One zone's key parts, or null when the constraints are incomplete. */
export function zoneOf(K, loc) { return { tile: K.tile, sub: K.sub, loc, key: [K.tile, K.sub, loc].join('|') }; }

export function sealantInfo(data, pid) {
  const r = rowsOf(data, pid, 'wait').find((x) => x[1].kinds.includes('skin') || x[1].kinds.includes('tack'));
  return r ? cite(pid, r, data.rules[pid]) : null;
}
export const SVC = { dry: 'dry area', wet: 'wet area', submerged: 'submerged' };

/**
 * assemblePlan(K, data, zoneLoc): data = { sys, rules } where sys is rules/sys.json and rules maps product id -> { m, r } (rules/tile.json products).
 * Returns the plan object. The shape of the card made from it is documented at planCard() below.
 */
export function assemblePlan(K, data, loc) {
  const zone = zoneOf(K, loc); const sys = data.sys.systems[zone.key];
  const plan = { mode: 'plan', zone: { ...zone, tileLabel: TILE_LABEL[K.tile], subLabel: SUB_LABEL[K.sub], locLabel: LOC_LABEL[loc] }, K, steps: [], blockers: [], voids: [], checks: [], prereqs: [], joints: [], standards: [], notes: [], documents: [], alternatives: [], timeline: null, status: 'plan' };
  if (!sys) { plan.status = 'none'; plan.alternatives = alternativesFor(K, data, loc); return plan; }
  plan.system = { slug: sys[0], title: sys[1] };
  { const w = K.where || {}; if (w.floorAssumed) plan.notes.push({ k: 'assume', text: 'You did not say floor or wall. A room such as a hallway is a floor, so this is the floor system.' }); else if (!w.pool && !w.floor && !w.wall && (w.wet || w.external)) plan.notes.push({ k: 'assume', text: 'You did not say floor or wall, so the floor and the wall systems are both shown.' }); }
  const porous = POROUS.has(K.sub) ? true : NONPOROUS.has(K.sub) ? false : null; const axis = axisOf(loc); const lcl = locClass(loc);
  const ctx = { axis, porous };
  // the steps, with the options that survive the customer's constraints
  const byRole = {};
  for (const [role, stated, ids] of sys[2]) {
    const keep = [], out = [];
    for (const id of ids) {
      const m = data.rules[id]; if (!m) { keep.push(id); continue; }
      const hits = rowsOf(data, id, 'no').filter((r) => ruleApplies(r[1].tags, K, zone, r[1], r[2]));
      if (hits.length) out.push({ id, rule: cite(id, hits[0], m), more: hits.slice(1).map((h) => cite(id, h, m)) }); else keep.push(id);
    }
    byRole[role] = { role, stated: !!stated, ids, keep, out };
  }
  // timber: the published system is for the over-sheeted floor; the sheets that rule out fixing directly onto timber are quoted
  if (K.sub === 'timber-floor') {
    const direct = []; for (const [, , ids] of sys[2]) for (const id of ids) for (const r of rowsOf(data, id, 'no')) if (r[1].tags.substrate && r[1].tags.substrate.includes('timber')) direct.push(cite(id, r, data.rules[id]));
    plan.notes.push({ k: 'timber', text: 'The published timber system is for a timber or particleboard floor that has been over-sheeted. Tiling directly onto timber is ruled out by the data sheets quoted here.', cites: direct.slice(0, 3) });
    if (K.flags.direct && direct.length) plan.blockers.push({ why: 'Fixing tiles directly onto timber is ruled out by the data sheets of this system.', rules: direct.slice(0, 4), role: 'adhesive' });
  }
  for (const role of ROLE_ORDER) {
    const b = byRole[role]; if (!b) continue;
    const main = b.keep[0] || null; const mm = main ? data.rules[main] : null;
    plan.steps.push({ role, label: KIND_OF_ROLE[role], stated: b.stated, main: main ? { id: main, name: mm ? mm.m[0] : main, page: mm ? mm.m[1] : '', pds: mm ? mm.m[2] : '', sds: mm ? mm.m[3] : '', ed: mm ? mm.m[4] : '' } : null,
      alts: b.keep.slice(1).map((id) => ({ id, name: data.rules[id] ? data.rules[id].m[0] : id })), excluded: b.out, wait: null, waitSteps: [] });
  }
  // blockers: a step whose every named product is ruled out, or a rule that hits the whole job
  for (const st of plan.steps) {
    if (st.role === 'sealant' && st.stated && !st.main && st.excluded.length) { plan.notes.push({ k: 'sealant', text: 'Every sealant this system names is ruled out for your stone by its own data sheet. Ask Sika Technical Services which sealant to use.', cites: st.excluded.slice(0, 2).map((e) => e.rule) }); continue; }
    if (st.stated && !st.main && st.excluded.length) plan.blockers.push({ why: `Every product the published system names for "${st.label.toLowerCase()}" is ruled out by your conditions.`, rules: st.excluded.map((e) => e.rule), role: st.role });
  }
  // waits: the first option of each step whose own data sheet publishes every window the plan needs (the published order decides when several do)
  const stepOf = (r) => plan.steps.find((x) => x.role === r);
  const mainOf = (st) => (st && st.main ? st.main : null);
  const buildTl = () => {
    const tl = { parts: [], missing: [], coats: null };
    const need = (role, label, got, why) => { if (!got) tl.missing.push({ role, label, why }); return got; };
    const prime = stepOf('prime'), mem = stepOf('membrane'), adh = stepOf('adhesive'), grt = stepOf('grout'), sea = stepOf('sealant');
    for (const st of plan.steps) { st.wait = null; st.waitSteps = []; }
    if (mainOf(prime)) { prime.wait = pickWait(data, prime.main.id, ['cover', 'drying'], ctx); need('prime', 'Primer dry before the next layer (' + prime.main.name + ')', prime.wait, 'no waiting window is published for the primer'); if (prime.wait) tl.parts.push({ k: 'seq', label: 'Primer dry before the next layer', w: prime.wait, who: prime.main.name }); }
    if (mainOf(mem)) {
      const coats = rowsOf(data, mem.main.id, 'coats')[0]; const n = coats ? coats[1].min : null;
      const cw = pickWait(data, mem.main.id, ['coat'], ctx); const cv = pickWait(data, mem.main.id, ['cover'], ctx);
      mem.wait = cv; mem.waitSteps = [cw, cv].filter(Boolean);
      if (n == null) need('membrane', 'Number of membrane coats (' + mem.main.name + ')', null, 'the data sheet does not state a minimum number of coats');
      else { tl.coats = { n, ref: cite(mem.main.id, coats, data.rules[mem.main.id]) }; if (n > 1) { need('membrane', 'Wait between membrane coats (' + mem.main.name + ')', cw, 'no coat-to-coat window is published'); if (cw) tl.parts.push({ k: 'seq', label: 'Membrane wait between coats', w: cw, mult: n - 1, who: mem.main.name }); } }
      need('membrane', 'Membrane dry before tiling (' + mem.main.name + ')', cv, 'no ready-for-tiling window is published for the membrane'); if (cv) tl.parts.push({ k: 'seq', label: 'Membrane dry before tiling', w: cv, who: mem.main.name });
    }
    let aServ = null, gServ = null, gWait = null;
    if (mainOf(adh)) {
      gWait = need('adhesive', 'Adhesive set before grouting (' + adh.main.name + ')', pickWait(data, adh.main.id, ['grout'], ctx), 'no window before grouting is published for the adhesive'); adh.wait = gWait;
      const kinds = lcl === 'submerged' ? ['submerged'] : lcl === 'wet' ? ['wet'] : ['dry', 'service'];
      aServ = pickCold(data, adh.main.id, K, lcl) || pickWait(data, adh.main.id, kinds, ctx);
      need('adhesive', 'Adhesive return to ' + SVC[lcl] + ' service (' + adh.main.name + ')', aServ, 'the adhesive data sheet publishes no ' + SVC[lcl] + ' service window');
    }
    if (grt && !grt.main) need('grout', 'Grout (the published system names none for this combination)', null, 'no grout is named in the published system, so its cure window is not published');
    if (mainOf(grt)) {
      const own = pickWait(data, grt.main.id, ['grout'], ctx); // some grouts (epoxy) state their own wait before grouting; the longer of the two governs
      if (own && gWait && (own.min > gWait.min || own.max > gWait.max)) gWait = { ...gWait, min: Math.max(gWait.min, own.min), max: Math.max(gWait.max, own.max), raw: gWait.raw + ' / ' + own.raw, refs: [...gWait.refs, ...own.refs], distinct: true };
      const gk = lcl === 'submerged' ? ['submerged'] : lcl === 'wet' ? ['wet'] : ['dry', 'service', 'drying'];
      gServ = pickCold(data, grt.main.id, K, lcl) || pickWait(data, grt.main.id, gk, ctx);
      need('grout', 'Grout cure before ' + SVC[lcl] + ' service (' + grt.main.name + ')', gServ, 'the grout data sheet publishes no ' + SVC[lcl] + ' window');
      grt.wait = gServ;
    }
    if (mainOf(sea)) { const si = sealantInfo(data, sea.main.id); sea.wait = si ? { kind: 'skin', min: 0, max: 0, raw: '', refs: [si], info: true } : null; }
    if (aServ || gServ) tl.parts.push({ k: 'final', label: 'Return to ' + SVC[lcl] + ' service', a: aServ, g: gServ, gwait: gWait, who: [mainOf(adh) && adh.main.name, mainOf(grt) && grt.main.name].filter(Boolean).join(' and ') });
    return tl;
  };
  let tl = buildTl();
  for (const role of ['prime', 'membrane', 'adhesive', 'grout']) {
    const st = stepOf(role); if (!st || !st.main || !st.alts.length) continue;
    let best = { n: tl.missing.filter((m) => m.role === role).length, main: st.main, alts: st.alts };
    if (!best.n) continue;
    const opts = [st.main, ...st.alts.map((a) => ({ id: a.id, name: a.name, page: data.rules[a.id] ? data.rules[a.id].m[1] : '', pds: data.rules[a.id] ? data.rules[a.id].m[2] : '', sds: data.rules[a.id] ? data.rules[a.id].m[3] : '', ed: data.rules[a.id] ? data.rules[a.id].m[4] : '' }))];
    for (const o of opts.slice(1)) {
      st.main = o; st.alts = opts.filter((x) => x.id !== o.id).map((x) => ({ id: x.id, name: x.name }));
      const t2 = buildTl(); const n2 = t2.missing.filter((m) => m.role === role).length;
      if (n2 < best.n) { best = { n: n2, main: o, alts: st.alts }; if (!n2) break; }
    }
    st.main = best.main; st.alts = best.alts; tl = buildTl();
  }
  for (const r of ['prime', 'membrane']) { const st = stepOf(r); if (st && !st.main && !st.stated) plan.notes.push({ k: r === 'prime' ? 'noprime' : 'nomem', text: r === 'prime' ? 'The published system names no primer for this combination. The adhesive and membrane data sheets set the priming rules per substrate; the substrate requirements below quote them.' : 'The published system sheet names no waterproofing membrane for this combination. It does not say whether one is needed; ask Technical Services before you start.' }); }
  plan.timeline = scheduleOf(tl, K);
  // the lower-temperature note
  if (K.temp != null) {
    const seen = new Set(); const all = ['prime', 'membrane', 'adhesive', 'grout'].map(stepOf).filter((s) => s && s.main);
    for (const st of all) for (const r of rowsOf(data, st.main.id, 'tempnote')) { if (!seen.has(st.main.id)) { seen.add(st.main.id); plan.notes.push({ k: 'tempnote', cite: cite(st.main.id, r, data.rules[st.main.id]), text: `${st.main.name}: the data sheet says waiting times change with temperature.` }); } }
  }
  conditionsOf(plan, K, data, ctx, zone);
  return plan;
}

/** the timeline arithmetic. parts = [{ k:'seq', w, mult }, { k:'final', a, g, gwait }]. A total exists only when nothing is missing. */
export function scheduleOf(tl, K) {
  const out = { ok: false, min: null, max: null, plus: false, parts: [], missing: tl.missing, coats: tl.coats, basis: null };
  let sMin = 0, sMax = 0, plus = false;
  for (const p of tl.parts) {
    if (p.k === 'seq') { const m = p.mult || 1; sMin += p.w.min * m; sMax += p.w.max * m; plus = plus || !!p.w.plus; out.parts.push({ k: 'seq', label: p.label, who: p.who, min: p.w.min * m, max: p.w.max * m, plus: !!p.w.plus, raw: p.w.raw, mult: m, refs: p.w.refs, distinct: p.w.distinct }); }
    else if (p.k === 'final') {
      const a = p.a, g = p.g, gw = p.gwait;
      const gMin = g && gw ? gw.min + g.min : null, gMax = g && gw ? gw.max + g.max : null;
      const fin = { k: 'final', label: p.label, who: p.who, a, g, gwait: gw, refs: [...(a ? a.refs : []), ...(g ? g.refs : [])] };
      if (a && g && gw) { fin.min = Math.max(a.min, gMin); fin.max = Math.max(a.max, gMax); fin.basis = a.min >= gMin ? 'adhesive' : 'grout'; fin.plus = !!((a.plus && a.max === fin.max) || (g.plus && gMax === fin.max)); }
      else { fin.min = null; fin.max = null; }
      out.parts.push(fin);
      if (fin.min != null) { sMin += fin.min; sMax += fin.max; plus = plus || fin.plus; out.basis = fin.basis; }
    }
  }
  if (!tl.missing.length && out.parts.some((p) => p.k === 'final' && p.min != null)) { out.ok = true; out.min = round(sMin); out.max = round(sMax); out.plus = plus; }
  if (K && K.budget && out.ok) { const b = K.budget.hours; out.budget = { hours: b, verdict: out.min > b ? 'over' : out.max <= b && !out.plus ? 'fits' : 'maybe' }; }
  return out;
}
export const round = (x) => Math.round(x * 1e6) / 1e6;
export const r1 = (x) => Math.round(x * 10) / 10;
/** a duration in hours as words: "30 minutes", "6 hours", "7 days" */
export function fmtH(h) { if (h < 1) return Math.round(h * 60) + ' minutes'; if (h < 48) return r1(h) + ' hours'; return r1(h / 24) + ' days'; }

// ------------------------------------------------------------------ 5. conditions, prerequisites, joints, standards
export function conditionsOf(plan, K, data, ctx, zone) {
  const all = plan.steps.filter((s) => s.main).map((s) => s.main);
  // temperature window: the tightest published low and high across the steps, with the product that sets each
  let lo = null, hi = null; const tcites = [];
  for (const m of all) for (const kind of ['temp_air', 'temp_sub']) for (const r of rowsOf(data, m.id, kind)) {
    const c = cite(m.id, r, data.rules[m.id]);
    if (r[1].min != null && (!lo || r[1].min > lo.v)) lo = { v: r[1].min, c, kind }; if (r[1].max != null && (!hi || r[1].max < hi.v)) hi = { v: r[1].max, c, kind };
    tcites.push(c);
  }
  plan.window = { lo, hi };
  if (lo) plan.voids.push({ id: 'temp-lo', text: `Do not proceed below ${lo.v} °C: ${lo.c.name} sets the tightest published lower limit.`, num: lo.v, rule: lo.c });
  if (hi) plan.voids.push({ id: 'temp-hi', text: `Do not proceed above ${hi.v} °C: ${hi.c.name} sets the tightest published upper limit.`, num: hi.v, rule: hi.c });
  let hum = null; for (const m of all) for (const r of rowsOf(data, m.id, 'humidity')) if (!hum || r[1].max < hum.v) hum = { v: r[1].max, c: cite(m.id, r, data.rules[m.id]) };
  if (hum) plan.voids.push({ id: 'rh', text: `Relative humidity above ${hum.v} % is outside the published limit for ${hum.c.name}.`, num: hum.v, rule: hum.c });
  let dew = null; for (const m of all) for (const r of rowsOf(data, m.id, 'dew')) if (!dew || r[1].margin > dew.v) dew = { v: r[1].margin, c: cite(m.id, r, data.rules[m.id]) };
  if (dew) plan.voids.push({ id: 'dew', text: `The substrate must be at least ${dew.v} °C above the dew point: ${dew.c.name}.`, num: dew.v, rule: dew.c });
  for (const m of all) for (const r of rowsOf(data, m.id, 'moisture')) plan.voids.push({ id: 'moisture', text: `${m.name}: a published moisture limit applies to the substrate.`, rule: cite(m.id, r, data.rules[m.id]) });
  for (const m of all) for (const r of rowsOf(data, m.id, 'maxopen')) { plan.voids.push({ id: 'maxopen-' + m.id, text: `${m.name}: a primed surface has a published limit on how long it may stand before the next layer.`, rule: cite(m.id, r, data.rules[m.id]) }); break; }
  for (const m of all) for (const r of rowsOf(data, m.id, 'no')) if (/freeze|frost/i.test(r[2]) && r[1].tags.cond && r[1].tags.cond.includes('frost')) { plan.voids.push({ id: 'frost-' + m.id, text: `${m.name}: do not let it freeze.`, rule: cite(m.id, r, data.rules[m.id]) }); break; }
  // your conditions against those limits
  if (K.temp != null) {
    if (lo && K.temp < lo.v) plan.checks.push({ id: 'temp-lo', bad: true, text: `${K.temp} °C is below the published lower limit of ${lo.v} °C for ${lo.c.name}.`, rule: lo.c });
    if (hi && K.temp > hi.v) plan.checks.push({ id: 'temp-hi', bad: true, text: `${K.temp} °C is above the published upper limit of ${hi.v} °C for ${hi.c.name}.`, rule: hi.c });
    // any single product's limit that the temperature breaks, when the tightest one is not the cause
    for (const m of all) for (const kind of ['temp_air', 'temp_sub']) for (const r of rowsOf(data, m.id, kind)) { if ((r[1].min != null && K.temp < r[1].min && (!lo || K.temp >= lo.v)) || (r[1].max != null && K.temp > r[1].max && (!hi || K.temp <= hi.v))) plan.checks.push({ id: 'temp-' + m.id, bad: true, text: `${K.temp} °C is outside the published range for ${m.name}.`, rule: cite(m.id, r, data.rules[m.id]) }); }
  }
  if (K.rh != null && hum && K.rh > hum.v) plan.checks.push({ id: 'rh', bad: true, text: `${K.rh} % relative humidity is above the published limit of ${hum.v} % for ${hum.c.name}.`, rule: hum.c });
  // new substrate: the longest published cure age among the products in the system, for the customer's substrate
  const subKey = { concrete: 'concrete', 'screed-render': ['screed', 'render'], masonry: 'masonry', aac: null }[K.sub];
  if (subKey) {
    const keys = [].concat(subKey); let top = null; const ages = [];
    for (const m of all) for (const r of rowsOf(data, m.id, 'age')) if (keys.includes(r[1].sub)) { const c = cite(m.id, r, data.rules[m.id]); ages.push(c); if (r[1].hours != null && (!top || r[1].hours > top.v)) top = { v: r[1].hours, c }; }
    if (ages.length && top) {
      plan.prereqs.push({ id: 'age', text: `New ${keys.includes('concrete') ? 'concrete' : keys.includes('masonry') ? 'brick or blockwork render' : 'screed or render'} must have cured before these products go on. The longest published age in this system is set by ${top.c.name}.`, rule: top.c, ages });
      if (K.age && K.flags.new !== false && K.age.hours < top.v) plan.checks.push({ id: 'age', bad: true, text: `Your substrate is ${K.age.value} ${K.age.unit.replace(/s$/, '')}${K.age.value === 1 ? '' : 's'} old, below the published minimum for ${top.c.name}.`, rule: top.c, said: K.age.hours, need: top.v });
    }
  }
  if (K.age && K.sub === 'timber-floor') { /* an age has no published meaning for a timber floor */ }
  // prerequisites quoted from the substrate preparation clauses: dry, clean, sound, falls, cracks
  const seen = new Set();
  for (const m of all) for (const r of rowsOf(data, m.id, 'prep')) {
    const want = (K.flags.damp && r[1].tags.includes('dry')) || (K.flags.contaminated && r[1].tags.includes('clean')) || (K.flags.cracked && r[1].tags.includes('crack')) || (K.flags.uneven && r[1].tags.includes('flat')) || (/wet/.test(zone.loc) && r[1].tags.includes('falls')) || (!seen.size && r[1].tags.includes('dry') && r[1].tags.includes('clean'));
    if (!want) continue; const key = r[2].slice(0, 50); if (seen.has(key)) continue; seen.add(key);
    plan.prereqs.push({ id: 'prep', text: m.name + ' substrate requirement.', rule: cite(m.id, r, data.rules[m.id]) });
    if (plan.prereqs.length > 8) break;
  }
  if (K.flags.damp) { const r = all.map((m) => rowsOf(data, m.id, 'prep').find((x) => x[1].tags.includes('dry') && /dry/i.test(x[2])) && { m, r: rowsOf(data, m.id, 'prep').find((x) => x[1].tags.includes('dry')) }).find(Boolean); if (r) plan.checks.push({ id: 'damp', bad: true, text: `You describe the substrate as damp. ${r.m.name} requires it dry before it goes on.`, rule: cite(r.m.id, r.r, data.rules[r.m.id]) }); }
  if (K.flags.risingDamp) {
    const hits = []; for (const m of all) for (const r of rowsOf(data, m.id, 'no')) if (r[1].tags.cond && r[1].tags.cond.includes('hydrostatic')) hits.push(cite(m.id, r, data.rules[m.id]));
    if (hits.length) plan.blockers.push({ why: 'Rising damp or negative hydrostatic pressure is named as a no-go in the data sheets of this system.', rules: hits, role: 'membrane' });
  }
  if (K.flags.hotWindy) for (const m of all) { const r = rowsOf(data, m.id, 'no').find((x) => /windy/i.test(x[2])); if (r) { plan.checks.push({ id: 'hotwindy', bad: false, text: `${m.name} names hot windy conditions in its limitations.`, rule: cite(m.id, r, data.rules[m.id]) }); break; } }
  if (K.flags.heated) { const hits = []; for (const m of all) for (const r of rowsOf(data, m.id, 'no')) if (r[1].tags.cond && r[1].tags.cond.includes('heated')) hits.push(cite(m.id, r, data.rules[m.id])); if (hits.length) plan.checks.push({ id: 'heated', bad: true, text: 'A product in the published system is not suitable over heated substrates.', rule: hits[0] }); }
  if (K.size && K.size[0] >= 600 && K.size[1] > 600) { for (const m of all) { const lf = rowsOf(data, m.id, 'lf')[0]; if (lf) { plan.prereqs.push({ id: 'lf', text: `Tiles of this size are large format by the published wording. ${m.name} states the flatness the substrate needs.`, rule: cite(m.id, lf, data.rules[m.id]) }); break; } } }
  // movement joints and bond breaker, as the documents word them
  const jseen = new Set();
  for (const m of all) for (const r of rowsOf(data, m.id, 'joint')) { const key = r[2].slice(0, 60); if (jseen.has(key)) continue; jseen.add(key); plan.joints.push(cite(m.id, r, data.rules[m.id])); }
  plan.joints = plan.joints.filter((j) => /movement|expansion|control|bond|backing|perimeter/i.test(j.q) && !/^(not suitable|do not (?:apply|use) \w+( \w+)* in movement)/i.test(j.q)).slice(0, 6);
  // standards, as the documents name them
  const sseen = new Set();
  for (const m of all) for (const r of rowsOf(data, m.id, 'std')) { const key = r[1].name.replace(/\s+/g, '').toLowerCase(); if (!/^(as|as\/nz|as iso)/i.test(r[1].name)) continue; if (sseen.has(key)) continue; sseen.add(key); plan.standards.push(cite(m.id, r, data.rules[m.id])); }
  plan.standards = plan.standards.slice(0, 8);
  // trade-offs for the conflict outcome
  if (plan.checks.some((c) => c.bad) && plan.status === 'plan') plan.status = 'void';
  if (plan.blockers.length) plan.status = 'blocked';
  // documents to hand to the tiler
  const doc = new Map();
  doc.set('systems/' + plan.system.slug + '/', { label: 'System sheet: ' + plan.system.title, url: 'systems/' + plan.system.slug + '/' });
  for (const s of plan.steps) if (s.main) { if (s.main.pds) doc.set(s.main.pds, { label: 'Data sheet: ' + s.main.name, url: s.main.pds }); if (s.main.sds) doc.set(s.main.sds, { label: 'Safety data sheet: ' + s.main.name, url: s.main.sds }); }
  plan.documents = [...doc.values()];
}

/** Published alternatives when there is no system for the combination: same tile and location on another substrate, or same substrate and tile at another location. */
export function alternativesFor(K, data, loc) {
  const out = [];
  for (const key of Object.keys(data.sys.systems)) {
    const [t, s, l] = key.split('|');
    if (t === K.tile && l === loc && s !== K.sub) out.push({ key, via: 'substrate', slug: data.sys.systems[key][0], title: data.sys.systems[key][1] });
  }
  const same = out.length ? out : Object.keys(data.sys.systems).filter((key) => { const [t, s] = key.split('|'); return t === K.tile && s === K.sub; }).map((key) => ({ key, via: 'location', slug: data.sys.systems[key][0], title: data.sys.systems[key][1] }));
  return same.slice(0, 8);
}

// ------------------------------------------------------------------ 5b. the plan card (kept here, not in cards.js, so the actions chunk does not carry it)
// ---------------------------------------------------------------- lane D: the plan card (added; nothing above is changed)
// A "plan" card is the engineer's answer: an ordered table of steps with the product, the published wait and the page for each, then lines for the
// timeline, the conditions that void the plan, the prerequisites, the joints and the standards. Every line that states a rule is a published sentence
// (a fact); every derived number (a sum of waits, a time budget) is recomputable from card.plan.timeline, which props check independently.
//   card.plan = { v, mode:'plan'|'rule'|'refusal', status:'plan'|'void'|'blocked'|'none', zone, K (constraints read), steps:[{ role, label, product, wait }],
//                 timeline:{ ok, min, max, plus, parts:[{ k, raw, mult, min, max }], missing:[] , budget }, commit:{...} (what "Add the plan to my project" saves) }
export const R1 = (x) => Math.round(x * 10) / 10;
export const fmtHours = (h) => (h < 1 ? Math.round(h * 60) + ' minutes' : h < 48 ? R1(h) + ' hours' : R1(h / 24) + ' days');
export const cleanQ = (t) => String(t || '').replace(/\s+/g, ' ').trim();
export const clampN = (t, n = 270) => (t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
/** a fact from a rule citation { name, ed, url, q, p, c } */
export const citeFact = (c) => fact({ source_url: c.url, page: c.p == null ? null : c.p, sentence: cleanQ(c.q), doc_type: 'PDS', doc_version: (c.ed || '') + (c.c ? ', clause ' + c.c : '') });
export const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
export const ORD = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth'];
export function planCard(plan, { area = null } = {}) {
  const facts = []; const seen = new Map(); const names = new Set();
  const use = (c) => { if (!c || !c.q) return; names.add(c.name); const k = c.url + '|' + c.p + '|' + c.q; if (!seen.has(k)) { seen.set(k, facts.length); facts.push(citeFact(c)); } };
  const pageOf = (c) => (c && c.p != null ? ', page ' + c.p : '');
  const waitText = (w) => (w ? w.raw + (w.plus ? ' or more' : '') + (w.distinct ? ' (the sheets give more than one figure; the longer is used)' : '') : 'Not published');
  const rows = [], lines = []; const blocked = plan.status === 'blocked';
  const z = plan.zone; const K = plan.K; let n = 1;
  const nameList = (st) => st.main ? st.main.name + (st.alts.length ? '. Also named: ' + st.alts.map((a) => a.name).join(', ') : '') : (st.stated ? 'Every named product is ruled out' : 'Not in the published documentation');
  // 1 prepare
  const age = blocked ? null : plan.prereqs.find((p) => p.id === 'age');
  if (age) use(age.rule);
  rows.push([`${ORD[n++]}: Prepare the substrate`, 'See the requirements below', age ? clampN(age.rule.q, 120) : 'No waiting window is published for this step', age ? age.rule.name + pageOf(age.rule) : 'Data sheets of this system']);
  for (const st of blocked ? [] : plan.steps) {
    if (st.role === 'sealant') continue;
    if (st.role === 'adhesive') rows.push([`${ORD[n++]}: Mark out the movement joints and bond breaker`, 'Before the adhesive goes on', plan.joints.length ? 'See the joint statements below' : 'Not published for this system', plan.joints.length ? plan.joints[0].name + pageOf(plan.joints[0]) : 'Not published']);
    const refs = [];
    let wcell = 'Not published', src = 'Not published';
    if (st.role === 'membrane' && st.main) {
      const co = plan.timeline && plan.timeline.coats;
      const cw = st.waitSteps[0] && st.waitSteps.length === 2 ? st.waitSteps[0] : null;
      if (co) { use(co.ref); const nd = new RegExp('(^|[^0-9.])' + co.n + '([^0-9]|$)').test(co.ref.q) ? String(co.n) : WORDS[co.n] || String(co.n); wcell = nd + ' coats'; refs.push(co.ref); }
      if (cw) { wcell += (wcell ? '. ' : '') + 'Between coats: ' + waitText(cw); refs.push(...cw.refs); }
      if (st.wait) { wcell += (wcell ? '. ' : '') + 'Before tiling: ' + waitText(st.wait); refs.push(...st.wait.refs); }
      if (!cw && !st.wait) wcell = 'Not published';
    } else if (st.wait && !st.wait.info) { wcell = (st.role === 'prime' ? 'Dry before the next layer: ' : st.role === 'adhesive' ? 'Before grouting: ' : st.role === 'grout' ? 'Before service: ' : '') + waitText(st.wait); refs.push(...st.wait.refs); }
    if (st.role === 'adhesive' && plan.timeline) { const fin = plan.timeline.parts.find((p) => p.k === 'final'); if (fin && fin.a) { wcell += '. Return to service: ' + waitText(fin.a); refs.push(...fin.a.refs); } }
    if (st.role === 'grout' && plan.timeline) { const fin = plan.timeline.parts.find((p) => p.k === 'final'); if (fin && fin.g) { wcell = 'Cure: ' + waitText(fin.g); refs.length = 0; refs.push(...fin.g.refs); } }
    for (const r of refs) use(r);
    src = refs.length ? [...new Set(refs.map((r) => r.name + pageOf(r)))].slice(0, 2).join('; ') : (st.main ? 'Not published' : '');
    rows.push([`${ORD[n++]}: ${st.label}`, nameList(st), clampN(wcell, 250), clampN(src, 200)]);
    if (st.role === 'grout') {
      const sea = plan.steps.find((x) => x.role === 'sealant');
      if (sea) { const info = sea.wait && sea.wait.refs && sea.wait.refs[0]; if (info) use(info); rows.push([`${ORD[n++]}: Seal the movement joints and perimeters`, nameList(sea), info ? 'Published: ' + clampN(info.q, 110) : 'Not published', info ? info.name + pageOf(info) : 'Not published']); }
    }
  }
  for (const st of plan.steps) for (const ex of st.excluded) { use(ex.rule); lines.push({ label: 'Ruled out for this job: ' + (ex.rule.name), text: clampN(ex.rule.q, 250) }); }
  for (const b of plan.blockers) { for (const r of b.rules) use(r); lines.push({ label: 'Blocked', text: clampN(b.why + ' ' + b.rules.slice(0, 2).map((r) => r.name + pageOf(r)).join('; '), 270) }); }
  for (const c of plan.checks) { use(c.rule); lines.push({ label: 'Your conditions', text: clampN(c.text + ' ' + c.rule.name + pageOf(c.rule), 270) }); }
  for (const nt of plan.notes.filter((x, i, a) => x.k !== 'tempnote' || a.findIndex((y) => y.k === 'tempnote') === i)) { for (const cc of nt.cites || (nt.cite ? [nt.cite] : [])) use(cc); lines.push({ label: nt.k === 'timber' ? 'Timber' : nt.k === 'tempnote' ? 'Temperature and waiting times' : nt.k === 'assume' ? 'Assumption' : 'Note', text: clampN(nt.text + ((nt.cites || (nt.cite ? [nt.cite] : [])).length ? ' ' + (nt.cites || [nt.cite]).slice(0, 2).map((r) => r.name + pageOf(r)).join('; ') : ''), 270) }); }
  // timeline
  const tl = plan.timeline; const showTl = tl && plan.status !== 'blocked';
  if (showTl) {
    for (const p of tl.parts) for (const r of (p.refs || [])) use(r);
    if (tl.ok) {
      lines.push({ label: 'Earliest finish', text: `${tl.plus ? 'At least ' : ''}${fmtHours(tl.min)} after you start, adding the published windows in the table (in hours: ${R1(tl.min)}). The sheets measured these in the laboratory, so a cooler or more humid site is slower.` });
      if (tl.max !== tl.min) lines.push({ label: 'Latest published', text: `${tl.plus ? 'At least ' : ''}${fmtHours(tl.max)} (in hours: ${R1(tl.max)}), using the top of every published range.` });
      if (tl.basis) lines.push({ label: 'Longest path to service', text: tl.basis === 'adhesive' ? 'The adhesive return-to-service window governs the end of the job.' : 'The grout wait plus the grout cure governs the end of the job.' });
      if (tl.budget) lines.push({ label: 'Your time', text: `${fmtHours(tl.budget.hours)} available (in hours: ${R1(tl.budget.hours)}). ${tl.budget.verdict === 'over' ? 'The earliest published finish is longer than that, so it does not fit.' : tl.budget.verdict === 'fits' ? 'Even the longest published windows fit.' : 'The earliest published finish fits, the longest published windows may not.'}` });
    } else {
      lines.push({ label: 'Earliest finish', text: 'Not published, so there is no total. A total is shown only when every waiting window it needs is in the data sheets.' });
      for (const m of tl.missing.slice(0, 5)) lines.push({ label: 'Missing window', text: clampN(m.label + ': ' + m.why + '. Ask Sika Technical Services.', 270) });
    }
  }
  for (const v of blocked ? [] : plan.voids.slice(0, 6)) { use(v.rule); lines.push({ label: 'Plan is void if', text: clampN(v.id === 'moisture' || /^maxopen/.test(v.id) ? v.rule.name + ': ' + v.rule.q : v.text, 250) }); }
  for (const p of blocked ? [] : plan.prereqs) { if (p.id === 'age') { for (const a of (p.ages || []).slice(0, 4)) use(a); lines.push({ label: 'Cure age', text: clampN(p.text + ' ' + (p.ages || []).slice(0, 3).map((a) => a.name + pageOf(a)).join('; '), 270) }); } else { use(p.rule); lines.push({ label: 'Substrate', text: clampN(p.text + ' ' + p.rule.name + pageOf(p.rule), 270) }); } }
  for (const j of blocked ? [] : plan.joints.slice(0, 4)) { use(j); lines.push({ label: 'Joints: ' + j.name, text: clampN(j.q, 250) }); }
  for (const st of blocked ? [] : plan.standards.slice(0, 5)) { use(st); lines.push({ label: 'Standard named', text: clampN(`${st.v.name}, named in the ${st.name} data sheet${pageOf(st)}.`, 250) }); }
  if (plan.alternatives && plan.alternatives.length) lines.push({ label: 'Published alternatives', text: clampN(plan.alternatives.slice(0, 4).map((a) => a.title).join('; '), 270) });
  if (area && !blocked) lines.push({ label: 'Quantities', text: `For ${area} m2 the calculation cards below use each product's published rate. Estimate only, not an offer. Quantities, not prices. Confirm with the product data sheet and Sika Technical Services before ordering.` });
  if (blocked) {
    const way = plan.blockers.some((b) => /directly onto timber/.test(b.why)) ? 'The published timber system is for a floor that has been over-sheeted. Over-sheet it as the sheets describe and ask again.' : plan.alternatives && plan.alternatives.length ? 'The published systems linked below do exist.' : 'Please ask Sika Technical Services how to proceed.';
    lines.splice(0, lines.length, ...lines.filter((l) => /^(Blocked|Ruled out|Timber|Note|Your conditions|Published alternatives)/.test(l.label)), { label: 'Way forward', text: way });
    rows.length = 0;
  }
  const title = `Plan: ${z.tileLabel} on ${z.subLabel}, ${z.locLabel}`;
  const headline = plan.status === 'blocked' ? 'This job is blocked by the published rules below. I will not give a plan that the data sheets rule out.' : plan.status === 'void' ? 'As described, this plan is void: a published limit is broken. The steps are what the documents publish once that is put right.' : 'The published system as an ordered plan. Each step names its product, the published wait and the data sheet page it comes from.';
  const links = plan.documents.map((d) => ({ label: d.label, url: d.url }));
  const commit = { title: plan.system.title, slug: plan.system.slug, env: z.loc, tile: z.tile, substrate: z.sub, steps: Object.fromEntries(plan.steps.filter((s) => s.main).map((s) => [s.role, [s.main.id, ...s.alts.map((a) => a.id)]])), documents: links.filter((l) => /^https?:/.test(l.url)).map((l) => ({ title: l.label, url: l.url })), note: clampN(`Plan: ${z.tileLabel} on ${z.subLabel}, ${z.locLabel}. ` + (tl && tl.ok ? `Earliest finish ${fmtHours(tl.min)}.` : 'Earliest finish not published.'), 400) };
  const c = card({ type: 'plan', status: facts.length ? 'PUBLISHED' : 'UNKNOWN', title, headline, lines: lines.slice(0, 40), facts, table: rows.length ? { cols: ['Step', 'Product', 'Wait before the next step', 'Source'], rows } : null, chip: CHIPS.DATASHEET, links,
    followups: blocked ? (plan.blockers.some((b) => /directly onto timber/.test(b.why)) ? [`Plan for ${z.tileLabel} on an over-sheeted timber floor, ${z.locLabel}`] : ['Ask Technical Services']) : ['Add the plan to my project', ...(area ? [] : ['How much for 20 m2'])].slice(0, 3),
    handoff: facts.length ? null : { question: title, reason: 'No published rule row was found for this combination.', missing: ['plan'] } });
  c.plan = { v: 1, mode: 'plan', status: plan.status, names: [...names], zone: z, K: { ...K, raw: K.raw }, steps: plan.steps.map((s) => ({ role: s.role, label: s.label, product: s.main ? { id: s.main.id, name: s.main.name } : null, alts: s.alts, excluded: s.excluded.map((e) => ({ id: e.id, name: e.rule.name })) })), timeline: tl ? { ok: tl.ok, min: tl.min, max: tl.max, plus: tl.plus, basis: tl.basis, missing: tl.missing.map((m) => m.label), budget: tl.budget || null, coats: tl.coats ? tl.coats.n : null, parts: tl.parts.map((p) => p.k === 'seq' ? { k: 'seq', raw: p.raw, mult: p.mult, min: p.min, max: p.max, plus: p.plus } : { k: 'final', a: p.a ? { raw: p.a.raw, min: p.a.min, max: p.a.max, plus: p.a.plus } : null, g: p.g ? { raw: p.g.raw, min: p.g.min, max: p.g.max, plus: p.g.plus } : null, w: p.gwait ? { raw: p.gwait.raw, min: p.gwait.min, max: p.gwait.max } : null, min: p.min, max: p.max }) } : null, commit };
  return c;
}
/** A cited list card for rule answers and refusals: items = [{ label, text, cite }]; status UNKNOWN (with a hand-off) when no item carries a published sentence. */
export function rulesCard({ title, headline, items = [], links = [], followups = [], question = '', reason = '', plan = null, missing = [] }) {
  const facts = []; const seen = new Set(); const lines = [];
  const names = [];
  for (const it of items) { if (it.cite && it.cite.name) names.push(it.cite.name); if (it.cite && it.cite.q) { const k = it.cite.url + '|' + it.cite.p + '|' + it.cite.q; if (!seen.has(k)) { seen.add(k); facts.push(citeFact(it.cite)); } } lines.push({ label: it.label, text: clampN(it.text, 270) }); }
  const pub = facts.length > 0;
  const c = card({ type: 'plan', status: pub ? 'PUBLISHED' : 'UNKNOWN', title, headline, lines: lines.slice(0, 30), facts, chip: pub ? CHIPS.DATASHEET : CHIPS.UNKNOWN, links, followups, handoff: pub ? null : { question: question || title, reason: reason || NOT_KNOWN, missing } });
  if (!pub) c.headline = headline || NOT_KNOWN;
  c.plan = plan || { v: 1, mode: pub ? 'rule' : 'refusal', status: pub ? 'plan' : 'none', names: [...new Set(names)] };
  return c;
}

