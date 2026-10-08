/**
 * SiteBlocks: the shared blocks for the W7 pages (sectors, products, how it works, FAQ ...).
 * One idea per block, the point in the first line, the biggest true number with its claim label,
 * one calm next step. No urgency, no scarcity.
 */
import type { ReactNode } from "react";
import SectionReveal from "@/components/SectionReveal";
import AnimatedButton from "@/components/AnimatedButton";
import type { Fact } from "@/lib/site-data";

const SECTION = { padding: "var(--space-12) 20px", position: "relative", zIndex: 2 } as const;

export function Block({ point, children }: { point: string; children?: ReactNode }) {
  return (
    <SectionReveal style={SECTION}>
      <div className="container-vault" style={{ maxWidth: 760 }}>
        <h2 style={{ fontSize: "clamp(1.4rem, 3vw, 2.1rem)", lineHeight: 1.25, marginBottom: 14 }}>{point}</h2>
        {children && <div style={{ color: "var(--text-secondary, #b9b2a8)", lineHeight: 1.7, fontSize: "1.05rem" }}>{children}</div>}
      </div>
    </SectionReveal>
  );
}

export function NumberBlock({ fact, heading = "The biggest true number" }: { fact: Fact; heading?: string }) {
  return (
    <SectionReveal style={SECTION}>
      <div className="container-vault" style={{ maxWidth: 760 }}>
        <p style={{ letterSpacing: "0.14em", fontSize: "0.78rem", opacity: 0.7 }}>{heading.toUpperCase()}</p>
        <p style={{ fontSize: "clamp(2rem, 6vw, 3.6rem)", lineHeight: 1.1, margin: "8px 0", color: "var(--gold, #d4af37)" }}>
          {fact.value}
        </p>
        <p data-claim-label={fact.label} style={{ fontSize: "0.85rem", letterSpacing: "0.12em" }}>
          {fact.label}
        </p>
        <p style={{ lineHeight: 1.7, marginTop: 10 }}>{fact.note}</p>
        {fact.source && (
          <p style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: 8 }}>
            Source: {fact.sourceUrl ? <a href={fact.sourceUrl} rel="noopener noreferrer">{fact.source}</a> : fact.source}
          </p>
        )}
      </div>
    </SectionReveal>
  );
}

export function NextStep({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <SectionReveal style={SECTION}>
      <div className="container-vault" style={{ maxWidth: 760 }}>
        <h2 style={{ fontSize: "clamp(1.3rem, 2.6vw, 1.8rem)", marginBottom: 14 }}>{text}</h2>
        <p style={{ marginBottom: 18, opacity: 0.85 }}>Would it be okay if we showed you? A no is welcome.</p>
        <AnimatedButton href={href}>{label}</AnimatedButton>
      </div>
    </SectionReveal>
  );
}

export function CardGrid({ items }: { items: { href: string; title: string; text: string }[] }) {
  return (
    <SectionReveal style={SECTION}>
      <div className="container-vault" style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {items.map((i) => (
          <a key={i.href} href={i.href} style={{ display: "block", padding: 22, border: "1px solid rgba(212,175,55,0.25)", borderRadius: 16, background: "var(--vault-warm)", textDecoration: "none", color: "inherit" }}>
            <h3 style={{ fontSize: "1.2rem", marginBottom: 8 }}>{i.title}</h3>
            <p style={{ opacity: 0.8, lineHeight: 1.6 }}>{i.text}</p>
          </a>
        ))}
      </div>
    </SectionReveal>
  );
}

export function jsonLd(obj: unknown) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }} />;
}
