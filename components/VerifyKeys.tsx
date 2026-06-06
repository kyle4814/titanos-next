"use client";

/**
 * VerifyKeys — the three-key vault interlock.
 *
 * Three verification "keys" slide up in sequence (200ms stagger). Each
 * gets a brief gold flash overlay as it lands. After the third settles,
 * a "VERIFIED" stamp ring draws + the word fades in.
 *
 * MOT-01: under prefers-reduced-motion, every piece renders settled
 *   immediately — no slide, no flash, no ring draw, no fade.
 * MOT-08: previously animated `pathLength` on the SVG <text> for the
 *   word. Browsers ignore pathLength on text per spec. Replaced with
 *   the existing fillOpacity fade-in as the whole effect — visually
 *   the same minus the imaginary draw stroke.
 */

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, type ReactNode } from "react";

export type VerifyKey = {
  num: string;
  title: ReactNode;
  body: ReactNode;
};

export default function VerifyKeys({ keys }: { keys: VerifyKey[] }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const show = reduce || inView;
  const finalDelay = (keys.length - 1) * 0.2 + 0.5;

  return (
    <div ref={ref} style={{ position: "relative", maxWidth: "var(--maxw-wide)", margin: "0 auto" }}>
      <style>{`
        @media (min-width: 760px) {
          .verify-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>
      <div
        className="verify-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 18,
        }}
      >
        {keys.map((k, i) => (
          <motion.article
            key={k.num}
            initial={reduce ? false : { opacity: 0, y: 40 }}
            animate={show ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: reduce ? 0 : 0.5,
              ease: [0, 0, 0.2, 1],
              delay: reduce ? 0 : i * 0.2,
            }}
            style={{
              background: "var(--card)",
              border: "1px solid var(--gold-dim)",
              borderRadius: "var(--radius-md)",
              padding: "28px 24px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Gold flash on land — skipped under reduce */}
            {!reduce && (
              <motion.span
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: [0, 0.7, 0] } : {}}
                transition={{
                  duration: 0.6,
                  ease: "easeOut",
                  delay: i * 0.2 + 0.45,
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(circle at 50% 40%, rgb(var(--gold-rgb) / 0.45) 0%, transparent 60%)",
                  pointerEvents: "none",
                }}
              />
            )}
            <div
              style={{
                fontFamily: "'Cinzel', serif",
                color: "var(--gold)",
                fontSize: "var(--fs-h3)",
                letterSpacing: "0.05em",
                marginBottom: 8,
                lineHeight: 1,
              }}
              aria-hidden="true"
            >
              {k.num}
            </div>
            <h4
              style={{
                fontFamily: "'Cinzel', serif",
                color: "var(--ice)",
                fontSize: "var(--fs-body)",
                letterSpacing: "0.06em",
                marginBottom: 10,
                lineHeight: 1.4,
              }}
            >
              {k.title}
            </h4>
            <div
              style={{
                color: "var(--text)",
                fontSize: "var(--fs-sm)",
                lineHeight: 1.65,
              }}
            >
              {k.body}
            </div>
          </motion.article>
        ))}
      </div>

      {/* VERIFIED stamp — MOT-08: fillOpacity fade carries the effect; the
          non-standard pathLength on <text> was dropped. */}
      <div
        aria-hidden="true"
        style={{
          textAlign: "center",
          marginTop: 36,
          position: "relative",
        }}
      >
        <motion.svg
          width="240"
          height="100"
          viewBox="0 0 240 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          initial={reduce ? false : { opacity: 0 }}
          animate={show ? { opacity: 0.85 } : {}}
          transition={{ duration: reduce ? 0 : 0.2, delay: reduce ? 0 : finalDelay }}
          style={{ display: "inline-block" }}
        >
          {/* Outer ring — pathLength draw kept (works on <path>) */}
          <motion.path
            d="M 20 50 a 100 100 0 1 1 200 0 a 100 100 0 1 1 -200 0"
            stroke="var(--gold)"
            strokeWidth="2"
            initial={reduce ? false : { pathLength: 0 }}
            animate={show ? { pathLength: 1 } : {}}
            transition={{
              duration: reduce ? 0 : 0.6,
              ease: "easeOut",
              delay: reduce ? 0 : finalDelay,
            }}
          />
          {/* VERIFIED text — fillOpacity fade only (MOT-08). */}
          <motion.text
            x="120"
            y="58"
            textAnchor="middle"
            fontFamily="'Cinzel', serif"
            fontWeight="700"
            fontSize="22"
            letterSpacing="3"
            initial={reduce ? false : { fillOpacity: 0 }}
            animate={show ? { fillOpacity: 0.9 } : {}}
            transition={{
              duration: reduce ? 0 : 0.4,
              ease: "easeOut",
              delay: reduce ? 0 : finalDelay + 0.15,
            }}
            style={{ fill: "var(--gold)" }}
          >
            VERIFIED
          </motion.text>
        </motion.svg>
      </div>
    </div>
  );
}
