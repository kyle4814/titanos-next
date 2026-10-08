// Tiny raw-WebGL helpers (no three.js on first load: the hero scene must fit the 250 KB JS budget).
export type FrameFn = (t: number, dt: number) => void;

export function lowPower(): boolean {
  if (typeof window === "undefined") return true;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !!nav.connection?.saveData ||
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2)
  );
}

/** `onLost` fires on webglcontextlost (default prevented so restore is possible); callers fall back to the poster. */
export function getGL(canvas: HTMLCanvasElement, onLost?: () => void): WebGLRenderingContext | null {
  if (onLost) canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); onLost(); }, { once: true });
  return canvas.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "low-power" }) as WebGLRenderingContext | null;
}

export function program(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const v = sh(gl.VERTEX_SHADER, vs);
  const f = sh(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const p = gl.createProgram()!;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
}

/** Bind a fullscreen triangle to attribute `aPos` of the current program. */
export function fullscreenTriangle(gl: WebGLRenderingContext, p: WebGLProgram) {
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(p, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

/** Re-reads the canvas box only when a ResizeObserver says it changed (no layout read every frame). */
export function sizer(canvas: HTMLCanvasElement, scale: number) {
  let dirty = true;
  const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => { dirty = true; });
  ro?.observe(canvas);
  return { fit() { if (dirty || !ro) { dirty = false; fit(canvas, scale); } }, off() { ro?.disconnect(); } };
}

export const isSmall = (): boolean => typeof window !== "undefined" && window.innerWidth < 800;

export function fit(canvas: HTMLCanvasElement, scale: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
  const w = Math.max(2, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(2, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

/**
 * Run `frame` at most `fps` times a second, only while `target` is on screen and the tab is visible.
 * `onSlow` fires once if the average frame gap over ~90 frames is worse than 2x the budget (device cannot keep up).
 * Returns a stop function.
 */
export function loop(target: Element, frame: FrameFn, opts: { fps?: number; onSlow?: () => void } = {}) {
  const gap = 1000 / (opts.fps ?? 60) - 1;
  let raf = 0, last = 0, visible = false, stopped = false, n = 0, sum = 0;
  const t0 = performance.now();
  const tick = (now: number) => {
    raf = 0;
    if (stopped || !visible || document.hidden) return;
    raf = requestAnimationFrame(tick);
    const dt = now - last;
    if (dt < gap) return;
    if (last) {
      n++; sum += dt;
      if (n === 90) { if (sum / n > 2 * (gap + 1) && opts.onSlow) { stopped = true; opts.onSlow(); } n = 0; sum = 0; }
    }
    last = now;
    frame((now - t0) / 1000, dt / 1000);
  };
  const kick = () => { if (!raf && visible && !stopped && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } };
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; kick(); }, { threshold: 0 });
  io.observe(target);
  document.addEventListener("visibilitychange", kick);
  return () => {
    stopped = true;
    io.disconnect();
    document.removeEventListener("visibilitychange", kick);
    if (raf) cancelAnimationFrame(raf);
  };
}
