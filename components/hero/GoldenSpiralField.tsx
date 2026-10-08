"use client";

/** Fibonacci / golden-angle (137.5 degree) particle field for the loop section. Paused off-screen. */
import { useEffect, useRef } from "react";
import { fit, getGL, loop, lowPower, program } from "@/lib/gl";
import { SPIRAL_FS, SPIRAL_VS } from "@/lib/shaders";

const N = 1600;

export default function GoldenSpiralField() {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = cv.current, b = box.current;
    if (!c || !b || lowPower()) return;
    const gl = getGL(c);
    if (!gl) return;
    const p = program(gl, SPIRAL_VS, SPIRAL_FS);
    if (!p) return;
    gl.useProgram(p);
    const idx = new Float32Array(N);
    for (let i = 0; i < N; i++) idx[i] = i;
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, "aI");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 0, 0);
    const uTime = gl.getUniformLocation(p, "uTime"), uAspect = gl.getUniformLocation(p, "uAspect"), uN = gl.getUniformLocation(p, "uN");
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    return loop(b, (t) => {
      fit(c, 1);
      gl.viewport(0, 0, c.width, c.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, t);
      gl.uniform1f(uAspect, c.width / c.height);
      gl.uniform1f(uN, N);
      gl.drawArrays(gl.POINTS, 0, N);
    });
  }, []);

  return (
    <div ref={box} className="ds-spiral" aria-hidden="true">
      <canvas ref={cv} />
    </div>
  );
}
