import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import { Block, NumberBlock, NextStep, jsonLd } from "@/components/SiteBlocks";
import { PRODUCTS, priceOf, SITE_URL } from "@/lib/site-data";

export const dynamicParams = false;
export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const p = PRODUCTS.find((x) => x.slug === slug);
  if (!p) return {};
  return {
    title: `${p.name} · TITANOS`,
    description: p.point,
    alternates: { canonical: `${SITE_URL}/products/${p.slug}` },
    openGraph: { title: `${p.name} · TITANOS`, description: p.point, url: `${SITE_URL}/products/${p.slug}`, images: [{ url: "/og-image.png", width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: ["/og-image.png"] },
    robots: { index: true, follow: true },
  };
}

export default async function ProductPage({ params }: P) {
  const { slug } = await params;
  const p = PRODUCTS.find((x) => x.slug === slug);
  if (!p) notFound();
  const price = priceOf(p);
  return (
    <>
      {jsonLd({ "@context": "https://schema.org", "@type": "Service", name: p.name, description: p.point, url: `${SITE_URL}/products/${p.slug}`, provider: { "@type": "Organization", name: "TITANOS", url: SITE_URL } })}
      <PageHero badge={p.name.toUpperCase()} title={p.point} tagline={`${price} · ${p.cadence}`} />
      <NumberBlock heading="The one number to know" fact={{ value: p.num, label: p.label, note: p.numNote, source: "lib/pricing.ts" }} />
      <Block point="Who it is for">{p.for_}</Block>
      <Block point="What you get">{p.gets}</Block>
      <Block point="What it is not">{p.not_}</Block>
      <NextStep text="See it on your own business first, free." href={p.href} label={`See ${p.name}`} />
    </>
  );
}
