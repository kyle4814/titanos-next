"use client";

/**
 * NumberCounter — animates 0 → value over 1200ms cubic ease-out when the
 * element scrolls into view. Renders static target server-side.
 *
 * MOT-01: under prefers-reduced-motion, renders the target value
 *   immediately and skips the IntersectionObserver + RAF chain.
 */

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  suffix?: string;
  prefix?: string;
  durationMs?: number;
};

export default function NumberCounter({
  value,
  suffix = "",
  prefix = "",
  durationMs = 1200,
}: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState<number>(value);
  const started = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // MOT-01 — settle to target value, skip the RAF chain.
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(value);
      return;
    }

    const el = ref.current;
    if (!el) return;
    setDisplay(0);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / durationMs);
              const eased = 1 - Math.pow(1 - t, 3);
              setDisplay(Math.round(value * eased));
              if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            io.disconnect();
          }
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, durationMs]);

  return (
    <span ref={ref} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}
      {display.toLocaleString("en-AU")}
      {suffix}
    </span>
  );
}
