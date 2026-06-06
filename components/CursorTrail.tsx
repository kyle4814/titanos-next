"use client";

/**
 * CursorTrail — a 6px gold dot that follows the cursor with a spring lag.
 * Visible ONLY when hovering interactive elements. Hidden on touch /
 * coarse-pointer devices.
 *
 * MOT-01: bails entirely under prefers-reduced-motion (dot never renders).
 * MOT-04: visibility is decided by event delegation on document.body via
 *   mouseover/mouseout + closest('a, button, [role="button"]') instead of
 *   walking ancestors on every mousemove. Saves hundreds of DOM walks/sec.
 */

import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

const SPRING = { stiffness: 200, damping: 22, mass: 0.5 };
const INTERACTIVE_SELECTOR = 'a, button, [role="button"], [data-interactive="true"]';

export default function CursorTrail() {
  const reduce = useReducedMotion();
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, SPRING);
  const sy = useSpring(y, SPRING);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reduce) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    const onMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };

    // Event delegation — fires when entering / leaving interactive subtrees,
    // not on every mousemove. Much cheaper than ancestor-walking.
    const onOver = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.(INTERACTIVE_SELECTOR)) setVisible(true);
    };
    const onOut = (e: MouseEvent) => {
      // relatedTarget is where the pointer is moving TO — if that's still
      // inside an interactive ancestor, stay visible.
      const r = e.relatedTarget as Element | null;
      if (!r?.closest?.(INTERACTIVE_SELECTOR)) setVisible(false);
    };
    const onLeave = () => setVisible(false);

    document.body.addEventListener("mouseover", onOver);
    document.body.addEventListener("mouseout", onOut);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    return () => {
      document.body.removeEventListener("mouseover", onOver);
      document.body.removeEventListener("mouseout", onOut);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [reduce, x, y]);

  if (reduce) return null;

  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 6,
        height: 6,
        borderRadius: "var(--radius-lg)",
        background: "var(--gold)",
        boxShadow: "0 0 8px rgb(var(--gold-rgb) / 0.6)",
        pointerEvents: "none",
        zIndex: 9999,
        x: sx,
        y: sy,
        translateX: "-50%",
        translateY: "-50%",
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease",
      }}
    />
  );
}
