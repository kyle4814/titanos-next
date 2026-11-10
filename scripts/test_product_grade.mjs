// C5 product/course grading path: CHECK -> READY only when every check passes; hand-edited READY fails the build.
// Fixtures are SYNTHETIC (lib/shop/fixtures), never merged into the real catalogue. ROOT env points at a (mutated) copy for mutant runs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = process.env.ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { gradeEntry, promoteEntry, verifyReady, visibleEntries, buildEntryShelves, sealOf } = await imp("lib/shop/entry_grade.ts");
const { entryFromProduct } = await imp("lib/shop/entries.ts");
const { FIXTURES, FIXTURE_PRICEBOOK, FIXTURE_LABEL } = await imp("lib/shop/fixtures/synthetic_entries.ts");
const { PRICEBOOK, CH5_ANCHORS_AUD } = await imp("lib/shop/pricebook.ts");
const { PRODUCTS } = await imp("lib/products/products.ts");

let pass = 0, fail = 0;
const t = (name, ok, extra = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + name + " " + extra); } };
const ctx = { pricebook: FIXTURE_PRICEBOOK };

// 1. Twelve fixtures: exactly one passes; each fault fails its own check and no other.
t("12 fixtures", FIXTURES.length === 12 && FIXTURES.filter((f) => f.fails === null).length === 1);
t("fixtures labelled SYNTHETIC", FIXTURE_LABEL.startsWith("SYNTHETIC") && FIXTURES.every((f) => f.entry.synthetic === true && f.entry.slug.startsWith("synthetic-")));
t("fixture slugs unique", new Set(FIXTURES.map((f) => f.entry.slug)).size === 12);
for (const f of FIXTURES) {
  const g = gradeEntry(f.entry, ctx);
  const failed = g.checks.filter((c) => !c.ok).map((c) => c.id);
  if (f.fails === null) t(`${f.entry.slug}: passes all checks`, g.pass && failed.length === 0, failed.join());
  else t(`${f.entry.slug}: fails ${f.fails} only`, !g.pass && failed.length === 1 && failed[0] === f.fails, failed.join());
}

// 2. Promotion: CHECK -> READY only on a full pass; a fault stays CHECK with the failed checks named.
const results = FIXTURES.map((f) => ({ f, r: promoteEntry(f.entry, ctx) }));
t("only the pass promotes", results.filter((x) => x.r.entry.status === "READY").length === 1 && results.find((x) => x.f.fails === null).r.entry.status === "READY");
t("faults stay CHECK, named, no seal", results.filter((x) => x.f.fails !== null).every((x) => x.r.entry.status === "CHECK" && !x.r.entry.seal && x.r.failed.length === 1 && x.r.failed[0].id === x.f.fails));
const ready = results.find((x) => x.f.fails === null).r.entry;
t("READY entry is sealed and honest", !!ready.seal && verifyReady(ready, ctx).length === 0);
t("hand-set READY without seal rejected", verifyReady({ ...FIXTURES[2].entry, status: "READY" }, ctx).some((p) => /without a grade seal/.test(p)));
t("hand-set READY on a good entry without seal rejected", verifyReady({ ...FIXTURES[0].entry, status: "READY" }, ctx).length > 0);
t("edit after grading breaks the seal", verifyReady({ ...ready, bluf: ready.bluf + " Extra words here." }, ctx).some((p) => /seal does not match/.test(p)));
t("forged seal on a failing entry rejected", (() => { const bad = { ...FIXTURES[2].entry, status: "READY" }; bad.seal = sealOf(bad); return verifyReady(bad, ctx).some((p) => /fresh grade fails/.test(p)); })());

// 3. The shelf builder shows only the passing fixture; ungraded shown stays 0. Synthetic never shows by default.
const all = FIXTURES.map((f) => f.entry);
const handReady = all.map((e) => ({ ...e, status: "READY" })); // every fixture flagged READY by hand, no seals
const promoted = results.map((x) => x.r.entry);
const shelf = buildEntryShelves([...promoted], ctx, { includeSynthetic: true });
t("shelf shows only the passing fixture", shelf.counts.shown === 1 && shelf.shelves[0].slug === "synthetic-good-guide", JSON.stringify(shelf.counts));
t("ungraded shown = 0", shelf.counts.ungraded_shown === 0);
const handShelf = buildEntryShelves(handReady, ctx, { includeSynthetic: true });
t("12 hand-flagged READY: 0 shown, 0 ungraded shown", handShelf.counts.shown === 0 && handShelf.counts.ungraded_shown === 0, JSON.stringify(handShelf.counts));
t("synthetic never shows by default", buildEntryShelves(promoted, ctx).counts.shown === 0);
t("visibleEntries rejects hand-flagged READY", visibleEntries(handReady, ctx, { includeSynthetic: true }).length === 0);

