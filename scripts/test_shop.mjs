// C5 shop kill tests that run locally: every shelf graded before it shows, 0 ungraded shown, unmatched asks go to the generator.
import fs from "node:fs";
import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { buildShelves, shelfFromOffer } from "../lib/shop/catalogue.ts";
import { gradeShelf, gradeAll, visibleShelves } from "../lib/shop/grader.ts";
import { quoteAsk } from "../lib/shop/quote.ts";
import { JOBS, SECTORS, COUNTRIES, expandSynthetic, validateConfig } from "../lib/shop/generator.ts";

let pass = 0, fail = 0;
const t = (name, ok, extra = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + name + " " + extra); } };
const root = new URL("..", import.meta.url).pathname;

const offers = [];
for (const f of readdirSync(root + "lib/offers/data").filter((x) => x.endsWith(".ts"))) {
  const m = await import(pathToFileURL(root + "lib/offers/data/" + f).href);
  for (const v of Object.values(m)) if (Array.isArray(v)) offers.push(...v);
}
const products = (await import(pathToFileURL(root + "lib/products/products.ts").href)).PRODUCTS;
const links = JSON.parse(fs.readFileSync(root + "lib/offers/links.json", "utf8"));
const vocab = { jobs: JOBS, sectors: SECTORS, countries: COUNTRIES };

