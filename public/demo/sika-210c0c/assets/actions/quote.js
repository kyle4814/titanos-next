// Actions v2, the sales engine inside the bot: a short conversational quote-request intake that starts from the project cart, a one-page Quote Request,
// a prefilled email to a PUBLISHED Sika address, a stockist and rep route from published pages, and an anonymous local view of what was requested.
// Demo only and this browser only. Quantities, never prices; no stock; nothing is ordered; nothing is sent to Sika's systems from here.
// Plain code: no DOM in this file, no model, no network of its own, so Node tests import it directly. The wording lives in TEMPLATES (one object a voice layer can absorb).
import { card, plain, ESTIMATE_LINE, IN_BROWSER_NOTICE } from './core.js';
import { buildJobPack, sigOf, cleanQuote, unitLabel, clip } from '../lib/projectstore.js';

export const DEMO_BANNER = "Demo: this prepares the request; it is not sent to Sika's systems from here.";
export const CONSENT_LINE = "Sika's team will reply by email or phone; nothing is ordered; no prices are shown here.";
export const CLOSE_QUESTION = 'If that all looks right, would it be okay if I prepared the quote request now?';
export const MAILTO_MAX = 4000; // encoded characters of body kept in the email link: long enough for a normal project, short enough for mail programs that cap the link

/** Every word the intake says, in one place. Each step front-loads the concern (why we ask, what happens next), then asks. */
export const TEMPLATES = {
  empty: { title: 'Your project is empty', text: 'A quote request starts from the products in your project, so there is nothing to quote yet. Add products first: name them ("add 4 bags of Davco Easy Grout") or work out a quantity and say "add this to my project". Then say "get me a quote".' },
  start: 'I will ask a few short questions, one at a time. You can say "skip" where it is optional, "back" to go a step back, "edit" followed by a field to change it, or "cancel" to stop. Nothing is ordered and nothing is sent anywhere from here.',
  steps: {
    lines: { label: 'Project', why: 'First, the list that goes on the request. Quantities only: no prices are shown here and nothing is ordered.', ask: 'Is this the right list?' },
    site: { label: 'Site', why: "Sika's team uses the site to point you to the right branch or stockist. A postcode or a suburb is enough; no street address is needed.", ask: 'What is the site postcode or suburb?' },
    needed: { label: 'Needed by', why: "A date helps the team plan the reply. It is a guide only: it is not a promise from either side, and 'flexible' is a fine answer.", ask: 'When do you need it by? For example 20/11/2026, 20 Nov, or in 2 weeks.' },
    delivery: { label: 'Supply', why: "This only tells the team whether to talk about delivery or collection. Nothing is booked.", ask: 'Would you like delivery to site or to pick it up?' },
    who: { label: 'I am a', why: 'Sika Australia replies differently to a trade crew, a builder and a home owner, so a line on who you are helps them answer the right way. Nobody is replaced and no sales pressure follows from it.', ask: 'Which best describes you?' },
    company: { label: 'Company', why: 'A company name helps the team find your account if you already have one. A home owner can skip this.', ask: 'What is your company name?' },
    name: { label: 'Name', why: "The reply needs a person to go to. Your details stay in this browser and appear only on the request you choose to send yourself.", ask: 'What name should the reply be addressed to?' },
    email: { label: 'Email', why: 'The team replies by email first. It is not added to any list.', ask: 'What is your email address?' },
    phone: { label: 'Phone', why: 'A number is optional. It is only there if you would rather talk it through.', ask: 'What is the best phone number? You can skip this.' },
    besttime: { label: 'Best time', why: 'So a call, if you want one, comes at a good time.', ask: 'When is the best time to reach you?' },
    notes: { label: 'Notes', why: 'Anything that helps the team: access, substrate, a colour, a deadline on site.', ask: 'Any notes for the team? You can skip this.' },
    consent: { label: 'Before I prepare it', why: CONSENT_LINE, ask: 'Are you happy with that?' },
    confirm: { label: 'Check', why: 'This is everything that goes on the request. Change any line first if you like.', ask: CLOSE_QUESTION },
  },
  invalid: {
    site: 'I could not read that as a postcode or suburb. A postcode has 4 digits, for example 4000. Or type the suburb, for example Wetherill Park.',
    dateBad: 'I could not read that as a date. Try 20/11/2026, 20 Nov, tomorrow, in 2 weeks, or say "flexible".',
    datePast: 'That date has already passed. Give me a date from today on, or say "flexible".',
    dateFar: 'That date is more than two years away. Give me a nearer date, or say "flexible".',
    delivery: 'Please choose delivery to site, pick it up, or not sure yet.',
    who: 'Please choose one of the options, for example Applicator or tradesperson, Builder or contractor, or Home owner.',
    company: 'A company name is 2 to 80 characters. Or say "skip".',
    name: 'I need a name to address the reply to: 2 to 80 characters, with at least one letter.',
    email: 'That email address does not look right. It needs an @ and a domain, for example name@company.com.au.',
    phone: 'That does not look like an Australian phone number. Use 8 to 12 digits, for example 0412 345 678 or (07) 3000 0000. Or say "skip".',
    besttime: 'Keep that to 60 characters or fewer, for example "mornings" or "after 3pm". Or say "skip".',
    notes: 'Notes can be up to 500 characters. Please shorten it, or say "skip".',
    required: 'This one is needed for the reply, so I cannot skip it.',
    yes: 'Please answer yes or no.',
    edit: 'I did not catch which one to change. Say for example "edit email", or tap one of the options.',
  },
  consentNo: 'No problem. I have not prepared anything and nothing was sent. Say "get me a quote" whenever you are ready; I will keep your answers until you leave this page.',
  cancelled: 'Stopped. Nothing was prepared and nothing was sent. Your project is exactly as it was.',
};

