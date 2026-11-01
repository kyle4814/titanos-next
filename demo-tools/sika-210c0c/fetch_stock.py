#!/usr/bin/env python3
"""fetch_stock.py: illustrative stock photos for every Sika portal category, from Wikimedia Commons (keyless API).
Re-runnable and resumable: a category already in stock_source.json (with its files on disk) is skipped; --redo <id> forces one.
Rules: User-Agent with the contact email on every request, at most 1 request a second, only these licences are accepted:
CC0, Public domain, CC BY 2.0/3.0/4.0, CC BY-SA 2.0/3.0/4.0. Source JPEG/PNG at least 960 px wide, landscape.
Output: assets/img/s/<slug>-480.webp and -960.webp (3:2) and stock_source.json (credit data copied from the API response).
Round 2 (2026-11-01): EVERY category gets its own distinct photo (no inheritance). HD rules: source at least 1600 px wide (1200 only as a recorded fallback), 4:3 or wider,
no scans / drawings / black and white, sharpness (variance of the Laplacian at 960 px wide) above SHARP_FLOOR and the bottom 20% of each query's candidates dropped.
Outputs: -480 and -960 and -1600 WebP (3:2). Per category the record says mode: own / fallback-unique / none.
usage: python3 fetch_stock.py [portalDir] [--redo id ...] [--limit N]
"""
import json, os, re, sys, time, io, html, hashlib, urllib.request, urllib.parse, urllib.error
from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:]]
redo = set(); limit = None
while '--redo' in args:
    i = args.index('--redo'); redo.add(args[i + 1]); del args[i:i + 2]
if '--limit' in args:
    i = args.index('--limit'); limit = int(args[i + 1]); del args[i:i + 2]
