/**
 * Testimonials — render block.
 *
 * Renders nothing while lib/testimonials.ts holds an empty array.
 * Once one or more entries are added with explicit publication
 * consent, this surfaces them as a single uniform card grid below
 * the page's main CTA cluster.
 *
 * Filtering by offer keeps the /compliance page showing only
 * compliance testimonials, /scan showing only scan ones, etc.
 */

import { TESTIMONIALS, type Testimonial } from "@/lib/testimonials";

type Props = {
  offer?: Testimonial["offer"];
  heading?: string;
};

export default function Testimonials({ offer, heading = "WHAT CUSTOMERS SAID" }: Props) {
  const items = offer ? TESTIMONIALS.filter((t) => t.offer === offer) : TESTIMONIALS;
  if (items.length === 0) return null;

  return (
    <section
      data-analytics="testimonials"
      style={{
        padding: "var(--space-20) 20px",
        position: "relative",
        zIndex: 2,
      }}
    >
      <div className="container-vault">
        <h2
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h2)",
            letterSpacing: "0.06em",
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          {heading}
        </h2>
        <div
          className="grid-auto-cards"
          style={{ gap: 22, maxWidth: "var(--maxw-wide)", margin: "0 auto" }}
        >
          {items.map((t) => (
            <article
              key={`${t.company}-${t.name}`}
              style={{
                background: "var(--card)",
                border: "1px solid var(--gold-dim)",
                borderRadius: "var(--radius-md)",
                padding: "28px 26px",
              }}
            >
              <blockquote
                style={{
                  color: "var(--text)",
                  fontSize: "var(--fs-body)",
                  lineHeight: 1.7,
                  margin: 0,
                  fontStyle: "italic",
                }}
              >
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <footer
                style={{
                  marginTop: 14,
                  color: "var(--ice)",
                  fontSize: "var(--fs-sm)",
                  fontFamily: "var(--font-body), system-ui, sans-serif",
                }}
              >
                <strong style={{ color: "var(--gold)" }}>{t.name}</strong>
                {t.role && <> · {t.role}</>}
                {t.company && <> · {t.company}</>}
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
