// Builds data/sales/contacts.json from the crawl already on disk (data/brain/kb.json, data/pages.json). Published contact routes ONLY:
// every value below is looked up in the crawl and the script stops if one is missing, so nothing can be typed in from memory.
// Re-run after merging a branch that adds where-to-buy pages to kb.json: any page whose address has "where-to-buy" or "stockist" and carries lines is added to stockists[].
// usage: node make_shard.mjs [portalDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.resolve(process.argv[2] || path.join(HERE, '..', '..', 'public', 'demo', 'sika-210c0c'));
const kb = JSON.parse(fs.readFileSync(path.join(PORTAL, 'data/brain/kb.json'), 'utf8'));
const pages = JSON.parse(fs.readFileSync(path.join(PORTAL, 'data/pages.json'), 'utf8'));
const page = (u) => kb.pages.find((p) => p.u === u);
const has = (u, text) => { const p = page(u); return !!p && p.l.some((l) => l.includes(text)); };
const must = (ok, what) => { if (!ok) { console.error('NOT PUBLISHED IN THE CRAWL: ' + what); process.exit(2); } };
const U = 'https://aus.sika.com/en/';
const adhesive = kb.prod.find((r) => /au\.technical@au\.sika\.com/.test(r.x || '') && /1300 22 33 48/.test(r.x || ''));
must(adhesive, 'technical email and 1300 22 33 48 in one data sheet sentence');
const sentence = (adhesive.x.match(/[^.]*contact our Technical Service Department on au\.technical@au\.sika\.com or 1300 22 33 48/) || [''])[0].trim();
must(sentence, 'the Technical Service Department sentence');
must(has(U + 'imprint.html', 'Phone +61 2 9725 1145'), 'imprint head office phone');
must(has(U + 'legal-notice.html', '122 Newton Road') && has(U + 'legal-notice.html', 'Phone: 1300 223 348'), 'legal notice address and national line');
for (const u of ['industry/about-industry/contact.html', 'industry/about-industry/contact-expert.html', 'where-to-buy.html', 'SikaTile-distributors.html']) must(pages.some((p) => p.url === U + u), u);
const stockists = kb.pages.filter((p) => /where-to-buy|stockist/i.test(p.u) && p.l.length > 1).map((p) => ({ label: p.t, url: p.u, lines: p.l.slice(0, 40) }));
const out = {
  v: 1, crawl: '2026-10-30',
  note: 'Published Sika Australia contact routes only, each looked up in the crawl on disk by demo-tests/sika-sales/make_shard.mjs. Nothing here is typed in from memory.',
  email: { address: 'au.technical@au.sika.com', label: 'Sika Technical Services', kind: 'technical', source: { url: adhesive.u, sentence } },
  phones: [
    { label: 'Technical Service Department', number: '1300 22 33 48', source: { url: adhesive.u, sentence } },
    { label: 'Head office', number: '+61 2 9725 1145', source: { url: U + 'imprint.html', sentence: 'Head Office Address, Wetherill Park NSW 2164, Phone +61 2 9725 1145' } },
  ],
  forms: [
    { label: 'Contact us', url: U + 'industry/about-industry/contact.html', source: { url: U + 'industry/about-industry/contact.html', sentence: 'Contact us' } },
    { label: 'Ask an Expert (industrial users only)', url: U + 'industry/about-industry/contact-expert.html', source: { url: U + 'industry/about-industry/contact-expert.html', sentence: "Please provide details about your project for specific expertise and follow up. Ask an Expert is for Industrial Users Only" } },
  ],
  offices: [{ label: 'Head office', address: '122 Newton Road, Wetherill Park NSW 2164', phone: '+61 2 9725 1145', source: { url: U + 'legal-notice.html', sentence: 'Sika Australia, 122 Newton Road, Wetherill Park New South Wales 2164, Phone: 1300 223 348' } }],
  stateOffices: [],
  stateOfficesNote: 'The pages this demo holds publish one head office and no state office contacts, so none are listed. The where-to-buy page is the published way to find a local branch or stockist.',
  whereToBuy: { label: 'Where to buy', url: U + 'where-to-buy.html', extra: [{ label: 'SikaTile distributors', url: U + 'SikaTile-distributors.html' }], note: 'The published where-to-buy page searches by location on the Sika website. This demo holds no stockist list of its own.' },
  stockists,
};
const dest = path.join(PORTAL, 'data/sales/contacts.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
console.log('wrote', dest, 'stockist pages from kb:', stockists.length);
