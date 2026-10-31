// wave2c_src.mjs: wave 2 lane C questions (names, business pages, offices and hours, clarifier, two-letter typos). Written from the published pages and product data, not from answers.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const P = { T: 'tiler', B: 'builder', C: 'concreter', W: 'waterproofer', S: 'specifier', D: 'distributor', H: 'diy home owner', X: 'sika counter staff' };
const out = []; const a = (persona, category, q, type, exp = {}, messy = '') => out.push({ persona: P[persona], category, q, type, exp, messy, split: 'wave2c' });
// old names and nicknames, each shown on a published page (names.js cites it)
a('T', 'names', 'what is the davco lanko 173 floor leveller', 'product', { products: ['lanko-173-floor-leveller'] });
a('B', 'names', 'davco lanko 173 how much for 20 m2', 'calc', { product: 'lanko-173-floor-leveller' });
a('X', 'names', 'sds for davco lanko 173', 'doc', { product: 'lanko-173-floor-leveller' });
a('T', 'names', 'green bag floor leveller', 'product', { products: ['lanko-173-floor-leveller'] });
a('T', 'names', 'davco 173 floor leveller data sheet', 'doc', { product: 'lanko-173-floor-leveller' });
a('C', 'names', 'sikafiber force 950', 'product', { products: ['sikafiber-novomesh-950'] });
a('C', 'names', 'sika fiber force 950 sds', 'doc', { product: 'sikafiber-novomesh-950' }, 'typo');
a('C', 'names', 'sikafiber novomesh 950 pack size', 'attr', { product: 'sikafiber-novomesh-950', label: 'packag' });
a('T', 'names', 'grey pot adhesive', 'product', { products: ['davco-grey-one-potadhesive'] });
a('T', 'names', 'how long does the davco grey pot take to cure', 'time', { product: 'davco-grey-one-potadhesive' });
a('T', 'names', 'davco grey pot sds', 'doc', { product: 'davco-grey-one-potadhesive' }, 'slang');
a('H', 'names', 'grey pot glue for my bathroom tiles', 'product', { products: ['davco-grey-one-potadhesive'] }, 'slang');
// rebrand and ownership history (the Davco page quotes)
a('D', 'history', 'who owns davco', 'business', { url: 'davco\\.html', must: 'parex' });
a('D', 'history', 'did sika buy parex', 'business', { url: 'davco\\.html', must: '2019' });
a('D', 'history', 'when did sika acquire the davco brand owner', 'business', { url: 'davco\\.html', must: 'parex' });
a('X', 'history', 'did the davco packaging change', 'business', { url: 'davco\\.html', must: 'yellow' });
a('X', 'history', 'why are davco bags yellow now', 'business', { url: 'davco\\.html', must: 'yellow' });
a('T', 'history', 'is the new davco packaging the same product', 'business', { url: 'davco\\.html', must: "hasn't changed" });
a('T', 'history', 'old davco bags vs new davco bags', 'business', { url: 'davco\\.html', must: 'same product' }, 'slang');
a('X', 'history', 'was lanko renamed', 'business', { url: 'davco\\.html', must: 'still the same product name' });
a('X', 'history', 'what is lanko called now', 'business', { url: 'davco\\.html', must: 'still the same product name' });
a('S', 'history', 'did sikafloor level pro used to have another name', 'nodata', {});
a('S', 'history', 'what was sikafloor level top called before', 'nodata', {});
// contact routes by area (Contact.sitemap.xml lists the pages)
for (const [q, slug] of [['contact for flooring', 'flooring-contact'], ['who do i contact about waterproofing', 'waterproofing-contact'], ['roofing contact', 'roofing-contact'], ['contact sika about concrete', 'concrete-contact'], ['contact for sealants and adhesives', 'sealants-adhesives-contact'], ['tile and stone installation contact', 'tile-stone-installation-contact'], ['contact page for tunnelling and mining', 'tunnelling-mining-contact'], ['structural strengthening contact', 'structural-strengthening-contact'], ['grouts and anchoring contact', 'grouts-anchoring-contact'], ['contact for wood floor bonding', 'wood-floor-bonding'], ['who do i contact about passive fire protection', 'passive-fire-protection'], ['sika marketing contact', 'marketing-contact'], ['technical services contact', 'technical\\.html']]) a(q.includes('tile') ? 'T' : 'X', 'contact', q, 'business', { url: slug });
a('X', 'contact', 'who do i contact at sika', 'business', { url: 'imprint|legal-notice|Contact' });
// offices and hours: honest, with the locations page
for (const q of ['sika office in brisbane', 'is there a sika branch in perth', 'nearest sika office to sydney', 'opening hours', 'what are your trading hours', 'where is the sika office in melbourne']) a('B', 'offices', q, 'business', { url: 'sika-locations-australia', must: 'locations' });
// where to buy, training, careers
a('H', 'buy', 'where do i find a stockist near me', 'business', { url: 'where-to-buy', must: 'stockist' });
a('T', 'buy', 'sikatile distributors', 'business', { url: 'SikaTile-distributors|where-to-buy' });
a('T', 'training', 'undertile waterproofing training', 'business', { url: 'Undertile-Waterproofing-training' });
a('S', 'training', 'passive fire protection training', 'business', { url: 'Passive-fire-protection-training|passive-fire' });
a('X', 'careers', 'are you hiring', 'business', { url: 'careers' });
// the generic clarifier and the recommend ask (clarifier with 2 to 4 options, never a silent guess)
for (const q of ['recommend a tile adhesive', 'best tile adhesive', 'something for the roof', 'help with a leak']) a('H', 'vague', q, 'vague', {});
// two-letter typos in catalogue words
a('T', 'typo', 'davco grey one pott adhesve', 'product', { products: ['davco-grey-one-potadhesive'] }, 'typo');
a('T', 'typo', 'sikatile 410 sekure set', 'product', { products: ['sikatile-410-secureset'] }, 'typo');
a('W', 'typo', 'davco k10 raipd', 'product', { products: ['davco-k10-rapid'] }, 'typo');
a('B', 'typo', 'sikafloor levl pro', 'product', { products: ['sikafloor-level-pro'] }, 'typo');
a('T', 'typo', 'davco sanitised colourgrout', 'product', { products: ['davco-sanitized-colorgrout'] }, 'typo');
a('C', 'typo', 'lanko 136 rapid pachting mortar', 'product', { products: ['lanko-136-rapid-patchingmortar'] }, 'typo');
a('T', 'typo', 'sikaceram 880 easy epoxi', 'product', { products: ['sikaceram-880-easyepoxy'] }, 'typo');
a('W', 'typo', 'sikalastic 1k data seet', 'doc', { product: 'sikalastic-1k' }, 'typo');
// honest no-data kept honest
a('X', 'nodata', 'how many people work in the sika brisbane office', 'nodata', {}, '');
a('X', 'nodata', 'what is the sika perth office phone number', 'business', { url: 'sika-locations-australia|imprint|legal-notice|Contact', must: 'sika' });
fs.writeFileSync(path.join(HERE, 'wave2c.json'), JSON.stringify(out.map((x, i) => ({ ...x, id: 'w' + String(i + 1).padStart(3, '0') })), null, 0));
console.log(out.length + ' questions');
