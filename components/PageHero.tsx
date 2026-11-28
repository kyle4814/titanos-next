/**
 * PageHero — standardised hero shell for non-home pages (obsidian + gold, styled by .pe-pagehero in app/site-system.css).
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
    <section className="pe-pagehero" style={{ position: "relative", zIndex: 2 }}>
      <div className="pe-page">
        {badge && (
          <div className="pe-pagehero__badge ph-in" style={{ animationDelay: "0s" }}>
            {badge}
          </div>
        )}
        <h1 className="ph-in" style={{ animationDelay: "0.05s" }}>
          {title}
        </h1>
        {tagline && (
          <p className="pe-pagehero__tagline ph-in" style={{ animationDelay: "0.1s", textWrap: "pretty" }}>
            {tagline}
          </p>
        )}
        {sub && (
          <p className="pe-pagehero__sub ph-in" style={{ animationDelay: "0.15s" }}>
            {sub}
          </p>
        )}
        {children && <div className="pe-pagehero__cta ph-cta">{children}</div>}
        {trustLine && (
          <p className="pe-pagehero__trust ph-in" style={{ animationDelay: "0.25s" }}>
            {trustLine}
          </p>
        )}
        <div aria-hidden="true" className="pe-pagehero__rule" />
      </div>
    </section>
  );
}
