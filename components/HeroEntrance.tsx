"use client";

/**
 * HeroEntrance — W4 Pillar 4 cinematic.
 *
 * Sequence (~4 seconds total):
 *   T=0     : page loads, VaultFrame entrance plays in parallel
 *   T=100ms : HeroDustBurst particle spray begins from page centre
 *   T=1400ms: wordmark glows in through the dust (blur 8 → 0, opacity
 *             0 → 1 over 1s)
 *   T=2400ms: wordmark fully visible; particles 80%+ dissipated
 *   T=2500ms: gold underline draws L→R (400ms)
 *   T=2900ms: tagline types in (35 char/sec, gold blinking caret)
 *   T=3500ms: trust strip fades up
 *
 * Returning visits + reduce-motion: snap to settled state immediately.
 *
 * A11Y-06: TITANOS wordmark is decorative div role="img" aria-label;
 *   the tagline is the page <h1>.
 */

import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import HeroDustBurst from "./HeroDustBurst";

const SESSION_KEY = "titanos.vault.entranceShown";

function useTypewriter(
  target: string,
  startAtMs: number,
  msPerChar: number,
  enabled: boolean
) {
  const [text, setText] = useState(enabled ? "" : target);

  useEffect(() => {
    if (!enabled) {
      setText(target);
      return;
    }
    let cancelled = false;
    let timeout = 0;
    const startTimeout = window.setTimeout(() => {
      let i = 0;
      const tick = () => {
        if (cancelled) return;
        i++;
        setText(target.slice(0, i));
        if (i < target.length) {
          const ch = target[i - 1];
          const delay = ch === "." || ch === "—" || ch === "," ? msPerChar * 3 : msPerChar;
          timeout = window.setTimeout(tick, delay);
        }
      };
      tick();
    }, startAtMs);
    return () => {
      cancelled = true;
      window.clearTimeout(startTimeout);
      window.clearTimeout(timeout);
    };
  }, [target, startAtMs, msPerChar, enabled]);

  return text;
}

export default function HeroEntrance({
  wordmark,
  tagline,
  trust,
}: {
  wordmark: ReactNode;
  tagline: string;
  trust: ReactNode;
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"init" | "playing" | "done">("init");
  const [shouldPlay, setShouldPlay] = useState(false);
  const wordmarkCtl = useAnimationControls();
  const underlineCtl = useAnimationControls();
  const trustCtl = useAnimationControls();

  const taglineText = useTypewriter(tagline, 2900, 35, shouldPlay && !reduce);

  useEffect(() => {
    const already =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(SESSION_KEY) === "1";

    const settle = () => {
      wordmarkCtl.set({ opacity: 1, filter: "blur(0px)" });
      underlineCtl.set({ width: "60%" });
      trustCtl.set({ opacity: 1, y: 0 });
      setPhase("done");
      setShouldPlay(false);
    };

    if (reduce || already) {
      settle();
      if (reduce && typeof window !== "undefined") {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      }
      return;
    }

    setShouldPlay(true);
    let cancelled = false;
    const run = async () => {
      setPhase("playing");
      wordmarkCtl.set({ opacity: 0, filter: "blur(8px)" });
      underlineCtl.set({ width: "0%" });
      trustCtl.set({ opacity: 0, y: 20 });

      await new Promise((r) => setTimeout(r, 1400));
      if (cancelled) return;
      wordmarkCtl.start({
        opacity: 1,
        filter: "blur(0px)",
        transition: { duration: 1.0, ease: [0.4, 0, 0.2, 1] },
      });

      await new Promise((r) => setTimeout(r, 1100));
      if (cancelled) return;
      underlineCtl.start({
        width: "60%",
        transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
      });

      await new Promise((r) => setTimeout(r, 1000));
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
  }, [reduce, wordmarkCtl, underlineCtl, trustCtl]);

  return (
    <div
      style={{
        textAlign: "center",
        padding: "var(--space-30) 20px var(--space-20)",
        position: "relative",
        zIndex: 2,
        minHeight: "60vh",
      }}
    >
      {shouldPlay && !reduce && <HeroDustBurst />}

      <div
        className="container-vault"
        style={{ position: "relative", zIndex: 3 }}
      >
        <motion.div
          role="img"
          aria-label="TITANOS"
          animate={wordmarkCtl}
          initial={false}
          className="font-wordmark"
          style={{
            display: "inline-block",
            color: "var(--gold)",
            letterSpacing: "0.06em",
            fontSize: "var(--fs-display)",
            lineHeight: 1,
            marginBottom: 18,
            position: "relative",
            textShadow: "0 0 30px rgb(var(--gold-rgb) / 0.25)",
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
              background:
                "linear-gradient(90deg, var(--gold-warm), var(--gold), var(--gold-spec))",
              transformOrigin: "left center",
            }}
          />
        </motion.div>

        <h1
          style={{
            fontFamily: "var(--font-body), system-ui, sans-serif",
            fontWeight: 300,
            fontSize: "var(--fs-h4)",
            color: "var(--ice)",
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto 18px",
            lineHeight: 1.5,
            minHeight: "calc(var(--fs-h4) * 3.2)",
            letterSpacing: "0",
          }}
        >
          {taglineText}
          {shouldPlay && taglineText.length < tagline.length && !reduce && (
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 8,
                height: "1em",
                marginLeft: 2,
                background: "var(--gold)",
                verticalAlign: "text-bottom",
                animation: "vault-caret 1s steps(2) infinite",
              }}
            />
          )}
        </h1>

        <motion.div
          animate={trustCtl}
          initial={false}
          className="font-mono"
          style={{
            display: "inline-block",
            fontSize: "var(--fs-xs)",
            color: "var(--dim)",
            maxWidth: "var(--maxw-prose)",
            margin: "12px auto 0",
            lineHeight: 1.6,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
          }}
        >
          {trust}
        </motion.div>
      </div>

      <style>{`
        @keyframes vault-caret {
          0%, 50% { opacity: 1; }
          50.01%, 100% { opacity: 0; }
        }
      `}</style>

      <span data-hero-phase={phase} hidden />
    </div>
  );
}
