"use client";

/**
 * SectionReveal — fades the section from y:24/opacity:0 to settled when
 * its top edge crosses 85% of viewport.
 *
 * 2026-07-11: rewritten from framer-motion to IO + CSS transitions.
 * Framer tweens opacity via requestAnimationFrame on the main thread —
 * on a janky phone GPU the reveal lags the scroll, and a section you
 * scroll PAST while frames are starved can sit at opacity 0
 * indefinitely (measured live: rAF at 3 frames/500ms left every
 * below-fold section black). CSS transitions run on the compositor and
 * survive main-thread stalls. Visuals unchanged: same distance, same
 * duration, same ease (see [data-reveal] rules in globals.css).
 *
 * MOT-01: prefers-reduced-motion renders settled immediately — enforced
 * in CSS (works even before hydration) and mirrored here.
 */

import {
  createElement,
  useEffect,
  useRef,
  type ReactNode,
  type CSSProperties,
} from "react";

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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.reveal = "in";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.reveal = "in";
          io.disconnect();
        }
      },
      // Top margin extends the root far above the viewport: a section
      // the user teleported past (anchor jump, fast flick, restored
      // scroll position) still "intersects" and settles instead of
      // sitting at opacity 0 above them forever. Bottom -15% keeps the
      // reveal-on-approach feel.
      { rootMargin: "10000px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return createElement(
    as,
    {
      ref,
      id,
      className,
      style:
        delay > 0 ? { ...style, transitionDelay: `${delay}s` } : style,
      "data-reveal": "",
    },
    children,
  );
}