PORTAL = os.path.abspath(args[0] if args else os.path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'))
OUT = os.path.join(PORTAL, 'assets', 'img', 's')
SRC = os.path.join(HERE, 'stock_source.json')
CACHE = os.environ.get('STOCK_CACHE', os.path.join(HERE, '.stock_cache'))
UA = 'TITANOS demo build (kyle@titanos.tech)'
API = 'https://commons.wikimedia.org/w/api.php'
MINW, FALLBACK_W = 1600, 1200
SHARP_FLOOR = 150.0  # variance of the Laplacian at 960 px wide; set from the 62 earlier photos (min 100, 2nd lowest 277, median 1.7k, see the PHOTOS2 receipt)
REL_FLOOR = 2        # a chosen photo's Commons title + description + categories must contain at least this many distinct words of the category's domain list
OK_LICENCE = re.compile(r'^(CC0( 1\.0)?|Public domain|CC BY (2|3|4)\.0|CC BY-SA (2|3|4)\.0)$', re.I)
BAD_TITLE = re.compile(r'scan\b|scanned|black and white|black-and-white|b&w|monochrome|grayscale|greyscale|sepia|vintage|rendering|logo|map\b|diagram|poster|scheme|icon|flag|coat of arms|portrait|\bsvg\b|screenshot|stamp|cartoon|painting|drawing|illustration|chart|advert|brochure|study for|sketch|engraving|lithograph|miniature|model of', re.I)

# search queries per category id (tried in order; first with an acceptable hit wins). Roots and level 2 are hand tuned.
Q = {
 'construction': ['modern building construction site concrete', 'construction site building'],
 'industry': ['industrial manufacturing assembly line', 'factory production line'],
 'products': ['construction materials building site'],
 'construction/concrete': ['concrete pour construction site', 'concrete pouring slab'],
 'construction/concrete-repair-protection': ['concrete repair bridge', 'concrete spalling repair'],
 'construction/flooring': ['epoxy floor industrial warehouse', 'resin flooring', 'polished concrete floor', 'industrial floor coating'],
 'construction/grouts-anchoring': ['anchor bolts base plate grout', 'grouting anchor bolt'],
 'construction/landscape-buildingproducts': ['green roof building garden', 'paving landscape garden'],
 'construction/roofing': ['flat roof membrane installation', 'roofing membrane roll'],
 'construction/sealants-adhesives': ['sealant bead caulking joint', 'caulking gun silicone'],
 'construction/structural-strengthening': ['carbon fibre reinforced polymer bridge', 'bridge girder repair', 'concrete beam strengthening', 'carbon fibre strengthening beam'],
 'construction/tile-stone-installationsystems': ['tiling floor installation', 'tiler laying tiles'],
 'construction/waterproofing': ['waterproofing membrane roller', 'waterproofing basement wall'],
 'industry/appliance-and-equipment': ['air conditioning unit installation', 'HVAC ductwork'],
 'industry/automotive-aftermarket': ['car body repair shop', 'auto body repair', 'automotive repair workshop'],
 'industry/building-components': ['curtain wall facade glass building', 'window frame installation'],
 'industry/marine': ['yacht marina boats', 'shipyard ship hull', 'boat deck'],
 'industry/transportation': ['bus assembly plant', 'truck assembly line', 'railway carriage interior', 'bus manufacturing assembly'],
 # level 3
 'construction/concrete-repair-protection/concrete-mortarsadmixtures': ['concrete mortar trowel'],
 'construction/concrete-repair-protection/concrete-repair-mortars': ['concrete repair patching trowel', 'repairing concrete column'],
 'construction/concrete-repair-protection/corrosion-inhibitorssacrificialanodes': ['sacrificial anode corrosion', 'rusted reinforcement concrete'],
 'construction/concrete-repair-protection/corrosion-management': ['corroded rebar concrete', 'reinforcing steel corrosion concrete'],
 'construction/concrete-repair-protection/protective-coatingslinings': ['protective coating concrete tank', 'painting concrete wall coating'],
 'construction/concrete-repair-protection/silane-impregnations': ['water repellent concrete surface', 'water beading on concrete'],
 'construction/concrete/admixture-technology': ['concrete mixer truck', 'concrete slump test'],
 'construction/concrete/cement-admixtures': ['cement plant', 'cement mill'],
 'construction/concrete/fibres': ['steel fibre reinforced concrete', 'fibre reinforced concrete'],
 'construction/concrete/pre-cast': ['precast concrete panel', 'precast concrete factory'],
 'construction/concrete/specialty-products': ['concrete finishing floor', 'exposed aggregate concrete'],
 'construction/flooring/cement-levellingsystems': ['self levelling screed floor', 'screed floor pour'],
 'construction/flooring/floor-joints': ['concrete floor joint', 'floor expansion joint'],
 'construction/flooring/flooring-adhesivessystems': ['vinyl flooring installation', 'timber floor installation'],
 'construction/flooring/resin-flooring': ['resin floor application', 'epoxy floor coating'],
 'construction/grouts-anchoring/cementitious-grouts': ['grouting machine base', 'grout pump'],
 'construction/grouts-anchoring/chemical-anchoring': ['chemical anchor drilling concrete', 'drilling concrete anchor'],
 'construction/grouts-anchoring/epoxy-grouts': ['epoxy grout machine foundation', 'machine base grouting'],
 'construction/grouts-anchoring/rail-fixing': ['railway track fastening sleeper', 'railway track concrete sleepers'],
 'construction/grouts-anchoring/windfarm-grouts': ['wind turbine foundation tower', 'wind turbine tower base'],
 'construction/landscape-buildingproducts/green-roofs-and-greenwallssystems': ['green roof sedum', 'green wall vertical garden'],
 'construction/landscape-buildingproducts/paving-decking-support': ['paving stones laying', 'paver installation patio'],
 'construction/landscape-buildingproducts/subsoil-drainage': ['drainage pipe trench', 'subsoil drain installation'],
 'construction/landscape-buildingproducts/turf-soil-stabilisation': ['slope stabilisation geotextile', 'erosion control slope'],
 'construction/roofing/liquid-applied-membranes': ['liquid applied roof coating', 'roof coating roller'],
 'construction/roofing/pvc-sheet-membranes': ['PVC roof membrane', 'single ply roofing'],
 'construction/roofing/sheet-membranes-accessories': ['roof membrane flashing detail', 'roof membrane seam welding'],
 'construction/roofing/torch-on-sheet-membranes': ['torch on roofing bitumen', 'bitumen membrane torch roof'],
 'construction/sealants-adhesives/backing-rod-foamtapes': ['backing rod joint sealing', 'foam tape'],
 'construction/sealants-adhesives/cleaners-activatorsprimers': ['cleaning surface before bonding', 'primer brush surface'],
 'construction/sealants-adhesives/construction-adhesives': ['construction adhesive cartridge', 'adhesive gun construction'],
 'construction/sealants-adhesives/contact-adhesives': ['contact adhesive spreading', 'gluing laminate worktop'],
 'construction/sealants-adhesives/curtain-walling-glazingandweathersealants': ['curtain wall glazing', 'glass facade building'],
 'construction/sealants-adhesives/expansion-perimeterjoints': ['expansion joint sealant building', 'building expansion joint'],
 'construction/sealants-adhesives/facade-sealants': ['facade panel joint sealant', 'building facade panel joints'],
 'construction/sealants-adhesives/foam-sealants-adhesives': ['polyurethane foam gun', 'expanding foam'],
 'construction/sealants-adhesives/paint-preparation': ['painter preparing wall filler', 'wall filling sanding paint'],
 'construction/sealants-adhesives/passive-fire-protection': ['fire stopping penetration seal', 'firestop cables wall'],
 'construction/sealants-adhesives/roofing-sealantsadhesives': ['roof sealant application', 'roof flashing sealant'],
 'construction/sealants-adhesives/sanitary-sealants': ['silicone bathroom sealant', 'bathroom silicone sealing bath'],
 'construction/sealants-adhesives/specialty-sealants': ['sealant gun joint', 'caulking window'],
 'construction/sealants-adhesives/swimming-pools': ['swimming pool tiles', 'swimming pool construction'],
 'construction/sealants-adhesives/tapes-sealing': ['sealing tape window', 'adhesive tape application building'],
 'construction/sealants-adhesives/waterproofing-sealants': ['sealing joint waterproof', 'sealant joint concrete'],
 'construction/structural-strengthening/flexural-strengthening': ['carbon fibre plate beam strengthening', 'carbon fiber strengthening bridge'],
 'construction/structural-strengthening/shear-strengthening': ['carbon fibre wrap column', 'fibre wrap concrete column'],
 'construction/structural-strengthening/structural-adhesives': ['structural bonding epoxy adhesive', 'epoxy adhesive concrete'],
 'construction/tile-stone-installationsystems/primers-additives': ['primer roller floor', 'priming floor before tiling'],
 'construction/tile-stone-installationsystems/tile-adhesives': ['tile adhesive notched trowel', 'tiling adhesive trowel'],
 'construction/tile-stone-installationsystems/tile-care-and-cleaners': ['cleaning tiles floor', 'tile cleaning'],
 'construction/tile-stone-installationsystems/tile-grouts': ['grouting tiles float', 'tile grout float'],
 'construction/tile-stone-installationsystems/waterproofing': ['bathroom waterproofing before tiling', 'shower waterproofing membrane'],
 'construction/waterproofing/66807': ['waterstop concrete joint', 'construction joint concrete waterstop'],
 'construction/waterproofing/basement-sheet-membranes': ['basement waterproofing membrane', 'foundation wall waterproofing'],
 'construction/waterproofing/bridge-deck-waterproofingsystems': ['bridge deck waterproofing', 'bridge deck construction'],
 'construction/waterproofing/injections-and-hydrophilicsystems': ['injection grouting concrete leak', 'crack injection concrete'],
 'construction/waterproofing/liquid-applied-membranes': ['liquid waterproofing membrane applied', 'waterproofing membrane roller'],
 'construction/waterproofing/pvc-sheet-membranesfortunnelsandcrosspassages': ['tunnel waterproofing membrane', 'tunnel lining construction'],
 'construction/waterproofing/spray-applied-membranes': ['spray applied waterproofing', 'spraying coating roof'],
 'industry/appliance-and-equipment/hvac': ['HVAC ducts building', 'air conditioning ducts'],
 'industry/automotive-aftermarket/accessories': ['car windscreen tools', 'windscreen replacement tools'],
 'industry/automotive-aftermarket/auto-glass-replacement': ['windscreen replacement', 'car windshield replacement'],
 'industry/automotive-aftermarket/panel-bonding': ['car body panel repair', 'car panel repair workshop'],
 'industry/automotive-aftermarket/sealing-and-bonding': ['car body seam sealing', 'automotive body sealing'],
 'industry/building-components/building-elements': ['sandwich panel building', 'prefabricated building elements'],
 'industry/building-components/facade': ['glass facade building', 'cladding facade panels'],
 'industry/building-components/windows': ['window manufacturing', 'double glazed window'],
 'industry/marine/leisure-boats-andyachts': ['yacht building', 'yacht interior boat'],
 'industry/marine/shipbuilding-and-offshore': ['shipbuilding hull', 'offshore platform'],
 'industry/transportation/body-panel-adhesive': ['bus body panel', 'truck body panel'],
 'industry/transportation/glass-windshield-adhesive': ['bus windscreen', 'train windscreen'],
 'industry/transportation/interior-exteriorsealing': ['train carriage exterior', 'truck cab exterior'],
 'industry/transportation/metal-adhesive': ['aluminium vehicle body welding', 'vehicle chassis aluminium'],
 'industry/transportation/sandwich-panel-adhesive': ['sandwich panel truck body', 'refrigerated truck body'],
 # selected level 4 and 5 with a strong visual identity
 'construction/concrete/admixture-technology/high-range-waterreducers': ['self compacting concrete', 'concrete flow test'],
 'construction/concrete/pre-cast/release-agents': ['formwork release agent', 'concrete formwork'],
 'construction/concrete/specialty-products/concrete-essentials-pigment': ['coloured concrete pigment', 'coloured concrete'],
 'construction/concrete/specialty-products/masonry-block-andpaveradmixtures': ['concrete paver block', 'concrete masonry block'],
 'construction/flooring/resin-flooring/epoxy-flooring-productssystems': ['epoxy flooring', 'epoxy floor garage'],
 'construction/flooring/resin-flooring/polyurethane-flooringproductssystems': ['polyurethane floor industrial', 'industrial floor food factory'],
 'construction/flooring/resin-flooring/purcem-flooring-productssystems': ['industrial floor kitchen', 'commercial kitchen floor'],
 'construction/grouts-anchoring/windfarm-grouts/offshore-grouts': ['offshore wind turbine foundation', 'offshore wind farm'],
 'construction/grouts-anchoring/windfarm-grouts/onshore-grouts': ['onshore wind turbine tower', 'wind turbine construction'],
 'construction/landscape-buildingproducts/green-roofs-and-greenwallssystems/extensive-green-roof': ['extensive green roof sedum', 'sedum roof'],
 'construction/landscape-buildingproducts/green-roofs-and-greenwallssystems/green-walls': ['green wall building', 'living wall'],
 'construction/landscape-buildingproducts/green-roofs-and-greenwallssystems/intensive-green-roof': ['roof garden terrace', 'rooftop garden'],
 'construction/landscape-buildingproducts/paving-decking-support/paving': ['paving patio', 'paved terrace'],
 'construction/landscape-buildingproducts/subsoil-drainage/horizontal-drainage': ['drainage board green roof', 'drainage mat'],
 'construction/landscape-buildingproducts/subsoil-drainage/vertical-drainage': ['vertical drain foundation wall', 'basement wall drainage'],
 'construction/landscape-buildingproducts/turf-soil-stabilisation/slope-stabilisation': ['slope stabilisation', 'embankment erosion control'],
 'construction/landscape-buildingproducts/turf-soil-stabilisation/turf-and-gravel-stabilisation': ['gravel driveway grid', 'gravel stabilisation grid'],
 'construction/roofing/liquid-applied-membranes/high-performanceroofingsystems': ['liquid roofing flat roof', 'flat roof coating'],
 'construction/roofing/pvc-sheet-membranes/membranes': ['single ply membrane roof', 'PVC roofing membrane'],
 'construction/waterproofing/liquid-applied-membranes/water-based-membranes': ['roller applying waterproofing coating', 'waterproof coating roller'],
 'construction/waterproofing/liquid-applied-membranes/high-performancesystems': ['balcony waterproofing', 'terrace waterproofing'],
 'industry/automotive-aftermarket/auto-glass-replacement/adhesive': ['windscreen bonding', 'windshield installation'],
 'industry/automotive-aftermarket/panel-bonding/adhesives': ['car panel bonding', 'car body repair panel'],
 'industry/building-components/facade/insulating-glass': ['insulating glass unit', 'double glazing'],
 'industry/building-components/facade/panel-cladding': ['facade cladding panels', 'cladding panels building'],
 'industry/building-components/facade/structural-glazing': ['structural glazing facade', 'glass curtain wall'],
 'industry/marine/leisure-boats-andyachts/teak-decking': ['teak deck yacht', 'teak decking boat'],
 'industry/marine/leisure-boats-andyachts/glass-bonding': ['yacht windows', 'boat windows'],
 'industry/marine/shipbuilding-and-offshore/flooring-acoustics': ['ship cabin floor', 'ship interior cabin'],
}

# Round 2 (2026-11-01): hand-tuned queries for the categories that used to inherit a photo (and the tile cleaning swap).
# Per category: three hand-written variants, tried in order, 10 candidates each; the first acceptable photo not used by any other category wins.
Q.update({
 'construction/concrete-repair-protection/concrete-mortarsadmixtures': ['concrete mortar mixing', 'mortar mixer construction', 'bricklayer mortar'],
 'construction/concrete-repair-protection/protective-coatingslinings': ['concrete tank lining coating', 'epoxy coating concrete floor', 'protective coating steel concrete'],
 'construction/concrete-repair-protection/silane-impregnations': ['water repellent concrete surface', 'concrete water beading', 'concrete sealer spraying'],
 'construction/concrete/fibres': ['steel fibre reinforced concrete', 'polypropylene fibre concrete', 'fibre reinforced shotcrete'],
 'construction/flooring/cement-levellingsystems': ['self levelling floor screed', 'floor levelling compound', 'liquid screed floor'],
 'construction/flooring/floor-joints': ['floor expansion joint', 'concrete floor saw cut joint', 'industrial floor joint'],
 'construction/flooring/flooring-adhesivessystems': ['laying vinyl flooring', 'parquet floor installation', 'carpet tile installation'],
 'construction/flooring/resin-flooring': ['resin floor', 'epoxy floor warehouse', 'seamless resin flooring'],
 'construction/grouts-anchoring/chemical-anchoring': ['anchor bolt concrete drilling', 'threaded rod anchor concrete', 'drilling hole concrete'],
 'construction/grouts-anchoring/epoxy-grouts': ['machine base grouting', 'grouting base plate machine', 'equipment foundation grout'],
 'construction/landscape-buildingproducts/turf-soil-stabilisation': ['turf laying', 'soil erosion control', 'grass reinforcement mesh'],
 'construction/roofing/pvc-sheet-membranes': ['PVC roof membrane', 'single ply roof', 'thermoplastic roofing'],
 'construction/roofing/sheet-membranes-accessories': ['roof membrane flashing', 'roof drain membrane', 'roof detail membrane'],
 'construction/roofing/torch-on-sheet-membranes': ['torch applied roofing', 'bitumen roofing torch', 'bituminous roofing felt'],
 'construction/sealants-adhesives/backing-rod-foamtapes': ['backing rod joint', 'foam tape', 'joint filler foam'],
 'construction/sealants-adhesives/cleaners-activatorsprimers': ['primer applied surface', 'surface cleaning solvent wipe', 'adhesion primer brush'],
 'construction/sealants-adhesives/construction-adhesives': ['construction adhesive', 'adhesive cartridge gun', 'panel adhesive gun'],
 'construction/sealants-adhesives/contact-adhesives': ['contact adhesive', 'gluing laminate', 'applying glue brush'],
 'construction/sealants-adhesives/expansion-perimeterjoints': ['building expansion joint', 'movement joint building facade', 'expansion joint cover'],
 'construction/sealants-adhesives/facade-sealants': ['facade joint sealant', 'sealing panel joint facade', 'cladding joint sealant'],
 'construction/sealants-adhesives/foam-sealants-adhesives': ['expanding foam gun', 'polyurethane foam', 'spray foam insulation'],
 'construction/sealants-adhesives/paint-preparation': ['wall filling plaster', 'painter wall preparation', 'sanding wall paint'],
 'construction/sealants-adhesives/roofing-sealantsadhesives': ['roof sealant', 'roof flashing sealant', 'sealing roof leak'],
 'construction/sealants-adhesives/sanitary-sealants': ['silicone sealant bathroom', 'sealing shower silicone', 'bath sealant'],
 'construction/sealants-adhesives/specialty-sealants': ['sealant cartridge', 'sealant joint', 'sealing gun'],
 'construction/sealants-adhesives/tapes-sealing': ['adhesive tape', 'sealing tape window', 'butyl tape'],
 'construction/sealants-adhesives/waterproofing-sealants': ['waterproof sealant joint', 'sealing concrete joint', 'joint sealing water'],
 'construction/structural-strengthening/flexural-strengthening': ['carbon fibre plate', 'CFRP strengthening', 'beam strengthening'],
 'construction/structural-strengthening/shear-strengthening': ['carbon fibre wrap column', 'column wrapping', 'seismic retrofit column'],
 'construction/structural-strengthening/structural-adhesives': ['structural adhesive', 'epoxy adhesive', 'bonding steel plate'],
 'construction/tile-stone-installationsystems/primers-additives': ['floor primer roller', 'priming concrete floor', 'latex additive'],
 'construction/tile-stone-installationsystems/tile-adhesives': ['tile adhesive trowel', 'notched trowel tiles', 'laying floor tiles'],
 'construction/tile-stone-installationsystems/tile-care-and-cleaners': ['cleaning bathroom tiles', 'tile floor cleaning machine', 'scrubbing tile floor'],
 'construction/tile-stone-installationsystems/tile-grouts': ['tile grouting', 'grout float tile', 'grouting tiles'],
 'construction/tile-stone-installationsystems/waterproofing': ['bathroom waterproofing', 'shower waterproofing', 'wet area tiling'],
 'construction/waterproofing/66807': ['waterstop concrete', 'construction joint concrete', 'movement joint concrete'],
 'construction/waterproofing/basement-sheet-membranes': ['basement waterproofing', 'foundation waterproofing', 'foundation wall membrane'],
 'construction/waterproofing/injections-and-hydrophilicsystems': ['crack injection concrete', 'injection grouting', 'concrete leak repair'],
 'construction/waterproofing/liquid-applied-membranes': ['liquid waterproofing', 'waterproof coating roller', 'waterproofing applied balcony'],
 'construction/waterproofing/spray-applied-membranes': ['spray applied membrane', 'spraying waterproofing', 'spray coating roof'],
 'industry/automotive-aftermarket/accessories': ['windscreen tools', 'glass suction cups', 'car repair tools'],
 'industry/automotive-aftermarket/panel-bonding': ['car body panel', 'car body repair', 'body shop panel'],
 'industry/automotive-aftermarket/sealing-and-bonding': ['car body sealing', 'car door seam', 'car assembly line body'],
 'industry/building-components/building-elements': ['prefabricated building panel', 'sandwich panel', 'prefab wall panel'],
 'industry/marine/leisure-boats-andyachts': ['sailing yacht', 'motor yacht', 'boat building'],
 'industry/transportation/metal-adhesive': ['aluminium vehicle body', 'welding vehicle chassis', 'aluminium truck'],
 'construction/concrete-repair-protection/concrete-repair-mortars/cementitious-repairmortars': ['concrete repair mortar', 'repairing concrete patch', 'concrete patching'],
 'construction/concrete-repair-protection/concrete-repair-mortars/epoxy-repair-mortarsandrigidbonding': ['epoxy mortar repair', 'epoxy repair concrete', 'concrete crack epoxy'],
 'construction/concrete-repair-protection/concrete-repair-mortars/steel-reinforcmentprimers': ['rebar corrosion', 'exposed reinforcing steel', 'rusty rebar'],
 'construction/concrete-repair-protection/corrosion-management/protective-coatingssilaneimpregnations': ['concrete protective coating', 'bridge concrete coating', 'coating concrete facade'],
 'construction/concrete/admixture-technology/concrete-accelerators': ['shotcrete', 'sprayed concrete', 'tunnel shotcrete'],
 'construction/concrete/admixture-technology/corrosion-inhibitors': ['rebar corrosion concrete', 'corroded reinforcement', 'reinforced concrete corrosion'],
 'construction/concrete/admixture-technology/evaporation-retarders': ['concrete curing', 'concrete slab finishing', 'curing concrete water'],
 'construction/concrete/admixture-technology/high-range-waterreducers': ['self compacting concrete', 'flowing concrete', 'concrete pumping'],
 'construction/concrete/admixture-technology/mid-range-water-reducers': ['concrete mixer', 'ready mix concrete', 'concrete batching plant'],
 'construction/concrete/admixture-technology/retarders': ['concrete hot weather', 'ready mixed concrete truck', 'concrete placing'],
 'construction/concrete/admixture-technology/special-admixtures': ['concrete cube test', 'concrete laboratory', 'concrete sample'],
 'construction/concrete/admixture-technology/viscosity-modifyingagents': ['concrete flow table', 'concrete slump', 'tremie concrete'],
 'construction/concrete/admixture-technology/water-reducers': ['concrete placement', 'concrete vibrator', 'concrete floor pour'],
 'construction/concrete/cement-admixtures/grinding-aids': ['cement grinding', 'ball mill cement', 'cement clinker'],
 'construction/concrete/pre-cast/air-entraining-admixtures': ['precast concrete pipe', 'precast concrete beams', 'precast concrete yard'],
 'construction/concrete/specialty-products/shrinkage-reducingadmixtures': ['shrinkage cracks concrete', 'cracked concrete slab', 'concrete crack'],
 'construction/concrete/specialty-products/surface-retarders': ['exposed aggregate', 'washed concrete surface', 'concrete aggregate finish'],
 'construction/flooring/resin-flooring/floor-sealers-finishings': ['concrete floor sealer', 'garage floor coating', 'floor finish coating'],
 'construction/flooring/resin-flooring/polyurethane-flooringproductssystems': ['polyurethane floor', 'industrial floor', 'factory floor'],
 'construction/flooring/resin-flooring/purcem-flooring-productssystems': ['commercial kitchen floor', 'industrial kitchen', 'brewery floor'],
 'construction/landscape-buildingproducts/paving-decking-support/accessories': ['paving pedestal', 'raised paving', 'garden decking'],
 'construction/landscape-buildingproducts/subsoil-drainage/horizontal-drainage': ['drainage mat', 'drainage board', 'geocomposite drainage'],
 'construction/landscape-buildingproducts/turf-soil-stabilisation/turf-and-gravel-stabilisation': ['gravel stabilisation', 'gravel driveway', 'grass pavers'],
 'construction/roofing/liquid-applied-membranes/high-performanceroofingsystems': ['flat roof coating', 'liquid roofing', 'roof refurbishment'],
 'construction/roofing/liquid-applied-membranes/solvent-based-membranes': ['roof coating', 'bituminous roof coating', 'roof repair'],
 'construction/roofing/pvc-sheet-membranes/accessories': ['roof penetration flashing', 'roof pipe flashing', 'roof outlet'],
 'construction/roofing/pvc-sheet-membranes/membranes': ['single ply membrane roof', 'roof membrane', 'roofing membrane welding'],
 'construction/roofing/pvc-sheet-membranes/system-adhesives': ['roofing adhesive', 'roof insulation adhesive', 'gluing roof'],
 'construction/waterproofing/66807/chemical-resistantwaterbars': ['waterbar', 'water bar', 'PVC waterstop'],
 'construction/waterproofing/liquid-applied-membranes/high-performancesystems': ['balcony waterproofing', 'terrace waterproofing', 'waterproofing roof terrace'],
 'construction/waterproofing/liquid-applied-membranes/mortars-coatings': ['cementitious waterproofing', 'waterproofing mortar', 'concrete tank waterproofing'],
 'construction/waterproofing/liquid-applied-membranes/primers-accessories': ['primer roller concrete', 'priming concrete', 'applying primer'],
 'construction/waterproofing/liquid-applied-membranes/solvent-based-membranes': ['bituminous waterproofing', 'bitumen coating foundation', 'damp proofing'],
 'construction/waterproofing/liquid-applied-membranes/water-based-membranes': ['waterproof coating roller', 'wall waterproofing coating', 'roller coating wall'],
 'industry/automotive-aftermarket/auto-glass-replacement/accessories': ['windscreen cutting', 'car glass cutting', 'windscreen removal'],
 'industry/automotive-aftermarket/auto-glass-replacement/adhesive': ['windscreen bonding', 'windshield installation', 'car windscreen fitting'],
 'industry/automotive-aftermarket/auto-glass-replacement/adhesives-for-mirrorandbracketbonding': ['rear view mirror car', 'car interior mirror', 'windscreen mirror bracket'],
 'industry/automotive-aftermarket/panel-bonding/adhesives': ['car panel bonding', 'car repair adhesive', 'vehicle panel'],
 'industry/automotive-aftermarket/panel-bonding/dampening-protection': ['car underbody', 'underbody coating', 'vehicle underbody sealing'],
 'industry/automotive-aftermarket/panel-bonding/pre-treatment': ['car sanding body', 'car paint shop', 'car body sanding'],
 'industry/automotive-aftermarket/sealing-and-bonding/hem-flange-sealslapjoints': ['car door assembly', 'car body assembly', 'automotive body shop'],
 'industry/building-components/building-elements/building-panels': ['building panels', 'sandwich panels building', 'wall panels construction'],
 'industry/building-components/facade/panel-cladding': ['facade cladding', 'rainscreen cladding', 'metal cladding building'],
 'industry/marine/leisure-boats-andyachts/exterior-sealing': ['yacht deck', 'boat deck', 'boat hull'],
 'industry/marine/leisure-boats-andyachts/interior-sealing': ['yacht interior', 'boat cabin', 'yacht saloon'],
 'industry/marine/leisure-boats-andyachts/structural-bonding': ['boat building fibreglass', 'fibreglass boat', 'boat hull moulding'],
 'industry/marine/shipbuilding-and-offshore/decorative-floorsinternal': ['ship interior corridor', 'cruise ship interior', 'ship lounge'],
 'industry/marine/shipbuilding-and-offshore/flooring-acoustics': ['ship cabin floor', 'ship engine room', 'ferry interior'],
 'construction/flooring/resin-flooring/epoxy-flooring-productssystems/epoxy-flooring-products': ['epoxy floor', 'epoxy floor garage', 'epoxy coating floor'],
 'construction/flooring/resin-flooring/epoxy-flooring-productssystems/epoxy-flooring-systems': ['epoxy floor industrial', 'epoxy floor application', 'epoxy flooring hospital'],
 'construction/flooring/resin-flooring/polyurethane-flooringproductssystems/polyurethane-flooringproducts': ['polyurethane floor industrial', 'industrial floor food', 'warehouse floor'],
 'construction/flooring/resin-flooring/polyurethane-flooringproductssystems/polyurethane-flooringsystems': ['industrial floor coating', 'factory floor coating', 'logistics floor'],
 'construction/flooring/resin-flooring/purcem-flooring-productssystems/purcem-flooring-products': ['kitchen floor industrial', 'food processing floor', 'dairy floor'],
 'construction/flooring/resin-flooring/purcem-flooring-productssystems/purcem-flooring-systems': ['industrial floor drain', 'bakery floor', 'cold store floor'],
 'industry/marine/shipbuilding-and-offshore/decorative-floorsinternal/epoxy-smooth': ['smooth epoxy floor', 'glossy floor', 'showroom floor'],
 'industry/marine/shipbuilding-and-offshore/flooring-acoustics/damping-flooring': ['ship deck flooring', 'ship floor', 'ship deck'],
 'industry/marine/shipbuilding-and-offshore/flooring-acoustics/levelling': ['ship deck levelling', 'floor levelling', 'screeding floor'],
})


# Round 2: no category is parked on an ancestor's photo any more; the queries above are tried for every category.
CAT_NO = set()
# Categories whose photo is re-chosen with the current rules (relevance review 2026-11-01); add an id here, then run with --redo-listed.
REDO_LISTED = set(os.environ.get('STOCK_REDO', '').split())

BAN = re.compile(r'Spotted Lanternfly|Ford RS 200|Bond Equipe|Lotus Europa|Ford Falcon|Mesa tactical|F-35A|Southern Pacific|Kleinhans|Wichman Building|O.Sullivan Farmstead|One Farragut|Security Ceilings|Joint Range Complex|Aguinaldo|Heinz-Steyer|Methuen Rotary|Maison Herm|Auditorium Building|Solocator|Panel sterowania|Watson House|Artificial Stones|EFTA|Primary Industries Building|Puerto Rico Army|51st CES|Chemical Agent-Destruction|Waterproof membrane that will serve|States yacht|HMS Gannet|Vertical Assembly Building|Havana Yacht|Austin Healey|374th Civil|ASC Leiden|Durasteel|Mixed-in-place|Puf joint|Rebar lattice|Penarth|Arthur Harding|Congleton|Spitfire Manufacture|Moscow River|Bucana Bridge|Liverpool window|Blue hour|Machu Picchu|Gordige|Marquee tent|Cleaning Platform Tiles|Panzer|Rogue River|Weeds in cracks|Water Flowing Over|BETHESDA|Sence of outdoor|Repurposed Parking|Parsonage|Twinkling|Calab Ray|Tsim Sha|two chefs|Fortress Louisbourg|TGSI|Internal Drainage|St. George Terminal|Waterbar on repaired|Preservationists|Relocation Central|Pitkin|Police car|AMC Hornet|Wall-mounted solar|Bike and cladding|Pembrokeshire Yacht|SJARK|Virginia V|Goodtime|LRT1|Window Sash|Ford Panel|Tanning Patch|THz measurement|MWSS|Ford Panel|Rogue River|Haramura|Albert Bridge|Polyurethane Products|Grimy filling|Trial foam|Wildcat|McLaren|Oncology|vatican|blackboard|formula|diorama|Printing the past|Wikiversity|faucet|computer lab|Tool kit|Smart Car|Hot-melt|Photovoltaic|Latrobe Gate|Linfield Hall|poopie|Lighthouse|Bara Batashewala|Sailing Yacht A|Transport Museum|Navy Yard|Roman tegula|Stage Bldg|Bluebells|Base theater', re.I)

_last = [0.0]
def get(url, binary=False, tries=4):
    for k in range(tries):
        w = 1.05 - (time.time() - _last[0])
        if w > 0: time.sleep(w)
        _last[0] = time.time()
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA, 'Api-User-Agent': UA}), timeout=60)
            b = r.read(); return b if binary else b.decode('utf8')
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and k < tries - 1: time.sleep(5 * (k + 1)); continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if k < tries - 1: time.sleep(5 * (k + 1)); continue
            raise

