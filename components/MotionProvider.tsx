"use client";

/** Framer Motion features load as a separate async chunk (LazyMotion + the slim `m` component), so the animation
 *  engine stays out of first-load JS. Every existing animation still runs: domAnimation covers animate, variants,
 *  exit, whileHover, whileTap, whileInView and focus. Nothing here uses drag or layout animation. */
import { LazyMotion } from "framer-motion";
import type { ReactNode } from "react";

const loadFeatures = () => import("framer-motion").then((mod) => mod.domAnimation);

export default function MotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}
