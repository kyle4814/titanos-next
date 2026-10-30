// synonyms.js: swappable domain vocabulary (query synonyms, facets, stop-topics). Replace this file to re-point the engine at another catalogue.

/** Each group: words or phrases that mean the same thing to a customer. A query hit on any adds the others at reduced weight. */
export const SYNONYM_GROUPS = [
  ['adhesive', 'glue', 'bond', 'bonding', 'stick', 'fix', 'fixing', 'mastic'],
  ['tile adhesive', 'tile glue', 'tiling adhesive', 'thinset', 'thin bed', 'tile bond'],
  ['sds', 'msds', 'safety data sheet', 'safety data', 'safety sheet', 'hazard'],
  ['pds', 'data sheet', 'datasheet', 'product data sheet', 'technical data', 'tds', 'spec sheet'],
  ['grout', 'grouting', 'tile grout', 'joint filler'],
  ['primer', 'priming', 'bonding agent', 'adhesion promoter', 'prime'],
  ['waterproof', 'waterproofing', 'membrane', 'tanking', 'damp proof', 'dampproof', 'water proof', 'leak', 'leaking', 'leaks', 'seepage', 'water ingress', 'moisture barrier', 'wet area'],
  ['screed', 'leveller', 'leveler', 'self levelling', 'self leveling', 'self-levelling', 'levelling', 'leveling', 'smoothing compound', 'underlay', 'floor leveller'],
  ['sealant', 'caulk', 'caulking', 'silicone', 'gap filler', 'joint sealant', 'seal', 'sealing'],
  ['porcelain', 'ceramic', 'tile', 'tiles', 'tiling', 'mosaic'],
  ['shower', 'bathroom', 'wet area', 'wet areas', 'laundry', 'ensuite', 'bath'],
  ['balcony', 'terrace', 'patio', 'deck', 'podium', 'external', 'outdoor', 'exterior'],
  ['basement', 'below ground', 'underground', 'retaining wall', 'blind side', 'cellar'],
  ['repair', 'patch', 'repair mortar', 'render', 'fairing', 'reinstate', 'spalling', 'spall', 'honeycomb', 'concrete repair'],
  ['admixture', 'additive', 'superplasticiser', 'superplasticizer', 'plasticiser', 'water reducer', 'water reducing'],
  ['roof', 'roofing', 'gutter', 'flashing'],
  ['glass', 'glazing', 'windscreen', 'windshield', 'mirror'],
  ['timber', 'wood', 'wooden', 'plywood', 'chipboard', 'particleboard'],
  ['fibre cement', 'fibre-cement', 'fc sheet', 'villaboard', 'cement sheet', 'hardiflex', 'compressed sheet'],
  ['plasterboard', 'gyprock', 'drywall', 'gypsum board', 'wallboard'],
  ['coverage', 'consumption', 'yield', 'usage rate', 'spread rate', 'application rate', 'dosage', 'cover'],
  ['crack', 'cracks', 'crack repair', 'injection'],
  ['concrete floor', 'slab', 'concrete slab'],
  ['epoxy', 'resin'],
  ['foam', 'expanding foam', 'gap fill foam'],
];