// 1. Real catalogue: READY offers with a link pass; non-READY never show.
const graded = gradeAll(buildShelves({ offers, products, configs: [], links }));
const shown = visibleShelves(graded);
t("every offer becomes a shelf", graded.filter((s) => s.kind === "offer" || s.kind === "product" || s.kind === "course").length >= offers.length - products.filter((p) => p.offerSlug).length);
t("shown shelves all pass", shown.every((s) => s.grade.pass));
t("non-READY never shown", shown.every((s) => s.status === "READY"));
t("READY offers shown", shown.length === offers.filter((o) => o.status === "READY").length, `${shown.length}`);
t("0 ungraded shown", shown.every((s) => Array.isArray(s.grade?.checks) && s.grade.checks.length >= 8));
t("BUYABLE has a stripe link", shown.filter((s) => s.availability === "BUYABLE").every((s) => /^https:\/\/buy\.stripe\.com\//.test(s.buyUrl)));
t("no shelf shows a suggested price", shown.every((s) => s.kind === "offer" || s.priceAud === null || s.priceLabel === "PUBLISHED"));

// 2. Committed shelves.json matches the builder and contains only passing, graded shelves.
const file = JSON.parse(fs.readFileSync(root + "lib/shop/shelves.json", "utf8"));
t("shelves.json counts match", file.counts.graded_pass === shown.length && file.counts.ungraded_shown === 0);
t("shelves.json shelves re-grade pass", file.shelves.every((s) => gradeShelf(s).pass));
t("shelves.json ids match build", JSON.stringify(file.shelves.map((s) => s.id)) === JSON.stringify(shown.map((s) => s.id)));

// 3. Mutation tests: each broken input must fail grading.
const base = shown.find((s) => s.availability === "BUYABLE");
const bad = (patch, id) => { const g = gradeShelf({ ...base, ...patch }); return !g.pass && g.checks.some((c) => c.id === id && !c.ok); };
t("mut: em dash fails copy", bad({ bluf: base.bluf + " — now" }, "copy"));
t("mut: AI tell fails copy", bad({ name: "A robust thing" }, "copy"));
t("mut: no stripe link fails availability", bad({ buyUrl: null }, "availability-true"));
t("mut: non-stripe link fails availability", bad({ buyUrl: "https://evil.example/x" }, "availability-true"));
t("mut: not READY fails availability", bad({ status: "CHECK" }, "availability-true"));
t("mut: test-mode stripe link never a public buy link", bad({ buyUrl: "https://buy.stripe.com/test_abc123" }, "availability-true"));
t("mut: mock stripe link never a public buy link", bad({ buyUrl: "mock://stripe/x" }, "availability-true"));
t("mut: PROPOSED price fails price-honest", bad({ priceLabel: "PROPOSED" }, "price-honest"));
t("mut: synthetic fails", bad({ synthetic: true }, "not-synthetic"));
t("mut: empty bluf fails", bad({ bluf: "short" }, "bluf"));
t("mut: no source fails", bad({ source: "" }, "source"));
t("mut: SOON never shows", bad({ availability: "SOON" }, "availability-true"));
t("visibleShelves rejects a hand-made pass flag", visibleShelves([{ ...base, grade: { pass: true, checks: [] }, bluf: "x" }]).length === 0);

// 4. Generator shelves: need a passing fixture; synthetic never shows.
const syn = expandSynthetic(36);
t("synthetic expand count", syn.length === 36 && syn.every((c) => validateConfig(c).length === 0));
t("synthetic ids unique", new Set(syn.map((c) => c.id)).size === 36);
const synShown = visibleShelves(gradeAll(buildShelves({ offers: [], products: [], configs: syn, links: {} })));
t("synthetic configs: 0 shown", synShown.length === 0);
const real = syn.slice(0, 5).map((c) => ({ ...c, synthetic: false }));
const realShown = visibleShelves(gradeAll(buildShelves({ offers: [], products: [], configs: real, links: {} })));
t("real configs with passing fixture show", realShown.length === 5 && realShown.every((s) => s.availability === "QUOTE" && s.priceAud === null));
const noFix = real.map((c) => ({ ...c, proof: { fixture: c.proof.fixture, passed: false } }));
t("failed fixture: 0 shown", visibleShelves(gradeAll(buildShelves({ offers: [], products: [], configs: noFix, links: {} }))).length === 0);
const noProof = real.map(({ proof, ...c }) => c);
t("missing fixture: 0 shown", visibleShelves(gradeAll(buildShelves({ offers: [], products: [], configs: noProof, links: {} }))).length === 0);
t("validateConfig rejects bad", validateConfig({ id: "Bad ID" }).length >= 4);

// 5. 1,000 configs: scale kill test (synthetic-labelled), all graded, none ungraded, 0 model calls (pure functions).
const big = [];
for (let i = 0; i < 1000; i++) { const j = JOBS[i % 9], s = SECTORS[i % 8], c = COUNTRIES[i % 4]; const id = `${j}-${s}-${c.toLowerCase()}-${i}`; big.push({ id, job: j, sector: s, country: c, name: `${j} ${s} ${c}`, bluf: `A ready-made ${j} for ${s} in ${c}, built and checked.`, priceAud: null, synthetic: false, proof: { fixture: "f-" + j, passed: true } }); }
const t0 = performance.now();
const bigG = gradeAll(buildShelves({ offers: [], products: [], configs: big, links: {} }));
const ms = performance.now() - t0;
t("1000 configs: all graded, 1000 shown, 0 ungraded", visibleShelves(bigG).length === 1000 && bigG.every((s) => s.grade.checks.length > 0));
t("1000 configs grade in under 2000 ms", ms < 2000, `${ms.toFixed(0)}ms`);

// 6. Quote engine / concierge slice.
const pool = [...shown, ...visibleShelves(bigG)];
const q1 = quoteAsk("DMARC email security audit", pool, vocab);
t("matched ask returns a real shelf", q1.matched && pool.some((s) => s.id === q1.shelfId));
t("matched price is the shelf's own price", (() => { const s = pool.find((x) => x.id === q1.shelfId); return q1.priceAud === (s.cadence === "quote" ? null : s.priceAud); })());
const q2 = quoteAsk("I need a drone survey for my vineyard in NZ", pool, vocab, "2026-11-06");
t("unmatched ask: no invented price", !q2.matched && q2.priceAud === null && q2.priceLabel === "QUOTE");
t("unmatched ask: generator stub emitted and valid", q2.generatorStub && validateConfig(q2.generatorStub).length === 0 && q2.generatorStub.synthetic === false);
t("unmatched ask: asks for missing slots", q2.missing.includes("job") && q2.missing.includes("sector"));
t("deterministic", JSON.stringify(quoteAsk("plumbing invoice chase au", pool, vocab, "d")) === JSON.stringify(quoteAsk("plumbing invoice chase au", pool, vocab, "d")));
t("ungraded shelves cannot be quoted", !quoteAsk("DMARC email security audit", [{ ...pool[0], grade: { pass: false, checks: [] } }], vocab).matched);
t("empty ask does not match", !quoteAsk("   ", pool, vocab).matched);

console.log(fail ? `FAIL ${fail} (pass ${pass})` : `ALL PASS ${pass}`);
process.exit(fail ? 1 : 0);
