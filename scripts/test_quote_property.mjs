// F87 C5 property suite for lib/shop/quote.ts (Auto Builder quotes). Fixed seed, 2,000 SYNTHETIC quote requests against a
// SYNTHETIC shelf set that is graded by the REAL grader. Zero model calls, zero network. Prints a pass count per invariant.
// F207: quote.ts now has quoteScoped (scope, minimum, cap, validity window, assumptions); invariants S1-S11 below cover them.
import { quoteAsk, quoteScoped, acceptQuote, isExpired, addDays, DEFAULT_POLICY, MAX_UNITS } from "../lib/shop/quote.ts";
import { tokens } from "../lib/shop/quote.ts";
import { gradeAll } from "../lib/shop/grader.ts";
import { JOBS, SECTORS, COUNTRIES } from "../lib/shop/generator.ts";

const SEED = 0x87c5; const N = 2000;
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(SEED);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (n) => Math.floor(rnd() * n);

const WORDS = ["dmarc", "email", "privacy", "policy", "checklist", "guide", "template", "monitor", "domain", "report", "audit", "invoice", "quote", "follow", "review", "reply", "staff", "onboarding", "supplier", "risk", "tender", "bid", "pack", "plumbing", "dental", "legal", "retail", "weekly", "monthly", "security", "breach", "runbook", "register", "vendor", "essential", "compliance", "owner", "tradie", "playbook", "proof"];
const vocab = { jobs: JOBS, sectors: SECTORS, countries: COUNTRIES };

// 60 synthetic shelves, labelled synthetic in id/source. Shape is valid; the real grader decides pass/fail.
function mk(i, flavour) {
  const w = [pick(WORDS), pick(WORDS), pick(WORDS)];
  const base = {
    id: `product:syn-${i}`, kind: "product", slug: `syn-${i}`, name: `Synthetic ${w[0]} ${w[1]} ${i}`,
    bluf: `Synthetic shelf ${i} about ${w.join(" ")} so the property run has something to match.`,
    bullets: ["one synthetic bullet"], faq: [{ q: "Is this synthetic?", a: "Yes, test data only." }],
    priceAud: 10 + int(500), cadence: "one-off", priceLabel: "PUBLISHED", status: "READY", availability: "BUYABLE",
    buyUrl: `https://buy.stripe.com/synthetic${i}`, href: `/shop/syn-${i}`, source: "scripts/test_quote_property.mjs SYNTHETIC",
    synthetic: false, tags: [...w, `zq${i}`],
  };
  if (flavour === "quote") return { ...base, priceAud: null, cadence: "quote", priceLabel: "QUOTE", availability: "QUOTE", buyUrl: null };
  if (flavour === "free") return { ...base, priceAud: null, cadence: "none", priceLabel: "UNKNOWN", availability: "FREE_STEP", buyUrl: null };
  if (flavour === "cents") return { ...base, priceAud: 10 + int(500) + int(100) / 100 };
  if (flavour === "bad-soon") return { ...base, availability: "SOON" };
  if (flavour === "bad-synth") return { ...base, synthetic: true };
  if (flavour === "bad-dash") return { ...base, bluf: base.bluf + " — extra" };
  if (flavour === "bad-proposed") return { ...base, priceLabel: "PROPOSED" };
  return base;
}
const FLAV = ["buy", "buy", "buy", "quote", "free", "cents", "bad-soon", "bad-synth", "bad-dash", "bad-proposed"];
const shelves = gradeAll(Array.from({ length: 60 }, (_, i) => mk(i, FLAV[i % FLAV.length])));
const graded = shelves.filter((s) => s.grade.pass), ungraded = shelves.filter((s) => !s.grade.pass);
const byId = new Map(shelves.map((s) => [s.id, s]));

const counts = {}; const fails = [];
const inv = (name, ok, ctx) => { counts[name] ??= { pass: 0, fail: 0 }; if (ok) counts[name].pass++; else { counts[name].fail++; if (fails.length < 12) fails.push(`${name} :: ${JSON.stringify(ctx)}`); } };

