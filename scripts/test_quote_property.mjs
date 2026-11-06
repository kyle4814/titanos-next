// F87 C5 property suite for lib/shop/quote.ts (Auto Builder quotes). Fixed seed, 2,000 SYNTHETIC quote requests against a
// SYNTHETIC shelf set that is graded by the REAL grader. Zero model calls, zero network. Prints a pass count per invariant.
// SPEC GAP (receipt FILL_f87): quote.ts has no scope, minimum, cap, validity window or assumptions list, so those spec
// invariants have nothing to test; the "absent" block pins that fact so adding the feature later forces a property suite.
import { quoteAsk, tokens } from "../lib/shop/quote.ts";
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
  inv("A1 Quote carries no scope/min/cap/validity/assumptions field today (pin; see receipt SPEC GAP)", keys === "cadence,generatorStub,line,matched,missing,priceAud,priceLabel,shelfId", { keys });
}

let bad = 0;
for (const [k, v] of Object.entries(counts)) { console.log(`${v.fail ? "FAIL" : "ok  "} ${k}: ${v.pass}/${v.pass + v.fail}`); bad += v.fail; }
console.log(`shelves ${shelves.length} (graded ${graded.length}, ungraded ${ungraded.length}); requests ${N}; matched ${matchedN}; unmatched ${unmatchedN}; seed 0x${SEED.toString(16)}`);
for (const f of fails) console.log("  " + f);
if (bad) { console.log(`QUOTE PROPERTY FAILED ${bad}`); process.exit(1); }
console.log("QUOTE PROPERTY OK");
