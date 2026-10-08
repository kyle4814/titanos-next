(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,72058,86043,e=>{"use strict";e.s(["fit",0,function(e,t){let o=Math.min(window.devicePixelRatio||1,1.5)*t,r=Math.max(2,Math.round(e.clientWidth*o)),a=Math.max(2,Math.round(e.clientHeight*o));(e.width!==r||e.height!==a)&&(e.width=r,e.height=a)},"fullscreenTriangle",0,function(e,t){let o=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,o),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW);let r=e.getAttribLocation(t,"aPos");e.enableVertexAttribArray(r),e.vertexAttribPointer(r,2,e.FLOAT,!1,0,0)},"getGL",0,function(e){return e.getContext("webgl",{antialias:!1,alpha:!0,premultipliedAlpha:!0,powerPreference:"low-power"})},"loop",0,function(e,t,o={}){let r=1e3/(o.fps??60)-1,a=0,i=0,n=!1,l=!1,c=0,s=0,u=performance.now(),f=e=>{if(a=0,l||!n||document.hidden)return;a=requestAnimationFrame(f);let v=e-i;v<r||(i&&(c++,s+=v,90===c&&(s/c>2*(r+1)&&o.onSlow&&(l=!0,o.onSlow()),c=0,s=0)),i=e,t((e-u)/1e3,v/1e3))},v=()=>{a||!n||l||document.hidden||(i=0,a=requestAnimationFrame(f))},m=new IntersectionObserver(e=>{n=e[0].isIntersecting,v()},{threshold:0});return m.observe(e),document.addEventListener("visibilitychange",v),()=>{l=!0,m.disconnect(),document.removeEventListener("visibilitychange",v),a&&cancelAnimationFrame(a)}},"lowPower",0,function(){let e=navigator;return window.matchMedia("(prefers-reduced-motion: reduce)").matches||!!e.connection?.saveData||void 0!==e.deviceMemory&&e.deviceMemory<=2||void 0!==e.hardwareConcurrency&&e.hardwareConcurrency<=2},"program",0,function(e,t,o){let r=(t,o)=>{let r=e.createShader(t);return e.shaderSource(r,o),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:null},a=r(e.VERTEX_SHADER,t),i=r(e.FRAGMENT_SHADER,o);if(!a||!i)return null;let n=e.createProgram();return e.attachShader(n,a),e.attachShader(n,i),e.linkProgram(n),e.getProgramParameter(n,e.LINK_STATUS)?n:null}],72058);let t="1.6180339887",o=`precision mediump float;
varying vec2 vUv; uniform vec2 uRes; uniform float uTime;
void main(){
  vec2 p = (vUv - 0.5) * vec2(uRes.x/uRes.y, 1.0) * 2.6;
  float a = uTime * 0.05;
  p = mat2(cos(a),-sin(a),sin(a),cos(a)) * p;
  float k = uTime * 0.04 * ${t};
  vec2 c = vec2(-0.745 + 0.04*cos(k), 0.113 + 0.04*sin(k*${t}));
  vec2 z = p; float it = 0.0; float m = 0.0;
  for (int i = 0; i < 40; i++) {
    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
    m = dot(z,z);
    if (m > 64.0) break;
    it += 1.0;
  }
  if (it > 39.5) { gl_FragColor = vec4(0.012, 0.018, 0.06, 1.0); return; }
  float s = it - log2(max(log2(max(m, 1.0001)), 1e-4)) ;
  float f = clamp(s / 40.0, 0.0, 1.0);
  vec3 deep = vec3(0.008,0.012,0.04);
  vec3 blue = vec3(0.24,0.36,0.85);
  vec3 vio  = vec3(0.45,0.30,0.95);
  vec3 gold = vec3(0.91,0.72,0.33);
  vec3 col = mix(deep, blue, smoothstep(0.0,0.5,f));
  col = mix(col, vio, smoothstep(0.35,0.75,f));
  col = mix(col, gold, smoothstep(0.78,1.0,f) * 0.9);
  float v = 1.0 - smoothstep(0.35, 1.25, length(vUv-0.5)*1.6);
  gl_FragColor = vec4(col * (0.3 + 1.5*f) * v, 1.0);
}`,r=`attribute vec4 aSeed; // x,y,z = random, w = strand parameter t
uniform float uProg, uTime, uAspect, uScale, uRot, uOffX;
varying float vGlow; varying float vHue;
const float PI = 3.14159265;
void main(){
  float t = aSeed.w;
  vec3 star = (aSeed.xyz - 0.5) * vec3(5.0, 3.2, 4.0);
  star.z += mod(uTime*0.12 + aSeed.x*4.0, 4.0) - 2.0;
  float k = floor(aSeed.x*3.0);
  float ang = t*PI*2.0*3.0 + k*PI*2.0/3.0;
  vec3 braid = vec3((t-0.5)*4.4, cos(ang)*0.42, sin(ang)*0.42) + (aSeed.yzx-0.5)*0.05;
  float u = t*PI*2.0;
  vec3 knot = vec3(sin(u)+2.0*sin(2.0*u), cos(u)-2.0*cos(2.0*u), -sin(3.0*u)) * 0.42;
  knot += (aSeed.zxy-0.5) * 0.09;
  float a = smoothstep(0.0,1.0,uProg);
  float b = smoothstep(1.0,2.0,uProg);
  vec3 pos = mix(mix(star, braid, a), knot, b);
  float r = uRot + 0.45*sin(uTime*0.17)*b;
  pos.xz = mat2(cos(r),-sin(r),sin(r),cos(r)) * pos.xz;
  pos.xy = mat2(cos(r*0.4),-sin(r*0.4),sin(r*0.4),cos(r*0.4)) * pos.xy;
  float depth = 5.0 - pos.z;
  vec2 ndc = pos.xy / depth * uScale * 2.6;
  ndc.x /= uAspect;
  gl_Position = vec4(ndc + vec2(uOffX * b, 0.0), 0.0, 1.0);
  gl_PointSize = clamp((0.9 + aSeed.y*1.5) * uScale * 70.0 / depth, 1.0, 6.0);
  vGlow = 0.12 + 0.3*aSeed.z;
  vHue = mix(aSeed.y, t, a);
}`,a=`precision mediump float;
varying float vGlow; varying float vHue;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d,d)*4.0;
  float a = (1.0 - r) * (1.0 - r);
  if (a <= 0.0) discard;
  vec3 cool = vec3(0.62,0.74,1.0);
  vec3 warm = vec3(1.0,0.84,0.5);
  vec3 col = mix(cool, warm, smoothstep(0.55,0.95,vHue));
  gl_FragColor = vec4(col * a * vGlow, a * vGlow);
}`,i=`precision mediump float;
varying vec2 vUv; uniform vec2 uRes; uniform float uTime;
void main(){
  vec2 p = (vUv - 0.5) * vec2(uRes.x/uRes.y, 1.0) * 2.0;
  p.x *= 0.5;
  float r = length(p);
  float th = atan(p.y, p.x);
  float w = sin(p.x*3.0 + uTime*0.3) * 0.08 + sin(p.y*4.0 - uTime*0.25) * 0.06;
  r += w * smoothstep(0.1, 0.8, r);
  float arms = sin(th*${t} * 2.0 + log(max(r,0.001)) * 6.0 * ${t} - uTime*0.8);
  float disc = smoothstep(0.95, 0.15, r);
  float ring = exp(-pow((r - 0.2) * 14.0, 2.0));
  float core = smoothstep(0.17, 0.2, r);
  vec3 gold = vec3(1.0,0.78,0.36);
  vec3 vio = vec3(0.45,0.32,0.95);
  vec3 col = vio * disc * (0.25 + 0.35*arms) * 0.7 + gold * ring * (0.7 + 0.5*arms);
  float alpha = clamp((disc*0.5 + ring) * core, 0.0, 1.0);
  gl_FragColor = vec4(col * core * alpha, alpha);
}`,n=`attribute float aI;
uniform float uTime, uAspect, uN;
varying float vA;
void main(){
  float ga = 2.39996323;
  float ang = aI*ga + uTime*0.06;
  float rad = sqrt(aI/uN);
  vec2 p = vec2(cos(ang), sin(ang)) * rad * 0.92;
  p.x /= uAspect;
  gl_Position = vec4(p, 0., 1.);
  float tw = 0.65 + 0.35*sin(uTime*1.3 + aI*0.7);
  gl_PointSize = 1.5 + 3.5*(1.0-rad)*tw;
  vA = (0.25 + 0.75*(1.0-rad)) * tw;
}`,l=`precision mediump float;
varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float a = clamp(1.0 - dot(d,d)*4.0, 0.0, 1.0);
  vec3 col = mix(vec3(1.0,0.84,0.5), vec3(0.62,0.74,1.0), 0.35);
  gl_FragColor = vec4(col*a*a*vA, a*a*vA);
}`;e.s(["FULLSCREEN_VS",0,"attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }","JULIA_FS",0,o,"KNOT_FS",0,a,"KNOT_VS",0,r,"PORTAL_FS",0,i,"SPIRAL_FS",0,l,"SPIRAL_VS",0,n],86043)},27028,e=>{"use strict";var t=e.i(43476),o=e.i(71645),r=e.i(72058),a=e.i(86043);e.s(["default",0,function(){let e=(0,o.useRef)(null),i=(0,o.useRef)(null),[n,l]=(0,o.useState)(!1);return(0,o.useEffect)(()=>{let t=i.current,o=e.current;if(!t||!o||(0,r.lowPower)())return;let n=(0,r.getGL)(t);if(!n)return;let c=(0,r.program)(n,a.FULLSCREEN_VS,a.PORTAL_FS);if(!c)return;n.useProgram(c),(0,r.fullscreenTriangle)(n,c);let s=n.getUniformLocation(c,"uRes"),u=n.getUniformLocation(c,"uTime");return(0,r.loop)(o,e=>{(0,r.fit)(t,.5),n.viewport(0,0,t.width,t.height),n.clearColor(0,0,0,0),n.clear(n.COLOR_BUFFER_BIT),n.uniform2f(s,t.width,t.height),n.uniform1f(u,e),n.drawArrays(n.TRIANGLES,0,3),l(!0)},{fps:60,onSlow:()=>l(!1)})},[]),(0,t.jsxs)("div",{ref:e,className:"ds-portal","aria-hidden":"true",children:[!n&&(0,t.jsx)("div",{className:"ds-portal__fallback"}),(0,t.jsx)("canvas",{ref:i,style:{opacity:+!!n}})]})}])},81689,e=>{"use strict";var t=e.i(43476),o=e.i(71645),r=e.i(72058),a=e.i(86043);e.s(["default",0,function(){let e=(0,o.useRef)(null),i=(0,o.useRef)(null);return(0,o.useEffect)(()=>{let t=i.current,o=e.current;if(!t||!o||(0,r.lowPower)())return;let n=(0,r.getGL)(t);if(!n)return;let l=(0,r.program)(n,a.SPIRAL_VS,a.SPIRAL_FS);if(!l)return;n.useProgram(l);let c=new Float32Array(1600);for(let e=0;e<1600;e++)c[e]=e;n.bindBuffer(n.ARRAY_BUFFER,n.createBuffer()),n.bufferData(n.ARRAY_BUFFER,c,n.STATIC_DRAW);let s=n.getAttribLocation(l,"aI");n.enableVertexAttribArray(s),n.vertexAttribPointer(s,1,n.FLOAT,!1,0,0);let u=n.getUniformLocation(l,"uTime"),f=n.getUniformLocation(l,"uAspect"),v=n.getUniformLocation(l,"uN");return n.enable(n.BLEND),n.blendFunc(n.ONE,n.ONE),(0,r.loop)(o,e=>{(0,r.fit)(t,1),n.viewport(0,0,t.width,t.height),n.clearColor(0,0,0,0),n.clear(n.COLOR_BUFFER_BIT),n.uniform1f(u,e),n.uniform1f(f,t.width/t.height),n.uniform1f(v,1600),n.drawArrays(n.POINTS,0,1600)})},[]),(0,t.jsx)("div",{ref:e,className:"ds-spiral","aria-hidden":"true",children:(0,t.jsx)("canvas",{ref:i})})}])}]);