const NOISE = ["zzz", "banana", "please", "the", "xylophone", "need", "urgent"];
function genAsk() {
  const kind = int(6);
  const parts = [];
  if (kind === 0) for (let k = 0; k < 1 + int(6); k++) parts.push(pick(WORDS));                         // pure vocab
  else if (kind === 1) { const s = pick(graded); parts.push(...s.tags.slice(0, 2 + int(3))); }           // aimed at a graded shelf
  else if (kind === 2) { const s = pick(ungraded); parts.push(...s.tags.slice(0, 2 + int(3))); }         // aimed at an UNGRADED shelf
  else if (kind === 3) for (let k = 0; k < int(5); k++) parts.push(pick(NOISE));                         // noise or empty
  else if (kind === 4) { parts.push(pick(JOBS), pick(SECTORS), pick(COUNTRIES)); }                       // slot-shaped
  else { const s = pick(shelves); parts.push(s.name.toUpperCase(), pick(NOISE), "  ", pick(WORDS) + "!!"); } // case + punctuation
  let t = parts.join(pick([" ", "  ", ", ", "\n"]));
  return t;
}
const cents = (p) => Number.isFinite(p) && p >= 0 && Number.isInteger(Math.round(p * 100)) && Math.abs(p * 100 - Math.round(p * 100)) < 1e-6;
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = int(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };

let matchedN = 0, unmatchedN = 0, ungradedAimed = 0;
for (let n = 0; n < N; n++) {
  const ask = genAsk();
  const q = quoteAsk(ask, shelves, vocab, "2026-11-07");
  const q2 = quoteAsk(ask, shelves, vocab, "2026-11-07");
  inv("I1 deterministic (byte-identical JSON for same input)", JSON.stringify(q) === JSON.stringify(q2), { ask });
  inv("I1b order-independent (shuffled shelf list gives the same quote)", JSON.stringify(quoteAsk(ask, shuffle(shelves), vocab, "2026-11-07")) === JSON.stringify(q), { ask });
  const nums = [q.priceAud, q.generatorStub?.priceAud].filter((x) => x !== null && x !== undefined);
  inv("I2 price null or finite, >=0, whole cents (no NaN/Infinity/negative/float cents)", nums.every(cents), { ask, nums });
  const sh = q.shelfId ? byId.get(q.shelfId) : null;
  if (q.matched) {
    matchedN++;
    inv("I3 matched quote names a shelf that is in the input", !!sh, { ask, id: q.shelfId });
    inv("I4 matched quote only ever names a GRADED (grade.pass) shelf", !!sh && sh.grade.pass === true, { ask, id: q.shelfId });
    if (q.priceAud !== null) inv("I5 a priced quote is labelled PUBLISHED and equals the shelf's PUBLISHED price row (no invented price)", q.priceLabel === "PUBLISHED" && sh.priceLabel === "PUBLISHED" && q.priceAud === sh.priceAud && sh.cadence !== "quote" && sh.cadence !== "none", { ask, q: q.priceAud, shelf: sh && [sh.priceAud, sh.priceLabel] });
    else inv("I5b an unpriced match says QUOTE, never a number", q.priceLabel === "QUOTE" && q.priceAud === null, { ask });
    const askT = new Set(tokens(ask)), hay = new Set(tokens(`${sh.name} ${sh.slug} ${sh.tags.join(" ")} ${sh.bluf}`));
    const hits = [...askT].filter((t) => hay.has(t)).length;
    inv("I11 a match needs >=1 token hit for a 1-token ask and >=2 for a longer ask (no junk matches)", hits >= (askT.size <= 1 ? 1 : 2), { ask, hits });
    inv("I6 matched quote has no generator stub and no missing slots", q.generatorStub === null && q.missing.length === 0, { ask });
  } else {
    unmatchedN++;
    inv("I7 unmatched ask returns NO shelf and NO price, label QUOTE", q.shelfId === null && q.priceAud === null && q.priceLabel === "QUOTE", { ask });
    inv("I8 unmatched ask emits a stub whose price is null (nothing invented)", !!q.generatorStub && q.generatorStub.priceAud === null, { ask });
  }
  // Ungraded shelves return no quote: an ask built ONLY from an ungraded shelf's unique token never resolves to it.
  const u = pick(ungraded);
  const uq = quoteAsk(`${u.tags[0]} ${u.tags[1]} zq${u.id.split("-")[1]}`, shelves, vocab, "2026-11-07");
  ungradedAimed++;
  inv("I9 ask aimed at an ungraded shelf never returns that shelf or its price", uq.shelfId !== u.id && (uq.shelfId === null || byId.get(uq.shelfId).grade.pass), { u: u.id, got: uq.shelfId });
  // Ungraded-only universe returns no quote at all.
  inv("I9b ungraded-only shelf set returns no quote", quoteAsk(ask, ungraded, vocab).matched === false, { ask });
  // Sanity of the generator: stub id is stable and carries the supplied clock.
  if (!q.matched) inv("I10 stub id is derived from the ask and the supplied date only", q.generatorStub.id.endsWith("-2026-11-07"), { id: q.generatorStub.id });
}
// Coverage guard: the run must actually exercise matches, misses and ungraded-aimed asks.
inv("C1 run exercised matched quotes", matchedN >= 200, { matchedN });
inv("C2 run exercised unmatched asks", unmatchedN >= 200, { unmatchedN });
inv("C3 run exercised ungraded-aimed asks", ungradedAimed === N, { ungradedAimed });
inv("C4 shelf set has priced, quote, free, cents and ungraded shelves", graded.some((s) => s.cadence === "quote") && graded.some((s) => s.priceAud > 0) && graded.some((s) => s.cadence === "none") && graded.some((s) => s.priceAud % 1 !== 0) && ungraded.length >= 20, { g: graded.length, u: ungraded.length });

