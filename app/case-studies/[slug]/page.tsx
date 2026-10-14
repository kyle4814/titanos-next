import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { article, product, faqPage, breadcrumbs } from "@/lib/jsonld";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { CASES, getCase } from "@/lib/caseStudies";
import { OpenLoop } from "@/components/FlexBlock";
import FactBand from "@/components/cases/FactBand";
import PhoneGallery from "@/components/cases/PhoneGallery";

export const dynamicParams = false;

export function generateStaticParams() {
  return CASES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = getCase((await params).slug);
  if (!c) return {};
  const url = `https://titanos.tech/case-studies/${c.slug}`;
  return withSeo(`/case-studies/${c.slug}`, {
    title: `${c.title} | TITANOS`,
    description: c.teaser,
    alternates: { canonical: url },
    openGraph: { title: c.title, description: c.teaser, type: "article", url },
    robots: { index: true, follow: true },
  });
}

const SECTION: CSSProperties = { padding: "var(--space-12) 20px", position: "relative", zIndex: 2 };
const WRAP: CSSProperties = { maxWidth: 1020, margin: "0 auto" };
const PROSE: CSSProperties = { maxWidth: "54ch", margin: "0 auto" };
const H: CSSProperties = { color: "var(--gold)", fontSize: 22, margin: "34px 0 10px" };
const BODY: CSSProperties = { color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "0 0 14px" };

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = getCase((await params).slug);
  if (!c) notFound();
  return (
    <div>
      <JsonLd data={article({ path: `/case-studies/${c.slug}`, headline: c.title, description: c.teaser })} />
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Case studies", path: "/case-studies" }, { name: c.title, path: `/case-studies/${c.slug}` }])} />
      <PageHero badge={c.sector} title={c.title} sub={c.brief} />
      <section style={SECTION}>
        <div style={WRAP}>
          <FactBand facts={c.facts} />

          <div style={{ ...PROSE, marginTop: 28 }}>
          <p style={BODY}>
            The biggest number comes first, with its method underneath. Every figure is read from the build&apos;s own git log or a dated
            usage reading, and nothing here touched anyone&apos;s private data.
          </p>

          <h2 style={H}>How fast</h2>
          <p style={BODY}>{c.speed}</p>

          <OpenLoop>Fast is nice. What did it cost?</OpenLoop>

          <h2 style={H}>What it cost</h2>
          <p style={BODY}>{c.cost}</p>

          <h2 style={H}>What was built</h2>
          <ul style={{ ...BODY, paddingLeft: 20 }}>
            {c.built.map((b) => (
              <li key={b} style={{ marginBottom: 8 }}>
                {b}
              </li>
            ))}
          </ul>

          <OpenLoop>Cheap and fast still has to work. How do we know it does?</OpenLoop>

          <h2 style={H}>How it was checked</h2>
          <p style={BODY}>{c.tested}</p>
          </div>

          <h2 style={{ ...H, textAlign: "center", marginTop: 56 }}>Screens from the working app</h2>
          <PhoneGallery shots={c.shots} />

          <p style={{ ...BODY, textAlign: "center", marginTop: 40 }}>
            Would it be okay if we talked about something like this for your business? A free consultation is the first step, and a no is welcome.
          </p>
          <div style={{ textAlign: "center", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <AnimatedButton href="/audit">Book a free consultation</AnimatedButton>
            <AnimatedButton href="/case-studies" variant="secondary">
              All case studies
            </AnimatedButton>
          </div>
        </div>
      </section>
    </div>
  );
}
