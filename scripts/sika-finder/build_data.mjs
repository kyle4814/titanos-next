// Builds the finder data files from the lane outputs. Deterministic, no network. Run: node scripts/sika-finder/build_data.mjs
// Reads (read only): lanes/knowledge/rates.json and the systems builder output systems/out/systems.json. Writes under <portal>/data/finder/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exclusions } from '../../public/demo/sika-210c0c/assets/lib/finder/canuse.js';

const KB = process.env.SIKA_STATE || '/home/tech2/klinge-kernel/state/sika';
const PORTAL = fileURLToPath(new URL('../../public/demo/sika-210c0c/', import.meta.url));
const OUT = path.join(PORTAL, 'data/finder');
fs.mkdirSync(path.join(OUT, 'r'), { recursive: true });

const rates = JSON.parse(fs.readFileSync(path.join(KB, 'lanes/knowledge/rates.json'), 'utf8'));
const idx = { generated: rates.generated, source: 'lanes/knowledge/rates.json', status: {}, noRate: {} };
let nFacts = 0;
for (const [id, p] of Object.entries(rates.products)) {
  const pub = p.rate_status === 'published';
  idx.status[id] = pub ? 'p' : (p.rate_status === 'not published' ? 'n' : 'o');
  if (!pub) idx.noRate[id] = 1;
  const packs = [];
  const seen = new Set();
  for (const f of p.facts.pack_sizes || []) for (const s of (f.parsed && f.parsed.sizes) || []) {
    if (s.component) continue;
    const k = s.amount + s.unit; if (seen.has(k)) continue; seen.add(k);
    packs.push({ amount: s.amount, unit: s.unit, container: s.container || null });
  }
  const packText = (p.facts.pack_sizes || []).map((f) => f.text)[0] || null;
  const src = (f) => ({ docType: f.source.doc_type, url: f.source.url || f.source.web_url, page: f.source.page || null, webUrl: f.source.web_url || null, version: f.source.doc_version || null });
  const consumption = (p.facts.consumption || []).map((f) => ({ id: f.id, text: f.text, parsed: f.parsed, calc_ready: !!f.calc_ready, source: src(f) }));
  nFacts += consumption.length;
  const rec = {
    id, name: p.name, status: pub ? 'published' : p.rate_status, datasheet: p.datasheet ? { url: p.datasheet.url, version: p.datasheet.doc_version, pages: p.datasheet.pages } : null,
    productUrl: p.product_url, packs, packText, consumption,
  };
  fs.writeFileSync(path.join(OUT, 'r', id + '.json'), JSON.stringify(rec));
}
fs.writeFileSync(path.join(OUT, 'r', 'index.json'), JSON.stringify(idx));

// systems: the selector data, plus each product's own exclusions (computed with the same engine as the product page panel)
const sys = JSON.parse(fs.readFileSync(path.join(KB, 'systems/out/systems.json'), 'utf8'));
const excl = {};
for (const pid of Object.keys(sys.products)) {
  const f = path.join(PORTAL, 'data/p', pid + '.json');
  if (!fs.existsSync(f)) continue;
  const p = JSON.parse(fs.readFileSync(f, 'utf8'));
  const e = exclusions(p);
  if (Object.keys(e).length) excl[pid] = { u: p.url, e };
}
sys.excl = excl;
sys.source = 'systems/out/systems.json (systems builder) + exclusions computed from each product page';
fs.writeFileSync(path.join(OUT, 'systems.json'), JSON.stringify(sys));
fs.copyFileSync(path.join(KB, 'systems/out/selector.json'), path.join(OUT, 'selector.json'));
console.log(`rates: ${Object.keys(rates.products).length} products, ${nFacts} consumption statements; systems: ${Object.keys(sys.systems).length} combinations, ${Object.keys(sys.products).length} products, ${Object.keys(excl).length} with exclusions`);
