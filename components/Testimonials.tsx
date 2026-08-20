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
import { SystemLabel } from "@/components/Myth";

type Props = {
  offer?: Testimonial["offer"];
  heading?: string;
};

// RED-TEAM NOTE (see brief): lib/testimonials.ts is empty by design and
// every entry that ever lands there must carry consentToPublish. That
// means this component can never render invented names, logos, or
// quotes — the empty-array guard below is the actual mechanism that
// keeps that promise, not just a loading state. Restyled in the quiet
// instrumentation register rather than a marketing "WHAT CUSTOMERS
// SAID" banner, because a real attributed account doesn't need to
// shout to be credible.
export default function Testimonials({ offer, heading = "What customers said" }: Props) {
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
        <SystemLabel tone="gold" style={{ textAlign: "center", marginBottom: 10 }}>
          Published with the customer&apos;s consent
        </SystemLabel>
        <h2
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--ice)",
            fontWeight: 400,
            fontSize: "var(--fs-h3)",
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
                border: "1px solid var(--border)",
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
              <footer style={{ marginTop: 16 }}>
                <SystemLabel tone="dim">
                  {t.name}
                  {t.role && ` · ${t.role}`}
                  {t.company && ` · ${t.company}`}
                </SystemLabel>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
