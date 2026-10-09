// TITANOS pricing + negotiation engine. Pure, deterministic, dependency-free (runs in the Worker, the browser and Node).
// No LLM ever decides a price: every figure below is integer cents from fixed rules. The Worker recomputes the quote
// from the raw selection on every checkout, so a tampered client cannot buy below the floor.
//
// Rules (Kyle 2026-10-09 items 3 and 25: listed prices stay; add-ons and concessions are Demonblade's call):
//  - Listed price = the catalog price, shown first, always available.
//  - Extra units (sites / entities / targets) cost 60% of the listed price each; per-seat offers charge full price per seat.
//  - Add-ons: priority delivery (+20% one-off, +15% monthly), a walkthrough call (flat AU$150, one time, never discounted).
//  - Concessions are give-gets only: 6 or 12 month term (5% / 10%), paying the whole term up front (5%), and letting us
//    write the result up as a case study that the customer approves word for word (5%). Max concession is the FLOOR.
//  - A counter-offer never raises a price: it gets "deal" when the ticked give-gets already reach it, otherwise the engine
//    names the give-gets that would, or says the floor if the number is below it. Free, quote-only and not-yet-built (status != READY) offers never reach checkout.
import catalog from "./catalog.json" with { type: "json" };

export const CATALOG = catalog;
export const MAX_QTY = 10;
export const EXTRA_UNIT_PCT = 60;
export const CALL_CENTS = 15000;
export const PRIORITY_PCT = { oneoff: 20, recurring: 15 };
export const TERM_PCT = { 3: 0, 6: 5, 12: 10 };
export const PREPAY_PCT = 5;
export const CASE_STUDY_PCT = 5;
export const MAX_NEEDS_LEN = 400;

const aud = (cents) => Math.round(cents / 100) * 100;
const pct = (cents, p) => aud((cents * p) / 100);
const int = (v, lo, hi, d) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export function getOffer(slug) {
  return CATALOG.find((o) => o.slug === slug) || null;
}

/** Why an offer cannot go to online checkout, or null when it can. */
export function ineligible(o) {
  if (!o) return "unknown_offer";
  if (o.status !== "READY") return "not_yet_available";
  if (o.cadence === "quote") return "quote_only";
  if (!(o.priceAud > 0)) return "free_offer";
  return null;
}

export const isRecurring = (o) => o.cadence === "month" || o.cadence === "per-seat-month";

/** Clean any raw selection into the one shape the maths accepts. */
export function normaliseSelection(o, raw = {}) {
  const rec = isRecurring(o);
  const termMonths = rec ? ([3, 6, 12].includes(Number(raw.termMonths)) ? Number(raw.termMonths) : 3) : 0;
  return {
    qty: int(raw.qty, 1, MAX_QTY, 1),
    priority: raw.priority === true,
    call: raw.call === true,
    termMonths,
    prepay: rec && termMonths >= 6 && raw.prepay === true,
    caseStudy: raw.caseStudy === true,
    counterAud: Number.isFinite(Number(raw.counterAud)) && Number(raw.counterAud) > 0 ? Math.round(Number(raw.counterAud)) : 0,
    needs: String(raw.needs ?? "").slice(0, MAX_NEEDS_LEN),
  };
}

/** Deterministic keyword reading of free text. Returns suggestions to pre-fill; never sets a price on its own. */
export function readNeeds(text) {
  const t = String(text || "").toLowerCase().slice(0, MAX_NEEDS_LEN);
  const out = { applied: {}, notes: [], recognised: false };
  const m = t.match(/\b(\d{1,2})\s*(sites?|locations?|branches|entities|domains?|targets?|seats?|staff|users?|companies|clients?)\b/);
  if (m) { out.applied.qty = Math.min(MAX_QTY, Math.max(1, Number(m[1]))); out.notes.push(`${out.applied.qty} units`); }
  if (/\b(urgent|asap|rush|this week|fast|quick(ly)?|priority)\b/.test(t)) { out.applied.priority = true; out.notes.push("priority delivery"); }
  if (/\b(call|walk (me )?through|talk me through|explain|meeting)\b/.test(t)) { out.applied.call = true; out.notes.push("walkthrough call"); }
  if (/\b(case study|testimonial|reference|write ?up)\b/.test(t)) { out.applied.caseStudy = true; out.notes.push("case study permission"); }
  if (/\b(12|twelve) ?(months?|mths?)\b|\bannual(ly)?\b|\ba year\b/.test(t)) { out.applied.termMonths = 12; out.notes.push("12 month term"); }
  else if (/\b(6|six) ?(months?|mths?)\b|\bhalf[- ]year\b/.test(t)) { out.applied.termMonths = 6; out.notes.push("6 month term"); }
  if (/\b(up ?front|pay in full|pay it all|prepay|pay annually)\b/.test(t)) { out.applied.prepay = true; out.notes.push("pay the term up front"); }
  const c = t.match(/(?:\$|aud ?|au\$ ?|budget( of| is)? ?|can (do|pay|afford) ?|pay ?)(\d[\d,]{1,6})\b/);
  if (c) { out.applied.counterAud = Number(c[c.length - 1].replace(/,/g, "")); out.notes.push(`counter AU$${out.applied.counterAud}`); }
  out.recognised = out.notes.length > 0;
  return out;
}

