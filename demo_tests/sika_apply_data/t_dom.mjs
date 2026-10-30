// UI builders under a tiny DOM stub (no browser is available in this build environment): chip, How I know, product tabs, safety table, draft box, link health merge.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, summary } from './_env.mjs';

class Node_ {}
class Text_ extends Node_ { constructor(t) { super(); this.data = String(t); } get textContent() { return this.data; } }
class El extends Node_ {
  constructor(tag) { super(); this.tagName = tag.toUpperCase(); this.attrs = {}; this.children = []; this.listeners = {}; this.className = ''; this.value = ''; this.dataset = {}; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : (k === 'class' ? this.className : null); }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  append(...k) { for (const x of k) this.children.push(typeof x === 'string' ? new Text_(x) : x); }
  replaceChildren(...k) { this.children = []; this.append(...k); }
  get textContent() { return this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children = [new Text_(v)]; }
  find(pred, out = []) { for (const c of this.children) if (c instanceof El) { if (pred(c)) out.push(c); c.find(pred, out); } return out; }
  select() {}
}
globalThis.Node = Node_;
globalThis.document = { createElement: (t) => new El(t), createElementNS: (ns, t) => new El(t), createTextNode: (t) => new Text_(t), createDocumentFragment: () => new El('#frag'), head: new El('head'), getElementById: () => null };
globalThis.fetch = async (u) => { const url = new URL(u); if (url.protocol !== 'file:') throw new Error('network call attempted: ' + url.href); const p = fileURLToPath(url); if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => null }; return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) }; };

const A = await import('../../public/demo/sika-210c0c/assets/lib/apply_data.js');
const { setup } = await import('./_env.mjs');
const S = setup();

// chip and How I know on an answer block
const ans = await S.ask('Can I use Davco Grey One Pot over my old tiles?', null);
const blk = ans.blocks.find((b) => b.evidence && b.evidence.length);
const plainNode = new El('p'); plainNode.append(blk.text);
const wrapped = A.decorateBlock(plainNode, blk);
const chip = wrapped.find((e) => e.className === 'chip-status')[0];
check('chip shows the status words', chip && chip.textContent === 'From a published data sheet' && chip.attrs['data-status'] === 'PUBLISHED');
const det = wrapped.find((e) => e.tagName === 'DETAILS')[0];
check('How I know is a collapsed details with the summary', det && det.find((e) => e.tagName === 'SUMMARY')[0].textContent === 'How I know' && !('open' in det.attrs));
const a = det.find((e) => e.tagName === 'A')[0];
check('How I know link starts with https://aus.sika.com/ and opens in a new tab', a.attrs.href.startsWith('https://aus.sika.com/') && a.attrs.href.endsWith('#page=1') && a.attrs.target === '_blank' && /noopener/.test(a.attrs.rel));
check('How I know shows the exact sentence', det.find((e) => e.tagName === 'BLOCKQUOTE')[0].textContent.includes('is not suitable for tiling over concrete, waterproofing membranes or existing ceramic tiles'));
const unk = A.decorateBlock(plainNode, { chip: 'Not in the published data', status: 'UNKNOWN', evidence: [] });
check('unknown chip renders without a panel', unk.find((e) => e.className === 'chip-status')[0].attrs['data-status'] === 'UNKNOWN' && unk.find((e) => e.tagName === 'DETAILS').length === 0);
check('a block without a chip is returned unchanged', A.decorateBlock(plainNode, { type: 'text' }) === plainNode);

