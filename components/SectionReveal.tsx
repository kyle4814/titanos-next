"use client";

/**
 * SectionReveal — fades the section from y:30/opacity:0 to settled when
 * its top edge crosses 85% of viewport.
 *
 * MOT-01: under prefers-reduced-motion, renders settled immediately —
 *   no InView observer, no fade.
 */

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, type ReactNode, type CSSProperties } from "react";
import { sectionReveal } from "@/lib/motion";

type Props = {
  children: ReactNode;
  as?: "section" | "div" | "article" | "footer" | "header";
  className?: string;
  id?: string;
  delay?: number;
  style?: CSSProperties;
};

export default function SectionReveal({
  children,
  as = "section",
  className,
  id,
  delay = 0,
  style,
}: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });

  const MotionTag = motion[as] as typeof motion.section;
  const animateState = reduce || inView ? "visible" : "hidden";

  return (
    <MotionTag
      ref={ref as never}
      id={id}
      className={className}
      style={style}
      initial={reduce ? "visible" : "hidden"}
      animate={animateState}
      variants={sectionReveal}
      transition={{ duration: reduce ? 0 : 0.6, ease: [0, 0, 0.2, 1], delay: reduce ? 0 : delay }}
      data-reveal=""
    >
      {children}
    </MotionTag>
  );
}
