"use client";

import { useEffect, useRef, type ReactNode } from "react";

const NUM = /\d[\d,]*\.?\d*/;
/** Counts the first number inside each [data-count] element up from 0 (final text is server-rendered, so no JS = final numbers). */
function countUp(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
    const txt = el.textContent ?? "", m = NUM.exec(txt);
    if (!m) return;
    const end = parseFloat(m[0].replace(/,/g, "")), dp = (m[0].split(".")[1] ?? "").length, t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 1200), x = end * (1 - Math.pow(1 - k, 3));
      el.textContent = txt.replace(m[0], k < 1 ? x.toLocaleString("en-AU", { minimumFractionDigits: dp, maximumFractionDigits: dp }) : m[0]);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

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
          countUp(el);
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
