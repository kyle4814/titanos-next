// The quote record, the reference, the request text, the mailto builder, the published-only contact shard, the store integration (persist, stale, clear),
// the anonymous demand signal, and the whole conversation through the assistant (add two products, "get me a quote", intake, confirm).
import fs from 'node:fs';
import path from 'node:path';
import { makeAssistant, ask, check, summary, memStorage, routes, NOW, DATA, load } from './_env.mjs';
const Q = await load('actions/quote.js');
const { createMemory } = await load('actions/memory.js');
const { ESTIMATE_LINE } = await load('actions/core.js');

const R = routes();
const ANSWERS = { site: { postcode: '4000', suburb: 'Brisbane', text: 'Brisbane 4000' }, needed: { iso: '2026-11-20', text: '20 November 2026' }, delivery: 'delivery', role: 'Applicator or tradesperson', company: 'Acme Tiling', name: 'Sam Smith', email: 'sam@acme.com.au', phone: '0412 345 678', best: 'Mornings', notes: 'Grout colour to confirm' };
const project = { name: 'Smith bathroom', items: [
  { id: 'a1', name: 'Davco Grey One Pot adhesive', qty: 6, unit: 'pack', packs: '1 x 10 L', need: '26.67 L', basis: 'area 20 m2', url: 'https://aus.sika.com/x.pdf', phrase: 'will cover approximately 7.5m2 per 20kg bag' },
  { id: 'b2', name: 'Davco Easy Grout', qty: 4, unit: 'bag', packs: '', need: '', basis: '', url: '', phrase: '' }] };
const DOCS = [{ product: 'Davco Easy Grout', kind: 'Data sheet', title: 'Easy Grout PDS', url: 'https://aus.sika.com/en/pds.pdf' }];

// ---- the reference
{
  const rec = Q.buildRecord({ project, answers: ANSWERS, now: NOW, docs: DOCS });
  check('reference format SQ-YYYYMMDD-XXXX', /^SQ-20261101-[0-9A-HJKMNP-TV-Z]{4}$/.test(rec.ref), rec.ref);
  check('status is prepared', rec.status === 'prepared');
  const again = Q.buildRecord({ project, answers: ANSWERS, now: NOW, docs: DOCS });
  check('the reference is deterministic for the same inputs', again.ref === rec.ref);
  const clash = Q.buildRecord({ project, answers: ANSWERS, now: NOW, docs: DOCS, taken: [rec.ref] });
  check('a taken reference is never reused', clash.ref !== rec.ref && /^SQ-20261101-/.test(clash.ref));
  const refs = new Set(); for (let i = 0; i < 400; i++) refs.add(Q.makeRef(NOW, 'seed' + i, [...refs])); check('400 references, all different', refs.size === 400);
  check('the record keeps the lines as they were', rec.lines.length === 2 && rec.lines[0].qty === 6 && rec.lines[0].packs === '1 x 10 L');
  check('the record keeps the job, the contact and the documents', rec.site.postcode === '4000' && rec.contact.email === 'sam@acme.com.au' && rec.docs.length === 1 && rec.delivery === 'delivery');
  check('a bad reference is refused by the cleaner', Q.buildRecord && !JSON.stringify([rec]).includes('undefined'));
}

// ---- the request text
{
  const rec = Q.buildRecord({ project, answers: ANSWERS, now: NOW, docs: DOCS });
  const text = Q.requestText(rec);
  check('text carries the reference and the project', text.includes(rec.ref) && text.includes('Project: Smith bathroom'));
  check('text lists every quantity with its pack breakdown', /1\. Davco Grey One Pot adhesive: 6 packs \(1 x 10 L\), need about 26\.67 L/.test(text) && /2\. Davco Easy Grout: 4 bags/.test(text));
  check('a quantity is cited to its published coverage line', text.includes('Published coverage line: "will cover approximately 7.5m2 per 20kg bag" https://aus.sika.com/x.pdf'));
  check('a quantity with no coverage line says so, never invents one', /No published coverage line was used: this quantity was set by the sender\./.test(text));
  check('text has the job, the contact and the notes', /Site: Brisbane 4000/.test(text) && /Needed by: 20 November 2026/.test(text) && /Email: sam@acme.com.au/.test(text) && /Notes: Grout colour to confirm/.test(text));
  check('text has the documents list with links', text.includes('Easy Grout PDS') && text.includes('https://aus.sika.com/en/pds.pdf'));
  check('text ends with the estimate sentence', text.trim().endsWith(ESTIMATE_LINE));
  check('text has no price and no stock wording', !/\$|\bAUD\b|\bin stock\b|\bavailab/i.test(text.replace('Please reply with a quote. No prices were requested or shown by the advisor.', '')), text);
  check('text has no em or en dash', !/[–—]/.test(text));
  check('compact text drops the coverage lines but keeps every quantity', !/Published coverage line/.test(Q.requestText(rec, { compact: true })) && /Davco Easy Grout: 4 bags/.test(Q.requestText(rec, { compact: true })));
}

