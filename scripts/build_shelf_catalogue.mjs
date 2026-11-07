// C5 build step: drained shelves -> promoteDrained -> assertCatalogueAllGraded -> write the published catalogue ONLY on success.
// Usage: node --experimental-strip-types scripts/build_shelf_catalogue.mjs [--source memory | --source file:<path>] [--out <path>]
//   memory (default): an empty in-memory store. file:<path>: JSON {"shelves":[{cluster_id,label,shelf}],"runs":{<cluster_id>:{content_hash,pass,checks}}}.
//   The D1 store (D1DrainedStore) is the same interface; it needs a live D1 binding, so it is wired by the Worker, not this CLI (CARD NEEDED in the f305 receipt).
// Exit 0 = catalogue written (or already identical). Exit 1 = any held shelf or assert throw; every offending cluster_id is printed on stderr, nothing is written.
// No model call, no network, no deploy.
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalogue, formatFailure, MemoryDrainedStore } from "../lib/shop/build_catalogue.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : dflt; };
const source = opt("--source", "memory");
const out = resolve(opt("--out", join(root, "lib/shop/shelf_catalogue.json")));

let store;
if (source === "memory") store = new MemoryDrainedStore();
else if (source.startsWith("file:")) {
  let batch;
  try { batch = JSON.parse(readFileSync(source.slice(5), "utf8")); } catch (e) { console.error("BUILD FAILED: cannot read source: " + e.message); process.exit(1); }
  store = new MemoryDrainedStore({ shelves: batch.shelves ?? [], runs: batch.runs ?? {} });
} else { console.error("BUILD FAILED: unknown --source " + source); process.exit(1); }

let existing = { entries: [] };
if (existsSync(out)) {
  try { existing = JSON.parse(readFileSync(out, "utf8")); } catch (e) { console.error("BUILD FAILED: existing catalogue unreadable: " + e.message); process.exit(1); }
}

const res = await buildCatalogue(store, existing);
if (!res.ok) { console.error(formatFailure(res)); process.exit(1); }
mkdirSync(dirname(out), { recursive: true });
const tmp = out + ".tmp";
writeFileSync(tmp, res.text);
renameSync(tmp, out);
console.log(`BUILD OK: ${res.catalogue.entries.length} shelves live (${res.published} new, ${res.already} unchanged) -> ${out}`);
