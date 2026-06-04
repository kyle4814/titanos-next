"use client";

/**
 * CursorTrail — a 3px gold dot that follows the cursor with a spring lag.
 * Visible ONLY when hovering interactive elements (links, buttons, [role=button]).
 * Hidden on touch / coarse-pointer devices.
 */

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

const SPRING = { stiffness: 200, damping: 22, mass: 0.5 };

export default function CursorTrail() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, SPRING);
  const sy = useSpring(y, SPRING);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Hide on coarse pointer (touch)
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    const isInteractive = (el: EventTarget | null): boolean => {
      let node = el as HTMLElement | null;
      while (node && node !== document.body) {
        const tag = node.tagName;
        if (
          tag === "A" ||
          tag === "BUTTON" ||
          node.getAttribute?.("role") === "button" ||
          node.dataset?.interactive === "true"
        ) {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    const onMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setVisible(isInteractive(e.target));
    };
    const onLeave = () => setVisible(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [x, y]);

  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 6,
        height: 6,
        borderRadius: 999,
        background: "var(--gold)",
        boxShadow: "0 0 8px rgba(212,175,55,0.6)",
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