def strip(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', s or ''))).strip()

def search(q):
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, 'q2_' + re.sub(r'[^a-z0-9]+', '_', q.lower()) + '.json')
    if os.path.exists(f): return json.load(open(f))
    p = {'action': 'query', 'generator': 'search', 'gsrsearch': q + ' filetype:bitmap', 'gsrnamespace': '6', 'gsrlimit': '10', 'prop': 'imageinfo',
         'iiprop': 'url|extmetadata|size|mime', 'iiurlwidth': '1600', 'format': 'json'}
    j = json.loads(get(API + '?' + urllib.parse.urlencode(p, quote_via=urllib.parse.quote)))
    json.dump(j, open(f, 'w'))
    return j

def lookup(title):
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, 't2_' + hashlib.sha1(title.encode()).hexdigest() + '.json')
    if os.path.exists(f): return json.load(open(f))
    p = {'action': 'query', 'titles': title, 'prop': 'imageinfo', 'iiprop': 'url|extmetadata|size|mime', 'iiurlwidth': '1600', 'format': 'json'}
    j = json.loads(get(API + '?' + urllib.parse.urlencode(p, quote_via=urllib.parse.quote)))
    json.dump(j, open(f, 'w'))
    return j

STOP = {'the', 'and', 'for', 'with', 'before', 'after', 'tool', 'tools'}
def stem(w): return re.sub(r'(ing|es|s)$', '', w) if len(w) > 4 else w
def relevance(q, text):
    toks = [stem(w) for w in re.findall(r'[a-z]+', q.lower()) if len(w) > 2 and w not in STOP]
    low = text.lower()
    return sum(1 for w in toks if w in low) / max(1, len(toks))

