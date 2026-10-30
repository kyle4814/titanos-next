// bank_src.mjs: builds bank.json, the question bank for answer coverage (hand-written questions plus questions derived from the published data).
// Every question carries a persona, a category and an expected-answer type. Derived questions take their expected text from the data, never from the assistant.
//   node demo-tests/sika-brain/coverage/bank_src.mjs     writes bank.json next to this file
// Types: product, describe, best, list, compare, compat, attr, rate, time, calc, doc, business, nodata, oos
// exp.allowed / exp.deny are selectors over products: c:<category substring>, n:<regex on id and name>, i:<id>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = process.env.SIKA_PORTAL || path.join(HERE, '..', '..', '..', 'public', 'demo', 'sika-210c0c');
const rd = (rel) => JSON.parse(fs.readFileSync(path.join(PORTAL, rel), 'utf8'));
const products = rd('data/products.json');
const shard = (id) => rd('data/brain/p/' + id + '.json');
const clean = (s) => String(s || '').replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim();
const plainName = (p) => clean(p.name).replace(/^Sika\s+(?=\S)/, 'Sika ');
const P = { T: 'tiler', B: 'builder', C: 'concreter', W: 'waterproofer', S: 'specifier', D: 'distributor', H: 'diy home owner', X: 'sika counter staff' };
const bank = [];
const add = (persona, category, q, type, exp = {}) => bank.push({ persona: P[persona], category, q, type, exp });
const TILE_ADH = ['c:tile-stone-installationsystems/tile-adhesives', 'i:sikaceram-880-easyepoxy'];
const LEVEL = ['i:sikafloor-4020-fiberlevel,sikafloor-level-pro,sikafloor-level-top,sikafloor-level-ultra,sikafloor-level-eco,lanko-189-bulk-fillscreed,sikafloor-215-rapidscreed,lanko-145-floor-leveller,lanko-173-floor-leveller,sikafloor-050-rampandpatch,s-level-skimcoat'];
const TILEWP = ['c:tile-stone-installationsystems/waterproofing', 'i:sikaceram-sealingmembranea,sikalastic-1k,sikalastic-1-komponent,sikatile-111-rapidproof,sikalastic-moistureseal,sika-sealtape-b,sika-sealtape-f,sikalastic-488-au'];
const GROUT = ['c:tile-stone-installationsystems/tile-grouts'];
const SEALSAN = ['c:sealants-adhesives/sanitary-sealants', 'i:sikasil-pool'];

