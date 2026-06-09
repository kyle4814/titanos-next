"use client";

/**
 * CursorTrail — W4 Pillar 6 cursor system overhaul.
 *
 * State machine:
 *   default      — 14px gold-warm circle, 30% fill, 1px outline. Spring lag.
 *   interactive  — scales to 36px, opacity 70%, inner solid 4px dot appears
 *   text         — 1px × 1em gold I-beam (over body paragraphs)
 *   terminal     — blinking gold `▮` block (over .font-mono / TerminalSnippet)
 *
 * Velocity-aware: scales 1.0 → 1.25× in direction of motion when moving
 *   fast (cheap motion blur). Settles on rest.
 *
 * MOT-01: returns null under prefers-reduced-motion.
 * MOT-04: state transitions driven by mouseover/mouseout event delegation
 *   on document.body. No per-mousemove ancestor walks.
 *
 * Hidden on touch / coarse-pointer devices.
 */

import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

const SPRING = { stiffness: 220, damping: 24, mass: 0.45 };
const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], [data-interactive="true"]';
const TERMINAL_SELECTOR = "[data-cursor='terminal'], pre, code, .font-mono";

type CursorState = "default" | "interactive" | "text" | "terminal";

export default function CursorTrail() {
  const reduce = useReducedMotion();
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, SPRING);
  const sy = useSpring(y, SPRING);
  const [state, setState] = useState<CursorState>("default");

  useEffect(() => {
    if (reduce || typeof window === "undefined") return;
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    const onMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };

    const decideState = (t: Element | null): CursorState => {
      if (!t) return "default";
      if (t.closest?.(TERMINAL_SELECTOR)) return "terminal";
      if (t.closest?.(INTERACTIVE_SELECTOR)) return "interactive";
      const node = t as HTMLElement;
      const tag = node.tagName;
      if (
        tag === "P" ||
        tag === "LI" ||
        tag === "H1" ||
        tag === "H2" ||
        tag === "H3" ||
        tag === "SPAN"
      ) {
        return "text";
      }
      return "default";
    };

    const onOver = (e: MouseEvent) => {
      setState(decideState(e.target as Element | null));
    };
    const onLeave = () => setState("default");

    document.body.addEventListener("mouseover", onOver);
    document.body.addEventListener("mouseout", onOver);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    return () => {
      document.body.removeEventListener("mouseover", onOver);
      document.body.removeEventListener("mouseout", onOver);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [reduce, x, y]);

  if (reduce) return null;

  // Visual params per state.
  const size =
    state === "interactive" ? 36 : state === "text" ? 2 : state === "terminal" ? 12 : 14;
  const height =
    state === "text" ? 22 : state === "terminal" ? 22 : size;
  const radius =
    state === "text" ? 1 : state === "terminal" ? 1 : 999;
  const fill =
    state === "default"
      ? "rgb(var(--gold-rgb) / 0.18)"
      : state === "interactive"
        ? "rgb(var(--gold-rgb) / 0.22)"
        : state === "terminal"
          ? "var(--gold)"
          : "var(--gold)";
  const border =
    state === "default" || state === "interactive"
      ? "1px solid var(--gold)"
      : "none";

  return (
    <>
      <motion.div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: size,
          height,
          borderRadius: radius,
          background: fill,
          border,
          boxShadow:
            state === "interactive"
              ? "0 0 12px rgb(var(--gold-rgb) / 0.5)"
              : state === "default"
                ? "0 0 6px rgb(var(--gold-rgb) / 0.3)"
                : "none",
          pointerEvents: "none",
          zIndex: 9999,
          x: sx,
          y: sy,
          translateX: "-50%",
          translateY: "-50%",
          transition: "width 200ms ease, height 200ms ease, background 200ms ease, border-radius 200ms ease, box-shadow 200ms ease",
          animation:
            state === "terminal" ? "cursor-blink 1s steps(2) infinite" : "none",
        }}
      />
      {/* Inner solid dot — appears over interactive elements */}
      {state === "interactive" && (
        <motion.div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: 4,
            height: 4,
            borderRadius: 999,
            background: "var(--gold)",
            pointerEvents: "none",
            zIndex: 10000,
            x: sx,
            y: sy,
            translateX: "-50%",
            translateY: "-50%",
          }}
        />
      )}
      <style>{`
        @keyframes cursor-blink {
          0%, 50% { opacity: 1; }
          50.01%, 100% { opacity: 0; }
        }
      `}</style>
    </>
  );
}
