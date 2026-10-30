// Build step for the About panel: computes data/coverage.json from the product data and the knowledge lane's verified rate facts.
// usage: node build_coverage.mjs [portalDir]   (the lane's rates.json is read from KNOW)
import fs from 'node:fs';
import path from 'node:path';
import { PORTAL as P0, KNOW } from './_env.mjs';
const PORTAL = process.argv[2] || P0;
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const products = rd(path.join(PORTAL, 'data/products.json')), documents = rd(path.join(PORTAL, 'data/documents.json'));
const rates = rd(path.join(KNOW, 'rates.json'));
const rejects = new Set(fs.readFileSync(path.join(KNOW, 'evidence/verify_rejects.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l).id; } catch { return null; } }));
const cited = (f) => !rejects.has(f.id) && f.text && f.source && (f.source.url || f.source.web_url) && (!/^(PDS|SDS)$/.test(f.source.doc_type) || Number.isInteger(f.source.page));
const tile = products.filter((p) => /(^|\/)tile-stone-installationsystems(\/|$)/.test(p.category));
const pub = tile.filter((p) => { const r = rates.products[p.id]; return r && r.rate_status === 'published' && ((r.facts || {}).consumption || []).some(cited); });
const kinds = { PDS: 0, SDS: 0, WEB: 0 };
for (const p of pub) { const f = rates.products[p.id].facts.consumption.find(cited); kinds[f.source.doc_type] = (kinds[f.source.doc_type] || 0) + 1; }
const out = { builtOn: '2026-10-30', source: 'products.json + knowledge lane rates.json (' + rates.generated + ')', products: products.length, documents: documents.length, tileStone: { products: tile.length, ratePublished: pub.length, firstFactFrom: kinds } };
fs.writeFileSync(path.join(PORTAL, 'data/coverage.json'), JSON.stringify(out));
console.log('coverage.json', JSON.stringify(out));
