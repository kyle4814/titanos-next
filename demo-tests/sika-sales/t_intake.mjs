// The quote intake state machine: every step, skip, back, edit, validation, the question-pause, and a mutation (break the email check).
import { check, summary, NOW } from './_env.mjs';
import { load } from './_env.mjs';
const Q = await load('actions/quote.js');

const T = (st, text) => Q.intakeStep(st, text, { now: NOW });
const run = (st, ...texts) => texts.reduce((r, t) => T(r.state, t), { state: st, view: null });

// ---- the happy path, every step in order, ends on the check and then the permission close
{
  let st = Q.newIntake(NOW); check('starts on the project list', st.step === 'lines');
  const path = [['yes', 'site'], ['Brisbane 4000', 'needed'], ['20/11/2026', 'delivery'], ['Delivery to site', 'who'], ['Applicator or tradesperson', 'company'], ['Acme Tiling', 'name'], ['Sam Smith', 'email'], ['sam@acme.com.au', 'phone'], ['0412 345 678', 'besttime'], ['Mornings', 'notes'], ['Grout colour to confirm', 'consent']];
  for (const [text, nextStep] of path) { const r = T(st, text); st = r.state; check(`"${text}" moves on to ${nextStep}`, r.view.kind === 'ask' && st.step === nextStep, JSON.stringify(r.view).slice(0, 160)); }
  let r = T(st, 'yes'); st = r.state;
  check('consent leads to the check', r.view.kind === 'confirm' && st.step === 'confirm' && st.consent === true);
  check('the check carries every answer', r.view.rows.some((x) => x.label === 'Site' && x.value === 'Brisbane 4000') && r.view.rows.some((x) => x.label === 'Needed by' && /20 November 2026/.test(x.value)) && r.view.rows.some((x) => x.label === 'Email' && x.value === 'sam@acme.com.au'));
  check('the check asks the permission close', r.view.ask === Q.CLOSE_QUESTION && /would it be okay if I prepared the quote request now/.test(r.view.ask));
  check('the check states the consent line', r.view.consent === "Sika's team will reply by email or phone; nothing is ordered; no prices are shown here.");
  r = T(st, 'yes'); check('yes at the check is done', r.view.kind === 'done');
}

// ---- every step front-loads the concern before it asks
for (const step of Q.ORDER) {
  const v = Q.stepView({ ...Q.newIntake(NOW), step });
  check(`${step}: has a reason and a question`, v.why.length > 20 && v.ask.length > 8, v.why);
  check(`${step}: nothing about price, stock or urgency`, !/\b(price|prices|pricing|cost|stock|in stock|hurry|limited|last chance|act now|only \d+ left)\b/i.test((v.why + ' ' + v.ask).replace(Q.CONSENT_LINE, '').replace(/no prices are shown here/g, '')), v.why);
  check(`${step}: no em or en dash`, !/[–—]/.test(v.why + v.ask));
}
check('the consent step says nothing is ordered and no prices are shown', Q.stepView({ ...Q.newIntake(NOW), step: 'consent' }).why === Q.CONSENT_LINE);
check('the demo banner wording is exact', Q.DEMO_BANNER === "Demo: this prepares the request; it is not sent to Sika's systems from here.");

// ---- skip: only where sensible
{
  for (const step of ['site', 'needed', 'delivery', 'company', 'phone', 'besttime', 'notes']) {
    const r = T({ ...Q.newIntake(NOW), step }, 'skip'); check(`${step}: skip is accepted`, r.view.kind === 'ask' || r.view.kind === 'confirm', JSON.stringify(r.view).slice(0, 100));
    check(`${step}: a skip is remembered`, r.state.skipped.includes(step));
  }
  for (const step of ['who', 'name', 'email']) { const r = T({ ...Q.newIntake(NOW), step }, 'skip'); check(`${step}: cannot be skipped`, r.view.kind === 'invalid' && r.view.error === Q.TEMPLATES.invalid.required && r.state.step === step); }
  check('consent cannot be skipped', T({ ...Q.newIntake(NOW), step: 'consent' }, 'skip').view.kind === 'invalid');
}