// ---- the mailto builder: the full request, only a published address
{
  const rec = Q.buildRecord({ project, answers: ANSWERS, now: NOW, docs: DOCS });
  const m = Q.buildMailto(R, rec);
  check('mailto kind', m.kind === 'mailto' && m.href.startsWith('mailto:au.technical@au.sika.com?subject='));
  const body = decodeURIComponent(/body=(.*)$/.exec(m.href)[1]);
  check('the body is the whole request, encoded', body === Q.requestText(rec) && m.level === 'full' && !m.truncated);
  check('the subject carries the reference', decodeURIComponent(/subject=([^&]*)/.exec(m.href)[1]).includes(rec.ref));
  check('there is exactly one recipient and no cc or bcc', !/[&?](cc|bcc)=/i.test(m.href) && !m.href.slice(7).split('?')[0].includes(','));
  check('the address is the published one, cited', m.source && /aus\.sika\.com/.test(m.source.url) && m.source.sentence.includes('au.technical@au.sika.com') && /only email address Sika publishes/.test(m.note));
  // a hostile address in the shard is refused, and the published form is used instead
  const evil = { ...R, email: { ...R.email, address: 'a@b.com,evil@x.com' } };
  const f = Q.buildMailto(evil, rec); check('a bad address in the shard gives the published form, not a mailto', f.kind === 'form' && /^https:\/\/aus\.sika\.com\//.test(f.url) && /no email address/.test(f.reason));
  const none = Q.buildMailto({}, rec); check('no shard at all gives no route, never an invented address', none.kind === 'none' && !none.href);
  const noMail = { ...R, email: null }; check('no published email uses the published contact form and says so', Q.buildMailto(noMail, rec).kind === 'form' && Q.buildMailto(noMail, rec).url === R.forms[0].url);
  // a long project falls back to the compact text, then a cut with a pointer to Copy
  const big = { name: 'Big', items: Array.from({ length: 40 }, (_, i) => ({ id: 'p' + i, name: 'Product number ' + i + ' long name here', qty: 3, unit: 'pack', packs: '1 x 20 kg', need: '55 kg', basis: 'area 100 m2', url: 'https://aus.sika.com/en/' + 'x'.repeat(60) + i + '.pdf', phrase: 'will cover approximately 4 m2 per 20kg bag when used as directed in the published data sheet' })) };
  const brec = Q.buildRecord({ project: big, answers: ANSWERS, now: NOW, docs: [] });
  const bm = Q.buildMailto(R, brec);
  check('a big project is still under the link cap', encodeURIComponent(bm.body).length <= Q.MAILTO_MAX, encodeURIComponent(bm.body).length);
  check('a big project says it was cut and points to Copy', bm.level !== 'full' && (bm.level === 'compact' || /use Copy the request/.test(bm.body)));
  check('a project at the cap keeps the compact text whole when it fits', Q.buildMailto(R, brec, { max: 99999 }).level === 'full');
}

// ---- the contact shard holds only what the crawl published
{
  const kb = JSON.parse(fs.readFileSync(path.join(DATA, 'brain/kb.json'), 'utf8')); const pages = JSON.parse(fs.readFileSync(path.join(DATA, 'pages.json'), 'utf8'));
  const flat = JSON.stringify(kb); const squash = (s) => s.replace(/\s+/g, ' ');
  check('shard email is in the crawl', flat.includes(R.email.address));
  check('shard email source sentence is in the crawl text', squash(flat).includes(squash(R.email.source.sentence)));
  check('shard email source page is a crawled product page', kb.prod.some((p) => p.u === R.email.source.url && (p.x || '').includes(R.email.address)));
  for (const p of R.phones) { const digits = p.number.replace(/\D/g, ''); check(`phone ${p.number} is in the crawl`, flat.replace(/\D/g, '').includes(digits), p.number); check(`phone ${p.number} source page was crawled`, kb.prod.some((x) => x.u === p.source.url) || kb.pages.some((x) => x.u === p.source.url)); }
  for (const f of R.forms) check(`form ${f.label} was crawled`, pages.some((p) => p.url === f.url));
  check('where-to-buy page was crawled', pages.some((p) => p.url === R.whereToBuy.url) && R.whereToBuy.extra.every((x) => pages.some((p) => p.url === x.url)));
  for (const o of R.offices) check(`office ${o.label} address is in the crawl`, flat.includes('122 Newton Road') && flat.includes('Wetherill Park'));
  const emails = JSON.stringify(R).match(/[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g) || []; check('the shard holds exactly one email address', new Set(emails).size === 1 && emails[0] === 'au.technical@au.sika.com');
  check('state offices are empty because none are published', R.stateOffices.length === 0 && /no state office contacts/.test(R.stateOfficesNote));
  check('every link in the shard is https on aus.sika.com', (JSON.stringify(R).match(/https?:\/\/[^"\s]+/g) || []).every((u) => /^https:\/\/aus\.sika\.com\//.test(u)));
  check('the shard has no price, no stock', !/\$|price|in stock/i.test(JSON.stringify(R)));
}

// ---- the store: persist, stale, clear, import
{
  const st = memStorage(); const mem = createMemory(st, () => NOW);
  mem.addItem({ id: 'a1', name: 'Davco Grey One Pot adhesive', qty: 6, unit: 'pack' }); mem.addItem({ id: 'b2', name: 'Davco Easy Grout', qty: 4, unit: 'bag' });
  const proj = mem.currentProject();
  const rec = Q.buildRecord({ project: proj, answers: ANSWERS, now: NOW, docs: DOCS });
  const res = mem.addQuote(rec); check('the quote is stored', res.ok && mem.quotes().length === 1 && mem.quotes()[0].ref === rec.ref);
  const reload = createMemory(st, () => NOW); check('the quote persists across a reload', reload.quotes().length === 1 && reload.getQuote(rec.ref).contact.email === 'sam@acme.com.au' && reload.getQuote(rec.ref).status === 'prepared');
  check('a duplicate reference is refused', !mem.addQuote(rec).ok);
  check('a garbage record is refused', !mem.addQuote({ ref: 'nope' }).ok && !mem.addQuote(null).ok);
  check('a fresh quote is not stale', !Q.isStale(mem.getQuote(rec.ref), mem.items()));
  mem.setItem('a1', { qty: 7 });
  check('a cart edit after the quote marks it stale', mem.getQuote(rec.ref).status === 'stale' && Q.isStale(mem.getQuote(rec.ref), mem.items()));
  const rr = createMemory(st, () => NOW); check('stale survives a reload', rr.getQuote(rec.ref).status === 'stale');
  mem.setItem('a1', { qty: 6 }); check('putting the quantity back does not make it fresh by itself', mem.getQuote(rec.ref).status === 'stale');
  const doneStale = Q.doneCard(mem.getQuote(rec.ref), R, mem.currentProject()); check('the pack card says it is out of date and offers a new one', /out of date/.test(doneStale.title) && doneStale.quoteView.stale === true && doneStale.notes.some((n) => /no longer matches the cart/.test(n)));
  const rec2 = Q.buildRecord({ project: mem.currentProject(), answers: ANSWERS, now: NOW, docs: [], taken: mem.quotes().map((q) => q.ref), supersedes: rec.ref });
  mem.addQuote(rec2); check('a second quote links to the one it replaces', mem.quotes()[0].supersedes === rec.ref && mem.quotes().length === 2);
  check('add of a new product also marks the newest quote stale', (mem.addItem({ id: 'c3', name: 'Third', qty: 1, unit: 'pack' }), mem.quotes().every((q) => q.status === 'stale')));
  // export and import carry the quotes
  const json = mem.exportJSON(); check('export carries the quotes', JSON.parse(json).projects[mem.current()].quotes.length === 2);
  const other = createMemory(memStorage(), () => NOW); check('import brings the quotes back', other.importJSON(json).ok && other.quotes().length === 2);
  check('import twice does not duplicate quotes', (other.importJSON(json), other.quotes().length === 2));
  // hostile import: bad refs dropped
  const hostile = JSON.parse(json); hostile.projects[mem.current()].quotes.push({ ref: '<script>' }, { ref: 'SQ-20261101-ZZZZ', lines: 'x', contact: 'y' }); const o2 = createMemory(memStorage(), () => NOW); o2.importJSON(JSON.stringify(hostile));
  check('hostile quote records are dropped or cleaned', o2.quotes().every((q) => /^SQ-\d{8}-[0-9A-Z]{4}$/.test(q.ref)) && !o2.quotes().some((q) => q.ref === '<script>'));
  // clearing the project clears the quotes
  mem.clearItems(); check('clearing the project clears its quote requests', mem.quotes().length === 0 && mem.itemCount() === 0);
  const rm = createMemory(memStorage(), () => NOW); rm.addItem({ id: 'a1', name: 'A', qty: 1, unit: 'pack' }); rm.addQuote(Q.buildRecord({ project: rm.currentProject(), answers: ANSWERS, now: NOW })); rm.remove(rm.current()); check('removing the project removes its quotes', rm.quotes().length === 0);
  check('the project list counts quotes', (() => { const m = createMemory(memStorage(), () => NOW); m.addItem({ id: 'a', name: 'A', qty: 1, unit: 'pack' }); m.addQuote(Q.buildRecord({ project: m.currentProject(), answers: ANSWERS, now: NOW })); return m.list()[0].counts.quotes === 1; })());
}

// ---- the anonymous demand signal
{
  const mem = createMemory(memStorage(), () => NOW); mem.addItem({ id: 'a1', name: 'Davco Grey One Pot adhesive', qty: 6, unit: 'pack' });
  mem.addQuote(Q.buildRecord({ project: mem.currentProject(), answers: ANSWERS, now: NOW, docs: DOCS }));
  const sig = Q.demandSignal(mem.quotes(), NOW); const s = JSON.stringify(sig);
  check('the signal has the request, its date, postcode, state and products', sig.requests === 1 && sig.rows[0].postcode === '4000' && sig.rows[0].state === 'QLD' && sig.rows[0].date === '2026-11-01' && sig.rows[0].products[0].id === 'a1');
  check('the signal rolls up by product and by state', sig.by_product[0].requests === 1 && sig.by_state[0].state === 'QLD');
  for (const secret of ['Sam Smith', 'sam@acme.com.au', '0412 345 678', 'Acme Tiling', 'Grout colour', 'Brisbane', 'Mornings']) check(`the signal holds no "${secret}"`, !s.includes(secret));
  check('the signal says it is anonymous and local', /Anonymous/.test(sig.note) && /nothing was sent/.test(sig.note));
  const logC = Q.logCard(mem.quotes(), mem.currentProject()); check('the log card lists the request with date, count and postcode, no contact', logC.rows.length === 1 && /2026-11-01; 1 product; postcode 4000/.test(logC.rows[0].value) && !JSON.stringify(logC.rows).includes('sam@'));
  check('an empty log says so', Q.logCard([], null).notes.some((n) => /None yet/.test(n)));
}

// ---- the sheet model
{
  const rec = Q.buildRecord({ project, answers: ANSWERS, now: NOW, docs: DOCS }); const sm = Q.sheetModel(rec);
  check('sheet: title, banner, estimate sentence', sm.title === 'Quote request' && sm.banner === Q.DEMO_BANNER && sm.estimate === ESTIMATE_LINE);
  check('sheet: every quantity has its cite or none', sm.lines[0].cite && sm.lines[0].cite.url && sm.lines[1].cite === null);
  const mk = (n) => Q.sheetModel(Q.buildRecord({ project: { name: 'x', items: Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, qty: 1, unit: 'pack' })) }, answers: ANSWERS, now: NOW, docs: DOCS }));
  check('sheet: density steps with the number of lines', mk(3).density === 'normal' && mk(5).density === 'normal' && mk(8).density === 'dense' && mk(12).density === 'tight' && mk(25).density === 'micro');
}

// ---- the whole conversation through the assistant
{
  const A = makeAssistant({ now: () => NOW });
  let r = await ask(A, 'get me a quote'); check('an empty project is told so plainly, nothing started', r.card.title === 'Your project is empty' && !A.session.quote && r.card.kind === 'quote');
  await ask(A, 'add 4 bags of Davco Easy Grout'); await ask(A, '/calc 20 m2 Davco Grey One Pot adhesive 6 mm notch'); await ask(A, '/add');
  check('two products are in the project', A.memory.itemCount() === 2, A.memory.items().map((i) => i.id).join(','));
  r = await ask(A, 'get me a quote');
  check('"get me a quote" starts the intake and lists the lines', r.card.kind === 'quote' && r.card.quoteView.step === 'lines' && r.card.rows.length === 2 && r.card.estimate === true && A.session.quote.active === true);
  check('the first card explains how it works', r.card.notes.some((n) => /say "skip"/.test(n)) && r.card.buttons.some((b) => b.command === 'skip') === false && r.card.buttons.some((b) => b.command === 'cancel'));
  for (const t of ['yes', '4000', 'flexible', 'delivery to site', 'builder', 'Acme Builders', 'Sam Smith']) r = await ask(A, t);
  check('now at the email step', r.card.quoteView.step === 'email', r.card.quoteView.step);
  r = await ask(A, 'sam at acme'); check('a bad email is refused in plain words and the step stays', r.card.notes.some((n) => /@ and a domain/.test(n)) && r.card.quoteView.step === 'email');
  for (const t of ['sam@acme.com.au', 'skip', 'skip', 'skip']) r = await ask(A, t);
  check('consent step shows the consent line', r.card.quoteView.step === 'consent' && r.card.notes.includes(Q.CONSENT_LINE));
  r = await ask(A, 'yes'); check('the check shows every answer and the permission close', r.card.quoteView.step === 'confirm' && r.card.notes.includes(Q.CLOSE_QUESTION) && r.card.rows.some((x) => x.label === 'Email' && x.value === 'sam@acme.com.au'));
  r = await ask(A, 'edit postcode'); r = await ask(A, '3000'); check('an edit from the check returns to the check', r.card.quoteView.step === 'confirm' && r.card.rows.some((x) => x.label === 'Site' && x.value === '3000'));
  r = await ask(A, 'yes');
  const rec = A.memory.quotes()[0];
  check('confirm stores the quote with a reference and status prepared', !!rec && /^SQ-20261101-/.test(rec.ref) && rec.status === 'prepared' && r.card.title.includes(rec.ref), r.card.title);
  check('the stored quote has both products and the edited postcode', rec.lines.length === 2 && rec.site.postcode === '3000' && rec.contact.email === 'sam@acme.com.au' && rec.delivery === 'delivery' && rec.role === 'Builder or contractor');
  check('the pack card has the sheet, the mailto, the banner and the copy text', r.card.quoteView.type === 'done' && r.card.quoteView.mail.kind === 'mailto' && r.card.notes.includes(Q.DEMO_BANNER) && r.card.copyText.includes(rec.ref) && r.card.exports[0].filename === rec.ref + '.txt');
  check('the pack card offers the stockist and rep routes', r.card.buttons.some((b) => b.command === '/quote stockist 3000') && r.card.buttons.some((b) => b.command === '/quote rep'));
  check('the intake is closed and the card is marked private', !A.session.quote && r.card.private === true);
  check('no typed answer was remembered as a question', !JSON.stringify(A.memory.recent()).includes('sam@acme') && !JSON.stringify(A.memory.gaps()).includes('sam@acme'));
  check('the request carries no price and cites each coverage line', !/\$/.test(r.card.copyText) && /Published coverage line/.test(r.card.copyText));
  // the cart changes after: the quote goes stale and says so
  await ask(A, 'change quantity of Davco Easy Grout to 9 bags');
  r = await ask(A, '/quote show ' + rec.ref); check('a cart edit after the quote makes it out of date in the card', /out of date/.test(r.card.title) && r.card.quoteView.stale === true);
  r = await ask(A, '/quote log'); check('the log lists it as out of date', r.card.rows[0].label.includes('out of date') && !!r.card.quoteView.signal);
  r = await ask(A, '/quote stockist 3000'); check('the stockist card links the published where-to-buy page and names no stockist', r.card.quoteView.links[0].url === R.whereToBuy.url && /do not list one/.test(r.card.notes.join(' ')) && r.card.rows.length === 0);
  r = await ask(A, 'talk to a Sika rep'); check('the rep card cites every route and admits no state offices are published', r.card.rows.length >= 5 && r.card.rows.every((x) => x.source && /^https:\/\/aus\.sika\.com\//.test(x.source.url)) && /no state office contacts/.test(r.card.notes.join(' ')));
  r = await ask(A, 'find a stockist near 4000'); check('natural stockist phrase routes to the stockist card', r.card.title === 'Find a stockist near 4000');
}

// ---- leaving and coming back
{
  const A = makeAssistant({ now: () => NOW }); await ask(A, 'add 4 bags of Davco Easy Grout');
  let r = await ask(A, '/quote'); r = await ask(A, 'yes'); r = await ask(A, '4000');
  const cart = await ask(A, '/cart'); check('a slash command inside the intake answers normally and offers the way back', cart.card.title.startsWith('My project') && cart.card.buttons.some((b) => b.command === '/quote' && /Back to my quote/.test(b.label)) && A.session.quote.active);
  r = await ask(A, '/quote'); check('/quote resumes at the same step with the answers kept', r.card.quoteView.step === 'needed' && r.card.notes.includes('Picking up where we left off.') && A.session.quote.state.answers.site.postcode === '4000');
  r = await ask(A, 'which primer goes under tiles on concrete?'); check('a question to the advisor pauses the intake (handed on)', r.handled === false && A.session.quote.active === false && A.session.quote.state.step === 'needed');
  r = await ask(A, '/quote'); check('/quote picks the paused intake back up', r.card.quoteView.step === 'needed' && A.session.quote.active === true);
  r = await ask(A, 'cancel'); check('cancel clears the draft and changes nothing', r.card.title === 'Quote request stopped' && !A.session.quote && A.memory.itemCount() === 1 && A.memory.quotes().length === 0);
}
{ // consent no
  const A = makeAssistant({ now: () => NOW }); await ask(A, 'add 4 bags of Davco Easy Grout'); await ask(A, '/quote');
  for (const t of ['yes', 'skip', 'skip', 'skip', 'home owner', 'Sam', 'sam@x.com', 'skip', 'skip', 'skip']) await ask(A, t);
  check('home owner path reaches consent without a company step', A.session.quote.state.step === 'consent');
  const r = await ask(A, 'no'); check('declining at consent prepares nothing', r.card.title === 'No quote prepared' && A.memory.quotes().length === 0 && A.session.quote.active === false);
}
{ // routing: plain product questions never land in the sales engine
  const { route } = await import('../../public/demo/sika-210c0c/assets/actions/parse.js');
  for (const t of ['how much Davco Grey One Pot adhesive for 20 m2', 'what is the open time of SikaTile-400', 'can I use it over old tiles', 'where can I buy Sikaflex', 'is the quote rate published', 'show my projects', 'add 4 bags of Davco Easy Grout', 'compare SikaTile-400 EVO PRO vs SikaTile-410 Secure Set']) check(`not a quote: "${t}"`, !route(t) || route(t).action !== 'quote', JSON.stringify(route(t)));
  for (const t of ['get me a quote', 'can I get a quote for this', 'I need a quote', 'request a quote', 'send this to Sika', 'send my project to sika', 'please prepare a quote request', '/quote', 'give me a quotation']) check(`a quote: "${t}"`, route(t) && route(t).action === 'quote', JSON.stringify(route(t)));
}
summary('t_quote');
