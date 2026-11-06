// C5/C6 shelf search tests. ALL DATA SYNTHETIC (derived from one real shelf's shape), never public. Zero model calls, zero network.
import fs from "node:fs";
import { gradeAll, gradeShelf } from "../lib/shop/grader.ts";
import { buildShelfIndex, searchShelves, within1, MAX_QUERY_CHARS } from "../lib/shop/search.ts";

const root = new URL("..", import.meta.url).pathname;
const file = JSON.parse(fs.readFileSync(root + "lib/shop/shelves.json", "utf8"));
const base = file.shelves.find((s) => s.availability === "BUYABLE" && s.priceAud > 0);
let pass = 0, fail = 0;
const t = (name, ok, extra = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + name + " " + extra); } };

// Deterministic PRNG so the set is identical on every run.
let seed = 85; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ADJ = ["quarterly", "monthly", "weekly", "annual", "rapid", "careful", "broad", "narrow", "steady", "portable", "shared", "private", "layered", "simple", "granular"];
const NOUN = ["compliance", "inventory", "invoicing", "rostering", "dispatch", "payroll", "warranty", "forecast", "audit", "billing", "scheduling", "tracking", "reporting", "onboarding", "renewal", "ledger", "quoting", "booking", "permits", "stocktake"];
const SECT = ["plumbers", "electricians", "bakers", "dentists", "landscapers", "accountants", "florists", "builders", "mechanics", "physios", "grocers", "tutors", "farmers", "printers", "vets"];
const SEATMIX = [undefined, undefined, undefined, ["owner"], ["enterprise"], ["owner", "pro"], ["agent"], ["partner", "enterprise"]];

function makeCatalogue(n) {
  const seenTitle = new Set(), out = [];
  while (out.length < n) {
    const a = pick(ADJ), b = pick(NOUN), c = pick(SECT), key = `${a} ${b} ${c}`;
    if (seenTitle.has(key)) continue; seenTitle.add(key);
    const i = out.length, tag = pick(NOUN), slug = `${a}-${b}-${c}-${i}`;
    out.push({ ...base, id: "offer:" + slug, slug, name: `${a[0].toUpperCase() + a.slice(1)} ${b} for ${c}`, bluf: `A plain ${b} service for ${c} that runs ${a} and gives you one dated page to keep.`,
      tags: [tag, c, "synthetic"], aliases: [`${b} helper`], seats: pick(SEATMIX), synthetic: true, _a: a, _b: b, _c: c, _tag: tag });
  }
  return out;
}
const strip = ({ _a, _b, _c, _tag, ...s }) => s;
const raw = makeCatalogue(1000);
// Grade like the shop does. synthetic:true shelves fail the public check, so flip in memory only (same as measure_shelf1000.mjs) and keep the flag in the label.
const graded = raw.map((r) => { const { seats, aliases, ...s } = strip(r); const g = gradeAll([{ ...s, synthetic: false }])[0]; return { ...g, seats, aliases, synthetic: false, _a: r._a, _b: r._b, _c: r._c, _tag: r._tag }; });
t("catalogue: all 1,000 synthetic shelves grade PASS", graded.every((s) => s.grade.pass), `${graded.filter((s) => !s.grade.pass).length} failed`);
const idx = buildShelfIndex(graded.map(strip2));
function strip2(s) { const { _a, _b, _c, _tag, ...r } = s; return r; }
t("index holds 1,000 docs, 0 skipped", idx.docs.length === 1000 && idx.skipped.length === 0, JSON.stringify(idx.skipped.slice(0, 2)));

// 1. Tokeniser / typo primitive
t("within1 basics", within1("quoting", "quotng") && within1("quoting", "quoteing") && within1("quoting", "qoutin") === false && within1("abcde", "abdce") && !within1("abcde", "abxyz"));
const typo = (w) => { if (w.length < 5) return w; const k = 1 + Math.floor(rnd() * (w.length - 2)); const m = Math.floor(rnd() * 3); return m === 0 ? w.slice(0, k) + w.slice(k + 1) : m === 1 ? w.slice(0, k) + "q" + w.slice(k + 1) : w.slice(0, k) + w[k] + w.slice(k); };