// ---- validation, plain messages, the step does not move
{
  const bad = (step, text, rx) => { const r = T({ ...Q.newIntake(NOW), step }, text); check(`${step}: "${text}" is refused`, r.view.kind === 'invalid' && r.state.step === step && (!rx || rx.test(r.view.error)), JSON.stringify(r.view).slice(0, 140)); };
  const good = (step, text, pick) => { const r = T({ ...Q.newIntake(NOW), step }, text); check(`${step}: "${text}" is accepted`, r.view.kind !== 'invalid' && (!pick || pick(r.state.answers)), JSON.stringify(r.view).slice(0, 140)); return r; };
  bad('site', '12', /postcode/); bad('site', '0100', /not an Australian postcode/); bad('site', '4000 <script>', /postcode or suburb/); bad('site', '@@', /postcode/);
  good('site', '4000', (a) => a.site.postcode === '4000'); good('site', 'Wetherill Park', (a) => a.site.suburb === 'Wetherill Park' && a.site.postcode === ''); good('site', 'Wetherill Park NSW 2164', (a) => a.site.postcode === '2164' && a.site.suburb === 'Wetherill Park'); good('site', '0800', (a) => a.site.postcode === '0800'); good('site', '2600', (a) => a.site.postcode === '2600');
  bad('needed', 'soon-ish maybe', /date/); bad('needed', '31/02/2027', /date/); bad('needed', '1/1/2020', /passed/); bad('needed', '2031-01-01', /two years/); bad('needed', '32 Nov', /date/);
  good('needed', '2026-11-20', (a) => a.needed.iso === '2026-11-20'); good('needed', '20 Nov', (a) => a.needed.iso === '2026-11-20'); good('needed', 'tomorrow', (a) => a.needed.iso === '2026-11-02'); good('needed', 'in 2 weeks', (a) => a.needed.iso === '2026-11-15'); good('needed', 'flexible', (a) => a.needed.text === 'Flexible' && a.needed.iso === ''); good('needed', '1/11', (a) => a.needed.iso === '2026-11-01'); good('needed', '5 Jan', (a) => a.needed.iso === '2027-01-05');
  bad('delivery', 'banana', /delivery/); good('delivery', 'pick up', (a) => a.delivery === 'pickup'); good('delivery', 'Delivery to site', (a) => a.delivery === 'delivery'); good('delivery', 'not sure', (a) => a.delivery === 'unsure');
  bad('who', 'astronaut', /options/); good('who', 'home owner', (a) => a.role === 'Home owner'); good('who', 'tiler', (a) => a.role === 'Applicator or tradesperson'); good('who', 'Builder or contractor', (a) => a.role === 'Builder or contractor');
  bad('company', 'x', /2 to 80/); bad('name', 'X', /name/); bad('name', '1234', /letter/); bad('name', 'a@b.com', /name/);
  for (const e of ['plain', 'a@b', 'a@b.c', '@x.com', 'a b@x.com', 'a..b@x.com', 'a@x..com', '.a@x.com', 'a@-x.com', 'a@@x.com', 'a@x.com.', 'sam@acme']) bad('email', e, /@ and a domain/);
  for (const e of ['sam@acme.com.au', 'first.last+tag@sub.example.org', "o'brien@acme.com"]) good('email', e, (a) => a.email === e);
  bad('phone', 'call me', /phone/); bad('phone', '123', /phone/); bad('phone', '1234567890123456', /phone/);
  good('phone', '0412 345 678', (a) => a.phone === '0412 345 678'); good('phone', '+61 412 345 678'); good('phone', '(07) 3000 0000');
  bad('besttime', 'x'.repeat(61), /60/); bad('notes', 'y'.repeat(501), /500/);
  check('consent: gibberish is refused', T({ ...Q.newIntake(NOW), step: 'consent' }, 'purple').view.kind === 'invalid');
  check('consent: no declines and prepares nothing', T({ ...Q.newIntake(NOW), step: 'consent' }, 'no').view.kind === 'declined');
}

// ---- hostile text never throws and never lands as an answer
for (const text of ['<img src=x onerror=alert(1)>', '\u0000\u0001', '"; DROP TABLE', 'a'.repeat(100000), '__proto__', '{"constructor":1}']) {
  for (const step of Q.ORDER) { let ok = true; try { const r = T({ ...Q.newIntake(NOW), step }, text); ok = ['ask', 'invalid', 'confirm', 'paused', 'declined', 'done', 'cancelled'].includes(r.view.kind); } catch { ok = false; } if (!ok) check(`hostile text at ${step}`, false, text.slice(0, 20)); }
}
check('hostile text: survived every step', true);