def candidates(q, minw=MINW, minrel=0.67):
    pages = (search(q).get('query') or {}).get('pages') or {}
    out = []
    for pg in sorted(pages.values(), key=lambda x: x.get('index', 99)):
        out.append(judge(pg, q, minw, minrel))
    return [x for x in out if x]

def judge(pg, q, minw=MINW, minrel=0.67):
    ii = (pg.get('imageinfo') or [None])[0]
    if not ii: return None
    m = ii.get('extmetadata') or {}
    val = lambda k: strip((m.get(k) or {}).get('value', ''))
    lic = val('LicenseShortName'); title = pg.get('title', '')
    why = None
    if not OK_LICENCE.match(lic): why = 'licence ' + lic
    elif val('NonFree').lower() in ('true', '1'): why = 'nonfree'
    elif ii.get('mime') not in ('image/jpeg', 'image/png'): why = 'mime'
    elif ii.get('width', 0) < minw: why = 'narrow'
    elif not (4 / 3 - 0.005 <= ii['width'] / max(1, ii.get('height', 1)) <= 2.4): why = 'aspect'
    elif BAD_TITLE.search(title) or BAN.search(title): why = 'title'
    elif re.search(r'black and white|monochrome|grayscale|greyscale|scan|drawing|diagram', val('Categories'), re.I): why = 'categories'
    elif not val('Artist'): why = 'no author'
    elif not ii.get('thumburl') or not ii.get('descriptionurl'): why = 'no url'
    rel = relevance(q, ' '.join([title, val('ImageDescription'), val('ObjectName')]))
    text = ' '.join([title, val('ImageDescription'), val('ObjectName'), val('Categories').replace('|', ' ')])
    if why is None and rel < minrel: why = f'relevance {rel:.2f}'
    return {'rel': rel, 'ok': why is None, 'why': why, 'title': title, 'page': ii.get('descriptionurl'), 'thumb': ii.get('thumburl'), 'author': val('Artist'), 'license': lic,
            'licenseUrl': val('LicenseUrl') or None, 'w': ii.get('width'), 'h': ii.get('height'), 'mime': ii.get('mime'), 'text': text}