// product tabs
const gp = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../public/demo/sika-210c0c/data/p/davco-grey-one-potadhesive.json', import.meta.url)), 'utf8'));
const tabs = await A.extraTabs(gp, {}, gp.docs);
check('Grey One Pot gets the rates and safety tabs (the Specification tab is the portal builder\'s)', tabs.map((t) => t.id).join() === 'rates,safety', tabs.map((t) => t.id).join());
const rt = tabs.find((t) => t.id === 'rates').body();
check('Rates and times tab shows the page-cited rate sentence and version', /10 Litres of Davco Grey One Pot adhesive cover approximately 7\.5m2/.test(rt.textContent) && /November 2023, Version 01\.02, page 2/.test(rt.textContent));
check('Rates and times tab shows every programme time and the not-published steps', /30 minutes at 22/.test(rt.textContent) && /15-25 minutes/.test(rt.textContent) && /Allow a minimum 7 days drying before returning to wet area service/.test(rt.textContent) && /Time not published/.test(rt.textContent));
check('Rates and times tab repeats the guide caveat', /Published times are a guide/.test(rt.textContent));
const holder = tabs.find((t) => t.id === 'safety').body(); await new Promise((r) => setTimeout(r, 50));
const sp = holder.textContent;
check('Safety tab shows the SDS revision date from the lane and the quoted-from line', /Quoted from the safety data sheet dated 18\.11\.2025\. Check the current SDS before use\./.test(sp) && /SDS revision date 18\.11\.2025, version 2\.0/.test(sp), sp.slice(0, 200));
const sdsLink = holder.find((e) => e.tagName === 'A' && /sds-davco-grey-onepotadhesive\.pdf$/.test(e.attrs.href || ''))[0];
check('Safety tab links the SDS PDF', !!sdsLink);
check('Safety tab says Not stated in this SDS where it is silent', /Not stated in this SDS/.test(sp));
check('Safety tab quotes the glove sentence exactly', /Butyl rubber\/nitrile rubber gloves\. Contaminated gloves should be removed\./.test(sp));

// link health merge: a failed document is flagged on the product page copy
const D = await (await import('../../public/demo/sika-210c0c/assets/lib/data.js')).documents();
const failed = D.docs.find((d) => d.http && d.http.status !== 200);
const copy = [{ id: failed.id }]; await A.mergeDocStatus(copy);
check('product page document copy gets the failed status', copy[0].http && copy[0].http.status !== 200);
check('linkOk is false for a failed URL and true for a good one', (await A.linkOk(failed.url)) === false && (await A.linkOk(D.docs.find((d) => d.http && d.http.status === 200).url)) === true);

// T20 / T21 on the system sheets
const SD = await import('../../public/demo/sika-210c0c/assets/lib/sheet_data.js');
const sysDir = fileURLToPath(new URL('../../public/demo/sika-210c0c/systems/', import.meta.url));
const slugs = fs.readdirSync(sysDir).filter((d) => fs.existsSync(sysDir + d + '/index.html'));
const idxIds = new Set(JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../public/demo/sika-210c0c/data/index.json', import.meta.url)), 'utf8')).map((p) => p.id));
let noSteps = 0, badId = 0, nSteps = 0;
for (const sl of slugs) { const ps = SD.parseSheet(fs.readFileSync(sysDir + sl + '/index.html', 'utf8')); if (!ps.steps.length) noSteps++; nSteps += ps.steps.length; for (const st of ps.steps) for (const id of st.products) if (!idxIds.has(id)) badId++; }
check(`parseSheet reads all ${slugs.length} system sheets with steps`, slugs.length > 300 && noSteps === 0, noSteps);
check('every product id on every sheet exists in the catalogue', badId === 0, badId);
const aac = SD.parseSheet(fs.readFileSync(sysDir + 'ceramic-on-aac-internal-floor/index.html', 'utf8'));
check('sheet answers include the substrate', aac.answers.Substrate === 'Autoclaved aerated concrete (AAC)' && aac.steps.length >= 4 && aac.steps[0].products.includes('davco-ultraprime'), JSON.stringify(aac.answers));
const names = new Map(JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../public/demo/sika-210c0c/data/index.json', import.meta.url)), 'utf8')).map((p) => [p.id, p.n]));
const P = await SD.sheetPanels(aac, names);
check('draft spec: a Supply and install clause per step that names products, with the data sheet title and version', (P.specText.match(/Supply and install/g) || []).length >= 3 && /in accordance with the manufacturer's data sheet [^\n]*(Version|20\d\d)/.test(P.specText), P.specText.slice(0, 500));
check('draft spec: label first, no compliance claim, no standard reproduced', P.specText.startsWith('Draft specification text\nDraft for editing. Not approved by Sika.') && !/\b(complies|compliant|conforms)\b/i.test(P.specText.split('References')[0]));
const ptext = P.programme.textContent;
check('programme: shows data sheet sentences with source or Time not published', /Step 1\./.test(ptext) && (/Time not published/.test(ptext) || /hours|minutes|days/.test(ptext)) && /Published times are a guide/.test(ptext), ptext.slice(0, 300));
for (const m of ['views2.js', 'extras.js', 'assistant-ui.js']) { let ok = true, err = ''; try { await import('../../public/demo/sika-210c0c/assets/lib/' + m); } catch (e) { ok = false; err = e.message; } check('module loads without error: ' + m, ok, err); }
check('no network call was made by the UI builders', true);
summary('t_dom');
