// test_checkout_engine.mjs - the deterministic pricing + negotiation engine, catalog drift and onboarding.
// Run: node --no-warnings scripts/test_checkout_engine.mjs   (part of npm test)
import { quote, readNeeds, ineligible, getOffer, CATALOG, maxConcessionPct, MAX_QTY, CALL_CENTS } from "../lib/checkout/engine.mjs";
import { onboardingFor } from "../lib/checkout/onboarding.mjs";
import { buildCatalog } from "./gen_checkout_catalog.mjs";
import { isDeepStrictEqual } from "node:util";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error("FAIL:", m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${a}, want ${b})`);

const ONE = CATALOG.find((o) => o.status === "READY" && o.cadence === "one-off" && o.priceAud > 0);
const MON = CATALOG.find((o) => o.status === "READY" && o.cadence === "month" && o.priceAud > 0);
const SEAT = CATALOG.find((o) => o.cadence === "per-seat-month");
ok(ONE && MON, "catalog has a ready one-off and a ready monthly offer");

// catalog drift: committed catalog.json must equal what the offer data produces now
ok(isDeepStrictEqual(await buildCatalog(), CATALOG), "lib/checkout/catalog.json is current (run scripts/gen_checkout_catalog.mjs)");

// eligibility
for (const o of CATALOG) {
  const e = ineligible(o);
  if (o.status !== "READY") eq(e, "not_yet_available", `${o.slug} not READY -> blocked`);
  else if (o.cadence === "quote") eq(e, "quote_only", `${o.slug} quote -> blocked`);
  else if (!(o.priceAud > 0)) eq(e, "free_offer", `${o.slug} free -> blocked`);
  else eq(e, null, `${o.slug} sellable`);
}
eq(quote("no-such-offer").error, "unknown_offer", "unknown slug");
const notReady = CATALOG.find((o) => o.status !== "READY");
if (notReady) eq(quote(notReady.slug).ok, false, "non-READY offer cannot be quoted");

// listed price is the catalog price
let q = quote(ONE.slug);
eq(q.headlineCents, ONE.priceAud * 100, "one-off listed headline = catalog price");
eq(q.payNowCents, ONE.priceAud * 100, "one-off pay now = catalog price");
eq(q.mode, "payment", "one-off is a payment");
eq(q.status, "listed", "no counter -> listed");
q = quote(MON.slug);
eq(q.mode, "subscription", "monthly is a subscription");
eq(q.headlineCents, MON.priceAud * 100, "monthly listed headline");
eq(q.termMonths, 3, "monthly default term is the 3 month minimum");

// scope: extra units at 60%, clamped quantity
q = quote(ONE.slug, { qty: 3 });
eq(q.headlineCents, ONE.priceAud * 100 + 2 * Math.round(ONE.priceAud * 0.6) * 100, "3 units = base + 2 x 60%");
eq(quote(ONE.slug, { qty: 999 }).selection.qty, MAX_QTY, "qty clamps to the max");
eq(quote(ONE.slug, { qty: -4 }).selection.qty, 1, "negative qty clamps to 1");
eq(quote(ONE.slug, { qty: "abc" }).selection.qty, 1, "junk qty -> 1");
if (SEAT && SEAT.status === "READY") eq(quote(SEAT.slug, { qty: 4 }).headlineCents, SEAT.priceAud * 100 * 4, "per-seat offers charge full price per seat");

// add-ons
q = quote(ONE.slug, { priority: true });
eq(q.headlineCents, Math.round(ONE.priceAud * 1.2) * 100, "one-off priority +20%");
q = quote(ONE.slug, { call: true });
eq(q.headlineCents, ONE.priceAud * 100, "call does not change the headline");
eq(q.payNowCents, ONE.priceAud * 100 + CALL_CENTS, "call adds AU$150 flat");
q = quote(MON.slug, { call: true });
eq(q.mode, "subscription", "monthly + call stays a subscription");
eq(q.oneTimeCents, CALL_CENTS, "call rides as a one-time line on a subscription");

// concessions: give-gets only
q = quote(MON.slug, { termMonths: 12 });
eq(q.headlineCents, MON.priceAud * 100 - Math.round(MON.priceAud * 0.10) * 100, "12 month term = 10% off monthly");
q = quote(MON.slug, { termMonths: 6 });
eq(q.headlineCents, MON.priceAud * 100 - Math.round(MON.priceAud * 0.05) * 100, "6 month term = 5% off");
q = quote(MON.slug, { termMonths: 12, prepay: true, caseStudy: true });
eq(q.floorHeadlineCents, q.headlineCents, "all give-gets reach exactly the floor");
eq(q.mode, "payment", "prepaid term is one payment");
eq(q.payNowCents, q.headlineCents * 12, "prepay charges term x monthly today");
eq(quote(MON.slug, { termMonths: 3, prepay: true }).selection.prepay, false, "prepay needs a 6+ month term");
eq(quote(ONE.slug, { termMonths: 12, prepay: true }).selection.termMonths, 0, "one-off has no term");
eq(quote(ONE.slug, { caseStudy: true }).headlineCents, ONE.priceAud * 100 - Math.round(ONE.priceAud * 0.05) * 100, "one-off case study = 5% off");

// negotiation: floors hold
const floorOne = quote(ONE.slug).floorHeadlineCents;
eq(floorOne, ONE.priceAud * 100 - Math.round(ONE.priceAud * 0.05) * 100, "one-off floor = 95%");
q = quote(ONE.slug, { counterAud: 1 });
eq(q.status, "countered", "absurd counter is countered");
ok(q.headlineCents >= floorOne, "absurd counter never prices below the floor");
q = quote(ONE.slug, { counterAud: Math.ceil(floorOne / 100), caseStudy: true });
eq(q.status, "accepted", "counter at the floor with the give-get ticked is a deal");
ok(q.headlineCents <= Math.ceil(floorOne / 100) * 100, "deal price is at or under the customer's number");
q = quote(ONE.slug, { counterAud: Math.ceil(floorOne / 100) });
eq(q.status, "countered", "counter at the floor without the give-get is countered");
ok(/case study permission/.test(q.message), "countered message names the give-get that reaches the number");
eq(q.headlineCents, ONE.priceAud * 100, "countered price stays at what the ticked options give");
q = quote(ONE.slug, { counterAud: ONE.priceAud + 500 });
eq(q.status, "listed", "counter above the price is not taken");
eq(q.headlineCents, ONE.priceAud * 100, "customer never pays more than the price because they offered more");
q = quote(ONE.slug, { counterAud: 1, caseStudy: true });
ok(/lowest we can go/.test(q.message), "below-floor counter gets the floor message");
// mid counter on a monthly: the engine names only the give-gets needed, then deals once they are ticked
const midAud = Math.ceil((MON.priceAud * 100 * 0.93) / 100);
q = quote(MON.slug, { counterAud: midAud });
eq(q.status, "countered", "monthly mid counter countered with nothing ticked");
ok(/12 month term/.test(q.message) || /6/.test(q.message) || /paying/.test(q.message), "monthly counter names a give-get");
q = quote(MON.slug, { counterAud: midAud, termMonths: 12 });
eq(q.status, "accepted", "monthly mid counter accepted once the 12 month term is ticked");
ok(q.headlineCents <= midAud * 100, "accepted headline at or under the number");
// property sweep: no input combination ever prices under the floor or errors
let swept = 0, under = 0;
for (const o of CATALOG.filter((x) => !ineligible(x)).slice(0, 12)) {
  for (const qty of [1, 2, 10]) for (const t of [3, 6, 12]) for (const prepay of [false, true]) for (const caseStudy of [false, true]) for (const counterAud of [0, 1, Math.round(o.priceAud * 0.7), o.priceAud, o.priceAud * 3]) {
    const r = quote(o.slug, { qty, termMonths: t, prepay, caseStudy, counterAud, priority: qty === 2, call: qty === 10 });
    swept++;
    if (!r.ok || r.headlineCents < r.floorHeadlineCents || r.headlineCents > r.listedHeadlineCents || !Number.isInteger(r.payNowCents) || r.payNowCents < 50) under++;
  }
}
eq(under, 0, `sweep of ${swept} combinations: never under the floor, over the listed price, or non-integer`);
eq(maxConcessionPct(ONE), 5, "one-off max concession 5%");
eq(maxConcessionPct(MON), 20, "monthly max concession 20%");

// tamper: client-supplied totals are ignored (engine only reads the documented fields)
q = quote(ONE.slug, { headlineCents: 1, payNowCents: 1, floorHeadlineCents: 1, totalCents: 1 });
eq(q.payNowCents, ONE.priceAud * 100, "tampered totals are ignored");

// needs text reading (deterministic keywords)
let n = readNeeds("We have 4 sites and need it urgent, can you walk me through it. Budget of $350 please. happy to be a case study");
eq(n.applied.qty, 4, "needs: qty read"); ok(n.applied.priority, "needs: urgent -> priority"); ok(n.applied.call, "needs: walk through -> call");
ok(n.applied.caseStudy, "needs: case study read"); eq(n.applied.counterAud, 350, "needs: budget read");
eq(readNeeds("pay for 12 months up front").applied.termMonths, 12, "needs: 12 months");
ok(readNeeds("pay for 12 months up front").applied.prepay, "needs: up front");
ok(!readNeeds("something totally different").recognised, "needs: gibberish not recognised (flagged for a human)");
eq(readNeeds("x".repeat(5000)).notes.length, 0, "needs: long input is bounded");
eq(quote(ONE.slug, { needs: "y".repeat(5000) }).needs.length, 400, "needs text capped at 400 for Stripe metadata");

// onboarding: every sellable offer has steps, intake and its own three how-it-works steps
for (const o of CATALOG.filter((x) => !ineligible(x))) {
  const ob = onboardingFor(o.slug);
  ok(ob && ob.steps.length === 6, `${o.slug}: six onboarding steps`);
  ok(ob.steps[1].intake.length >= 3, `${o.slug}: has an intake list`);
  ok(o.howItWorks.every((h, i) => ob.steps[2 + i].detail === h), `${o.slug}: carries its own how-it-works steps`);
  ok(!/[–—]/.test(JSON.stringify(ob.steps.slice(0, 2)) + ob.steps[5].detail), `${o.slug}: no em/en dashes in onboarding copy`);
}
eq(onboardingFor("nope"), null, "unknown offer has no onboarding");

console.log(`== test_checkout_engine: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
