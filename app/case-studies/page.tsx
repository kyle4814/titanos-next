import type { Metadata } from "next";
import type { CSSProperties } from "react";
import PageHero from "@/components/PageHero";
import { CASES } from "@/lib/caseStudies";
import { ARIANCE, arianceVisible, ariancePath } from "@/lib/case-studies/ariance";

const META_TITLE = "Case studies | TITANOS";
const META_DESC =
  "A library of real builds: what was made, how fast, what it cost, and how it was tested. Counts come from the git log, screenshots from the working product.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/case-studies" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/case-studies" },
  robots: { index: true, follow: true },
};

const SECTION: CSSProperties = { padding: "var(--space-16) 20px", position: "relative", zIndex: 2 };

export default function CaseStudies() {
  return (
    <main>
      <PageHero
        badge="Case studies"
        title="The receipts library."
        sub="Each case study is a real build, with its speed, its cost and how it was tested. Names stay private."
      />
      <section style={SECTION}>
        {arianceVisible && (
          <a
            href={ariancePath}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              maxWidth: 960,
              margin: "0 auto 18px",
              textDecoration: "none",
              background: "var(--card)",
              border: "1px solid var(--gold-dim)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ARIANCE.cover.src}
              alt={ARIANCE.cover.alt}
              style={{ width: "100%", height: "100%", minHeight: 260, objectFit: "cover", objectPosition: "top", display: "block" }}
            />
            <div style={{ padding: "22px 24px" }}>
              <div style={{ color: "var(--gold)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>
                Hero case study · {ARIANCE.sector}
              </div>
              <h2 style={{ color: "var(--ice)", fontSize: 24, margin: "8px 0 10px" }}>{ARIANCE.title}</h2>
              <p style={{ color: "var(--ice)", opacity: 0.85, fontSize: 15, lineHeight: 1.6, margin: 0 }}>{ARIANCE.teaser}</p>
              <div style={{ color: "var(--gold)", marginTop: 14, fontSize: 15 }}>Read the case study →</div>
            </div>
          </a>
        )}
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
          }}
        >
          {CASES.map((c) => (
            <a
              key={c.slug}
              href={`/case-studies/${c.slug}`}
              style={{
                display: "block",
                textDecoration: "none",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.cover}
                alt={c.coverAlt}
                loading="lazy"
                style={{ width: "100%", height: 260, objectFit: "cover", objectPosition: "top", display: "block" }}
              />
              <div style={{ padding: "18px 20px" }}>
                <div style={{ color: "var(--gold)", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>
                  {c.sector}
                </div>
                <h2 style={{ color: "var(--ice)", fontSize: 20, margin: "6px 0 8px" }}>{c.title}</h2>
                <p style={{ color: "var(--ice)", opacity: 0.8, fontSize: 15, lineHeight: 1.6, margin: 0 }}>{c.teaser}</p>
                <div style={{ color: "var(--gold)", marginTop: 12, fontSize: 15 }}>Read the case study →</div>
              </div>
            </a>
          ))}
        </div>
        <p style={{ color: "var(--ice)", textAlign: "center", marginTop: 36, fontSize: "var(--fs-body)" }}>
          Want a build like this for your business?{" "}
          <a href="/audit" style={{ color: "var(--gold)" }}>
            Book a free consultation
          </a>
          , with no pressure.
        </p>
      </section>
    </main>
  );
}