/* ------------------------------------------------------------------ small helpers */
const ROLES = ['Distributor or merchant', 'Applicator or tradesperson', 'Builder or contractor', 'Specifier or architect', 'Engineer', 'Home owner', 'Other'];
const DELIVERY_TEXT = { delivery: 'Delivery to site', pickup: 'I will pick it up', unsure: 'Not sure yet' };
export const ORDER = ['lines', 'site', 'needed', 'delivery', 'who', 'company', 'name', 'email', 'phone', 'besttime', 'notes', 'consent', 'confirm'];
const SKIPPABLE = new Set(['site', 'needed', 'delivery', 'company', 'phone', 'besttime', 'notes']);
const FIELD_STEP = { site: 'site', postcode: 'site', suburb: 'site', location: 'site', address: 'site', date: 'needed', needed: 'needed', when: 'needed', delivery: 'delivery', pickup: 'delivery', supply: 'delivery', who: 'who', role: 'who', trade: 'who', company: 'company', business: 'company', name: 'name', email: 'email', phone: 'phone', mobile: 'phone', number: 'phone', time: 'besttime', besttime: 'besttime', notes: 'notes', note: 'notes' };
const lc = (s) => plain(s).toLowerCase().replace(/[.!]+$/g, '').trim();
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const prettyDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${+m[3]} ${MONTH_NAMES[+m[2] - 1]} ${m[1]}` : ''; };

/* ------------------------------------------------------------------ the answers, one parser each. Each returns { ok:true, value } or { ok:false, error } */
const STATES = 'nsw|vic|qld|sa|wa|tas|nt|act';
export function parseSite(text) {
  const t = plain(text).replace(/\s+/g, ' ').trim();
  const pc = /(?:^|\D)(\d{4})(?!\d)/.exec(t);
  const rest = t.replace(/(?:^|\s)\d{4}(?!\d)/, ' ').replace(new RegExp(`\\b(${STATES})\\b`, 'i'), ' ').replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim();
  if (pc) {
    const n = +pc[1]; if (!((n >= 200 && n <= 299) || (n >= 800 && n <= 9999))) return { ok: false, error: `${pc[1]} is not an Australian postcode. A postcode has 4 digits, for example 4000.` };
    if (rest && !/^[A-Za-z][A-Za-z '’-]{1,59}$/.test(rest)) return { ok: false, error: TEMPLATES.invalid.site };
    return { ok: true, value: { postcode: pc[1], suburb: clip(rest, 60), text: clip(rest ? `${rest} ${pc[1]}` : pc[1], 80) } };
  }
  if (/^[A-Za-z][A-Za-z '’.-]{1,59}$/.test(t) && !/@/.test(t)) { const sub = t.replace(new RegExp(`\\s+(${STATES})$`, 'i'), '').replace(/\.$/, ''); return { ok: true, value: { postcode: '', suburb: clip(sub, 60), text: clip(sub, 80) } }; }
  return { ok: false, error: TEMPLATES.invalid.site };
}

export function parseDate(text, now = new Date()) {
  const t = lc(text); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const flex = /^(flexible|no rush|whenever|not sure|no deadline|open|no date)$/.test(t); if (flex) return { ok: true, value: { iso: '', text: 'Flexible' } };
  if (/^(asap|as soon as (?:you|it) can|as soon as possible)$/.test(t)) return { ok: true, value: { iso: '', text: 'As soon as possible' } };
  let d = null; let m;
  const mk = (y, mo, da) => { const x = new Date(y, mo, da); return x.getFullYear() === y && x.getMonth() === mo && x.getDate() === da ? x : null; };
  const yr = (v) => (v < 100 ? 2000 + v : v);
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) d = mk(+m[1], +m[2] - 1, +m[3]);
  else if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/.exec(t))) d = mk(yr(+m[3]), +m[2] - 1, +m[1]);
  else if ((m = /^(\d{1,2})[\/.-](\d{1,2})$/.exec(t))) { d = mk(today.getFullYear(), +m[2] - 1, +m[1]); if (d && d < today) d = mk(today.getFullYear() + 1, +m[2] - 1, +m[1]); }
  else if ((m = /^(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})\.?(?:,?\s+(\d{4}))?$/.exec(t))) { const mi = MONTHS.indexOf(m[2].slice(0, 3)); if (mi >= 0) { d = mk(m[3] ? +m[3] : today.getFullYear(), mi, +m[1]); if (d && !m[3] && d < today) d = mk(today.getFullYear() + 1, mi, +m[1]); } }
  else if ((m = /^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/.exec(t))) { const mi = MONTHS.indexOf(m[1].slice(0, 3)); if (mi >= 0) { d = mk(m[3] ? +m[3] : today.getFullYear(), mi, +m[2]); if (d && !m[3] && d < today) d = mk(today.getFullYear() + 1, mi, +m[2]); } }
  else if (t === 'today') d = today;
  else if (t === 'tomorrow') d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  else if (t === 'next week') d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  else if (t === 'next month') d = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  else if ((m = /^in\s+(\d{1,3})\s+(day|days|week|weeks|month|months)$/.exec(t))) { const n = +m[1]; d = m[2].startsWith('day') ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + n) : m[2].startsWith('week') ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7 * n) : new Date(today.getFullYear(), today.getMonth() + n, today.getDate()); }
  if (!d) return { ok: false, error: TEMPLATES.invalid.dateBad };
  if (d < today) return { ok: false, error: TEMPLATES.invalid.datePast };
  if (d > new Date(today.getFullYear() + 2, today.getMonth(), today.getDate())) return { ok: false, error: TEMPLATES.invalid.dateFar };
  return { ok: true, value: { iso: ymd(d), text: prettyDate(ymd(d)) } };
}

export function parseDelivery(text) {
  const t = lc(text);
  if (/\b(not sure|unsure|don'?t know|undecided|either|both|later)\b/.test(t)) return { ok: true, value: 'unsure' };
  if (/\b(pick ?-?up|collect|collection|i will get|come and get|counter)\b/.test(t)) return { ok: true, value: 'pickup' };
  if (/\b(deliver|delivery|send|ship|to site|dropped)\b/.test(t)) return { ok: true, value: 'delivery' };
  return { ok: false, error: TEMPLATES.invalid.delivery };
}

export function parseRole(text) {
  const t = lc(text); const exact = ROLES.find((r) => r.toLowerCase() === t); if (exact) return { ok: true, value: exact };
  if (/\b(home ?owner|homeowner|diy|myself|my own (?:house|home)|resident)\b/.test(t)) return { ok: true, value: 'Home owner' };
  if (/\b(merchant|distributor|supplier|stockist|retail|reseller)\b/.test(t)) return { ok: true, value: 'Distributor or merchant' };
  if (/\b(applicator|trade|tradie|tradesperson|tiler|waterproofer|installer|plasterer|concreter|painter)\b/.test(t)) return { ok: true, value: 'Applicator or tradesperson' };
  if (/\b(builder|contractor|construction|site manager|project manager)\b/.test(t)) return { ok: true, value: 'Builder or contractor' };
  if (/\b(specifier|architect|designer|consultant|specifying)\b/.test(t)) return { ok: true, value: 'Specifier or architect' };
  if (/\b(engineer)\b/.test(t)) return { ok: true, value: 'Engineer' };
  if (/^(other|something else|none of these)$/.test(t)) return { ok: true, value: 'Other' };
  return { ok: false, error: TEMPLATES.invalid.who };
}

export function parseCompany(text) { const t = clip(text, 200); return t.length >= 2 && t.length <= 80 ? { ok: true, value: t } : { ok: false, error: TEMPLATES.invalid.company }; }
export function parseName(text) { const t = clip(text, 200); return t.length >= 2 && t.length <= 80 && /[A-Za-z]/.test(t) && !/@/.test(t) ? { ok: true, value: t } : { ok: false, error: TEMPLATES.invalid.name }; }
/** One @, a dotted domain with a 2+ letter ending, no spaces, no consecutive dots, no dot at either end of either half. */
export function validEmail(s) {
  const t = String(s || '').trim(); if (t.length > 120 || /\s/.test(t)) return false;
  const m = /^([^@\s]+)@([^@\s]+)$/.exec(t); if (!m) return false;
  const [, l, d] = m; if (/^\.|\.$|\.\./.test(l) || /^\.|\.$|\.\.|^-|-$/.test(d)) return false;
  return /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+$/.test(l) && /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(d);
}
export function parseEmail(text) { const t = String(text || '').trim().replace(/^mailto:/i, '').replace(/[<>]/g, ''); return validEmail(t) ? { ok: true, value: t } : { ok: false, error: TEMPLATES.invalid.email }; }
export function parsePhone(text) {
  const t = String(text || '').trim(); if (!/^[+(\d][\d\s()+.-]*$/.test(t)) return { ok: false, error: TEMPLATES.invalid.phone };
  const digits = t.replace(/\D/g, ''); return digits.length >= 8 && digits.length <= 12 ? { ok: true, value: clip(t, 30) } : { ok: false, error: TEMPLATES.invalid.phone };
}
export function parseBest(text) { const t = clip(text, 200); return t && t.length <= 60 ? { ok: true, value: t } : { ok: false, error: TEMPLATES.invalid.besttime }; }
export function parseNotes(text) { const raw = String(text || '').trim(); return raw && raw.length <= 500 ? { ok: true, value: clip(raw, 500) } : { ok: false, error: TEMPLATES.invalid.notes }; }
export const isYes = (s) => /^(yes|yep|yeah|yup|y|ok|okay|sure|please do|go ahead|go on|do it|that'?s right|looks (?:good|right)|all good|correct|right|continue|next|i am|i'?m happy|happy|agree|i understand|fine|good)$/.test(lc(s)) || /^(?:yes|yep|yeah)\b/.test(lc(s));
export const isNo = (s) => /^(no|nope|nah|n|not yet|not now|don'?t|do not|no thanks|no thank you)$/.test(lc(s));

const PARSERS = { site: parseSite, delivery: parseDelivery, who: parseRole, company: parseCompany, name: parseName, email: parseEmail, phone: parsePhone, besttime: parseBest, notes: parseNotes };
const SLOT = { site: 'site', needed: 'needed', delivery: 'delivery', who: 'role', company: 'company', name: 'name', email: 'email', phone: 'phone', besttime: 'best', notes: 'notes' };

/* ------------------------------------------------------------------ the intake state machine (pure) */
export const newIntake = (now = new Date()) => ({ v: 1, step: 'lines', answers: {}, skipped: [], consent: false, returnTo: null, started: now.toISOString() });
const clone = (x) => JSON.parse(JSON.stringify(x));

/** The step after `step`, skipping the company step for a home owner. */
export function nextStep(state, step) {
  let i = ORDER.indexOf(step) + 1;
  while (i < ORDER.length) { const s = ORDER[i]; if (s === 'company' && state.answers.role === 'Home owner') { i++; continue; } return s; }
  return 'confirm';
}
const prevStep = (state, step) => { let i = ORDER.indexOf(step) - 1; while (i > 0) { const s = ORDER[i]; if (s === 'company' && state.answers.role === 'Home owner') { i--; continue; } return s; } return ORDER[0]; };

/** The question for a step: { step, index, total, label, why, ask, options[], skippable }. */
export function stepView(state, step = state.step) {
  const T = TEMPLATES.steps[step]; const opts = [];
  if (step === 'lines') opts.push({ label: 'Yes, that is the list', value: 'yes' });
  if (step === 'delivery') Object.values(DELIVERY_TEXT).forEach((v) => opts.push({ label: v, value: v }));
  if (step === 'who') ROLES.forEach((r) => opts.push({ label: r, value: r }));
  if (step === 'besttime') ['Mornings', 'Afternoons', 'Any time', 'Email only, please'].forEach((v) => opts.push({ label: v, value: v }));
  if (step === 'consent') { opts.push({ label: 'Yes, I am happy with that', value: 'yes' }, { label: 'No, stop here', value: 'no' }); }
  if (step === 'confirm') { opts.push({ label: 'Yes, prepare the request', value: 'yes' }, { label: 'No, I want to change something', value: 'no' }); }
  return { step, index: ORDER.indexOf(step) + 1, total: ORDER.length, label: T.label, why: T.why, ask: T.ask, options: opts, skippable: SKIPPABLE.has(step) };
}

/** The confirm summary: one row per field, each with the step that edits it. */
export function summaryRows(state) {
  const a = state.answers; const rows = [];
  const add = (label, value, edit) => rows.push({ label, value: value || 'Not given', edit });
  add('Site', a.site ? a.site.text : '', 'site');
  add('Needed by', a.needed ? a.needed.text : '', 'needed');
  add('Supply', a.delivery ? DELIVERY_TEXT[a.delivery] : '', 'delivery');
  add('I am a', a.role, 'who');
  if (a.role !== 'Home owner') add('Company', a.company, 'company');
  add('Name', a.name, 'name'); add('Email', a.email, 'email'); add('Phone', a.phone, 'phone'); add('Best time', a.best, 'besttime'); add('Notes', a.notes, 'notes');
  return rows;
}

function record(state, step, value, skipped = false) {
  const a = state.answers; const slot = SLOT[step];
  if (step === 'needed') a.needed = value; else if (step === 'site') a.site = value; else if (slot) a[slot] = value;
  state.skipped = state.skipped.filter((s) => s !== step); if (skipped) state.skipped.push(step);
}

/**
 * One turn of the intake. Input is the visitor's text; returns { state, view } where view is
 * { kind: 'ask' | 'invalid' | 'confirm' | 'done' | 'cancelled' | 'declined' | 'paused', ... }. Never throws on hostile text.
 */
export function intakeStep(state0, text, { now = new Date() } = {}) {
  const state = clone(state0); const step = state.step; const raw = String(text == null ? '' : text).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  const t = lc(raw);
  const ask = (extra = {}) => ({ state, view: { kind: 'ask', ...stepView(state), ...extra } });
  const invalid = (error) => ({ state, view: { kind: 'invalid', ...stepView(state), error } });
  const advance = (from) => {
    if (state.returnTo && step !== 'consent') { const to = state.returnTo; state.returnTo = null; state.step = to; return to === 'confirm' ? confirm() : ask(); }
    state.step = nextStep(state, from); return state.step === 'confirm' ? confirm() : ask();
  };
  const confirm = () => ({ state, view: { kind: 'confirm', ...stepView(state, 'confirm'), rows: summaryRows(state), consent: CONSENT_LINE } });
  if (!raw) return invalid('Please type an answer, or say "skip" if this one is optional.');
  if (/^(cancel|stop|quit|exit|never ?mind|forget it|leave it|abort)$/.test(t)) return { state, view: { kind: 'cancelled' } };
  if (/^(help|\?|why|why do you ask|what for)$/.test(t)) return ask({ help: true });
  if (/^(back|go back|previous|undo)$/.test(t)) { if (state.step === 'lines') return ask(); state.returnTo = null; state.step = prevStep(state, state.step); return ask(); }
  const ed = /^(?:edit|change|fix|update|correct)\s+(?:my\s+|the\s+)?([a-z ]+?)\s*$/.exec(t);
  if (ed) { const key = ed[1].replace(/\s+/g, ''); const to = FIELD_STEP[key] || FIELD_STEP[ed[1].split(' ')[0]]; if (!to) return invalid(TEMPLATES.invalid.edit); state.returnTo = 'confirm'; state.step = to; return ask({ editing: true }); }
  if (/^(skip|skip it|pass|no thanks|none|n\/a|nothing|not now|leave (?:it )?blank)$/.test(t) && SKIPPABLE.has(step) && step !== 'consent') { record(state, step, null, true); return advance(step); }
  if (/^skip\b/.test(t) && !SKIPPABLE.has(step)) return invalid(TEMPLATES.invalid.required);
  // a question aimed at the advisor ("which primer for concrete?") is not an answer: leave the intake paused and let the advisor take it
  if (/\?\s*$/.test(raw) && raw.split(/\s+/).length >= 3) return { state, view: { kind: 'paused' } };
  if (step === 'lines') { if (isYes(raw) || /^(that'?s it|it is|yes please|go on|ready)$/.test(t)) return advance('lines'); if (isNo(raw)) return ask({ changeList: true }); return invalid('Say yes if the list is right, or open my projects page to change it, then say "get me a quote" again.'); }
  if (step === 'needed') { const r = parseDate(raw, now); if (!r.ok) return invalid(r.error); record(state, step, r.value); return advance(step); }
  if (step === 'consent') {
    if (isYes(raw)) { state.consent = true; return advance('consent'); }
    if (isNo(raw)) return { state, view: { kind: 'declined' } };
    return invalid(TEMPLATES.invalid.yes);
  }
  if (step === 'confirm') {
    if (isYes(raw)) { if (!state.consent) { state.step = 'consent'; return ask(); } return { state, view: { kind: 'done' } }; }
    if (isNo(raw)) return { state, view: { kind: 'ask', ...stepView(state, 'confirm'), rows: summaryRows(state), pickEdit: true } };
    return invalid(TEMPLATES.invalid.yes);
  }
  const parse = PARSERS[step];
  if (!parse) return ask();
  const r = parse(raw); if (!r.ok) return invalid(r.error);
  record(state, step, r.value); if (step === 'who' && r.value === 'Home owner') { state.answers.company = ''; }
  return advance(step);
}

/* ------------------------------------------------------------------ the record */
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // no I, L, O, U: a reference read down the phone cannot be misheard as a digit
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
/** SQ-YYYYMMDD-XXXX, deterministic from its seed, never one already in `taken`. */
export function makeRef(now, seed, taken = []) {
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`; const used = new Set(taken);
  for (let salt = 0; salt < 5000; salt++) { let h = fnv(`${seed}|${salt}`); let s = ''; for (let i = 0; i < 4; i++) { s += ALPHA[h & 31]; h = (h >>> 5) | (fnv(seed + i) << 27); } const ref = `SQ-${day}-${s}`; if (!used.has(ref)) return ref; }
  throw new Error('no free quote reference');
}

