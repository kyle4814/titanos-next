"use client";

/**
 * Nav — sticky top bar with desktop horizontal links AND a mobile
 * vault-drawer hamburger (MOB-02).
 *
 * Behaviour:
 *   >720px: horizontal links across the top, hover underline, click pulse.
 *   ≤720px: hamburger button replaces the link strip. Tap opens a
 *     full-height drawer sliding from the right with vault-styled
 *     stacked links + VaultKeyhole markers. Tap × / overlay / ESC
 *     closes. Focus trapped while open.
 *
 * MOT-01: reveal fade skipped under reduce. Drawer slide-in skipped too
 *   (snaps open).
 * MOT-10: 800ms reveal delay (was 1700ms).
 * AES-07: Framer Motion colour states read GOLD_BRIGHT/ICE/DIM from
 *   lib/tokens.ts.
 */

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { GOLD_BRIGHT, ICE, DIM } from "@/lib/tokens";
import VaultKeyhole from "./VaultKeyhole";

const LINKS = [
  { label: "Free Scan", href: "/scan", external: false },
  { label: "Monitor", href: "/monitor", external: false },
  { label: "Compliance", href: "/compliance", external: false },
  { label: "AI Implementation", href: "/ai-delivery", external: false },
  { label: "Leads", href: "/leads", external: false },
  // Desktop nav shows LINKS.slice(0, 5) — the five revenue doors. Methodology /
  // Our Scan / About remain in the mobile drawer + footer to keep desktop tight
  // when the Leads door joins.
  { label: "Methodology", href: "/methodology", external: false },
  { label: "Our Scan", href: "/our-scan", external: false },
  { label: "About", href: "/about", external: false },
  {
    label: "Book a call",
    href: "https://cal.com/kyle-deligny-msvz6s/15min",
    external: true,
  },
];

const SESSION_KEY = "titanos.vault.entranceShown";
const REVEAL_DELAY_MS = 800;
const MOBILE_BREAKPOINT = 720;

