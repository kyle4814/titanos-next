"use client";

/**
 * VaultFrame — the two persistent 1px gold horizontal lines that frame every page.
 *
 * On the homepage's first visit per session, the lines play the hero entrance
 * choreography (single line splits into two). On all other pages (and on
 * returning visits to the homepage) the lines render directly in their resting
 * "vault frame" position at 8vh from top + 8vh from bottom, 20% opacity.
 *
 * The frame is `position: fixed` so it scrolls with the page as a visual
 * constant. On scroll past hero (>= 60vh) the frame contracts 1vh inward.
 *
 * `view-transition-name: vault-frame` makes the frame persist across route
 * changes via the native View Transitions API (see globals.css).
 */

import { motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const SESSION_KEY = "titanos.vault.entranceShown";

export default function VaultFrame({ playEntrance = false }: { playEntrance?: boolean }) {
  const topCtl = useAnimationControls();
  const bottomCtl = useAnimationControls();
  const [contracted, setContracted] = useState(false);
  const settled = useRef(false);

  useEffect(() => {
    // Settle straight to resting position if entrance was already played this
    // session (or if the page doesn't ask for entrance).
    const alreadyPlayed =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(SESSION_KEY) === "1";

    const shouldPlay = playEntrance && !alreadyPlayed;

    if (!shouldPlay) {
      topCtl.set({ top: "8vh", opacity: 0.2 });
      bottomCtl.set({ top: "92vh", opacity: 0.2 });
      settled.current = true;
      return;
    }

    // Hero entrance choreography
    // T=0   : both lines hidden
    // T=200 : a single 1px line fades in dead-centre (we place top line at 50vh)
    // T=500 : top travels to 30vh, bottom to 55vh over 800ms ease-out
    // T=2000: both fade to 20% opacity and stay at 8vh / 92vh as resting frame
    topCtl.set({ top: "50vh", opacity: 0 });
    bottomCtl.set({ top: "50vh", opacity: 0 });

    let cancelled = false;
    const run = async () => {
      // T=200ms — single line fades in (both controls are at the same y, so
      // visually it reads as one line)
      await new Promise((r) => setTimeout(r, 200));
      if (cancelled) return;
      await Promise.all([
        topCtl.start({ opacity: 0.8, transition: { duration: 0.2, ease: "easeOut" } }),
        bottomCtl.start({ opacity: 0.8, transition: { duration: 0.2, ease: "easeOut" } }),
      ]);

      // T=500ms — line splits: top to 30vh, bottom to 55vh (800ms ease-out)
      await new Promise((r) => setTimeout(r, 100));
      if (cancelled) return;
      await Promise.all([
        topCtl.start({ top: "30vh", transition: { duration: 0.8, ease: "easeOut" } }),
        bottomCtl.start({ top: "55vh", transition: { duration: 0.8, ease: "easeOut" } }),
      ]);

      // T=2000ms — settle to vault frame resting position
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
  }, [playEntrance, topCtl, bottomCtl]);

  // Scroll-driven contract: 1vh inward past 60vh
  useEffect(() => {
    const onScroll = () => {
      if (!settled.current) return;
      const scrolled = window.scrollY;
      const contractNow = scrolled > window.innerHeight * 0.6;
      if (contractNow !== contracted) {
        setContracted(contractNow);
        topCtl.start({
          top: contractNow ? "9vh" : "8vh",
          transition: { duration: 0.4, ease: "easeOut" },
        });
        bottomCtl.start({
          top: contractNow ? "91vh" : "92vh",
          transition: { duration: 0.4, ease: "easeOut" },
        });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [contracted, topCtl, bottomCtl]);

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
