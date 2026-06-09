"use client";

/**
 * HeroEntrance — homepage hero choreography.
 *
 * Timings (MOT-10 compressed 1700ms → 1000ms; original 900/1100/1500/1700
 * is documented in git history):
 *   T=100ms  : wordmark fades in to 0.4 opacity (180ms)
 *   T=300ms  : wordmark snaps to 1.0 + gold underline draws L→R (400ms)
 *   T=700ms  : tagline fades up from 30px below (500ms)
 *   T=900ms  : trust strip fades up (500ms)
 *   T=1400ms : choreography complete
 *
 * Returning visits snap to settled state via sessionStorage.
 *
 * MOT-01: under `prefers-reduced-motion: reduce`, skips the entire
 *   timeline and renders all four pieces at their settled values.
 *
 * A11Y-06: TITANOS wordmark is rendered as a styled <div role="img"
 *   aria-label="TITANOS"> so the page's <h1> is the tagline — the
 *   actual page topic for screen readers.
 */

import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";

const SESSION_KEY = "titanos.vault.entranceShown";

export default function HeroEntrance({
  wordmark,
  tagline,
  trust,
}: {
  wordmark: ReactNode;
  tagline: ReactNode;
  trust: ReactNode;
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"init" | "playing" | "done">("init");
  const wordmarkCtl = useAnimationControls();
  const underlineCtl = useAnimationControls();
  const taglineCtl = useAnimationControls();
  const trustCtl = useAnimationControls();

  useEffect(() => {
    const already =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(SESSION_KEY) === "1";

    const settle = () => {
      wordmarkCtl.set({ opacity: 1, y: 0 });
      underlineCtl.set({ width: "60%" });
      taglineCtl.set({ opacity: 1, y: 0 });
      trustCtl.set({ opacity: 1, y: 0 });
      setPhase("done");
    };

    // Skip the timeline entirely on reduced-motion + on returning visits.
    if (reduce || already) {
      settle();
      if (reduce && typeof window !== "undefined") {
        // Honour the session flag so subsequent navigations also skip.
        window.sessionStorage.setItem(SESSION_KEY, "1");
      }
      return;
    }

    let cancelled = false;
    const run = async () => {
      setPhase("playing");
      wordmarkCtl.set({ opacity: 0, y: 0 });
      underlineCtl.set({ width: "0%" });
      taglineCtl.set({ opacity: 0, y: 30 });
      trustCtl.set({ opacity: 0, y: 30 });

      // T=100ms — wordmark fades in to 0.4
      await new Promise((r) => setTimeout(r, 100));
      if (cancelled) return;
      await wordmarkCtl.start({
        opacity: 0.4,
        transition: { duration: 0.18, ease: "easeOut" },
      });

      // T=300ms — wordmark snaps to 1.0 + underline draws L→R (400ms)
      await new Promise((r) => setTimeout(r, 100));
      if (cancelled) return;
      wordmarkCtl.start({
        opacity: 1,
        transition: { duration: 0.1, ease: "easeOut" },
      });
      underlineCtl.start({
        width: "60%",
        transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
      });

      // T=700ms — tagline fades up
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;
      taglineCtl.start({
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
      });

      // T=900ms — trust strip fades up
      await new Promise((r) => setTimeout(r, 200));
      if (cancelled) return;
      trustCtl.start({
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
      });

      await new Promise((r) => setTimeout(r, 500));
      if (!cancelled) {
        setPhase("done");
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(SESSION_KEY, "1");
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [reduce, wordmarkCtl, underlineCtl, taglineCtl, trustCtl]);

  return (
    <div
      style={{
        textAlign: "center",
        padding: "var(--space-30) 20px var(--space-20)",
        position: "relative",
        zIndex: 2,
      }}
    >
      <div className="container-vault">
        {/* A11Y-06 — TITANOS wordmark as decorative image; tagline is the H1.
            Keeps the screen-reader page topic accurate (it's about what we
            sell, not the brand name; the brand is already in <title>). */}
        <motion.div
          role="img"
          aria-label="TITANOS"
          animate={wordmarkCtl}
          initial={false}
          style={{
            display: "inline-block",
            fontFamily: "var(--font-display), Georgia, serif",
            fontWeight: 900,
            color: "var(--gold)",
            letterSpacing: "0.08em",
            fontSize: "var(--fs-display)",
            lineHeight: 1,
            marginBottom: 18,
            position: "relative",
          }}
        >
          {wordmark}
          <motion.span
            aria-hidden="true"
            animate={underlineCtl}
            initial={false}
            style={{
              position: "absolute",
              left: "20%",
              bottom: -10,
              height: 2,
              background: "var(--gold)",
              transformOrigin: "left center",
            }}
          />
        </motion.div>

        <motion.h1
          animate={taglineCtl}
          initial={false}
          style={{
            fontFamily: "var(--font-body), system-ui, sans-serif",
            fontWeight: 300,
            fontSize: "var(--fs-h4)",
            color: "var(--ice)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto 18px",
            lineHeight: 1.5,
            /* H1 styling preserves the prior <p> appearance — the wordmark
               above remains visually largest, but the tagline is the
               semantic page topic. */
            letterSpacing: "0",
          }}
        >
          {tagline}
        </motion.h1>

        <motion.div
          animate={trustCtl}
          initial={false}
          style={{
            display: "inline-block",
            fontFamily: "var(--font-body), system-ui, sans-serif",
            fontSize: "var(--fs-sm)",
            color: "var(--dim)",
            maxWidth: "var(--maxw-prose)",
            margin: "12px auto 0",
            lineHeight: 1.6,
          }}
        >
          {trust}
        </motion.div>
      </div>
      <span data-hero-phase={phase} hidden />
    </div>
  );
}
