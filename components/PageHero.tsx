/**
 * PageHero — standardised hero shell for non-home pages.
 * Centred badge + h1 + tagline + sub paragraph + optional CTAs row.
 *
 * Entrance is a CSS keyframe (.ph-in in globals.css), not framer-motion: the old
 * initial="hidden" state shipped opacity:0 in the HTML, so the LCP text stayed invisible
 * until the JS bundle hydrated (mobile slow-4G LCP 4.4 s vs FCP 1.0 s). Same 20px rise,
 * 0.5 s, ease [0,0,0.2,1], same delays.
 */

import { type ReactNode } from "react";

export default function PageHero({
  badge,
  title,
  tagline,
  sub,
  children,
  trustLine,
}: {
  badge?: ReactNode;
  title: ReactNode;
  tagline?: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  trustLine?: ReactNode;
}) {
  return (
    <section
      style={{
        textAlign: "center",
        padding: "var(--space-30) 20px var(--space-20)",
        position: "relative",
        zIndex: 2,
      }}
    >
      <div className="container-vault">
        {badge && (
          <div
            className="ph-in"
            style={{
              animationDelay: "0s",
              display: "inline-block",
              border: "1px solid var(--gold-dim)",
              padding: "6px 16px",
              borderRadius: "var(--radius-lg)",
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "var(--fs-xs)",
              color: "var(--ice)",
              letterSpacing: "0.1em",
              marginBottom: 24,
              textTransform: "uppercase",
            }}
          >
            {badge}
          </div>
        )}
        <h1
          className="ph-in"
          style={{
            animationDelay: "0.05s",
            fontFamily: "var(--font-display), Georgia, serif",
            fontWeight: 700,
            fontSize: "var(--fs-h1)",
            color: "var(--gold)",
            letterSpacing: "0.04em",
            marginBottom: 18,
            lineHeight: 1.18,
          }}
        >
          {title}
        </h1>
        {tagline && (
          <p
            className="ph-in"
            style={{
              animationDelay: "0.1s",
              fontSize: "var(--fs-lg)",
              color: "var(--ice)",
              maxWidth: "var(--maxw-prose)",
              margin: "0 auto 16px",
              fontWeight: 300,
              lineHeight: 1.6,
            }}
          >
            {tagline}
          </p>
        )}
        {sub && (
          <p
            className="ph-in"
            style={{
              animationDelay: "0.15s",
              fontSize: "var(--fs-body)",
              color: "var(--dim)",
              maxWidth: "var(--maxw-prose)",
              margin: "0 auto 24px",
              lineHeight: 1.7,
            }}
          >
            {sub}
          </p>
        )}
        {children && (
          <div
            style={{
              marginTop: 24,
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              justifyContent: "center",
            }}
          >
            {children}
          </div>
        )}
        {trustLine && (
          <p
            className="ph-in"
            style={{
              animationDelay: "0.25s",
              fontSize: "var(--fs-sm)",
              color: "var(--dim)",
              maxWidth: "var(--maxw-prose)",
              margin: "26px auto 0",
              lineHeight: 1.7,
            }}
          >
            {trustLine}
          </p>
        )}
        <div
          aria-hidden="true"
          style={{
            width: 60,
            height: 2,
            background:
              "linear-gradient(90deg, transparent, var(--ice), transparent)",
            margin: "28px auto 0",
          }}
        />
      </div>
    </section>
  );
}
