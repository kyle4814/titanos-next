"use client";

/**
 * SectionReveal — wraps a <section> to fade-up on scroll into view.
 *
 * The section fades from opacity 0 + translateY 30px to opacity 1 + 0px over
 * 600ms ease-out when its top edge crosses ~85% of the viewport.
 *
 * By design, the first heading-like child inside the section gets a 100ms
 * delay so it "settles last" — to do this on a per-child basis, use a
 * <motion.h2> directly with `sectionRevealHeading` variant from lib/motion.
 */

import { motion, useInView } from "framer-motion";
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
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });

  const MotionTag = motion[as] as typeof motion.section;

  return (
    <MotionTag
      ref={ref as never}
      id={id}
      className={className}
      style={style}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={sectionReveal}
      transition={{ duration: 0.6, ease: [0, 0, 0.2, 1], delay }}
      data-reveal=""
    >
      {children}
    </MotionTag>
  );
}
