"use client";

/** Scroll driver for the page-long flow: ONE passive scroll listener + rAF, transform-only writes.
 *  [data-flow="0.2"]   background layer: slow parallax, shifted by (distance of its parent from screen centre) x speed.
 *  [data-flow-thread]  the weaving strands: tile scrolls at 0.42x the page and wraps seamlessly (tile height in data-tile px).
 *  Off-screen layers are skipped (IntersectionObserver on the parent). Reduced motion: nothing runs, layers stay static. */
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function FlowDriver() {
  const path = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layers = Array.from(document.querySelectorAll<HTMLElement>("[data-flow]"));
    const thread = document.querySelector<HTMLElement>("[data-flow-thread]");
    if (!layers.length && !thread) return;
    const seen = new Set<Element>();
    const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target))), { rootMargin: "20% 0px" });
    layers.forEach((l) => l.parentElement && io.observe(l.parentElement));
    const tile = Number(thread?.dataset.tile) || 800;
    let queued = false;
    const tick = () => {
      queued = false;
      const vh = window.innerHeight, rects = layers.map((l) => (l.parentElement && seen.has(l.parentElement) ? l.parentElement.getBoundingClientRect() : null));
      layers.forEach((l, i) => {
        const r = rects[i];
        if (r) l.style.transform = `translate3d(0, ${((r.top + r.height / 2 - vh / 2) * Number(l.dataset.flow)).toFixed(1)}px, 0)`;
      });
      if (thread) thread.style.transform = `translate3d(0, ${(-((window.scrollY * 0.42) % tile)).toFixed(1)}px, 0)`;
    };
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(tick); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    tick();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); io.disconnect(); };
  }, [path]);
  return null;
}
