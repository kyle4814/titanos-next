"use client";

/**
 * ShaderBackdrop: a MeshGradient (Paper Shaders, ~8 KB lazy chunk) behind a section.
 * The shader loads only when ALL hold: a real navigator.gpu adapter exists, the user has
 * interacted once (pointer, key, touch or scroll), reduced motion is off, and save-data is off.
 * Until then (and for everyone who fails a gate) it renders the CSS gradient fallback, so there is
 * never an empty box. Mount inside a position:relative parent; it is absolutely positioned,
 * pointer-events none, aria-hidden. Colours default to the black ice + gold brand.
 */
import { lazy, Suspense, useEffect, useState } from "react";

const Mesh = lazy(() => import("@paper-design/shaders-react").then((m) => ({ default: m.MeshGradient })));

type Props = {
  colors?: string[];
  speed?: number;
  className?: string;
};

const BRAND = ["#0b0908", "#1a1410", "#3a2a0e", "#e8b855"];

async function gpuOk(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    if (!gpu) return false;
    return Boolean(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

export default function ShaderBackdrop({ colors = BRAND, speed = 0.25, className }: Props) {
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    let done = false;
    const events = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"] as const;
    const go = async () => {
      if (done) return;
      done = true;
      events.forEach((e) => window.removeEventListener(e, go));
      if (await gpuOk()) setLive(true);
    };
    events.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }));
    return () => {
      done = true;
      events.forEach((e) => window.removeEventListener(e, go));
    };
  }, []);

  return (
    <div className={`h-shader${className ? ` ${className}` : ""}`} aria-hidden="true">
      {live && (
        <Suspense fallback={null}>
          <Mesh colors={colors} speed={speed} distortion={0.6} swirl={0.2} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        </Suspense>
      )}
    </div>
  );
}
