"use client";

/**
 * GlowCard: glass card with a cursor spotlight. The spotlight follows the pointer through
 * two CSS variables (--mx, --my); there is no React state, so a move costs one style write.
 * Off for touch (hover: none) and reduced motion, in CSS. Content is untouched.
 */
import { createElement, useCallback, type CSSProperties, type PointerEvent, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  as?: "div" | "article" | "section" | "li" | "a";
  href?: string;
  className?: string;
  style?: CSSProperties;
  id?: string;
};

export default function GlowCard({ children, as = "div", className, style, href, id }: Props) {
  const onMove = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, []);
  return createElement(
    as,
    { className: `h-glow${className ? ` ${className}` : ""}`, style, id, href, onPointerMove: onMove },
    children,
  );
}
