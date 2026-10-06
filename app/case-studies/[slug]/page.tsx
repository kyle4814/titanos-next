import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { CASES, getCase } from "@/lib/caseStudies";

export const dynamicParams = false;

export function generateStaticParams() {
  return CASES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = getCase((await params).slug);
  if (!c) return {};
  const url = `https://titanos.tech/case-studies/${c.slug}`;
  return {
    title: `${c.title} | TITANOS`,
    description: c.teaser,
    alternates: { canonical: url },
    openGraph: { title: c.title, description: c.teaser, type: "article", url },
    robots: { index: true, follow: true },
  };
}

const SECTION: CSSProperties = { padding: "var(--space-12) 20px", position: "relative", zIndex: 2 };
const WRAP: CSSProperties = { maxWidth: 820, margin: "0 auto" };
const H: CSSProperties = { color: "var(--gold)", fontSize: 22, margin: "34px 0 10px" };
const BODY: CSSProperties = { color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "0 0 14px" };

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = getCase((await params).slug);
  if (!c) notFound();
  return (
    <main>
      <PageHero badge={c.sector} title={c.title} sub={c.brief} />
      <section style={SECTION}>
        <div style={WRAP}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            {c.facts.map(([n, l]) => (
              <div
                key={l}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "16px 18px",
                }}
              >
                <div style={{ color: "var(--gold)", fontSize: 26, fontWeight: 700 }}>{n}</div>
                <div style={{ color: "var(--ice)", fontSize: 14, lineHeight: 1.5 }}>{l}</div>
              </div>
            ))}
          </div>

          <h2 style={H}>How fast</h2>
          <p style={BODY}>{c.speed}</p>

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

          <h2 style={H}>How it was checked</h2>
          <p style={BODY}>{c.tested}</p>

          <h2 style={H}>Screens from the working app</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 20,
              justifyItems: "center",
            }}
          >
            {c.shots.map((s) => (
              <figure key={s.src} style={{ margin: 0, maxWidth: 300 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.src}
                  alt={s.alt}
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    borderRadius: 28,
                    border: "6px solid #1c2730",
                    boxShadow: "0 12px 40px rgba(0,0,0,.5)",
                  }}
                />
                <figcaption style={{ color: "var(--ice)", opacity: 0.75, fontSize: 13, marginTop: 10, textAlign: "center" }}>
                  {s.alt}
                </figcaption>
              </figure>
            ))}
          </div>

          <p style={{ ...BODY, textAlign: "center", marginTop: 40 }}>
            Want something like this for your business? A free consultation is the first step, with no pressure.
          </p>
          <div style={{ textAlign: "center", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <AnimatedButton href="/audit">Book a free consultation</AnimatedButton>
            <AnimatedButton href="/case-studies" variant="secondary">
              All case studies
            </AnimatedButton>
          </div>
        </div>
      </section>
    </main>
  );
}