const lineOf = (it) => `${it.qty} ${unitLabel(it.unit, it.qty)}${it.packs ? ' (' + it.packs + ')' : ''}`;
/** One stored calculation (projectStore.calculations()) as the short, cited line the request carries. */
export const calcLine = (c) => ({ id: c.id, title: c.title || c.productName || c.kind, answer: c.answer || c.summary || '', formula: c.formula || '', source: c.citation ? c.citation.text : '', url: c.citation ? c.citation.url : '', estimate: c.estimate || '' });
/** The saved record from a project, the answers, the time and the document links. */
export function buildRecord({ project, answers, now = new Date(), taken = [], docs = [], supersedes = '', calcs = [] }) {
  const items = project.items || []; const a = answers || {};
  const created = now.toISOString(); const sig = sigOf(items);
  const ref = makeRef(now, `${created}|${sig}|${a.email || ''}|${project.name}`, taken);
  const rec = cleanQuote({
    ref, status: 'prepared', created, project: project.name, sig, supersedes,
    lines: items.map((i) => ({ id: i.id, name: i.name || i.id, qty: i.qty, unit: i.unit, packs: i.packs, need: i.need, basis: i.basis, url: i.url, phrase: i.phrase })),
    site: a.site || {}, needed: a.needed || {}, delivery: a.delivery || '', role: a.role || '', company: a.company || '',
    contact: { name: a.name, email: a.email, phone: a.phone, best: a.best }, notes: a.notes || '', docs, calcs: (calcs || []).map(calcLine),
  });
  return rec;
}
/** Has the cart changed since this request was prepared? */
export const isStale = (rec, items) => !rec || rec.status === 'stale' || rec.sig !== sigOf(items || []);

