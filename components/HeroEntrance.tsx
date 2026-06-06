"use client";

/**
 * HeroEntrance — runs the homepage hero choreography (~2s) on first visit per
 * session. On returning visits, snaps everything to its settled state.
 *
 * Timings:
 *   T=900ms : "TITANOS" wordmark fades in inside the frame at 0.4 opacity
 *   T=1100ms: wordmark snaps to opacity 1.0 + a gold underline draws L→R (400ms)
 *   T=1500ms: tagline fades up from 30px below (ice colour)
 *   T=1700ms: trust strip fades up (dimmer)
 *
 * NumberCounters inside the trust strip animate when scrolled into view —
 * here on the homepage they're already in view so they start once revealed.
 */

import { motion, useAnimationControls } from "framer-motion";
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
  const [phase, setPhase] = useState<"init" | "playing" | "done">("init");
  const wordmarkCtl = useAnimationControls();
  const underlineCtl = useAnimationControls();
  const taglineCtl = useAnimationControls();
  const trustCtl = useAnimationControls();

  useEffect(() => {
    const already =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(SESSION_KEY) === "1";

    if (already) {
      wordmarkCtl.set({ opacity: 1, y: 0 });
      underlineCtl.set({ width: "60%" });
      taglineCtl.set({ opacity: 1, y: 0 });
      trustCtl.set({ opacity: 1, y: 0 });
      setPhase("done");
      return;
    }

    let cancelled = false;
    const run = async () => {
      setPhase("playing");
      // Hide initially
      wordmarkCtl.set({ opacity: 0, y: 0 });
      underlineCtl.set({ width: "0%" });
      taglineCtl.set({ opacity: 0, y: 30 });
      trustCtl.set({ opacity: 0, y: 30 });

      // T=900ms — wordmark fades in to 0.4
      await new Promise((r) => setTimeout(r, 900));
      if (cancelled) return;
      await wordmarkCtl.start({
        opacity: 0.4,
        transition: { duration: 0.18, ease: "easeOut" },
      });

      // T=1100ms — wordmark snaps to 1.0 + underline draws L→R (400ms)
      await new Promise((r) => setTimeout(r, 200));
      if (cancelled) return;
      wordmarkCtl.start({
        opacity: 1,
        transition: { duration: 0.1, ease: "easeOut" },
      });
      underlineCtl.start({
        width: "60%",
        transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
      });

      // T=1500ms — tagline fades up
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;
      taglineCtl.start({
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
      });

      // T=1700ms — trust strip fades up
      await new Promise((r) => setTimeout(r, 200));
      if (cancelled) return;
      trustCtl.start({
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
      });

      // T=2000ms — done (VaultFrame settles itself; we don't need to coordinate
      // here because VaultFrame reads the same sessionStorage key independently)
      await new Promise((r) => setTimeout(r, 300));
      if (!cancelled) setPhase("done");
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [wordmarkCtl, underlineCtl, taglineCtl, trustCtl]);

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
        <motion.h1
          animate={wordmarkCtl}
          initial={false}
          style={{
            display: "inline-block",
            fontFamily: "'Cinzel', serif",
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
        </motion.h1>

        <motion.p
          animate={taglineCtl}
          initial={false}
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 300,
            fontSize: "var(--fs-h4)",
            color: "var(--ice)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto 18px",
            lineHeight: 1.5,
          }}
        >
          {tagline}
        </motion.p>

        <motion.div
          animate={trustCtl}
          initial={false}
          style={{
            display: "inline-block",
            fontFamily: "'Inter', sans-serif",
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
      {/* Track phase via a hidden node so future siblings can observe it if needed */}
      <span data-hero-phase={phase} hidden />
    </div>
  );
}
