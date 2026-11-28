// Offline tests for the digital catalogue generator, the checked-in generated files, and the R2 upload planner (dry run only).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingest, renderSite, renderWorker, toShelf, clean, SITE_OUT, WORKER_OUT } from "./gen_digital_catalogue.mjs";
import { plan, readCatalogue } from "../digital-api/scripts/upload_to_r2.mjs";

let n = 0; const t = (name, fn) => { fn(); n++; console.log(`PASS ${name}`); };
const dir = mkdtempSync(join(tmpdir(), "digcat-"));
const zipBytes = Buffer.alloc(300, 7);
const mk = (slug, over = {}, zip = true) => {
  mkdirSync(join(dir, slug), { recursive: true });
  writeFileSync(join(dir, slug, "listing.json"), JSON.stringify({ slug, title: "T — one", tagline: "tag", priceAud: 49, description: "d", whatsIncluded: ["a"], requirements: ["r."], disclaimers: ["x"], ...over }));
  if (zip) writeFileSync(join(dir, slug, `${slug}.zip`), zipBytes);
};
mk("good-pack"); mk("no-zip", {}, false); mk("bad-price", { priceAud: 0 }); mk("cheap-cents", { priceAud: 12.345 }); mk("mismatch", { slug: "other" });
mkdirSync(join(dir, "empty-dir")); writeFileSync(join(dir, "bad-json"), "x"); mkdirSync(join(dir, "half")); writeFileSync(join(dir, "half", "listing.json"), "{");

const { items, skipped } = ingest(dir);
t("only the complete listing with a zip is listed", () => { assert.deepEqual(items.map((i) => i.slug), ["good-pack"]); });
t("every skipped listing carries a reason", () => {
  const by = Object.fromEntries(skipped.map((s) => [s.slug, s.reason]));
  assert.match(by["no-zip"], /zip not built/); assert.match(by["bad-price"], /priceAud/); assert.match(by["cheap-cents"], /priceAud/);
  assert.match(by["mismatch"], /slug/); assert.match(by["empty-dir"], /no listing/); assert.match(by["half"], /not valid JSON/);
});
t("em and en dashes are removed from client copy", () => { assert.equal(items[0].title, "T, one"); assert.equal(clean("a – b—c"), "a, b, c"); });
t("zip size and sha256 are measured from the file", () => { assert.equal(items[0].zipBytes, 300); assert.equal(items[0].zipSha256, createHash("sha256").update(zipBytes).digest("hex")); });
t("the shelf entry has the Shelf shape: product, one-off, BUYABLE, PUBLISHED, on-site href, not synthetic", () => {
  const s = toShelf(items[0]);
  assert.equal(s.kind, "product"); assert.equal(s.cadence, "one-off"); assert.equal(s.availability, "BUYABLE"); assert.equal(s.priceLabel, "PUBLISHED");
  assert.equal(s.href, "/shop/digital/good-pack"); assert.equal(s.synthetic, false); assert.equal(s.priceAud, 49); assert.equal(s.buyUrl, null);
  for (const k of ["id", "slug", "name", "bluf", "bullets", "faq", "status", "source", "tags"]) assert.ok(k in s, k);
});
t("worker catalogue holds integer cents and the R2 key the upload writes", () => {
  const w = renderWorker(items); assert.match(w, /"priceCents": 4900/); assert.match(w, /"r2Key": "products\/good-pack\/good-pack\.zip"/);
});
t("output is deterministic", () => { assert.equal(renderSite(items), renderSite(ingest(dir).items)); });

// checked-in files: the site and the Worker agree on every slug and price (the Worker is what charges)
const site = JSON.parse(readFileSync(SITE_OUT, "utf8"));
const worker = readCatalogue(WORKER_OUT);
t("checked-in catalogue: site and Worker list the same slugs at the same price", () => {
  assert.equal(site.shelves.length, worker.length); assert.ok(worker.length > 0);
  for (const w of worker) { const s = site.shelves.find((x) => x.slug === w.slug); assert.ok(s, w.slug); assert.equal(Math.round(s.priceAud * 100), w.priceCents, w.slug); assert.equal(s.digital.sha256, w.sha256); }
});
t("checked-in catalogue: no dash in site copy, no private paths, no price rationale leaked", () => {
  const txt = readFileSync(SITE_OUT, "utf8");
  assert.doesNotMatch(txt, /[—–]/); assert.doesNotMatch(txt, /klinge-kernel|\/home\/|priceRationale/);
});

// upload planner: dry-run logic only, never touches R2
t("upload plan: a matching zip is uploadable with the exact wrangler argv, a changed zip is a problem", () => {
  const cat = [{ slug: "good-pack", filename: "good-pack.zip", r2Key: "products/good-pack/good-pack.zip", bytes: 300, sha256: items[0].zipSha256 }];
  const ok = plan(cat, dir, "b"); assert.equal(ok.problems.length, 0);
  assert.deepEqual(ok.rows[0].args.slice(0, 5), ["wrangler", "r2", "object", "put", "b/products/good-pack/good-pack.zip"]); assert.ok(ok.rows[0].args.includes("--remote"));
  const stale = plan([{ ...cat[0], sha256: "0".repeat(64) }], dir, "b"); assert.equal(stale.rows.length, 0); assert.match(stale.problems[0], /changed since/);
  assert.match(plan([{ ...cat[0], slug: "absent" }], dir, "b").problems[0], /missing/);
});
console.log(`${n} PASS`);