/** The plain-text request: what is copied, downloaded and put in the email. Quantities only, every quantity cited to its coverage line when there is one. */
export function requestText(rec, { compact = false } = {}) {
  const L = [`Quote request ${rec.ref}`, 'Prepared with the Sika product advisor demo. Demo: this was not sent to Sika\'s systems from the demo; it is an enquiry written by the sender.', '', `Project: ${rec.project}`, `Prepared: ${(rec.created || '').slice(0, 10)}`, '', 'Products and quantities:'];
  rec.lines.forEach((l, i) => {
    L.push(`${i + 1}. ${l.name}: ${lineOf(l)}${l.need ? `, need about ${l.need}` : ''}`);
    if (!compact) {
      if (l.basis) L.push(`   Basis: ${l.basis}`);
      if (l.phrase) L.push(`   Published coverage line: "${l.phrase}"${l.url ? ' ' + l.url : ''}`);
      else L.push('   No published coverage line was used: this quantity was set by the sender.');
    }
  });
  L.push('', 'Job:');
  L.push(`- Site: ${rec.site.text || 'not given'}`);
  L.push(`- Needed by: ${rec.needed.text || 'not given'}`);
  L.push(`- Supply: ${DELIVERY_TEXT[rec.delivery] || 'not given'}`);
  L.push(`- Sender: ${rec.role || 'not given'}${rec.company ? ', ' + rec.company : ''}`);
  L.push('', 'Contact:', `- Name: ${rec.contact.name}`, `- Email: ${rec.contact.email}`, `- Phone: ${rec.contact.phone || 'not given'}`, `- Best time: ${rec.contact.best || 'not given'}`);
  if (rec.notes) L.push('', `Notes: ${rec.notes}`);
  if (!compact && (rec.calcs || []).length) { L.push('', 'Calculations behind the quantities (estimates, with their working):'); rec.calcs.forEach((k, i) => { L.push(`${i + 1}. ${k.title}: ${k.answer}`); if (k.formula) L.push(`   Working: ${k.formula}`); if (k.source) L.push(`   Source: ${k.source}${k.url ? ' ' + k.url : ''}`); }); }
  if (!compact && rec.docs.length) { L.push('', 'Data sheets and safety data sheets for these products:'); rec.docs.forEach((d) => L.push(`- ${d.product} | ${d.kind} | ${d.title}`, `  ${d.url}`)); }
  L.push('', 'Please reply with a quote. No prices were requested or shown by the advisor.', '', ESTIMATE_LINE);
  return plain(L.join('\n')).replace(/ +\n/g, '\n') + '\n';
}

