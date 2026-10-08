"use client";

/** Decorative and secondary widgets loaded after hydration as separate chunks, so they stay out of first-load JS
 *  (WEBSITE 1000X budget: under 250 KB gzip on first load). None of them is LCP content. */
import dynamic from "next/dynamic";

const MotionLayer = dynamic(() => import("@/components/MotionLayer"), { ssr: false });
const GoldDust = dynamic(() => import("@/components/GoldDust"), { ssr: false });
const CursorTrail = dynamic(() => import("@/components/CursorTrail"), { ssr: false });
const EasterEgg = dynamic(() => import("@/components/EasterEgg"), { ssr: false });
const FinderLauncher = dynamic(() => import("@/components/FinderLauncher"), { ssr: false });

export default function DeferredShell() {
  return (
    <>
      <GoldDust />
      <CursorTrail />
      <EasterEgg />
      <FinderLauncher />
      <MotionLayer />
    </>
  );
}
