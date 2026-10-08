"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Sets data-in="1" on its wrapper once it is 25% on screen (immediately for reduced motion), so CSS can animate
 *  bars and lines in. The content is server-rendered at its final values: no JS means a finished chart, never an empty one. */
export default function InView({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      el.dataset.in = "1";
      return;
    }
    el.dataset.armed = "1";
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          el.dataset.in = "1";
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
