"use client";

/**
 * Nav — sticky top, reveals 800ms after first paint (MOT-10 compression
 * from prior 1700ms). After that, remains visible.
 *
 * MOT-01: under prefers-reduced-motion, Nav appears instantly — no fade.
 *
 * AES-07: Framer Motion cannot interpolate CSS var(--*) colour values
 * across keyframes. NavLink colour states read GOLD_BRIGHT/ICE/DIM from
 * lib/tokens.ts so the canonical palette has a single source of truth.
 */

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { GOLD_BRIGHT, ICE, DIM } from "@/lib/tokens";

const LINKS = [
  { label: "Free Scan", href: "/scan", external: false },
  { label: "Compliance", href: "/compliance", external: false },
  { label: "AI Implementation", href: "/ai-delivery", external: false },
  { label: "Methodology", href: "/methodology", external: false },
  {
    label: "Book a call",
    href: "https://cal.com/kyle-deligny-msvz6s/15min",
    external: true,
  },
];

const SESSION_KEY = "titanos.vault.entranceShown";
const REVEAL_DELAY_MS = 800;

export default function Nav() {
  const reduce = useReducedMotion();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (reduce) {
      setRevealed(true);
      return;
    }
    const already =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(SESSION_KEY) === "1";
    if (already) {
      setRevealed(true);
      return;
    }
    const t = window.setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [reduce]);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : -8 }}
      transition={{ duration: reduce ? 0 : 0.5, ease: [0, 0, 0.2, 1] }}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        padding: "20px",
        borderBottom: "1px solid var(--border)",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        className="container-vault"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Link
          href="/"
          aria-label="TITANOS home"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontWeight: 700,
            letterSpacing: "0.1em",
            fontSize: "var(--fs-lg)",
            textDecoration: "none",
          }}
        >
          TITANOS
        </Link>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 0 }}>
          {LINKS.map((l) => (
            <NavLink key={l.href} {...l} />
          ))}
        </div>
      </div>
    </motion.nav>
  );
}

function NavLink({
  label,
  href,
  external,
}: {
  label: string;
  href: string;
  external: boolean;
}) {
  const reduce = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [pulsed, setPulsed] = useState(false);

  const onClick = () => {
    if (reduce) return;
    setPulsed(true);
    window.setTimeout(() => setPulsed(false), 180);
  };

  const inner = (
    <motion.span
      animate={{ color: pulsed ? GOLD_BRIGHT : hovered ? ICE : DIM }}
      transition={{ duration: reduce ? 0 : 0.18 }}
      style={{
        position: "relative",
        display: "inline-block",
        fontSize: "var(--fs-sm)",
        fontFamily: "var(--font-body), system-ui, sans-serif",
      }}
    >
      {label}
      <motion.span
        aria-hidden="true"
        animate={{ width: hovered && !reduce ? "100%" : "0%" }}
        transition={{ duration: reduce ? 0 : 0.18, ease: [0.4, 0, 0.2, 1] }}
        style={{
          position: "absolute",
          left: 0,
          bottom: -3,
          height: 1,
          background: "var(--gold)",
        }}
      />
    </motion.span>
  );

  // A11Y-08 — 8px vertical + 4px horizontal padding lifts the link box
  // past WCAG 2.5.8 24×24 minimum at 375px without disturbing visual rhythm.
  const sharedProps = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onClick,
    style: {
      marginLeft: 24,
      padding: "8px 4px",
      display: "inline-block" as const,
      textDecoration: "none",
    } as const,
  };

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...sharedProps}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} {...sharedProps}>
      {inner}
    </Link>
  );
}