// 2. Recall: 200 queries, expected shelf in top 3 for the seat that may see it.
const visible = graded.filter((s) => !s.seats);
const Q = [];
for (let i = 0; i < 200; i++) {
  const s = pick(visible); const kind = i % 4;
  const q = kind === 0 ? `${s._b} ${s._c}` : kind === 1 ? `${s._a} ${typo(s._b)} ${s._c}` : kind === 2 ? `${s._b} helper ${s._c}` : `${typo(s._c)} ${s._tag} ${s._b} ${s._a}`;
  Q.push({ q, want: s.id });
}
let hit3 = 0, hit1 = 0; const missed = [];
for (const { q, want } of Q) { const r = searchShelves(idx, q, { seat: "guest" }).slice(0, 3).map((h) => h.id); if (r.includes(want)) hit3++; else missed.push(q); if (r[0] === want) hit1++; }
const recall = hit3 / Q.length;
console.log(`RECALL top-3 ${hit3} of ${Q.length} (${(recall * 100).toFixed(1)}%), top-1 ${hit1} of ${Q.length}; synthetic catalogue of 1,000; missed sample: ${JSON.stringify(missed.slice(0, 3))}`);
t("top-3 recall >= 90%", recall >= 0.9, `${hit3}/${Q.length}`);

// 3. Ungraded and failed shelves are never returned.
const probe = { ...graded[0] };
const ungraded = { ...strip2(probe), id: "offer:zz-ungraded-marker", slug: "zz-ungraded-marker", name: "Zzmarker ungraded offer", tags: ["zzmarker"], grade: undefined };
const failed = { ...strip2(probe), id: "offer:zz-failed-marker", slug: "zz-failed-marker", name: "Zzmarker failed offer", tags: ["zzmarker"], grade: { pass: false, checks: [] } };
const forged = { ...strip2(probe), id: "offer:zz-forged-marker", slug: "zz-forged-marker", name: "Zzmarker forged offer", tags: ["zzmarker"], bluf: "x", grade: { pass: true, checks: [] } }; // bluf too short: re-grade must fail
const idx2 = buildShelfIndex([...graded.map(strip2), ungraded, failed, forged]);
t("ungraded/failed/forged-pass shelves are skipped with reasons", idx2.skipped.length === 3 && idx2.docs.length === 1000, JSON.stringify(idx2.skipped));
for (const seat of ["guest", "owner", "enterprise", "agent", "pro", "partner"]) t(`ungraded never returned (${seat})`, searchShelves(idx2, "zzmarker ungraded failed forged", { seat }).length === 0);

// 4. Seat leak 0: guest never sees a seat-restricted shelf; each seat only sees its own.
let leaks = 0, checks = 0;
const bySeat = new Map(graded.map((s) => [s.id, s.seats]));
const allow = (id, seat) => { const s = bySeat.get(id); return !s || s.includes(seat); };
for (const seat of ["guest", "owner", "pro", "agent", "enterprise", "partner", "bogus", "", undefined, null, 5]) {
  for (let i = 0; i < 40; i++) {
    const s = graded[(i * 25) % 1000];
    for (const h of searchShelves(idx, `${s._b} ${s._c} ${s._a}`, { seat, limit: 50 })) { checks++; const eff = ["owner", "pro", "agent", "enterprise", "partner"].includes(seat) ? seat : "guest"; if (!allow(h.id, eff)) leaks++; }
  }
}
console.log(`SEAT LEAK ${leaks} of ${checks} returned hits checked across 11 seat inputs (incl. bogus, empty, null, number)`);
t("seat leak 0", leaks === 0 && checks > 500, `${leaks}/${checks}`);
t("guest cannot reach an owner-only shelf by exact title", (() => { const s = graded.find((x) => x.seats && x.seats.length === 1 && x.seats[0] === "owner"); return !searchShelves(idx, s.name, { seat: "guest", limit: 50 }).some((h) => h.id === s.id) && searchShelves(idx, s.name, { seat: "owner", limit: 50 }).some((h) => h.id === s.id); })());

