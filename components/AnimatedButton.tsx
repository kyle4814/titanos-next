"use client";

/**
 * AnimatedButton — primary + secondary CTAs.
 *
 * MOT-01: under prefers-reduced-motion, proximity glow + sweep fill are
 *   skipped. Hover/focus colour transitions stay (CSS-driven, instantaneous
 *   feel is preserved).
 * MOT-05: external CTAs surface a "Opening…" microcopy + radial pulse
 *   for 600ms after click to acknowledge intent before the new tab
 *   opens (or before the mailto handler launches). Internal Next.js
 *   navigation skips this — the route transition itself is feedback.
 */

import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";

type Props = {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  onClick?: (e: ReactMouseEvent) => void;
  external?: boolean;
  ariaLabel?: string;
};

const OPENING_MS = 600;

export default function AnimatedButton({
  href,
  children,
  variant = "primary",
  className,
  onClick,
  external,
  ariaLabel,
}: Props) {
  if (variant === "secondary") {
    return (
      <SecondaryLink href={href} className={className} onClick={onClick} external={external}>
        {children}
      </SecondaryLink>
    );
  }
  return (
    <PrimaryCTA
      href={href}
      className={className}
      onClick={onClick}
      external={external}
      ariaLabel={ariaLabel}
    >
      {children}
    </PrimaryCTA>
  );
}

