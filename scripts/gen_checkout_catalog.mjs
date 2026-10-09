// Export the sellable catalog for the pricing engine: lib/checkout/catalog.json
// [{slug,name,group,priceAud,cadence,status,howItWorks,kyleMinutes}] from lib/offers/data/*.ts (Node >= 22.6 type stripping).
// Regenerate after any change to lib/offers/data/*.ts: node scripts/gen_checkout_catalog.mjs
// test_checkout_engine.mjs fails if the committed file drifts from the offer data.
import { readdirSync, writeFileSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export async function buildCatalog() {
  const dir = join(root, "lib", "offers", "data");
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts")).sort()) {
    const mod = await import(pathToFileURL(join(dir, f)).href);
    for (const v of Object.values(mod)) {
      if (!Array.isArray(v)) continue;
      for (const o of v) {
        out.push({
          slug: o.slug, name: o.name, group: o.group, priceAud: o.priceAud, cadence: o.cadence,
          status: o.status, howItWorks: o.howItWorks, kyleMinutes: o.kyleMinutes,
        });
      }
    }
  }
  return out;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await buildCatalog();
  writeFileSync(join(root, "lib", "checkout", "catalog.json"), JSON.stringify(out, null, 1) + "\n");
  console.log(`catalog: ${out.length} offers`);
}
