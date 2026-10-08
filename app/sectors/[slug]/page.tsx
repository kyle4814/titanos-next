import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import { Block, NumberBlock, NextStep, jsonLd } from "@/components/SiteBlocks";
import { SECTORS, SITE_URL } from "@/lib/site-data";

export const dynamicParams = false;
export function generateStaticParams() {
  return SECTORS.map((s) => ({ slug: s.slug }));
}

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const s = SECTORS.find((x) => x.slug === slug);
  if (!s) return {};
  return {
    title: `${s.name} · TITANOS`,
    description: s.point,
    alternates: { canonical: `${SITE_URL}/sectors/${s.slug}` },
    openGraph: { title: `${s.name} · TITANOS`, description: s.point, url: `${SITE_URL}/sectors/${s.slug}`, images: [{ url: "/og-image.png", width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: ["/og-image.png"] },
    robots: { index: true, follow: true },
  };
}

export default async function SectorPage({ params }: P) {
  const { slug } = await params;
  const s = SECTORS.find((x) => x.slug === slug);
  if (!s) notFound();
  return (
    <>
      {jsonLd({ "@context": "https://schema.org", "@type": "WebPage", name: s.name, description: s.point, url: `${SITE_URL}/sectors/${s.slug}` })}
      <PageHero badge="SECTOR" title={s.name} tagline={s.point} />
      <NumberBlock fact={s.fact} />
      <Block point="Why it matters here">{s.problem}</Block>
      <Block point="What we do">{s.what}</Block>
      <NextStep text={s.next} href="/scan" label="Start free" />
    </>
  );
}
