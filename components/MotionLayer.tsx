"use client";

/**
 * Site-wide motion layer: Lenis smooth scroll (MIT) driving GSAP ScrollTrigger (GSAP Standard "No Charge"
 * licence, verified 2026-10-08, see docs/W1_LICENCES.md). Loaded after idle so it never touches LCP, and
 * skipped completely under prefers-reduced-motion. Elements with [data-phi-reveal] rise in on scroll with
 * phi-stepped timing; the hero copy drifts and fades slightly as it leaves.
 */
import { useEffect } from "react";
import { DUR } from "@/lib/phi";

export default function MotionLayer() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let dead = false;
    let cleanup: (() => void) | undefined;
    const go = async () => {
      const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (dead) return;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ duration: DUR.epic, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>("[data-phi-reveal]").forEach((el) => {
          gsap.from(el, {
            y: 26, opacity: 0, duration: DUR.base, ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          });
        });
        const copy = document.querySelector<HTMLElement>(".ds-hero__col");
        if (copy) {
          gsap.to(copy, {
            y: -42, opacity: 0.25, ease: "none",
            scrollTrigger: { trigger: ".ds-hero", start: "top top", end: "bottom top", scrub: true },
          });
        }
      });
      cleanup = () => { ctx.revert(); gsap.ticker.remove(tick); lenis.destroy(); };
    };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const id = ric ? ric(go, { timeout: 3000 }) : window.setTimeout(go, 1500);
    return () => {
      dead = true;
      if (ric) (window as unknown as { cancelIdleCallback: (n: number) => void }).cancelIdleCallback(id);
      else clearTimeout(id);
      cleanup?.();
    };
  }, []);
  return null;
}
