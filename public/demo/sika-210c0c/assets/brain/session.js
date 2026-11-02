// session.js: the conversation layer. Wraps the brain's single-question ask() with a small session state, so a follow-up is read against what was
// just answered: last products, last intent, last numbers and the job so far. No model, no network; the state is plain JSON the page passes back.
//   state.h = { job, product, products[], kind, q, area, topic, hist[] }   (state.productId / intent / advice from the inner brain pass through untouched)
// Follow-ups handled: recommend one (after any card), the first / second / third one, the same for 20 m2, in a pail, and the SDS, what about outdoors, go back.
import { normalise } from './text.js';
import { jobOf, areaOf, leafOf, recommendFor } from './recommend.js';
import * as V from './voice.js';
import { card, CHIPS, fact, finalize } from './schema.js';
import { socialKind, socialCard, placeOf, placeCard, genericCard, followUp, withPick, PICK_RX } from './chat.js';

const REC = /\brec+o?m+e?n+d|\b(suggest|pick one|pick for me|you pick|you choose|you decide|your pick|your choice|up to you|just tell me|you tell me|best one|whatever is best|whatever s best|whatever you think|surprise me|any one|no preference|dont mind|don t mind|doesn t matter|which (one )?(should|would) (i|you)|what would you (use|pick|choose|go with)|which is best|which one is best|which one s best|you choose for me)\b/;
const ORD = /^(?:(?:and|ok|okay|now|so|what about|how about|tell me about|show me|go with|i ll take|ill take|i take) )*(?:the )?(first|1st|top|second|2nd|third|3rd|last|fourth|4th)(?: one| option| product| choice)?(?: please)?$/;
const AREA_FU = /^(?:(?:same|and|ok|okay|now|so|what about|how about|what if|if|for|ditto) )+(?:it is |its |it s |is |i have |i ve got |i got )?\d+(?:\.\d+)? ?(?:m2|m 2)(?: please)?$|^(?:same|ditto)(?: again)? for \d+(?:\.\d+)? ?(?:m2|m 2)$/;
const PACK = /^(?:(?:and|what about|how about|is it|does it come|do you (?:have|sell)|can i get (?:it)?|comes?) )*(?:in )?(?:a |an |the )?(pails?|buckets?|bags?|tubes?|cartridges?|sausages?|drums?|tubs?|cartons?|boxes|packs?|unipacks?|jerry cans?|small(?:er)? (?:pack|size|bag)|bigger (?:pack|size)|big(?:ger)? (?:one|bag|pack))(?: size| sizes)?(?: version| option)?$/;
const BACK = /^(?:go back|back|previous|the previous (?:one|answer)|the one before|before that|undo|back to (?:that|the last one)|what was the last one)$/;
const ENV = /^(?:(?:and|what about|how about|what if|if it s|if its|if it is|is it ok|does it work|how about for|and for|for) )+(?:the |a )?(outdoors?|outside|exterior|external|indoors?|inside|interior|internal|wet areas?|bathroom|shower|kitchen|laundry|balcony|pool|garage|cold|winter|hot weather|summer|damp|humid)(?: too| as well)?$/;
const ASPECT = /^(?:(?:and|what about|how about|also|ok|okay|now|then|the) )+(sds|msds|pds|tds|data ?sheet|safety data sheet|safety sheet|coverage|consumption|pot life|open time|cure time|curing time|drying time|recoat time|shelf life|colours?|colors?|packaging|pack size|price|cost|vocs?|mixing ratio|warranty|storage)(?: for it| of it| for that| for that one)?$/;
const CHIP_JOBS = ['Recommend a tile adhesive', 'Recommend a waterproofing membrane', 'Recommend a floor leveller', 'Recommend a sealant'];
const KINDS_WITH_PRODUCT = new Set(['calc', 'rate', 'time', 'document', 'safety', 'spec']);
const SAFE_OPT = (s) => String(s).replace(/\s+/g, ' ').trim();

