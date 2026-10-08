"use client";

/** Section-transition effect: a domain-warped spiral with a dark core and a gold accretion edge. Static CSS
 *  fallback (also the SSR HTML) for reduced motion, low power and no-WebGL; the shader pauses off-screen. */
import { useEffect, useRef, useState } from "react";
import { fit, fullscreenTriangle, getGL, loop, lowPower, program } from "@/lib/gl";
import { FULLSCREEN_VS, PORTAL_FS } from "@/lib/shaders";

export default function VoidPortal() {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const c = cv.current, b = box.current;
    if (!c || !b || lowPower()) return;
    const gl = getGL(c);
    if (!gl) return;
    const p = program(gl, FULLSCREEN_VS, PORTAL_FS);
    if (!p) return;
    gl.useProgram(p);
    fullscreenTriangle(gl, p);
    const uRes = gl.getUniformLocation(p, "uRes"), uTime = gl.getUniformLocation(p, "uTime");
    const stop = loop(b, (t) => {
      fit(c, 0.5);
      gl.viewport(0, 0, c.width, c.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, c.width, c.height);
      gl.uniform1f(uTime, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      setLive(true);
    }, { fps: 60, onSlow: () => setLive(false) });
    return stop;
  }, []);

  return (
    <div ref={box} className="ds-portal" aria-hidden="true">
      {!live && <div className="ds-portal__fallback" />}
      <canvas ref={cv} style={{ opacity: live ? 1 : 0 }} />
    </div>
  );
}
