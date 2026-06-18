"use client";

/**
 * VaultBackground — W4 Pillar 3 Layers 3 + 4.
 *
 * Mounts behind everything. Two pieces:
 *   1. Conic gradient mesh: 3 drifting radial-gradient blobs, ~5-8%
 *      opacity, slowly rotating. Pure CSS, no JS, zero perf cost.
 *   2. Specular gold sweep: 8s diagonal light-ray (CSS keyframe in
 *      globals.css `.vault-specular`).
 *
 * MOT-01: both layers hidden under prefers-reduced-motion (CSS media
 *   query handles it; component still mounts but visual is gated).
 *
 * Also pauses both layers when the tab is hidden (visibilityState !==
 * 'visible'). Battery + politeness.
 */

import { useEffect, useState } from "react";

export default function VaultBackground() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => setVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* Layer 3 — Conic gradient mesh (drifting blobs).
          Pure CSS. Three radial blobs, each tied to a long-loop
          CSS animation. Layered with screen blend so they tint the
          base canvas without overpowering it. */}
      <div
        aria-hidden="true"
        className="vault-mesh"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <span className="vault-blob vault-blob-1" />
        <span className="vault-blob vault-blob-2" />
        <span className="vault-blob vault-blob-3" />
      </div>

      {/* Layer 4 — Specular gold sweep (8s loop) */}
      <span aria-hidden="true" className="vault-specular" />

      <style>{`
        .vault-blob {
          position: absolute;
          width: 60vmax;
          height: 60vmax;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.18;
          will-change: transform;
          mix-blend-mode: screen;
        }
        .vault-blob-1 {
          background: radial-gradient(circle, var(--gold-warm), transparent 65%);
          top: -20vmax;
          left: -20vmax;
          animation: vault-drift-1 40s linear infinite;
        }
        .vault-blob-2 {
          background: radial-gradient(circle, var(--gold-cool), transparent 65%);
          bottom: -25vmax;
          right: -20vmax;
          animation: vault-drift-2 56s linear infinite;
          opacity: 0.14;
        }
        .vault-blob-3 {
          background: radial-gradient(circle, var(--ember), transparent 60%);
          top: 40vh;
          left: 40vw;
          width: 30vmax;
          height: 30vmax;
          opacity: 0.05;
          animation: vault-drift-3 72s linear infinite;
        }

        /* Mobile tunings —
           1. filter: blur(120px) over-taxes mobile GPUs; iOS Safari often
              silently rasterises the element at very low quality. Drop to
              60px so it actually renders.
           2. Bump opacity ~2× because brighter mobile screens + smaller
              blob area = the subtler desktop values disappear in glare.
           3. Tighten blob positions so they land WITHIN the viewport at
              375-430px widths — desktop's -20vmax offsets push them off-
              screen on phones. */
        @media (max-width: 720px) {
          .vault-blob { filter: blur(60px); }
          .vault-blob-1 {
            top: -15vmax; left: -15vmax;
            width: 55vmax; height: 55vmax;
            opacity: 0.32;
          }
          .vault-blob-2 {
            bottom: -18vmax; right: -15vmax;
            width: 55vmax; height: 55vmax;
            opacity: 0.26;
          }
          .vault-blob-3 {
            top: 30vh; left: 20vw;
            width: 40vmax; height: 40vmax;
            opacity: 0.1;
          }
        }
        @keyframes vault-drift-1 {
          0%   { transform: translate(0, 0) rotate(0deg); }
          50%  { transform: translate(20vw, 15vh) rotate(180deg); }
          100% { transform: translate(0, 0) rotate(360deg); }
        }
        @keyframes vault-drift-2 {
          0%   { transform: translate(0, 0) rotate(0deg); }
          50%  { transform: translate(-15vw, -20vh) rotate(-180deg); }
          100% { transform: translate(0, 0) rotate(-360deg); }
        }
        @keyframes vault-drift-3 {
          0%   { transform: translate(0, 0); }
          50%  { transform: translate(15vw, -10vh); }
          100% { transform: translate(0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .vault-blob { animation: none; }
        }
      `}</style>
    </>
  );
}
