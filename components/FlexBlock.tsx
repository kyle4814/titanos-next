import type { Flex } from "@/lib/flex";
import SectionReveal from "@/components/SectionReveal";

/** One big true number, its label, the analogy that makes it felt, and its source one tap away. */
export function FlexNumber({ f }: { f: Flex }) {
  return (
    <figure
      style={{
        margin: 0,
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "24px 24px 20px",
      }}
    >
      <p className="font-mono" style={{ color: "var(--gold-dim)", fontSize: "var(--fs-xs)", letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 8px" }}>
        {f.kind}
      </p>
      <p style={{ fontFamily: "var(--font-display), Georgia, serif", color: "var(--gold)", fontSize: "var(--fs-h3, 1.6rem)", lineHeight: 1.2, margin: "0 0 8px" }}>
        {f.big}
      </p>
      <p style={{ color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.55, margin: "0 0 10px", fontWeight: 600 }}>{f.label}</p>
      <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.65, margin: "0 0 12px" }}>{f.analogy}</p>
      <details>
        <summary style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", cursor: "pointer" }}>Where this number comes from</summary>
        <figcaption style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", lineHeight: 1.6, marginTop: 8 }}>{f.source}</figcaption>
      </details>
    </figure>
  );
}

export function FlexGrid({ items }: { items: Flex[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, maxWidth: "var(--maxw-wide)", margin: "0 auto" }}>
      {items.map((f) => (
        <FlexNumber key={f.big + f.label} f={f} />
      ))}
    </div>
  );
}

/** The open loop between sections: a question the next section answers. Curiosity, never a countdown. */
export function OpenLoop({ children }: { children: React.ReactNode }) {
  return (
    <SectionReveal style={{ padding: "var(--space-8, 40px) 20px 0", position: "relative", zIndex: 2 }}>
      <p style={{ color: "var(--gold)", fontStyle: "italic", fontFamily: "var(--font-display), Georgia, serif", fontSize: "var(--fs-lg)", textAlign: "center", maxWidth: "var(--maxw-prose)", margin: "0 auto", lineHeight: 1.6 }}>
        {children}
      </p>
    </SectionReveal>
  );
}