// ---- tiler
add('T', 'tile adhesive', "what's the best adhesive for large format tiles", 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'best tile adhesive for porcelain on a concrete floor inside', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'what adhesive do i use for natural stone', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'which adhesive for tiling over existing tiles', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'tile adhesive for an outdoor balcony', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'what glue for mosaic tiles in a pool', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'fast setting tile adhesive so i can grout same day', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'adhesive for tiles on a heated floor', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'dustless tile adhesive', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'whats a good adhesive for glass mosaic', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'tile adhesive for walls in a wet area on plasterboard', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'which adhesive for tiling onto timber floor', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'best adhesive for tiling a commercial floor', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'tile adhesive for brick slips', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'what adhesive for 1200x600 porcelain on a wall', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'lightweight adhesive for large tiles on walls that wont slump', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'tile adhesive with a long open time for hot weather', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'which tile adhesives does sika make', 'list', { allowed: TILE_ADH, min: 5 });
add('T', 'tile adhesive', 'list all davco adhesives', 'list', { allowed: ['i:davco-sanitized-gluegrout,davco-grey-one-potadhesive,davco-trojan-mastic,davco-supamastic,davco-powder-mastic,davco-ultraflex,davco-ceramacrete,davco-ceramaflex,davco-smp-evo'], min: 4 });
add('T', 'tile adhesive', 'Can I use Davco Grey One Pot over my old tiles?', 'compat', { product: 'davco-grey-one-potadhesive', verdict: 'no' });
add('T', 'tile adhesive', 'is davco ultraflex ok for underfloor heating', 'compat', { product: 'davco-ultraflex', verdict: 'any' });
add('T', 'tile adhesive', 'sikatile 400 evo pro vs sikatile 410 secure set', 'compare', { products: ['sikatile-400-evopro', 'sikatile-410-secureset'] });
add('T', 'tile adhesive', 'difference between davco trojan mastic and davco powder mastic', 'compare', { products: ['davco-trojan-mastic', 'davco-powder-mastic'] });
add('T', 'tile adhesive', 'compare sikatile 305 masterlite and sikatile 510 megalite', 'compare', { products: ['sikatile-305-masterlite', 'sikatile-510-megalite'] });
add('T', 'tile adhesive', 'tell me about sikatile 366 proflex', 'product', { products: ['sikatile-366-proflex'] });
add('T', 'tile adhesive', 'what is davco supamastic', 'product', { products: ['davco-supamastic'] });
add('T', 'tile adhesive', 'whats the davco ceramacrete for', 'product', { products: ['davco-ceramacrete'] });
add('T', 'tile adhesive', 'sikatile 374 megapro', 'product', { products: ['sikatile-374-megapro'] });
add('T', 'tile adhesive', 'sika tile 440 opti cure what is it', 'product', { products: ['sikatile-440-opti-cure'] });
add('T', 'tile adhesive', 'davco smp evo what does it do', 'product', { products: ['davco-smp-evo'] });
add('T', 'tile adhesive', 'how many bags of sikatile 400 evo pro for 30 m2', 'calc', { product: 'sikatile-400-evopro' });
add('T', 'tile adhesive', 'how much adhesive do i need for 15 square metres of 600x600 tiles', 'best', { allowed: TILE_ADH });
add('T', 'tile adhesive', 'what trowel size for large format tiles', 'best', { allowed: TILE_ADH });
add('T', 'grout', 'what grout for a shower floor', 'best', { allowed: GROUT });
add('T', 'grout', 'epoxy grout for a commercial kitchen', 'best', { allowed: GROUT });
add('T', 'grout', 'best grout for wide joints', 'best', { allowed: GROUT });
add('T', 'grout', 'white grout that wont stain', 'best', { allowed: GROUT.concat(['c:tile-care-and-cleaners']) });
add('T', 'grout', 'grout for a swimming pool', 'best', { allowed: GROUT });
add('T', 'grout', 'what grouts does davco make', 'list', { allowed: GROUT, min: 4 });
add('T', 'grout', 'how do i rejuvenate old grout', 'best', { allowed: ['i:davco-rejuvenationgrout', 'c:tile-care-and-cleaners'] });
add('T', 'grout', 'how do i clean tile grout', 'best', { allowed: ['i:davco-rejuvenationgrout', 'c:tile-care-and-cleaners'] });
add('T', 'grout', 'grout sealer for a bathroom', 'best', { allowed: ['i:davco-rejuvenationgrout', 'c:tile-care-and-cleaners'] });
add('T', 'grout', 'sikaceram 880 easy epoxy', 'product', { products: ['sikaceram-880-easyepoxy'] });
add('T', 'grout', 'what is davco easy grout', 'product', { products: ['davco-easy-grout'] });
add('T', 'grout', 'davco sanitized glue grout what is it', 'product', { products: ['davco-sanitized-gluegrout'] });
add('T', 'additive', 'additive to make my tile adhesive more flexible', 'best', { allowed: ['i:davco-davelastic,davco-4-in-1-groutadditive'] });
add('T', 'additive', 'primer for tiling over smooth concrete', 'best', { allowed: ['i:sikatile-010-secureprime,davco-ultraprime,davco-primex,sikafloor-01-primer,sikafloor-08-primer,lanko-124-ultraprime'] });
add('T', 'additive', 'what does davco 4 in 1 grout additive do', 'product', { products: ['davco-4-in-1-groutadditive'] });
add('T', 'additive', 'cement accelerator for tile adhesive in cold weather', 'best', { allowed: ['i:lanko-302-cementaccelerator'] });
add('T', 'waterproofing', 'best waterproofing for a shower', 'best', { allowed: TILEWP });
add('T', 'waterproofing', 'what membrane goes under tiles in a bathroom floor', 'best', { allowed: TILEWP });
add('T', 'waterproofing', 'waterproofing for a balcony under tiles', 'best', { allowed: TILEWP });
add('T', 'waterproofing', 'quick drying waterproofing membrane for a wet area', 'best', { allowed: TILEWP });
add('T', 'waterproofing', 'waterproofing for a swimming pool before tiling', 'best', { allowed: TILEWP });
add('T', 'waterproofing', 'what waterproofing for a laundry', 'best', { allowed: TILEWP });
add('T', 'waterproofing', 'waterproofing membrane for a large commercial wet area', 'best', { allowed: TILEWP });
add('T', 'waterproofing', 'how many coats of davco k10 plus', 'rate', { product: 'davco-k10-plus' });
add('T', 'waterproofing', 'how long does k10 rapid take to dry before tiling', 'time', { product: 'davco-k10-rapid' });
add('T', 'waterproofing', 'what is sikatile 110 secure proof', 'product', { products: ['sikatile-110-secureproof'] });
add('T', 'waterproofing', 'sika sealtape for corners in a shower', 'best', { allowed: ['i:s-sealtape-f,s-sealtape-b,sikaproof-tape-a-plus,sikadur-combiflexsg-10p'] });
add('T', 'sealant', 'what silicone for a shower', 'best', { allowed: SEALSAN });
add('T', 'sealant', 'best sealant for a kitchen and bathroom', 'best', { allowed: SEALSAN });
add('T', 'sealant', 'silicone for a swimming pool', 'best', { allowed: SEALSAN });
add('T', 'sealant', 'mould resistant silicone for tiles', 'best', { allowed: SEALSAN });
// ---- builder
add('B', 'screed', "what's the best screed for a big job", 'best', { allowed: LEVEL });
add('B', 'screed', 'best screed for a large area', 'best', { allowed: LEVEL });
add('B', 'screed', 'which screed can be pumped', 'best', { allowed: LEVEL });
add('B', 'screed', 'fast drying screed so we can lay flooring in a few days', 'best', { allowed: LEVEL });
add('B', 'screed', 'best self levelling compound for a whole floor', 'best', { allowed: LEVEL });
add('B', 'screed', 'screed for a thick build up over 30mm', 'best', { allowed: LEVEL });
add('B', 'screed', 'leveller for old uneven concrete', 'best', { allowed: LEVEL });
add('B', 'screed', 'cheapest levelling compound', 'nodata', {});
add('B', 'screed', 'external screed that can go outdoors', 'best', { allowed: LEVEL });
add('B', 'screed', 'smoothing compound for timber floors', 'best', { allowed: LEVEL });
add('B', 'screed', 'floor leveller under vinyl planks', 'best', { allowed: LEVEL });
add('B', 'screed', 'what screeds does sika make', 'list', { allowed: LEVEL, min: 4 });
add('B', 'screed', 'what is a cement levelling system', 'business', { url: 'cement-levellingsystems', must: 'cement-based underlayment' });
add('B', 'screed', 'how do i prime concrete before a leveller', 'best', { allowed: ['i:sikafloor-01-primer,sikafloor-08-primer,sikafloor-level-proprimer,sikafloor-14-prepnprimeimpact,lanko-124-ultraprime,sikafloor-158-wfastbarrier'] });
add('B', 'screed', 'ramp and patch mortar for a loading dock', 'best', { allowed: ['i:sikafloor-050-rampandpatch,lanko-189-bulk-fillscreed,sikafloor-215-rapidscreed,lanko-136-rapid-patchingmortar'] });
add('B', 'screed', 'tell me about sikafloor level pro', 'product', { products: ['sikafloor-level-pro'] });
add('B', 'screed', 'sikafloor level ultra', 'product', { products: ['sikafloor-level-ultra'] });
add('B', 'screed', 'what is lanko 189 bulk fill screed', 'product', { products: ['lanko-189-bulk-fillscreed'] });
add('B', 'screed', 'sikafloor 215 rapid screed what is it for', 'product', { products: ['sikafloor-215-rapidscreed'] });
add('B', 'screed', 'how many bags of sikafloor level pro for 100 m2 at 5mm', 'calc', { product: 'sikafloor-level-pro' });
add('B', 'screed', 'pot life of sikafloor level pro', 'time', { product: 'sikafloor-level-pro' });
add('B', 'screed', 'compare level pro and level top', 'compare', { products: ['sikafloor-level-pro', 'sikafloor-level-top'] });
add('B', 'screed', 'can sikafloor level ultra go on external concrete', 'compat', { product: 'sikafloor-level-ultra', verdict: 'any' });
add('B', 'adhesive', 'what adhesive for fixing timber flooring', 'best', { allowed: ['c:flooring/flooring-adhesivessystems', 'c:sealants-adhesives/construction-adhesives'] });
add('B', 'adhesive', 'what is the best construction adhesive for fixing skirting boards', 'best', { allowed: ['c:sealants-adhesives/construction-adhesives', 'c:sealants-adhesives/foam-sealants-adhesives'] });
add('B', 'adhesive', 'glue to stick a shower screen frame', 'best', { allowed: ['c:sealants-adhesives'] });
add('B', 'adhesive', 'adhesive that replaces nails', 'best', { allowed: ['c:sealants-adhesives/construction-adhesives'] });
add('B', 'adhesive', 'sikabond instant nails', 'product', { products: ['sikabond-142-instantnails', 'sikabond-instantnailsfast'] });
add('B', 'adhesive', 'spray contact adhesive for laminate', 'best', { allowed: ['c:sealants-adhesives/contact-adhesives'] });
add('B', 'adhesive', 'foam to fill gaps around windows', 'best', { allowed: ['c:sealants-adhesives/foam-sealants-adhesives', 'c:sealants-adhesives/passive-fire-protection'] });
add('B', 'adhesive', 'can i paint over sikaflex 11 fc', 'compat', { product: 'sikaflex-11-fc-purform', alt: ['1671'], verdict: 'any' });
add('B', 'sealant', 'best sealant for expansion joints in a facade', 'best', { allowed: ['c:sealants-adhesives/expansion-perimeterjoints', 'c:sealants-adhesives/facade-sealants', 'c:sealants-adhesives/curtain-walling'] });
add('B', 'sealant', 'fire rated sealant for service penetrations', 'best', { allowed: ['c:sealants-adhesives/passive-fire-protection', 'c:sealants-adhesives/facade-sealants', 'i:sikaflex-400-fire,sikasil-670-fire'] });
add('B', 'sealant', 'gutter sealant', 'best', { allowed: ['i:sikaseal-roof-gutter', 'c:sealants-adhesives/roofing-sealantsadhesives'] });
add('B', 'sealant', 'what sealant for filling cracks before painting', 'best', { allowed: ['c:sealants-adhesives/paint-preparation'] });
add('B', 'sealant', 'sikaflex pro 3 purform what is it', 'product', { products: ['sikaflex-pro-3-purform'] });
add('B', 'sealant', 'how long does sikaflex pro plus take to skin over', 'time', { product: 'sikaflex-pro-plus' });
add('B', 'sealant', 'backing rod for a 10mm joint', 'best', { allowed: ['c:sealants-adhesives/backing-rod-foamtapes'] });
add('B', 'sealant', 'sealant for a fish tank', 'best', { allowed: ['i:sikaseal-401-aquarium'] });
add('B', 'sealant', 'what sealants does sika make', 'list', { allowed: ['c:sealants-adhesives'], min: 5 });
add('B', 'concrete repair', 'repair mortar for spalling concrete', 'best', { allowed: ['c:concrete-repair-protection/concrete-repair-mortars', 'c:concrete-repair-protection/corrosion', 'c:concrete-repair-protection/concrete-mortarsadmixtures'] });
add('B', 'concrete repair', 'fast setting mortar to plug a leak', 'best', { allowed: ['i:s-plug,sikaquick-2500-au,lanko-136-rapid-patchingmortar,s-monotop-723n,s-monotop-fc,davco-jetcrete', 'c:waterproofing/injections'] });
add('B', 'concrete repair', 'epoxy for crack injection or bonding old concrete to new', 'best', { allowed: ['c:concrete-repair-protection', 'c:structural-strengthening/structural-adhesives', 'c:waterproofing/injections'] });
add('B', 'concrete repair', 'bonding agent for new render to old concrete', 'best', { allowed: ['i:lanko-752-bondit,lanko-751-lankolatexsbr,s-monotop-910n,sikadur-32-lp,s-concrete-fix,sikadur-33', 'c:concrete-repair-protection/concrete-repair-mortars/epoxy'] });
add('B', 'concrete repair', 'what is sika monotop 412 nfg', 'product', { products: ['sika-monotop-412nfg', 's-monotop-412nfg'] });
add('B', 'concrete repair', 'what is sikadur 31', 'product', { products: ['sikadur-31-cf-normal'] });
add('B', 'anchoring', 'chemical anchor for fixing into concrete', 'best', { allowed: ['c:grouts-anchoring/chemical-anchoring', 'c:sealants-adhesives/anchoring-adhesives'] });
add('B', 'anchoring', 'grout for under a base plate', 'best', { allowed: ['c:grouts-anchoring'] });
add('B', 'anchoring', 'non shrink grout for bolts', 'best', { allowed: ['c:grouts-anchoring'] });
add('B', 'anchoring', 'underwater grout', 'best', { allowed: ['c:grouts-anchoring'] });
add('B', 'roofing', 'liquid applied waterproof membrane for a roof', 'best', { allowed: ['c:roofing', 'c:waterproofing/liquid-applied-membranes'] });
add('B', 'roofing', 'torch on membrane for a flat roof', 'best', { allowed: ['c:roofing/torch-on-sheet-membranes'] });
add('B', 'roofing', 'pvc roofing sheet', 'best', { allowed: ['c:roofing/pvc-sheet-membranes'] });
add('B', 'roofing', 'what is sarnafil g 410 20l', 'product', { products: ['sarnafil-g-410-20l'] });
add('B', 'roofing', 'what do you have for green roofs', 'best', { allowed: ['c:landscape-buildingproducts/green-roofs'] });
add('B', 'roofing', 'paver pedestals for a roof terrace', 'best', { allowed: ['c:landscape-buildingproducts/paving-decking-support'] });
add('B', 'flooring', 'epoxy floor coating for a garage', 'best', { allowed: ['c:flooring/resin-flooring'] });
add('B', 'flooring', 'resin floor for a food processing area', 'best', { allowed: ['c:flooring/resin-flooring'] });
add('B', 'flooring', 'anti static floor for an electronics room', 'best', { allowed: ['c:flooring/resin-flooring'] });
add('B', 'flooring', 'polyurethane floor for a car park deck', 'best', { allowed: ['c:flooring/resin-flooring', 'c:waterproofing'] });
add('B', 'flooring', 'floor joint filler for warehouse floors', 'best', { allowed: ['c:flooring/floor-joints'] });
add('B', 'flooring', 'what is sikafloor 264', 'product', { products: ['sikafloor-264'] });
add('B', 'flooring', 'what flooring resins does sika make', 'list', { allowed: ['c:flooring/resin-flooring'], min: 5 });
// ---- concreter
add('C', 'admixture', 'what admixture for self compacting concrete', 'best', { allowed: ['c:concrete/admixture-technology', 'c:concrete/fibres'] });
add('C', 'admixture', 'superplasticiser for high strength concrete', 'best', { allowed: ['c:concrete/admixture-technology/high-range', 'c:concrete/admixture-technology/water-reducers', 'c:concrete/admixture-technology/mid-range'] });
add('C', 'admixture', 'what to add to concrete to slow the set in hot weather', 'best', { allowed: ['c:concrete/admixture-technology/retarders', 'c:concrete/admixture-technology/water-reducers', 'c:concrete/admixture-technology/mid-range', 'c:concrete/admixture-technology/evaporation-retarders'] });
add('C', 'admixture', 'accelerator for shotcrete', 'best', { allowed: ['c:concrete/admixture-technology/concrete-accelerators', 'c:concrete/tunneling'] });
add('C', 'admixture', 'air entraining agent for concrete', 'best', { allowed: ['c:concrete/pre-cast/air-entraining-admixtures'] });
add('C', 'admixture', 'fibres to stop plastic shrinkage cracking', 'best', { allowed: ['c:concrete/fibres'] });
add('C', 'admixture', 'macro fibre for slab on ground', 'best', { allowed: ['c:concrete/fibres'] });
add('C', 'admixture', 'concrete colour pigment', 'best', { allowed: ['i:sikacolor-flo'] });
add('C', 'admixture', 'surface retarder for exposed aggregate', 'best', { allowed: ['c:concrete/specialty-products/surface-retarders'] });
add('C', 'admixture', 'shrinkage reducing admixture', 'best', { allowed: ['i:sikacontrol-plus', 'c:concrete/specialty-products/shrinkage'] });
add('C', 'admixture', 'release agent for precast moulds', 'best', { allowed: ['c:concrete/pre-cast/release-agents'] });
add('C', 'admixture', 'what is sika viscocrete 10', 'product', { products: ['sika-viscocrete-10', 's-viscocrete-10'] });
add('C', 'admixture', 'what dosage of sikament eco 3 w', 'rate', { product: 'sikament-eco-3-w' });
add('C', 'admixture', 'how much sika viscocrete 1250 per cubic metre', 'rate', { product: 'sika-viscocrete-1250' });
add('C', 'admixture', 'what admixtures does sika make for concrete', 'list', { allowed: ['c:construction/concrete/'], min: 5 });
add('C', 'curing', 'curing compound for a new slab', 'best', { allowed: ['i:sika-film,s-film,sikafloor-curehard-24', 'c:concrete/admixture-technology/evaporation-retarders'] });
add('C', 'curing', 'how do i stop a slab drying too fast in wind', 'best', { allowed: ['c:concrete/admixture-technology/evaporation-retarders', 'i:s-film'] });
// ---- waterproofer
add('W', 'waterproofing', 'best waterproofing for a basement', 'best', { allowed: ['c:waterproofing', 'c:landscape-buildingproducts/subsoil'] });
add('W', 'waterproofing', 'liquid membrane for a roof deck that will be walked on', 'best', { allowed: ['c:waterproofing', 'c:roofing'] });
add('W', 'waterproofing', 'what do i use to stop a water leak in a concrete wall', 'best', { allowed: ['c:waterproofing', 'c:concrete-repair-protection', 'i:s-plug'] });
add('W', 'waterproofing', 'injection resin for leaking cracks', 'best', { allowed: ['c:waterproofing/injections'] });
add('W', 'waterproofing', 'hydrophilic waterstop for a construction joint', 'best', { allowed: ['c:waterproofing/injections', 'c:waterproofing/66807', 'c:waterproofing/basement'] });
add('W', 'waterproofing', 'bentonite waterproofing', 'best', { allowed: ['i:sikaproof-bentonite,sikaproof-bentonitepowder,sikaproof-bentonitepaste'] });
add('W', 'waterproofing', 'bridge deck waterproofing', 'best', { allowed: ['c:waterproofing/bridge-deck', 'i:sikalastic-827-ht'] });
add('W', 'waterproofing', 'spray applied waterproofing membrane', 'best', { allowed: ['c:waterproofing/spray-applied'] });
add('W', 'waterproofing', 'waterproofing for a tunnel', 'best', { allowed: ['c:waterproofing'] });
add('W', 'waterproofing', 'one coat cementitious waterproof coating for a water tank', 'best', { allowed: ['c:waterproofing', 'c:concrete-repair-protection'] });
add('W', 'waterproofing', 'what is sikalastic 1k', 'product', { products: ['sikalastic-1k'] });
add('W', 'waterproofing', 'what is sikalastic 851', 'product', { products: ['sikalastic-851'] });
add('W', 'waterproofing', 'how long before recoating sikalastic 488', 'time', { product: 'sikalastic-488-au' });
add('W', 'waterproofing', 'coverage of sikalastic 8902', 'rate', { product: 'sikalastic-8902' });
add('W', 'waterproofing', 'can sikalastic 1k be used in a pool', 'compat', { product: 'sikalastic-1k', verdict: 'any' });
add('W', 'waterproofing', 'what waterproofing membranes does sika make', 'list', { allowed: ['c:waterproofing', 'c:tile-stone-installationsystems/waterproofing'], min: 5 });
// ---- specifier
add('S', 'specification', 'specification clause for sikafloor level pro', 'doc', { product: 'sikafloor-level-pro' });
add('S', 'specification', 'do you have a specification for davco k10 plus', 'doc', { product: 'davco-k10-plus' });
add('S', 'specification', 'does sikaflex pro 3 meet any australian standard', 'attr', { product: 'sikaflex-pro-3-purform', label: 'standard' });
add('S', 'specification', 'epd for sikafloor level pro', 'doc', { product: 'sikafloor-level-pro' });
add('S', 'specification', 'bim objects for sika products', 'business', { url: 'sika-bim', must: 'BIM' });
add('S', 'specification', 'what is BIM and why does sika offer it', 'business', { url: 'what-is-bim|benefits-of-bim|sika-bim', must: 'BIM' });
add('S', 'specification', 'anchor calculation software', 'business', { url: 'anchorfix-calculation-software', must: 'software' });
add('S', 'specification', 'carbon fibre design software', 'business', { url: 'carbodur-frp-design-software', must: 'software' });
add('S', 'specification', 'which products are green star certified', 'business', { url: 'aus.sika.com', must: 'Green Star' });
add('S', 'specification', 'low voc products', 'business', { url: 'aus.sika.com', must: 'VOC' });
add('S', 'specification', 'sika solutions for large projects', 'business', { url: 'solutions-for-projects', must: 'project' });
add('S', 'specification', 'does sika offer a global project management team', 'business', { url: 'solutions-for-projects', must: 'Project Management' });
add('S', 'specification', 'sika remedial solutions for old concrete buildings', 'business', { url: 'Remedial-Solutions', must: 'remedial' });
add('S', 'specification', 'does sika have local project references', 'business', { url: 'local-projects', must: '' });
add('S', 'specification', 'carbon fibre strengthening for a beam', 'best', { allowed: ['c:structural-strengthening'] });
add('S', 'specification', 'structural adhesive for bonding plates', 'best', { allowed: ['c:structural-strengthening', 'c:concrete-repair-protection/concrete-repair-mortars/epoxy'] });
add('S', 'specification', 'what is sikadur 30', 'product', { products: ['sikadur-30'] });
add('S', 'specification', 'sika carbodur s', 'product', { products: ['sika-carbodur-s', 's-carbodur-s'] });
// ---- distributor and counter staff
add('D', 'product data', 'where do i find the safety data sheet for sikaflex 11 fc', 'doc', { product: 'sikaflex-11-fc-purform', alt: ['1671'] });
add('D', 'product data', 'pds for davco grey one pot', 'doc', { product: 'davco-grey-one-potadhesive' });
add('D', 'product data', 'sds for sikafloor level pro', 'doc', { product: 'sikafloor-level-pro' });
add('D', 'product data', 'what size does sika level pro come in', 'attr', { product: 'sikafloor-level-pro', label: 'packag' });
add('D', 'product data', 'pallet quantity for davco ultraflex', 'attr', { product: 'davco-ultraflex', label: 'packag' });
add('D', 'product data', 'how many bags on a pallet of sikatile 400 evo pro', 'attr', { product: 'sikatile-400-evopro', label: 'packag' });
add('D', 'product data', 'shelf life of sikaflex 11 fc', 'attr', { product: 'sikaflex-11-fc-purform', alt: ['1671'], label: 'shelf life' });
add('D', 'business', 'where can i buy sika products', 'business', { url: 'where-to-buy', must: '' });
add('D', 'business', 'where do i find a sikatile stockist', 'business', { url: 'where-to-buy|SikaTile-distributors|stockist', must: '' });
add('D', 'business', 'how do i become a sika distributor', 'business', { url: 'contact', must: '', nodata: true });
add('D', 'business', 'is there a b2b online shop for trade customers', 'business', { url: 'b2b-e-shop', must: '' });
add('D', 'business', 'what is the price of sikaflex 11 fc', 'nodata', {});
add('D', 'business', 'do you have stock of sikafloor level pro', 'nodata', {});
add('D', 'business', 'trade discount on davco', 'nodata', {});
add('D', 'business', 'minimum order quantity', 'nodata', {});
add('D', 'business', 'delivery time for sika products', 'nodata', {});
add('X', 'business', 'whats the head office address', 'business', { url: 'imprint', must: 'Wetherill Park' });
add('X', 'business', 'phone number for sika australia', 'business', { url: 'imprint|contact', must: '9725' });
add('X', 'business', 'fax number', 'business', { url: 'imprint', must: '9725' });
add('X', 'business', 'how do i contact sika technical services', 'business', { url: 'contact|Contact', must: '' });
add('X', 'business', 'who do i call for a technical question', 'business', { url: 'contact|Contact|imprint', must: '' });
add('X', 'business', 'is there a technical help line', 'business', { url: 'contact|Contact|imprint', must: '' });
add('X', 'business', 'how do i get a warranty for a tiling job', 'business', { url: 'warranty-portal', must: 'warrant' });
add('X', 'business', 'warranty for a project bigger than 100 square metres', 'business', { url: 'warranty-portal', must: '100' });
add('X', 'business', 'which products are covered by the instant warranty portal', 'business', { url: 'warranty-portal', must: 'Davco K10 Plus' });
add('X', 'business', 'how long is the warranty on sikatile products', 'nodata', {});
add('X', 'business', 'is davco part of sika', 'business', { url: 'davco', must: 'Sika' });
add('X', 'business', 'is davco the same company as sika', 'business', { url: 'davco', must: 'Sika' });
add('X', 'business', 'how long has davco been around', 'business', { url: 'davco', must: '1972' });
add('X', 'business', 'why did the davco bags change colour', 'business', { url: 'davco', must: 'yellow' });
add('X', 'business', 'has the davco formula changed with the new packaging', 'business', { url: 'davco', must: 'hasn' });
add('X', 'business', 'what is dust less technology', 'business', { url: 'davco|silica', must: 'dust' });
add('X', 'business', 'does sika offer training for tilers', 'business', { url: 'training|Undertile', must: '', nodata: true });
add('X', 'business', 'is there undertile waterproofing training', 'business', { url: 'Undertile-Waterproofing-training', must: '', nodata: true });
add('X', 'business', 'does sika have careers', 'business', { url: 'careers', must: '' });
add('X', 'business', 'who owns sika', 'nodata', {});
add('X', 'business', 'does sika have sustainability products', 'business', { url: 'aus.sika.com', must: 'Sustainab' });
add('X', 'business', 'what is sikas sustainable portfolio management', 'business', { url: 'aus.sika.com', must: 'Sustainable Portfolio' });
add('X', 'business', 'environmental product declarations', 'business', { url: 'aus.sika.com', must: 'Environmental' });
add('X', 'business', 'where do i find all the product data sheets', 'business', { url: 'pds|documents', must: '' });
add('X', 'business', 'where are the safety data sheets kept', 'business', { url: 'material-safety|documents', must: '' });
add('X', 'business', 'sealing and adhesive pre treatment chart', 'business', { url: 'pre-treatment', must: '' });
add('X', 'business', 'terms and conditions of sale', 'business', { url: 'terms-and-conditions', must: '' });
add('X', 'business', 'legal notice', 'business', { url: 'legal-notice', must: '' });
add('X', 'business', 'what does sika do for home owners', 'business', { url: 'home-owners', must: '' });
add('X', 'business', 'sika solutions for a bathroom diy', 'business', { url: 'diy-solutions-for-your-bathroom|home-owners', must: '' });
add('X', 'business', 'sika solutions for a kitchen', 'business', { url: 'diy-solutions-for-your-kitchen|home-owners', must: '' });
add('X', 'business', 'sika three must haves for builders', 'business', { url: '3-must-haves', must: '' });
add('X', 'business', 'does sika sell to the automotive industry', 'business', { url: 'industry/automotive', must: '' });
add('X', 'business', 'does sika make marine products', 'business', { url: 'industry/marine', must: '' });
add('X', 'business', 'what does sika do for wind farms', 'business', { url: 'wind-energy|windfarm', must: '' });
// ---- DIY home owner
add('H', 'diy', 'how do i fix a leaking shower', 'business', { url: 'leaking-shower', must: 'shower' });
add('H', 'diy', 'how do i tile over old tiles in my laundry', 'business', { url: 'tile-over-tile', must: 'tile' });
add('H', 'diy', 'can i update my bathroom without a full renovation', 'business', { url: 'update-your-bathroom', must: '' });
add('H', 'diy', 'what do i use to glue a balustrade', 'business', { url: 'balustrade|3-must-haves|construction-adhesives', must: '' });
add('H', 'diy', 'how to replace a clothesline', 'business', { url: 'clothesline', must: '' });
add('H', 'diy', 'what sealant for around my bath', 'best', { allowed: SEALSAN });
add('H', 'diy', 'what glue for my concrete bird bath', 'best', { allowed: ['c:sealants-adhesives'] });
add('H', 'diy', 'something to stick tiles to a wall in my kitchen splashback', 'best', { allowed: TILE_ADH });
add('H', 'diy', 'i have a leaking shower what product fixes it', 'best', { allowed: TILEWP.concat(['c:sealants-adhesives', 'c:waterproofing']) });
add('H', 'diy', 'what can i use to seal cracks in my concrete driveway', 'best', { allowed: ['c:concrete-repair-protection', 'c:sealants-adhesives', 'c:flooring', 'c:waterproofing/injections'] });
add('H', 'diy', 'my floor is uneven before i lay vinyl what should i use', 'best', { allowed: LEVEL });
add('H', 'diy', 'how do i fill a gap between the bench and the wall', 'best', { allowed: ['c:sealants-adhesives'] });
add('H', 'diy', 'grout stained and mouldy how do i fix it', 'best', { allowed: ['i:davco-rejuvenationgrout,davco-tile-groutcleaner,davco-sanitized-tilegroutsealer', 'c:tile-stone-installationsystems/tile-grouts'] });
add('H', 'diy', 'what is sikaflex 11 fc used for', 'product', { products: ['sikaflex-11-fc-purform', '1671'] });
add('H', 'diy', 'is sikaflex 11 fc waterproof', 'compat', { product: 'sikaflex-11-fc-purform', alt: ['1671'], verdict: 'any' });
add('H', 'diy', 'sika showerbond what is it', 'product', { products: ['sika-showerbond', 's-showerbond'] });
add('H', 'diy', 'can i buy sika from bunnings', 'nodata', {});
add('H', 'diy', 'how much does a bag of tile adhesive cost', 'nodata', {});
add('H', 'diy', 'what temperature is too cold to use tile adhesive', 'best', { allowed: TILE_ADH });
// ---- out of scope and trick
add('H', 'out of scope', 'what is the weather today', 'oos', {});
add('H', 'out of scope', 'write me a poem', 'oos', {});
add('H', 'out of scope', 'is mapei better than davco', 'oos', {});
add('H', 'out of scope', 'which is cheaper sika or bostik', 'oos', {});
add('H', 'out of scope', 'can you recommend a good tiler in brisbane', 'oos', {});
add('H', 'out of scope', 'how do i lay a brick wall', 'nodata', {});
add('H', 'out of scope', 'asdf qwerty', 'oos', {});
add('X', 'out of scope', 'what is the meaning of life', 'oos', {});
add('X', 'out of scope', 'who won the footy', 'oos', {});
add('X', 'out of scope', 'tell me a joke', 'oos', {});
// ---- typos and plain language
add('H', 'typos', 'wats the best screed for a big joob', 'best', { allowed: LEVEL });
add('T', 'typos', 'bset adhesive for large format tyles', 'best', { allowed: TILE_ADH });
add('T', 'typos', 'waterprofing for shower floor', 'best', { allowed: TILEWP });
add('T', 'typos', 'davco grey one pott adhesive cure time', 'time', { product: 'davco-grey-one-potadhesive' });
add('T', 'typos', 'siakflex 11 fc colours', 'product', { products: ['sikaflex-11-fc-purform', '1671'] });
add('H', 'typos', 'sika levelling compund for floors', 'best', { allowed: LEVEL });
add('B', 'typos', 'sikafloor lvel pro sds', 'doc', { product: 'sikafloor-level-pro' });
add('H', 'typos', 'how do i waterproof my shower', 'best', { allowed: TILEWP });
add('H', 'typos', 'tile glue for floor', 'best', { allowed: TILE_ADH });
add('H', 'typos', 'what do i put down before tiles', 'best', { allowed: TILEWP.concat(['c:tile-stone-installationsystems/primers-additives', 'c:flooring/cement-levellingsystems']) });
add('B', 'typos', 'concerte repair mortar', 'best', { allowed: ['c:concrete-repair-protection'] });
add('B', 'typos', 'sealent for windows', 'best', { allowed: ['c:sealants-adhesives'] });

