// advisor.js: "best X for Y" and "what X do you make", answered without ever inventing a superlative.
// It names the products whose OWN published text documents a fit for the conditions in the question, orders them by a stated documented criterion,
// quotes the sentence each line rests on, says what the published text does not state, and hands off to Technical Services.
// Pure code over data/brain/adv/<category>.json (evidence sentences compiled from the product pages). No model.
import { normalise, tokens, stem, clampText, GENERIC, dist } from './text.js';
import { card, fact, CHIPS } from './schema.js';

const T = 'construction/tile-stone-installationsystems', FL = 'construction/flooring', WP = 'construction/waterproofing', SA = 'construction/sealants-adhesives', CO = 'construction/concrete', CR = 'construction/concrete-repair-protection', GA = 'construction/grouts-anchoring', RF = 'construction/roofing', SS = 'construction/structural-strengthening', LB = 'construction/landscape-buildingproducts';
const re = (s) => new RegExp(s, 'i');
// kind: what the visitor is asking for. q matches the normalised question; cats are the shards to read; sub/name filter the products inside them.
export const KINDS = [
  { id: 'tile_care', label: 'grout cleaners, sealers and restorers', q: re('\\b(clean\\w*|seal\\w*|rejuvenat\\w*|restor\\w*|refresh\\w*|mould\\w*|mold\\w*)\\b.*\\bgrout|grout\\b.*\\b(clean\\w*|seal\\w*|mould\\w*|mold\\w*|old|dirty|restor\\w*|rejuvenat\\w*)'), cats: [T], sub: re('tile-care'), name: re('rejuvenat') },
  { id: 'tile_additive', label: 'additives for tile adhesive and grout', q: re('\\b(additive|accelerator|plasticiser|more flexible|flexible additive)\\b.*\\b(tile|tiling|adhesive|grout)|\\b(tile|tiling|adhesive|grout)\\b.*\\b(additive|accelerator|more flexible)'), cats: [T], sub: re('primers-additives'), name: re('additive|davelastic|accelerator|plasticiser'), both: true },
  { id: 'tile_primer', label: 'primers for tiling', q: re('\\b(primer|prime|priming)\\b.*\\b(tile|tiling|adhesive|tiles)|\\b(tile|tiling|tiles)\\b.*\\b(primer|prime|priming)'), cats: [T, FL], sub: re('primers-additives'), name: re('prime|primer'), both: true },
  { id: 'tile_waterproofing', label: 'waterproofing membranes for under tiles', q: re('\\b(waterproof\\w*|membrane|tanking|damp ?proof|leak\\w*|water proof)\\b.*\\b(tile|tiles|tiling|shower|bathroom|laundry|wet area|ensuite|balcon\\w*|pool|spa|bath|floor|kitchen|vanity)\\b|\\b(tile|tiles|tiling|shower|bathroom|laundry|wet area|ensuite|balcon\\w*|pool|bath)\\b.*\\b(waterproof\\w*|membrane|tanking|damp ?proof|water proof)|\\b(put down|go down|goes down|lay|apply)\\b.*\\bbefore\\b.*\\btile'), cats: [T, WP, FL], test: (e) => (e.cat === T && /^waterproofing$/.test(e.sub)) || (e.ev.some((x) => /(before|prior to|under|below|beneath|prior to the application of)( the)?( application of)?( ceramic)? ?(tiles?|tiling|ceramic tiles)|under ?tiles|below tiling/i.test(x.t)) && /waterproof|membrane/i.test(e.n + ' ' + e.tg + ' ' + e.id)) },
  { id: 'level_primer', label: 'primers for levelling compounds', q: re('\\b(prime|primer|priming)\\b.*\\b(level\\w*|screed)|\\b(level\\w*|screed)\\b.*\\b(prime|primer|priming)'), cats: [FL], sub: re('cement-levelling'), name: re('prime|primer'), both: true },
  { id: 'screed', label: 'screeds and levelling compounds', q: re('\\buneven (concrete )?(floor|slab)|out of level|undulating floor|\\bwhat do i pour\\b|\\b(screed\\w*|leveller\\w*|leveler\\w*|levelling|leveling|self[- ]?levell?ing|smoothing compound|underlayment|floor leveller|bulk fill|floor levelling)\\b'), cats: [FL], sub: re('cement-levelling'), notName: re('primer|seal ?tape|sealing membrane|barrier|prime\\b|prep n prime') },
  { id: 'tile_adhesive', label: 'tile adhesives', q: re('\\b(tile|tiles|tiling|tiled|porcelain|ceramic|mosaic|natural stone|stone tiles?|splashback|brick slips?)\\b.*\\b(adhesive|glue|mastic|bond|thinset|fix|stick)\\w*|\\b(adhesive|glue)\\b.*\\bpool\\b|\\b(adhesive|glue|mastic|thinset)\\w*\\b.*\\b(tile|tiles|tiling|porcelain|ceramic|mosaic|stone|splashback)\\b|\\bstick tiles?\\b|\\btile glue\\b|\\btrowel\\b'), cats: [T], sub: re('tile-adhesives'), extra: re('sikaceram-880') },
  { id: 'epoxy_grout', label: 'epoxy grouts', q: re('^(?!.*\\b(tile|tiling|shower|bathroom|kitchen|floor)\\b).*\\bepoxy grout'), cats: [GA, T], sub: re('epoxy-grouts'), extra: re('sikaceram-880') },
  { id: 'tile_grout', label: 'tile grouts', q: re('^(?!.*\\b(base ?plate|bolts?|anchor\\w*|machinery|underwater|wind|turbine|non[- ]?shrink|rail|precision)\\b).*\\bgrout'), cats: [T], sub: re('tile-grouts'), notName: re('additive') },
  { id: 'sanitary_sealant', label: 'sealants for bathrooms, kitchens and pools', q: re('\\b(silicone|sealant|seal|caulk\\w*|sealer)\\b.*\\b(shower|bath|bathroom|kitchen|basin|sink|pool|wet|mould\\w*|tiles?|vanity|splashback)\\b|\\b(shower|bath|bathroom|kitchen|basin|sink|pool|vanity)\\b.*\\b(silicone|sealant|caulk\\w*)\\b|\\bwhat silicone\\b'), cats: [SA], sub: re('sanitary-sealants|swimming-pools'), notName: re('rod|foam') },
  { id: 'aquarium', label: 'aquarium and appliance sealants', q: re('\\b(fish tank|aquarium|appliance)\\b'), cats: [SA], sub: re('specialty-sealants') },
  { id: 'floor_joint', label: 'floor joint fillers', q: re('\\bfloor joints?\\b|\\bjoint filler\\b|\\bwarehouse floor joint'), cats: [FL], sub: re('floor-joints') },
  { id: 'joint_sealant', label: 'sealants for movement joints and facades', q: re('\\b(expansion|movement|control|facade|perimeter|saw ?cut)\\b.*\\b(joint\\w*|sealant)\\b|\\bjoint (sealant|filler)\\b|\\bsealant\\b.*\\bjoints?\\b'), cats: [SA], sub: re('expansion-perimeter|facade-sealants|curtain-walling|movement-saw') },
  { id: 'fire', label: 'fire rated sealants and foams', q: re('\\bfire\\b'), cats: [SA], sub: re('passive-fire|facade-sealants'), name: re('fire') },
  { id: 'foam', label: 'foam sealants and adhesives', q: re('\\b(foam|expanding foam|gap fill\\w*)\\b'), cats: [SA], sub: re('foam-sealants|passive-fire') },
  { id: 'backing', label: 'backing rod and foam tapes', q: re('\\b(backing rod|backer rod|joint tape|foam tape)\\b'), cats: [SA], sub: re('backing-rod') },
  { id: 'gutter', label: 'roofing and gutter sealants', q: re('\\b(gutter|roof sealant|roof leak)\\b'), cats: [SA, RF], sub: re('roofing-sealants|solvent-based') },
  { id: 'paint_prep', label: 'fillers and paint preparation sealants', q: re('\\b(filler|fill cracks?|crack filler|before painting|paint preparation|paintable|gap filler)\\b'), cats: [SA], sub: re('paint-preparation') },
  { id: 'contact', label: 'contact and spray adhesives', q: re('\\b(contact adhesive|contact glue|spray adhesive|laminate adhesive|spray glue|contact cement)\\b|\\bspray (contact|glue)\\b|\\bglue (for|to) (laminate|veneer)'), cats: [SA], sub: re('contact-adhesives') },
  { id: 'wood_floor_adhesive', label: 'flooring adhesives', q: re('\\b(timber|wood|wooden|parquet|vinyl|carpet)\\b.*\\b(adhesive|glue|fix\\w*|lay\\w*)|\\b(adhesive|glue)\\b.*\\b(timber|wood|parquet|flooring)\\b'), cats: [FL, SA], sub: re('flooring-adhesives|construction-adhesives') },
  { id: 'ramp_patch', label: 'ramping and patching mortars', q: re('\\b(ramp|patching|patch|loading dock|fast patch)\\b'), cats: [FL, CR], name: re('ramp|patching|rapidscreed|bulk-?fill') },
  { id: 'accelerator', label: 'concrete accelerators', q: re('\\b(accelerat\\w+|shotcrete|sprayed concrete|quick set)\\b|speed up (the )?(set|setting|cure|curing)|faster set|set faster|early strength'), cats: [CO], sub: re('accelerators|tunnel') },
  { id: 'surface_retarder', label: 'surface retarders', q: re('\\b(exposed aggregate|surface retarder)\\b'), cats: [CO], sub: re('surface-retarders') },
  { id: 'curing', label: 'curing and evaporation control', q: re('\\b(curing compound|curing membrane|evaporation|cure a (new )?slab|drying too fast|stop .* drying|slab drying)\\b'), cats: [CO], sub: re('evaporation') },
  { id: 'retarder', label: 'concrete retarders and set control', q: re('\\b(retard\\w+|slow (down )?(the )?(pour|set|setting|cure)|slow set|hot weather concrete|extend (the )?(set|working))\\b|\\bhot weather\\b.*\\bconcrete|\\bconcrete\\b.*\\bhot weather'), cats: [CO], sub: re('(^|/)retarders$|water-reducers|evaporation') },
  { id: 'superplasticiser', label: 'concrete water reducers and superplasticisers', q: re('make (it|concrete) flow|flow better|more workable|workability|\\b(superplasticis\\w+|superplasticiz\\w+|plasticis\\w+|water reduc\\w+|self[- ]?compact\\w+|scc|high strength concrete|flowing concrete|high range)\\b'), cats: [CO], sub: re('high-range|mid-range|water-reducers|special-admixtures') },
  { id: 'air_entrain', label: 'air entraining admixtures', q: re('\\b(air ?entrain\\w*|air entraining)\\b'), cats: [CO], sub: re('air-entraining') },
  { id: 'strengthening', label: 'structural strengthening systems', q: re('\\b(carbon fib\\w+|frp|strengthen\\w*|plate bonding|wrap|structural adhesive|beam)\\b'), cats: [SS, CR], sub: re('strengthening|structural-adhesives|epoxy-repair') },
  { id: 'fibre', label: 'concrete fibres', q: re('^(?!.*\\bcarbon\\b).*\\b(fibres?|fibers?|macro fib\\w+|crack control|plastic shrinkage)\\b'), cats: [CO], sub: re('fibres') },
  { id: 'pigment', label: 'concrete colour', q: re('\\b(pigment|concrete colou?r|colour concrete|coloured concrete|colour for concrete)\\b'), cats: [CO], sub: re('pigment') },
  { id: 'shrinkage', label: 'shrinkage reducing admixtures', q: re('\\b(shrinkage)\\b'), cats: [CO], sub: re('shrinkage') },
  { id: 'release', label: 'release agents', q: re('\\b(release agent|formwork oil|mould oil|precast mould)\\b'), cats: [CO], sub: re('release-agents') },
  { id: 'repair_mortar', label: 'concrete repair mortars', q: re('\\b(fix|patch|mend)\\b.*\\b(slab|concrete)\\b.*\\bdamaged|\\b(repair mortars?|spall\\w*|patch repair|reprofil\\w+|concrete repair|repair (to |of |a )?concrete|render repair|honeycomb\\w*)\\b|\\brepair\\b.*\\bconcrete\\b'), cats: [CR], sub: re('repair-mortars|steel-reinforc|corrosion') },
  { id: 'marine', label: 'marine sealants and adhesives', q: re('\\b(boat|yacht|marine|teak|hull|deck seam)\\b'), cats: ['industry/marine'], sub: re('.') },
  { id: 'auto', label: 'automotive and glass bonding', q: re('\\b(windscreen|windshield|auto glass|car body|panel bonding|caravan|motorhome)\\b'), cats: ['industry/automotive-aftermarket', 'industry/transportation'], sub: re('.') },
  { id: 'green_roof', label: 'green roof and green wall systems', q: re('\\b(green roof|green wall|living roof|roof garden|living wall)\\b'), cats: [LB], sub: re('green-roofs') },
  { id: 'plug', label: 'plugging and stopping leaks', q: re('\\b(plug|plugging)\\b|\\bstop (a |the )?(water )?(leak|leaks|ingress)|\\bactive leak|\\bwater leak (in|through)'), cats: [CR, WP], sub: re('repair-mortars|injections'), name: re('plug|quick|rapid|inject|swell'), both: true },
  { id: 'waterstop', label: 'waterstops and injection systems', q: re('\\b(waterstops?|injection|hydrophilic|swellable|cold joint|construction joint)\\b'), cats: [WP], sub: re('injections|66807') },
  { id: 'crack_repair', label: 'crack repair and sealing', q: re('\\bcracks?\\b.*\\b(repair|fill|seal|fix|inject)\\w*|\\b(repair|fill|seal|fix|inject)\\w*\\b.*\\bcracks?\\b'), cats: [CR, SS, WP], sub: re('epoxy-repair|structural-adhesives|injections'), name: re('crack|sikadur|inject') },
  { id: 'bonding', label: 'bonding agents and bridging epoxies', q: re('\\b(bonding agent|bond coat|bonding (new|old)|bond(ing)? new .* to old|epoxy bond)\\b|\\bnew (concrete|render|mortar) to (an |the )?old\\b|\\b(bond|bonding|join|tie)\\b.*\\bnew\\b.*\\b(old|existing)\\b|\\bcrack inject\\w*'), cats: [CR, SS, WP], sub: re('epoxy-repair|steel-reinforc|structural-adhesives|concrete-mortarsadmixtures|injections'), name: re('bondit|latex|sbr|fix|sikadur') },
  { id: 'anchor', label: 'chemical anchors', q: re('\\b(chemical anchors?|anchor(s|ing)?|resin anchor|rebar fixing|dowel\\w*|threaded rod)\\b'), cats: [GA, SA], sub: re('chemical-anchoring|anchoring-adhesives') },
  { id: 'floor_sealer', label: 'floor sealers and hardeners', q: re('\\b(dusting|dusts|dust ?proof\\w*|harden\\w*|densif\\w*)\\b.*\\b(floor|slab|concrete)\\b|\\b(floor|slab|concrete)\\b.*\\b(dusting|dusts|dust ?proof|harden|densif)\\w*|\\bfloor sealer\\b|\\bseal(er)? (a |the )?(concrete )?floor\\b'), cats: [FL], sub: re('floor-sealers'), name: re('curehard|seal|harden') },
  { id: 'resin_floor', label: 'resin flooring', q: re('^(?=.*\\b(floor|floors|flooring|coating)\\b).*\\b(epoxy|polyurethane|resin|purcem|anti ?static|esd|conductive|floor coating|floor paint|garage floor|industrial floor)\\b|\\bfloor(ing)?\\b.*\\b(food|warehouse|garage|car ?park|commercial kitchen|factory|abattoir|hospital)\\b|\\b(commercial kitchen|food|abattoir|factory|warehouse|garage|car ?park|hospital)\\b.*\\bfloor|\\bnon ?slip\\b.*\\b(floor|coating)\\b'), cats: [FL], sub: re('resin-flooring|floor-sealers'), needFloor: true },
  { id: 'protective', label: 'protective coatings and silane impregnations', q: re('\\b(silane|anti[- ]?carbonation|protective coating|concrete protection|water repellent|impregnat\\w+)\\b'), cats: [CR], sub: re('protective-coatings|silane') },
  { id: 'grout_precision', label: 'cementitious and epoxy grouts', q: re('\\bgrout\\w*\\b.*\\b(base ?plate|bolts?|anchor\\w*|machinery|underwater|wind|turbine|non[- ]?shrink|precision|under)|\\b(non[- ]?shrink|base ?plate|underwater)\\b.*\\bgrout'), cats: [GA], sub: re('cementitious-grouts|epoxy-grouts') },
  { id: 'grout_any', label: 'grouts', q: re('\\bgrout\\w*\\b'), cats: [GA, T], sub: re('grouts') },
  { id: 'bentonite', label: 'bentonite waterproofing', q: re('\\bbentonite\\b'), cats: [WP], name: re('bentonite') },
  { id: 'bridge', label: 'bridge deck waterproofing', q: re('\\bbridge\\b'), cats: [WP], sub: re('bridge') },
  { id: 'spray_wp', label: 'spray applied waterproofing', q: re('\\bspray\\w*\\b.*\\b(waterproof\\w*|membrane)|\\b(waterproof\\w*|membrane)\\b.*\\bspray'), cats: [WP], sub: re('spray-applied') },
  { id: 'basement', label: 'below ground waterproofing', q: re('\\b(basement|below ground|tunnel|retaining wall|blind side|podium|underground)\\b'), cats: [WP, LB], sub: re('basement|pvc-sheet|injections|spray|liquid-applied|mortars|66807|subsoil') },
  { id: 'paving', label: 'paving, decking and green roof support', q: re('^(?!.*\\b(glue|adhesive|stick|fix|fixing)\\b).*\\b(pedestals?|pavers?|paving|decking|drainage|green walls?|turf|stormwater|storm water)\\b'), cats: [LB], sub: re('.') },
  { id: 'torch_on', label: 'torch on roofing membranes', q: re('\\btorch ?on\\b'), cats: [RF], sub: re('torch-on') },
  { id: 'pvc_roof', label: 'PVC roofing membranes', q: re('\\bpvc\\b.*\\b(roof\\w*|sheet|membrane)|\\b(roof\\w*|sheet|membrane)\\b.*\\bpvc\\b'), cats: [RF], sub: re('pvc-sheet-membranes/membranes|pvc-sheet-membranes$|^pvc-sheet-membranes/membranes'), name: re('sarnafil-g') },
  { id: 'roof_wp', label: 'roof waterproofing and roofing', q: re('\\b(roof\\w*|flat roof|torch ?on|pvc roof\\w*|green roof)\\b'), cats: [RF, WP, LB], sub: re('roofing|torch|pvc-sheet|liquid-applied|green-roofs|sheet-membranes') },
  { id: 'construction_adhesive', label: 'construction adhesives', q: re('\\b(adhesive|glue|bond|nails?)\\w*\\b|\\b(stick|fix|fixing|hold|holds|attach)\\b.*\\b(wall|timber|metal|glass|mirror|board|panel|bracket|post|rail|skirting|trim|tile|plasterboard|cladding|vanity|benchtop)\\b'), cats: [SA], sub: re('construction-adhesives|anchoring-adhesives|wood-work|contact-adhesives|foam') },
  { id: 'sealant', label: 'sealants', q: re('\\b(sealant|silicone|caulk\\w*|sealent|sealer)\\b|\\b(fill|filling|seal)\\b.*\\bgaps?\\b|\\bgaps?\\b.*\\b(fill|seal)'), cats: [SA], sub: re('facade|expansion|sanitary|curtain|specialty|waterproofing-sealants|roofing-sealants|swimming|paint-prep|passive') },
  { id: 'primer', label: 'primers', q: re('\\b(primer|prime)\\b'), cats: [FL, SA, T], sub: re('primer|cement-levelling|cleaners-activators'), name: re('primer|prime|ultraprime') },
  { id: 'waterproofing', label: 'waterproofing membranes', q: re('\\b(waterproof\\w*|membrane|tanking|damp ?proof|water proof|water tank|leak\\w*|stop a water leak)\\b'), cats: [WP, T], sub: re('liquid-applied|spray|basement|injections|bridge|mortars|66807|pvc-sheet|waterproofing') },
  { id: 'admixture', label: 'concrete admixtures', q: re('\\b(admixtures?|additive for concrete|add to concrete|concrete additive|what to add to concrete)\\b'), cats: [CO], sub: re('admixture|special|pre-cast|fibres|surface|shrinkage|pigment') },
];
// conditions: what the visitor says about the job, and the wording a product page would use to document a fit
export const CONDS = [
  { id: 'class3', label: 'Class III membranes', q: re('class iii'), ev: re('class (iii|3)\\b') },
  { id: 'large', label: 'large areas', q: re('\\b(big|large|huge|massive|whole|entire|vast|warehouse|industrial|commercial)\\b.*\\b(job|jobs|area|areas|floor|floors|project|projects|site|space|slab|surface|scale)\\b|\\blarge[- ]scale\\b|\\bbig job\\b|\\bbulk\\b|\\bmany (square )?m(etres)?\\b|\\b\\d{3,} ?m2\\b'), ev: re('\\blarge (floor |wall |roof |project |commercial |industrial )?(areas?|scale|surfaces?|projects?|floors?|volume)|\\b(big|extensive|wide) areas?|single application|large[- ]scale|bulk|high output|large open|large (and|or) small'), strong: re('large (floor |wall |roof |project |commercial |industrial )?(areas?|floors?|scale|surfaces?|projects?)|large[- ]scale|(big|extensive|wide) areas?'), primary: true },
  { id: 'pump', label: 'pumping', q: re('\\bpump\\w*\\b'), ev: re('\\bpump') , primary: true },
  { id: 'fast', label: 'fast setting or drying', q: re('\\b(fast|quick|rapid|same day|next day|few days|speedy|quickly|fast track)\\b'), ev: re('\\b(rapid|fast|quick)[- ]?(setting|drying|curing|hardening|cure|dry|set|strength|track)|early (strength|loading|traffic|age)|accelerat|ready for (tiling|covering|traffic) (in|after)|dries (quickly|fast)|walkable|within (\\d+|a few) (hours|days)'), primary: true },
  { id: 'thick', label: 'thick layers', q: re('\\b(thick\\w*|deep|build ?up|high build|over \\d+ ?mm|\\d+ ?mm)\\b'), ev: re('high build|thick|layer thickness|up to \\d+ ?mm|build[- ]?up|deep'), primary: true },
  { id: 'external', label: 'external use', q: re('\\b(outdoor\\w*|external\\w*|exterior|outside|weather\\w*|balcon\\w*|terrace|patio|driveway|exposed(?! aggregate))\\b'), ev: re('\\b(external|exterior|outdoor|outside|balcon|terrace|exposed to (weather|uv)|weather)\\w*') },
  { id: 'wet', label: 'wet areas', q: re('\\b(shower|bathroom|wet area|wet rooms?|laundry|ensuite|bath)\\b'), ev: re('wet (area|room)s?|shower|bathroom|laundry|bath\\b|ensuite') },
  { id: 'pool', label: 'swimming pools', q: re('\\b(pool|spa|swimming)\\b'), ev: re('swimming pool|\\bpools?\\b|\\bspa\\b|submerg|immers|water tank') },
  { id: 'heated', label: 'heated floors', q: re('\\b(heated|under ?floor heating|in[- ]?floor heating)\\b'), ev: re('under ?floor heating|heated floor|floor heating') },
  { id: 'timber', label: 'timber substrates', q: re('\\b(timber|plywood|wood\\w*|chipboard)\\b'), ev: re('timber|plywood|wood|chipboard|particle') },
  { id: 'vinyl', label: 'floor coverings such as vinyl and carpet', q: re('\\b(vinyl|carpet|floor covering|floorcovering|planks)\\b'), ev: re('vinyl|carpet|floor ?covering|resilient|floor covering|lvt|linoleum') },
  { id: 'internal', label: 'internal use', q: re('\\b(internal|interior|indoor|inside)\\b'), ev: re('\\binternal|interior|indoor') },
  { id: 'food', label: 'food and hygienic areas', q: re('\\b(food|kitchen|abattoir|dairy|brewery|hygienic|hospital)\\b'), ev: re('food|hygien|kitchen|abattoir|dairy|brewer|hospital') },
  { id: 'chemical', label: 'chemical exposure', q: re('\\b(chemical\\w*|acid\\w*|solvent|fuel|oil)\\b'), ev: re('chemical|acid|solvent|fuel|oil') },
  { id: 'hot', label: 'hot weather', q: re('\\b(hot|summer|warm|heat)\\b'), ev: re('hot (weather|climate|conditions)|high temperature|warm|summer|extended (open|working)|long open') },
  { id: 'cold', label: 'cold weather', q: re('\\b(cold|winter|frost|low temperature|too cold)\\b'), ev: re('cold|low temperature|winter|frost|\\b\\+?[0-5] ?°c') },
  { id: 'large_format', label: 'large format tiles', q: re('\\b(large format|big tiles?|oversize\\w*|1200|600 ?x ?600|rectified|lft)\\b'), ev: re('large format|non[- ]slump|oversize|rectified|large tile') },
  { id: 'stone', label: 'natural stone', q: re('\\b(natural stone|marble|granite|travertine|slate|limestone|stone)\\b'), ev: re('natural stone|marble|granite|travertine|slate|limestone|stone') },
  { id: 'glass', label: 'glass and mosaic tiles', q: re('\\b(glass|mosaic)\\b'), ev: re('glass|mosaic') },
  { id: 'porcelain', label: 'porcelain tiles', q: re('\\b(porcelain|vitrified)\\b'), ev: re('porcelain|vitrified|low[- ]absorption') },
  { id: 'existing_tile', label: 'tiling over existing tiles', q: re('\\b(existing tiles?|old tiles?|over tiles?|tile over tile|tiling over)\\b'), ev: re('existing (ceramic )?tiles?|over (existing )?tiles?|tile[- ]over[- ]tile') },
  { id: 'plasterboard', label: 'plasterboard', q: re('\\b(plasterboard|gyprock|drywall)\\b'), ev: re('plasterboard|gypsum|drywall') },
  { id: 'brick', label: 'brick slips', q: re('\\bbrick slips?\\b'), ev: re('brick slip') },
  { id: 'concrete', label: 'concrete', q: re('\\b(concrete|slab)\\b'), ev: re('concrete') },
  { id: 'green', label: 'low emissions or Green Star', q: re('\\b(low voc|green star|eco|sustainab\\w*|environment\\w*)\\b'), ev: re('\\bvoc\\b|green star|sustainab|low emission') },
  { id: 'flexible', label: 'flexibility and movement', q: re('\\b(flexible|flexibility|movement|elastic|flex)\\b'), ev: re('flexib|elastic|movement|crack[- ]bridging') },
  { id: 'strength', label: 'high strength', q: re('\\b(high strength|strong|structural|heavy duty|load bearing)\\b'), ev: re('high (early )?strength|structural|heavy[- ]duty|load[- ]bearing|high load') },
  { id: 'traffic', label: 'traffic and heavy loads', q: re('\\b(car ?park|garage|traffic|forklift|warehouse|heavy)\\b'), ev: re('car ?park|traffic|forklift|heavy|abrasion|mechanical') },
  { id: 'static', label: 'static control', q: re('\\b(anti ?static|static|esd|conductive|electronics)\\b'), ev: re('esd|static|conductiv|electronic') },
  { id: 'underwater', label: 'underwater use', q: re('\\b(underwater|submerged|immersion|water tank)\\b'), ev: re('underwater|submerg|immers|water tank|potable') },
  { id: 'dust', label: 'low dust', q: re('\\b(dustless|dust less|low dust|no dust)\\b'), ev: re('dust') },
  { id: 'cracks', label: 'crack repair', q: re('\\bcracks?\\b'), ev: re('crack') },
  { id: 'leak', label: 'stopping leaks', q: re('\\b(leak\\w*|stop a water leak|water ingress)\\b'), ev: re('leak|water ingress|seep|infiltrat|watertight|waterproof|sealing|seal ') },
  { id: 'fire', label: 'fire resistance', q: re('\\bfire\\b'), ev: re('fire') },
  { id: 'pond', label: 'ponds', q: re('\\bpond\\b'), ev: re('pond') },
  { id: 'toys', label: 'children and toys', q: re('\\b(kids?|child\\w*|toys?|baby|babies)\\b'), ev: re('\\btoys?\\b|baby|babies|safe for child|child[- ]safe') },
  { id: 'mould', label: 'mould resistance', q: re('\\b(mould\\w*|mold\\w*|fungi|fungal)\\b'), ev: re('mould|mold|fung|bacteri') },
];
const LISTQ = /\b(what|which)\b.*\b(do|does|can)\b.*\b(make|sell|have|offer|stock|supply|produce|provide)\b|\b(list|range of|all the|all|every)\b|\bwhat .* (are there|is there)\b|\bwhat .* (does|do) (sika|davco|you)\b/;
const KIND_WORDS = new Set(['adhesive', 'glue', 'sealant', 'screed', 'grout', 'waterproof', 'membrane', 'mortar', 'tile', 'product', 'sika', 'make', 'need', 'use', 'best', 'good', 'floor', 'concrete', 'primer', 'additive', 'coating', 'resin', 'epoxy', 'admixture'].map((w) => stem(w)));
const SKIPNAME = /accessor|extender|spacer|clip|tool|holder|retainer|joist|shim|bearer|brace|wall ?joiner/i;

