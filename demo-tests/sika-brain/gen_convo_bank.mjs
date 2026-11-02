// gen_convo_bank.mjs: writes convo_bank.json (200 single-intent rows + 40 multi-turn scripts). Product names below were checked against data/brain/core.json (P[].n).
// Properties (checked by convo_score.mjs on the FINAL turn): nf (not the not-published card), chips:[min,max], pick (leads "My pick"), quote (a card carries a quoted source sentence),
// type:[allowed first-card types], notType:[...], has:regex, not:regex, room:regex (the room/surface from turn 1 survives to the final answer), short (under 330 chars), intent:[..], honest (declines with Technical Services / hand-off, no invented answer), products:n (at least n product cards or names in text).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const rows = []; let n = 0;
const add = (cat, cls, turns, props = {}) => rows.push({ id: `${cat}-${String(++n).padStart(3, '0')}`, cat, class: cls, turns: Array.isArray(turns) ? turns : [turns], props });
// base props per class are in the scorer; rows add only extras.
// 1. social (20)
for (const q of ['hello', 'hi mate how are you', "g'day", 'hey', 'good morning', 'morning legend', 'thanks', 'cheers mate', 'ta heaps', 'legend thanks', 'bye', 'see ya', 'who are you', 'what can you do', 'are you a robot', "what's your name", 'you are useless', 'this is rubbish', 'why cant you just answer me', 'lol ok']) add('social', 'social', q, { short: 1 });
// 2. vague places and categories (40)
for (const q of ['bathroom', 'kitchen', 'deck', 'shed', 'roof', 'fence', 'stairs', 'a wall', 'floor', 'window', 'pool', 'laundry', 'garage', 'balcony', 'basement', 'pergola', 'driveway', 'footpath', 'carport', 'toilet', 'tiles', 'concrete', 'timber', 'metal roof', 'glass', 'brick', 'render', 'gutter', 'skylight', 'shower', 'bath', 'patio', 'wet area', 'outdoor area', 'water tank', 'retaining wall', 'cracks', 'leaks', 'damp wall', 'mould']) add('vague', 'clarify', q, { chips: [3, 5] });
// 3. recommend / what's best (40)
const recs = ['what do you recommend for a balcony leak', "what's the best sealant for a shower", 'best adhesive for skirting boards', 'which waterproofing membrane is best under tiles', 'recommend a tile adhesive for large porcelain tiles', 'what should I use to level a concrete floor', 'best primer for a concrete slab before tiling', 'what do you recommend for a leaking flat roof', 'which grout is best for a shower floor', 'best product to fix cracks in a driveway', 'what would you use to glue timber to concrete', 'recommend a sealant for a window frame', 'best way to waterproof a bathroom floor', 'what is the best adhesive for mirrors', 'which sealant for outdoor joints that move', 'recommend something to repair spalling concrete', 'best construction adhesive for a workshop bench', 'what do you suggest for sealing a bath', 'what is best for fixing loose pavers', 'which product for waterproofing a planter box', 'best floor leveller for timber subfloor', 'what do you recommend for a mouldy shower grout', 'best sealant for a kitchen splashback', 'what adhesive for tiles on a plasterboard wall', 'what should I use for under floor heating screed', 'recommend an adhesive for outdoor tiles', 'which one is best for a water tank repair', 'what do you reckon for a balcony waterproofing job', 'best membrane for a podium deck', 'what do you recommend for bonding vinyl planks', 'best thing for anchoring bolts in concrete', 'what do you recommend for a pool surround tiles', 'best sealant for a bathroom ceiling', 'which grout for outdoor tiles', 'what would you put on a concrete floor to stop dust', 'best repair mortar for a concrete step', 'recommend a flexible adhesive for a car trailer', 'what is best for gluing a handrail', 'what do you recommend for expansion joints in a driveway', 'which product for a damp basement wall'];
for (const q of recs) add('recommend', 'pick', q, { pick: 1, quote: 1 });
// 4. typos and slang (30)
const typ = [['need sumthing for shower leak', 'pick'], ['whats the best sealent for a bathrm', 'pick'], ['u got anything for a leaky balcny', 'pick'], ['wat do i use for tiles on a deck', 'pick'], ['arvo mate need a hand with a reno', 'social'], ['doing a bathroom reno wat waterproofing', 'pick'], ['gluin timber to brick wat do i use', 'pick'], ['wats the best grout for the kitchn', 'pick'], ['recomend a adhesive for skirtin boards', 'pick'], ['crackd driveway need fix', 'answer'], ['my roof is leakin wat now', 'pick'], ['sealent for windas', 'pick'], ['need a primmer for concrete', 'answer'], ['tile adheseve for outside', 'pick'], ['pls help leaky showa', 'pick'], ['wat is the coverage of davco gray one pot', 'quantity'], ['sikaflex 11 fc pot life', 'answer'], ['sika flex 11 fc cure time', 'answer'], ['sikalastic 1k datasheet', 'answer'], ['gimme the sds for sikaflex 11 fc', 'answer'], ['do u sell silicone', 'answer'], ['tradie here need fast set adhesive', 'pick'], ['dunno what i need for a wet room', 'clarify'], ['yeah nah need something for a cracked slab', 'pick'], ['wats the diff between sikalastic 1k and 1 komponent', 'compare'], ['hows it goin need advice on grout', 'clarify'], ['sumthin to stick tiles to old tiles', 'pick'], ['ur products any good for a shed floor', 'pick'], ['wanna waterproof a laundry cheers', 'pick'], ['hey u there need help with the reno', 'social']];
for (const [q, c] of typ) add('typo', c, q, c === 'pick' ? { pick: 1 } : {});
// 5. comparisons (20): product names verified in core.json
const cmp = [['Sikaflex-11 FC+', 'SikaBond-142 Instant Nails'], ['Sikalastic-1K', 'Sikalastic-1 Komponent'], ['Davco PrimeX', 'Davco Ultraprime'], ['Sikaflex-111 Stick & Seal', 'Sikaflex-112 Crystal Clear'], ['Sikaflex-118 Extreme Grab', 'Sikaflex-116 High Grab'], ['SikaBond-145 SuperGrip', 'SikaBond-115 Max Tack'], ['Davco Easy Grout', 'Davco Sanitized Colorgrout'], ['Sikalastic-888', 'Sikalastic-777'], ['Davco Ceramacrete', 'Davco Ceramaflex'], ['SikaGrout HES', 'SikaGrout-300 PT AU'], ['SikaTile-410 Secure Set', 'SikaTile-510 Mega Lite'], ['Davco Grey One Pot adhesive', 'SikaTile-410 Secure Set'], ['Sikalastic-701', 'Sikalastic-851'], ['Davco Ultraflex', 'Davco Ceramaflex'], ['SikaTile-110 Secure Proof', 'Sikalastic-1K'], ['Davco K10 Plus', 'Sikalastic-1K'], ['Sikaflex-11 FC+', 'Sikaflex-111 Stick & Seal'], ['Davco Superfine White Grout', 'Davco Easy Grout'], ['Sikalastic-622 Excel Top PLUS', 'Sikalastic-488 (au)'], ['SikaBond-105 ContactFix', 'SikaBond-145 SuperGrip']];
cmp.forEach(([a, b], i) => add('compare', 'compare', i % 2 ? `difference between ${a} and ${b}` : `${a} vs ${b}`, { products: 2 }));
// 6. quantities (20)
const qty = ['how much Sikalastic-1K for 12 m2', 'how much Davco Grey One Pot adhesive do I need for 20 m2 of tiles', 'coverage of Sikaflex-11 FC+ per cartridge', 'how many cartridges of Sikaflex-11 FC+ for 30 metres of joint', 'how much SikaTile-410 Secure Set for 8 m2', 'how many pails of Davco K10 Plus for 15 m2', 'how much primer for 40 m2 slab', 'how much floor leveller for 25 m2 at 5 mm', 'litres of Sikalastic-1 Komponent for a 6 m2 balcony', 'how many bags of SikaGrout HES for a 1 m2 baseplate', 'how much membrane do I need for a 3 by 4 bathroom floor', 'how many tubes of SikaBond-142 Instant Nails for 10 skirting boards', 'I have 50 m2 of floor, how much adhesive', 'how much Davco Easy Grout for 10 m2 of 600x600 tiles', 'what area does a 20 litre pail of Sikalastic-1K cover', 'how many coats and how much for 18 m2 of Sikalastic-777', 'how much Davco PrimeX for 35 m2', 'how much would I need for 12 m2', 'quantity of Davco Ceramacrete for 9 m2', 'how much adhesive for 5 sqm of tiles'];
qty.forEach((q) => add('quantity', 'quantity', q, {}));
// 7. context follow-ups, 2 turns (30)
const fu = [
  [['what do you recommend for my bathroom', 'under tiles'], 'answer', { room: /bathroom|shower|wet|tile/i }],
  [['can you recommend a sealant', 'around the bath'], 'answer', { has: /bath|shower|wet/i }],
  [['garage floor', 'its cracked'], 'answer', { has: /crack|repair/i }],
  [['i need an adhesive', 'for skirting boards'], 'answer', { has: /skirting/i }],
  [['coverage of Davco Grey One Pot adhesive', 'what about outside'], 'answer', { has: /Davco Grey One Pot|outdoor|exterior|external/i }],
  [['best tile adhesive', 'cheaper one'], 'honest-no', {}],
  [['Sikaflex-11 FC+ cartridge', 'how long to dry'], 'answer', { has: /cure|skin|hours|Sikaflex-11/i }],
  [['Sikalastic-1K', 'how long to dry'], 'answer', { has: /dry|cure|hours|Sikalastic-1K/i }],
  [['Sikalastic-1K', 'and the sds'], 'answer', { has: /safety|sds/i }],
  [['Sikalastic-1K', 'what about for 12 m2'], 'quantity', {}],
  [['Davco Grey One Pot adhesive', 'same for 20 m2'], 'quantity', {}],
  [['what do you recommend for a balcony leak', 'the second one'], 'answer', {}],
  [['what do you recommend for a balcony leak', 'what about the first one'], 'answer', {}],
  [['recommend a floor leveller', 'and in a pail'], 'answer', {}],
  [['recommend a tile adhesive', 'can you pick one for me'], 'pick', { pick: 1 }],
  [['bathroom', 'you pick'], 'pick', { pick: 1, room: /bathroom|shower|wet|tile/i }],
  [['kitchen', 'splashback'], 'answer', { room: /kitchen|splashback/i }],
  [['shower', 'its leaking'], 'answer', { room: /shower/i }],
  [['balcony', 'tiles on it'], 'answer', { room: /balcony|tile/i }],
  [['pool', 'tiles around it'], 'answer', { room: /pool|tile/i }],
  [['roof', 'metal roof leaking'], 'answer', { room: /roof/i }],
  [['best sealant for a shower', 'thanks mate'], 'social', {}],
  [['best sealant for a shower', 'what about for outside'], 'answer', {}],
  [['Sikaflex-11 FC+ vs SikaBond-142 Instant Nails', 'which is cheaper'], 'honest-no', {}],
  [['Sikaflex-11 FC+ vs SikaBond-142 Instant Nails', 'which one for timber'], 'answer', {}],
  [['waterproofing membrane for a bathroom', 'how many coats'], 'answer', { has: /coat/i }],
  [['waterproofing membrane for a bathroom', 'how long before I can tile'], 'answer', { has: /hour|day|cure|dry|tile/i }],
  [['tile adhesive for outdoor tiles', 'what primer under it'], 'answer', { has: /prim/i }],
  [['i need sumthing for the deck', 'its timber'], 'answer', { room: /deck|timber/i }],
  [['concrete floor', 'peeling paint on it'], 'answer', { room: /floor|concrete/i }],
];
fu.forEach(([t, c, p]) => add('followup', c, t, p));
// 40 multi-turn scripts (2-4 turns)
const sc = [
  [['hello', 'i need to waterproof my bathroom', 'under the tiles', 'thanks'], 'social', {}],
  [['hi', 'balcony', 'there is a leak at the door', 'which product'], 'pick', { pick: 1, room: /balcony|leak|waterproof|membrane/i }],
  [['kitchen', 'splashback tiles', 'what adhesive'], 'answer', { room: /tile|adhesive/i }],
  [['garage floor', 'its cracked and broken', 'how much for 30 m2'], 'quantity', {}],
  [['bathroom', 'waterproofing', 'shower floor', 'you pick'], 'pick', { pick: 1 }],
  [['i need a sealant', 'shower or bath', 'which is best'], 'pick', { pick: 1 }],
  [['recommend a floor leveller', 'for 25 m2', 'at 5 mm'], 'quantity', {}],
  [['Davco Grey One Pot adhesive', 'coverage', 'for 20 m2'], 'quantity', {}],
  [['Sikaflex-11 FC+', 'pot life', 'and cure time', 'sds'], 'answer', { has: /safety|sds/i }],
  [['Sikalastic-1K', 'Sikalastic-1 Komponent', 'which one is better for a balcony'], 'compare', {}],
  [['u there', 'need sumthing for a leaky shower', 'tiled walls'], 'answer', { room: /shower|wall|tile/i }],
  [['deck', 'timber', 'sealer for it'], 'answer', { room: /deck|timber/i }],
  [['pool', 'tile adhesive', 'which one is best'], 'pick', { pick: 1 }],
  [['roof', 'its leaking', 'metal'], 'answer', { room: /roof|leak|metal/i }],
  [['best adhesive for timber', 'to concrete', 'indoors'], 'answer', { room: /timber|concrete/i }],
  [['laundry', 'waterproofing', 'how many coats'], 'answer', { has: /coat/i }],
  [['hey mate', 'what can you do', 'ok recommend a grout'], 'clarify', {}],
  [['driveway', 'cracks', 'repair mortar', 'how much for 4 m2'], 'quantity', {}],
  [['wet area', 'tiles', 'adhesive', 'thanks cheers'], 'social', {}],
  [['concrete slab', 'primer', 'for tiling'], 'answer', { room: /slab|concrete|prim/i }],
  [['stairs', 'concrete steps are chipped', 'what repair product'], 'answer', { room: /step|stair|concrete|repair/i }],
  [['window', 'sealant', 'outside'], 'answer', { room: /window|sealant/i }],
  [['fence', 'concrete posts', 'anchor'], 'answer', {}],
  [['Davco PrimeX', 'vs Davco Ultraprime', 'which one for a slab'], 'compare', {}],
  [['what is best for a balcony', 'and for a bathroom'], 'pick', { pick: 1, room: /bathroom|wet|shower|waterproof/i }],
  [['shed', 'concrete floor', 'dusty', 'what fixes it'], 'answer', { room: /floor|concrete|dust/i }],
  [['bathroom', 'tiles are lifting', 'what adhesive should I use'], 'answer', { room: /tile|adhesive|bathroom/i }],
  [['kitchen', 'sealant', 'cheaper one'], 'honest-no', {}],
  [['I am a tradie, need fast set adhesive', 'for floor tiles', '20 m2'], 'quantity', {}],
  [['bath', 'it leaks at the edge', 'which silicone'], 'answer', { room: /bath|silicone|sealant/i }],
  [['basement', 'damp walls', 'what do I use'], 'answer', { room: /basement|damp|wall|waterproof/i }],
  [['you are useless', 'bathroom', 'shower'], 'answer', { room: /shower|bathroom/i }],
  [['what can you do', 'tiles', 'floor tiles', 'large format'], 'answer', { room: /tile|floor/i }],
  [['patio', 'pavers', 'adhesive for pavers', 'how much for 15 m2'], 'quantity', {}],
  [['skylight', 'leaks', 'sealant'], 'answer', { room: /skylight|leak|sealant/i }],
  [['water tank', 'repair', 'concrete'], 'answer', { room: /tank|concrete|repair/i }],
  [['Sikaflex-11 FC+', 'price', 'is it in stock near me'], 'honest-no', {}],
  [['kitchen bench', 'glue laminate', 'contact adhesive'], 'answer', { room: /laminate|bench|contact|adhesive/i }],
  [['retaining wall', 'cracks', 'inject'], 'answer', { room: /wall|crack/i }],
  [['balcony', 'tiles', 'waterproof first', 'the second one'], 'answer', { room: /balcony|tile|waterproof/i }],
];
sc.forEach(([t, c, p]) => add('script', c, t, p));
const counts = {}; rows.forEach((r) => { counts[r.cat] = (counts[r.cat] || 0) + 1; });
const out = { schema: 'sika-convo-bank@1', generated: '2026-11-02', note: 'Product names verified in public/demo/sika-210c0c/data/brain/core.json. No product ids are asserted as truth. See gen_convo_bank.mjs for the property vocabulary.', counts, rows };
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'convo_bank.json'), JSON.stringify(out, (k, v) => (v instanceof RegExp ? v.source : v), 1) + '\n');
console.log(JSON.stringify(counts), rows.length);
