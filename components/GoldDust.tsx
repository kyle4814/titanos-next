"use client";

/**
 * GoldDust — ambient particle field.
 *
 * Canvas-based, ~30 particles, 1-2px each, opacity 0.05-0.15.
 * Drift slowly upward (3-15s per particle, randomised).
 * Mild parallax response: particles within ~150px of the cursor drift slightly
 * toward it.
 *
 * Rendered behind everything else (z-index 0). Respects prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  r: number;
  o: number;
  vy: number; // upward velocity (negative)
  vx: number; // horizontal drift
};

export default function GoldDust() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Canvas cannot parse CSS var() — the old fillStyle silently stayed
    // black on the black canvas, so this layer has been an invisible
    // rAF drain since the Vault rebuild. Resolve the token once.
    const goldRgb = (
      getComputedStyle(document.documentElement)
        .getPropertyValue("--gold-rgb")
        .trim() || "212 175 55"
    )
      .split(/\s+/)
      .join(",");
    const gold = (a: number) => `rgba(${goldRgb},${a})`;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const N = 30;
    const particles: Particle[] = Array.from({ length: N }, () => spawn(w, h));

    const mouse = { x: -9999, y: -9999 };
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        // parallax pull toward cursor
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 150 * 150 && d2 > 1) {
          const k = 0.0006;
          p.x += dx * k;
          p.y += dy * k;
        }

        p.x += p.vx;
        p.y += p.vy;

        if (p.y < -10) Object.assign(p, spawn(w, h, true));
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = gold(p.o);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

function spawn(w: number, h: number, fromBottom = false): Particle {
  return {
    x: Math.random() * w,
    y: fromBottom ? h + Math.random() * 40 : Math.random() * h,
    r: 0.5 + Math.random() * 1.0, // 0.5–1.5 px
    o: 0.05 + Math.random() * 0.1, // 0.05–0.15
    vy: -(0.05 + Math.random() * 0.25), // upward, slow
    vx: (Math.random() - 0.5) * 0.1,
  };
}
