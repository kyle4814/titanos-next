import type { Product } from "./types";
import { PRODUCTS } from "./products";
import offers from "../offers/offers.json";
import links from "./links.json";
import { formatAUD } from "../pricing";
import { PRICEBOOK } from "../shop/pricebook";

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

// Published price: the pricebook row for the slug (label PUBLISHED, Kyle 2026-11-29), else the offers.json price, else TBC.
export function productPriceAud(p: Product): number | null {
  const row = PRICEBOOK[p.slug];
  if (row && row.label === "PUBLISHED" && row.priceAud === p.suggestedPriceAud) return row.priceAud;
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
