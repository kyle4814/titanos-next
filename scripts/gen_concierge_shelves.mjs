// Writes public/concierge/shelves.json from the concierge catalogue (portal shelves + real offers), so the browser fetches
// the catalogue on first ask instead of shipping 239 KB of offer data inside the FAQ JS. Usage: node scripts/gen_concierge_shelves.mjs [--check]
// JSON is not counted in perf_budget total JS, and no route's first-load JS contains it.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const OUT = fileURLToPath(new URL("../public/concierge/shelves.json", import.meta.url));
const { SHELVES } = await import("../lib/concierge/catalogue.ts");
const body = JSON.stringify(SHELVES) + "\n";
if (process.argv.includes("--check")) {
  const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (have !== body) { console.log("STALE public/concierge/shelves.json: run node scripts/gen_concierge_shelves.mjs"); process.exit(1); }
  console.log("shelves.json fresh", SHELVES.length, "shelves", body.length, "bytes");
} else {
  fs.mkdirSync(fileURLToPath(new URL("../public/concierge", import.meta.url)), { recursive: true });
  fs.writeFileSync(OUT, body);
  console.log("wrote", OUT, SHELVES.length, "shelves", body.length, "bytes");
}