/** Facets: substrates, tile types and locations. Used for exclusions, ranking context and the guided tree. */
export const FACETS = {
  substrate: [
    { id: 'concrete', label: 'Concrete', terms: ['concrete', 'cured concrete', 'concrete slab', 'slab'] },
    { id: 'fibre-cement', label: 'Fibre cement sheet', terms: ['fibre cement', 'fibre-cement', 'fc sheet', 'villaboard', 'compressed sheet', 'cement sheet', 'tile underlay', 'ceramic tile underlay'] },
    { id: 'plasterboard', label: 'Plasterboard', terms: ['plasterboard', 'gyprock', 'drywall', 'gypsum board', 'wallboard'] },
    { id: 'timber', label: 'Timber or plywood', terms: ['timber', 'wood', 'wooden', 'plywood', 'chipboard', 'particleboard'] },
    { id: 'existing-tiles', label: 'Existing tiles', terms: ['existing tile', 'existing tiles', 'existing ceramic tile', 'existing ceramic tiles', 'tile over tile', 'tiling over tile', 'over existing tiles'] },
    { id: 'render', label: 'Render or brick', terms: ['render', 'rendered', 'brickwork', 'blockwork', 'masonry', 'brick'] },
    { id: 'screed', label: 'Cement screed', terms: ['screed', 'sand cement screed'] },
    { id: 'membrane', label: 'Waterproofing membrane', terms: ['waterproofing membrane', 'waterproofing membranes', 'membrane', 'membranes'] },
    { id: 'steel', label: 'Steel or metal', terms: ['steel', 'metal', 'aluminium', 'aluminum', 'galvanised', 'stainless'] },
    { id: 'glass', label: 'Glass', terms: ['glass'] },
  ],
  tileType: [
    { id: 'porcelain', label: 'Porcelain', terms: ['porcelain', 'vitrified'] },
    { id: 'ceramic', label: 'Ceramic', terms: ['ceramic'] },
    { id: 'natural-stone', label: 'Natural stone', terms: ['natural stone', 'stone', 'marble', 'granite', 'travertine', 'slate', 'limestone'] },
    { id: 'mosaic', label: 'Mosaic', terms: ['mosaic', 'mosaics'] },
    { id: 'large-format', label: 'Large format', terms: ['large format', 'large-format', 'rectified'] },
    { id: 'unglazed', label: 'Unglazed or porous', terms: ['unglazed', 'porous tile', 'porous tiles', 'textured'] },
  ],
  location: [
    { id: 'wet-area', label: 'Wet area (bathroom, shower, laundry)', terms: ['wet area', 'wet areas', 'shower', 'bathroom', 'laundry', 'ensuite', 'bath'] },
    { id: 'external', label: 'External (balcony, patio, outdoor)', terms: ['balcony', 'terrace', 'patio', 'deck', 'external', 'exterior', 'outdoor', 'outdoors', 'outside'] },
    { id: 'internal', label: 'Internal dry area', terms: ['internal', 'interior', 'indoor', 'inside', 'dry area', 'living room', 'kitchen'] },
    { id: 'floor', label: 'Floor', terms: ['floor', 'floors', 'flooring'] },
    { id: 'wall', label: 'Wall', terms: ['wall', 'walls', 'facade', 'façade'] },
    { id: 'roof', label: 'Roof', terms: ['roof', 'roofing', 'gutter', 'rooftop'] },
    { id: 'basement', label: 'Basement or below ground', terms: ['basement', 'below ground', 'underground', 'retaining wall', 'blind side'] },
    { id: 'pool', label: 'Swimming pool', terms: ['swimming pool', 'pool'] },
  ],
};

/** Words that signal the question is about this catalogue's domain at all (used for out-of-scope detection). */
export const DOMAIN_HINTS = ['tile', 'adhesive', 'grout', 'seal', 'waterproof', 'membrane', 'concrete', 'floor', 'screed', 'roof', 'primer',
  'epoxy', 'mortar', 'repair', 'admixture', 'bond', 'glue', 'caulk', 'coating', 'render', 'cement', 'sheet', 'joint', 'leak', 'crack', 'paint'];

/** Guided tile path slots: matched against each product's category path (data-derived), in the order they are installed. */
export const GUIDE_SLOTS = [
  { id: 'waterproofing', title: 'Waterproofing (wet areas, balconies, pools, basements)', cat: /waterproofing\/liquid|waterproofing\/(?!inject)/, needs: ['wet-area', 'external', 'pool', 'basement'], text: /tile|tiling|wet area|bathroom|shower|balcon/i },
  { id: 'primer', title: 'Primer', cat: /primers-additives|cement-levellingsystems/, name: /primer|prime/i, text: /tile|tiling/i },
  { id: 'adhesive', title: 'Tile adhesive', cat: /tile-adhesives/ },
  { id: 'grout', title: 'Grout', cat: /tile-grouts/ },
];