DOM_STOP = {'and', 'the', 'for', 'with', 'products', 'product', 'systems', 'system', 'other', 'new', 'accessories', 'photo', 'file'}
# per-family synonyms: a family applies when its trigger matches the category id + name (and, for fallback photos, the ancestors')
FAMILIES = [
 ('tile|grout', 'tile tiling grout adhesive trowel ceramic porcelain stone mortar floor bathroom'),
 ('waterproof|membrane|basement|damp', 'waterproof waterproofing membrane damp basement bitumen bituminous coating seal leak tanking foundation'),
 ('concrete|admixture|cement|pre-cast|mortar|shotcrete|screed', 'concrete cement mortar precast formwork aggregate admixture slab rebar reinforcement shotcrete mixer pump pour'),
 ('floor|screed|resin|levelling|epoxy|polyurethane|purcem', 'floor flooring screed resin epoxy polyurethane coating levelling industrial kitchen'),
 ('roof', 'roof roofing membrane flat flashing felt bitumen waterproof'),
 ('seal|adhesive|tape|foam|caulk|joint|primer|paint', 'sealant sealing silicone caulk caulking joint adhesive glue tape foam gun cartridge primer paint'),
 ('anchor|grout', 'anchor bolt grout grouting foundation drilling base plate turbine'),
 ('strengthen', 'carbon fibre fiber strengthening bridge beam column wrap steel repair retrofit epoxy'),
 ('landscape|green|paving|drain|turf|slope|gravel|decking', 'garden green roof wall paving paver decking drainage turf soil slope gravel grass terrace'),
 ('automotive|glass|windscreen|windshield', 'car vehicle automotive windscreen windshield glass body panel repair workshop'),
 ('marine|boat|yacht|ship|offshore', 'boat yacht ship deck marine hull vessel cabin teak offshore'),
 ('building|facade|glazing|window|panel|cladding|curtain', 'building facade glass window panel cladding glazing insulation curtain wall'),
 ('transport|bus|truck|rail', 'bus train truck rail vehicle carriage trailer'),
 ('hvac|appliance|equipment', 'hvac air conditioning duct ventilation heating pipe'),
 ('corrosion|inhibitor|protect|silane', 'corrosion rust rebar reinforcement coating protective concrete steel anode'),
 ('construction', 'construction building site concrete crane'),
 ('industry', 'industrial factory manufacturing production assembly plant'),
]
def domain_words(cid, byid, with_chain=False):
    ids = [cid] + (chain(cid, byid) if with_chain else [])
    text = ' '.join(i + ' ' + byid[i]['name'] for i in ids if i in byid).lower()
    words = set(re.findall(r'[a-z]+', re.sub(r'[/_-]', ' ', text)))
    for i in ids:
        for q in Q.get(i, []): words |= set(re.findall(r'[a-z]+', q.lower()))
    for trig, syn in FAMILIES:
        if re.search(trig, text): words |= set(syn.split())
    return {stem(w) for w in words if len(w) > 2 and w not in DOM_STOP}

