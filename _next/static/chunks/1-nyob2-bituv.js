(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,42724,e=>{"use strict";var t=e.i(43476),n=e.i(22016);e.i(47167);var i=e.i(71645),r=e.i(31178),a=e.i(47414),o=e.i(74008),s=e.i(21476),l=e.i(72846),d=i,c=e.i(37806);function u(e,t){if("function"==typeof e)return e(t);null!=e&&(e.current=t)}class f extends d.Component{getSnapshotBeforeUpdate(e){let t=this.props.childRef.current;if((0,l.isHTMLElement)(t)&&e.isPresent&&!this.props.isPresent&&!1!==this.props.pop){let e=t.offsetParent,n=(0,l.isHTMLElement)(e)&&e.offsetWidth||0,i=(0,l.isHTMLElement)(e)&&e.offsetHeight||0,r=getComputedStyle(t),a=this.props.sizeRef.current;a.height=parseFloat(r.height),a.width=parseFloat(r.width),a.top=t.offsetTop,a.left=t.offsetLeft,a.right=n-a.width-a.left,a.bottom=i-a.height-a.top,a.direction=r.direction}return null}componentDidUpdate(){}render(){return this.props.children}}function m({children:e,isPresent:n,anchorX:r,anchorY:a,root:o,pop:s}){let l=(0,d.useId)(),p=(0,d.useRef)(null),h=(0,d.useRef)({width:0,height:0,top:0,left:0,right:0,bottom:0,direction:"ltr"}),{nonce:v}=(0,d.useContext)(c.MotionConfigContext),g=function(...e){return i.useCallback(function(...e){return t=>{let n=!1,i=e.map(e=>{let i=u(e,t);return n||"function"!=typeof i||(n=!0),i});if(n)return()=>{for(let t=0;t<i.length;t++){let n=i[t];"function"==typeof n?n():u(e[t],null)}}}}(...e),e)}(p,e.props?.ref??e?.ref);return(0,d.useInsertionEffect)(()=>{let{width:e,height:t,top:i,left:d,right:c,bottom:u,direction:f}=h.current;if(n||!1===s||!p.current||!e||!t)return;let m="rtl"===f,g="left"===r?m?`right: ${c}`:`left: ${d}`:m?`left: ${d}`:`right: ${c}`,x="bottom"===a?`bottom: ${u}`:`top: ${i}`;p.current.dataset.motionPopId=l;let b=document.createElement("style");v&&(b.nonce=v);let y=o??document.head;return y.appendChild(b),b.sheet&&b.sheet.insertRule(`
          [data-motion-pop-id="${l}"] {
            position: absolute !important;
            width: ${e}px !important;
            height: ${t}px !important;
            ${g}px !important;
            ${x}px !important;
          }
        `),()=>{p.current?.removeAttribute("data-motion-pop-id"),y.contains(b)&&y.removeChild(b)}},[n]),(0,t.jsx)(f,{isPresent:n,childRef:p,sizeRef:h,pop:s,children:!1===s?e:d.cloneElement(e,{ref:g})})}let p=({children:e,initial:n,isPresent:r,onExitComplete:o,custom:l,presenceAffectsLayout:d,mode:c,anchorX:u,anchorY:f,root:p})=>{let v=(0,a.useConstant)(h),g=(0,i.useId)(),x=!0,b=(0,i.useMemo)(()=>(x=!1,{id:g,initial:n,isPresent:r,custom:l,onExitComplete:e=>{for(let t of(v.set(e,!0),v.values()))if(!t)return;o&&o()},register:e=>(v.set(e,!1),()=>v.delete(e))}),[r,v,o]);return d&&x&&(b={...b}),(0,i.useMemo)(()=>{v.forEach((e,t)=>v.set(t,!1))},[r]),i.useEffect(()=>{r||v.size||!o||o()},[r]),e=(0,t.jsx)(m,{pop:"popLayout"===c,isPresent:r,anchorX:u,anchorY:f,root:p,children:e}),(0,t.jsx)(s.PresenceContext.Provider,{value:b,children:e})};function h(){return new Map}var v=e.i(64978);let g=e=>e.key||"";function x(e){let t=[];return i.Children.forEach(e,e=>{(0,i.isValidElement)(e)&&t.push(e)}),t}let b=({children:e,custom:n,initial:s=!0,onExitComplete:l,presenceAffectsLayout:d=!0,mode:c="sync",propagate:u=!1,anchorX:f="left",anchorY:m="top",root:h})=>{let[b,y]=(0,v.usePresence)(u),w=(0,i.useMemo)(()=>x(e),[e]),k=u&&!b?[]:w.map(g),j=(0,i.useRef)(!0),E=(0,i.useRef)(w),S=(0,a.useConstant)(()=>new Map),C=(0,i.useRef)(new Set),[A,I]=(0,i.useState)(w),[T,M]=(0,i.useState)(w);(0,o.useIsomorphicLayoutEffect)(()=>{j.current=!1,E.current=w;for(let e=0;e<T.length;e++){let t=g(T[e]);k.includes(t)?(S.delete(t),C.current.delete(t)):!0!==S.get(t)&&S.set(t,!1)}},[T,k.length,k.join("-")]);let L=[];if(w!==A){let e=[...w];for(let t=0;t<T.length;t++){let n=T[t],i=g(n);k.includes(i)||(e.splice(t,0,n),L.push(n))}return"wait"===c&&L.length&&(e=L),M(x(e)),I(w),null}let{forceRender:F}=(0,i.useContext)(r.LayoutGroupContext);return(0,t.jsx)(t.Fragment,{children:T.map(e=>{let i=g(e),r=(!u||!!b)&&(w===T||k.includes(i));return(0,t.jsx)(p,{isPresent:r,initial:(!j.current||!!s)&&void 0,custom:n,presenceAffectsLayout:d,mode:c,root:h,onExitComplete:r?void 0:()=>{if(C.current.has(i)||!S.has(i))return;C.current.add(i),S.set(i,!0);let e=!0;S.forEach(t=>{t||(e=!1)}),e&&(F?.(),M(E.current),u&&y?.(),l&&l())},anchorX:f,anchorY:m,children:e},i)})})};var y=e.i(46932),w=e.i(72328),k=e.i(74080),j=e.i(61664),E=e.i(25616);let S=[{label:"Free AI Audit",href:"/audit",external:!1},{label:"AI Partnership",href:"/ai-delivery",external:!1},{label:"Compliance",href:"/compliance",external:!1},{label:"Monitor",href:"/monitor",external:!1},{label:"Leads",href:"/leads",external:!1},{label:"Free Scan",href:"/scan",external:!1},{label:"Evidence Pack",href:"/our-evidence-pack",external:!1},{label:"Methodology",href:"/methodology",external:!1},{label:"About",href:"/about",external:!1},{label:"Contact",href:"/contact",external:!1}];function C({open:e,reduce:n}){let i=.22*!n,r=[.4,0,.2,1];return(0,t.jsxs)("span",{"aria-hidden":"true",style:{position:"relative",display:"inline-block",width:18,height:14},children:[(0,t.jsx)(y.motion.span,{animate:e?{rotate:45,top:6}:{rotate:0,top:0},transition:{duration:i,ease:r},style:{position:"absolute",top:0,left:0,right:0,height:1.5,background:"var(--gold)",transformOrigin:"center"}}),(0,t.jsx)(y.motion.span,{animate:e?{opacity:0}:{opacity:1},transition:{duration:i,ease:r},style:{position:"absolute",top:6,left:0,right:0,height:1.5,background:"var(--gold)"}}),(0,t.jsx)(y.motion.span,{animate:e?{rotate:-45,top:6}:{rotate:0,top:12},transition:{duration:i,ease:r},style:{position:"absolute",top:12,left:0,right:0,height:1.5,background:"var(--gold)",transformOrigin:"center"}})]})}function A({label:e,href:r,external:a}){let o=(0,w.useReducedMotion)(),[s,l]=(0,i.useState)(!1),[d,c]=(0,i.useState)(!1),u=(0,t.jsxs)(y.motion.span,{animate:{color:d?"#F5D575":s?"#B9F2FF":"#777777"},transition:{duration:.18*!o},style:{position:"relative",display:"inline-block",fontSize:"var(--fs-sm)",fontFamily:"var(--font-body), system-ui, sans-serif"},children:[e,(0,t.jsx)(y.motion.span,{"aria-hidden":"true",animate:{width:s&&!o?"100%":"0%"},transition:{duration:.18*!o,ease:[.4,0,.2,1]},style:{position:"absolute",left:0,bottom:-3,height:1,background:"var(--gold)"}})]}),f={onMouseEnter:()=>l(!0),onMouseLeave:()=>l(!1),onClick:()=>{o||(c(!0),window.setTimeout(()=>c(!1),180))},style:{marginLeft:24,padding:"8px 4px",display:"inline-block",textDecoration:"none"}};return a?(0,t.jsx)("a",{href:r,target:"_blank",rel:"noopener noreferrer",...f,children:u}):(0,t.jsx)(n.default,{href:r,...f,children:u})}e.s(["default",0,function(){let e=(0,w.useReducedMotion)(),[r,a]=(0,i.useState)(!1),[o,s]=(0,i.useState)(!1),[l,d]=(0,i.useState)(!1),[c,u]=(0,i.useState)(!1);return(0,i.useEffect)(()=>u(!0),[]),(0,i.useEffect)(()=>{if(e)a(!0);else if("1"===window.sessionStorage.getItem("titanos.vault.entranceShown"))a(!0);else{let e=window.setTimeout(()=>a(!0),800);return()=>window.clearTimeout(e)}},[e]),(0,i.useEffect)(()=>{let e=window.matchMedia("(max-width: 720px)"),t=()=>d(e.matches);return t(),e.addEventListener("change",t),()=>e.removeEventListener("change",t)},[]),(0,i.useEffect)(()=>{if(!o)return;let e=e=>{"Escape"===e.key&&s(!1)};document.addEventListener("keydown",e);let t=document.body.style.overflow;return document.body.style.overflow="hidden",()=>{document.removeEventListener("keydown",e),document.body.style.overflow=t}},[o]),(0,i.useEffect)(()=>{!l&&o&&s(!1)},[l,o]),(0,t.jsxs)(y.motion.nav,{initial:{opacity:0,y:-8},animate:{opacity:+!!r,y:r?0:-8},transition:{duration:.5*!e,ease:[0,0,.2,1]},style:{position:"sticky",top:0,zIndex:30,padding:"20px",borderBottom:"1px solid var(--border)",background:"rgb(10 7 7 / 0.85)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"},children:[(0,t.jsxs)("div",{className:"container-vault",style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12},children:[(0,t.jsx)(n.default,{href:"/","aria-label":"TITANOS home",className:"font-wordmark",style:{color:"var(--gold)",fontSize:"var(--fs-lg)",textDecoration:"none",letterSpacing:"0.06em"},children:"TITANOS"}),(0,t.jsxs)("div",{className:"nav-desktop-links",style:{display:"flex",alignItems:"center"},children:[S.slice(0,5).map(e=>(0,t.jsx)(A,{...e},e.href)),(0,t.jsx)(n.default,{href:j.AUDIT_BOOK_HREF,style:{marginLeft:20,padding:"8px 16px",background:"var(--gold)",color:"var(--vault-black, #0a0a0a)",fontFamily:"var(--font-body), system-ui, sans-serif",fontWeight:700,fontSize:"var(--fs-sm)",borderRadius:999,textDecoration:"none",whiteSpace:"nowrap"},children:"Book your free AI audit call"})]}),(0,t.jsx)("button",{type:"button",className:"nav-burger","aria-label":o?"Close menu":"Open menu","aria-expanded":o,"aria-controls":"nav-drawer",onClick:()=>s(e=>!e),style:{background:"transparent",border:"1px solid var(--gold-dim)",borderRadius:"var(--radius-sm)",padding:"10px 12px",cursor:"pointer",color:"var(--gold)",display:"none",alignItems:"center",justifyContent:"center",position:"relative",width:44,height:40},children:(0,t.jsx)(C,{open:o,reduce:!!e})})]}),c&&(0,k.createPortal)((0,t.jsx)(b,{children:o&&(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(y.motion.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.2*!e},onClick:()=>s(!1),style:{position:"fixed",inset:0,background:"rgb(5 3 3 / 0.7)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",zIndex:1040,pointerEvents:"auto"},"aria-hidden":"true"},"overlay"),(0,t.jsxs)(y.motion.div,{id:"nav-drawer",role:"dialog","aria-modal":"true","aria-label":"Site navigation",initial:{x:"100%"},animate:{x:0},exit:{x:"100%"},transition:{duration:.32*!e,ease:[.4,0,.2,1]},style:{position:"fixed",top:0,right:0,bottom:0,width:"min(86vw, 360px)",maxWidth:"100vw",background:"linear-gradient(180deg, var(--vault-warm), var(--vault-black))",borderLeft:"1px solid var(--gold)",boxShadow:"-20px 0 60px rgb(0 0 0 / 0.6)",zIndex:1050,display:"flex",flexDirection:"column",padding:"32px 28px",overflowY:"auto",WebkitOverflowScrolling:"touch"},children:[(0,t.jsx)("span",{"aria-hidden":"true",style:{position:"absolute",top:0,bottom:0,left:-1,width:1,background:"linear-gradient(180deg, transparent, var(--gold), transparent)",opacity:.7}}),(0,t.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:32},children:[(0,t.jsx)("span",{className:"font-wordmark",style:{color:"var(--gold)",fontSize:"var(--fs-lg)",letterSpacing:"0.06em"},children:"TITANOS"}),(0,t.jsx)("button",{type:"button",onClick:()=>s(!1),"aria-label":"Close menu",style:{background:"transparent",border:0,color:"var(--gold)",fontSize:"1.6rem",fontFamily:"var(--font-display), Georgia, serif",cursor:"pointer",padding:"8px 12px",lineHeight:1},children:"✕"})]}),(0,t.jsx)(n.default,{href:j.AUDIT_BOOK_HREF,onClick:()=>s(!1),style:{display:"flex",alignItems:"center",justifyContent:"center",minHeight:44,background:"var(--gold)",color:"var(--vault-black, #0a0a0a)",fontFamily:"var(--font-body), system-ui, sans-serif",fontWeight:700,fontSize:"var(--fs-sm)",borderRadius:999,textDecoration:"none",marginBottom:24},children:"Book your free AI audit call"}),(0,t.jsx)("nav",{children:(0,t.jsx)("ul",{style:{listStyle:"none",padding:0,margin:0},children:S.map(e=>(0,t.jsx)("li",{style:{marginBottom:8},children:e.external?(0,t.jsxs)("a",{href:e.href,target:"_blank",rel:"noopener noreferrer",onClick:()=>s(!1),className:"drawer-link",children:[(0,t.jsx)(E.default,{size:12,pulse:!1}),(0,t.jsx)("span",{children:e.label})]}):(0,t.jsxs)(n.default,{href:e.href,onClick:()=>s(!1),className:"drawer-link",children:[(0,t.jsx)(E.default,{size:12,pulse:!1}),(0,t.jsx)("span",{children:e.label})]})},e.href))})}),(0,t.jsxs)("div",{className:"font-mono",style:{marginTop:"auto",paddingTop:32,fontSize:"var(--fs-xs)",color:"var(--dim)",letterSpacing:"0.12em",textTransform:"uppercase",lineHeight:1.7,borderTop:"1px solid var(--border)"},children:["ABN 34 318 502 254",(0,t.jsx)("br",{}),"kyle@titanos.tech"]})]},"drawer")]})}),document.body),(0,t.jsx)("style",{children:`
        .nav-desktop-links {
          display: flex;
          gap: 0;
        }
        .nav-burger {
          display: none !important;
        }
        @media (max-width: 720px) {
          .nav-desktop-links { display: none !important; }
          .nav-burger { display: inline-flex !important; }
        }
        .drawer-link {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 14px 4px;
          color: var(--ice);
          font-family: var(--font-display), Georgia, serif;
          font-style: italic;
          font-size: var(--fs-lg);
          font-weight: 400;
          letter-spacing: 0.02em;
          text-decoration: none;
          border-bottom: 1px solid var(--border);
          transition: color 200ms ease, padding-left 200ms ease, border-color 200ms ease;
        }
        .drawer-link:hover, .drawer-link:focus-visible {
          color: var(--gold);
          padding-left: 10px;
          border-color: var(--gold-dim);
        }
        .drawer-link:active {
          color: var(--gold-bright);
        }
      `})]})}],42724)},56691,e=>{"use strict";var t=e.i(43476),n=e.i(22016);let i=[{heading:"Services",links:[{label:"Free AI Audit",href:"/audit"},{label:"AI Partnership",href:"/ai-delivery"},{label:"Monitor",href:"/monitor"},{label:"Compliance",href:"/compliance"},{label:"Leads & Intelligence",href:"/leads"},{label:"Free Scan",href:"/scan"}]},{heading:"Proof",links:[{label:"Methodology",href:"/methodology"},{label:"Our scan",href:"/scan#self-scan"},{label:"Evidence pack",href:"/our-evidence-pack"},{label:"Free AI Readiness Guide (PDF)",href:"/ai-readiness-guide.pdf",external:!0}]},{heading:"Company",links:[{label:"About",href:"/about"},{label:"Contact",href:"/contact"},{label:"Book a call",href:"https://cal.com/kyle-deligny-msvz6s/15min",external:!0},{label:"Privacy",href:"/privacy"},{label:"Terms",href:"/terms"}]}];function r({l:e}){let i={color:"var(--dim)",padding:"4px 0",display:"inline-block",minHeight:28};return e.external?(0,t.jsx)("a",{href:e.href,target:"_blank",rel:"noopener noreferrer",style:i,children:e.label}):(0,t.jsx)(n.default,{href:e.href,style:i,children:e.label})}e.s(["default",0,function(){return(0,t.jsx)("footer",{style:{padding:"56px 20px 44px",borderTop:"1px solid var(--border)",color:"var(--dim)",fontSize:"var(--fs-sm)",position:"relative",zIndex:1},children:(0,t.jsxs)("div",{className:"container-vault",children:[(0,t.jsxs)("div",{className:"footer-columns",children:[(0,t.jsxs)("div",{className:"footer-identity",children:[(0,t.jsx)("div",{style:{fontFamily:"var(--font-display), Georgia, serif",letterSpacing:"0.1em",color:"var(--gold)",fontSize:"var(--fs-h4)",marginBottom:10},children:"TITANOS"}),(0,t.jsxs)("div",{style:{lineHeight:1.8},children:["Kyle Deligny · Brisbane, Australia",(0,t.jsx)("br",{}),"ABN 34 318 502 254"]})]}),i.map(e=>(0,t.jsxs)("nav",{"aria-label":e.heading,children:[(0,t.jsx)("div",{style:{fontFamily:"var(--font-display), Georgia, serif",color:"var(--ice)",fontSize:"var(--fs-xs)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:10},children:e.heading}),(0,t.jsx)("ul",{style:{listStyle:"none",margin:0,padding:0},children:e.links.map(e=>(0,t.jsx)("li",{children:(0,t.jsx)(r,{l:e})},e.href))})]},e.heading))]}),(0,t.jsx)("div",{style:{marginTop:36,paddingTop:18,borderTop:"1px solid var(--border)",fontSize:"var(--fs-xs)",letterSpacing:"0.05em",color:"var(--dim)",textAlign:"center"},children:"I personally review every deliverable before it reaches you · titanos.tech"})]})})}])},43439,e=>{"use strict";var t=e.i(43476),n=e.i(46932),i=e.i(70014),r=e.i(72328),a=e.i(71645);let o="titanos.vault.entranceShown";e.s(["default",0,function({playEntrance:e=!1}){let s=(0,r.useReducedMotion)(),l=(0,i.useAnimationControls)(),d=(0,i.useAnimationControls)(),c=(0,a.useRef)(!1);return(0,a.useEffect)(()=>{let t="1"===window.sessionStorage.getItem(o);if(!(e&&!t&&!s)){l.set({top:"8vh",opacity:.2}),d.set({top:"92vh",opacity:.2}),c.current=!0,s&&window.sessionStorage.setItem(o,"1");return}l.set({top:"50vh",opacity:0}),d.set({top:"50vh",opacity:0});let n=!1;return(async()=>{await new Promise(e=>setTimeout(e,200)),n||(await Promise.all([l.start({opacity:.8,transition:{duration:.2,ease:"easeOut"}}),d.start({opacity:.8,transition:{duration:.2,ease:"easeOut"}})]),await new Promise(e=>setTimeout(e,100)),n||(await Promise.all([l.start({top:"30vh",transition:{duration:.8,ease:"easeOut"}}),d.start({top:"55vh",transition:{duration:.8,ease:"easeOut"}})]),await new Promise(e=>setTimeout(e,500)),!n&&(await Promise.all([l.start({top:"8vh",opacity:.2,transition:{duration:.6,ease:"easeOut"}}),d.start({top:"92vh",opacity:.2,transition:{duration:.6,ease:"easeOut"}})]),n||(window.sessionStorage.setItem(o,"1"),c.current=!0))))})(),()=>{n=!0}},[s,e,l,d]),(0,t.jsxs)("div",{"aria-hidden":"true",style:{position:"fixed",inset:0,pointerEvents:"none",zIndex:1,viewTransitionName:"vault-frame"},children:[(0,t.jsx)(n.motion.div,{animate:l,initial:!1,style:{position:"absolute",left:0,width:"100%",height:"1px",background:"var(--gold)",opacity:0}}),(0,t.jsx)(n.motion.div,{animate:d,initial:!1,style:{position:"absolute",left:0,width:"100%",height:"1px",background:"var(--gold)",opacity:0}})]})}])},98541,e=>{"use strict";var t=e.i(43476),n=e.i(71645);e.s(["default",0,function(){let[e,i]=(0,n.useState)(!0);return((0,n.useEffect)(()=>{if("u"<typeof document)return;let e=()=>i("visible"===document.visibilityState);return e(),document.addEventListener("visibilitychange",e),()=>document.removeEventListener("visibilitychange",e)},[]),e)?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("div",{"aria-hidden":"true",className:"vault-mesh",style:{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"},children:[(0,t.jsx)("span",{className:"vault-blob vault-blob-1"}),(0,t.jsx)("span",{className:"vault-blob vault-blob-2"}),(0,t.jsx)("span",{className:"vault-blob vault-blob-3"})]}),(0,t.jsx)("span",{"aria-hidden":"true",className:"vault-specular"}),(0,t.jsx)("style",{children:`
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
           2. Bump opacity ~2\xd7 because brighter mobile screens + smaller
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
      `})]}):null}])},22688,e=>{"use strict";var t=e.i(43476),n=e.i(71645);function i(e,t,n=!1){return{x:Math.random()*e,y:n?t+40*Math.random():Math.random()*t,r:.5+ +Math.random(),o:.05+.1*Math.random(),vy:-(.05+.25*Math.random()),vx:(Math.random()-.5)*.1}}e.s(["default",0,function(){let e=(0,n.useRef)(null);return(0,n.useEffect)(()=>{if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;let t=e.current;if(!t)return;let n=t.getContext("2d");if(!n)return;let r=(getComputedStyle(document.documentElement).getPropertyValue("--gold-rgb").trim()||"212 175 55").split(/\s+/).join(","),a=e=>`rgba(${r},${e})`,o=t.width=window.innerWidth,s=t.height=window.innerHeight,l=Math.min(window.devicePixelRatio||1,2),d=()=>{o=window.innerWidth,s=window.innerHeight,t.width=o*l,t.height=s*l,t.style.width=o+"px",t.style.height=s+"px",n.setTransform(l,0,0,l,0,0)};d(),window.addEventListener("resize",d);let c=Array.from({length:30},()=>i(o,s)),u={x:-9999,y:-9999},f=e=>{u.x=e.clientX,u.y=e.clientY};window.addEventListener("mousemove",f);let m=0,p=()=>{for(let e of(n.clearRect(0,0,o,s),c)){let t=u.x-e.x,r=u.y-e.y,l=t*t+r*r;l<22500&&l>1&&(e.x+=6e-4*t,e.y+=6e-4*r),e.x+=e.vx,e.y+=e.vy,e.y<-10&&Object.assign(e,i(o,s,!0)),e.x<-10&&(e.x=o+10),e.x>o+10&&(e.x=-10),n.beginPath(),n.arc(e.x,e.y,e.r,0,2*Math.PI),n.fillStyle=a(e.o),n.fill()}m=requestAnimationFrame(p)};return m=requestAnimationFrame(p),()=>{cancelAnimationFrame(m),window.removeEventListener("resize",d),window.removeEventListener("mousemove",f)}},[]),(0,t.jsx)("canvas",{ref:e,"aria-hidden":"true",style:{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}})}])},60613,e=>{"use strict";var t=e.i(43476),n=e.i(46932),i=e.i(86427),r=e.i(71645),a=e.i(37806),o=e.i(47414);function s(e){let t=(0,o.useConstant)(()=>(0,i.motionValue)(e)),{isStatic:n}=(0,r.useContext)(a.MotionConfigContext);if(n){let[,n]=(0,r.useState)(e);(0,r.useEffect)(()=>t.on("change",n),[])}return t}var l=e.i(72328),d=e.i(83352),c=e.i(83411),u=e.i(87022);function f(e){return"number"==typeof e?e:parseFloat(e)}var m=e.i(44230),p=e.i(74008);function h(e,t){let n=s(t()),i=()=>n.set(t());return i(),(0,p.useIsomorphicLayoutEffect)(()=>{let t=()=>u.frame.preRender(i,!1,!0),n=e.map(e=>e.on("change",t));return()=>{n.forEach(e=>e()),(0,u.cancelFrame)(i)}}),n}function v(e,t){let n=(0,o.useConstant)(()=>[]);return h(e,()=>{n.length=0;let i=e.length;for(let t=0;t<i;t++)n[t]=e[t].get();return t(n)})}function g(e,t={}){return function(e,t={}){let{isStatic:n}=(0,r.useContext)(a.MotionConfigContext),l=()=>(0,c.isMotionValue)(e)?e.get():e;if(n)return function e(t,n,r,a){if("function"==typeof t){let e;return i.collectMotionValues.current=[],t(),e=h(i.collectMotionValues.current,t),i.collectMotionValues.current=void 0,e}if(void 0!==r&&!Array.isArray(r)&&"function"!=typeof n){var s=t,l=n,d=r,c=a;let i=(0,o.useConstant)(()=>Object.keys(d)),u=(0,o.useConstant)(()=>({}));for(let t of i)u[t]=e(s,l,d[t],c);return u}let u="function"==typeof n?n:function(...e){let t=!Array.isArray(e[0]),n=t?0:-1,i=e[0+n],r=e[1+n],a=e[2+n],o=e[3+n],s=(0,m.interpolate)(r,a,o);return t?s(i):s}(n,r,a),f=Array.isArray(t)?v(t,u):v([t],([e])=>u(e)),p=Array.isArray(t)?void 0:t.accelerate;return p&&!p.isTransformed&&"function"!=typeof n&&Array.isArray(r)&&a?.clamp!==!1&&(f.accelerate={...p,times:n,keyframes:r,isTransformed:!0,...a?.ease?{ease:a.ease}:{}}),f}(l);let p=s(l());return(0,r.useInsertionEffect)(()=>(function(e,t,n={}){let i,r=e.get(),a=null,o=r,s="string"==typeof r?r.replace(/[\d.-]/g,""):void 0,l=()=>{a&&(a.stop(),a=null),e.animation=void 0},m=()=>{(()=>{let t=f(e.get()),r=f(o);if(t===r)return l();let s=a?a.getGeneratorVelocity():e.getVelocity();l(),a=new d.JSAnimation({keyframes:[t,r],velocity:s,type:"spring",restDelta:.001,restSpeed:.01,...n,onUpdate:i})})(),e.animation=a??void 0,e.events.animationStart?.notify(),a?.then(()=>{e.animation=void 0,e.events.animationComplete?.notify()})};if(e.attach((e,t)=>{o=e,i=e=>{var n,i;return t((n=e,(i=s)?n+i:n))},u.frame.postRender(m)},l),(0,c.isMotionValue)(t)){let i=!0===n.skipInitialAnimation,r=t.on("change",t=>{var n,r,a,o;i?(i=!1,e.jump((n=t,(r=s)?n+r:n),!1)):e.set((a=t,(o=s)?a+o:a))}),a=e.on("destroy",r);return()=>{r(),a()}}return l})(p,e,t),[p,JSON.stringify(t)]),p}(e,{type:"spring",...t})}let x={stiffness:220,damping:24,mass:.45};e.s(["default",0,function(){let e=(0,l.useReducedMotion)(),i=s(-100),a=s(-100),o=g(i,x),d=g(a,x),[c,u]=(0,r.useState)("default");if((0,r.useEffect)(()=>{if(e||window.matchMedia&&window.matchMedia("(pointer: coarse)").matches)return;let t=e=>{i.set(e.clientX),a.set(e.clientY)},n=e=>{u((e=>{if(!e)return"default";if(e.closest?.("[data-cursor='terminal'], pre, code, .font-mono"))return"terminal";if(e.closest?.('a, button, [role="button"], [data-interactive="true"]'))return"interactive";let t=e.tagName;return"P"===t||"LI"===t||"H1"===t||"H2"===t||"H3"===t||"SPAN"===t?"text":"default"})(e.target))},r=()=>u("default");return document.body.addEventListener("mouseover",n),document.body.addEventListener("mouseout",n),window.addEventListener("mousemove",t),window.addEventListener("mouseleave",r),()=>{document.body.removeEventListener("mouseover",n),document.body.removeEventListener("mouseout",n),window.removeEventListener("mousemove",t),window.removeEventListener("mouseleave",r)}},[e,i,a]),e)return null;let f="interactive"===c?36:"text"===c?2:"terminal"===c?12:14,m="text"===c||"terminal"===c?22:f;return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.motion.div,{"aria-hidden":"true",style:{position:"fixed",top:0,left:0,width:f,height:m,borderRadius:"text"===c||"terminal"===c?1:999,background:"default"===c?"rgb(var(--gold-rgb) / 0.18)":"interactive"===c?"rgb(var(--gold-rgb) / 0.22)":"var(--gold)",border:"default"===c||"interactive"===c?"1px solid var(--gold)":"none",boxShadow:"interactive"===c?"0 0 12px rgb(var(--gold-rgb) / 0.5)":"default"===c?"0 0 6px rgb(var(--gold-rgb) / 0.3)":"none",pointerEvents:"none",zIndex:9999,x:o,y:d,translateX:"-50%",translateY:"-50%",transition:"width 200ms ease, height 200ms ease, background 200ms ease, border-radius 200ms ease, box-shadow 200ms ease",animation:"terminal"===c?"cursor-blink 1s steps(2) infinite":"none"}}),"interactive"===c&&(0,t.jsx)(n.motion.div,{"aria-hidden":"true",style:{position:"fixed",top:0,left:0,width:4,height:4,borderRadius:999,background:"var(--gold)",pointerEvents:"none",zIndex:1e4,x:o,y:d,translateX:"-50%",translateY:"-50%"}}),(0,t.jsx)("style",{children:`
        @keyframes cursor-blink {
          0%, 50% { opacity: 1; }
          50.01%, 100% { opacity: 0; }
        }
      `})]})}],60613)},9569,e=>{"use strict";var t=e.i(71645),n=e.i(18566);e.s(["default",0,function(){let e=(0,n.usePathname)();return(0,t.useEffect)(()=>{if("u"<typeof document)return;let t=(e??"/").replace(/^\//,"").split("/")[0]||"home";document.body.dataset.page=t},[e]),null}])},15872,e=>{"use strict";var t=e.i(71645);e.s(["default",0,function(){return(0,t.useEffect)(()=>{let e="color:#D4AF37;font-family:Georgia, serif;font-size:14px;font-style:italic;letter-spacing:0.04em";console.log("%cTITANOS",e+";font-size:32px;font-weight:bold"),console.log("%cLooking under the hood? kyle@titanos.tech if you'd like to talk.",e),console.log("%cABN 34 318 502 254 · https://abr.business.gov.au/ABN/View?id=34318502254","color:#888;font-family:ui-monospace, monospace;font-size:11px"),console.log("%cBuilt by Kyle Deligny with Claude Code, Anthropic's agentic coding tool. 1,700+ automated corpus scans this month.","color:#888;font-family:ui-monospace, monospace;font-size:11px")},[]),null}])},76666,e=>{"use strict";var t=e.i(43476),n=e.i(22016),i=e.i(61664);e.s(["default",0,function(){return(0,t.jsxs)("div",{className:"sticky-mobile-cta",children:[(0,t.jsx)(n.default,{href:i.AUDIT_BOOK_HREF,children:"Book Free AI Audit Call"}),(0,t.jsx)("style",{children:`
        .sticky-mobile-cta {
          display: none;
        }
        @media (max-width: 720px) {
          .sticky-mobile-cta {
            display: block;
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 40;
            padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
            background: rgb(10 7 7 / 0.92);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border-top: 1px solid var(--gold-dim);
          }
          .sticky-mobile-cta a {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 44px;
            width: 100%;
            background: var(--gold);
            color: var(--vault-black, #0a0a0a);
            font-family: var(--font-body), system-ui, sans-serif;
            font-weight: 700;
            font-size: 0.95rem;
            text-decoration: none;
            border-radius: 999px;
          }
        }
        @media (max-width: 720px) and (prefers-reduced-motion: no-preference) {
          .sticky-mobile-cta a { transition: transform 0.15s ease; }
          .sticky-mobile-cta a:active { transform: scale(0.97); }
        }
      `})]})}])},64115,e=>{"use strict";var t=e.i(71645),n=e.i(18566);let i="https://vault.titanos.tech/api/site-event";function r(e,t){let n=JSON.stringify({event:e,path:t});navigator.sendBeacon?navigator.sendBeacon(i,new Blob([n],{type:"application/json"})):fetch(i,{method:"POST",headers:{"Content-Type":"application/json"},body:n,keepalive:!0}).catch(()=>{})}e.s(["default",0,function(){let e=(0,n.usePathname)();return(0,t.useEffect)(()=>{r("pageview",e||"/")},[e]),(0,t.useEffect)(()=>{let t=t=>{let n=t.target?.closest("[data-analytics]");if(!n)return;let i=n.getAttribute("data-analytics");i&&r(i,e||"/")};return document.addEventListener("click",t,!0),document.addEventListener("submit",t,!0),()=>{document.removeEventListener("click",t,!0),document.removeEventListener("submit",t,!0)}},[e]),null}])}]);