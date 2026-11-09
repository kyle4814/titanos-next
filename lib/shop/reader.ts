// Site wiring for the catalogue consumer: reads the published lib/shop/shelf_catalogue.json at build time (server components only) and falls back
// to the current shelves.json source when the file is absent or empty. A malformed or ungraded file throws here, which fails `next build` loudly.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createCatalogueReader } from "./catalogue_reader.ts";
import { SHOP } from "./index.ts";

export const CATALOGUE_PATH = join(process.cwd(), "lib", "shop", "shelf_catalogue.json");
export const RETRACTIONS_PATH = join(process.cwd(), "lib", "shop", "retractions.json"); // written next to the catalogue by build:catalogue (f317)
export const shopReader = createCatalogueReader(
  () => (existsSync(CATALOGUE_PATH) ? readFileSync(CATALOGUE_PATH, "utf8") : null),
  SHOP.shelves,
  () => (existsSync(RETRACTIONS_PATH) ? readFileSync(RETRACTIONS_PATH, "utf8") : null),
);
if (shopReader.retractionError) console.error("shop: " + shopReader.retractionError + "; serving no shelves (fail closed)");
