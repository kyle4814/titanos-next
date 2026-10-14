"use client";

import { useEffect, useState, type ComponentType } from "react";
import s from "./HeroMesh.module.css";

/**
 * Hero GPU layer (house look). A static black-ice + gold gradient always renders (server-side, zero JS).
 * The animated Paper Shaders MeshGradient (~8 KB, its own lazy chunk) loads ONLY when:
 *  - the user has not asked for reduced motion or save-data,
 *  - a real WebGPU adapter resolves (navigator.gpu.requestAdapter()),
 *  - and the first real interaction (pointer, key, touch, scroll) has happened.
 * Otherwise the static gradient is the final state.
 */
type SaveDataNav = Navigator & { connection?: { saveData?: boolean }; gpu?: { requestAdapter: () => Promise<unknown> } };

export default function HeroMesh() {
  const [Gpu, setGpu] = useState<ComponentType | null>(null);

  useEffect(() => {
    const nav = navigator as SaveDataNav;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (nav.connection?.saveData) return;
    if (!nav.gpu) return;

    let dead = false;
    const events = ["pointerdown", "pointermove", "keydown", "touchstart", "scroll"] as const;
    const off = () => events.forEach((e) => window.removeEventListener(e, go));

    async function go() {
      off();
      try {
        const adapter = await nav.gpu!.requestAdapter();
        if (!adapter || dead) return;
        const mod = await import("./HeroMeshGpu");
        if (!dead) setGpu(() => mod.default);
      } catch {
        /* static gradient stays */
      }
    }
    events.forEach((e) => window.addEventListener(e, go, { passive: true, once: false }));
    return () => {
      dead = true;
      off();
    };
  }, []);

  return (
    <div className={s.mesh} aria-hidden="true">
      <div className={s.fallback} />
      {Gpu ? (
        <div className={s.gpu}>
          <Gpu />
        </div>
      ) : null}
    </div>
  );
}
