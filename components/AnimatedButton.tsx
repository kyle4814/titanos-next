"use client";

/**
 * AnimatedButton — primary + secondary CTAs with full Vault micro-interactions.
 *
 * Primary:
 *  - default: 1px gold border, transparent fill, gold text, Cinzel
 *  - cursor within 80px: border 1.5px + drop-shadow glow (200ms)
 *  - cursor enters: gold fill sweeps in from left → right via conic-gradient
 *    over 250ms; text colour interpolates to black at midpoint
 *  - cursor leaves: reverse sweep right → left over 200ms
 *  - click: scale to 0.98 (100ms) + gold radial flash 300ms
 *
 * Secondary (`variant="secondary"`):
 *  - "Learn more →" style; underline 0 → 100% width L→R on hover (180ms),
 *    arrow slides 4px right.
 *
 * Renders as <a> if `href` is supplied, otherwise <button>.
 */

import { motion, useAnimationControls } from "framer-motion";
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
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);
  const [proximityActive, setProximityActive] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const sweepCtl = useAnimationControls();
  const scaleCtl = useAnimationControls();

  // proximity detection within 80px
  useEffect(() => {
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
      const d = Math.hypot(e.clientX - cx, e.clientY - cy);
      const within = d < Math.max(r.width, r.height) / 2 + 80;
      setProximityActive(within);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // sweep fill on hover enter / leave
  useEffect(() => {
    if (hovered) {
      sweepCtl.start({
        // left-to-right fill
        clipPath: "inset(0% 0% 0% 0%)",
        transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
      });
    } else {
      sweepCtl.start({
        // reverse right-to-left (clip from the right edge inward)
        clipPath: "inset(0% 0% 0% 100%)",
        transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
      });
    }
  }, [hovered, sweepCtl]);

  const handleClick = (e: ReactMouseEvent) => {
    scaleCtl.start({
      scale: [1, 0.98, 1],
      transition: { duration: 0.18, ease: "easeOut" },
    });
    setFlashing(true);
    window.setTimeout(() => setFlashing(false), 320);
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
    borderRadius: 3,
    border: `${proximityActive ? 1.5 : 1}px solid var(--gold)`,
    color: hovered ? "var(--black)" : "var(--gold)",
    fontFamily: "'Cinzel', serif",
    fontWeight: 700,
    fontSize: "0.82rem",
    letterSpacing: "0.08em",
    background: "transparent",
    cursor: "pointer",
    transition: "color 250ms ease, border-width 200ms ease, filter 200ms ease",
    filter: proximityActive ? "drop-shadow(0 0 8px rgba(212,175,55,0.3))" : "none",
    textTransform: "uppercase",
    textDecoration: "none",
  };

  const inner = (
    <>
      {/* sweep fill */}
      <motion.span
        aria-hidden="true"
        animate={sweepCtl}
        initial={{ clipPath: "inset(0% 100% 0% 0%)" }}
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--gold)",
          zIndex: 0,
        }}
      />
      {/* radial flash on click */}
      {flashing && (
        <motion.span
          aria-hidden="true"
          initial={{ opacity: 0.6, scale: 0.4 }}
          animate={{ opacity: 0, scale: 1.8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle, rgba(212,175,55,0.5) 0%, transparent 70%)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      )}
      <motion.span
        animate={scaleCtl}
        style={{ position: "relative", zIndex: 2, display: "inline-block" }}
      >
        {children}
      </motion.span>
    </>
  );

  if (href) {
    return (
      <a
        ref={ref as React.RefObject<HTMLAnchorElement>}
        href={href}
        className={className}
        style={sharedStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
        aria-label={ariaLabel}
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
      className={className}
      style={sharedStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      aria-label={ariaLabel}
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
  const [hovered, setHovered] = useState(false);

  const body = (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: "var(--ice)",
        fontFamily: "'Inter', sans-serif",
        fontSize: "0.85rem",
        letterSpacing: "0.02em",
      }}
    >
      <span style={{ position: "relative", display: "inline-block" }}>
        {children}
        <motion.span
          aria-hidden="true"
          animate={{ width: hovered ? "100%" : "0%" }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
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
        animate={{ x: hovered ? 4 : 0 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
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
