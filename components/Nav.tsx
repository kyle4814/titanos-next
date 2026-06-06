"use client";

/**
 * Nav — sticky top, fades in 1700ms after first paint to allow the hero
 * entrance choreography to settle first. After that, it remains visible.
 *
 * Underline on hover grows left-to-right (180ms). Click pulses the link to
 * bright gold once before navigation.
 *
 * AES-07: Framer Motion cannot interpolate CSS var(--*) colour values
 * across keyframes — values are inlined at evaluation time. NavLink
 * colour states therefore read GOLD_BRIGHT/ICE/DIM from lib/tokens.ts so
 * the canonical palette has a single source of truth.
 */

import Link from "next/link";
import { motion } from "framer-motion";
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

export default function Nav() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const already =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(SESSION_KEY) === "1";
    if (already) {
      setRevealed(true);
      return;
    }
    const t = window.setTimeout(() => setRevealed(true), 1700);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : -8 }}
      transition={{ duration: 0.5, ease: [0, 0, 0.2, 1] }}
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
            fontFamily: "'Cinzel', serif",
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
  const [hovered, setHovered] = useState(false);
  const [pulsed, setPulsed] = useState(false);

  const onClick = () => {
    setPulsed(true);
    window.setTimeout(() => setPulsed(false), 180);
  };

  const inner = (
    <motion.span
      animate={{ color: pulsed ? GOLD_BRIGHT : hovered ? ICE : DIM }}
      transition={{ duration: 0.18 }}
      style={{
        position: "relative",
        display: "inline-block",
        fontSize: "var(--fs-sm)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {label}
      <motion.span
        aria-hidden="true"
        animate={{ width: hovered ? "100%" : "0%" }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
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

  // A11Y-08 — meet WCAG 2.5.8 24×24 minimum tap target at 375px viewport.
  // 8px vertical + 4px horizontal padding lifts the link box past 24px in
  // both dimensions; inline-block carries the padding into the hit area.
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
