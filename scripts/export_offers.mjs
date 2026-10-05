// Export offers from lib/offers/data/*.ts to JSON on stdout: [{slug,name,priceAud,cadence,status}].
// No dependencies: relies on Node's built-in TypeScript type stripping (Node >= 22.6; default on 22.18+).
// The data files may only use `import type` (erased). Usage: node scripts/export_offers.mjs > /tmp/offers.json
import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "offers", "data");
const out = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts")).sort()) {
  const mod = await import(pathToFileURL(join(dir, f)).href);
  for (const v of Object.values(mod)) {
    if (!Array.isArray(v)) continue;
    for (const o of v) {
      out.push({ slug: o.slug, name: o.name, priceAud: o.priceAud, cadence: o.cadence, status: o.status });
    }
  }
}
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
// Regenerate: node scripts/export_offers.mjs > lib/offers/offers.json  (run after any change to lib/offers/data/*.ts)
