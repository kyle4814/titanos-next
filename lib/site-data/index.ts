import sectorsJson from "./sectors.json";
import productsJson from "./products.json";
import creditsJson from "./credits.json";
import { DISPLAY } from "@/lib/pricing";

export type Rung = "MEASURED" | "REPRODUCED" | "MODELLED" | "ESTIMATE" | "FORECAST" | "EXAMPLE" | "UNKNOWN";

export type Fact = { value: string; label: Rung; note: string; source: string | null; sourceUrl?: string | null };
export type Sector = { slug: string; name: string; point: string; problem: string; what: string; fact: Fact; next: string };
export type Product = {
  slug: string; name: string; point: string; priceKey: string; cadence: string; for_: string;
  gets: string; not_: string; label: Rung; num: string; numNote: string; href: string;
};
export type Credit = { file: string; title: string; creator: string; licence: string; sourceUrl: string };

export const SECTORS = sectorsJson as Sector[];
export const PRODUCTS = productsJson as Product[];
export const CREDITS = creditsJson as Credit[];

export const priceOf = (p: Product): string =>
  (DISPLAY as Record<string, string>)[p.priceKey] ?? "Ask for a quote";

export const SITE_URL = "https://titanos.tech";