GENERIC = {'structural', 'building', 'construction', 'product', 'system', 'industrial', 'industry', 'other', 'accessory', 'pre', 'cast', 'high', 'range', 'special', 'water'}
def anchor_words(cid, byid, with_chain=False):
    """The words that name the subject: the category name and its hand-tuned query words (no family synonyms, no generic words). One of them must be in the photo TITLE."""
    ids = [cid] + (chain(cid, byid) if with_chain else [])
    words = set(re.findall(r'[a-z]+', re.sub(r'[/_-]', ' ', ' '.join(byid[i]['name'] for i in ids if i in byid).lower())))
    for i in ids:
        for q in Q.get(i, []): words |= set(re.findall(r'[a-z]+', q.lower()))
    return {stem(w) for w in words if len(w) > 2 and w not in DOM_STOP and w not in GENERIC}

def anchored(anchors, title):
    low = re.sub(r'\.(jpe?g|png)$', '', title.replace('File:', '').lower())
    return any(re.search(r'\b' + re.escape(a), low) for a in anchors)

def dom_score(words, text):
    low = text.lower(); hit = sorted(w for w in words if re.search(r'\b' + re.escape(w), low))
    return len(hit), hit

def fetch_bytes(url):
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, 'img_' + hashlib.sha1(url.encode()).hexdigest())
    if os.path.exists(f): return open(f, 'rb').read()
    b = get(url, binary=True); open(f, 'wb').write(b); return b

