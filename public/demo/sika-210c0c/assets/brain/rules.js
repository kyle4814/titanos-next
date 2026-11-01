// rules.js: the engineer's reasoning layer (lane D). A customer describes a job with several constraints; this module returns a cited STEP PLAN, not a product list.
//   1. parseConstraints(text, prior): substrate, condition, location, tile, traffic, site conditions, area, from one or more messages.
//   2. assemblePlan(K, data): the published system as ordered steps, the waits between them (summed only when every window is published), the conditions
//      that void the plan, prerequisites, joints, standards, and the published rule that blocks the job when the constraints collide with it.
//   3. createRules({ load }).handle(...): loads the rule shards on demand (data/brain/rules/*.json, never precached), builds the cards.
// Rules of the demo: no model, no network beyond the shard loader, every statement carries the sentence, data sheet edition and page it came from,
// "not published" beats a guess, and a total is never shown when one of its windows is missing.
// The shard rows are written by scripts/sika-brain/build_rules.mjs from the specification clauses; nothing numeric is typed here.
// Split into rules_read.js (constraints, rule rows), rules_plan.js (plan assembly, plan card) and this file (refusals, answers); every export is re-exported here.
import * as C from './cards.js';
import { lc, TILE_LABEL, SUB_LABEL, LOC_LABEL, parseConstraints, zonesOf, ruleTopics, dimsOf, classifyAsk, cite } from './rules_read.js';
import { assemblePlan, planCard, rulesCard } from './rules_plan.js';
export * from './rules_read.js';
export * from './rules_plan.js';

/** Minimal follow-up state kept by this module (Lane C owns the shared follow-up state; until it lands, state.plan carries the constraints). */
export const KEEP_OWN_STATE = true;

