// Build lib/shop/shelves.json from lib/offers/data/*.ts, lib/products/products.ts, links.json and generator configs.
// Relies on Node type stripping (Node >= 22.18). Data files may only use `import type`.
// Usage: node scripts/build_shop.mjs [--check]   (--check exits 1 if the committed file is stale)
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { buildShelves } from "../lib/shop/catalogue.ts";
import { gradeAll, visibleShelves } from "../lib/shop/grader.ts";
import { loadConfigs } from "../lib/shop/loader.ts";

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

const graded = gradeAll(buildShelves({ offers, products, configs, links }));
const shown = visibleShelves(graded);
const out = {
  generated_by: "scripts/build_shop.mjs",
  counts: { total: graded.length, graded_pass: shown.length, graded_fail: graded.length - shown.length, ungraded_shown: 0 },
  shelves: shown,
};
const text = JSON.stringify(out, null, 1) + "\n";
const target = join(root, "lib/shop/shelves.json");
if (process.argv.includes("--check")) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== text) { console.error("shelves.json is stale: run node scripts/build_shop.mjs"); process.exit(1); }
  console.log("shelves.json current");
} else { writeFileSync(target, text); console.log(JSON.stringify(out.counts)); }
