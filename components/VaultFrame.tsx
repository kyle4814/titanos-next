"use client";

/**
 * VaultFrame — the two persistent 1px gold horizontal lines that frame
 * every page.
 *
 * On the homepage's first visit per session, the lines play the hero
 * entrance choreography (single line splits into two). On returning visits
 * + every other page, lines render directly at the resting "vault frame"
 * position (8vh from top + 8vh from bottom, 20% opacity).
 *
 * MOT-01: under prefers-reduced-motion the entrance is skipped — lines
 *   render at the settled position immediately.
 *
 * MOT-02: the scroll-driven 1vh contract was DROPPED. It animated `top`
 *   (a layout-triggering property) every scroll event for a visually
 *   imperceptible 8px shift — net cost > benefit.
 */

import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

const SESSION_KEY = "titanos.vault.entranceShown";

export default function VaultFrame({ playEntrance = false }: { playEntrance?: boolean }) {
  const reduce = useReducedMotion();
  const topCtl = useAnimationControls();
  const bottomCtl = useAnimationControls();
  const settled = useRef(false);

  useEffect(() => {
    const alreadyPlayed =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(SESSION_KEY) === "1";

    const shouldPlay = playEntrance && !alreadyPlayed && !reduce;

    if (!shouldPlay) {
      topCtl.set({ top: "8vh", opacity: 0.2 });
      bottomCtl.set({ top: "92vh", opacity: 0.2 });
      settled.current = true;
      if (reduce && typeof window !== "undefined") {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      }
      return;
    }

    topCtl.set({ top: "50vh", opacity: 0 });
    bottomCtl.set({ top: "50vh", opacity: 0 });

    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 200));
      if (cancelled) return;
      await Promise.all([
        topCtl.start({ opacity: 0.8, transition: { duration: 0.2, ease: "easeOut" } }),
        bottomCtl.start({ opacity: 0.8, transition: { duration: 0.2, ease: "easeOut" } }),
      ]);

      await new Promise((r) => setTimeout(r, 100));
      if (cancelled) return;
      await Promise.all([
        topCtl.start({ top: "30vh", transition: { duration: 0.8, ease: "easeOut" } }),
        bottomCtl.start({ top: "55vh", transition: { duration: 0.8, ease: "easeOut" } }),
      ]);

      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;
      await Promise.all([
        topCtl.start({
          top: "8vh",
          opacity: 0.2,
          transition: { duration: 0.6, ease: "easeOut" },
        }),
        bottomCtl.start({
          top: "92vh",
          opacity: 0.2,
          transition: { duration: 0.6, ease: "easeOut" },
        }),
      ]);

      if (!cancelled) {
        window.sessionStorage.setItem(SESSION_KEY, "1");
        settled.current = true;
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [reduce, playEntrance, topCtl, bottomCtl]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        viewTransitionName: "vault-frame",
      }}
    >
      <motion.div
        animate={topCtl}
        initial={false}
        style={{
          position: "absolute",
          left: 0,
          width: "100%",
          height: "1px",
          background: "var(--gold)",
          opacity: 0,
        }}
      />
      <motion.div
        animate={bottomCtl}
        initial={false}
        style={{
          position: "absolute",
          left: 0,
          width: "100%",
          height: "1px",
          background: "var(--gold)",
          opacity: 0,
        }}
      />
    </div>
  );
}
