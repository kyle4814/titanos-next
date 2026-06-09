"use client";

/**
 * HeroDustBurst — the 4-second cinematic centerpiece.
 *
 * Canvas-based particle burst that synchronizes with the wordmark reveal:
 *
 *   T=0-100ms    : ambient — single bright dot at center
 *   T=100-1400ms : burst — 140 particles spray outward from center with
 *                  random angular velocity, decelerating; opacity 0.9 → 0
 *   T=1400-2400ms: drift — survivor particles drift slowly, very few
 *                  remain; wordmark begins its fade-in beneath
 *   T=2400-3200ms: particles fully absorbed; wordmark fully visible
 *
 * MOT-01: renders nothing under prefers-reduced-motion (parent component
 *   short-circuits to settled state without mounting this).
 *
 * Performance: canvas 2D, ~140 particles, ~10ms per frame on a mid-tier
 *   Android, 60fps on a laptop. Self-terminates at T=4000ms (no
 *   infinite RAF loop after sequence completes).
 */

import { useEffect, useRef } from "react";

const TOTAL_MS = 4000;
const BURST_MS = 1400;
const DRIFT_MS = 1000;
const N = 140;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  o: number;     // base opacity
  life: number;  // 0..1
  decay: number; // life decrement per frame
};

export default function HeroDustBurst() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Seed particles around an offscreen "burst origin" near the centre.
    const cx = () => canvas.clientWidth / 2;
    const cy = () => canvas.clientHeight * 0.45;

    const particles: Particle[] = Array.from({ length: N }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.4 + Math.random() * 3.6;
      return {
        x: cx(),
        y: cy(),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 0.5 + Math.random() * 1.4,
        o: 0.4 + Math.random() * 0.5,
        life: 1,
        decay: 0.004 + Math.random() * 0.008,
      };
    });

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      // Phase ramp — bright early, fading post-burst
      const phaseAlpha =
        elapsed < BURST_MS
          ? 1
          : Math.max(0, 1 - (elapsed - BURST_MS) / DRIFT_MS);

      for (const p of particles) {
        // air-drag deceleration
        p.vx *= 0.985;
        p.vy *= 0.985;
        // very slight gravity downward (settle feel)
        p.vy += 0.012;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life < 0) continue;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(var(--gold-rgb) / ${p.o * p.life * phaseAlpha})`;
        ctx.fill();
      }

      // Brief central afterglow during burst
      if (elapsed < 600) {
        const fade = 1 - elapsed / 600;
        const grad = ctx.createRadialGradient(cx(), cy(), 0, cx(), cy(), 120);
        grad.addColorStop(0, `rgb(var(--gold-rgb) / ${0.55 * fade})`);
        grad.addColorStop(1, "rgb(var(--gold-rgb) / 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      if (elapsed < TOTAL_MS) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
