// session.js: the conversation layer. Wraps the brain's single-question ask() with a small session state, so a follow-up is read against what was
// just answered: last products, last intent, last numbers and the job so far. No model, no network; the state is plain JSON the page passes back.
//   state.h = { job, product, products[], kind, q, area, topic, hist[] }   (state.productId / intent / advice from the inner brain pass through untouched)
// Follow-ups handled: recommend one (after any card), the first / second / third one, the same for 20 m2, in a pail, and the SDS, what about outdoors, go back.
import { normalise } from './text.js';
import { jobOf, areaOf, leafOf, recommendFor } from './recommend.js';
import * as V from './voice.js';
import { card, CHIPS, fact, finalize } from './schema.js';
import { PLACES, twoJobs, twoJobsCard, socialKind, socialCard, placeOf, placeCard, genericCard, followUp, defaultPick, joinPlace, isModifier, withPick, PICK_RX, wantsPick, looseSocial, sellAsk, compareSides, isPronounSide } from './chat.js';

const REC = /\brec+o?m+e?n+d|\b(suggest|pick one|pick for me|you pick|you choose|you decide|your pick|your choice|up to you|just tell me|you tell me|best one|whatever is best|whatever s best|whatever you think|surprise me|any one|no preference|dont mind|don t mind|doesn t matter|which (one )?(should|would) (i|you)|what would you (use|pick|choose|go with)|which is best|which one is best|which one s best|you choose for me)\b/;
const ORD = /^(?:(?:and|ok|okay|now|so|what about|how about|tell me about|show me|go with|i ll take|ill take|i take) )*(?:the )?(first|1st|top|second|2nd|third|3rd|last|fourth|4th)(?: one| option| product| choice)?(?: please)?$/;
const AREA_FU = /^(?:(?:same|and|ok|okay|now|so|what about|how about|what if|if|for|at|ditto) )+(?:it is |its |it s |is |i have |i ve got |i got )?\d+(?:\.\d+)? ?(?:m2|m 2)(?: please)?$|^(?:same|ditto)(?: again)? for \d+(?:\.\d+)? ?(?:m2|m 2)$/;
const PACK = /^(?:(?:and|what about|how about|is it|does it come|do you (?:have|sell)|can i get (?:it)?|comes?) )*(?:in )?(?:a |an |the )?(pails?|buckets?|bags?|tubes?|cartridges?|sausages?|drums?|tubs?|cartons?|boxes|packs?|unipacks?|jerry cans?|small(?:er)? (?:pack|size|bag)|bigger (?:pack|size)|big(?:ger)? (?:one|bag|pack))(?: size| sizes)?(?: version| option)?$/;
const BACK = /^(?:go back|back|previous|the previous (?:one|answer)|the one before|before that|undo|back to (?:that|the last one)|what was the last one)$/;
const ENV = /^(?:(?:and|what about|how about|what if|if it s|if its|if it is|is it ok|does it work|how about for|and for|for) )+(?:the |a )?(outdoors?|outside|exterior|external|indoors?|inside|interior|internal|wet areas?|bathroom|shower|kitchen|laundry|balcony|pool|garage|cold|winter|hot weather|summer|damp|humid)(?: too| as well)?$/;
const ASPECT = /^(?:(?:and|what about|how about|also|ok|okay|now|then|the) )+(sds|msds|pds|tds|data ?sheet|safety data sheet|safety sheet|coverage|consumption|pot life|open time|cure time|curing time|drying time|recoat time|shelf life|colours?|colors?|packaging|pack size|price|cost|vocs?|mixing ratio|warranty|storage)(?: for it| of it| for that| for that one)?$/;
const BARE_AREA = /^(?:(?:it s|its|it is|about|around|roughly|approx\w*|maybe|say|um|umm|ok|okay|so|the area is|area is|its about|it s about) )*\d+(?:\.\d+)? ?(?:m2|m 2|square met\w*|sq m)(?: at \d+(?:\.\d+)? ?mm)?(?: (?:please|thanks|mate|roughly|or so|total))?$/;
const BARE_NUM = /^(?:(?:it s|its|it is|i need|i d say|about|around|roughly|approx\w*|maybe|say|um|umm|ok|okay|so|the area is|area is|its about|it s about) )*(\d+(?:\.\d+)?)(?: ?(?:m|metres?|mm))?(?: ?(?:x|by) ?(\d+(?:\.\d+)?)(?: ?(?:m|metres?|mm))?)?(?: (?:please|thanks|mate|roughly|or so|total|square|tiles?))?$/;
const JOINT_RE = /^(?:(?:it s|its|about|around|roughly|say|i need|i have|i ve got|ok|so) )*(\d+(?:\.\d+)?) ?(?:m|metres?|meters?|lineal metres?|lm)(?: (?:of joints?|long|of joint length|lineal|linear))?(?: (?:at|of|with|for)? ?(?:a )?(\d+(?:\.\d+)?) ?(?:x|by) ?(\d+(?:\.\d+)?) ?mm(?: joints?)?)?$/;
const PACKS_RE = /^(?:(?:about|around|roughly|say|i have|i ve got|ok|so|just) )*(\d+)(?: ?x ?\d+(?:\.\d+)? ?(?:kg|l|ml|litres?))? ?(bags?|pails?|buckets?|tubs?|cartridges?|sausages?|packs?|boxes?|tubes?|drums?|foil packs?)$/;
const SAME_FOR = /^(?:(?:and|ok|okay|now|so) )?(?:same|ditto|the same|same again|same thing|what about|how about|and for|and)(?: again)? (?:for |with )?(.+)$/;
const ENVWORD = /^(?:the |a )?(outdoors?|outside|exterior|external|indoors?|inside|interior|internal)$/;
const CHIP_JOBS = ['Recommend a tile adhesive', 'Recommend a waterproofing membrane', 'Recommend a floor leveller', 'Recommend a sealant'];
const KINDS_WITH_PRODUCT = new Set(['calc', 'rate', 'time', 'document', 'safety', 'spec']);
const SAFE_OPT = (s) => String(s).replace(/\s+/g, ' ').trim();

