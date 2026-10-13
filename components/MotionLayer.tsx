"use client";

/**
 * Site-wide motion layer: Lenis smooth scroll (MIT) driving GSAP ScrollTrigger (GSAP Standard "No Charge"
 * licence, verified 2026-10-08, see docs/W1_LICENCES.md). Loaded after idle so it never touches LCP, and
 * skipped completely under prefers-reduced-motion. Elements with [data-phi-reveal] rise in on scroll with
 * phi-stepped timing; the hero copy drifts and fades slightly as it leaves.
 */
import { useEffect } from "react";
import { DUR } from "@/lib/phi";

// No GSAP here any more (it was 65 KB gz on every page for a fade-up and one scrubbed drift): IntersectionObserver +
// CSS transitions give the same 26 px / 0.62 s power3.out / 0.08 s stagger reveal, and one rAF-throttled scroll handler
// gives the same linear hero drift. Lenis (desktop only) is driven by its own rAF loop.
const EASE = "cubic-bezier(0.215, 0.61, 0.355, 1)"; // power3.out

export default function MotionLayer() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let dead = false;
    let cleanup: (() => void) | undefined;
    const go = async () => {
      // Touch devices scroll natively with momentum; Lenis would only add a permanent rAF loop and wheel listeners.
      const touch = window.matchMedia("(pointer: coarse)").matches;
      const lenisMod = touch ? null : await import("lenis");
      if (dead) return;
      const undo: Array<() => void> = [];

      let lenis: { raf(t: number): void; destroy(): void } | null = null;
      if (lenisMod) {
        lenis = new lenisMod.default({ duration: DUR.epic, smoothWheel: true });
        let raf = 0;
        const loop = (t: number) => { lenis!.raf(t); raf = requestAnimationFrame(loop); };
        raf = requestAnimationFrame(loop);
        undo.push(() => cancelAnimationFrame(raf));
      }

      // Below-the-fold [data-phi-reveal] elements start hidden and rise in batches (staggered) as they enter; anything already on
      // screen is left alone so there is no flash. If this never runs (no JS, reduced motion) the content simply stays visible.
      const items = Array.from(document.querySelectorAll<HTMLElement>("[data-phi-reveal]")).filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.85);
      if (items.length) {
        for (const el of items) { el.style.opacity = "0"; el.style.transform = "translateY(26px)"; }
        const io = new IntersectionObserver((entries) => {
          const hit = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
          hit.forEach((el, i) => {
            io.unobserve(el);
            const delay = i * 80;
            el.style.transition = `opacity ${DUR.base}s ${EASE} ${delay}ms, transform ${DUR.base}s ${EASE} ${delay}ms`;
            el.style.opacity = "1";
            el.style.transform = "none";
            const clear = () => { el.style.transition = ""; el.style.opacity = ""; el.style.transform = ""; };
            const t = window.setTimeout(clear, DUR.base * 1000 + delay + 60);
            undo.push(() => window.clearTimeout(t));
          });
        }, { rootMargin: "10000px 0px -12% 0px" }); // top margin: a section already scrolled past still settles
        items.forEach((el) => io.observe(el));
        undo.push(() => { io.disconnect(); for (const el of items) { el.style.transition = ""; el.style.opacity = ""; el.style.transform = ""; } });
      }

      const copy = document.querySelector<HTMLElement>(".ds-hero__col");
      const hero = document.querySelector<HTMLElement>(".ds-hero");
      if (copy && hero) {
        copy.style.willChange = "transform, opacity";
        let ticking = false;
        const apply = () => {
          ticking = false;
          const r = hero.getBoundingClientRect();
          const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height))); // "top top" -> "bottom top"
          copy.style.transform = `translateY(${(-42 * p).toFixed(2)}px)`;
          copy.style.opacity = String(1 - 0.75 * p);
        };
        const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(apply); } };
        window.addEventListener("scroll", onScroll, { passive: true });
        undo.push(() => { window.removeEventListener("scroll", onScroll); copy.style.transform = ""; copy.style.opacity = ""; copy.style.willChange = ""; });
      }
      cleanup = () => { undo.forEach((f) => f()); lenis?.destroy(); };
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
