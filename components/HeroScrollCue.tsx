"use client";

/**
 * HeroScrollCue — gold chevron under the hero trust line.
 *
 * Bobs y:[0,6,0] over 2s while the user is at the top of the page. As
 * soon as they scroll past 50px the cue fades out (no point hinting at
 * scroll once it's begun).
 *
 * MOT-06.
 * MOT-01: under prefers-reduced-motion, renders nothing.
 */

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

export default function HeroScrollCue() {
  const reduce = useReducedMotion();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const onScroll = () => {
      setHidden(window.scrollY > 50);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduce]);

  if (reduce) return null;

  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: hidden ? 0 : 0.7, y: hidden ? -4 : 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        position: "relative",
        display: "flex",
        justifyContent: "center",
        marginTop: 28,
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <motion.svg
        width="22"
        height="14"
        viewBox="0 0 22 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
      >
        <path
          d="M 1 1 L 11 11 L 21 1"
          stroke="var(--gold)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>
    </motion.div>
  );
}
