import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { withSeo } from "@/lib/seo";
import { OWN_STUDIES, OWN_METHOD, getOwn, ownVisible } from "@/lib/case-studies/own";

export const dynamicParams = false;

export function generateStaticParams() {
  return OWN_STUDIES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = getOwn((await params).slug);
  if (!s) return {};
  const url = `https://titanos.tech/case-studies/own/${s.slug}`;
  return withSeo(`/case-studies/own/${s.slug}`, {
    title: `${s.title} | TITANOS`,
    description: s.teaser,
    alternates: { canonical: url },
    openGraph: { title: s.title, description: s.teaser, type: "article", url },
    // Consent gate: noindex until consent is true in lib/case-studies/own.json.
    robots: ownVisible(s) ? { index: true, follow: true } : { index: false, follow: false },
  });
}

const SECTION: CSSProperties = { padding: "var(--space-12) 20px", position: "relative", zIndex: 2 };
const WRAP: CSSProperties = { maxWidth: 900, margin: "0 auto" };
const H: CSSProperties = { color: "var(--gold)", fontSize: 24, margin: "46px 0 12px" };
const BODY: CSSProperties = { color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "0 0 14px" };
const CARD: CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "16px 18px" };
const SMALL: CSSProperties = { color: "var(--ice)", opacity: 0.75, fontSize: 13, lineHeight: 1.5 };

export default async function OwnCaseStudy({ params }: { params: Promise<{ slug: string }> }) {
  const s = getOwn((await params).slug);
  if (!s) notFound();
  return (
    <main>
      <PageHero badge={`Our own product · ${s.sector}`} title={s.title} sub={s.teaser} />
      <section style={SECTION}>
        <div style={WRAP}>
          {!ownVisible(s) && (
            <p style={{ ...CARD, ...BODY, borderColor: "var(--gold-dim)", textAlign: "center" }}>
              Preview only. This page is hidden from search, the menu and the site map until the learner has agreed to it going public.
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            {s.facts.slice(0, 6).map((f) => (
              <div key={f.label} style={CARD}>
                <div style={{ color: "var(--gold)", fontSize: 26, fontWeight: 700 }}>{f.value}</div>
                <div style={{ color: "var(--ice)", fontSize: 14, lineHeight: 1.5 }}>{f.label}</div>
                <div style={{ ...SMALL, marginTop: 6 }}>{f.tag}, {f.as_of}</div>
              </div>
            ))}
          </div>

          <h2 style={H}>{s.brief.heading}</h2>
          <ul style={{ ...BODY, paddingLeft: 20 }}>
            {s.brief.points.map((p) => (
              <li key={p} style={{ marginBottom: 8 }}>{p}</li>
            ))}
          </ul>

          <h2 style={H}>What we built</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {s.built.map((b) => (
              <div key={b.name} style={CARD}>
                <div style={{ color: "var(--gold)", fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{b.name}</div>
                <div style={{ color: "var(--ice)", fontSize: 14, lineHeight: 1.6 }}>{b.text}</div>
              </div>
            ))}
          </div>

          <h2 style={H}>{s.how.heading}</h2>
          {s.how.paragraphs.map((p) => (
            <p key={p} style={BODY}>{p}</p>
          ))}

          {s.gallery.length > 0 && (
            <>
              <h2 style={H}>{s.gallery_heading}</h2>
              <p style={SMALL}>{s.gallery_note}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18, marginTop: 12 }}>
                {s.gallery.map((g) => (
                  <figure key={g.id} style={{ ...CARD, margin: 0, padding: 12 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.desktop}
                        alt={g.alt_desktop}
                        loading="lazy"
                        style={{ flex: "1 1 0", minWidth: 0, width: "100%", height: 190, objectFit: "cover", objectPosition: "top", borderRadius: 6, border: "1px solid #1c2730" }}
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.phone}
                        alt={g.alt_phone}
                        loading="lazy"
                        style={{ width: 92, height: 190, objectFit: "cover", objectPosition: "top", borderRadius: 12, border: "3px solid #1c2730", flex: "0 0 auto" }}
                      />
                    </div>
                    <figcaption style={{ ...SMALL, marginTop: 8 }}>{g.caption}</figcaption>
                  </figure>
                ))}
              </div>
            </>
          )}

          <h2 style={H}>Where it stands</h2>
          <p style={BODY}>{s.status}</p>
          <h3 style={{ ...H, fontSize: 19, margin: "30px 0 8px" }}>What we have not measured</h3>
          <ul style={{ ...BODY, paddingLeft: 20 }}>
            {s.limits.map((l) => (
              <li key={l} style={{ marginBottom: 8 }}>{l}</li>
            ))}
          </ul>

          <h2 style={H}>Where each figure comes from</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {s.facts.map((f) => (
              <div key={f.label} style={CARD}>
                <div style={{ color: "var(--gold)", fontSize: 14, fontWeight: 700 }}>{f.value} · {f.tag} · {f.as_of}</div>
                <div style={{ color: "var(--ice)", fontSize: 14, lineHeight: 1.6 }}>{f.source}</div>
              </div>
            ))}
          </div>
          <h3 style={{ ...H, fontSize: 19, margin: "30px 0 8px" }}>{OWN_METHOD.heading}</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {OWN_METHOD.rows.map((r) => (
              <div key={r.figure} style={CARD}>
                <div style={{ color: "var(--gold)", fontSize: 14, fontWeight: 700 }}>{r.figure}</div>
                <div style={{ color: "var(--ice)", fontSize: 14, lineHeight: 1.6 }}>{r.how}</div>
              </div>
            ))}
          </div>

          <p style={{ ...BODY, textAlign: "center", marginTop: 40 }}>
            Want something like this for your business? A free consultation is the first step, with no pressure.
          </p>
          <div style={{ textAlign: "center", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <AnimatedButton href="/audit">Book a free consultation</AnimatedButton>
            <AnimatedButton href="/case-studies" variant="secondary">All case studies</AnimatedButton>
          </div>
        </div>
      </section>
    </main>
  );
}
