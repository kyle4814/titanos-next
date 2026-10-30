// golden_gen.mjs: generates golden questions from the CATALOGUE (portal products and documents, and the knowledge lane files), not from the brain's own shards.
// Six intents: which product, what rate, which document, is it compatible, how long, how much for N m2. Plus system, tree and out-of-scope negatives.
import fs from 'node:fs';
import { rd } from './harness.mjs';
const LANES = process.env.SIKA_LANES || '/home/tech2/klinge-kernel/state/sika/lanes';
const SYSTEMS = process.env.SIKA_SYSTEMS || '/home/tech2/klinge-kernel/state/sika/systems/out/systems.full.json';
const lane = (f) => JSON.parse(fs.readFileSync(`${LANES}/knowledge/${f}.json`, 'utf8'));
const clean = (s) => String(s || '').replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim();

export function generate() {
  const products = rd('data/products.json'), documents = rd('data/documents.json');
  const rates = lane('rates').products, compat = lane('compatibility').products, trees = lane('decision_trees');
  const docsBy = new Map(); for (const d of documents) for (const id of d.products || []) { if (!docsBy.has(id)) docsBy.set(id, []); docsBy.get(id).push(d); }
  const okDoc = (d) => !d.http || d.http.status === 200;
  const Q = [];
  const nameCount = new Map(); for (const p of products) nameCount.set(clean(p.name).toLowerCase(), (nameCount.get(clean(p.name).toLowerCase()) || 0) + 1);
  const tagCount = new Map(); for (const p of products) { const t = clean(p.tagline).toLowerCase(); tagCount.set(t, (tagCount.get(t) || 0) + 1); }
  products.forEach((p, i) => {
    const name = clean(p.name), uniq = nameCount.get(name.toLowerCase()) === 1;
    // 1 WHICH
    Q.push({ intent: 'which', kind: 'name', q: `Tell me about ${name}`, exp: { product: p.id, top: 1 } });
    if (name.length >= 9 && name.includes(' ')) { const k = 3 + (i % (name.length - 5)); const typo = name.slice(0, k) + name[k + 1] + name[k] + name.slice(k + 2); if (typo !== name && /[a-z]/i.test(name[k]) && name[k] !== name[k + 1]) Q.push({ intent: 'which', kind: 'typo', q: `tell me about ${typo.toLowerCase()}`, exp: { product: p.id, top: 5 } }); }
    const tg = clean(p.tagline).toLowerCase();
    if (tg.length > 25 && tagCount.get(tg) === 1) Q.push({ intent: 'which', kind: 'describe', q: `I need ${tg}`, exp: { product: p.id, top: 5 } });
    // 2 RATE
    const rp = rates[p.id]; const cons = rp ? rp.facts.consumption : [];
    Q.push({ intent: 'rate', kind: cons.length ? 'rate' : 'rate-none', q: `What is the coverage of ${name}?`, exp: { product: p.id, sentences: cons.map((f) => f.text), none: !cons.length } });
    // 3 DOCUMENT
    const docs = (docsBy.get(p.id) || []).filter(okDoc);
    const pds = docs.filter((d) => d.type === 'product_data_sheet'), sds = docs.filter((d) => d.type === 'safety_data_sheet');
    Q.push({ intent: 'document', kind: 'pds', q: `data sheet for ${name}`, exp: { product: p.id, urls: pds.map((d) => d.url), none: !pds.length } });
    Q.push({ intent: 'document', kind: 'sds', q: `${name} SDS`, exp: { product: p.id, urls: sds.map((d) => d.url), none: !sds.length } });
    // 5 TIME
    const times = rp ? rp.facts : {}; const T = (k) => (times[k] || []).map((f) => f.text);
    const any = ['open_time', 'adjustability_time', 'pot_life', 'skin_tack_times', 'cure_times', 'recoat_times'].flatMap(T);
    if (T('cure_times').length) Q.push({ intent: 'time', kind: 'cure', q: `How long does ${name} take to cure?`, exp: { product: p.id, sentences: T('cure_times') } });
    if (T('open_time').length) Q.push({ intent: 'time', kind: 'open', q: `What is the open time of ${name}?`, exp: { product: p.id, sentences: T('open_time') } });
    if (T('pot_life').length) Q.push({ intent: 'time', kind: 'pot', q: `What is the pot life of ${name}?`, exp: { product: p.id, sentences: T('pot_life') } });
    if (T('recoat_times').length) Q.push({ intent: 'time', kind: 'recoat', q: `How long before I can recoat ${name}?`, exp: { product: p.id, sentences: T('recoat_times') } });
    if (!any.length) Q.push({ intent: 'time', kind: 'time-none', q: `How long does ${name} take to dry?`, exp: { product: p.id, none: true } });
    // 6 CALC
    const area = [10, 12, 20, 25, 50, 100, 7.5, 35][i % 8];
    Q.push({ intent: 'calc', kind: 'calc', q: `How much ${name} for ${area} m2?`, exp: { product: p.id, area, facts: cons } });
    // price negative (every 4th)
    if (i % 4 === 0) Q.push({ intent: 'unknown', kind: 'price', q: `What is the price of ${name}?`, exp: { unknown: true } });
    // 4 COMPAT: rules whose tag names one substrate and give a clear yes or no
    const cp = compat[p.id]; if (cp) {
      const SUBS = { concrete: 'concrete', plasterboard: 'plasterboard', fibre_cement: 'fibre cement sheet', brick_block: 'brick', existing_tiles: 'existing tiles', timber: 'timber', cement_screed: 'a cement screed', tile_underlay: 'ceramic tile underlay', aac: 'AAC', cement_render: 'cement render' };
      const byTag = {};
      for (const r of cp.rules) for (const t of (r.tags && r.tags.substrate) || []) if (SUBS[t] && (r.polarity === 'yes' || r.polarity === 'no') && !r.conditional) (byTag[t] = byTag[t] || []).push(r);
      for (const [t, rs] of Object.entries(byTag)) {
        const pols = new Set(rs.map((r) => r.polarity)); if (pols.size !== 1) continue; // conflicting rules are not a clean golden case
        // keep only when the rule's own text names the substrate (the lane's tags are keyword based)
        const named = rs.filter((r) => new RegExp(SUBS[t].replace(/^an? /, '').split(' ')[0], 'i').test(r.text));
        if (!named.length) continue;
        Q.push({ intent: 'compat', kind: 'compat-' + [...pols][0], q: `Can I use ${name} on ${SUBS[t]}?`, exp: { product: p.id, verdict: [...pols][0], sentences: named.map((r) => r.text) } });
      }
      // a substrate none of the rules mention: the brain must say it does not know
      const textAll = cp.rules.map((r) => r.text).join(' ').toLowerCase();
      if (cp.rules.length && !/asphalt|bitumen/.test(textAll) && i % 3 === 0) Q.push({ intent: 'compat', kind: 'compat-unknown', q: `Can I use ${name} over asphalt?`, exp: { product: p.id, verdict: 'unknown' } });
    }
  });
  // SYSTEM and TREE
  if (fs.existsSync(SYSTEMS)) {
    const sys = JSON.parse(fs.readFileSync(SYSTEMS, 'utf8')); const TL = { porcelain: 'porcelain tiles', ceramic: 'ceramic tiles', mosaic: 'mosaic tiles' };
    const SL = { concrete: 'concrete', plasterboard: 'plasterboard', 'cement-board': 'fibre cement sheet', masonry: 'brick' }; const LL = { 'internal-floor': 'an internal floor', 'internal-wall': 'an internal wall', 'internal-wet-floor': 'an internal wet area floor', 'internal-wet-wall': 'an internal wet area wall', 'external-floor': 'an external floor', 'external-wall': 'an external wall' };
    for (const [key, s] of Object.entries(sys.systems)) { const [t, sub, loc] = key.split('|'); if (TL[t] && SL[sub] && LL[loc]) Q.push({ intent: 'system', kind: 'system', q: `What is the full system for ${TL[t]} on ${SL[sub]} on ${LL[loc]}?`, exp: { slug: s.slug } }); }
  }
  const ad = trees.trees.find((t) => t.id === 'tile-adhesive');
  const ENV = { internal_wall: 'an internal wall', internal_floor: 'an internal floor', wet_area: 'a wet area', external_wall: 'an external wall', external_floor: 'an external floor' };
  const TL2 = { ceramic: 'ceramic tiles', porcelain: 'porcelain tiles', mosaic: 'mosaic tiles' }; const SL2 = { concrete: 'concrete', cement_screed: 'a cement screed', fibre_cement: 'fibre cement sheet', plasterboard: 'plasterboard', brick_block: 'brick' };
  for (const [key, leaf] of Object.entries(ad.leaves)) { const [e, t, s] = key.split('|'); if (ENV[e] && TL2[t] && SL2[s] && leaf.documented_fit.length) Q.push({ intent: 'which', kind: 'tree', q: `Which tile adhesive for ${TL2[t]} on ${SL2[s]} in ${ENV[e]}?`, exp: { products: leaf.documented_fit.map((x) => x.product), any: true } }); }
  // out of scope
  for (const q of ['Who won the football on the weekend?', 'What is the weather in Brisbane?', 'Can you write me a poem?', 'What is the capital of France?', 'How do I bake bread?', 'Tell me a joke', 'What is the best phone?', 'How fast is a cheetah?', 'Where do I buy a car?', 'What is my horoscope?']) Q.push({ intent: 'unknown', kind: 'oos', q, exp: { unknown: true, noProductCards: true } });
  return Q;
}
if (process.argv[1] && process.argv[1].endsWith('golden_gen.mjs')) { const Q = generate(); const by = {}; for (const x of Q) by[x.intent + ':' + x.kind] = (by[x.intent + ':' + x.kind] || 0) + 1; console.log(Q.length, JSON.stringify(by)); }
