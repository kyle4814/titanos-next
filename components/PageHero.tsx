"use client";

/**
 * PageHero — standardised hero shell for non-home pages.
 * Centred badge + h1 + tagline + sub paragraph + optional CTAs row.
 */

import { motion } from "framer-motion";
import { type ReactNode } from "react";
import { fadeUp } from "@/lib/motion";

export default function PageHero({
  badge,
  title,
  tagline,
  sub,
  children,
  trustLine,
}: {
  badge?: ReactNode;
  title: ReactNode;
  tagline?: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  trustLine?: ReactNode;
}) {
  return (
    <section
      style={{
        textAlign: "center",
        padding: "100px 20px 70px",
        position: "relative",
        zIndex: 2,
      }}
    >
      <div className="container-vault">
        {badge && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            style={{
              display: "inline-block",
              border: "1px solid var(--gold-dim)",
              padding: "6px 16px",
              borderRadius: 24,
              fontFamily: "'Cinzel', serif",
              fontSize: "var(--fs-xs)",
              color: "var(--ice)",
              letterSpacing: "0.1em",
              marginBottom: 24,
              textTransform: "uppercase",
            }}
          >
            {badge}
          </motion.div>
        )}
        <motion.h1
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ delay: 0.05 }}
          style={{
            fontFamily: "'Cinzel', serif",
            fontWeight: 700,
            fontSize: "var(--fs-h1)",
            color: "var(--gold)",
            letterSpacing: "0.04em",
            marginBottom: 18,
            lineHeight: 1.18,
          }}
        >
          {title}
        </motion.h1>
        {tagline && (
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ delay: 0.1 }}
            style={{
              fontSize: "var(--fs-lg)",
              color: "var(--ice)",
              maxWidth: 760,
              margin: "0 auto 16px",
              fontWeight: 300,
              lineHeight: 1.6,
            }}
          >
            {tagline}
          </motion.p>
        )}
        {sub && (
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ delay: 0.15 }}
            style={{
              fontSize: "var(--fs-body)",
              color: "var(--dim)",
              maxWidth: 680,
              margin: "0 auto 24px",
              lineHeight: 1.7,
            }}
          >
            {sub}
          </motion.p>
        )}
        {children && (
          <div
            style={{
              marginTop: 24,
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              justifyContent: "center",
            }}
          >
            {children}
          </div>
        )}
        {trustLine && (
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ delay: 0.25 }}
            style={{
              fontSize: "var(--fs-sm)",
              color: "var(--dim)",
              maxWidth: 680,
              margin: "26px auto 0",
              lineHeight: 1.7,
            }}
          >
            {trustLine}
          </motion.p>
        )}
        <div
          aria-hidden="true"
          style={{
            width: 60,
            height: 2,
            background:
              "linear-gradient(90deg, transparent, var(--ice), transparent)",
            margin: "28px auto 0",
          }}
        />
      </div>
    </section>
  );
}