// D1 REGRESSION (real defect found by this suite): a shelf whose price label is PROPOSED must never be quoted as PUBLISHED,
// even when its grade flag says pass (forged or stale flag). Before the fix quoteAsk relabelled any priced shelf PUBLISHED.
{
  const forged = { ...mk(900, "buy"), name: "Forged proposed zork", tags: ["zork", "proposed"], bluf: "Synthetic forged shelf for the proposed price regression test.", priceLabel: "PROPOSED", grade: { pass: true, checks: [] } };
  const q = quoteAsk("zork proposed", [forged], vocab);
  inv("D1 PROPOSED price is never quoted as PUBLISHED", q.priceLabel !== "PUBLISHED" && q.priceAud === null, q);
  const ok = { ...forged, priceLabel: "PUBLISHED", id: "product:syn-901" };
  inv("D1b a PUBLISHED price still quotes", quoteAsk("zork proposed", [ok], vocab).priceAud === ok.priceAud, {});
}
// D2 REGRESSION: a forged-pass shelf with a malformed price (NaN, Infinity, negative, sub-cent, string) never yields a priced quote.
for (const [label, v] of Object.entries({ NaN, Infinity, negative: -5, subcent: 49.001, string: "49" })) {
  const f = { ...mk(902, "buy"), tags: ["zork", "bad"], name: "Forged bad price zork", bluf: "Synthetic forged shelf for the malformed price regression test.", priceAud: v, grade: { pass: true, checks: [] } };
  const q = quoteAsk("zork bad", [f], vocab);
  inv("D2 forged malformed price (NaN/Infinity/negative/sub-cent/string) is never quoted", q.priceAud === null && q.priceLabel !== "PUBLISHED", { label, q });
}
// Absent features (spec items with no code): pinned so a future quote.ts that adds them has to add the property too.
{
  const q = quoteAsk("synthetic", shelves, vocab);
  const keys = Object.keys(q).sort().join(",");
  inv("A1 plain quoteAsk Quote key set is unchanged (scoped fields live only on quoteScoped)", keys === "cadence,generatorStub,line,matched,missing,priceAud,priceLabel,shelfId", { keys });
}

