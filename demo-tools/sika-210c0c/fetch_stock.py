#!/usr/bin/env python3
"""fetch_stock.py: illustrative stock photos for every Sika portal category, from Wikimedia Commons (keyless API).
Re-runnable and resumable: a category already in stock_source.json (with its files on disk) is skipped; --redo <id> forces one.
Rules: User-Agent with the contact email on every request, at most 1 request a second, only these licences are accepted:
CC0, Public domain, CC BY 2.0/3.0/4.0, CC BY-SA 2.0/3.0/4.0. Source JPEG/PNG at least 960 px wide, landscape.
Output: assets/img/s/<slug>-480.webp and -960.webp (3:2, quality 80) and stock_source.json (credit data copied from the API response).
Categories whose own search finds nothing acceptable inherit the nearest ancestor's photo (record {"inherit": <id>}).
usage: python3 fetch_stock.py [portalDir] [--redo id ...] [--limit N]
"""
import json, os, re, sys, time, io, html, urllib.request, urllib.parse, urllib.error
from PIL import Image

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
OK_LICENCE = re.compile(r'^(CC0( 1\.0)?|Public domain|CC BY (2|3|4)\.0|CC BY-SA (2|3|4)\.0)$', re.I)
BAD_TITLE = re.compile(r'logo|map\b|diagram|poster|scheme|icon|flag|coat of arms|portrait|\bsvg\b|screenshot|stamp|cartoon|painting|drawing|illustration|chart|advert|brochure|study for|sketch|engraving|lithograph|miniature|model of', re.I)

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

# Curated rejects: files the search ranked high that are off topic for a building-products portal (reviewed by eye, 2026-10-31). Matched on the Commons file title.
BAN = re.compile(r'Spotted Lanternfly|Ford RS 200|Bond Equipe|Lotus Europa|Ford Falcon|Mesa tactical|F-35A|Southern Pacific|Kleinhans|Wichman Building|O.Sullivan Farmstead|One Farragut|Security Ceilings|Joint Range Complex|Aguinaldo|Heinz-Steyer|Methuen Rotary|Maison Herm|Auditorium Building|Solocator|Panel sterowania|Watson House|Artificial Stones|EFTA|Primary Industries Building|Puerto Rico Army|51st CES|Chemical Agent-Destruction|Waterproof membrane that will serve|States yacht|HMS Gannet|Vertical Assembly Building|Havana Yacht|Austin Healey|374th Civil|ASC Leiden|Durasteel|Mixed-in-place|Puf joint|Rebar lattice|Penarth|Arthur Harding|Congleton|Spitfire Manufacture|Moscow River|Bucana Bridge|Liverpool window|Blue hour|Machu Picchu|Gordige|Marquee tent', re.I)

# Categories where every hit looked wrong on review: they take the nearest ancestor's photo instead (honest inheritance beats an off-topic picture).
CAT_NO = {s for s in '''construction/flooring/cement-levellingsystems construction/flooring/flooring-adhesivessystems construction/flooring/resin-flooring/purcem-flooring-productssystems
construction/grouts-anchoring/chemical-anchoring construction/landscape-buildingproducts/turf-soil-stabilisation construction/landscape-buildingproducts/turf-soil-stabilisation/turf-and-gravel-stabilisation
construction/sealants-adhesives/cleaners-activatorsprimers construction/sealants-adhesives/backing-rod-foamtapes construction/sealants-adhesives/facade-sealants construction/sealants-adhesives/expansion-perimeterjoints
construction/roofing/pvc-sheet-membranes construction/concrete/admixture-technology/high-range-waterreducers construction/flooring/floor-joints construction/waterproofing/liquid-applied-membranes/high-performancesystems
construction/waterproofing/spray-applied-membranes industry/automotive-aftermarket/accessories industry/automotive-aftermarket/auto-glass-replacement/adhesive industry/automotive-aftermarket/panel-bonding
industry/building-components/facade/panel-cladding industry/marine/leisure-boats-andyachts industry/marine/shipbuilding-and-offshore/flooring-acoustics industry/transportation/metal-adhesive
construction/waterproofing/basement-sheet-membranes construction/sealants-adhesives/specialty-sealants
construction/roofing/liquid-applied-membranes/high-performanceroofingsystems industry/building-components/building-elements construction/concrete-repair-protection/protective-coatingslinings industry/automotive-aftermarket/panel-bonding/adhesives'''.split()}

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
    f = os.path.join(CACHE, re.sub(r'[^a-z0-9]+', '_', q.lower()) + '.json')
    if os.path.exists(f): return json.load(open(f))
    p = {'action': 'query', 'generator': 'search', 'gsrsearch': q + ' filetype:bitmap', 'gsrnamespace': '6', 'gsrlimit': '20', 'prop': 'imageinfo',
         'iiprop': 'url|extmetadata|size|mime', 'iiurlwidth': '960', 'format': 'json'}
    j = json.loads(get(API + '?' + urllib.parse.urlencode(p, quote_via=urllib.parse.quote)))
    json.dump(j, open(f, 'w'))
    return j

STOP = {'the', 'and', 'for', 'with', 'before', 'after', 'tool', 'tools'}
def stem(w): return re.sub(r'(ing|es|s)$', '', w) if len(w) > 4 else w
def relevance(q, text):
    toks = [stem(w) for w in re.findall(r'[a-z]+', q.lower()) if len(w) > 2 and w not in STOP]
    low = text.lower()
    return sum(1 for w in toks if w in low) / max(1, len(toks))