/* ------------------------------------------------------------------ the contact route (published addresses only) */
/** The email link. Uses ONLY the address in the published-contacts shard; with no published address it gives the published contact form instead and says so. */
export function buildMailto(routes, rec, { max = MAILTO_MAX } = {}) {
  const e = routes && routes.email && validEmail(routes.email.address) ? routes.email : null;
  if (!e) {
    const f = routes && Array.isArray(routes.forms) && routes.forms.find((x) => /^https:\/\/aus\.sika\.com\//.test(x.url));
    return f ? { kind: 'form', url: f.url, label: f.label, reason: 'Sika publishes no email address for this on the pages this demo holds, so use the published contact form and paste the copied request into it.' } : { kind: 'none', reason: 'No published contact route is available in this demo.' };
  }
  const subject = `Quote request ${rec.ref} from the Sika product advisor demo`;
  let body = requestText(rec); let level = 'full';
  if (encodeURIComponent(body).length > max) { body = requestText(rec, { compact: true }); level = 'compact'; }
  let truncated = false;
  if (encodeURIComponent(body).length > max) { truncated = true; level = 'cut'; while (encodeURIComponent(body + '\n[cut: use Copy the request for the full text]\n').length > max && body.length > 200) body = body.slice(0, Math.floor(body.length * 0.9)); body = body.replace(/[^\n]*$/, '') + '[cut: use Copy the request for the full text]\n'; }
  const href = `mailto:${e.address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { kind: 'mailto', href, to: e.address, label: e.label, subject, body, level, truncated, source: e.source, note: e.kind === 'technical' ? `${e.label} is the only email address Sika publishes on the pages this demo holds. There is no published sales address, so the request goes to the published address and says what it is.` : '' };
}

/* ------------------------------------------------------------------ the printable sheet model, the demand signal */
export function sheetModel(rec) {
  // the page holds more lines by setting them smaller; the documents list gives way first (every link stays in the copied request text)
  const n = rec.lines.length; const density = n <= 5 ? 'normal' : n <= 10 ? 'dense' : n <= 18 ? 'tight' : 'long'; // 19 or more lines: normal type, the sheet may run to a second page (no more squeezing to 5 pt)
  const docsShown = rec.docs.slice(0, { normal: 12, dense: 4, tight: 0, long: 12 }[density]);
  return {
    ref: rec.ref, title: 'Quote request', project: rec.project, prepared: (rec.created || '').slice(0, 10), density, banner: DEMO_BANNER, estimate: ESTIMATE_LINE,
    lines: rec.lines.map((l) => ({ name: l.name, qty: lineOf(l), need: l.need ? `about ${l.need}` : '', basis: l.basis, cite: l.phrase ? { text: l.phrase, url: l.url } : null })),
    job: [['Site', rec.site.text || 'Not given'], ['Needed by', rec.needed.text || 'Not given'], ['Supply', DELIVERY_TEXT[rec.delivery] || 'Not given'], ['Sender', (rec.role || 'Not given') + (rec.company ? ', ' + rec.company : '')]],
    contact: [['Name', rec.contact.name], ['Email', rec.contact.email], ['Phone', rec.contact.phone || 'Not given'], ['Best time', rec.contact.best || 'Not given']],
    calcs: (rec.calcs || []).map((k) => ({ title: k.title, answer: k.answer, formula: k.formula, source: k.source, url: k.url })),
    notes: rec.notes, docs: docsShown, docsMore: rec.docs.length - docsShown.length,
  };
}

const STATE_RANGES = [['ACT', 200, 299], ['NT', 800, 999], ['NSW', 1000, 1999], ['ACT', 2600, 2618], ['NSW', 2000, 2599], ['NSW', 2619, 2899], ['ACT', 2900, 2920], ['NSW', 2921, 2999], ['VIC', 3000, 3999], ['QLD', 4000, 4999], ['SA', 5000, 5999], ['WA', 6000, 6999], ['TAS', 7000, 7999], ['VIC', 8000, 8999], ['QLD', 9000, 9999]];
/** The state a postcode belongs to by Australia Post's published ranges, or ''. */
export const stateOf = (pc) => { const n = +pc; if (!/^\d{4}$/.test(String(pc || ''))) return ''; const r = STATE_RANGES.find(([, a, b]) => n >= a && n <= b); return r ? r[0] : ''; };

/** What a demand signal would look like, with no personal data: no name, email, phone, company, notes or suburb ever enters it. */
export function demandSignal(quotes, now = new Date()) {
  const rows = (quotes || []).map((q) => ({
    ref: q.ref, date: (q.created || '').slice(0, 10), status: q.status, postcode: q.site && q.site.postcode || '', state: stateOf(q.site && q.site.postcode), role: q.role, supply: q.delivery, needed_by: q.needed && q.needed.iso || '',
    products: q.lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, unit: l.unit })),
  }));
  const by = new Map(); for (const r of rows) for (const p of r.products) { const x = by.get(p.id) || { id: p.id, name: p.name, requests: 0, lines: 0 }; x.requests++; x.lines += p.qty; by.set(p.id, x); }
  return { note: 'Demo only. Anonymous: no name, email, phone, company, notes or street address. Made in this browser from the quote requests prepared here; nothing was sent anywhere.', exported: now.toISOString(), requests: rows.length, by_product: [...by.values()].sort((a, b) => b.requests - a.requests || a.name.localeCompare(b.name)), by_state: Object.entries(rows.reduce((m, r) => { const s = r.state || 'Unknown'; m[s] = (m[s] || 0) + 1; return m; }, {})).map(([state, requests]) => ({ state, requests })), rows };
}

/* ------------------------------------------------------------------ cards */
const qcard = (title, o = {}) => card('quote', 'quote', title, { estimate: false, notice: IN_BROWSER_NOTICE, ...o });
const CART_CMD = { label: 'What is in my project', command: '/cart' };

function itemRows(items) { return items.map((i) => ({ label: i.name || i.id, value: lineOf(i) + (i.need ? `; need about ${i.need}` : ''), productId: i.id, derived: !!i.need, meta: !i.need, source: i.url ? { url: i.url, label: 'Published rate', sentence: i.phrase || '' } : null })); }

export function stepCard(view, project, { first = false, resume = false } = {}) {
  const items = (project && project.items) || [];
  const c = qcard(view.step === 'confirm' ? 'Check the request' : `Quote request: ${view.label}`, { estimate: view.step === 'lines' || view.step === 'confirm', quoteView: { type: 'step', step: view.step, index: view.index, total: view.total } });
  c.summary = '';
  if (view.error) c.notes.push(view.error);
  if (resume) c.notes.push('Picking up where we left off.');
  if (first) c.notes.push(TEMPLATES.start);
  c.notes.push(view.why); c.notes.push(view.ask);
  if (view.help) c.notes.unshift('Why I ask: ' + view.why);
  if (view.step === 'lines') { c.rows = itemRows(items); c.cartLinks = true; if (view.changeList) c.notes.unshift('To change the list, use the My projects page or say "change quantity of ..." or "remove ...", then say "get me a quote" again. I will keep your place.'); }
  if (view.rows) c.rows = view.rows.map((r) => ({ label: r.label, value: r.value, meta: true, source: null }));
  c.buttons = (view.options || []).map((o) => ({ label: o.label, command: o.value }));
  if (view.pickEdit && view.rows) { c.notes.unshift('Which one would you like to change?'); c.buttons = view.rows.map((r) => ({ label: `Change ${r.label.toLowerCase()}`, command: `edit ${r.edit}` })); }
  if (view.skippable) c.buttons.push({ label: 'Skip', command: 'skip' });
  if (view.step !== 'lines') c.buttons.push({ label: 'Back', command: 'back' });
  c.buttons.push({ label: 'Cancel', command: 'cancel' });
  c.stepNo = `Step ${view.index} of ${view.total}`;
  return c;
}

export function infoCard(title, notes, buttons = []) { const c = qcard(title, { quoteView: { type: 'info' } }); c.notes = notes; c.buttons = buttons; return c; }

/** The finished request: the sheet, the email link, the copy text, the next routes. */
export function doneCard(rec, routes, project) {
  const stale = isStale(rec, project ? project.items : rec.lines);
  const mail = buildMailto(routes, rec); const text = requestText(rec);
  const c = qcard(`Quote request ${rec.ref} ${stale ? 'is out of date' : 'is ready'}`, { estimate: true, quoteView: { type: 'done', ref: rec.ref, stale, mail: { kind: mail.kind, href: mail.href, url: mail.url, label: mail.label, note: mail.note, reason: mail.reason, to: mail.to, truncated: !!mail.truncated, level: mail.level }, sheet: sheetModel(rec) } });
  c.summary = `${rec.lines.length} ${rec.lines.length === 1 ? 'product' : 'products'} for ${rec.project}. Quantities only, no prices.`;
  c.notes.push(DEMO_BANNER);
  if (stale) c.notes.push('Your project changed after this request was prepared, so it no longer matches the cart. Say "get me a quote" to prepare a new one.');
  c.rows = [{ label: 'Reference', value: rec.ref, meta: true, source: null }, { label: 'Status', value: stale ? 'Out of date (the project changed)' : 'Prepared in this demo, not sent', meta: true, source: null }, ...itemRows(rec.lines)];
  c.copyText = text; c.copyLabel = 'Copy the request'; c.copyAria = 'The quote request text';
  c.exports = [{ label: 'Download the request (text)', filename: `${rec.ref}.txt`, mime: 'text/plain;charset=utf-8', text }];
  c.buttons = [{ label: rec.site.postcode ? `Find a stockist near ${rec.site.postcode}` : 'Find a stockist', command: rec.site.postcode ? `/quote stockist ${rec.site.postcode}` : '/quote stockist' }, { label: 'Talk to a Sika rep', command: '/quote rep' }, { label: 'My quote requests', command: '/quote log' }];
  c.cartLinks = true;
  return c;
}

export function stockistCard(routes, postcode) {
  const w = (routes && routes.whereToBuy) || {};
  const c = qcard(postcode ? `Find a stockist near ${postcode}` : 'Find a stockist', { quoteView: { type: 'stockist' } });
  const st = stateOf(postcode);
  c.notes.push(w.note || 'Sika publishes a where-to-buy page that searches by location.');
  if (postcode) c.notes.push(`Enter ${postcode}${st ? ' (' + st + ')' : ''} on that page. I cannot name a stockist myself, because the pages this demo holds do not list one.`);
  const links = [w.url && { label: w.label || 'Where to buy', url: w.url }, ...((w.extra || []).map((x) => ({ label: x.label, url: x.url })))].filter(Boolean);
  c.topButtons = [];
  c.rows = (routes && routes.stockists || []).slice(0, 12).map((s) => ({ label: s.label, value: s.url, source: { url: s.url, label: s.label, sentence: (s.lines || [])[0] || s.label } }));
  c.quoteView.links = links;
  c.buttons = [{ label: 'Talk to a Sika rep', command: '/quote rep' }, { label: 'My quote requests', command: '/quote log' }];
  return c;
}

export function repCard(routes) {
  const c = qcard('Talk to a Sika rep', { quoteView: { type: 'rep' } });
  const r = routes || {};
  c.notes.push('These are the contact routes Sika publishes. Each one is cited to the page it comes from.');
  c.rows = [];
  for (const o of r.offices || []) c.rows.push({ label: o.label, value: `${o.address}. Phone ${o.phone}`, source: { url: o.source.url, label: 'Sika Australia page', sentence: o.source.sentence } });
  for (const p of r.phones || []) c.rows.push({ label: `${p.label} phone`, value: p.number, source: { url: p.source.url, label: 'Sika Australia page', sentence: p.source.sentence } });
  if (r.email) c.rows.push({ label: r.email.label + ' email', value: r.email.address, source: { url: r.email.source.url, label: 'Product page', sentence: r.email.source.sentence } });
  for (const f of r.forms || []) c.rows.push({ label: f.label, value: f.url, source: { url: f.source.url, label: f.label, sentence: f.source.sentence } });
  c.notes.push(r.stateOfficesNote || 'State office contacts are not in the published pages this demo holds.');
  c.buttons = [{ label: 'Find a stockist', command: '/quote stockist' }, { label: 'My quote requests', command: '/quote log' }];
  return c;
}

export function logCard(quotes, project) {
  const c = qcard('My quote requests', { quoteView: { type: 'log' } });
  if (!quotes.length) { c.notes.push('None yet. Say "get me a quote" when your project is ready.'); c.buttons = [{ label: 'Get me a quote', command: '/quote' }]; return c; }
  const items = project ? project.items : [];
  c.rows = quotes.map((q) => ({ label: `${q.ref}${isStale(q, items) ? ' (out of date)' : ''}`, value: `${(q.created || '').slice(0, 10)}; ${q.lines.length} ${q.lines.length === 1 ? 'product' : 'products'}${q.site.postcode ? '; postcode ' + q.site.postcode : ''}`, meta: true, source: null, command: `/quote show ${q.ref}` }));
  c.notes.push('Anonymous view: the list above and the export hold no names or contact details. Clearing the project clears them.');
  c.buttons = [{ label: 'Get me a quote', command: '/quote' }];
  c.quoteView.signal = demandSignal(quotes);
  return c;
}

/* ------------------------------------------------------------------ the conversation entry (called by flow.js) */
const subOf = (rest) => { const t = lc(rest); const m = /^(cancel|new|restart|log|list|history|requests|show|last|stockist|rep|contact)\b\s*(.*)$/.exec(t); if (m) return { cmd: m[1], arg: m[2].trim() }; return { cmd: '', arg: t }; };
const loadRoutes = async (data) => { try { return (await data.sales()) || null; } catch { return null; } };
const nameOfItem = (i) => i.name || i.id;

/**
 * One turn of the quote conversation. ctx: { data, memory, session, now, text, rest, route }. Returns a card, or null when the turn is not for the quote
 * (a slash command while the intake is open, or a question for the advisor): the intake then stays open and flow.js answers as usual.
 */
export async function quoteTurn(ctx) {
  const { data, memory, session, text, route } = ctx; const now = ctx.now || new Date();
  if (!memory) return infoCard('Quote request', ['Project memory is not available in this browser, so there is no project to quote from.']);
  const project = memory.currentProject(); const items = project ? project.items : [];
  const explicit = !!(route && route.action === 'quote');
  const sub = explicit ? subOf(route.rest || '') : { cmd: '', arg: '' };
  const q = session.quote;
  if (explicit) {
    if (sub.cmd === 'cancel') { session.quote = null; return infoCard('Quote request stopped', [TEMPLATES.cancelled]); }
    if (sub.cmd === 'log' || sub.cmd === 'list' || sub.cmd === 'history' || sub.cmd === 'requests') return logCard(memory.quotes(), project);
    if (sub.cmd === 'show' || sub.cmd === 'last') { const list = memory.quotes(); const rec = sub.arg ? list.find((x) => x.ref.toLowerCase() === sub.arg.toLowerCase()) : list[0]; if (!rec) return infoCard('No such quote request', ['I could not find that reference in this project. Say "/quote log" to see the list.'], [{ label: 'My quote requests', command: '/quote log' }]); return doneCard(rec, await loadRoutes(data), project); }
    if (sub.cmd === 'stockist') { const pc = (/\b(\d{4})\b/.exec(sub.arg) || [])[1] || (memory.quotes()[0] && memory.quotes()[0].site.postcode) || ''; return stockistCard(await loadRoutes(data), pc); }
    if (sub.cmd === 'rep' || sub.cmd === 'contact') return repCard(await loadRoutes(data));
    if (!items.length) { session.quote = null; const c = infoCard(TEMPLATES.empty.title, [TEMPLATES.empty.text]); c.cartLinks = true; c.buttons = [CART_CMD]; return c; }
    if (q && q.state && sub.cmd !== 'new' && sub.cmd !== 'restart') { q.active = true; return stepCard({ kind: 'ask', ...stepView(q.state) }, project, { resume: true }); }
    session.quote = { active: true, state: newIntake(now) };
    return stepCard({ kind: 'ask', ...stepView(session.quote.state) }, project, { first: true });
  }
  if (!q || !q.active) return null;
  if (/^\//.test(String(text).trim())) return null; // another command: the intake stays open, the answer gets a way back (flow.js)
  if (!items.length) { session.quote = null; const c = infoCard(TEMPLATES.empty.title, [TEMPLATES.empty.text]); c.cartLinks = true; return c; }
  const r = intakeStep(q.state, text, { now });
  q.state = r.state; const v = r.view;
  if (v.kind === 'paused') { q.active = false; return null; }
  if (v.kind === 'cancelled') { session.quote = null; return infoCard('Quote request stopped', [TEMPLATES.cancelled]); }
  if (v.kind === 'declined') { q.active = false; return infoCard('No quote prepared', [TEMPLATES.consentNo], [{ label: 'Start again', command: '/quote new' }]); }
  if (v.kind === 'done') return finish(ctx, project, now);
  return stepCard(v, project);
}

async function finish(ctx, project, now) {
  const { data, memory, session } = ctx; const a = session.quote.state.answers;
  const jp = await buildJobPack(project, async (id) => { const rec = await data.product(id); return (rec && rec.docs) || []; }, { nameOf: nameOfItem });
  const docs = jp.docs.map((d) => ({ product: d.product, kind: d.kind, title: d.title, url: d.url }));
  const prior = memory.quotes(); const sup = prior.find((x) => isStale(x, project.items));
  const calcs = typeof memory.calculations === 'function' ? memory.calculations().slice(0, 10) : []; // the calculator's stored results (projectStore.calculations()), newest first
  const rec = buildRecord({ project, answers: { ...a, name: a.name, email: a.email, phone: a.phone, best: a.best, notes: a.notes }, now, taken: prior.map((x) => x.ref), docs, calcs, supersedes: sup ? sup.ref : '' });
  if (!rec) return infoCard('Could not prepare the request', ['Something in the answers was not readable, so nothing was prepared. Nothing was sent.']);
  const res = memory.addQuote(rec);
  if (!res.ok) return infoCard('Could not prepare the request', [res.error]);
  if (typeof memory.markCalculationUsed === 'function') for (const k of calcs) memory.markCalculationUsed(k.id, { type: 'quote', ref: rec.ref });
  session.quote = null;
  const saved = memory.getQuote(rec.ref) || rec;
  const c = doneCard(saved, await loadRoutes(data), memory.currentProject());
  c.sensitive = true;
  return c;
}