// ------------------------------------------------------------------ 6. refusals and referrals (the traps)
const COMPLY_RX = /\b(complian\w*|comply|complies|meets? (?:the |all )?(?:building )?(?:codes?|standards?|regulations?)|get certified|certif(?:y|ied|ication)|pass(?:es)? (?:the |an? |a )?(?:council )?(?:inspection|certification)|certifier|building (?:inspector|surveyor|permit|approval)|signed off|sign off|licen[cs]\w*|liab\w*|insur\w*|legal(?:ly)?|\bncc\b|\bbca\b|code of practice|council approval|engineer'?s? (?:certificate|sign))\b/;
const GUARANTEE_RX = /\b(guarantee\w*|definitely work|never (?:fail|leak)|promise|certain|for sure|10 years?|ten years?|lifetime|ensure me|make sure it|won't (?:crack|leak|fail|lift)|never (?:crack|lift|come off))\b|100 ?%/;
const STRUCT_RX = /\b(structural|load[- ]bearing|deflect\w*|span\b|joists?|bearers?|truss|beam|engineers?|engineer's|asbestos|lead paint|mould remediation|mold remediation|sagging|settlement)\b/;
const OFFTOPIC_RX = /\b(sauna|steam room|hammam|kiln|furnace|fireplace|hearth|freezer|cool ?room|cold ?room|commercial kitchen|abattoir|chemical plant|laboratory|nuclear|aquarium|fish tank|helipad|runway)\b/;
const PRICE_RX = /\b(price|prices|cost|costs|charge|charges|how much (?:is|does|will)|quote|cheapest|discount|stockist|in stock|warranty|labour|labor)\b/;
const TRAP_REASON = {
  comply: 'Whether a job meets a building code or passes an inspection is decided by the certifier and the licensed installer, not by a data sheet. I can show the standards the data sheets name and the rules they set. Please confirm compliance with Sika Technical Services and your certifier.',
  guarantee: 'I cannot promise that a job will work or give a guarantee. I can show what the published data sheets require and where a requirement is not published. Warranty terms are decided by Sika Australia.',
  struct: 'Structural questions, hazardous materials and the condition of the building are outside the published product documentation. Please ask a structural engineer or Sika Technical Services.',
  offtopic: 'The published tile system data does not cover this kind of space or exposure, so I will not guess a plan. Please ask Sika Technical Services.',
  unsupported: 'The published tile system data covers concrete, cement screed or render, brick or blockwork, fibre cement sheet, plasterboard, over-sheeted timber, existing tiles and AAC. This surface is not one of them, so I will not guess a plan. Please ask Sika Technical Services.',
};
function trap(q, K) {
  const s = lc(q);
  if (COMPLY_RX.test(s) && !/\bwhich standards?\b|\bwhat standards?\b|\bstandards? (?:does|do|is|are)\b|\bname[sd]? (?:in|by)\b/.test(s)) return 'comply';
  if (GUARANTEE_RX.test(s) && /\b(will|can you|guarantee|promise|sure|certain)\b/.test(s)) return 'guarantee';
  if (STRUCT_RX.test(s)) return 'struct';
  if (OFFTOPIC_RX.test(s) || K.flags.steam || K.where.commercialKitchen) return 'offtopic';
  if (K.unsupported && K.unsupported.length) return 'unsupported';
  return null;
}
const TOPIC_LABEL = { open: 'How long it may stand before the next layer', age: 'Cure age', temp: 'Temperature limits', humidity: 'Humidity and dew point', moisture: 'Substrate moisture', thickness: 'Thickness and coats', standard: 'Standards named', joint: 'Joints and bond breaker', primer: 'Primer by substrate', wait: 'Waiting windows', mix: 'Mixing', lf: 'Large format tiles' };
const KINDS_OF = { open: ['maxopen'], age: ['age'], temp: ['temp_air', 'temp_sub'], humidity: ['humidity', 'dew'], moisture: ['moisture'], thickness: ['layer', 'coats'], standard: ['std'], joint: ['joint'], primer: ['primer'], wait: ['wait'], mix: ['mix'], lf: ['lf'] };
const SUBWORD = { concrete: /concrete/i, 'screed-render': /screed|render/i, masonry: /brick|block|render/i, 'cement-board': /cement|fibre|sheet|board/i, plasterboard: /plaster/i, 'timber-floor': /timber|ply|particle/i, 'existing-tiles': /tile/i, aac: /aac|autoclaved/i };

/** rule rows of the products asked about (or of the system's products), for the topics asked about */
function ruleItems(topics, entries, K) {
  const items = [];
  for (const { id, e } of entries) {
    if (!e) continue; const meta = { m: e.m };
    for (const t of topics) {
      let rows = e.r.filter((r) => KINDS_OF[t].includes(r[0]));
      if (t === 'age' && K.sub && SUBWORD[K.sub]) { const keep = rows.filter((r) => (K.sub === 'concrete' ? r[1].sub === 'concrete' : K.sub === 'screed-render' ? ['screed', 'render'].includes(r[1].sub) : K.sub === 'masonry' ? ['masonry', 'render'].includes(r[1].sub) : true)); rows = keep; }
      if (t === 'primer' && K.sub && SUBWORD[K.sub]) { const keep = rows.filter((r) => SUBWORD[K.sub].test(r[1].sub)); if (keep.length) rows = keep; }
      if (t === 'standard') rows = rows.filter((r) => /^(as|as\/nz|as iso)/i.test(r[1].name));
      if (t === 'wait') { const kinds = []; const sq = lc(K.raw[K.raw.length - 1] || ''); if (/grout/.test(sq)) kinds.push('grout'); if (/tiling|tile\b/.test(sq) && /ready|before|wait/.test(sq)) kinds.push('cover'); if (/coat/.test(sq)) kinds.push('coat'); if (/wet area|wet/.test(sq)) kinds.push('wet'); if (/dry area/.test(sq)) kinds.push('dry'); if (/submerged|pool|fill/.test(sq)) kinds.push('submerged'); if (/flood/.test(sq)) kinds.push('flood'); if (/walk|foot|traffic/.test(sq)) kinds.push('light'); if (kinds.length) { const keep = rows.filter((r) => r[1].kinds.some((k) => kinds.includes(k))); if (keep.length) rows = keep; } rows = rows.filter((r) => !r[1].kinds.includes('cold')); }
      if (t === 'temp' && !rows.length) continue;
      const seen = new Set();
      for (const r of rows) { const key = t === 'standard' ? r[1].name : r[2].slice(0, 70); if (seen.has(key)) continue; seen.add(key); if (seen.size > (t === 'standard' ? 6 : 3)) break; items.push({ label: `${e.m[0]}: ${TOPIC_LABEL[t]}`, text: r[2], cite: cite(id, r, meta) }); }
    }
  }
  return items;
}

// ------------------------------------------------------------------ 7. the answer
export function createRules({ load }) {
  let sysP = null, tileP = null;
  const dataP = async () => {
    sysP = sysP || load.ruleShard('sys'); tileP = tileP || load.ruleShard('tile');
    const [sys, tile] = await Promise.all([sysP, tileP]); if (!sys || !tile) return null;
    return { sys, rules: tile.products };
  };
  const otherP = {};
  const entryOf = async (data, id) => {
    if (data.rules[id]) return data.rules[id];
    const idx = await load.ruleShard('idx'); if (!idx || idx.idx[id] == null) return null;
    const n = idx.idx[id]; otherP[n] = otherP[n] || load.ruleShard('o' + n); const sh = await otherP[n]; return sh && sh.products[id] ? sh.products[id] : null;
  };
  const ask = (K, q) => {
    const have = []; if (!K.tile) have.push(['tile', ['porcelain', 'ceramic', 'natural stone', 'glass or mosaic'], 'Which tile is it?']);
    if (!K.sub) have.push(['substrate', ['concrete', 'cement sheet', 'plasterboard', 'timber floor'], 'What are you tiling onto?']);
    if (!zonesOf(K).length) have.push(['location', ['an internal floor', 'a bathroom floor', 'an external floor', 'an internal wall'], 'Where is it, and is it a floor or a wall?']);
    const first = have[0];
    return { intent: 'plan', cards: [C.chooseCard(first[2], 'To give a cited plan I need ' + have.map((h) => h[0]).join(', ') + '. Pick one to continue, or type it.', first[1].map((o) => `${q.replace(/[?.!]+$/, '')} (${first[0]}: ${o})`), [], first[1])], state: { plan: K } };
  };
  async function plansFor(K, data) {
    const out = [];
    for (const loc of zonesOf(K)) out.push(assemblePlan(K, data, loc));
    return out;
  }
  /** Returns { intent, cards, state } or null when this message is not for this module. */
  async function handle(q, { state = null, productIds = [], hasProduct = false, text = null } = {}) {
    const t = text == null ? q : text;
    let prior = KEEP_OWN_STATE && state && state.plan ? state.plan : null;
    if (prior && dimsOf(parseConstraints(t)) >= 3) prior = null; // a whole new job starts fresh // text = the question with the product names cut out (a product name is not a constraint)
    const K = parseConstraints(t, prior);
    let kind = classifyAsk(t, K, { hasProduct, prior, own: prior ? parseConstraints(t) : null });
    const why = trap(t, K);
    if (!kind && why && dimsOf(K) >= 2) kind = 'plan';
    if (!kind && dimsOf(K) >= 2 && PRICE_RX.test(lc(t))) return { intent: 'price', cards: [C.unknown(q, null, 'Prices, labour rates, stock and warranty terms are not in the documentation I work from, and I will not guess them. Please ask Sika Australia or a stockist.', ['price, stock or warranty'])], state: { plan: K } };
    if (!kind) return null;
    if (why) return { intent: 'plan', cards: [C.unknown(q, null, TRAP_REASON[why], [why === 'comply' ? 'a compliance ruling' : why === 'guarantee' ? 'a guarantee' : why === 'struct' ? 'structural advice' : 'this surface or space'], { followups: ['What does the data sheet say about the substrate', 'Ask Technical Services'] })], state: { plan: K } };
    const data = await dataP(); if (!data) return null;
    // a rule question about named products
    if (kind === 'rule') {
      let topics = ruleTopics(t); if (topics.includes('standard') && /\bstandards?\b|\bas ?\d|\bcited?\b|\bnamed?\b/.test(lc(t))) topics = ['standard'];
      if (hasProduct && productIds.length) {
        const entries = []; for (const id of productIds.slice(0, 3)) entries.push({ id, e: await entryOf(data, id) });
        const items = ruleItems(topics.filter((t) => KINDS_OF[t]), entries, K);
        if (!items.length) return { intent: 'rule', cards: [C.unknown(q, null, 'The published specification of ' + entries.map((x) => (x.e ? x.e.m[0] : x.id)).join(' and ') + ' does not state this rule. I will not guess. Please ask Sika Technical Services.', ['published rule'])], state: { plan: K } };
        const docs = entries.filter((x) => x.e).map((x) => ({ label: 'Data sheet: ' + x.e.m[0], url: x.e.m[2] })).filter((d) => d.url);
        return { intent: 'rule', cards: [rulesCard({ title: 'What the data sheet says', headline: 'The published rule, quoted as the data sheet words it, with its data sheet edition and page.', items, links: docs, question: q })], state: { plan: K } };
      }
      if (!K.tile || !K.sub || !zonesOf(K).length) return ask(K, q);
      const plans = await plansFor(K, data); const pl = plans.find((p) => p.status !== 'none');
      if (!pl) return null;
      const entries = pl.steps.filter((x) => x.main).map((x) => ({ id: x.main.id, e: data.rules[x.main.id] }));
      const items = ruleItems(topics.filter((t) => KINDS_OF[t]), entries, K);
      if (!items.length) return { intent: 'rule', cards: [C.unknown(q, null, 'The published specification of the products in this system does not state this rule. I will not guess. Please ask Sika Technical Services.', ['published rule'])], state: { plan: K } };
      return { intent: 'rule', cards: [rulesCard({ title: `What the data sheets of this system say: ${pl.zone.tileLabel} on ${pl.zone.subLabel}, ${pl.zone.locLabel}`, headline: 'The published rule for each product the system names, quoted as the data sheet words it. Where two products differ, both are shown.', items, links: pl.documents, question: q })], state: { plan: K } };
    }
    // a plan
    if (!K.tile || !K.sub || !zonesOf(K).length) return ask(K, q);
    if (K.tile === 'moisture-sensitive-stone') {
      const items = []; for (const [id, e] of Object.entries(data.rules)) for (const r of e.r) if (r[0] === 'no' && r[1].tags.tile && r[1].tags.tile.includes('msstone') && items.length < 4 && !items.some((x) => x.cite.pid === id)) items.push({ label: e.m[0], text: r[2], cite: cite(id, r, e) });
      const c = rulesCard({ title: 'Moisture sensitive stone', headline: 'The published tile systems do not include moisture sensitive stone, and the data sheets below rule their adhesives out for it. Please ask Sika Technical Services for this job.', items, followups: ['Ask Technical Services'], question: q });
      c.plan = { ...c.plan, mode: 'refusal', status: 'blocked' };
      return { intent: 'plan', cards: [c], state: { plan: K } };
    }
    const plans = await plansFor(K, data); const cards = [];
    for (const pl of plans) {
      if (K.flags.vehicular) { const hits = []; for (const [id, e] of Object.entries(data.rules)) for (const r of e.r) if (r[0] === 'no' && r[1].tags.cond && r[1].tags.cond.includes('traffic')) hits.push(cite(id, r, e)); if (hits.length) { pl.blockers.push({ why: 'Vehicular and heavy duty traffic are named as outside the published system data.', rules: hits.slice(0, 3), role: 'adhesive' }); pl.status = 'blocked'; } }
      if (pl.status === 'none') {
        const alt = pl.alternatives;
        cards.push(C.unknown(q, null, `The published documentation has no system for ${TILE_LABEL[K.tile]} on ${SUB_LABEL[K.sub]}, ${LOC_LABEL[pl.zone.loc]}. ` + (alt.length ? 'Published systems that do exist are linked below. ' : '') + 'Please ask Sika Technical Services.', ['system for this combination'], { followups: alt.slice(0, 3).map((a) => 'What is the full system for ' + a.title) }));
        if (alt.length) cards[cards.length - 1].links = alt.slice(0, 6).map((a) => ({ label: 'Published system: ' + a.title, url: 'systems/' + a.slug + '/' }));
        continue;
      }
      cards.push(planCard(pl, { area: K.area }));
      if (K.area && pl.status !== 'blocked') {
        for (const st of pl.steps) {
          if (!st.main || cards.length >= 8) continue;
          const sh = await load.product(st.main.id); if (!sh) continue;
          const cc = C.calcCard(sh, K.area, q); if (cc.type === 'calculation') cards.push(cc);
        }
      }
    }
    if (!cards.length) return null;
    const first = plans.find((p) => p.status !== 'none');
    return { intent: 'plan', cards, state: { plan: K, lastPlan: first ? { slug: first.system.slug } : null } };
  }
  return { handle, data: dataP };
}

export { commitPlan } from './plansave.js';
// Lane D is loaded as a plain module on demand (brain.js never imports it). In the browser this line lets the injected module script hand its exports back.