def candidates(q):
    pages = (search(q).get('query') or {}).get('pages') or {}
    out = []
    for pg in sorted(pages.values(), key=lambda x: x.get('index', 99)):
        ii = (pg.get('imageinfo') or [None])[0]
        if not ii: continue
        m = ii.get('extmetadata') or {}
        val = lambda k: strip((m.get(k) or {}).get('value', ''))
        lic = val('LicenseShortName'); title = pg.get('title', '')
        why = None
        if not OK_LICENCE.match(lic): why = 'licence ' + lic
        elif val('NonFree').lower() in ('true', '1'): why = 'nonfree'
        elif ii.get('mime') not in ('image/jpeg', 'image/png'): why = 'mime'
        elif ii.get('width', 0) < 960: why = 'narrow'
        elif not (1.25 <= ii['width'] / max(1, ii.get('height', 1)) <= 2.4): why = 'aspect'
        elif BAD_TITLE.search(title) or BAN.search(title): why = 'title'
        elif not val('Artist'): why = 'no author'
        elif not ii.get('thumburl') or not ii.get('descriptionurl'): why = 'no url'
        rel = relevance(q, ' '.join([title, val('ImageDescription'), val('ObjectName')]))
        if why is None and rel < 0.67: why = f'relevance {rel:.2f}'
        out.append({'rel': rel, 'ok': why is None, 'why': why, 'title': title, 'page': ii.get('descriptionurl'), 'thumb': ii.get('thumburl'), 'author': val('Artist'), 'license': lic,
                    'licenseUrl': val('LicenseUrl') or None, 'w': ii.get('width'), 'h': ii.get('height'), 'mime': ii.get('mime')})
    return out

def slug(cid): return cid.replace('/', '--')

def write_images(cid, data):
    im = Image.open(io.BytesIO(data)).convert('RGB')
    w, h = im.size; tw = 3 / 2
    if w / h > tw: nw = round(h * tw); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else: nh = round(w / tw); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    os.makedirs(OUT, exist_ok=True)
    for width, h2 in ((960, 640), (480, 320)):
        im.resize((width, h2), Image.LANCZOS).save(os.path.join(OUT, f'{slug(cid)}-{width}.webp'), 'WEBP', quality=80, method=6)

def main():
    cats = json.load(open(os.path.join(PORTAL, 'data', 'categories.json')))
    byid = {c['id']: c for c in cats}
    src = json.load(open(SRC)) if os.path.exists(SRC) else {}
    used = {v['page'] for v in src.values() if v.get('page')}
    have = lambda cid: all(os.path.exists(os.path.join(OUT, f'{slug(cid)}-{w}.webp')) for w in (480, 960))
    todo = [c for c in sorted(cats, key=lambda c: (c['level'], c['id'])) if c['id'] in Q and c['id'] not in CAT_NO]
    done = 0
    for c in todo:
        cid = c['id']
        e = src.get(cid)
        if e and e.get('page') and have(cid) and cid not in redo: continue
        if limit is not None and done >= limit: break
        done += 1
        chosen = None; tried = []
        for q in Q[cid]:
            try: cs = candidates(q)
            except Exception as ex: tried.append(f'{q}: ERROR {ex}'); continue
            tried.append(f'{q}: {sum(1 for x in cs if x["ok"])}/{len(cs)} acceptable')
            for x in sorted((x for x in cs if x['ok'] and x['page'] not in used), key=lambda x: -x['rel'])[:1]: chosen = (q, x)
            if chosen: break
        if not chosen:
            print('NONE', cid, '|', '; '.join(tried)); src[cid] = {'none': True, 'tried': tried}; json.dump(src, open(SRC, 'w'), indent=1, sort_keys=True); continue
        q, x = chosen
        try:
            write_images(cid, get(x['thumb'], binary=True))
        except Exception as ex:
            print('DLFAIL', cid, ex); continue
        used.add(x['page'])
        src[cid] = {'query': q, 'title': x['title'], 'page': x['page'], 'author': x['author'], 'license': x['license'], 'licenseUrl': x['licenseUrl'],
                    'sourceFile': x['thumb'], 'sourceWidth': x['w'], 'sourceHeight': x['h'], 'fetched': time.strftime('%Y-%m-%d')}
        json.dump(src, open(SRC, 'w'), indent=1, sort_keys=True)
        print('OK  ', cid, '|', x['title'], '|', x['license'])
    # inheritance for every category without its own photo
    for c in cats:
        cid = c['id']
        if src.get(cid, {}).get('page'): continue
        a = c.get('parent')
        while a and not src.get(a, {}).get('page'): a = byid[a]['parent'] if a in byid else None
        if a: src[cid] = {'inherit': a}
        else: src[cid] = {'none': True, 'tried': src.get(cid, {}).get('tried', [])}
    json.dump(src, open(SRC, 'w'), indent=1, sort_keys=True)
    own = sum(1 for v in src.values() if v.get('page')); inh = sum(1 for v in src.values() if v.get('inherit')); no = sum(1 for v in src.values() if v.get('none'))
    print(f'categories {len(cats)}: own photo {own}, inherited {inh}, none {no}')

main()