// 5. Determinism: byte-identical results; tie-break by id.
const qs = Q.slice(0, 50).map((x) => x.q);
const a = JSON.stringify(qs.map((q) => searchShelves(idx, q, { seat: "guest" }))), b = JSON.stringify(qs.map((q) => searchShelves(buildShelfIndex(graded.map(strip2)), q, { seat: "guest" })));
t("same query, same bytes (also across a rebuilt index)", a === b);
const shuffled = [...graded.map(strip2)].reverse();
t("input order does not change results", JSON.stringify(qs.map((q) => searchShelves(buildShelfIndex(shuffled), q, { seat: "guest" }))) === a);
const tie = searchShelves(idx, "synthetic", { seat: "guest", limit: 50 });
t("ties are broken by id ascending", tie.length > 5 && tie.every((h, i) => i === 0 || tie[i - 1].score > h.score || tie[i - 1].id < h.id));

// 6. Query limits and junk.
const longQ = "x".repeat(5000) + " " + "plumbers ".repeat(1000);
t("long query is capped, no throw, returns array", Array.isArray(searchShelves(idx, longQ, { seat: "guest" })));
t("cap is real: a word placed after the char cap is ignored", searchShelves(idx, "a".repeat(MAX_QUERY_CHARS) + " " + graded[3]._c, { seat: "guest" }).length === 0);
for (const junk of ["", "   ", null, undefined, 5, {}, [], "!!!", "\u0000"]) t(`junk query ${JSON.stringify(junk)} -> []`, searchShelves(idx, junk, { seat: "guest" }).length === 0);
t("typo only at 5+ letters: 4-letter typo does not fuzz", searchShelves(idx, "audt", { seat: "guest" }).length === 0 && searchShelves(idx, "audit", { seat: "guest" }).length > 0);
t("5-letter token typo fuzzes (ledgr -> ledger)", searchShelves(idx, "ledgr", { seat: "guest" }).length > 0);
t("empty index is safe", searchShelves(buildShelfIndex([]), "ledger").length === 0 && searchShelves(null, "x").length === 0 && buildShelfIndex(null).docs.length === 0);

// 7. Performance: p95 under 20 ms on 1,000 shelves (SYNTHETIC), 2,000 timed queries.
const times = []; const qset = Q.map((x) => x.q);
for (let i = 0; i < 100; i++) searchShelves(idx, qset[i % qset.length], { seat: "guest" }); // warm-up
for (let i = 0; i < 2000; i++) { const q = qset[i % qset.length]; const t0 = performance.now(); searchShelves(idx, q, { seat: i % 2 ? "owner" : "guest" }); times.push(performance.now() - t0); }
times.sort((x, y) => x - y); const p95 = times[Math.floor(times.length * 0.95)], p50 = times[Math.floor(times.length / 2)], mx = times[times.length - 1];
const b0 = performance.now(); buildShelfIndex(graded.map(strip2)); const buildMs = performance.now() - b0;
console.log(`PERF 1,000 SYNTHETIC shelves, 2000 queries: p50 ${p50.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms, max ${mx.toFixed(3)} ms; index build ${buildMs.toFixed(1)} ms`);
t("p95 < 20 ms", p95 < 20, p95.toFixed(3));

// 8. Real committed shelves still index and answer.
const real = buildShelfIndex(file.shelves);
t("real committed shelves: all 30 shown shelves indexed", real.docs.length === 30 && real.skipped.length === 0, `${real.docs.length}`);
t("real shelf found by its own name", file.shelves.every((s) => searchShelves(real, s.name, { seat: "guest", limit: 3 }).some((h) => h.id === s.id)));
console.log(`shelf_search: ${pass} passed, ${fail} failed`);
console.log(fail ? "FAILED" : "ALL PASS");
process.exit(fail ? 1 : 0);
