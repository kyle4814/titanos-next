"use client";

/**
 * MirrorLists — synchronized "what we do" green-tick / "what we never do"
 * red-cross lists with a strike-through draw on the don't side.
 *
 * MOT-01: under prefers-reduced-motion, ticks/crosses + strike lines
 *   render at settled state immediately (no scale-in, no width draw).
 */

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";

export default function MirrorLists({
  doTitle = "WHAT WE SCAN",
  doItems,
  dontTitle = "WHAT WE DON'T DO",
  dontItems,
}: {
  doTitle?: string;
  doItems: React.ReactNode[];
  dontTitle?: string;
  dontItems: React.ReactNode[];
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const show = reduce || inView;

  return (
    <div
      ref={ref}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 22,
        maxWidth: "var(--maxw-content)",
        margin: "0 auto",
      }}
    >
      <style>{`
        @media (min-width: 760px) {
          .mirror-grid { grid-template-columns: 1fr 1fr !important; gap: 28px !important; }
        }
      `}</style>
      <div
        className="mirror-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 22,
        }}
      >
        <article
          style={{
            background: "var(--card)",
            border: "1px solid var(--gold-dim)",
            borderRadius: "var(--radius-md)",
            padding: "26px 24px",
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              color: "var(--gold)",
              fontSize: "var(--fs-body)",
              letterSpacing: "0.08em",
              marginBottom: 14,
            }}
          >
            {doTitle}
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {doItems.map((item, i) => (
              <li
                key={i}
                style={{
                  color: "var(--text)",
                  fontSize: "var(--fs-body)",
                  lineHeight: 1.65,
                  padding: "8px 0 8px 26px",
                  position: "relative",
                }}
              >
                <motion.span
                  aria-hidden="true"
                  initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                  animate={show ? { opacity: 1, scale: 1 } : {}}
                  transition={{
                    duration: reduce ? 0 : 0.28,
                    ease: [0.4, 0, 0.2, 1],
                    delay: reduce ? 0 : i * 0.08,
                  }}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 7,
                    color: "var(--ok)",
                    fontWeight: 700,
                    fontSize: "var(--fs-body)",
                    display: "inline-block",
                  }}
                >
                  ✓
                </motion.span>
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "26px 24px",
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              color: "var(--ice)",
              fontSize: "var(--fs-body)",
              letterSpacing: "0.08em",
              marginBottom: 14,
            }}
          >
            {dontTitle}
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {dontItems.map((item, i) => (
              <li
                key={i}
                style={{
                  color: "var(--text)",
                  fontSize: "var(--fs-body)",
                  lineHeight: 1.65,
                  padding: "8px 0 8px 26px",
                  position: "relative",
                }}
              >
                <motion.span
                  aria-hidden="true"
                  initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                  animate={show ? { opacity: 1, scale: 1 } : {}}
                  transition={{
                    duration: reduce ? 0 : 0.28,
                    ease: [0.4, 0, 0.2, 1],
                    delay: reduce ? 0 : i * 0.08,
                  }}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 7,
                    color: "var(--warn)",
                    fontWeight: 700,
                    fontSize: "var(--fs-body)",
                  }}
                >
                  ✗
                </motion.span>
                <span style={{ position: "relative", display: "inline-block" }}>
                  {item}
                  <motion.span
                    aria-hidden="true"
                    initial={reduce ? { width: "100%" } : { width: "0%" }}
                    animate={show ? { width: "100%" } : {}}
                    transition={{
                      duration: reduce ? 0 : 0.32,
                      ease: [0.4, 0, 0.2, 1],
                      delay: reduce ? 0 : i * 0.08 + 0.18,
                    }}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      height: 1,
                      background: "var(--warn)",
                      opacity: 0.7,
                      pointerEvents: "none",
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );
}