/* ─── Primary ─────────────────────────────────────────────────── */
function PrimaryCTA({
  href,
  children,
  className,
  onClick,
  external,
  ariaLabel,
}: {
  href?: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: ReactMouseEvent) => void;
  external?: boolean;
  ariaLabel?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);
  const [proximityActive, setProximityActive] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [opening, setOpening] = useState(false);
  // W4 Pillar 6 — magnetic pull (translate toward cursor within 80px)
  const [magnet, setMagnet] = useState({ x: 0, y: 0 });
  const sweepCtl = useAnimationControls();
  const scaleCtl = useAnimationControls();

  // proximity detection within 80px (skipped on reduce + coarse pointer)
  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return;
    }
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      const within = d < Math.max(r.width, r.height) / 2 + 80;
      setProximityActive(within);
      // Magnetic pull: scale 0 at edge of detection, max 8px at center.
      if (within) {
        const norm = Math.max(0, 1 - d / 120);
        setMagnet({ x: dx * 0.12 * norm, y: dy * 0.12 * norm });
      } else if (magnet.x !== 0 || magnet.y !== 0) {
        setMagnet({ x: 0, y: 0 });
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduce, magnet.x, magnet.y]);

  // sweep fill on hover enter / leave (skipped on reduce)
  useEffect(() => {
    if (reduce) return;
    if (hovered) {
      sweepCtl.start({
        clipPath: "inset(0% 0% 0% 0%)",
        transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
      });
    } else {
      sweepCtl.start({
        clipPath: "inset(0% 0% 0% 100%)",
        transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
      });
    }
  }, [hovered, reduce, sweepCtl]);

  // MOT-05 — is this CTA opening something off-site?
  // mailto: + tel: + external http(s) all qualify; internal Next.js routes do not.
  const opensOffSite =
    !!external ||
    !!href?.startsWith("mailto:") ||
    !!href?.startsWith("tel:") ||
    /^https?:\/\//i.test(href ?? "");

  const handleClick = (e: ReactMouseEvent) => {
    if (!reduce) {
      scaleCtl.start({
        scale: [1, 0.98, 1],
        transition: { duration: 0.18, ease: "easeOut" },
      });
      setFlashing(true);
      window.setTimeout(() => setFlashing(false), 320);
    }
    if (opensOffSite) {
      // MOT-05 microcopy + pulse, non-blocking. Browser opens the
      // destination in the background while the user sees feedback that
      // the click registered.
      setOpening(true);
      window.setTimeout(() => setOpening(false), OPENING_MS);
    }
    onClick?.(e);
  };

  const sharedStyle: CSSProperties = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    padding: "14px 28px",
    minHeight: 48,
    borderRadius: "var(--radius-sm)",
    border: `${proximityActive ? 1.5 : 1}px solid var(--gold)`,
    color: hovered ? "var(--vault-black)" : "var(--gold)",
    fontFamily: "var(--font-display), Georgia, serif",
    fontWeight: 400,
    fontStyle: "italic",
    fontSize: "var(--fs-sm)",
    letterSpacing: "0.08em",
    background: "transparent",
    cursor: "pointer",
    // Magnetic translate + colour/border/filter transitions.
    transition:
      "color 250ms ease, border-width 200ms ease, filter 200ms ease, transform 220ms cubic-bezier(0.4, 0, 0.2, 1)",
    transform: reduce ? undefined : `translate3d(${magnet.x}px, ${magnet.y}px, 0)`,
    filter: proximityActive
      ? "drop-shadow(0 0 12px rgb(var(--gold-rgb) / 0.45))"
      : "none",
    textTransform: "uppercase",
    textDecoration: "none",
  };

  const inner = (
    <>
      {/* sweep fill — kept under reduce (renders settled), animations skipped */}
      <motion.span
        aria-hidden="true"
        animate={sweepCtl}
        initial={
          reduce ? { clipPath: "inset(0% 0% 0% 100%)" } : { clipPath: "inset(0% 100% 0% 0%)" }
        }
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--gold)",
          zIndex: 0,
        }}
      />
      {/* radial flash on click (skipped on reduce) */}
      {flashing && !reduce && (
        <motion.span
          aria-hidden="true"
          initial={{ opacity: 0.6, scale: 0.4 }}
          animate={{ opacity: 0, scale: 1.8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle, rgb(var(--gold-rgb) / 0.5) 0%, transparent 70%)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      )}
      {/* MOT-05 — Opening pulse + label swap. Honours reduce by skipping
          the radial pulse but keeping the text change. */}
      <motion.span
        animate={scaleCtl}
        style={{ position: "relative", zIndex: 2, display: "inline-block" }}
      >
        {opening ? "Opening…" : children}
      </motion.span>
      {opening && !reduce && (
        <motion.span
          aria-hidden="true"
          initial={{ opacity: 0.5, scale: 0.4 }}
          animate={{ opacity: 0, scale: 1.5 }}
          transition={{ duration: OPENING_MS / 1000, ease: "easeOut" }}
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle, rgb(var(--gold-rgb) / 0.45) 0%, transparent 60%)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      )}
    </>
  );

  const combinedClassName = ["magnetic-button", className].filter(Boolean).join(" ");

  if (href) {
    return (
      <a
        ref={ref as React.RefObject<HTMLAnchorElement>}
        href={href}
        className={combinedClassName}
        data-touch="press"
        style={sharedStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
        aria-label={ariaLabel}
        aria-busy={opening || undefined}
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      className={combinedClassName}
      data-touch="press"
      style={sharedStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-busy={opening || undefined}
      type="button"
    >
      {inner}
    </button>
  );
}

/* ─── Secondary ───────────────────────────────────────────────── */
function SecondaryLink({
  href,
  children,
  className,
  onClick,
  external,
}: {
  href?: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: ReactMouseEvent) => void;
  external?: boolean;
}) {
  const reduce = useReducedMotion();
  const [hovered, setHovered] = useState(false);

  const body = (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: "var(--ice)",
        fontFamily: "var(--font-body), system-ui, sans-serif",
        fontSize: "var(--fs-sm)",
        letterSpacing: "0.02em",
      }}
    >
      <span style={{ position: "relative", display: "inline-block" }}>
        {children}
        <motion.span
          aria-hidden="true"
          animate={{ width: hovered && !reduce ? "100%" : "0%" }}
          transition={{ duration: reduce ? 0 : 0.18, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: "absolute",
            left: 0,
            bottom: -2,
            height: 1,
            background: "var(--ice)",
          }}
        />
      </span>
      <motion.span
        aria-hidden="true"
        animate={{ x: hovered && !reduce ? 4 : 0 }}
        transition={{ duration: reduce ? 0 : 0.18, ease: [0.4, 0, 0.2, 1] }}
      >
        →
      </motion.span>
    </span>
  );

  if (!href) {
    return (
      <button
        type="button"
        className={className}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onClick}
        style={{
          background: "none",
          border: 0,
          padding: 0,
          cursor: "pointer",
        }}
      >
        {body}
      </button>
    );
  }

  return (
    <a
      href={href}
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{ textDecoration: "none" }}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {body}
    </a>
  );
}
