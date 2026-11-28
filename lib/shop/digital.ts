// Site reader for the digital products shelf. Build-time only (static JSON import); the price shown here is display copy,
// the price CHARGED is always read by the Worker from its own generated catalogue (digital-api/src/catalogue.generated.ts).
import data from "./digital_products.json";
import type { DigitalShelf } from "./digital_types";

export const DIGITAL_SHELVES: DigitalShelf[] = (data as unknown as { shelves: DigitalShelf[] }).shelves;
export const getDigital = (slug: string): DigitalShelf | undefined => DIGITAL_SHELVES.find((s) => s.slug === slug);