// ---- global words
{
  let st = { ...Q.newIntake(NOW), step: 'email' };
  check('cancel stops', T(st, 'cancel').view.kind === 'cancelled' && T(st, 'never mind').view.kind === 'cancelled');
  check('help explains why', T(st, 'why').view.help === true);
  let r = T(st, 'back'); check('back goes one step back', r.state.step === 'name');
  r = T({ ...Q.newIntake(NOW), step: 'lines' }, 'back'); check('back on the first step stays', r.state.step === 'lines');
  r = T({ ...Q.newIntake(NOW), step: 'lines' }, 'no'); check('"no" to the list points to the cart', r.view.changeList === true && r.state.step === 'lines');
  r = T({ ...Q.newIntake(NOW), step: 'lines' }, 'banana'); check('anything else on the list step is refused', r.view.kind === 'invalid');
  // a question for the advisor pauses the intake and keeps the answers
  r = T({ ...Q.newIntake(NOW), step: 'name' }, 'which primer goes under tiles on concrete?'); check('a question pauses the intake', r.view.kind === 'paused' && r.state.step === 'name');
  r = T({ ...Q.newIntake(NOW), step: 'notes' }, 'Grout colour? Not sure yet'); check('a short note with a question mark inside is an answer', r.view.kind !== 'paused');
  check('empty input is refused', T(st, '   ').view.kind === 'invalid');
}

// ---- a home owner is not asked for a company
{
  let r = run({ ...Q.newIntake(NOW), step: 'who' }, 'home owner'); check('home owner skips the company step', r.state.step === 'name', r.state.step);
  const back = T(r.state, 'back'); check('back from name returns to who, not company', back.state.step === 'who');
  const sum = Q.summaryRows(r.state); check('the check has no company row for a home owner', !sum.some((x) => x.label === 'Company'));
}

// ---- edit any line before confirming, then return to the check
{
  let st = { ...Q.newIntake(NOW), step: 'confirm', consent: true, answers: { site: { postcode: '4000', suburb: '', text: '4000' }, role: 'Home owner', name: 'Sam', email: 'sam@x.com' } };
  let r = T(st, 'no'); check('"no" at the check offers every edit', r.view.pickEdit === true && r.view.rows.length >= 6);
  r = T(st, 'edit email'); check('edit email jumps to the email step', r.state.step === 'email' && r.state.returnTo === 'confirm' && r.view.editing === true);
  r = T(r.state, 'nope'); check('the edit is validated too', r.view.kind === 'invalid' && r.state.step === 'email');
  r = T(r.state, 'new@x.com'); check('after the edit it returns to the check', r.view.kind === 'confirm' && r.state.step === 'confirm' && r.state.answers.email === 'new@x.com');
  r = T(st, 'change postcode'); check('"change postcode" works', r.state.step === 'site');
  r = T(r.state, 'skip'); check('skipping an edit clears nothing but returns to the check', r.view.kind === 'confirm');
  check('an unknown field is refused', T(st, 'edit banana').view.kind === 'invalid');
  for (const f of ['site', 'date', 'delivery', 'who', 'company', 'name', 'phone', 'time', 'notes']) check(`edit ${f} is understood`, T(st, 'edit ' + f).view.kind === 'ask');
  // not consented yet: yes at the check goes to consent first
  r = T({ ...st, consent: false }, 'yes'); check('no consent, no preparing: the check sends you to consent', r.state.step === 'consent' && r.view.kind === 'ask');
}

// ---- parsers on their own
check('parseSite: lower-case state is dropped', Q.parseSite('wetherill park nsw').value.suburb === 'wetherill park');
check('parseDate: 29 Feb on a leap year', Q.parseDate('29/02/2028', NOW).ok && !Q.parseDate('29/02/2027', NOW).ok);
check('parseDate: today is allowed, yesterday is not', Q.parseDate('1/11/2026', NOW).ok && !Q.parseDate('31/10/2026', NOW).ok);
check('stateOf by published ranges', Q.stateOf('4000') === 'QLD' && Q.stateOf('2164') === 'NSW' && Q.stateOf('3000') === 'VIC' && Q.stateOf('6000') === 'WA' && Q.stateOf('5000') === 'SA' && Q.stateOf('7000') === 'TAS' && Q.stateOf('0800') === 'NT' && Q.stateOf('2600') === 'ACT' && Q.stateOf('abc') === '');

// ---- MUTATION: weaken the email check and prove the suite notices
{
  const weak = (s) => /@/.test(s);
  const samples = ['plain', 'a@b', 'a b@x.com', 'a..b@x.com', '@x.com'];
  const caught = samples.filter((e) => !Q.validEmail(e) && weak(e)).length; // inputs the real check refuses and a weakened one lets through
  check('mutation: a check that only looks for @ would pass bad addresses the real one refuses', caught >= 4, caught);
  check('mutation: the real check refuses all of them', samples.every((e) => !Q.validEmail(e)));
}
summary('t_intake');