def metrics(data):
    """(sharpness, colourfulness): variance of the Laplacian of the 960 px wide grey image; mean spread of the RGB channels (near 0 = black and white)."""
    im = Image.open(io.BytesIO(data)).convert('RGB'); w, h = im.size
    im = im.resize((960, max(1, round(h * 960 / w))), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float32); g = a.mean(axis=2)
    lap = 4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
    return float(lap.var()), float((a.max(axis=2) - a.min(axis=2)).mean())

def slug(cid): return cid.replace('/', '--')

def write_images(cid, data):
    im = Image.open(io.BytesIO(data)).convert('RGB')
    w, h = im.size; tw = 3 / 2
    if w / h > tw: nw = round(h * tw); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else: nh = round(w / tw); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    os.makedirs(OUT, exist_ok=True)
    for width, h2, qual in ((1600, 1067, QUAL[1600]), (960, 640, QUAL[960]), (480, 320, QUAL[480])):
        im.resize((width, h2), Image.LANCZOS).save(os.path.join(OUT, f'{slug(cid)}-{width}.webp'), 'WEBP', quality=qual, method=int(os.environ.get('WEBP_METHOD', 6)))

# the 45 MB cap on assets/img/s is the binding constraint: 165 categories x three sizes; qualities were lowered from 82/74/72 until the total fitted (see the PHOTOS2 receipt)
QUAL = {1600: int(os.environ.get('Q1600', 44)), 960: int(os.environ.get('Q960', 48)), 480: int(os.environ.get('Q480', 50))}
GREY_MIN = 8.0

def series(title): return 'series:' + re.sub(r'[^a-z ]', '', title.lower().replace('file:', ''))[:22].strip()

def ranked(cs, used, dw, an):
    """Acceptable, unused candidates whose title + description + categories hit at least REL_FLOOR domain words, best first: query relevance, domain score, then the largest source."""
    out = []
    for x in cs:
        if not x['ok'] or x['page'] in used or series(x['title']) in used or not anchored(an, x['title']): continue
        x['dscore'], x['dwords'] = dom_score(dw, x['text'])
        if x['dscore'] >= REL_FLOOR: out.append(x)
    return sorted(out, key=lambda x: (-round(x['rel'], 2), -x['dscore'], -(x['w'] or 0)))

def pick(cs, used, tried_note, dw, an):
    """Measure the best few candidates of ONE query, drop the bottom 20% by sharpness, reject grey and soft ones, return the first left (candidate, sharp)."""
    pool = ranked(cs, used, dw, an)[:6]; meas = []
    for x in pool:
        try: s, col = metrics(fetch_bytes(x['thumb']))
        except Exception as ex: tried_note.append(f'metric fail {x["title"][:30]}: {ex}'); continue
        x['sharp'] = s; x['col'] = col; meas.append(x)
    drop = set(id(x) for x in sorted(meas, key=lambda x: x['sharp'])[:int(0.2 * len(meas))])
    for x in meas:
        if id(x) in drop: tried_note.append(f'bottom 20% sharpness: {x["title"][:30]}'); continue
        if x['sharp'] < SHARP_FLOOR: tried_note.append(f'soft {x["sharp"]:.0f}: {x["title"][:30]}'); continue
        if x['col'] < GREY_MIN: tried_note.append(f'grey: {x["title"][:30]}'); continue
        return x
    return None


# Last-resort pool per level 2 family: generic photo subjects of that family (still 1600 px, sharp, relevant by title). Used only after the category's own and its ancestors' queries ran dry.
POOL = {
 'construction': ['construction worker', 'building site', 'bricklayer', 'scaffolding', 'house construction', 'excavation foundation', 'steel reinforcement', 'tunnel construction'],
 'industry': ['car factory', 'shipyard', 'bus', 'yacht', 'train', 'truck', 'windscreen', 'glass facade'],
 'products': ['building materials', 'construction materials', 'cement bags'],
 'concrete': ['concrete mixer truck', 'concrete pouring', 'concrete construction', 'precast concrete', 'concrete formwork', 'concrete slab', 'reinforced concrete', 'cement'],
 'concrete-repair-protection': ['concrete repair', 'bridge repair', 'concrete restoration', 'rebar corrosion', 'concrete spalling', 'bridge inspection', 'concrete bridge', 'concrete coating'],
 'flooring': ['floor screed', 'epoxy floor', 'concrete floor', 'industrial floor', 'floor installation', 'polished concrete', 'warehouse floor', 'floor grinding'],
 'grouts-anchoring': ['grouting', 'anchor bolts', 'foundation bolts', 'wind turbine foundation', 'machine foundation', 'base plate', 'drilling concrete', 'railway track'],
 'landscape-buildingproducts': ['green roof', 'paving', 'garden terrace', 'drainage', 'retaining wall', 'landscaping', 'decking', 'turf'],
 'roofing': ['flat roof', 'roof membrane', 'roofing', 'roof construction', 'roof repair', 'roofer', 'bitumen roof', 'roof terrace'],
 'sealants-adhesives': ['sealant', 'caulking', 'silicone sealant', 'adhesive', 'expansion joint', 'window sealing', 'glazing', 'joint sealing'],
 'structural-strengthening': ['bridge strengthening', 'carbon fibre', 'bridge girder', 'column repair', 'steel beam', 'bridge construction', 'seismic retrofit', 'building retrofit'],
 'tile-stone-installationsystems': ['tiling', 'tiler', 'ceramic tiles', 'floor tiles', 'bathroom tiles', 'tile installation', 'stone paving', 'grout'],
 'waterproofing': ['waterproofing', 'basement', 'tunnel lining', 'bridge deck', 'membrane installation', 'roof waterproofing', 'foundation wall', 'shotcrete tunnel'],
 'appliance-and-equipment': ['air conditioning', 'HVAC', 'ductwork', 'ventilation', 'heat pump', 'chiller', 'boiler', 'refrigeration'],
 'automotive-aftermarket': ['car repair', 'windscreen', 'car body', 'auto glass', 'car workshop', 'car assembly', 'car door', 'vehicle repair'],
 'building-components': ['curtain wall', 'glass facade', 'window installation', 'cladding', 'sandwich panel', 'prefabricated', 'double glazing', 'facade'],
 'marine': ['yacht', 'boat', 'shipyard', 'ship deck', 'teak deck', 'ship interior', 'sailing boat', 'marina'],
 'transportation': ['bus', 'train', 'truck', 'tram', 'railway carriage', 'bus factory', 'trailer', 'ambulance'],
}
def pool_queries(cid, byid):
    for a in [cid] + chain(cid, byid):
        k = a.split('/')[1] if '/' in a else a
        if byid[a]['level'] <= 2 and k in POOL: return POOL[k] + [q for q in POOL.get(a.split('/')[0], []) if q not in POOL[k]]
    return []

def chain(cid, byid):
    out = []; a = byid[cid].get('parent')
    while a and a in byid: out.append(a); a = byid[a].get('parent')
    return out

def record(x, q, mode, hdfb, frm=None):
    r = {'query': q, 'title': x['title'], 'page': x['page'], 'author': x['author'], 'license': x['license'], 'licenseUrl': x['licenseUrl'], 'sourceFile': x['thumb'],
         'sourceWidth': x['w'], 'sourceHeight': x['h'], 'sharpness': round(x['sharp'], 1), 'mode': mode, 'hdFallback': hdfb, 'relevance': x['dscore'], 'relevanceWords': x['dwords'][:8], 'fetched': time.strftime('%Y-%m-%d')}
    if frm: r['fallbackFrom'] = frm
    return r

