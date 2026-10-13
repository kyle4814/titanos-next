(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,81689,e=>{"use strict";var t=e.i(43476),r=e.i(71645);let i=`attribute float aI;
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
}`,a=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float a = clamp(1.0 - dot(d,d)*4.0, 0.0, 1.0);
  vec3 col = mix(vec3(1.0,0.84,0.5), vec3(0.62,0.74,1.0), 0.35);
  gl_FragColor = vec4(col*a*a*vA, a*a*vA);
}`;e.s(["default",0,function(){let e=(0,r.useRef)(null),n=(0,r.useRef)(null);return(0,r.useEffect)(()=>{var t;let r,o,l,c,d=n.current,u=e.current;if(!d||!u||(o=navigator,window.matchMedia("(prefers-reduced-motion: reduce)").matches||o.connection?.saveData||void 0!==o.deviceMemory&&o.deviceMemory<=2||void 0!==o.hardwareConcurrency&&o.hardwareConcurrency<=2))return;let f=((t=()=>{r?.(),d.style.display="none"})&&d.addEventListener("webglcontextlost",e=>{e.preventDefault(),t()},{once:!0}),d.getContext("webgl",{antialias:!1,alpha:!0,premultipliedAlpha:!0,powerPreference:"low-power"}));if(!f)return;let s=function(e,t,r){let i=(t,r)=>{let i=e.createShader(t);return e.shaderSource(i,r),e.compileShader(i),e.getShaderParameter(i,e.COMPILE_STATUS)?i:null},a=i(e.VERTEX_SHADER,t),n=i(e.FRAGMENT_SHADER,r);if(!a||!n)return null;let o=e.createProgram();return e.attachShader(o,a),e.attachShader(o,n),e.linkProgram(o),e.getProgramParameter(o,e.LINK_STATUS)?o:null}(f,i,a);if(!s)return;f.useProgram(s);let m=new Float32Array(1600);for(let e=0;e<1600;e++)m[e]=e;f.bindBuffer(f.ARRAY_BUFFER,f.createBuffer()),f.bufferData(f.ARRAY_BUFFER,m,f.STATIC_DRAW);let h=f.getAttribLocation(s,"aI");f.enableVertexAttribArray(h),f.vertexAttribPointer(h,1,f.FLOAT,!1,0,0);let v=f.getUniformLocation(s,"uTime"),g=f.getUniformLocation(s,"uAspect"),A=f.getUniformLocation(s,"uN");f.enable(f.BLEND),f.blendFunc(f.ONE,f.ONE);let p=(l=!0,c="u"<typeof ResizeObserver?null:new ResizeObserver(()=>{l=!0}),c?.observe(d),{fit(){var e;let t,r,i;(l||!c)&&(l=!1,e=d,t=+Math.min(window.devicePixelRatio||1,1.5),r=Math.max(2,Math.round(e.clientWidth*t)),i=Math.max(2,Math.round(e.clientHeight*t)),(e.width!==r||e.height!==i)&&(e.width=r,e.height=i))},off(){c?.disconnect()}}),w=function(e,t,r={}){let i=1e3/(r.fps??60)-1,a=0,n=0,o=!1,l=!1,c=0,d=0,u=performance.now(),f=e=>{if(a=0,l||!o||document.hidden)return;a=requestAnimationFrame(f);let s=e-n;s<i||(n&&(c++,d+=s,90===c&&(d/c>2*(i+1)&&r.onSlow&&(l=!0,r.onSlow()),c=0,d=0)),n=e,t((e-u)/1e3,s/1e3))},s=()=>{a||!o||l||document.hidden||(n=0,a=requestAnimationFrame(f))},m=new IntersectionObserver(e=>{o=e[0].isIntersecting,s()},{threshold:0});return m.observe(e),document.addEventListener("visibilitychange",s),()=>{l=!0,m.disconnect(),document.removeEventListener("visibilitychange",s),a&&cancelAnimationFrame(a)}}(u,e=>{p.fit(),f.viewport(0,0,d.width,d.height),f.clearColor(0,0,0,0),f.clear(f.COLOR_BUFFER_BIT),f.uniform1f(v,e),f.uniform1f(g,d.width/d.height),f.uniform1f(A,1600),f.drawArrays(f.POINTS,0,1600)},{fps:window.innerWidth<800?30:60});return r=()=>{w(),p.off()}},[]),(0,t.jsx)("div",{ref:e,className:"ds-spiral","aria-hidden":"true",children:(0,t.jsx)("canvas",{ref:n})})}],81689)}]);