"use client";

/**
 * MirrorLists — synchronized "what we do" green-tick / "what we never do"
 * red-cross lists. When scrolled into view, both lists animate in mirror:
 *   - green ticks fade-in + scale-up 80ms apart
 *   - red crosses appear + a strike line draws 0% → 100% width over 280ms each
 */

import { motion, useInView } from "framer-motion";
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
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });

  return (
    <div
      ref={ref}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 22,
        maxWidth: 880,
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
            borderRadius: 6,
            padding: "26px 24px",
          }}
        >
          <h3
            style={{
              fontFamily: "'Cinzel', serif",
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
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{
                    duration: 0.28,
                    ease: [0.4, 0, 0.2, 1],
                    delay: i * 0.08,
                  }}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 7,
                    color: "#4ade80",
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
            borderRadius: 6,
            padding: "26px 24px",
          }}
        >
          <h3
            style={{
              fontFamily: "'Cinzel', serif",
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
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{
                    duration: 0.28,
                    ease: [0.4, 0, 0.2, 1],
                    delay: i * 0.08,
                  }}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 7,
                    color: "#f87171",
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
                    initial={{ width: "0%" }}
                    animate={inView ? { width: "100%" } : {}}
                    transition={{
                      duration: 0.32,
                      ease: [0.4, 0, 0.2, 1],
                      delay: i * 0.08 + 0.18,
                    }}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      height: 1,
                      background: "#f87171",
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
