"use client";

/**
 * OfferCard — one of the 3 homepage offer cards.
 *
 * Each card has an animated Lucide icon (radar / shield-check / sparkles)
 * with an idle subtle animation appropriate to the icon.
 *
 * MOT-01: under prefers-reduced-motion the card reveal + all idle loops
 *   are short-circuited to the settled state.
 * MOT-03: idle loops pause when the card scrolls off-screen via an
 *   IntersectionObserver. Saves CPU + battery on long pages.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Radar, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AnimatedButton from "./AnimatedButton";
import CornerBrackets from "./CornerBrackets";
import { SystemLabel } from "@/components/Myth";
import { cardReveal } from "@/lib/motion";

export type Offer = {
  tag: string;
  title: string;
  price: string;
  priceUnit: string;
  body: string;
  bullets: string[];
  primary: { label: string; href: string; external?: boolean };
  secondary: { label: string; href: string };
  icon: "radar" | "shield" | "sparkles" | "users";
  index: number;
  footnote?: string;
  /** Elevates the card: gold gradient border + a quiet "Selected terms" mark. No badge. */
  popular?: boolean;
};

const iconMap = {
  radar: Radar,
  shield: ShieldCheck,
  sparkles: Sparkles,
  users: Users,
};

export default function OfferCard(props: Offer) {
  const Icon = iconMap[props.icon];
  const reduce = useReducedMotion();
  const cardRef = useRef<HTMLElement | null>(null);
  const [onScreen, setOnScreen] = useState(false);
  // W4 Pillar 6 — 3D tilt based on cursor position relative to card centre.
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  // MOT-03 — IntersectionObserver pauses idle loops when off-screen.
  useEffect(() => {
    if (reduce) {
      setOnScreen(false);
      return;
    }
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setOnScreen(e.isIntersecting);
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  // W4 Pillar 6 — 3D tilt handler. Cursor X/Y inside the card maps to
  // rotateY/rotateX ±4deg / ±2deg.
  // MOB-10: bail on coarse pointer (mousemove fires unreliably on touch
  // and the tilt looks broken when the card is being scrolled).
  const onCardMove = (e: React.MouseEvent<HTMLElement>) => {
    if (reduce) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;   // -0.5 .. 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ ry: nx * 8, rx: -ny * 4 });
  };
  const onCardLeave = () => setTilt({ rx: 0, ry: 0 });

  return (
    <motion.article
      ref={cardRef as never}
      className="vault-card-tilt"
      data-touch="press"
      custom={props.index}
      variants={cardReveal}
      initial={reduce ? false : "hidden"}
      animate={reduce ? "visible" : undefined}
      whileInView={reduce ? undefined : "visible"}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      onMouseMove={onCardMove}
      onMouseLeave={onCardLeave}
      style={{
        background: "var(--card)",
        border: props.popular ? "1px solid transparent" : "1px solid var(--gold-dim)",
        // Gradient border via double background — the elevated door reads
        // brighter at the top edge, like light catching the frame.
        ...(props.popular && {
          backgroundImage:
            "linear-gradient(var(--card), var(--card)), linear-gradient(160deg, var(--gold-bright), var(--gold-dim) 45%, var(--gold-dim) 70%, var(--gold))",
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
        }),
        borderRadius: "var(--radius-md)",
        padding: "clamp(22px, 5vw, 32px) clamp(20px, 4vw, 28px)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        position: "relative",
        zIndex: 1,
        // 3D tilt + soft shadow that tilts with the card.
        transform: reduce
          ? undefined
          : `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transformStyle: "preserve-3d",
        transition: "border-color 0.2s, transform 250ms cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: reduce
          ? "none"
          : `${-tilt.ry * 2}px ${tilt.rx * 2}px 28px rgb(var(--gold-rgb) / 0.08)`,
      }}
    >
      <CornerBrackets />

      <IdleIcon kind={props.icon} onScreen={onScreen} reduce={!!reduce}>
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
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <SystemLabel tone="ice">{props.tag}</SystemLabel>
        {props.popular && (
          <SystemLabel tone="gold" style={{ whiteSpace: "nowrap" }}>
            Selected terms
          </SystemLabel>
        )}
      </div>

      <h3
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: "var(--gold)",
          fontSize: "var(--fs-h4)",
          letterSpacing: "0.04em",
          marginBottom: 14,
          lineHeight: 1.3,
        }}
      >
        {props.title}
      </h3>

      <div
        style={{
          borderTop: "1px solid rgb(var(--gold-rgb) / 0.25)",
          borderBottom: "1px solid rgb(var(--gold-rgb) / 0.25)",
          padding: "14px 0",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h3)",
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          {props.price}
        </div>
        <div
          className="label-system"
          style={{ color: "var(--dim)", marginTop: 6 }}
        >
          {props.priceUnit}
        </div>
      </div>

      <p
        style={{
          color: "var(--text)",
          fontSize: "var(--fs-body)",
          lineHeight: 1.7,
          margin: "0 0 18px",
        }}
      >
        {props.body}
      </p>

      <SystemLabel style={{ marginBottom: 8 }}>Terms</SystemLabel>
      <ul
        style={{
          listStyle: "none",
          margin: "0 0 14px 0",
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
              borderTop: "1px solid var(--border)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: 5,
                color: "var(--gold)",
                fontFamily: "var(--font-display), Georgia, serif",
              }}
            >
              ›
            </span>
            {b}
          </li>
        ))}
      </ul>

      {props.footnote && (
        <p
          style={{
            color: "var(--text)",
            fontSize: "var(--fs-xs)",
            lineHeight: 1.6,
            fontStyle: "italic",
            margin: "0 0 18px 0",
            opacity: 0.85,
          }}
        >
          {props.footnote}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start", marginTop: "auto" }}>
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

/* ─── Idle icon wrappers ──────────────────────────────────────
   MOT-03 pause: loops only animate when onScreen + !reduce.
   ────────────────────────────────────────────────────────────── */
function IdleIcon({
  kind,
  onScreen,
  reduce,
  children,
}: {
  kind: Offer["icon"];
  onScreen: boolean;
  reduce: boolean;
  children: React.ReactNode;
}) {
  const active = onScreen && !reduce;

  if (kind === "radar") {
    // Semantic: outward pulse every 4s. Suppressed off-screen + on reduce.
    return (
      <div style={{ position: "relative", marginBottom: 14, width: 48, height: 48 }}>
        {children}
        {active && (
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
        )}
      </div>
    );
  }
  if (kind === "shield") {
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
        {active && (
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
                "linear-gradient(110deg, transparent 30%, rgb(var(--gold-rgb) / 0.55) 50%, transparent 70%)",
              pointerEvents: "none",
              transform: "skewX(-20deg)",
            }}
          />
        )}
      </div>
    );
  }
  // sparkles — cross-fade twinkle, off-screen + reduce suppressed
  return (
    <motion.div
      style={{ marginBottom: 14, width: 48, height: 48 }}
      animate={active ? { opacity: [1, 0.55, 1, 0.7, 1] } : { opacity: 1 }}
      transition={
        active
          ? { duration: 3.4, ease: "easeInOut", repeat: Infinity }
          : { duration: 0 }
      }
    >
      {children}
    </motion.div>
  );
}