const FILL = new Set('me one for you please can could just a an the to that anything something which pick choose tell whatever is s best i would should use go with any up it your my us them of either way thanks thank you re hey hi ok okay so then now well and or but if its it one any'.split(' '));
/** True when nothing but the recommend request itself is in the message (no job words: "can you recommend a good tiler" is a real question, not a chip). */
const bare = (n) => n.replace(REC, ' ').split(' ').filter((w) => w && !FILL.has(w)).length === 0;
export function createSession({ ask, advisor, boot, productName, productCategory }) {
  const ids = (res) => [...new Set(res.cards.map((c) => c.product && c.product.id).filter(Boolean))];
  const JOBS = [[/level/, 'floor leveller'], [/tile-adhesive/, 'tile adhesive'], [/tile-grout|grouts?$/, 'tile grout'], [/waterproof|membrane/, 'waterproofing membrane'], [/sanitary-sealant/, 'bathroom sealant'], [/sealant/, 'sealant'], [/primer/, 'primer'], [/repair-mortar/, 'repair mortar'], [/admixture|water-?reducer|retarder|accelerator/, 'concrete admixture'], [/anchor/, 'chemical anchor'], [/epoxy/, 'epoxy'], [/adhesive/, 'construction adhesive']];
  const jobFromProduct = (id) => { const cat = String(productCategory(id) || ''); for (const [rx, job] of JOBS) if (rx.test(cat) && advisor.hasKind(job)) return job; const parts = cat.split('/').filter(Boolean).reverse(); for (const p of parts) { const t = leafOf(p); if (advisor.hasKind(t)) return t; } return ''; };
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
    else if (jb && advisor.hasKind(jb) && standalone) h.job = jb;
    else if (!h.job && h.product) h.job = jobFromProduct(h.product);
    if (KINDS_WITH_PRODUCT.has(res.intent) || res.intent === 'compare' || res.intent === 'system') h.kind = res.intent;
    else if (['which', 'product', 'attr', 'tree', 'advice'].includes(res.intent)) h.kind = '';
    if (res.stage === 'kb' && res.cards[0]) h.topic = res.cards[0].title || '';
    h.q = q; h.hist.push(q);
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
      if (!(c.links || []).some((l) => l.url === V.TECH_ROUTE.url) && !c.product) c.links = (c.links || []).concat([V.TECH_ROUTE]);
      if (canRec && !(res.followups || []).includes(V.RECOMMEND_CHIP) && !/outside what I can help|do not recommend tradespeople/.test(c.handoff && c.handoff.reason || '')) res.followups = [V.RECOMMEND_CHIP, ...(res.followups || [])].slice(0, 5);
    }
    return res;
  }

  async function run(question, state) {
    await boot();
    const q = String(question || '').trim(); const n = normalise(q);
    const h = state && state.h ? { ...newH(), ...state.h } : newH();
    const inner = state && state.h ? { ...state } : state; if (inner) delete inner.h;
    const words = n.split(' ').filter(Boolean).length;
    let res = null; let rewritten = null; let wantPick = PICK_RX.test(n);
    // 0. the talking layer (chat.js): a social turn, a vague place or product group, and the short reply that answers a clarifying question
    const chatAnswer = (c, kind, convo) => { finalize(c); return { schema: 'sika-brain-answer@1', query: q, intent: kind === 'social' ? 'social' : 'vague', stage: 'chat', cards: [c], followups: [], state: merge(inner ? { ...inner } : null, { ...h, convo }), ms: 0, trace: ['chat:' + kind] }; };
    const sk = socialKind(q);
    if (sk) return chatAnswer(socialCard(sk, q), 'social', h.convo || null);
    const fu = h.convo ? followUp(q, h.convo) : null;
    if (fu) { rewritten = fu.ask; wantPick = true; h.convo = null; }
    else {
      const followShape = /^(and|also|what about|how about|but|or|now|then|same|ditto)\b/.test(n) || ENV.test(n) || ORD.test(n) || AREA_FU.test(n) || PACK.test(n) || BACK.test(n) || ASPECT.test(n);
      const pl = followShape ? null : placeOf(q);
      if (pl && !pl.place) { if (pl.rec && (h.job || h.product || h.jobState)) res = (await recommend(h, q)) || noPick(q); else { const g = genericCard(pl.rec); return chatAnswer(g.card, 'ask', g.convo); } }
      else if (pl && pl.ask) { rewritten = pl.ask; wantPick = true; }
      else if (pl) { const p = placeCard(pl.place, pl.rec); return chatAnswer(p.card, 'ask', p.convo); }
    }
    if (res) { /* answered by the recommend path above */ }
    // 1. recommend one, after any card
    else if (words <= 9 && (REC.test(n) || n === normalise(V.RECOMMEND_CHIP)) && bare(n) && !(advisor.hasKind(n) && !/\b(for me|one)\b/.test(n))) res = (await recommend(h, q)) || noPick(q);
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
    // 4. in a pail?
    else if (PACK.test(n) && h.product && productName(h.product)) rewritten = `packaging of ${productName(h.product)}`;
    // 5. go back
    else if (BACK.test(n) && h.hist.length >= 2) rewritten = h.hist[h.hist.length - 2];
    // 6. and the SDS? what about outdoors? (read against the last product and the last question)
    else if (ASPECT.test(n) && h.product && productName(h.product)) { const a = ASPECT.exec(n)[1]; rewritten = `${a} ${/^(sds|msds|pds|tds|data ?sheet|safety data sheet|safety sheet)$/.test(a) ? 'for' : 'of'} ${productName(h.product)}`; }
    else if (ENV.test(n) && h.q && !(inner && inner.advice)) { const e = ENV.exec(n)[1]; if (h.product && productName(h.product)) rewritten = `${h.q.replace(/[?.!]+$/, '')} ${e}`; else if (h.job) rewritten = `best ${h.job} ${e}`; }
    if (!res) {
      const st = inner ? { ...inner } : null;
      const useQ = rewritten || q;
      const st2 = (h.product && !(st && st.productId) && (rewritten === null)) ? { ...(st || {}), productId: h.product, intent: (st && st.intent) || h.kind || 'which' } : st;
      // ONE follow-up order: the session holds the job record (h.jobState, set from the inner brain's state.job); it is handed to the inner brain on every turn so its job chain
      // (recommendForJob, product-less quantity, Add chips) reads the same job and the "which product do you mean" card never fires for a job the session already holds
      const st3 = h.jobState && !(st2 && st2.job) && rewritten === null ? { ...(st2 || {}), job: h.jobState } : st2;
      res = await ask(useQ, st3);
      if (rewritten) { res.trace.push('session:rewrite:' + rewritten); res.query = q; }
    }
    if (!res) res = await ask(q, inner);
    if (wantPick) res = withPick(res, q);
    const h2 = update(h, q, n, res);
    h2.jobState = (res.state && res.state.job) || ((res.stage === 'session' || res.cards.some((c) => c.type === 'unknown' || c.type === 'choose')) ? h.jobState : null);
    if (h2.jobState && res.stage === 'session' && !(res.state && res.state.job)) res.state = { ...(res.state || {}), job: h2.jobState };
    res = await dress(res, h2);
    res.state = merge(res.state, (res.state && res.state.h) ? { ...h2, ...res.state.h } : h2);
    return res;
  }
  return { ask: run };
}
