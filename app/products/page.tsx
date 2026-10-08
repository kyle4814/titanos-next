import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { CardGrid, Block, NextStep } from "@/components/SiteBlocks";
import { PRODUCTS, priceOf } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "Products · TITANOS",
  description: "The published TITANOS offers, each with its price from one source of truth.",
  alternates: { canonical: "https://titanos.tech/products" },
  robots: { index: true, follow: true },
};

export default function ProductsPage() {
  return (
    <>
      <PageHero badge="PRODUCTS" title="Start free, grow only if it helps" tagline="Every price on this site comes from one file, so it is the same everywhere." />
      <Block point="Each product has a free way in, and a no is welcome." />
      <CardGrid items={PRODUCTS.map((p) => ({ href: `/products/${p.slug}`, title: `${p.name} · ${priceOf(p)}`, text: p.point }))} />
      <NextStep text="Not sure which fits? Start with the free scan." href="/scan" label="Run the free scan" />
    </>
  );
}