// ---- derived from the published data (expected text comes from the shards)
let seed = 20261031; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const typo = (s) => { const w = s.split(' '); const i = w.findIndex((x) => x.length > 6 && /^[a-z]+$/.test(x)); if (i < 0) return s; const x = w[i]; w[i] = x.slice(0, 3) + x.slice(4); return w.join(' '); };
const shards = products.map((p) => shard(p.id));
const personaOf = (p) => (/tile-stone/.test(p.category) ? 'T' : /concrete\//.test(p.category) || /concrete-repair/.test(p.category) ? 'C' : /waterproofing|roofing/.test(p.category) ? 'W' : /sealants|flooring|grouts/.test(p.category) ? 'B' : 'D');
const CATLABEL = (p) => p.category.split('/').slice(1, 3).join(' ');
const ATTRS = [
  { re: /^shelf life$/i, key: 'shelf life', ph: [(n) => `shelf life of ${n}`, (n) => `how long can i store ${n} unopened`, (n) => `how long does ${n} last in the shed`] },
  { re: /^storage conditions$/i, key: 'storage', ph: [(n) => `how should i store ${n}`, (n) => `storage conditions for ${n}`] },
  { re: /^density$/i, key: 'density', ph: [(n) => `density of ${n}`, (n) => `what does ${n} weigh per litre`] },
  { re: /^ambient air temperature$/i, key: 'temperature', ph: [(n) => `what air temperature can i apply ${n} in`, (n) => `minimum temperature to use ${n}`, (n) => `is it too cold to apply ${n}`] },
  { re: /^substrate temperature$/i, key: 'temperature', ph: [(n) => `substrate temperature limits for ${n}`] },
  { re: /^mixing ratio$/i, key: 'mixing ratio', ph: [(n) => `mix ratio for ${n}`, (n) => `how much water do i add to ${n}`] },
  { re: /^layer thickness$/i, key: 'thickness', ph: [(n) => `how thick can i apply ${n}`, (n) => `minimum and maximum thickness of ${n}`] },
  { re: /^service temperature$/i, key: 'temperature', ph: [(n) => `what temperature can ${n} take once cured`, (n) => `service temperature of ${n}`] },
  { re: /^compressive strength$/i, key: 'compressive', ph: [(n) => `compressive strength of ${n}`, (n) => `how strong is ${n} in compression`] },
  { re: /^tensile strength$/i, key: 'tensile', ph: [(n) => `tensile strength of ${n}`] },
  { re: /^volatile organic compound \(voc\) content$/i, key: 'voc', ph: [(n) => `voc content of ${n}`, (n) => `is ${n} low voc`] },
  { re: /^reaction to fire$/i, key: 'fire', ph: [(n) => `fire rating of ${n}`, (n) => `reaction to fire classification for ${n}`] },
  { re: /^composition$/i, key: 'composition', ph: [(n) => `what is ${n} made of`, (n) => `what is the chemical base of ${n}`] },
  { re: /^chemical resistance$/i, key: 'chemical', ph: [(n) => `chemical resistance of ${n}`] },
  { re: /^movement capability$/i, key: 'movement', ph: [(n) => `joint movement capability of ${n}`] },
  { re: /^relative air humidity$/i, key: 'humidity', ph: [(n) => `max humidity to apply ${n}`] },
  { re: /^shore a hardness$/i, key: 'hardness', ph: [(n) => `shore hardness of ${n}`] },
  { re: /^curing time$/i, key: 'curing', ph: [(n) => `curing time for ${n}`] },
  { re: /^waiting time to overcoating$/i, key: 'overcoat', ph: [(n) => `how long to wait before overcoating ${n}`] },
];
const usable = (sh, re) => (sh.d.sec || []).find((x) => re.test(x.l) && x.t && x.t.length > 3 && x.t.length < 200);
let nAttr = 0;
for (const A of ATTRS) {
  const cands = shards.filter((sh) => usable(sh, A.re)); const n = Math.min(cands.length, A.re.source.includes('shelf') ? 10 : 4);
  const used = new Set();
  for (let k = 0; k < n; k++) {
    let sh; do { sh = pick(cands); } while (used.has(sh.id) && used.size < cands.length); used.add(sh.id);
    const item = usable(sh, A.re); const prod = products.find((p) => p.id === sh.id); const name = clean(sh.n).toLowerCase();
    let q = pick(A.ph)(name); if (k % 5 === 4) q = typo(q);
    add(personaOf(prod), 'product data: ' + A.key, q, 'attr', { product: sh.id, label: A.key, contains: item.t.slice(0, 80), has: true, source: 'data' });
    nAttr++;
  }
}
// products that lack a label: the honest answer is that the data does not cover it
const lacks = [[/^pot life$/i, 'pot life of', 'pot life'], [/^shelf life$/i, 'shelf life of', 'shelf life'], [/compressive/i, 'compressive strength of', 'compressive'], [/^(mixing ratio|mixing)$/i, 'mix ratio for', 'mixing ratio']];
for (const [re, ph, key] of lacks) {
  const cands = shards.filter((sh) => !(sh.d.sec || []).some((x) => re.test(x.l) || (key === 'compressive' && /compressive/i.test(x.t))) && !Object.keys(sh.tm || {}).some((k) => /pot_life/.test(k) && re.test('pot life')) && !(sh.cp || []).some((c) => re.test(c.heading || '')) && sh.d.us && sh.d.us.length);
  for (let k = 0; k < 4; k++) { const sh = pick(cands); add(personaOf(products.find((p) => p.id === sh.id)), 'product data: ' + key + ' (not published)', `${ph} ${clean(sh.n).toLowerCase()}`, 'attr', { product: sh.id, label: key, has: false, source: 'data' }); }
}
// plain-language versions of what the existing assistant already does, so regressions show
const withRate = shards.filter((sh) => sh.r && sh.r.facts && sh.r.facts.consumption && sh.r.facts.consumption.length && sh.r.facts.consumption[0].text.length < 120);
for (let k = 0; k < 14; k++) { const sh = pick(withRate); const f = sh.r.facts.consumption[0]; add(personaOf(products.find((p) => p.id === sh.id)), 'coverage and consumption', pick([(n) => `how far does ${n} go`, (n) => `coverage of ${n}`, (n) => `what is the spread rate for ${n}`, (n) => `consumption of ${n}`])(clean(sh.n).toLowerCase()), 'rate', { product: sh.id, contains: f.text.slice(0, 60), has: true, source: 'data' }); }
const withPot = shards.filter((sh) => sh.tm && sh.tm.pot_life && sh.tm.pot_life.length);
for (let k = 0; k < 8; k++) { const sh = pick(withPot); const f = sh.tm.pot_life[0]; add(personaOf(products.find((p) => p.id === sh.id)), 'times', pick([(n) => `how long is the pot life of ${n}`, (n) => `working time for ${n} once mixed`])(clean(sh.n).toLowerCase()), 'time', { product: sh.id, contains: f.text.slice(0, 40), has: true, source: 'data' }); }
const withCure = shards.filter((sh) => sh.tm && sh.tm.cure_times && sh.tm.cure_times.length);
for (let k = 0; k < 8; k++) { const sh = pick(withCure); const f = sh.tm.cure_times[0]; add(personaOf(products.find((p) => p.id === sh.id)), 'times', pick([(n) => `how long until ${n} is cured`, (n) => `cure time for ${n}`, (n) => `when can i walk on ${n}`])(clean(sh.n).toLowerCase()), 'time', { product: sh.id, contains: f.text.slice(0, 40), has: true, source: 'data' }); }
const withDoc = shards.filter((sh) => (sh.dc || []).some((d) => d.ok && d.ty === 'safety_data_sheet'));
for (let k = 0; k < 8; k++) { const sh = pick(withDoc); add('D', 'documents', pick([(n) => `where do i find the sds for ${n}`, (n) => `${n} safety data sheet`, (n) => `msds ${n}`])(clean(sh.n).toLowerCase()), 'doc', { product: sh.id, source: 'data' }); }
// whole-range category lists
const LISTS = [['grout', 'tile-grouts', 'what grouts'], ['sanitary-sealants', 'sanitary-sealants', 'which bathroom silicones'], ['epoxy-grouts', 'epoxy-grouts|sikaceram-880', 'what epoxy grouts'], ['chemical-anchoring', 'chemical-anchoring', 'what chemical anchors'], ['fibres', 'concrete/fibres', 'which concrete fibres'], ['torch-on', 'torch-on-sheet-membranes', 'what torch on membranes'], ['fibres-carbon', 'structural-strengthening', 'what structural strengthening products'], ['floor-joints', 'floor-joints', 'what floor joint sealants'], ['marine', 'marine/', 'which marine products'], ['pvc roofing', 'pvc-sheet-membranes', 'which pvc roof membranes']];
for (const [, c, ph] of LISTS) add(pick(['B', 'S', 'D']), 'catalogue lists', `${ph} does sika australia sell`, 'list', { allowed: c.includes('|') ? ['c:' + c.split('|')[0], 'i:sikaceram-880-easyepoxy'] : ['c:' + c], min: 3 });
// de-duplicate and number
// ids written as s-xyz in the source are sika-xyz in the catalogue; a few ids are numbers on the site
const ALIAS = {};
const known = new Set(products.map((p) => p.id));
const fixId = (id) => { id = ALIAS[id] || id; if (known.has(id)) return id; if (id.startsWith('s-') && known.has('sika-' + id.slice(2))) return 'sika-' + id.slice(2); return id; };
const unknownIds = [];
for (const b of bank) {
  const e = b.exp;
  if (e.product) { e.product = fixId(e.product); if (!known.has(e.product)) unknownIds.push(e.product); }
  if (e.products) { e.products = e.products.map(fixId); e.products = e.products.filter((x) => known.has(x)); if (!e.products.length) unknownIds.push(b.q); }
  for (const k of ['allowed', 'deny']) if (e[k]) e[k] = e[k].map((sel) => (sel.startsWith('i:') ? 'i:' + sel.slice(2).split(',').map(fixId).filter((x) => known.has(x) || (unknownIds.push(x), false)).join(',') : sel));
}
if (unknownIds.length) { console.error('UNKNOWN IDS', unknownIds); process.exit(1); }
const seen = new Set(); const out = [];
for (const b of bank) { const k = b.q.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(b); }
out.forEach((b, i) => { b.id = 'q' + String(i + 1).padStart(3, '0'); let h = 0; for (const ch of b.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; b.split = h % 5 === 0 ? 'blind' : 'tuned'; });

// ---- messy questions (added after the first 416 so earlier ids stay put): typos, phone slips, slang, jargon, codes, vague asks
const messy = [];
const addM = (persona, category, q, type, exp = {}, how = 'hand') => messy.push({ persona: P[persona], category, q, type, exp, messy: how });
const T1 = TILE_ADH, G1 = GROUT;
// slang and trade shorthand
addM('T', 'slang', 'flexi glue for big tiles', 'best', { allowed: T1 });
addM('T', 'slang', 'tile on tile what do i use', 'best', { allowed: T1 });
addM('T', 'slang', 'whats the go with tiling over old tiles', 'best', { allowed: T1 });
addM('T', 'slang', 'mud for floor tiles', 'best', { allowed: T1.concat(LEVEL) });
addM('T', 'slang', 'goop for round the bath', 'best', { allowed: SEALSAN });
addM('T', 'slang', 'silly cone for the shower', 'best', { allowed: SEALSAN });
addM('T', 'slang', 'the wet area membrane', 'best', { allowed: TILEWP });
addM('T', 'slang', 'torch on or paint on membrane for the wet area', 'best', { allowed: TILEWP.concat(['c:roofing/torch-on-sheet-membranes']) });
addM('T', 'slang', 'gunk to seal the shower screen', 'best', { allowed: SEALSAN });
addM('T', 'slang', 'grot for between the tiles', 'best', { allowed: G1 });
addM('B', 'slang', 'screed it out for a big shed floor', 'best', { allowed: LEVEL });
addM('B', 'slang', 'bog for filling holes in concrete', 'best', { allowed: ['c:concrete-repair-protection', 'c:sealants-adhesives/paint-preparation', 'i:sikafloor-050-rampandpatch'] });
addM('B', 'slang', 'what do i use to fix the slab if its rooted', 'best', { allowed: ['c:concrete-repair-protection', 'c:flooring/cement-levelling'] });
addM('B', 'slang', 'two part epoxy for the garage floor', 'best', { allowed: ['c:flooring/resin-flooring'] });
addM('B', 'slang', 'two pack glue for steel', 'best', { allowed: ['c:sealants-adhesives', 'c:structural-strengthening', 'c:industry', 'c:transportation'] });
addM('B', 'slang', 'liquid nails type stuff', 'best', { allowed: ['c:sealants-adhesives/construction-adhesives'] });
addM('B', 'slang', 'no more nails glue', 'best', { allowed: ['c:sealants-adhesives/construction-adhesives'] });
addM('B', 'slang', 'gap filler foam in a can', 'best', { allowed: ['c:sealants-adhesives/foam-sealants-adhesives', 'c:sealants-adhesives/passive-fire-protection'] });
addM('B', 'slang', 'wall bog for before painting', 'best', { allowed: ['c:sealants-adhesives/paint-preparation', 'c:concrete-repair-protection'] });
addM('B', 'slang', 'roof goop for a leaking gutter', 'best', { allowed: ['i:sikaseal-roof-gutter', 'c:sealants-adhesives/roofing-sealantsadhesives', 'c:roofing', 'c:waterproofing'] });
addM('C', 'slang', 'what do i put in the mix to make it flow better', 'best', { allowed: ['c:concrete/admixture-technology'] });
addM('C', 'slang', 'plasticiser for a slab pour', 'best', { allowed: ['c:concrete/admixture-technology'] });
addM('C', 'slang', 'stuff to slow the pour in summer', 'best', { allowed: ['c:concrete/admixture-technology', 'c:concrete/specialty-products'] });
addM('C', 'slang', 'dry shake or hardener for a warehouse slab', 'best', { allowed: ['c:flooring', 'c:concrete'] });
addM('C', 'slang', 'crete patch for a pothole', 'best', { allowed: ['c:concrete-repair-protection', 'c:flooring'] });
addM('W', 'slang', 'tanking for a basement', 'best', { allowed: ['c:waterproofing', 'c:landscape-buildingproducts/subsoil'] });
addM('W', 'slang', 'what stops a wet wall in the cellar', 'best', { allowed: ['c:waterproofing', 'c:concrete-repair-protection', 'c:landscape-buildingproducts/subsoil'] });
addM('W', 'slang', 'torch on for the flat roof', 'best', { allowed: ['c:roofing/torch-on-sheet-membranes'] });
addM('W', 'slang', 'what is class 3 membrane', 'business', { url: 'davco-k10|waterproofing', must: 'class' });
addM('W', 'slang', 'damp course paint for a wet garage wall', 'nodata', {});
addM('H', 'slang', 'sparky needs fire stopper for cable holes', 'best', { allowed: ['c:sealants-adhesives/passive-fire-protection', 'c:sealants-adhesives/facade-sealants', 'c:sealants-adhesives/foam'] });
addM('H', 'slang', 'what do chippies use to glue skirting', 'best', { allowed: ['c:sealants-adhesives/construction-adhesives', 'c:sealants-adhesives/foam-sealants-adhesives'] });
addM('H', 'slang', 'tradie glue for decking', 'best', { allowed: ['c:sealants-adhesives'] });
addM('H', 'slang', 'old davco grey bag whats the new one called', 'product', { products: ['davco-grey-one-potadhesive'] });
addM('H', 'slang', 'grey pot davco tile glue', 'product', { products: ['davco-grey-one-potadhesive'] });
addM('H', 'slang', 'trojan davco tile mud', 'product', { products: ['davco-trojan-mastic'] });
addM('H', 'slang', 'the yellow davco one pot', 'product', { products: ['davco-grey-one-potadhesive'] });
addM('T', 'slang', 'ultraflex davco flexi', 'product', { products: ['davco-ultraflex'] });
addM('T', 'slang', 'k10 davco membrane', 'product', { products: ['davco-k10-plus', 'davco-k10-rapid'] });
// jargon and codes
addM('S', 'jargon', 'c2te s1 adhesive', 'business', { url: 'aus.sika.com', must: 'C2' });
addM('S', 'jargon', 'which adhesives are c2 classified', 'business', { url: 'aus.sika.com', must: 'C2' });
addM('S', 'jargon', 'as 3740 waterproofing of wet areas', 'business', { url: 'aus.sika.com', must: '3740', nodata: true });
addM('S', 'jargon', 'as 4654 membrane', 'business', { url: 'aus.sika.com', must: '4654' });
addM('S', 'jargon', 'which products meet as iso 13007', 'business', { url: 'aus.sika.com', must: '13007' });
addM('S', 'jargon', 'en 1504 repair mortar', 'business', { url: 'aus.sika.com', must: '1504' });
addM('S', 'jargon', 'class iii waterproofing membrane for under tiles', 'best', { allowed: TILEWP });
addM('S', 'jargon', 'cementitious tile adhesive cta', 'best', { allowed: T1 });
addM('S', 'jargon', 'open time vs pot life whats the difference', 'business', { url: 'aus.sika.com|documents', must: '', nodata: true });
addM('S', 'jargon', 'what is open time on a tile adhesive', 'business', { url: 'aus.sika.com', must: 'open time', nodata: true });
addM('B', 'jargon', 'how many calories in a meat pie', 'oos', {});
addM('S', 'jargon', 'sds for davco k10 plus', 'doc', { product: 'davco-k10-plus' });
addM('S', 'jargon', 'tds sikafloor level pro', 'doc', { product: 'sikafloor-level-pro' });
addM('S', 'jargon', 'epd on level pro', 'doc', { product: 'sikafloor-level-pro' });
addM('S', 'jargon', 'voc content of sikaflex 11fc', 'attr', { product: 'sikaflex-11-fc-purform', alt: ['1671'], label: 'voc' });
addM('S', 'jargon', 'non slump adhesive for lft', 'best', { allowed: T1 });
// brand nicknames, product codes with phone slips
addM('H', 'typo', 'sikaflex 11fc', 'product', { products: ['sikaflex-11-fc-purform', '1671'] });
addM('H', 'typo', 'sikaflex11fc colours', 'product', { products: ['sikaflex-11-fc-purform', '1671'] });
addM('T', 'typo', 'davco grout fr shwr', 'best', { allowed: G1 });
addM('T', 'typo', 'davco grot for shower floor', 'best', { allowed: G1 });
addM('T', 'typo', 'sika tile 400 evo', 'product', { products: ['sikatile-400-evopro'] });
addM('T', 'typo', 'sikatile400', 'product', { products: ['sikatile-400-evopro'] });
addM('B', 'typo', 'levl pro sds', 'doc', { product: 'sikafloor-level-pro' });
addM('B', 'typo', 'sikafloor levelpro', 'product', { products: ['sikafloor-level-pro'] });
addM('B', 'typo', 'sika lvl top', 'product', { products: ['sikafloor-level-top'] });
addM('W', 'typo', 'sikalastic1k', 'product', { products: ['sikalastic-1k'] });
addM('W', 'typo', 'sikalastc 1k pool', 'product', { products: ['sikalastic-1k'] });
addM('B', 'typo', 'monotop 412', 'product', { products: ['sika-monotop-412nfg'] });
addM('B', 'typo', 'sikadur32', 'product', { products: ['sikadur-32-lp'] });
addM('C', 'typo', 'viscocrete 1250', 'product', { products: ['sika-viscocrete-1250'] });
addM('C', 'typo', 'viscocrete1250 dosage', 'rate', { product: 'sika-viscocrete-1250' });
addM('H', 'typo', 'cnt find sds for grey one pot', 'doc', { product: 'davco-grey-one-potadhesive' });
addM('X', 'typo', 'wher can i by davco', 'business', { url: 'where-to-buy', must: '' });
addM('X', 'typo', 'phne numbr for sika', 'business', { url: 'imprint|contact', must: '9725' });
addM('X', 'typo', 'warrenty on tiling', 'business', { url: 'warranty-portal', must: 'warrant' });
addM('X', 'typo', 'tecnical support', 'business', { url: 'contact|Contact|imprint', must: '' });
// vague asks: one short clarifying question with options is the right answer
addM('H', 'vague', 'what do i need for a bathroom', 'vague', {});
addM('H', 'vague', 'something for cracks', 'vague', {});
addM('H', 'vague', 'best stuff for outside', 'vague', {});
addM('H', 'vague', 'what glue do i need', 'vague', {});
addM('H', 'vague', 'waterproofing', 'vague', {});
addM('H', 'vague', 'i need to fix my floor', 'vague', {});
addM('H', 'vague', 'help with tiles', 'vague', {});
addM('H', 'vague', 'what sealant', 'vague', {});
addM('H', 'vague', 'something to stop leaks', 'vague', {});
addM('H', 'vague', 'what should i use for my deck', 'vague', {});
addM('B', 'vague', 'need something for the slab', 'vague', {});
addM('B', 'vague', 'best primer', 'vague', {});
addM('H', 'vague', 'what do i use on a wall', 'vague', {});
addM('H', 'vague', 'kitchen reno what products', 'vague', {});
addM('H', 'vague', 'laundry reno what do i buy', 'vague', {});
// mechanical mutations of earlier questions: same ground truth, messier words
const KEYS = { a: 's', e: 'r', i: 'o', o: 'p', u: 'y', t: 'r', n: 'm', s: 'a', l: 'k', r: 'e' };
const ABBR = [[/shower/g, 'shwr'], [/bathroom/g, 'bthrm'], [/concrete/g, 'conc'], [/adhesive/g, 'adhsv'], [/waterproofing/g, 'waterprofing'], [/waterproof/g, 'watrproof'], [/tiles/g, 'tyles'], [/tile/g, 'tyle'], [/membrane/g, 'membrain'], [/sealant/g, 'sealent'], [/primer/g, 'primmer'], [/levelling/g, 'leveling'], [/compound/g, 'compund'], [/floor/g, 'flor'], [/large format/g, 'lft'], [/what is the/g, 'whats the'], [/for a /g, 'fr a '], [/the /g, 'da ']];
const mut = (q, k) => {
  const w = q.split(' ');
  if (k % 5 === 0) { const i = w.reduce((b, x, j) => (x.length > w[b].length ? j : b), 0); const x = w[i]; if (x.length > 5) w[i] = x.slice(0, 3) + x.slice(4); return w.join(' '); }
  if (k % 5 === 1) { const i = w.reduce((b, x, j) => (x.length > w[b].length ? j : b), 0); const x = w[i]; if (x.length > 4) w[i] = x.slice(0, 2) + x[3] + x[2] + x.slice(4); return w.join(' '); }
  if (k % 5 === 2) { let r = q; for (const [a, b] of ABBR) if (a.test(r)) { r = r.replace(a, b); break; } return r === q ? q.replace(/ /g, '  ').replace(/  /g, ' ').toUpperCase().toLowerCase() + ' pls' : r; }
  if (k % 5 === 3) { const i = w.findIndex((x) => x.length > 5 && /[aeiou]/.test(x)); if (i >= 0) { const x = w[i]; const p = x.search(/[aeiou]/); w[i] = x.slice(0, p) + (KEYS[x[p]] || x[p]) + x.slice(p + 1); } return w.join(' '); }
  return q.replace(/(\d+) (fc|evo|pro|top)/g, '$1$2').replace(/\bhow do i\b/g, 'hw do i').replace(/\bwhat\b/g, 'wat');
};
let mk = 0;
for (let i = 0; i < out.length; i++) {
  const b = out[i]; if (!['best', 'product', 'attr', 'rate', 'time', 'doc', 'list', 'nodata', 'business', 'compare'].includes(b.type)) continue;
  if (i % 3 !== 1) continue; const q2 = mut(b.q, mk++); if (q2 === b.q) continue;
  messy.push({ persona: b.persona, category: b.category + ' (mutated)', q: q2, type: b.type, exp: b.exp, messy: 'mutated' });
}
let nextId = out.length;
const seenM = new Set(out.map((x) => x.q.toLowerCase()));
for (const m of messy) { if (seenM.has(m.q.toLowerCase())) continue; seenM.add(m.q.toLowerCase()); const fixed = JSON.parse(JSON.stringify(m)); const e = fixed.exp; if (e.product) e.product = fixId(e.product); if (e.alt) e.alt = e.alt.map(fixId); if (e.products) e.products = e.products.map(fixId).filter((x) => known.has(x)); for (const k of ['allowed', 'deny']) if (e[k]) e[k] = e[k].map((sel) => (sel.startsWith('i:') ? 'i:' + sel.slice(2).split(',').map(fixId).filter((x) => known.has(x)).join(',') : sel)); nextId++; fixed.id = 'q' + String(nextId).padStart(3, '0'); let h = 0; for (const ch of fixed.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; fixed.split = h % 5 === 0 ? 'blind' : 'tuned'; fixed.messy = fixed.messy || 'hand'; out.push(fixed); }
for (const b of out) if (!b.messy && (/typo|slang/.test(b.category))) b.messy = 'hand';

fs.writeFileSync(path.join(HERE, 'bank.json'), JSON.stringify(out, null, 1));
const by = (f) => out.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
console.log('messy', out.filter((x) => x.messy).length, 'bank', out.length, 'blind', out.filter((x) => x.split === 'blind').length, JSON.stringify(by((x) => x.persona)), JSON.stringify(by((x) => x.type)));
