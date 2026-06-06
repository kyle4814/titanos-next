"use client";

/**
 * OfferCard — one of the 3 homepage offer cards.
 *
 * Each card has an animated Lucide icon (radar / shield-check / sparkles)
 * with an idle subtle animation appropriate to the icon.
 */

import { motion } from "framer-motion";
import { Radar, ShieldCheck, Sparkles } from "lucide-react";
import AnimatedButton from "./AnimatedButton";
import { cardReveal } from "@/lib/motion";

export type Offer = {
  tag: string; // "OFFER 01 · FREE"
  title: string;
  price: string; // primary price line e.g. "AU$5,997" or "$0"
  priceUnit: string; // e.g. "one-time + AU$199/mo monitoring" or "no card · delivered within 1 business day"
  body: string;
  bullets: string[];
  primary: { label: string; href: string; external?: boolean };
  secondary: { label: string; href: string };
  icon: "radar" | "shield" | "sparkles";
  index: number;
};

const iconMap = {
  radar: Radar,
  shield: ShieldCheck,
  sparkles: Sparkles,
};

export default function OfferCard(props: Offer) {
  const Icon = iconMap[props.icon];

  return (
    <motion.article
      custom={props.index}
      variants={cardReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      whileHover={{ y: -2, borderColor: "var(--gold)" }}
      style={{
        background: "var(--card)",
        border: "1px solid var(--gold-dim)",
        borderRadius: 8,
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        zIndex: 1,
        transition: "border-color 0.2s, transform 0.2s",
      }}
    >
      <IdleIcon kind={props.icon}>
        <Icon
          width={48}
          height={48}
          strokeWidth={2}
          color="var(--gold)"
          aria-hidden="true"
        />
      </IdleIcon>

      <div
        style={{
          fontFamily: "'Cinzel', serif",
          color: "var(--ice)",
          fontSize: "var(--fs-sm)",
          letterSpacing: "0.16em",
          marginBottom: 12,
          textTransform: "uppercase",
        }}
      >
        {props.tag}
      </div>

      <h3
        style={{
          fontFamily: "'Cinzel', serif",
          color: "var(--gold)",
          fontSize: "var(--fs-h4)",
          letterSpacing: "0.04em",
          marginBottom: 10,
          lineHeight: 1.3,
        }}
      >
        {props.title}
      </h3>

      <div
        style={{
          fontFamily: "'Cinzel', serif",
          color: "var(--gold)",
          fontSize: "var(--fs-h3)",
          fontWeight: 700,
          marginBottom: 4,
          lineHeight: 1.2,
        }}
      >
        {props.price}
        <span
          style={{
            color: "var(--text)",
            fontSize: "var(--fs-xs)",
            fontWeight: 400,
            display: "block",
            marginTop: 4,
            letterSpacing: "0.02em",
          }}
        >
          {props.priceUnit}
        </span>
      </div>

      <p
        style={{
          color: "var(--text)",
          fontSize: "var(--fs-body)",
          lineHeight: 1.7,
          margin: "14px 0 18px",
          flexGrow: 1,
        }}
      >
        {props.body}
      </p>

      <ul
        style={{
          listStyle: "none",
          margin: "0 0 22px 0",
        }}
      >
        {props.bullets.map((b) => (
          <li
            key={b}
            style={{
              color: "var(--text)",
              fontSize: "var(--fs-sm)",
              lineHeight: 1.6,
              padding: "5px 0 5px 18px",
              position: "relative",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                color: "var(--gold)",
                fontFamily: "'Cinzel', serif",
              }}
            >
              ›
            </span>
            {b}
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
        <AnimatedButton
          href={props.primary.href}
          external={props.primary.external}
          variant="primary"
        >
          {props.primary.label}
        </AnimatedButton>
        <AnimatedButton href={props.secondary.href} variant="secondary">
          {props.secondary.label}
        </AnimatedButton>
      </div>
    </motion.article>
  );
}

/* ─── Idle icon wrappers ────────────────────────────────────── */
function IdleIcon({
  kind,
  children,
}: {
  kind: Offer["icon"];
  children: React.ReactNode;
}) {
  if (kind === "radar") {
    // outward pulse ring every 4s
    return (
      <div style={{ position: "relative", marginBottom: 14, width: 48, height: 48 }}>
        {children}
        <motion.span
          aria-hidden="true"
          initial={{ opacity: 0.5, scale: 0.6 }}
          animate={{ opacity: 0, scale: 1.6 }}
          transition={{
            duration: 2.2,
            ease: "easeOut",
            repeat: Infinity,
            repeatDelay: 1.8,
          }}
          style={{
            position: "absolute",
            inset: 0,
            border: "1px solid var(--gold)",
            borderRadius: "50%",
          }}
        />
      </div>
    );
  }
  if (kind === "shield") {
    // sweep highlight every 6s
    return (
      <div
        style={{
          position: "relative",
          marginBottom: 14,
          width: 48,
          height: 48,
          overflow: "hidden",
        }}
      >
        {children}
        <motion.span
          aria-hidden="true"
          initial={{ x: -80, opacity: 0 }}
          animate={{ x: 80, opacity: [0, 0.45, 0] }}
          transition={{
            duration: 1.4,
            ease: "easeInOut",
            repeat: Infinity,
            repeatDelay: 4.6,
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 40,
            height: 48,
            background:
              "linear-gradient(110deg, transparent 30%, rgba(245,213,117,0.55) 50%, transparent 70%)",
            pointerEvents: "none",
            transform: "skewX(-20deg)",
          }}
        />
      </div>
    );
  }
  // sparkles — cross-fade twinkle
  return (
    <motion.div
      style={{ marginBottom: 14, width: 48, height: 48 }}
      animate={{ opacity: [1, 0.55, 1, 0.7, 1] }}
      transition={{ duration: 3.4, ease: "easeInOut", repeat: Infinity }}
    >
      {children}
    </motion.div>
  );
}