export const EXTRA_WORDS = ['injection', 'waterproofing', 'levelling', 'adhesive', 'sealant', 'membrane', 'concrete', 'coverage', 'strength', 'temperature', 'thickness', 'humidity', 'automotive', 'packaging', 'specification', 'warranty', 'technical', 'stockist', 'distributor', 'pedestal', 'plasterboard', 'bathroom', 'kitchen', 'laundry', 'balcony', 'aggregate', 'flooring', 'porcelain', 'ceramic', 'existing', 'contact', 'conditions', 'company', 'repairs', 'cracks'];
export function createAdvisor({ load, isWord }) {
  const cache = new Map();
  async function entries(kind) {
    const out = [];
    for (const c of kind.cats) {
      let sh = cache.get(c); if (sh === undefined) { sh = load.advisor ? await load.advisor(c) : null; cache.set(c, sh); }
      if (!sh) continue;
      for (const e of sh.products) {
        const ee = { ...e, cat: c };
        if (kind.test) { if (!kind.test(ee)) continue; }
        else {
          const okSub = kind.sub ? kind.sub.test(ee.sub) : false; const okName = kind.name ? kind.name.test(ee.id + ' ' + ee.n) : false; const okExtra = kind.extra ? kind.extra.test(ee.id) : false;
          if (kind.both ? !(okSub && okName) : !(okSub || okName || okExtra)) continue;
          if (kind.notName && kind.notName.test(ee.n + ' ' + ee.id)) continue;
        }
        if (SKIPNAME.test(ee.n) && !kind.paving) continue;
        out.push(ee);
      }
    }
    return out;
  }
  const sentenceOf = (text, rx) => {
    const segs = String(text).split(/(?<=[.!?])\s+|\s+[•·]\s+|\s+\|\s+/).map((s) => s.trim()).filter(Boolean);
    const hit = segs.find((s) => rx.test(s)) || text;
    return clampText(hit.replace(/^[•·-]\s*/, ''), null, 260);
  };
  const ORDER = { usage: 0, feature: 1, summary: 2 };
  function evidence(e, cond) {
    const hits = e.ev.filter((x) => cond.ev.test(x.t)).sort((a, b) => (ORDER[a.k] ?? 3) - (ORDER[b.k] ?? 3));
    if (!hits.length) return null;
    const sh = cond.strong ? hits.filter((x) => cond.strong.test(x.t)) : hits; const use = sh.length ? sh : hits;
    return { sentence: sentenceOf(use[0].t, sh.length && cond.strong ? cond.strong : cond.ev), n: hits.length, strong: !cond.strong || sh.length > 0 };
  }
  const pageFact = (e, sentence) => fact({ source_url: e.u, page: null, sentence, doc_type: 'WEB' });
  const handoffTo = (q) => ({ question: q, product: '', reason: 'The data sheets cannot see your site, substrate or conditions, so Technical Services should confirm the fit before you order.', missing: [] });

  let LEX = null;
  const lexicon = () => { if (LEX) return LEX; const w = new Set(); for (const k of [...KINDS, ...CONDS]) for (const m of k.q.source.matchAll(/[a-z]{5,}/g)) if (!/^(\\w|\\b)/.test(m[0]) || true) w.add(m[0]); for (const x of EXTRA_WORDS) w.add(x); LEX = [...w].filter((x) => !/^(rated|equal|about|which|their)$/.test(x)); return LEX; };
  const correct = (s) => s.split(' ').map((x) => { if (x.length < 5 || /\d/.test(x) || (isWord && isWord(x))) return x; const L = lexicon(); if (L.includes(x) || L.some((l) => l.startsWith(x))) return x; let best = null, bd = 9; const max = x.length >= 9 ? 2 : 1; for (const l of L) { if (Math.abs(l.length - x.length) > max + 4) continue; const d = Math.min(Math.abs(l.length - x.length) <= max ? (dist(x, l, max) <= 1 || x.slice(0, 2) === l.slice(0, 2) ? dist(x, l, max) : 9) : 9, l.length >= 7 && x.length >= 9 ? Math.min(dist(x.slice(0, l.length), l, 2), dist(x.slice(0, l.length + 1), l, 2)) : 9); if (d < bd) { bd = d; best = l; } } return best && bd <= max ? best : x; }).join(' ');
  const singular = (s) => s.split(' ').map((w) => (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w) ? w.slice(0, -1) : w)).join(' ');
  const BRANDS = [['davco', /^davco/], ['lanko', /^lanko/], ['sikatile', /^sikatile/], ['sarnafil', /^sarna/], ['schonox', /^schoenox/], ['abelflex', /^abelflex/]];
  async function advise(q, n0, rel, force) {
    const n = singular(correct(n0));
    const kind = KINDS.find((k) => k.q.test(n)); if (!kind) return null;
    let list = await entries(kind); if (!list.length) return null;
    const brand = BRANDS.find(([w]) => new RegExp('\\b' + w + '\\b').test(n));
    if (brand) { let b = list.filter((e) => brand[1].test(e.id));
      if (!b.length) { const m = kind.q.exec(n); const kw = m ? new RegExp((m[0].match(/[a-z]{5,}/) || ['xxxxx'])[0].slice(0, 6), 'i') : null; const extra = await entries({ cats: [T, FL, SA, WP, CR], sub: re('.') }); b = extra.filter((e) => brand[1].test(e.id) && kw && (kw.test(e.n) || kw.test(e.tg) || kw.test(e.sub))); }
      if (b.length) list = b; }
    const conds = CONDS.filter((c) => c.q.test(n) && !(c.id === 'wet' && kind.id === 'tile_waterproofing') && !(c.id === 'concrete' && /concrete|screed|grout|anchor|repair/.test(kind.id) && false));
    const condsNT = conds.filter((c) => !['concrete', 'internal'].includes(c.id));
    const isList = LISTQ.test(n0) && !condsNT.length; if (isList) conds.length = 0;
    const kwTok = [...new Set(tokens(n).filter((t) => t.length > 2 && !GENERIC.has(t) && !KIND_WORDS.has(t) && !conds.some((c) => c.q.test(t))))];
    const df = new Map(); for (const e of list) { const seen = new Set(); for (const x of [e.n, e.tg, ...e.ev.map((v) => v.t)]) for (const t of tokens(x)) seen.add(t); for (const t of seen) df.set(t, (df.get(t) || 0) + 1); }
    const kw = (e) => { if (!kwTok.length) return 0; const seen = new Set(); for (const x of [e.n, e.tg, ...e.ev.map((v) => v.t)]) for (const t of tokens(x)) seen.add(t); let s = 0; for (const t of kwTok) if (seen.has(t)) s += Math.log(1 + list.length / (df.get(t) || list.length)); return s; };
    const kwBest = (e) => { let best = null, bs = 0; for (const x of e.ev) { const st = new Set(tokens(x.t)); let c = 0; for (const t of kwTok) if (st.has(t)) c++; if (c > bs) { bs = c; best = x; } } return best; };
    const short = n.split(' ').length <= 8 && !/^(i need|i want|looking for|need|want)\b/.test(n);
    const links = []; const rows = []; const facts = []; let used = [];
    if (!isList && !conds.length && kwTok.length) {
      const hit = list.map((e) => ({ e, s: kw(e) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s || (rel ? rel(y.e.id) - rel(x.e.id) : 0) || (x.e.n < y.e.n ? -1 : 1)).slice(0, 3);
      if (hit.length && hit.length < list.length) {
        const items = hit.map(({ e }) => { const ev = kwBest(e); return { e, sentences: [ev ? sentenceOf(ev.t, new RegExp(kwTok.map((t) => t.replace(/[^a-z0-9]/g, '')).filter(Boolean).join('|'), 'i')) : (e.tg || e.ev[0].t)], why: 'your words', th: null }; });
        const summary = card({ type: 'advice', status: 'PUBLISHED', title: `${cap(kind.label)} that match your words`, headline: 'No particular condition was named, so these are the products whose published text uses your words, closest first. This is not a claim that one is the best.',
          lines: [], facts: [fact({ source_url: items[0].e.u, sentence: items[0].sentences[0], doc_type: 'WEB' })], chip: CHIPS.ADVICE, links: items.map((x) => ({ label: x.e.n, url: x.e.u })), handoff: handoffTo(q), followups: items.slice(0, 3).map((x) => `Data sheet for ${x.e.n}`) });
        return { summary, items };
      }
    }
    if (!force && !isList && !conds.length && !short && !/\b(best|top|better|recommend\w*|good|right|which|what should|ideal|suitable)\b|\bwhat (do i|should i|can i|would you|holds?|sticks?|fixes|works|goes)\b|\bhow do i (fix|stick|seal|fill|waterproof|bond|glue|repair)\b/.test(n)) return null;
    if (isList || !conds.length) {
      used = list.slice(0, 14);
      for (const e of used) { const s = e.tg || e.ev[0].t; const f = pageFact(e, clampText(s, null, 240)); facts.push(f); rows.push([e.n, f.sentence]); links.push({ label: e.n, url: e.u }); }
      const c = card({ type: 'advice', status: 'PUBLISHED', title: isList ? `${cap(kind.label)} in the Sika Australia range` : `${cap(kind.label)}: the published range`, headline: isList ? 'These are the products in that group on the Sika Australia site, each with its published description.' : 'You did not name a condition for the job, so I am not ordering these. They are the products in that group on the Sika Australia site, each with its published description. Tell me the job (area, place, surface) and I will name the ones whose published text documents a fit.',
        lines: [], facts, source: facts[0], chip: CHIPS.ADVICE, links, table: { cols: ['Product', 'What the published text says'], rows }, handoff: isList ? null : handoffTo(q), followups: used.slice(0, 3).map((e) => `Data sheet for ${e.n}`) });
      return { summary: c, items: [] };
    }
    // score by documented conditions
    const scored = list.map((e) => { const got = []; const miss = []; for (const c of conds) { const ev = evidence(e, c); if (ev) got.push({ c, ev }); else miss.push(c); } return { e, got, miss, score: got.reduce((s, g) => s + (g.ev.strong ? 1 : 0.5), 0) + got.filter((g) => g.c.primary && g.ev.strong).length * 0.5, hits: got.reduce((s, g) => s + g.ev.n, 0) }; });
    const needAll = conds.length <= 2 ? 1 : Math.ceil(conds.length / 2);
    let fit = scored.filter((s) => s.got.length >= needAll);
    const bigJob = conds.some((c) => c.id === 'large' || c.id === 'pump' || c.id === 'thick');
    if (kwTok.length && fit.some((f) => kw(f.e) > 0)) { const mx = Math.max(...fit.map((f) => kw(f.e))); fit = fit.filter((f) => kw(f.e) >= mx * 0.6); }
    fit.sort((a, b) => b.score - a.score || (bigJob ? (b.e.th ? b.e.th.max : 0) - (a.e.th ? a.e.th.max : 0) : 0) || (kw(b.e) - kw(a.e)) || ((rel ? rel(b.e.id) : 0) - (rel ? rel(a.e.id) : 0)) || b.hits - a.hits || (a.e.n < b.e.n ? -1 : 1));
    if (!fit.length) {
      const names = conds.map((c) => c.label).join(' and ');
      const c = card({ type: 'advice', status: 'UNKNOWN', title: `${cap(kind.label)}: no documented fit found`, headline: NOFIT, facts: [], source: null, chip: CHIPS.UNKNOWN, links: list.slice(0, 8).map((e) => ({ label: e.n, url: e.u })), table: null,
        handoff: { question: q, product: '', reason: `No product in this group has published text that mentions ${names}. The range is linked here. Please ask Technical Services.`, missing: conds.map((x) => x.label) }, followups: [] });
      return { summary: c, items: [] };
    }
    const top = fit.slice(0, 3); const critNames = conds.map((c) => c.label).join(', ');
    const items = [];
    for (const s of top) {
      const first = s.got[0]; const ex = s.got.slice(1).map((g) => g.ev.sentence).filter((t) => t !== first.ev.sentence).slice(0, 1);
      items.push({ e: s.e, sentences: [first.ev.sentence, ...ex], why: s.got.map((g) => g.c.label).join(', '), th: bigJob ? s.e.th : null, weak: !first.ev.strong });
    }
    const lines = [{ label: 'Criterion used', text: bigJob ? `Published text that mentions ${critNames}, then the thickest layer the data sheet gives.` : `How many of these conditions the published text mentions: ${critNames}.` }];
    const notCovered = top.filter((s) => s.miss.length).map((s) => `${s.e.n}: ${s.miss.map((m) => m.label).join(', ')}`);
    if (notCovered.length) lines.push({ label: 'Not stated in the published text', text: notCovered.slice(0, 3).join('; ') });
    const summary = card({ type: 'advice', status: 'PUBLISHED', title: `${cap(kind.label)} whose published text documents a fit`, headline: 'Products whose own published text documents a fit, in the order of the criterion below. This is not a claim that one is the best. Each card quotes its sentence.',
      lines, facts: [fact({ source_url: items[0].e.u, sentence: items[0].sentences[0], doc_type: 'WEB' })], chip: CHIPS.ADVICE, links: top.map((s) => ({ label: s.e.n, url: s.e.u })), handoff: handoffTo(q), followups: top.slice(0, 3).map((s) => `Data sheet for ${s.e.n}`) });
    return { summary, items };
  }
  const NOFIT = 'No product in this group states a fit for what you asked in its published text, so I will not name one. The range is linked below.';
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // "which has the longest open time / fastest cure": a sort over the published figures, each one cited
  const NUM = [
    { rx: /\b(longest|longer|most|extended|long)\b.*\bopen time|\bopen time\b.*\b(longest|longer|most)\b/, field: 'open_time', dir: 'max', label: 'the longest published open time' },
    { rx: /\b(longest|longer|most|long)\b.*\bpot life|\bpot life\b.*\b(longest|longer|most)\b|\b(longest|most) working time/, field: 'pot_life', dir: 'max', label: 'the longest published pot life' },
    { rx: /\b(longest|longer|most)\b.*\badjust\w*/, field: 'adjustability_time', dir: 'max', label: 'the longest published adjustability time' },
    { rx: /\b(fastest|quickest|shortest|rapid)\b.*\b(cure|curing|set|setting|dry|drying|hardening)\b|\bfastest\b/, field: 'cure_times', dir: 'min', label: 'the shortest published cure or set time' },
    { rx: /\b(fastest|quickest|shortest)\b.*\bskin\w*/, field: 'skin_tack_times', dir: 'min', label: 'the shortest published skin time' },
  ];
  const MIN = { s: 1 / 60, sec: 1 / 60, min: 1, mins: 1, minute: 1, minutes: 1, h: 60, hr: 60, hrs: 60, hour: 60, hours: 60, d: 1440, day: 1440, days: 1440, week: 10080, weeks: 10080 };
  const toMin = (f) => { const p = f.parsed; if (!p || p.model !== 'duration' || p.min == null || !MIN[String(p.unit).toLowerCase()]) return null; return { lo: p.min * MIN[String(p.unit).toLowerCase()], hi: (p.max == null ? p.min : p.max) * MIN[String(p.unit).toLowerCase()] }; };
  async function rank(q, n0, kindId) {
    const n = singular(correct(n0)); const spec = NUM.find((x) => x.rx.test(n)); if (!spec) return null;
    const kind = KINDS.find((k) => k.q.test(n)); if (!kind) return null;
    const list = await entries(kind); const got = [];
    for (const e of list) { const sh = await load.product(e.id); const f = sh && sh.tm && (sh.tm[spec.field] || [])[0]; const m = f && toMin(f); if (m) got.push({ e, f, m }); }
    if (got.length < 2) return null;
    got.sort((a, b) => (spec.dir === 'max' ? b.m.hi - a.m.hi : a.m.lo - b.m.lo) || (a.e.n < b.e.n ? -1 : 1));
    const top = got.slice(0, 4);
    const items = top.map(({ e, f }) => ({ e, sentences: [f.text], facts: [{ source_url: f.s && f.s.u ? f.s.u : e.u, page: f.s ? f.s.p : null, sentence: f.text, status: 'PUBLISHED', doc_type: f.s ? f.s.t : 'WEB', doc_version: f.s ? f.s.v : '' }], why: spec.label, th: null }));
    const summary = card({ type: 'advice', status: 'PUBLISHED', title: `${cap(kind.label)} ordered by ${spec.label}`, headline: 'These are ordered by the published figure, each quoted from its data sheet. The figures depend on temperature and mix, so check the sheet. It is not a claim that one is the best.', lines: [{ label: 'Criterion used', text: `Ordered by ${spec.label}, taken from each product's own data sheet.` }], facts: [items[0].facts[0]], chip: CHIPS.ADVICE, links: top.map(({ e }) => ({ label: e.n, url: e.u })), handoff: handoffTo(q), followups: top.slice(0, 3).map(({ e }) => `Data sheet for ${e.n}`) });
    return { summary, items };
  }
  const ENVKIND = new Set(['tile_adhesive', 'tile_waterproofing', 'tile_grout', 'screed', 'tile_primer']);
  return { advise, rank, envAsk: (n0, kindId) => ENVKIND.has(kindId) && !/\b(inside|internal|interior|indoor|outside|outdoor|external|exterior|balcon\w*|terrace|pool|wet|shower|bathroom|laundry|kitchen)\b/.test(n0), kindOf: (n0) => { const n = singular(correct(n0)); const k = KINDS.find((x) => x.q.test(n)); return k ? k.id : null; }, kinds: KINDS, words: () => lexicon(), hasKind: (n0) => { const n = singular(correct(n0)); return KINDS.some((k) => k.q.test(n)); }, wants: (n0) => { const n = singular(correct(n0)); return KINDS.some((k) => k.q.test(n)) && (LISTQ.test(n0) || /\b(best|better|recommend\w*|which|what .* (for|to use))\b/.test(n)); } };
}