// ---- F207 scoped invariants (S1-S11), every one of the 2,000 asks gets a random scope, a random date and random assumptions.
const ISO = (n) => addDays("2026-01-01", n);
const P = DEFAULT_POLICY;
let sOk = 0, sBelow = 0, sAbove = 0, sNoMatch = 0, sUnpriced = 0, sMono = 0, sBoundary = 0;
const askAt = (s) => `${s.tags[0]} ${s.tags[1]} ${s.tags[2]} zq${s.id.split("-")[1]}`;
const pricedGraded = graded.filter((s) => s.cadence !== "quote" && s.cadence !== "none" && s.priceLabel === "PUBLISHED");
const quotedGraded = graded.filter((s) => s.cadence === "quote");
const scopeOf = () => ({ units: 1 + int(40), extras: int(6) });
const assumeOf = () => Array.from({ length: 1 + int(3) }, (_, k) => `Assumption ${k} ${pick(WORDS)}.`);
for (let n = 0; n < N; n++) {
  const aim = int(8);
  const ask = aim < 5 ? askAt(pick(pricedGraded)) : aim === 5 ? askAt(pick(quotedGraded)) : genAsk();
  const now = ISO(int(1500)), scope = scopeOf(), as = assumeOf();
  const q = quoteScoped(ask, scope, as, shelves, vocab, now);
  const q2 = quoteScoped(ask, scope, as, shelves, vocab, now);
  inv("S1 deterministic: same ask, scope, date and assumptions give byte-identical JSON", JSON.stringify(q) === JSON.stringify(q2), { ask });
  if (q.ok) {
    sOk++;
    const sh = byId.get(q.shelfId);
    inv("S2 a scoped price is finite, whole cents, and within [min, cap]", cents(q.priceAud) && q.priceAud >= P.minAud && q.priceAud <= P.capAud, { ask, p: q.priceAud });
    inv("S3 a scoped quote names a graded, PUBLISHED-priced shelf and never prices below that shelf's own price", !!sh && sh.grade.pass && sh.priceLabel === "PUBLISHED" && q.priceAud >= sh.priceAud, { ask, id: q.shelfId });
    inv("S4 validity window is explicit: validFrom is the supplied date, validUntil is exactly validDays later", q.validFrom === now && q.validUntil === addDays(now, P.validDays) && q.validUntil > q.validFrom, { q });
    inv("S5 the quote is usable on validFrom and on validUntil, and expires the day after", acceptQuote(q, q.validFrom).ok && acceptQuote(q, q.validUntil).ok && acceptQuote(q, addDays(q.validUntil, 1)).reason === "EXPIRED" && isExpired(q, addDays(q.validUntil, 1)) && !isExpired(q, q.validUntil), { q });
    inv("S6 assumptions are echoed: every supplied assumption appears in order at the front, list is non-empty", q.assumptions.length > 0 && as.every((a, i) => q.assumptions[i] === a), { as, got: q.assumptions });
    inv("S6b the quote states its own scope and window in the assumptions", q.assumptions.some((a) => a.includes(`${scope.units} units`)) && q.assumptions.some((a) => a.includes(q.validUntil)), { q });
    // S7 monotone: growing units or extras never lowers the price (or turns an accepted quote into a below-minimum one).
    const bigger = { units: Math.min(MAX_UNITS, scope.units + int(4)), extras: scope.extras + int(3) };
    const qb = quoteScoped(ask, bigger, as, shelves, vocab, now);
    sMono++;
    inv("S7 monotone scope: a scope that is larger in units and extras never prices lower", qb.ok ? qb.priceAud >= q.priceAud : qb.reason === "ABOVE_CAP", { scope, bigger, a: q.priceAud, b: qb.ok ? qb.priceAud : qb.reason });
  } else {
    if (q.reason === "BELOW_MINIMUM") sBelow++; else if (q.reason === "ABOVE_CAP") sAbove++; else if (q.reason === "NO_MATCH") sNoMatch++; else if (q.reason === "UNPRICED") sUnpriced++;
    inv("S8 a refusal carries a typed reason and a plain sentence, and no price", typeof q.reason === "string" && q.detail.length > 10 && !("priceAud" in q), { q });
  }
}
// S9/S10 min and cap are refused, never clamped: probe with a policy built around a known shelf price.
for (let n = 0; n < 300; n++) {
  const sh = pick(pricedGraded), ask = askAt(sh), now = ISO(int(1500)), as = assumeOf();
  const one = quoteScoped(ask, { units: 1, extras: 0 }, as, shelves, vocab, now);
  if (!one.ok) continue;
  const p = one.priceAud;
  const exact = { ...P, minAud: p, capAud: p };
  inv("S9a a price exactly at the minimum and the cap is accepted (inclusive bounds)", quoteScoped(ask, { units: 1, extras: 0 }, as, shelves, vocab, now, exact).ok, { p });
  const above = quoteScoped(ask, { units: 1, extras: 0 }, as, shelves, vocab, now, { ...P, minAud: p + 0.01, capAud: p + 100 });
  inv("S9 below the minimum is refused BELOW_MINIMUM, never raised to the minimum", !above.ok && above.reason === "BELOW_MINIMUM" && !("priceAud" in above), { p, above });
  const over = quoteScoped(ask, { units: 1, extras: 0 }, as, shelves, vocab, now, { ...P, minAud: 0, capAud: p - 0.01 });
  inv("S10 above the cap is refused ABOVE_CAP, never cut to the cap", !over.ok && over.reason === "ABOVE_CAP" && !("priceAud" in over), { p, over });
  sBoundary++;
}
// S11 mandatory inputs: no assumptions, a blank assumption, a bad scope or a bad date is refused with its own reason.
for (let n = 0; n < 300; n++) {
  const ask = askAt(pick(pricedGraded)), now = ISO(int(1500));
  const bad = (as) => quoteScoped(ask, { units: 1, extras: 0 }, as, shelves, vocab, now);
  inv("S11a no assumptions is refused MISSING_ASSUMPTIONS", bad([]).reason === "MISSING_ASSUMPTIONS" && bad(undefined).reason === "MISSING_ASSUMPTIONS", {});
  inv("S11b a blank or non-string assumption is refused MISSING_ASSUMPTIONS", bad(["ok", "  "]).reason === "MISSING_ASSUMPTIONS" && bad([42]).reason === "MISSING_ASSUMPTIONS", {});
  const sc = pick([{ units: 0, extras: 0 }, { units: -1, extras: 0 }, { units: 1.5, extras: 0 }, { units: 1, extras: -1 }, { units: NaN, extras: 0 }, { units: MAX_UNITS + 1, extras: 0 }, { units: "2", extras: 0 }, null]);
  inv("S11c an invalid scope (zero, negative, fractional, NaN, huge, string, null) is refused INVALID_SCOPE", quoteScoped(ask, sc, ["a"], shelves, vocab, now).reason === "INVALID_SCOPE", { sc });
  const d = pick(["", "2026-13-01", "2026-02-30", "11/07/2026", "tomorrow", undefined]);
  inv("S11d an invalid quote date is refused INVALID_DATE", quoteScoped(ask, { units: 1, extras: 0 }, ["a"], shelves, vocab, d).reason === "INVALID_DATE", { d });
}
inv("S12 acceptQuote on a refusal is NOT_A_QUOTE", acceptQuote({ ok: false, reason: "NO_MATCH", detail: "x" }, "2026-01-01").reason === "NOT_A_QUOTE", {});
// Client-facing strings: no em or en dashes in any refusal detail or quote line.
{
  const lines = [];
  for (const sc of [{ units: 0, extras: 0 }, { units: 1, extras: 0 }]) for (const as of [[], ["a"]]) for (const d of ["bad", "2026-01-01"]) for (const pol of [P, { ...P, minAud: 1e6 }, { ...P, minAud: 0, capAud: 0 }]) {
    const r = quoteScoped(askAt(pricedGraded[0]), sc, as, shelves, vocab, d, pol); lines.push(r.ok ? r.line + r.assumptions.join(" ") : r.detail);
  }
  lines.push(quoteScoped("zzz", { units: 1, extras: 0 }, ["a"], shelves, vocab, "2026-01-01").detail, quoteScoped(askAt(quotedGraded[0]), { units: 1, extras: 0 }, ["a"], shelves, vocab, "2026-01-01").detail);
  inv("S13 client-facing quote strings carry no em or en dash", lines.every((l) => !/[\u2013\u2014]/.test(l)), { lines: lines.filter((l) => /[\u2013\u2014]/.test(l)) });
}
inv("C5 scoped run exercised accepted quotes", sOk >= 400, { sOk });
inv("C6 scoped run exercised ABOVE_CAP, NO_MATCH and UNPRICED naturally (BELOW_MINIMUM is probed by S9)", sAbove >= 5 && sNoMatch >= 5 && sUnpriced >= 5, { sBelow, sAbove, sNoMatch, sUnpriced });
inv("C7 monotone and boundary probes ran", sMono >= 400 && sBoundary >= 100, { sMono, sBoundary });
console.log(`scoped: ok ${sOk}, below-min ${sBelow}, above-cap ${sAbove}, no-match ${sNoMatch}, unpriced ${sUnpriced}`);

let bad = 0;
for (const [k, v] of Object.entries(counts)) { console.log(`${v.fail ? "FAIL" : "ok  "} ${k}: ${v.pass}/${v.pass + v.fail}`); bad += v.fail; }
console.log(`shelves ${shelves.length} (graded ${graded.length}, ungraded ${ungraded.length}); requests ${N}; matched ${matchedN}; unmatched ${unmatchedN}; seed 0x${SEED.toString(16)}`);
for (const f of fails) console.log("  " + f);
if (bad) { console.log(`QUOTE PROPERTY FAILED ${bad}`); process.exit(1); }
console.log("QUOTE PROPERTY OK");
