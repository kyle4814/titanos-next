import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import { jsonLd } from "@/components/SiteBlocks";
import SectionReveal from "@/components/SectionReveal";
import AnimatedButton from "@/components/AnimatedButton";
import c from "../sectors.module.css";
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
      <SectionReveal className="pe-section">
        <div className={`pe-page ${c.block}`}>
          <span className="pe-eyebrow-line">The biggest true number</span>
          <p className={c.num}>{s.fact.value}</p>
          <p data-claim-label={s.fact.label} className={c.label}>{s.fact.label}</p>
          <p>{s.fact.note}</p>
          {s.fact.source && (
            <p className={c.src}>
              Source: {s.fact.sourceUrl ? <a href={s.fact.sourceUrl} rel="noopener noreferrer">{s.fact.source}</a> : s.fact.source}
            </p>
          )}
        </div>
      </SectionReveal>
      <SectionReveal className="pe-section">
        <div className={`pe-page ${c.block}`}>
          <h2>Why it matters here</h2>
          <p>{s.problem}</p>
        </div>
      </SectionReveal>
      <SectionReveal className="pe-section">
        <div className={`pe-page ${c.block}`}>
          <h2>What we do</h2>
          <p>{s.what}</p>
        </div>
      </SectionReveal>
      <SectionReveal className="pe-section">
        <div className={`pe-page ${c.block}`}>
          <h2>{s.next}</h2>
          <p className={c.ask}>Would it be okay if we showed you? A no is welcome.</p>
          <AnimatedButton href="/scan">Start free</AnimatedButton>
        </div>
      </SectionReveal>
    </>
  );
}
