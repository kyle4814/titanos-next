import type { Product } from "./types";
import { PRODUCTS } from "./products";
import offers from "../offers/offers.json";
import links from "./links.json";
import { formatAUD } from "../pricing";

export { PRODUCTS };

// Fails the build on a duplicate slug or an offerSlug that is not in offers.json.
(() => {
  const seen = new Set<string>();
  for (const p of PRODUCTS) {
    if (seen.has(p.slug)) throw new Error(`Duplicate product slug: ${p.slug}`);
    seen.add(p.slug);
    if (p.offerSlug && !(offers as { slug: string }[]).some((o) => o.slug === p.offerSlug)) {
      throw new Error(`Product ${p.slug}: offerSlug ${p.offerSlug} not in offers.json`);
    }
  }
})();

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

// Price comes from offers.json only. No offerSlug (or a null price) means TBC.
export function productPriceAud(p: Product): number | null {
  if (!p.offerSlug) return null;
  const o = (offers as { slug: string; priceAud: number | null }[]).find((x) => x.slug === p.offerSlug);
  return o && typeof o.priceAud === "number" ? o.priceAud : null;
}

export function formatProductPrice(p: Product): string {
  const price = productPriceAud(p);
  return price === null ? "Price to be confirmed" : formatAUD(price);
}

// Buy button reads the payment link from links.json. Empty means not live yet.
export function productBuyHref(p: Product): string | null {
  const v = (links as Record<string, string>)[p.slug];
  return v && v.startsWith("https://") ? v : null;
}