def choose(cid, byid, used, notes):
    dwo = domain_words(cid, byid); dwf = domain_words(cid, byid, True); ano = anchor_words(cid, byid); anf = anchor_words(cid, byid, True)
    """own: this category's three queries (1600 px first, then 1200); fallback-unique: the ancestors' queries, then loose leaf queries. Returns (record, bytes) or (None, None)."""
    plans = [('own', [(cid, q, None) for q in Q.get(cid, [])], 0.67)]
    fb = [(a, q, a) for a in chain(cid, byid) for q in Q.get(a, [])]
    plans.append(('fallback-unique', fb, 0.67)); plans.append(('fallback-unique', [(cid, q, 'loose') for q in Q.get(cid, [])], 0.34))
    pq = pool_queries(cid, byid); ptok = {stem(w) for q in pq for w in re.findall(r'[a-z]+', q.lower()) if len(w) > 2}
    plans.append(('fallback-unique', [(cid, q, 'pool') for q in pq], 0.67))
    for mode, qs, minrel in plans:
        pooled = bool(qs) and qs[0][2] == 'pool'
        for minw in (MINW, FALLBACK_W):
            for _, q, frm in qs:
                try: cs = candidates(q, minw, minrel)
                except Exception as ex: notes.append(f'{q}: ERROR {ex}'); continue
                x = pick(cs, used, notes, (dwo if mode == 'own' else dwf | ptok if pooled else dwf), (ano if mode == 'own' else anf | ptok if pooled else anf))
                if x: return record(x, q, mode, minw < MINW, frm), fetch_bytes(x['thumb'])
    return None, None

def recode_one(cid):
    e = json.load(open(SRC))[cid]; write_images(cid, fetch_bytes(e['sourceFile']))

def main():
    global SHARP_FLOOR
    if os.environ.get('RECODE'):  # re-encode every chosen photo from the cached source at the current QUAL (no network)
        from multiprocessing import Pool
        ids = [k for k, v in json.load(open(SRC)).items() if v.get('page')]
        with Pool(os.cpu_count()) as pl: pl.map(recode_one, ids)
        print('recoded', len(ids)); return
    SHARP_FLOOR = float(os.environ.get('SHARP_FLOOR', SHARP_FLOOR))
    cats = json.load(open(os.path.join(PORTAL, 'data', 'categories.json')))
    byid = {c['id']: c for c in cats}
    src = json.load(open(SRC)) if os.path.exists(SRC) else {}
    src = {k: v for k, v in src.items() if v.get('page')}  # round 2: inheritance and 'none' records are rebuilt below
    used = set()
    # stock_veto.json: {"<category id>": "note"}; the next run rejects that category's current photo and takes the next-best one (re-runnable: once applied the entry
    # records the photo it produced and is skipped until that photo is vetoed again by deleting the "applied" key)
    VETO = os.path.join(HERE, 'stock_veto.json'); veto = json.load(open(VETO)) if os.path.exists(VETO) else {}
    veto = {k: (v if isinstance(v, dict) else {'note': v}) for k, v in veto.items()}
    banned = {k: set(v.get('rejected', [])) | {series(x) for x in v.get('rejectedTitles', [])} for k, v in veto.items()}
    for cid, v in veto.items():
        cur = src.get(cid)
        if cur and v.get('applied') != cur.get('page'): v.setdefault('rejected', []).append(cur['page']); v.setdefault('rejectedTitles', []).append(cur['title']); banned[cid] |= {cur['page'], series(cur['title'])}; del src[cid]; v.pop('applied', None); print('VETO', cid, '|', cur['title'][:60])
    # 1. keep the photos already chosen when they pass the HD rules (re-fetched at 1600 px); the rest are re-chosen
    redo_ids = set(redo) | REDO_LISTED
    for cid in sorted(src, key=lambda k: byid[k]['level']):
        e = src[cid]
        if cid in redo_ids: del src[cid]; continue
        if os.environ.get('STOCK_FAST'): used.add(e['page']); used.add(series(e['title'])); continue  # re-run for the gaps only: trust the records already checked
        x = None; data = None
        try:
            j = lookup(e['title']); pg = list((j.get('query') or {}).get('pages', {}).values())[0]
            x = judge(pg, ' '.join(re.findall(r'[A-Za-z]+', e['title'])), MINW, 0.0)
            ok = bool(x and x['ok'])
            if ok:
                data = fetch_bytes(x['thumb']); s, col = metrics(data)
                if os.environ.get('PROBE'): print('PROBE', f'{s:8.1f} {col:5.1f} {x["w"]:5d}', cid[-40:], '|', e['title'][5:50]); continue
                fbk = e.get('mode') == 'fallback-unique'
                x['dscore'], x['dwords'] = dom_score(domain_words(cid, byid, fbk), x['text'])
                ok = s >= SHARP_FLOOR and col >= GREY_MIN and x['page'] not in used and series(x['title']) not in used and x['dscore'] >= REL_FLOOR and anchored(anchor_words(cid, byid, fbk), x['title'])
        except Exception as ex:
            print('REFRESH FAIL', cid, ex); ok = False
        if not ok: print('REDO ', cid, '|', e['title'][:60], '|', (x or {}).get('why') or 'soft/grey/duplicate/low domain score'); del src[cid]; continue
        used.add(x['page']); used.add(series(x['title'])); old = e
        src[cid] = {**old, 'sourceFile': x['thumb'], 'sourceWidth': x['w'], 'sourceHeight': x['h'], 'sharpness': round(s, 1), 'mode': e.get('mode', 'own'), 'hdFallback': False, 'relevance': x['dscore'], 'relevanceWords': x['dwords'][:8]}
        write_images(cid, data)
        json.dump(src, open(SRC, 'w'), indent=1, sort_keys=True)
    if os.environ.get('PROBE'): return
    # 2. every category still without a photo
    todo = [c for c in sorted(cats, key=lambda c: (c['level'], c['id'])) if c['id'] not in src]
    n = 0
    for c in todo:
        cid = c['id']
        if limit is not None and n >= limit: break
        n += 1; notes = []
        r, data = choose(cid, byid, used | banned.get(cid, set()), notes)
        if not r:
            print('NONE', cid, '|', '; '.join(notes)[:300]); src[cid] = {'none': True, 'mode': 'none', 'tried': notes[:12]}; json.dump(src, open(SRC, 'w'), indent=1, sort_keys=True); continue
        write_images(cid, data); used.add(r['page']); used.add(series(r['title'])); src[cid] = r
        if cid in veto: veto[cid]['applied'] = r['page']
        json.dump(src, open(SRC, 'w'), indent=1, sort_keys=True)
        print('OK  ', r['mode'], cid, '|', r['title'][:60], '|', r['license'], r['sourceWidth'], f"sharp {r['sharpness']} rel {r['relevance']}", 'HDFALLBACK' if r['hdFallback'] else '')
    json.dump(src, open(SRC, 'w'), indent=1, sort_keys=True)
    if veto: json.dump(veto, open(VETO, 'w'), indent=1, sort_keys=True)
    modes = {}
    for c in cats: m = src.get(c['id'], {}).get('mode', 'none'); modes[m] = modes.get(m, 0) + 1
    print(f'categories {len(cats)}: {modes}')

main()
