// Build lib/shop/shelves.json from lib/offers/data/*.ts, lib/products/products.ts, links.json and generator configs.
// Relies on Node type stripping (Node >= 22.18). Data files may only use `import type`.
// Usage: node scripts/build_shop.mjs [--check]   (--check exits 1 if the committed file is stale)
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { buildShelves } from "../lib/shop/catalogue.ts";
import { gradeAll, visibleShelves } from "../lib/shop/grader.ts";
import { loadConfigs } from "../lib/shop/loader.ts";
import { entryFromProduct } from "../lib/shop/entries.ts";
import { gradeEntry, verifyReady, REAL_CTX } from "../lib/shop/entry_grade.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const offers = [];
const dir = join(root, "lib/offers/data");
for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts")).sort()) {
  const mod = await import(pathToFileURL(join(dir, f)).href);
  for (const v of Object.values(mod)) if (Array.isArray(v)) offers.push(...v);
}
const products = (await import(pathToFileURL(join(root, "lib/products/products.ts")).href)).PRODUCTS;
const links = JSON.parse(readFileSync(join(root, "lib/offers/links.json"), "utf8"));
const cfgPath = join(root, "lib/shop/generator_configs.json"); // real configs land here; absent = none yet
const loaded = loadConfigs(existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, "utf8")) : []);
const configs = loaded.accepted;
if (loaded.rejected.length) { console.error("REJECTED configs:", JSON.stringify(loaded.rejected)); process.exit(1); } // a rejected real config stops the build loudly

// C5 grade path: every real product/course becomes an entry. Its status comes ONLY from lib/shop/product_status.json, and a READY
// there must carry a seal that matches the content and pass a fresh grade. A hand-edited READY flag fails the build (exit 1).
const statusPath = join(root, "lib/shop/product_status.json");
const statuses = existsSync(statusPath) ? JSON.parse(readFileSync(statusPath, "utf8")) : {};
const productLinks = JSON.parse(readFileSync(join(root, "lib/products/links.json"), "utf8"));
const slugs = new Set(products.map((p) => p.slug));
const entries = products.map((p) => entryFromProduct(p, productLinks, statuses));
const handEdited = [];
for (const k of Object.keys(statuses)) if (!slugs.has(k)) handEdited.push(`${k}: status row for an unknown product`);
for (const e of entries) for (const prob of verifyReady(e, REAL_CTX)) handEdited.push(`${e.slug}: ${prob}`);
if (handEdited.length) { console.error("PRODUCT STATUS REJECTED (READY needs a passing grade and a matching seal):\n - " + handEdited.join("\n - ")); process.exit(1); }
const entryGrades = entries.map((e) => ({ e, g: gradeEntry(e, REAL_CTX) }));
const readyEntries = new Set(entries.filter((e) => e.status === "READY").map((e) => e.slug));
const productGate = (slug) => readyEntries.has(slug);

const graded = gradeAll(buildShelves({ offers, products, configs, links, productGate }));
const shown = visibleShelves(graded);
const out = {
  generated_by: "scripts/build_shop.mjs",
  counts: { total: graded.length, graded_pass: shown.length, graded_fail: graded.length - shown.length, ungraded_shown: 0 },
  products: { total: entries.length, ready: readyEntries.size, check: entries.length - readyEntries.size, passing_all_checks: entryGrades.filter((x) => x.g.pass).length },
  shelves: shown,
};
const text = JSON.stringify(out, null, 1) + "\n";
const target = join(root, "lib/shop/shelves.json");
if (process.argv.includes("--check")) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== text) { console.error("shelves.json is stale: run node scripts/build_shop.mjs"); process.exit(1); }
  console.log("shelves.json current");
} else { writeFileSync(target, text); console.log(JSON.stringify(out.counts)); }
