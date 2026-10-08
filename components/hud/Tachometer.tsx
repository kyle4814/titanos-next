"use client";

import { useEffect, useState } from "react";
import { NUM, needleFraction } from "@/lib/hud/data";

const CX = 200, CY = 190, R = 150;
const A0 = -210, A1 = 30; // degrees, sweep 240 clockwise from lower left to lower right
const pt = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};
const arc = (from: number, to: number, r: number) => {
  const [x0, y0] = pt(from, r), [x1, y1] = pt(to, r);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};

export default function Tachometer() {
  const frac = needleFraction();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(frac); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min((t - t0) / 1600, 1);
      const e = 1 - Math.pow(1 - k, 3);
      // overshoot then settle, like a real needle
      setShown(frac * e + (k < 1 ? Math.sin(k * Math.PI) * 0.012 : 0));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frac]);

  const ang = A0 + (A1 - A0) * shown;
  const [nx, ny] = pt(ang, R - 18);
  const ticks = Array.from({ length: 25 }, (_, i) => A0 + ((A1 - A0) * i) / 24);
  const pctText = ((NUM.needle.realised / NUM.needle.ceiling) * 100).toFixed(1);
  return (
    <figure className="hud-panel" aria-label={`Tachometer: realised output ${NUM.needle.realised} times against a modelled ceiling of ${NUM.needle.ceiling} times`} style={{ margin: 0 }}>
      <svg viewBox="0 0 400 270" role="img" aria-hidden="true" style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id="hud-arc" x1="0" x2="1">
            <stop offset="0" stopColor="#9A8030" /><stop offset="0.8" stopColor="#E8B855" /><stop offset="1" stopColor="#FF5A3A" />
          </linearGradient>
          <filter id="hud-glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <path d={arc(A0, A1, R)} fill="none" stroke="#1d1712" strokeWidth="16" strokeLinecap="round" />
        <path d={arc(A0, A1 - 24, R)} fill="none" stroke="url(#hud-arc)" strokeWidth="6" strokeLinecap="round" opacity="0.55" />
        <path d={arc(A1 - 24, A1, R)} fill="none" stroke="#FF5A3A" strokeWidth="8" strokeLinecap="round" filter="url(#hud-glow)" />
        {ticks.map((d, i) => {
          const [x0, y0] = pt(d, R - 14), [x1, y1] = pt(d, R - (i % 6 === 0 ? 30 : 22));
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={i >= 22 ? "#FF5A3A" : "#9A8030"} strokeWidth={i % 6 === 0 ? 2 : 1} />;
        })}
        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="#FFF0BE" strokeWidth="3" strokeLinecap="round" filter="url(#hud-glow)" />
        <circle cx={CX} cy={CY} r="9" fill="#0b0908" stroke="#D4AF37" strokeWidth="2" />
        <text x={pt(A0, R + 2)[0] + 6} y={pt(A0, R)[1] + 24} fill="#a3a09b" fontSize="11" textAnchor="middle">0x</text>
        <text x={pt(A1, R)[0] - 6} y={pt(A1, R)[1] + 24} fill="#FF5A3A" fontSize="11" textAnchor="middle">{NUM.needle.ceiling}x</text>
        <text x={CX} y={CY + 52} fill="#D4AF37" fontSize="30" textAnchor="middle" fontWeight="600" fontFamily="var(--font-mono), monospace">{NUM.needle.realised}x</text>
        <text x={CX} y={CY + 72} fill="#a3a09b" fontSize="11" textAnchor="middle" letterSpacing="1.5">REALISED OUTPUT</text>
        <text x={pt(A1 - 12, R + 4)[0] - 4} y={pt(A1 - 12, R)[1] - 14} fill="#FF5A3A" fontSize="9" textAnchor="end" letterSpacing="1.2">REDLINE</text>
      </svg>
      <figcaption style={{ textAlign: "center", marginTop: 6 }}>
        <div className="hud-label">Modelled ceiling: {NUM.needle.ceiling}x</div>
        <p className="hud-note" style={{ margin: "6px 0 0" }}>
          {NUM.needle.label}. Realised output is {NUM.needle.realised}x against a modelled ceiling of {NUM.needle.ceiling}x, {Number(pctText) < 1 ? "under 1%" : `${pctText}%`} of it, so the needle has barely moved. Realised is measured jobs per day; the ceiling is{" "}
          {NUM.facts.capacity.text.match(/\d+x/)?.[0]} capacity times {NUM.facts.cost_job.text.match(/\d+(?:\.\d+)?x/)?.[0]} cheaper jobs. {NUM.needle.method}.
        </p>
      </figcaption>
    </figure>
  );
}