const FILL = new Set('me one for you please can could just a an the to that anything something which pick choose tell whatever is s best i would should use go with any up it your my us them of either way thanks thank you re hey hi ok okay so then now well and or but if its it one any'.split(' '));
/** True when nothing but the recommend request itself is in the message (no job words: "can you recommend a good tiler" is a real question, not a chip). */
const bare = (n) => n.replace(REC, ' ').split(' ').filter((w) => w && !FILL.has(w)).length === 0;
export function createSession({ ask, cover, coverQuote, advisor, boot, productName, productCategory, productList }) {
  const ids = (res) => [...new Set(res.cards.map((c) => (c.product || c.about) && (c.product || c.about).id).filter(Boolean))];
  const JOBS = [[/level/, 'floor leveller'], [/tile-adhesive/, 'tile adhesive'], [/tile-grout|grouts?$/, 'tile grout'], [/waterproof|membrane/, 'waterproofing membrane'], [/sanitary-sealant/, 'bathroom sealant'], [/sealant/, 'sealant'], [/primer/, 'primer'], [/repair-mortar/, 'repair mortar'], [/admixture|water-?reducer|retarder|accelerator/, 'concrete admixture'], [/anchor/, 'chemical anchor'], [/epoxy/, 'epoxy'], [/adhesive/, 'construction adhesive']];
  const jobFromProduct = (id) => { const cat = String(productCategory(id) || ''); for (const [rx, job] of JOBS) if (rx.test(cat) && advisor.hasKind(job)) return job; const parts = cat.split('/').filter(Boolean).reverse(); for (const p of parts) { const t = leafOf(p); if (advisor.hasKind(t)) return t; } return ''; };
  /** The message names a kind of product (tile adhesive, floor leveller, membrane) that is not the kind of the product held: a new topic, so the held product must not be reused for it. */
  const typeClash = (n, h) => { const k = advisor.kindOf(n); if (!k) return false; const held = h.product && jobFromProduct(h.product); const hk = held && advisor.kindOf(held); return k !== hk; };
  const qtyShaped = (n) => areaOf(n) != null || /\bhow (?:much|many)\b|\blitres?\b|\bquantity\b/.test(n);
  const newH = () => ({ jobState: null, job: '', product: '', products: [], kind: '', q: '', area: null, topic: '', hist: [] });
  const merge = (st, h) => ({ ...(st || {}), h });

  function update(h0, q, n, res) {
    const h = { ...h0, hist: (h0.hist || []).slice(-3) };
    const pids = res.state && Array.isArray(res.state.productIds) ? res.state.productIds : ids(res);
    if (pids.length) { h.products = pids; h.product = pids.length === 1 || res.intent === 'compare' || (res.state && res.state.productId) ? ((res.state && res.state.productId) || pids[0]) : ''; }
    else if (res.state && res.state.productId) h.product = res.state.productId;
    const a = areaOf(n); if (a != null) h.area = a;
    const jb = jobOf(n); const standalone = !pids.length || res.stage === 'advisor' || ['which', 'tree', 'advice'].includes(res.intent);
    if (res.intent === 'system' && !pids.length) h.job = 'tile adhesive for ' + jb.replace(/\b(tiling |tile )?system\b/, ' ').replace(/\s+/g, ' ').trim();
    else if (jb && advisor.hasKind(jb) && standalone) { h.job = jb; h.jobImplied = false; }
    else if (!h.job && h.product) { h.job = jobFromProduct(h.product); h.jobImplied = true; } // a job read off a product shown, not said by the visitor
    if (KINDS_WITH_PRODUCT.has(res.intent) || res.intent === 'compare' || res.intent === 'system') h.kind = res.intent;
    else if (['which', 'product', 'attr', 'tree', 'advice'].includes(res.intent)) h.kind = '';
    if (res.stage === 'kb' && res.cards[0]) h.topic = res.cards[0].title || '';
    h.q = q; h.hist.push(q); h.fresh = false;
    { const c0 = res.cards[0]; h.jointAsk = !!(c0 && c0.type === 'choose' && /metres of joint/.test(c0.headline || '')); const jmt = h.jointAsk && /For (\d+(?:\.\d+)?) m of joint, which size/.exec(c0.headline || ''); h.jointMetres = jmt ? Number(jmt[1]) : null; }
    return h;
  }

  /** The recommendation answer: the pick first, its reason and source, then the original intent carried on for the picked product. */
  async function recommend(h, q) {
    const job = h.job || (h.product ? jobFromProduct(h.product) : '');
    // the job record the inner brain gave (kind, area, thickness) is the single source: when the session has no job words of its own, the inner brain's recommendForJob answers from it
    if (!job && h.jobState && h.jobState.kindId) { const b = await ask(q, { job: h.jobState }); if (b && b.trace.includes('recommend:job')) return b; }
    if (!job) {
      const a = V.askJob();
      const c = card({ type: 'choose', title: a.title, headline: a.headline, facts: [], status: 'PUBLISHED', chip: CHIPS.PUBLISHED, followups: CHIP_JOBS });
      return { schema: 'sika-brain-answer@1', query: q, intent: 'recommend', stage: 'session', cards: [c], followups: CHIP_JOBS, state: null, ms: 0, trace: ['session:recommend:ask-job'] };
    }
    const rec = await recommendFor(ask, job);
    if (!rec) return null;
    if (rec.open) { // the advisor will not order a range without a condition: say so, keep the range, and offer the one question that unlocks the pick
      const cs = rec.cards.slice(); cs[0].lines = [{ label: 'Before I pick', text: V.needCondition() }].concat(cs[0].lines || []); if (cs[0].type === 'choose') cs[0].headline = V.needCondition() + ' ' + (cs[0].headline || '');
      return { schema: 'sika-brain-answer@1', query: q, intent: 'which', stage: 'session', cards: cs, followups: rec.answer.followups, state: { advice: { n: rec.answer.state && rec.answer.state.advice ? rec.answer.state.advice.n : job, ids: [] } }, ms: 0, trace: ['session:recommend:open:' + job] };
    }
    const cards = rec.cards.slice(); const top = rec.cards.find((c) => c.type === 'product' && c.product);
    if (top) top.lines = [{ label: 'My pick', text: V.pick(rec.names[0], job, rec.names.slice(1)) }].concat(top.lines || []);
    let kindDone = '';
    if (h.kind && rec.names[0]) {
      const nm = rec.names[0];
      const ask2 = { calc: h.area != null ? `how much ${nm} for ${h.area} m2` : '', rate: `coverage of ${nm}`, time: `how long does ${nm} take to cure`, document: `data sheet for ${nm}`, safety: `safety information for ${nm}`, spec: `specification clauses for ${nm}` }[h.kind];
      if (ask2) { const r2 = await ask(ask2, null); const c2 = r2.cards.filter((c) => c.type !== 'choose'); if (c2.length && c2[0].type !== 'unknown') { cards.push(...c2.slice(0, 1)); kindDone = h.kind; } }
    }
    if (kindDone && cards[0]) cards[0].lines = (cards[0].lines || []).concat([{ label: 'Then', text: V.bridge(kindDone) }]);
    // the ranked, cited recommendation card of the inner brain leads when a job record is held (same advisor, same picks); the pick's product card follows
    if (h.jobState && h.jobState.kindId && !kindDone) { const b = await ask(q, { job: h.jobState }); const bc = b && b.trace.includes('recommend:job') && b.cards[0]; if (bc && (bc.type === 'advice' || bc.type === 'calculation')) cards.unshift(bc); }
    const nm0 = rec.names[0];
    const followups = [`Data sheet for ${nm0}`, `Coverage of ${nm0}`, ...(rec.names[1] ? [`Tell me about ${rec.names[1]}`] : []), `Safety data sheet for ${nm0}`].slice(0, 4);
    return { schema: 'sika-brain-answer@1', query: q, intent: kindDone || 'which', stage: 'session', cards, followups, state: { productId: rec.ids[0], intent: kindDone || 'which' }, ms: 0, trace: ['session:recommend:' + job] };
  }

  function noPick(q) {
    const c = card({ type: 'unknown', status: 'UNKNOWN', title: 'Not in the published documentation', headline: 'I do not know this from the published documentation.', facts: [], source: null, chip: CHIPS.UNKNOWN, links: [V.TECH_ROUTE], handoff: { question: q, product: '', reason: V.notPublished('A documented best fit for that job', 'the product pages and data sheets for the range'), missing: ['job'] }, followups: CHIP_JOBS });
    return { schema: 'sika-brain-answer@1', query: q, intent: 'recommend', stage: 'session', cards: [c], followups: CHIP_JOBS, state: null, ms: 0, trace: ['session:recommend:none'] };
  }
  /** Every clarifier offers a recommendation, and a "not published" never stands alone. */
  async function dress(res, h) {
    const cs = res.cards || [];
    const needProduct = !!cs[0] && ((cs[0].type === 'choose' && res.stage === 'index' && /which product do you mean/i.test(cs[0].title)) || (cs[0].type === 'unknown' && cs[0].handoff && (cs[0].handoff.missing || []).includes('product name')));
    const job = h.job || '';
    const canRec = !!(job || h.product);
    if (cs[0] && cs[0].type === 'choose' && !res.trace.includes('session:recommend:ask-job')) {
      if (needProduct && (canRec || advisor.hasKind(jobOf(res.query))) && !cs[0].followups.includes(V.RECOMMEND_CHIP)) {
        const hh = { ...h, job: job || jobOf(res.query) };
        let top = []; if (hh.job) { const rec = await recommendFor(ask, hh.job); if (rec && rec.names) top = rec.names.slice(0, 3); }
        const verb = { calc: (p) => `How much ${p} for ${hh.area || 20} m2`, time: (p) => `How long does ${p} take to cure`, rate: (p) => `Coverage of ${p}`, document: (p) => `Data sheet for ${p}`, safety: (p) => `Safety information for ${p}`, spec: (p) => `Specification clauses for ${p}` }[res.intent];
        const picks = verb ? top.map(verb) : [];
        const rest = cs[0].followups.filter((x) => !picks.includes(x));
        cs[0].followups = [V.RECOMMEND_CHIP, ...picks, ...rest].slice(0, 6);
        if (cs[0].choices) cs[0].choices = cs[0].followups.map((v) => ({ label: v, value: v }));
        res.followups = cs[0].followups.slice(); res.state = merge(res.state, { ...hh });
      } else if (!needProduct && canRec && !(res.followups || []).includes(V.RECOMMEND_CHIP)) res.followups = [...(res.followups || []), V.RECOMMEND_CHIP].slice(0, 5);
    }
    for (const c of cs) if (c.type === 'unknown') {
      if (!(c.links || []).some((l) => l.url === V.TECH_ROUTE.url) && !c.product && !c.about) c.links = (c.links || []).concat([V.TECH_ROUTE]);
      if (canRec && !(res.followups || []).includes(V.RECOMMEND_CHIP) && !/outside what I can help|do not recommend tradespeople/.test(c.handoff && c.handoff.reason || '')) res.followups = [V.RECOMMEND_CHIP, ...(res.followups || [])].slice(0, 5);
    }
    return res;
  }

  /** One side of a comparison to ONE product: a pronoun is the last product of the session; a name is asked of the brain and kept only when every word of it is in the product's own name. */
  const sideTokens = (t) => normalise(t).split(' ').filter((w) => w && !/^(the|a|an|sika|and|of)$/.test(w));
  // variants of ONE line share their first three name words ("Sikadur-Combiflex SG System" and "SG-10 P"): naming the line is naming it. "Sikaflex-212 FC" and "Sikaflex-11 FC+" do not, and that is the which-one case.
  const sameLine = (ps) => new Set(ps.map((p) => normalise(p.name).split(' ').slice(0, 3).join(' '))).size === 1;
  // the words ARE one product's whole name with its model number left out, and every other product that fits only continues that name with more words at the end and has no model number of its own ("SikaBond Instant Nails" vs "SikaBond INSTANT NAILS FAST"): the visitor named the base product. A product whose name has words inside the phrase ("SikaTile-510 Mega Lite" for "sikatile lite") or a second product with the same bare name ("Sikaflex-212 FC", "Sikaflex-11 FC+") keeps it a which-one.
  const nameWords = (nm) => normalise(nm).split(' ').filter((w) => w && !/^(the|a|an|sika|and|of)$/.test(w) && !/^\d+$/.test(w));
  const baseOf = (ok, want) => { if (ok.length < 2) return null; const wn = want.filter((w) => !/^\d+$/.test(w)); const eq = (a, b) => a.length === b.length && a.every((w, i) => w === b[i] || w === b[i].replace(/s$/, '') || w.replace(/s$/, '') === b[i]); const ex = ok.filter((p) => eq(nameWords(p.name), wn)); if (ex.length !== 1) return null; return ok.every((p) => p === ex[0] || (!/\d/.test(p.name) && nameWords(p.name).length > wn.length && eq(nameWords(p.name).slice(0, wn.length), wn))) ? ex[0] : null; };
  async function resolveSide(text, h, other) {
    const t = String(text || '').trim(); if (!t) return null;
    if (isPronounSide(t)) { const id = h.product || (h.products && h.products[0]); return id && productName(id) ? { id, name: productName(id) } : null; }
    const tries = [t]; const tk = sideTokens(t);
    if (tk.length <= 2 && other && !isPronounSide(other)) { const lead = sideTokens(other)[0]; if (lead && !tk.includes(lead)) tries.push(lead + ' ' + t); } // a bare number on one side takes the other side's product family
    let amb = null;
    for (const tt of tries) {
      const want = sideTokens(tt);
      // the catalogue's own names first: the words of the side are exactly a product's name, or all in ONE product's name
      if (productList && want.length) { const all = productList().map((p) => ({ ...p, tk: new Set(normalise(p.name).split(' ').filter((w) => w && !/^(the|a|an|sika|and|of)$/.test(w))) })); const ok = all.filter((p) => want.every((w) => p.tk.has(w) || p.tk.has(w.replace(/s$/, ''))));
        const exact = ok.filter((p) => p.tk.size === want.length); const one = exact.length === 1 ? exact[0] : ok.length === 1 ? ok[0] : null; if (one) return { id: one.id, name: one.name }; const base = baseOf(ok, want); if (base) return { id: base.id, name: base.name }; if (ok.length > 1 && !sameLine(ok)) { amb = amb || ok; continue; } } // a range name that fits several products is not one product: say so, never take the first
      const r = await ask(tt, null);
      const cands = (r.cards || []).map((c) => c.product).filter(Boolean);
      const hit = cands.find((p) => { const nm = new Set(normalise(p.name).split(' ')); return want.length && want.every((w) => nm.has(w) || nm.has(w.replace(/s$/, ''))); });
      if (hit) return { id: hit.id, name: hit.name };
    }
    return amb ? { amb: amb.slice(0, 5).map((p) => ({ id: p.id, name: p.name })) } : null;
  }
  async function compareAsk(q, h) {
    const sides = compareSides(q); if (!sides) return null;
    const A = await resolveSide(sides.a, h, sides.b); const B = A && await resolveSide(sides.b, h, sides.a);
    // either side names a range (several products fit): ask which one, with a chip per product, instead of quietly taking the first
    const amb = A && A.amb ? { side: sides.a, list: A.amb, other: B && !B.amb ? B.name : sides.b } : B && B.amb ? { side: sides.b, list: B.amb, other: A.name, flip: true } : null;
    if (amb) {
      const pair = (x, y) => (/&/.test(x) && !/&/.test(y) ? `Compare ${y} and ${x}` : `Compare ${x} and ${y}`); // a name with an ampersand goes last: the sides are split at the first "and"
      const chips = amb.list.map((p) => (amb.flip ? pair(amb.other, p.name) : pair(p.name, amb.other)));
      const c = card({ type: 'choose', title: `Which ${amb.side.replace(/^(the|a|an) /i, '')} do you mean?`, headline: `"${amb.side}" fits more than one product in the Sika Australia range. Pick the one you want in the comparison.`, facts: [], status: 'PUBLISHED', chip: CHIPS.PUBLISHED, followups: chips });
      c.choices = amb.list.map((p, i) => ({ label: p.name, value: chips[i] }));
      return { choose: c };
    }
    if (!A || !B || A.id === B.id) return null;
    return `compare ${A.name} and ${B.name}`;
  }

  async function run(question, state) {
    await boot();
    const q = String(question || '').trim(); const n = normalise(q);
    const h = state && state.h ? { ...newH(), ...state.h } : newH();
    const inner = state && state.h ? { ...state } : state; if (inner) delete inner.h;
    const words = n.split(' ').filter(Boolean).length;
    let res = null; let rewritten = null; let wantPick = wantsPick(q); let sameFor = null;
    // 0. the talking layer (chat.js): a social turn, a vague place or product group, and the short reply that answers a clarifying question
    const chatAnswer = (c, kind, convo) => { finalize(c); if (convo && convo.id !== 'generic') { h.place = convo.id; h.pt = 0; } if (kind === 'ask') h.qa = q; return { schema: 'sika-brain-answer@1', query: q, intent: kind === 'social' ? 'social' : 'vague', stage: 'chat', cards: [c], followups: [], state: merge(inner ? { ...inner } : null, { ...h, convo }), ms: 0, trace: ['chat:' + kind] }; };
    const sk = socialKind(q);
    // a thanks or a goodbye closes the thread: what comes next is a new topic, not an answer to the old clarifier
    if (sk === 'thanks' || sk === 'bye') { h.convo = null; h.place = null; }
    if (sk) { h.fresh = true; return chatAnswer(socialCard(sk, q), 'social', h.convo || null); } // a social turn: the product held before it is not carried into a quantity ask after it
    // two products joined by a comparing word ("X vs Y", "difference between X and Y", "how does X measure up to Y"): resolve each side to ONE product, then one side-by-side card
    // the coverage decision (cover.js via the brain): the asked object and attribute checked against the data before any routing. A held product counts only while it is fresh.
    let cv = cover ? await cover(q, (!h.fresh && (h.product || (inner && inner.productId))) || '') : null; let coverPost = null;
    if (cv && cv.post) { coverPost = cv; cv = null; }
    if (cv) res = cv;
    const cmpAsk = res ? null : await compareAsk(q, h);
    if (cmpAsk && cmpAsk.choose) { finalize(cmpAsk.choose); return { schema: 'sika-brain-answer@1', query: q, intent: 'which', stage: 'session', cards: [cmpAsk.choose], followups: cmpAsk.choose.followups, state: merge(inner ? { ...inner } : null, h), ms: 0, trace: ['session:compare:which'] }; }
    if (cmpAsk) { rewritten = cmpAsk; wantPick = false; }
    if (h.place) h.pt = (h.pt || 0) + 1; // turns since the last place we asked about; after 3 it is stale
    const fu = !res && rewritten === null && h.convo ? ((words <= 9 && REC.test(n) && bare(n) ? defaultPick(h.convo) : null) || followUp(q, h.convo)) : null;
    if (rewritten !== null) { /* a comparison: nothing below applies */ }
    else if (!res && !fu && !h.convo && words <= 16) { const tj = twoJobs(q, advisor.kindOf); if (tj) { const t = twoJobsCard(tj, (k) => (advisor.kinds.find((x) => x.id === k) || {}).label); return chatAnswer(t.card, 'ask', t.convo); } }
    if (rewritten !== null) { /* handled */ }
    else if (fu) { rewritten = fu.ask; wantPick = true; if (h.convo) { h.place = h.convo.id; h.pt = 0; } h.convo = null; }
    else if (!res) {
      const followShape = /^(and|also|what about|how about|but|or|now|then|same|ditto)\b/.test(n) || ENV.test(n) || ORD.test(n) || AREA_FU.test(n) || PACK.test(n) || BACK.test(n) || ASPECT.test(n);
      { const pm = /\b(for|on|in|under|over) (it|that|there|the same)\b/.exec(n); const pw = h.qa && /\b(shower|bathroom|ensuite|kitchen|laundry|balcony|roof|garage|pool|deck|basement|bench|splashback|patio|driveway)\b/.exec(normalise(h.qa)); if (pm && pw && advisor.hasKind(n) && (h.pt || 0) <= 3) { if (advisor.kindOf(n) === 'tile_adhesive') { const p = placeCard(PLACES.find((x) => x.id === 'tileadh'), true); p.card.headline = `For the ${pw[1]}: ${p.card.headline}`; return chatAnswer(p.card, 'ask', p.convo); } rewritten = n.replace(pm[0], `${pm[1]} a ${pw[1]}`); wantPick = true; } }
      let pl = rewritten !== null ? null : followShape || (h.product && !h.fresh && /\b(it|its|it s|this|that)\b/.test(n) && !/\b(bathroom|kitchen|laundry|shower|balcony|roof|garage|pool|deck|basement)\b/.test(n)) ? null : placeOf(q);
      // a lone narrowing word ("sealant", "which silicone", "outside") a turn or two after a place question joins that place; a room named afresh does not
      if (pl && pl.place && !pl.ask && h.place && (h.pt || 0) <= 3 && isModifier(pl.place) && pl.place.id !== h.place) { const jp = joinPlace(q, h.place); if (jp) { rewritten = jp.ask; wantPick = true; pl = null; h.pt = 0; } }
      if (rewritten === null && !followShape && h.place && (h.pt || 0) <= 3 && h.qa && ENVWORD.test(n)) { rewritten = `${h.qa.replace(/[?.!]+$/, '')} ${ENVWORD.exec(n)[1]}`; wantPick = true; pl = null; }
      if (pl && !pl.place && (pl.rec || wantPick) && h.place && h.qa && (h.pt || 0) <= 3) { rewritten = h.qa; wantPick = true; pl = null; } // "what do I use" a moment after a place question: pick for that question
      if (pl && !pl.place) { if (pl.rec && ((h.job && (!h.jobImplied || (REC.test(n) && bare(n)))) || h.jobState || h.picked)) res = (await recommend(h, q)) || noPick(q); else { const g = genericCard(pl.rec); return chatAnswer(g.card, 'ask', g.convo); } }
      else if (pl && pl.ask) { rewritten = pl.ask; wantPick = true; }
      else if (pl) { const p = placeCard(pl.place, pl.rec); return chatAnswer(p.card, 'ask', p.convo); }
    }
    if (res) { /* answered by the recommend path above */ }
    // 1. recommend one, after any card
    // "you pick" / "what do I use" with no job on record but a question asked a moment ago: pick for that question
    else if (rewritten === null && words <= 9 && REC.test(n) && bare(n) && !h.job && !(h.product && jobFromProduct(h.product)) && !h.jobState && h.place && h.qa && (h.pt || 0) <= 3) { rewritten = h.qa; wantPick = true; }
    else if (rewritten === null && words <= 9 && (REC.test(n) || n === normalise(V.RECOMMEND_CHIP)) && bare(n) && !(advisor.hasKind(n) && !/\b(for me|one)\b/.test(n))) res = (await recommend(h, q)) || noPick(q);
    // 1b. "same for SikaTile-400 EVO PRO": the area just worked out, for the product named
    else if (h.area != null && h.kind === 'calc' && SAME_FOR.test(n) && (sameFor = await resolveSide(SAME_FOR.exec(n)[1], h, null)) && !sameFor.amb && /\b(?:sika\w*|davco|lanko|schonox|sarnafil|\d{2,})\b/.test(n)) rewritten = `how much ${sameFor.name} for ${h.area} m2`;
    // a joint length answering the sealant question ("10 lineal metres", "15 m of joint at 10 x 10 mm"), or a pack count answering the quantity question ("2 x 20 kg bags"): both are about the product held
    else if (JOINT_RE.test(n) && h.product && productName(h.product) && !h.fresh && (h.jointAsk || h.kind === 'calc')) { const m = JOINT_RE.exec(n); rewritten = `how much ${productName(h.product)} do i need for ${m[1]} m of joint${m[2] ? ` ${m[2]} x ${m[3]} mm` : ''}`; }
    // one turn: "how much X for 12 m of 10 x 10 mm joint" is a quantity ask by joint length
    else if (/^how much .+ for \d+(?:\.\d+)? ?(?:m|metres?|lineal metres?) (?:of|long)\b/.test(n) && !/\bdo i need\b/.test(n)) rewritten = n.replace(/ for (?=\d)/, ' do i need for ');
    // "is there a special trowel for it": the pronoun is the product held, so ask with its name
    else if (h.product && productName(h.product) && !h.fresh && /\b(?:for|with|on|to|under|over|into) (?:it|this one|that one)\b/.test(n) && !/\b(?:sika\w*|davco|lanko|schonox)\b/.test(n)) rewritten = n.replace(/\b(?:it|this one|that one)\b/, productName(h.product));
    else if (PACKS_RE.test(n) && h.product && productName(h.product) && !h.fresh && h.kind === 'calc') rewritten = `coverage of ${productName(h.product)}`;
    // 2. the first / second / third one
    else if (ORD.test(n) && h.products.length) {
      const m = ORD.exec(n)[1]; const i = /first|1st|top/.test(m) ? 0 : /second|2nd/.test(m) ? 1 : /third|3rd/.test(m) ? 2 : /fourth|4th/.test(m) ? 3 : h.products.length - 1;
      const pid = h.products[i]; const nm = pid && productName(pid);
      if (nm) { const carry = KINDS_WITH_PRODUCT.has(h.kind) && h.kind !== 'calc'; const qq = carry ? ({ rate: `coverage of ${nm}`, time: `how long does ${nm} take to cure`, document: `data sheet for ${nm}`, safety: `safety information for ${nm}`, spec: `specification clauses for ${nm}` }[h.kind]) : `tell me about ${nm}`; rewritten = qq; }
    }
    // 3. the same for 20 m2
    else if (AREA_FU.test(n)) {
      const a = areaOf(n); const nm = h.product && productName(h.product);
      if (nm) rewritten = `how much ${nm} for ${a} m2`; else if (h.job) rewritten = `how much ${h.job} for ${a} m2`;
    }
    // 3a. "and for 30 m2 how much" right after a My pick: the quantity is for the product picked, not the whole kind again
    else if (h.picked && productName(h.picked) && areaOf(n) != null && words <= 12 && qtyShaped(n) && !h.fresh && !/\b(?:sika\w*|davco|lanko|schonox)\b/.test(n) && !typeClash(n, { ...h, product: h.picked })) { const th = /\b(\d+(?:\.\d+)?) ?mm\b/.exec(n); rewritten = `how much ${productName(h.picked)} for ${areaOf(n)} m2${th ? ` at ${th[1]} mm` : ''}`; }
    // 3b. a bare area answering the area question ("10 m2", "about 12 square metres") for the product held
    // 3b'. a bare number or "3 by 4" answering the area question ("12", "3 x 4", "about 3 by 4 metres") for the product held
    // a bare number or pair with a product held: converted ONLY while an area or joint question is open; otherwise it is as likely a tile size, so ask which
    else if (BARE_NUM.test(n) && h.product && productName(h.product) && !h.fresh && (h.kind === 'calc' || h.jointAsk || BARE_NUM.exec(n)[2] != null || Number(BARE_NUM.exec(n)[1]) >= 100)) { const m = BARE_NUM.exec(n); const a1 = Number(m[1]), a2 = m[2] != null ? Number(m[2]) : null; const nm = productName(h.product);
      if (!(h.kind === 'calc' || h.jointAsk)) { const c = card({ type: 'choose', title: `${nm}: ${a2 != null ? `${a1} x ${a2}` : a1}`, headline: `Is that the tile size or the area? I have no area question open, so I will not turn it into a quantity. Tell me the area in square metres, or the sides in metres, and I will work out how much ${nm} you need.`, facts: [], status: 'PUBLISHED', chip: CHIPS.PUBLISHED, followups: [10, 20, 50].map((a) => `How much ${nm} for ${a} m2`) }); finalize(c); return { schema: 'sika-brain-answer@1', query: q, intent: 'which', stage: 'session', cards: [c], followups: c.followups, state: merge(inner ? { ...inner } : null, { ...h }), ms: 0, trace: ['session:size-or-area'] }; }
      if (h.jointAsk && a2 != null && /mm/.test(n) && h.jointMetres != null) rewritten = `how much ${nm} do i need for ${h.jointMetres} m of joint ${a1} x ${a2} mm`; // the joint size answering the size question
      else if (h.jointAsk && a2 == null) rewritten = `how much ${nm} do i need for ${a1} m of joint`; // metres only: the brain asks the size next, never takes the first row
      else if (a2 != null && a1 >= 100 && a2 >= 100) rewritten = `how much ${nm} for ${Math.round(a1 * a2 / 10000) / 100} m2`; // two numbers in the hundreds or thousands with no unit are millimetres
      else if (a1 > 100 || (a2 != null && a2 > 100)) { const c = card({ type: 'choose', title: `How much ${nm}?`, headline: `I read ${a2 != null ? `${a1} x ${a2}` : a1} with no unit, which would be ${a2 != null ? a1 * a2 : a1} m2 if it were metres, so please check the area: metres squared, or the sides in metres (3 by 4).`, facts: [], status: 'PUBLISHED', chip: CHIPS.PUBLISHED, followups: [10, 20, 50].map((a) => `How much ${nm} for ${a} m2`) }); finalize(c); return { schema: 'sika-brain-answer@1', query: q, intent: 'calc', stage: 'session', cards: [c], followups: c.followups, state: merge(inner ? { ...inner } : null, { ...h, kind: 'calc' }), ms: 0, trace: ['session:area-check'] }; }
      else rewritten = `how much ${nm} for ${a2 != null ? Math.round(a1 * a2 * 100) / 100 : a1} m2`; }
    else if (BARE_AREA.test(n) && (h.kind === 'calc' || /^(?:the area is|area is)\b/.test(n)) && h.product && productName(h.product) && !h.fresh) { const th = /\b(\d+(?:\.\d+)?) ?mm\b/.exec(n); rewritten = `how much ${productName(h.product)} for ${areaOf(n)} m2${th ? ` at ${th[1]} mm` : ''}`; }
    // 4. in a pail?
    else if (PACK.test(n) && h.product && productName(h.product)) rewritten = `packaging of ${productName(h.product)}`;
    // 5. go back
    else if (BACK.test(n) && h.hist.length >= 2) rewritten = h.hist[h.hist.length - 2];
    // 6. and the SDS? what about outdoors? (read against the last product and the last question)
    else if (h.product && productName(h.product) && areaOf(n) != null && words <= 10 && /\bhow (?:much|many)\b|\blitres?\b|\bquantity\b/.test(n) && !/\b(?:sika\w*|davco|lanko|schonox)\b/.test(n) && !(h.jobState && h.jobState.kindId) && !h.fresh && !typeClash(n, h)) { const th = /\b(\d+(?:\.\d+)?) ?mm\b/.exec(n); rewritten = `how much ${productName(h.product)} for ${areaOf(n)} m2${th ? ` at ${th[1]} mm` : ''}`; } // "6 m2, how many litres" right after a product: that product
    else if (ASPECT.test(n) && h.product && productName(h.product)) { const a = ASPECT.exec(n)[1]; rewritten = `${a} ${/^(sds|msds|pds|tds|data ?sheet|safety data sheet|safety sheet)$/.test(a) ? 'for' : 'of'} ${productName(h.product)}`; }
    else if (ENV.test(n) && h.q && !(inner && inner.advice)) { const e = ENV.exec(n)[1]; if (h.product && productName(h.product)) rewritten = `${h.q.replace(/[?.!]+$/, '')} ${e}`; else if (h.job) rewritten = `best ${h.job} ${e}`; }
    if (!res) {
      const st = inner ? { ...inner } : null;
      if (st && h.fresh && qtyShaped(n)) { delete st.productId; delete st.productIds; } // right after a hi or a thanks, "how much for 10 m2" is a new ask, not about the product held before
      const useQ = rewritten || q;
      const st2 = (h.product && !(st && st.productId) && (rewritten === null) && !typeClash(n, h) && !(h.fresh && qtyShaped(n))) ? { ...(st || {}), productId: h.product, intent: (st && st.intent) || h.kind || 'which' } : st;
      // ONE follow-up order: the session holds the job record (h.jobState, set from the inner brain's state.job); it is handed to the inner brain on every turn so its job chain
      // (recommendForJob, product-less quantity, Add chips) reads the same job and the "which product do you mean" card never fires for a job the session already holds
      const st3 = h.jobState && !(st2 && st2.job) && rewritten === null ? { ...(st2 || {}), job: h.jobState } : st2;
      res = await ask(useQ, st3);
      if (rewritten) { res.trace.push('session:rewrite:' + rewritten); res.query = q; }
      // the inner brain found nothing, but the words name a kind of product in the range ("the grout is going mouldy"): pick from that kind rather than say it is unpublished
      { const c0 = res.cards[0]; if (!rewritten && c0 && c0.type === 'unknown' && !c0.product && !c0.about && !(res.trace || []).some((x) => /^cover:/.test(x)) && advisor.hasKind(n) && !/\b(price|cost|stock|sds|msds|data sheet|warrant\w*)\b/.test(n)) { const r2 = await ask('best ' + jobOf(q), null); if (r2 && r2.cards.some((c) => c.type === 'product' && c.product)) { res = r2; res.query = q; res.trace = (res.trace || []).concat(['session:kind-fallback']); wantPick = true; } } }
    }
    if (!res) res = await ask(q, inner);
    // a range name with more of the product's own name after it ("SikaBond Instant Nails"): the brain asked "which one?", but the visitor already said which. Resolve the words that follow the family to ONE product and ask again with its full name.
    if (rewritten === null && res.cards[0] && res.cards[0].type === 'choose') {
      const fam = (res.trace || []).find((x) => x.startsWith('family:')); const fw = fam && fam.slice(7);
      let ambig = null;
      if (fw) { const toks = n.split(' '); const i = toks.indexOf(fw);
        for (let len = Math.min(4, toks.length - i - 1); len >= 1 && i >= 0; len--) { const win = toks.slice(i + 1, i + 1 + len); if (win.some((w) => /^(is|ok|for|can|the|a|to|on|in|and|or|how|what|does|will|be|it|at|when)$/.test(w))) continue; const r = await resolveSide([fw, ...win].join(' '), h, null); if (r && r.amb && !ambig) { const rx = new RegExp(fw + '[^a-z0-9]*' + win.join('[^a-z0-9]*'), 'i'); if (rx.test(q)) ambig = r.amb.map((p) => ({ name: p.name, value: q.replace(rx, p.name) })); } if (r && !r.amb) { const again = q.replace(new RegExp(fw + '[^a-z0-9]*' + win.join('[^a-z0-9]*'), 'i'), r.name); if (again !== q) { rewritten = again; res = await ask(again, inner); res.trace.push('session:family:' + r.name); res.query = q; break; } } } }
      // the words after the family fit several products ("sikaflex fc" is 212 FC, 11 FC+ and 11 FC Purform): ask which of THOSE, never take the first
      if (ambig && rewritten === null) { const c = card({ type: 'choose', title: `Which ${fw} product do you mean?`, headline: `That fits more than one ${fw} product in the Sika Australia range. Pick the one you mean.`, facts: [], status: 'PUBLISHED', chip: CHIPS.PUBLISHED, followups: ambig.map((x) => x.value) }); c.choices = ambig.map((x) => ({ label: x.name, value: x.value })); finalize(c); res = { ...res, cards: [c], followups: c.followups, trace: [...(res.trace || []), 'session:family:which'] }; }
    }
    if (coverPost && coverQuote && !rewritten) res = coverQuote(res, coverPost.post, coverPost.sh);
    const covered = (res.trace || []).some((x) => /^cover:/.test(x));
    { const lk = !rewritten && !covered && res.cards[0] && looseSocial(q, res.cards[0]); if (lk) return chatAnswer(socialCard(lk, q), 'social', h.convo || null); } // nothing in it is about the range: chat, not a not-found card
    { const c0 = res.cards[0]; if (c0 && c0.type === 'unknown' && !c0.product && !c0.about && !covered && sellAsk(q)) c0.headline = 'That is not in the Sika Australia documentation I work from, so I cannot say Sika sells or does it. I can help with Sika products for a job: tell me the surface and the problem.'; }
    { const c0 = res.cards[0]; if (c0 && c0.type === 'comparison' && (/\b(better|best|worse|worst|recommend\w*|should i (?:use|buy|get|pick)|which (?:one|is|would|should))\b/.test(n) || /\bor\b.*\b(for|on|in|under)\b/.test(n)) && !/ the data sheets do not rank/.test(c0.headline)) c0.headline += ' The data sheets do not rank products, so I cannot say which is better. The table shows what each one publishes.'; }
    if (wantPick) res = withPick(res, q);
    const h2 = update(h, q, n, res); h2.qa = rewritten || q;
    { const c0 = res.cards[0]; h2.picked = c0 && /^My pick/.test(c0.headline || '') && (c0.product || (res.state && res.state.productIds && res.state.productIds[0])) ? (c0.product ? c0.product.id : res.state.productIds[0]) : (rewritten && h.picked && rewritten.includes(productName(h.picked) || '\u0000') ? h.picked : null); }
    h2.jobState = (res.state && res.state.job) || ((res.stage === 'session' || res.cards.some((c) => c.type === 'unknown' || c.type === 'choose')) ? h.jobState : null);
    if (h2.jobState && res.stage === 'session' && !(res.state && res.state.job)) res.state = { ...(res.state || {}), job: h2.jobState };
    res = await dress(res, h2);
    res.state = merge(res.state, (res.state && res.state.h) ? { ...h2, ...res.state.h } : h2);
    return res;
  }
  return { ask: run };
}
