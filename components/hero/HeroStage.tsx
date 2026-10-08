"use client";

/**
 * HeroStage: the WebGL layer of the hero. Server HTML carries the static poster (the LCP element) and the
 * copy; this component mounts after the page is idle, draws a Julia-set galactic fractal on one canvas and
 * the starfield -> braid -> knot point scene on a second, then fades the poster out. Skipped entirely for
 * reduced motion, save-data, and low-power devices; falls back to the poster if frames run slow.
 */
import { useEffect, useRef } from "react";
import { PHI } from "@/lib/phi";
import { fit, fullscreenTriangle, getGL, loop, lowPower, program } from "@/lib/gl";
import { FULLSCREEN_VS, JULIA_FS, KNOT_FS, KNOT_VS } from "@/lib/shaders";

const POINTS = 7000;

/** Timeline in seconds (phi steps): hold 0.62, starfield -> braid 1.62, hold 1, braid -> knot 1.62. */
function progress(t: number): number {
  const a = Math.min(Math.max((t - 0.62) / 1.62, 0), 1);
  const b = Math.min(Math.max((t - 0.62 - 1.62 - 1) / 1.62, 0), 1);
  return a + b;
}

export default function HeroStage() {
  const julia = useRef<HTMLCanvasElement>(null);
  const stars = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const jc = julia.current, sc = stars.current;
    if (!jc || !sc || lowPower()) return;
    const hero = sc.closest(".ds-hero");
    if (!hero) return;
    let stop: (() => void) | undefined;
    let cancelled = false;

    const start = () => {
      if (cancelled) return;
      const jg = getGL(jc), sg = getGL(sc);
      if (!jg || !sg) return;
      const jp = program(jg, FULLSCREEN_VS, JULIA_FS);
      const sp = program(sg, KNOT_VS, KNOT_FS);
      if (!jp || !sp) return;

      jg.useProgram(jp);
      fullscreenTriangle(jg, jp);
      const jRes = jg.getUniformLocation(jp, "uRes"), jTime = jg.getUniformLocation(jp, "uTime");

      sg.useProgram(sp);
      const seed = new Float32Array(POINTS * 4);
      for (let i = 0; i < POINTS; i++) {
        seed[i * 4] = Math.random();
        seed[i * 4 + 1] = Math.random();
        seed[i * 4 + 2] = Math.random();
        seed[i * 4 + 3] = i / POINTS;
      }
      const buf = sg.createBuffer();
      sg.bindBuffer(sg.ARRAY_BUFFER, buf);
      sg.bufferData(sg.ARRAY_BUFFER, seed, sg.STATIC_DRAW);
      const loc = sg.getAttribLocation(sp, "aSeed");
      sg.enableVertexAttribArray(loc);
      sg.vertexAttribPointer(loc, 4, sg.FLOAT, false, 0, 0);
      const u = (n: string) => sg.getUniformLocation(sp, n);
      const uProg = u("uProg"), uTime = u("uTime"), uAspect = u("uAspect"), uScale = u("uScale"), uRot = u("uRot"), uOffX = u("uOffX");
      sg.enable(sg.BLEND);
      sg.blendFunc(sg.ONE, sg.ONE);

      const small = window.innerWidth < 800;
      let live = false;

      stop = loop(hero, (t) => {
        fit(jc, small ? 0.3 : 0.4);
        fit(sc, small ? 0.8 : 1);
        jg.viewport(0, 0, jc.width, jc.height);
        jg.uniform2f(jRes, jc.width, jc.height);
        jg.uniform1f(jTime, t);
        jg.drawArrays(jg.TRIANGLES, 0, 3);

        sg.viewport(0, 0, sc.width, sc.height);
        sg.clearColor(0, 0, 0, 0);
        sg.clear(sg.COLOR_BUFFER_BIT);
        const aspect = sc.width / sc.height;
        sg.uniform1f(uProg, progress(t));
        sg.uniform1f(uTime, t);
        sg.uniform1f(uAspect, aspect);
        // The knot sits in the 38.2% side on wide screens, centred behind the copy on phones.
        sg.uniform1f(uScale, aspect > 1 ? 0.8 : 0.5);
        sg.uniform1f(uOffX, aspect > 1 ? 0.5 : 0.0);
        sg.uniform1f(uRot, window.scrollY * 0.0018 * PHI);
        sg.drawArrays(sg.POINTS, 0, POINTS);
        if (!live) { live = true; hero.classList.add("is-live"); }
      }, {
        fps: 60,
        onSlow: () => hero.classList.remove("is-live"),
      });
    };

    // Let the poster paint (LCP) first; the shader fades in after.
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const id = ric ? ric(start, { timeout: 2500 }) : window.setTimeout(start, 1200);
    return () => {
      cancelled = true;
      if (ric) (window as unknown as { cancelIdleCallback: (n: number) => void }).cancelIdleCallback(id);
      else clearTimeout(id);
      stop?.();
    };
  }, []);

  return (
    <>
      <canvas ref={julia} className="ds-hero__julia" aria-hidden="true" />
      <canvas ref={stars} className="ds-hero__stars" aria-hidden="true" />
    </>
  );
}