// 4. Real catalogue: 14 entries, none READY yet, pricebook agrees with the product file, no ch.5 anchor borrowed.
const links = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/products/links.json"), "utf8"));
const realEntries = PRODUCTS.map((p) => entryFromProduct(p, links, {}));
t("14 real products and courses", realEntries.length === 14 && realEntries.filter((e) => e.kind === "course").length === 2);
t("pricebook covers every real slug at its proposal", PRODUCTS.every((p) => PRICEBOOK[p.slug]?.priceAud === p.suggestedPriceAud) && Object.keys(PRICEBOOK).length === PRODUCTS.length);
// AU$49/149/499 owner tiers are monthly EXAMPLE prices, so a one-off AU$49 guide may share the number; the big anchors may not be borrowed.
t("no product borrows a ch.5 big anchor (AU$1,000+)", PRODUCTS.every((p) => !Object.values(CH5_ANCHORS_AUD).filter((v) => v >= 1000).includes(p.suggestedPriceAud)));
const realG = realEntries.map((e) => gradeEntry(e));
t("real entries fail only on the stripe link today", realG.every((g) => g.checks.filter((c) => !c.ok).every((c) => c.id === "stripe-test-only")), JSON.stringify(realG.map((g) => g.checks.filter((c) => !c.ok).map((c) => c.id))));
t("real catalogue: 0 shown today", buildEntryShelves(realEntries).counts.shown === 0);
t("fixtures never in the real build", !/fixtures/.test(fs.readFileSync(path.join(ROOT, "scripts/build_shop.mjs"), "utf8")) && !/synthetic-/.test(fs.readFileSync(path.join(ROOT, "lib/shop/shelves.json"), "utf8")));
t("live-mode link refused", !gradeEntry({ ...FIXTURES[0].entry, stripe: { mode: "test", url: "https://buy.stripe.com/abc123" } }, ctx).pass);

// 5. build_shop --check against a temp copy: a hand-edited READY flag fails the build.
const T = fs.mkdtempSync(path.join(os.tmpdir(), "f70-"));
if (!T || !T.startsWith(os.tmpdir())) throw new Error("bad tmp");
fs.cpSync(path.join(ROOT, "lib"), path.join(T, "lib"), { recursive: true });
fs.mkdirSync(path.join(T, "scripts"));
fs.copyFileSync(path.join(ROOT, "scripts/build_shop.mjs"), path.join(T, "scripts/build_shop.mjs"));
const build = (...a) => spawnSync("node", ["scripts/build_shop.mjs", ...a], { cwd: T, encoding: "utf8" });
const setStatus = (o) => fs.writeFileSync(path.join(T, "lib/shop/product_status.json"), JSON.stringify(o));
const setLink = (slug, url) => { const p = path.join(T, "lib/products/links.json"); const l = JSON.parse(fs.readFileSync(p, "utf8")); l[slug] = url; fs.writeFileSync(p, JSON.stringify(l, null, 2)); };
setStatus({}); t("baseline build ok", build().status === 0 && build("--check").status === 0);
setStatus({ "dmarc-setup-guide": { status: "READY" } });
let r = build("--check"); t("hand-edited READY (no seal) fails --check", r.status === 1 && /without a grade seal/.test(r.stderr), r.stderr.slice(0, 200));
r = build(); t("hand-edited READY fails the plain build too", r.status === 1);
setStatus({ "dmarc-setup-guide": { status: "READY", seal: "0".repeat(64) } });
r = build("--check"); t("READY with forged seal fails", r.status === 1 && /seal does not match/.test(r.stderr));
setStatus({ nonsense: { status: "READY" } }); t("status row for unknown product fails", build("--check").status === 1);
// honest path: give it a mock link, promote through the real code, write the seal, build passes and counts it.
setLink("dmarc-setup-guide", "mock://stripe/dmarc-setup-guide"); setStatus({});
const e0 = entryFromProduct(PRODUCTS.find((p) => p.slug === "dmarc-setup-guide"), { "dmarc-setup-guide": "mock://stripe/dmarc-setup-guide" }, {});
const pr = promoteEntry(e0);
t("real entry promotes with a mock link", pr.entry.status === "READY" && pr.failed.length === 0, JSON.stringify(pr.failed));
setStatus({ "dmarc-setup-guide": { status: "READY", seal: pr.entry.seal } });
r = build(); const shelves = JSON.parse(fs.readFileSync(path.join(T, "lib/shop/shelves.json"), "utf8"));
t("honest READY builds, counted once", r.status === 0 && shelves.products.ready === 1 && shelves.counts.ungraded_shown === 0, r.stderr.slice(0, 200));
setLink("dmarc-setup-guide", "https://buy.stripe.com/abc123"); // someone swaps in a live link after grading
t("live link swapped in after grading fails", build("--check").status === 1);
// real tree untouched by the temp runs
t("real status file is empty (nothing READY)", fs.readFileSync(path.join(ROOT, "lib/shop/product_status.json"), "utf8").trim() === "{}");
fs.rmSync(T, { recursive: true, force: true });

console.log(fail ? `FAIL ${fail} (pass ${pass})` : `ALL PASS ${pass}`);
process.exit(fail ? 1 : 0);