function discountsFor(o, sel) {
  const rec = isRecurring(o);
  return {
    term: rec ? TERM_PCT[sel.termMonths] || 0 : 0,
    prepay: rec && sel.prepay ? PREPAY_PCT : 0,
    caseStudy: sel.caseStudy ? CASE_STUDY_PCT : 0,
  };
}
const sumPct = (d) => d.term + d.prepay + d.caseStudy;

/** The maximum concession available for this offer (the floor is listed price less this). */
export function maxConcessionPct(o) {
  return (isRecurring(o) ? TERM_PCT[12] + PREPAY_PCT : 0) + CASE_STUDY_PCT;
}

/** Quote in integer cents. Pure. counterAud (whole AU$) is the customer's counter-offer for the discountable part. */
export function quote(slug, rawSel = {}) {
  const o = getOffer(slug);
  const blocked = ineligible(o);
  if (blocked) return { ok: false, error: blocked, slug };
  const sel = normaliseSelection(o, rawSel);
  const rec = isRecurring(o);
  const perSeat = o.cadence === "per-seat-month";
  const unit = o.priceAud * 100;
  const extraUnit = perSeat ? unit : pct(unit, EXTRA_UNIT_PCT);
  const lines = [{ key: "base", label: o.name, cents: unit }];
  if (sel.qty > 1) lines.push({ key: "units", label: `${sel.qty - 1} extra ${perSeat ? "seat" : "unit"}${sel.qty > 2 ? "s" : ""}`, cents: extraUnit * (sel.qty - 1) });
  const core = lines.reduce((s, l) => s + l.cents, 0);
  if (sel.priority) lines.push({ key: "priority", label: rec ? "Priority support and turnaround" : "Priority delivery", cents: pct(core, rec ? PRIORITY_PCT.recurring : PRIORITY_PCT.oneoff) });
  const main = lines.reduce((s, l) => s + l.cents, 0); // the discountable part
  const extras = sel.call ? CALL_CENTS : 0; // one time, flat, never discounted
  const listed = main + extras;

  const maxPct = maxConcessionPct(o);
  const floorMain = main - pct(main, maxPct); // lowest headline price (per month for recurring, whole price for one-off)
  const chosen = discountsFor(o, sel);
  const afterGives = main - pct(main, sumPct(chosen)); // headline price with the ticked concessions

  // The price is always the ticked concessions' price; a counter never raises it. A counter only decides whether we say
  // "deal" (the ticked concessions already reach the customer's number) or tell them which give-gets reach it.
  let headline = afterGives;
  let status = "listed";
  let message = "";
  const want = sel.counterAud * 100;
  if (want > 0 && want < main && afterGives <= want) {
    status = "accepted";
    message = afterGives === want ? "Deal. That is your number." : `Deal. Your number is ${fmt(want)}, and with what you ticked the price is ${fmt(afterGives)}.`;
  } else if (want > 0 && want < afterGives) {
    status = "countered";
    const unit = rec ? " a month" : "";
    if (want < floorMain) {
      message = `${fmt(floorMain)}${unit} is the lowest we can go for this scope. Trim the scope to get nearer ${fmt(want)}.`;
    } else {
      const steps = [];
      const trial = { ...sel };
      const price = () => main - pct(main, sumPct(discountsFor(o, trial)));
      if (rec && trial.termMonths !== 12 && price() > want) { trial.termMonths = 12; steps.push("a 12 month term"); }
      if (rec && !trial.prepay && price() > want) { trial.prepay = true; steps.push("paying the term up front"); }
      if (!trial.caseStudy && price() > want) { trial.caseStudy = true; steps.push("the case study permission"); }
      message = `We can reach ${fmt(want)}${unit} when you take ${steps.join(" and ")}.`;
    }
  } else if (want >= main && want > 0) {
    message = "Your number is at or above the price, so you pay the price.";
  } else if (sumPct(chosen) > 0) {
    message = `Concessions applied: ${sumPct(chosen)}% off.`;
  }
  headline = Math.max(headline, floorMain); // hard guard: nothing below the floor, ever
  const prepaid = rec && sel.prepay;
  const payNow = prepaid ? headline * sel.termMonths + extras : headline + extras; // first charge at Stripe
  const lifetimeList = (rec ? main * (prepaid ? sel.termMonths : 1) : main) + extras;
  return {
    ok: true,
    slug,
    name: o.name,
    cadence: o.cadence,
    mode: rec && !prepaid ? "subscription" : "payment",
    interval: rec ? "month" : null,
    selection: sel,
    lines,
    extras: extras ? [{ key: "call", label: "Walkthrough call (one time)", cents: extras }] : [],
    listedHeadlineCents: main,
    floorHeadlineCents: floorMain,
    headlineCents: headline, // per month for recurring, whole price for one-off
    oneTimeCents: extras,
    termMonths: sel.termMonths,
    payNowCents: payNow, // what the card is charged today
    savingCents: lifetimeList - payNow,
    status,
    message,
    needs: sel.needs,
    needsReadout: readNeeds(sel.needs),
  };
}

function fmt(cents) { return `AU$${(cents / 100).toLocaleString("en-AU")}`; }
export { fmt as formatCents };