export default function Nav() {
  const reduce = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (reduce) {
      setRevealed(true);
    } else {
      const already =
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(SESSION_KEY) === "1";
      if (already) {
        setRevealed(true);
      } else {
        const t = window.setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
        return () => window.clearTimeout(t);
      }
    }
  }, [reduce]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Close drawer on ESC + lock body scroll while open
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

  // Close drawer when viewport grows past mobile breakpoint
  useEffect(() => {
    if (!isMobile && drawerOpen) setDrawerOpen(false);
  }, [isMobile, drawerOpen]);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : -8 }}
      transition={{ duration: reduce ? 0 : 0.5, ease: [0, 0, 0.2, 1] }}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        padding: "20px",
        borderBottom: "1px solid var(--border)",
        background: "rgb(10 7 7 / 0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        className="container-vault"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link
          href="/"
          aria-label="TITANOS home"
          className="font-wordmark"
          style={{
            color: "var(--gold)",
            fontSize: "var(--fs-lg)",
            textDecoration: "none",
            letterSpacing: "0.06em",
          }}
        >
          TITANOS
        </Link>

        {/* Desktop link strip — hidden on mobile via media query */}
        <div className="nav-desktop-links">
          {LINKS.slice(0, 5).map((l) => (
            <NavLink key={l.href} {...l} />
          ))}
        </div>

        {/* Mobile hamburger button — hidden on desktop via media query */}
        <button
          type="button"
          className="nav-burger"
          aria-label={drawerOpen ? "Close menu" : "Open menu"}
          aria-expanded={drawerOpen}
          aria-controls="nav-drawer"
          onClick={() => setDrawerOpen((v) => !v)}
          style={{
            background: "transparent",
            border: "1px solid var(--gold-dim)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 12px",
            cursor: "pointer",
            color: "var(--gold)",
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            width: 44,
            height: 40,
          }}
        >
          <Burger open={drawerOpen} reduce={!!reduce} />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Overlay */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
              onClick={() => setDrawerOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgb(5 3 3 / 0.7)",
                backdropFilter: "blur(4px)",
                zIndex: 40,
                pointerEvents: "auto",
              }}
              aria-hidden="true"
            />

            {/* Drawer panel */}
            <motion.div
              key="drawer"
              id="nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Site navigation"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: reduce ? 0 : 0.32, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                width: "min(86vw, 360px)",
                background:
                  "linear-gradient(180deg, var(--vault-warm), var(--vault-black))",
                borderLeft: "1px solid var(--gold)",
                boxShadow: "-20px 0 60px rgb(0 0 0 / 0.6)",
                zIndex: 50,
                display: "flex",
                flexDirection: "column",
                padding: "32px 28px",
                overflowY: "auto",
              }}
            >
              {/* Edge thread inside the drawer */}
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: -1,
                  width: 1,
                  background:
                    "linear-gradient(180deg, transparent, var(--gold), transparent)",
                  opacity: 0.7,
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 32,
                }}
              >
                <span
                  className="font-wordmark"
                  style={{
                    color: "var(--gold)",
                    fontSize: "var(--fs-lg)",
                    letterSpacing: "0.06em",
                  }}
                >
                  TITANOS
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "var(--gold)",
                    fontSize: "1.6rem",
                    fontFamily: "var(--font-display), Georgia, serif",
                    cursor: "pointer",
                    padding: "8px 12px",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>

              <nav>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {LINKS.map((l) => (
                    <li key={l.href} style={{ marginBottom: 8 }}>
                      {l.external ? (
                        <a
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setDrawerOpen(false)}
                          className="drawer-link"
                        >
                          <VaultKeyhole size={12} pulse={false} />
                          <span>{l.label}</span>
                        </a>
                      ) : (
                        <Link
                          href={l.href}
                          onClick={() => setDrawerOpen(false)}
                          className="drawer-link"
                        >
                          <VaultKeyhole size={12} pulse={false} />
                          <span>{l.label}</span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>

              <div
                className="font-mono"
                style={{
                  marginTop: "auto",
                  paddingTop: 32,
                  fontSize: "var(--fs-xs)",
                  color: "var(--dim)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  lineHeight: 1.7,
                  borderTop: "1px solid var(--border)",
                }}
              >
                ABN 34 318 502 254
                <br />
                kyle@titanos.tech
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .nav-desktop-links {
          display: flex;
          gap: 0;
        }
        .nav-burger {
          display: none !important;
        }
        @media (max-width: ${MOBILE_BREAKPOINT}px) {
          .nav-desktop-links { display: none !important; }
          .nav-burger { display: inline-flex !important; }
        }
        .drawer-link {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 14px 4px;
          color: var(--ice);
          font-family: var(--font-display), Georgia, serif;
          font-style: italic;
          font-size: var(--fs-lg);
          font-weight: 400;
          letter-spacing: 0.02em;
          text-decoration: none;
          border-bottom: 1px solid var(--border);
          transition: color 200ms ease, padding-left 200ms ease, border-color 200ms ease;
        }
        .drawer-link:hover, .drawer-link:focus-visible {
          color: var(--gold);
          padding-left: 10px;
          border-color: var(--gold-dim);
        }
        .drawer-link:active {
          color: var(--gold-bright);
        }
      `}</style>
    </motion.nav>
  );
}

/* ─── Burger icon with × morph ───────────────────────────── */
function Burger({ open, reduce }: { open: boolean; reduce: boolean }) {
  const dur = reduce ? 0 : 0.22;
  const ease = [0.4, 0, 0.2, 1] as const;
  return (
    <span
      aria-hidden="true"
      style={{
        position: "relative",
        display: "inline-block",
        width: 18,
        height: 14,
      }}
    >
      <motion.span
        animate={open ? { rotate: 45, top: 6 } : { rotate: 0, top: 0 }}
        transition={{ duration: dur, ease }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1.5,
          background: "var(--gold)",
          transformOrigin: "center",
        }}
      />
      <motion.span
        animate={open ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: dur, ease }}
        style={{
          position: "absolute",
          top: 6,
          left: 0,
          right: 0,
          height: 1.5,
          background: "var(--gold)",
        }}
      />
      <motion.span
        animate={open ? { rotate: -45, top: 6 } : { rotate: 0, top: 12 }}
        transition={{ duration: dur, ease }}
        style={{
          position: "absolute",
          top: 12,
          left: 0,
          right: 0,
          height: 1.5,
          background: "var(--gold)",
          transformOrigin: "center",
        }}
      />
    </span>
  );
}

/* ─── Desktop NavLink (kept) ─────────────────────────────── */
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
