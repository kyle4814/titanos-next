(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,42724,e=>{"use strict";var t=e.i(43476),n=e.i(22016);e.i(47167);var r=e.i(71645),i=e.i(31178),a=e.i(47414),o=e.i(74008),l=e.i(21476),s=e.i(72846),d=r,c=e.i(37806);function u(e,t){if("function"==typeof e)return e(t);null!=e&&(e.current=t)}class f extends d.Component{getSnapshotBeforeUpdate(e){let t=this.props.childRef.current;if((0,s.isHTMLElement)(t)&&e.isPresent&&!this.props.isPresent&&!1!==this.props.pop){let e=t.offsetParent,n=(0,s.isHTMLElement)(e)&&e.offsetWidth||0,r=(0,s.isHTMLElement)(e)&&e.offsetHeight||0,i=getComputedStyle(t),a=this.props.sizeRef.current;a.height=parseFloat(i.height),a.width=parseFloat(i.width),a.top=t.offsetTop,a.left=t.offsetLeft,a.right=n-a.width-a.left,a.bottom=r-a.height-a.top,a.direction=i.direction}return null}componentDidUpdate(){}render(){return this.props.children}}function p({children:e,isPresent:n,anchorX:i,anchorY:a,root:o,pop:l}){let s=(0,d.useId)(),m=(0,d.useRef)(null),h=(0,d.useRef)({width:0,height:0,top:0,left:0,right:0,bottom:0,direction:"ltr"}),{nonce:v}=(0,d.useContext)(c.MotionConfigContext),g=function(...e){return r.useCallback(function(...e){return t=>{let n=!1,r=e.map(e=>{let r=u(e,t);return n||"function"!=typeof r||(n=!0),r});if(n)return()=>{for(let t=0;t<r.length;t++){let n=r[t];"function"==typeof n?n():u(e[t],null)}}}}(...e),e)}(m,e.props?.ref??e?.ref);return(0,d.useInsertionEffect)(()=>{let{width:e,height:t,top:r,left:d,right:c,bottom:u,direction:f}=h.current;if(n||!1===l||!m.current||!e||!t)return;let p="rtl"===f,g="left"===i?p?`right: ${c}`:`left: ${d}`:p?`left: ${d}`:`right: ${c}`,x="bottom"===a?`bottom: ${u}`:`top: ${r}`;m.current.dataset.motionPopId=s;let b=document.createElement("style");v&&(b.nonce=v);let y=o??document.head;return y.appendChild(b),b.sheet&&b.sheet.insertRule(`
          [data-motion-pop-id="${s}"] {
            position: absolute !important;
            width: ${e}px !important;
            height: ${t}px !important;
            ${g}px !important;
            ${x}px !important;
          }
        `),()=>{m.current?.removeAttribute("data-motion-pop-id"),y.contains(b)&&y.removeChild(b)}},[n]),(0,t.jsx)(f,{isPresent:n,childRef:m,sizeRef:h,pop:l,children:!1===l?e:d.cloneElement(e,{ref:g})})}let m=({children:e,initial:n,isPresent:i,onExitComplete:o,custom:s,presenceAffectsLayout:d,mode:c,anchorX:u,anchorY:f,root:m})=>{let v=(0,a.useConstant)(h),g=(0,r.useId)(),x=!0,b=(0,r.useMemo)(()=>(x=!1,{id:g,initial:n,isPresent:i,custom:s,onExitComplete:e=>{for(let t of(v.set(e,!0),v.values()))if(!t)return;o&&o()},register:e=>(v.set(e,!1),()=>v.delete(e))}),[i,v,o]);return d&&x&&(b={...b}),(0,r.useMemo)(()=>{v.forEach((e,t)=>v.set(t,!1))},[i]),r.useEffect(()=>{i||v.size||!o||o()},[i]),e=(0,t.jsx)(p,{pop:"popLayout"===c,isPresent:i,anchorX:u,anchorY:f,root:m,children:e}),(0,t.jsx)(l.PresenceContext.Provider,{value:b,children:e})};function h(){return new Map}var v=e.i(64978);let g=e=>e.key||"";function x(e){let t=[];return r.Children.forEach(e,e=>{(0,r.isValidElement)(e)&&t.push(e)}),t}let b=({children:e,custom:n,initial:l=!0,onExitComplete:s,presenceAffectsLayout:d=!0,mode:c="sync",propagate:u=!1,anchorX:f="left",anchorY:p="top",root:h})=>{let[b,y]=(0,v.usePresence)(u),w=(0,r.useMemo)(()=>x(e),[e]),k=u&&!b?[]:w.map(g),j=(0,r.useRef)(!0),E=(0,r.useRef)(w),S=(0,a.useConstant)(()=>new Map),C=(0,r.useRef)(new Set),[A,T]=(0,r.useState)(w),[I,M]=(0,r.useState)(w);(0,o.useIsomorphicLayoutEffect)(()=>{j.current=!1,E.current=w;for(let e=0;e<I.length;e++){let t=g(I[e]);k.includes(t)?(S.delete(t),C.current.delete(t)):!0!==S.get(t)&&S.set(t,!1)}},[I,k.length,k.join("-")]);let L=[];if(w!==A){let e=[...w];for(let t=0;t<I.length;t++){let n=I[t],r=g(n);k.includes(r)||(e.splice(t,0,n),L.push(n))}return"wait"===c&&L.length&&(e=L),M(x(e)),T(w),null}let{forceRender:F}=(0,r.useContext)(i.LayoutGroupContext);return(0,t.jsx)(t.Fragment,{children:I.map(e=>{let r=g(e),i=(!u||!!b)&&(w===I||k.includes(r));return(0,t.jsx)(m,{isPresent:i,initial:(!j.current||!!l)&&void 0,custom:n,presenceAffectsLayout:d,mode:c,root:h,onExitComplete:i?void 0:()=>{if(C.current.has(r)||!S.has(r))return;C.current.add(r),S.set(r,!0);let e=!0;S.forEach(t=>{t||(e=!1)}),e&&(F?.(),M(E.current),u&&y?.(),s&&s())},anchorX:f,anchorY:p,children:e},r)})})};var y=e.i(46932),w=e.i(72328),k=e.i(74080),j=e.i(61664),E=e.i(25616);let S=[{label:"Free consultation",href:"/audit",external:!1},{label:"AI Partnership",href:"/ai-delivery",external:!1},{label:"Compliance",href:"/compliance",external:!1},{label:"Monitor",href:"/monitor",external:!1},{label:"Black Ice",href:"/black-ice",external:!1},{label:"Blog",href:"/blog",external:!1},{label:"Leads",href:"/leads",external:!1},{label:"Free Scan",href:"/scan",external:!1},{label:"Evidence Pack",href:"/our-evidence-pack",external:!1},{label:"Refer & Earn",href:"/refer",external:!1},{label:"Methodology",href:"/methodology",external:!1},{label:"About",href:"/about",external:!1},{label:"Contact",href:"/contact",external:!1}];function C({open:e,reduce:n}){let r=.22*!n,i=[.4,0,.2,1];return(0,t.jsxs)("span",{"aria-hidden":"true",style:{position:"relative",display:"inline-block",width:18,height:14},children:[(0,t.jsx)(y.motion.span,{animate:e?{rotate:45,top:6}:{rotate:0,top:0},transition:{duration:r,ease:i},style:{position:"absolute",top:0,left:0,right:0,height:1.5,background:"var(--gold)",transformOrigin:"center"}}),(0,t.jsx)(y.motion.span,{animate:e?{opacity:0}:{opacity:1},transition:{duration:r,ease:i},style:{position:"absolute",top:6,left:0,right:0,height:1.5,background:"var(--gold)"}}),(0,t.jsx)(y.motion.span,{animate:e?{rotate:-45,top:6}:{rotate:0,top:12},transition:{duration:r,ease:i},style:{position:"absolute",top:12,left:0,right:0,height:1.5,background:"var(--gold)",transformOrigin:"center"}})]})}function A({label:e,href:i,external:a}){let o=(0,w.useReducedMotion)(),[l,s]=(0,r.useState)(!1),[d,c]=(0,r.useState)(!1),u=(0,t.jsxs)(y.motion.span,{animate:{color:d?"#F5D575":l?"#B9F2FF":"#777777"},transition:{duration:.18*!o},style:{position:"relative",display:"inline-block",fontSize:"var(--fs-sm)",fontFamily:"var(--font-body), system-ui, sans-serif"},children:[e,(0,t.jsx)(y.motion.span,{"aria-hidden":"true",animate:{width:l&&!o?"100%":"0%"},transition:{duration:.18*!o,ease:[.4,0,.2,1]},style:{position:"absolute",left:0,bottom:-3,height:1,background:"var(--gold)"}})]}),f={onMouseEnter:()=>s(!0),onMouseLeave:()=>s(!1),onClick:()=>{o||(c(!0),window.setTimeout(()=>c(!1),180))},style:{marginLeft:24,padding:"8px 4px",display:"inline-block",textDecoration:"none"}};return a?(0,t.jsx)("a",{href:i,target:"_blank",rel:"noopener noreferrer",...f,children:u}):(0,t.jsx)(n.default,{href:i,...f,children:u})}e.s(["default",0,function(){let e=(0,w.useReducedMotion)(),[i,a]=(0,r.useState)(!1),[o,l]=(0,r.useState)(!1),[s,d]=(0,r.useState)(!1),[c,u]=(0,r.useState)(!1);return(0,r.useEffect)(()=>u(!0),[]),(0,r.useEffect)(()=>{if(e)a(!0);else if("1"===window.sessionStorage.getItem("titanos.vault.entranceShown"))a(!0);else{let e=window.setTimeout(()=>a(!0),800);return()=>window.clearTimeout(e)}},[e]),(0,r.useEffect)(()=>{let e=window.matchMedia("(max-width: 720px)"),t=()=>d(e.matches);return t(),e.addEventListener("change",t),()=>e.removeEventListener("change",t)},[]),(0,r.useEffect)(()=>{if(!o)return;let e=e=>{"Escape"===e.key&&l(!1)};document.addEventListener("keydown",e);let t=document.body.style.overflow;return document.body.style.overflow="hidden",()=>{document.removeEventListener("keydown",e),document.body.style.overflow=t}},[o]),(0,r.useEffect)(()=>{!s&&o&&l(!1)},[s,o]),(0,t.jsxs)(y.motion.nav,{initial:{opacity:0,y:-8},animate:{opacity:+!!i,y:i?0:-8},transition:{duration:.5*!e,ease:[0,0,.2,1]},style:{position:"sticky",top:0,zIndex:30,padding:"20px",borderBottom:"1px solid var(--border)",background:"rgb(10 7 7 / 0.85)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"},children:[(0,t.jsxs)("div",{className:"container-vault",style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12},children:[(0,t.jsx)(n.default,{href:"/","aria-label":"TITANOS home",className:"font-wordmark",style:{color:"var(--gold)",fontSize:"var(--fs-lg)",textDecoration:"none",letterSpacing:"0.06em"},children:"TITANOS"}),(0,t.jsxs)("div",{className:"nav-desktop-links",style:{display:"flex",alignItems:"center"},children:[S.slice(0,6).map(e=>(0,t.jsx)(A,{...e},e.href)),(0,t.jsx)(n.default,{href:j.AUDIT_MESSAGE_HREF,style:{marginLeft:20,padding:"8px 16px",background:"var(--gold)",color:"var(--vault-black, #0a0a0a)",fontFamily:"var(--font-body), system-ui, sans-serif",fontWeight:700,fontSize:"var(--fs-sm)",borderRadius:999,textDecoration:"none",whiteSpace:"nowrap"},children:"Book a free consultation and report"})]}),(0,t.jsx)("button",{type:"button",className:"nav-burger","aria-label":o?"Close menu":"Open menu","aria-expanded":o,"aria-controls":"nav-drawer",onClick:()=>l(e=>!e),style:{background:"transparent",border:"1px solid var(--gold-dim)",borderRadius:"var(--radius-sm)",padding:"10px 12px",cursor:"pointer",color:"var(--gold)",display:"none",alignItems:"center",justifyContent:"center",position:"relative",width:44,height:40},children:(0,t.jsx)(C,{open:o,reduce:!!e})})]}),c&&(0,k.createPortal)((0,t.jsx)(b,{children:o&&(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(y.motion.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.2*!e},onClick:()=>l(!1),style:{position:"fixed",inset:0,background:"rgb(5 3 3 / 0.7)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",zIndex:1040,pointerEvents:"auto"},"aria-hidden":"true"},"overlay"),(0,t.jsxs)(y.motion.div,{id:"nav-drawer",role:"dialog","aria-modal":"true","aria-label":"Site navigation",initial:{x:"100%"},animate:{x:0},exit:{x:"100%"},transition:{duration:.32*!e,ease:[.4,0,.2,1]},style:{position:"fixed",top:0,right:0,bottom:0,width:"min(86vw, 360px)",maxWidth:"100vw",background:"linear-gradient(180deg, var(--vault-warm), var(--vault-black))",borderLeft:"1px solid var(--gold)",boxShadow:"-20px 0 60px rgb(0 0 0 / 0.6)",zIndex:1050,display:"flex",flexDirection:"column",padding:"32px 28px",overflowY:"auto",WebkitOverflowScrolling:"touch"},children:[(0,t.jsx)("span",{"aria-hidden":"true",style:{position:"absolute",top:0,bottom:0,left:-1,width:1,background:"linear-gradient(180deg, transparent, var(--gold), transparent)",opacity:.7}}),(0,t.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:32},children:[(0,t.jsx)("span",{className:"font-wordmark",style:{color:"var(--gold)",fontSize:"var(--fs-lg)",letterSpacing:"0.06em"},children:"TITANOS"}),(0,t.jsx)("button",{type:"button",onClick:()=>l(!1),"aria-label":"Close menu",style:{background:"transparent",border:0,color:"var(--gold)",fontSize:"1.6rem",fontFamily:"var(--font-display), Georgia, serif",cursor:"pointer",padding:"8px 12px",lineHeight:1},children:"✕"})]}),(0,t.jsx)(n.default,{href:j.AUDIT_MESSAGE_HREF,onClick:()=>l(!1),style:{display:"flex",alignItems:"center",justifyContent:"center",minHeight:44,background:"var(--gold)",color:"var(--vault-black, #0a0a0a)",fontFamily:"var(--font-body), system-ui, sans-serif",fontWeight:700,fontSize:"var(--fs-sm)",borderRadius:999,textDecoration:"none",marginBottom:24},children:"Book a free consultation and report"}),(0,t.jsx)("nav",{children:(0,t.jsx)("ul",{style:{listStyle:"none",padding:0,margin:0},children:S.map(e=>(0,t.jsx)("li",{style:{marginBottom:8},children:e.external?(0,t.jsxs)("a",{href:e.href,target:"_blank",rel:"noopener noreferrer",onClick:()=>l(!1),className:"drawer-link",children:[(0,t.jsx)(E.default,{size:12,pulse:!1}),(0,t.jsx)("span",{children:e.label})]}):(0,t.jsxs)(n.default,{href:e.href,onClick:()=>l(!1),className:"drawer-link",children:[(0,t.jsx)(E.default,{size:12,pulse:!1}),(0,t.jsx)("span",{children:e.label})]})},e.href))})}),(0,t.jsxs)("div",{className:"font-mono",style:{marginTop:"auto",paddingTop:32,fontSize:"var(--fs-xs)",color:"var(--dim)",letterSpacing:"0.12em",textTransform:"uppercase",lineHeight:1.7,borderTop:"1px solid var(--border)"},children:["ABN 34 318 502 254",(0,t.jsx)("br",{}),"kyle@titanos.tech"]})]},"drawer")]})}),document.body),(0,t.jsx)("style",{children:`
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
      `})]})}],42724)},56691,e=>{"use strict";var t=e.i(43476),n=e.i(22016);let r=[{heading:"Services",links:[{label:"Free consultation + report",href:"/audit"},{label:"AI Partnership",href:"/ai-delivery"},{label:"Monitor",href:"/monitor"},{label:"Compliance",href:"/compliance"},{label:"Leads & Intelligence",href:"/leads"},{label:"Free Scan",href:"/scan"}]},{heading:"Proof",links:[{label:"44 engineer-years",href:"/engineering"},{label:"Methodology",href:"/methodology"},{label:"Black Ice doctrine",href:"/black-ice"},{label:"Our scan",href:"/scan#self-scan"},{label:"Evidence pack",href:"/our-evidence-pack"},{label:"Free AI Readiness Guide (PDF)",href:"/ai-readiness-guide.pdf",external:!0},{label:"Blog",href:"/blog"}]},{heading:"Company",links:[{label:"About",href:"/about"},{label:"Contact",href:"/contact"},{label:"Message or call Kyle",href:"/contact"},{label:"Privacy",href:"/privacy"},{label:"Terms",href:"/terms"}]}];function i({l:e}){let r={color:"var(--dim)",padding:"4px 0",display:"inline-block",minHeight:28};return e.external?(0,t.jsx)("a",{href:e.href,target:"_blank",rel:"noopener noreferrer",style:r,children:e.label}):(0,t.jsx)(n.default,{href:e.href,style:r,children:e.label})}e.s(["default",0,function(){return(0,t.jsx)("footer",{style:{padding:"56px 20px 44px",borderTop:"1px solid var(--border)",color:"var(--dim)",fontSize:"var(--fs-sm)",position:"relative",zIndex:1},children:(0,t.jsxs)("div",{className:"container-vault",children:[(0,t.jsxs)("div",{className:"footer-columns",children:[(0,t.jsxs)("div",{className:"footer-identity",children:[(0,t.jsx)("div",{style:{fontFamily:"var(--font-display), Georgia, serif",letterSpacing:"0.1em",color:"var(--gold)",fontSize:"var(--fs-h4)",marginBottom:10},children:"TITANOS"}),(0,t.jsxs)("div",{style:{lineHeight:1.8},children:["Kyle Deligny · Brisbane, Australia",(0,t.jsx)("br",{}),"ABN 34 318 502 254"]}),(0,t.jsx)("div",{style:{marginTop:14,paddingTop:14,borderTop:"1px solid var(--border)",fontFamily:"var(--font-display), Georgia, serif",fontStyle:"italic",color:"var(--gold-dim)",fontSize:"var(--fs-sm)",letterSpacing:"0.02em"},children:"Built without asking. Kept honest by what you can check."})]}),r.map(e=>(0,t.jsxs)("nav",{"aria-label":e.heading,children:[(0,t.jsx)("div",{style:{fontFamily:"var(--font-display), Georgia, serif",color:"var(--ice)",fontSize:"var(--fs-xs)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:10},children:e.heading}),(0,t.jsx)("ul",{style:{listStyle:"none",margin:0,padding:0},children:e.links.map(e=>(0,t.jsx)("li",{children:(0,t.jsx)(i,{l:e})},e.href))})]},e.heading))]}),(0,t.jsx)("div",{style:{marginTop:36,paddingTop:18,borderTop:"1px solid var(--border)",fontSize:"var(--fs-xs)",letterSpacing:"0.05em",color:"var(--dim)",textAlign:"center"},children:"I personally review every deliverable before it reaches you · titanos.tech"})]})})}])},43439,e=>{"use strict";var t=e.i(43476),n=e.i(46932),r=e.i(70014),i=e.i(72328),a=e.i(71645);let o="titanos.vault.entranceShown";e.s(["default",0,function({playEntrance:e=!1}){let l=(0,i.useReducedMotion)(),s=(0,r.useAnimationControls)(),d=(0,r.useAnimationControls)(),c=(0,a.useRef)(!1);return(0,a.useEffect)(()=>{let t="1"===window.sessionStorage.getItem(o);if(!(e&&!t&&!l)){s.set({top:"8vh",opacity:.2}),d.set({top:"92vh",opacity:.2}),c.current=!0,l&&window.sessionStorage.setItem(o,"1");return}s.set({top:"50vh",opacity:0}),d.set({top:"50vh",opacity:0});let n=!1;return(async()=>{await new Promise(e=>setTimeout(e,200)),n||(await Promise.all([s.start({opacity:.8,transition:{duration:.2,ease:"easeOut"}}),d.start({opacity:.8,transition:{duration:.2,ease:"easeOut"}})]),await new Promise(e=>setTimeout(e,100)),n||(await Promise.all([s.start({top:"30vh",transition:{duration:.8,ease:"easeOut"}}),d.start({top:"55vh",transition:{duration:.8,ease:"easeOut"}})]),await new Promise(e=>setTimeout(e,500)),!n&&(await Promise.all([s.start({top:"8vh",opacity:.2,transition:{duration:.6,ease:"easeOut"}}),d.start({top:"92vh",opacity:.2,transition:{duration:.6,ease:"easeOut"}})]),n||(window.sessionStorage.setItem(o,"1"),c.current=!0))))})(),()=>{n=!0}},[l,e,s,d]),(0,t.jsxs)("div",{"aria-hidden":"true",style:{position:"fixed",inset:0,pointerEvents:"none",zIndex:1,viewTransitionName:"vault-frame"},children:[(0,t.jsx)(n.motion.div,{animate:s,initial:!1,style:{position:"absolute",left:0,width:"100%",height:"1px",background:"var(--gold)",opacity:0}}),(0,t.jsx)(n.motion.div,{animate:d,initial:!1,style:{position:"absolute",left:0,width:"100%",height:"1px",background:"var(--gold)",opacity:0}})]})}])},98541,e=>{"use strict";var t=e.i(43476),n=e.i(71645);e.s(["default",0,function(){let[e,r]=(0,n.useState)(!0);return((0,n.useEffect)(()=>{if("u"<typeof document)return;let e=()=>r("visible"===document.visibilityState);return e(),document.addEventListener("visibilitychange",e),()=>document.removeEventListener("visibilitychange",e)},[]),e)?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("div",{"aria-hidden":"true",className:"vault-mesh",style:{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"},children:[(0,t.jsx)("span",{className:"vault-blob vault-blob-1"}),(0,t.jsx)("span",{className:"vault-blob vault-blob-2"}),(0,t.jsx)("span",{className:"vault-blob vault-blob-3"})]}),(0,t.jsx)("span",{"aria-hidden":"true",className:"vault-specular"}),(0,t.jsx)("style",{children:`
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
      `})]}):null}])},22688,e=>{"use strict";var t=e.i(43476),n=e.i(71645);function r(e,t,n=!1){return{x:Math.random()*e,y:n?t+40*Math.random():Math.random()*t,r:.5+ +Math.random(),o:.05+.1*Math.random(),vy:-(.05+.25*Math.random()),vx:(Math.random()-.5)*.1}}e.s(["default",0,function(){let e=(0,n.useRef)(null);return(0,n.useEffect)(()=>{if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;let t=e.current;if(!t)return;let n=t.getContext("2d");if(!n)return;let i=(getComputedStyle(document.documentElement).getPropertyValue("--gold-rgb").trim()||"212 175 55").split(/\s+/).join(","),a=e=>`rgba(${i},${e})`,o=t.width=window.innerWidth,l=t.height=window.innerHeight,s=Math.min(window.devicePixelRatio||1,2),d=()=>{o=window.innerWidth,l=window.innerHeight,t.width=o*s,t.height=l*s,t.style.width=o+"px",t.style.height=l+"px",n.setTransform(s,0,0,s,0,0)};d(),window.addEventListener("resize",d);let c=Array.from({length:30},()=>r(o,l)),u={x:-9999,y:-9999},f=e=>{u.x=e.clientX,u.y=e.clientY};window.addEventListener("mousemove",f);let p=0,m=()=>{for(let e of(n.clearRect(0,0,o,l),c)){let t=u.x-e.x,i=u.y-e.y,s=t*t+i*i;s<22500&&s>1&&(e.x+=6e-4*t,e.y+=6e-4*i),e.x+=e.vx,e.y+=e.vy,e.y<-10&&Object.assign(e,r(o,l,!0)),e.x<-10&&(e.x=o+10),e.x>o+10&&(e.x=-10),n.beginPath(),n.arc(e.x,e.y,e.r,0,2*Math.PI),n.fillStyle=a(e.o),n.fill()}p=requestAnimationFrame(m)};return p=requestAnimationFrame(m),()=>{cancelAnimationFrame(p),window.removeEventListener("resize",d),window.removeEventListener("mousemove",f)}},[]),(0,t.jsx)("canvas",{ref:e,"aria-hidden":"true",style:{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}})}])},60613,e=>{"use strict";var t=e.i(43476),n=e.i(46932),r=e.i(86427),i=e.i(71645),a=e.i(37806),o=e.i(47414);function l(e){let t=(0,o.useConstant)(()=>(0,r.motionValue)(e)),{isStatic:n}=(0,i.useContext)(a.MotionConfigContext);if(n){let[,n]=(0,i.useState)(e);(0,i.useEffect)(()=>t.on("change",n),[])}return t}var s=e.i(72328),d=e.i(83352),c=e.i(83411),u=e.i(87022);function f(e){return"number"==typeof e?e:parseFloat(e)}var p=e.i(44230),m=e.i(74008);function h(e,t){let n=l(t()),r=()=>n.set(t());return r(),(0,m.useIsomorphicLayoutEffect)(()=>{let t=()=>u.frame.preRender(r,!1,!0),n=e.map(e=>e.on("change",t));return()=>{n.forEach(e=>e()),(0,u.cancelFrame)(r)}}),n}function v(e,t){let n=(0,o.useConstant)(()=>[]);return h(e,()=>{n.length=0;let r=e.length;for(let t=0;t<r;t++)n[t]=e[t].get();return t(n)})}function g(e,t={}){return function(e,t={}){let{isStatic:n}=(0,i.useContext)(a.MotionConfigContext),s=()=>(0,c.isMotionValue)(e)?e.get():e;if(n)return function e(t,n,i,a){if("function"==typeof t){let e;return r.collectMotionValues.current=[],t(),e=h(r.collectMotionValues.current,t),r.collectMotionValues.current=void 0,e}if(void 0!==i&&!Array.isArray(i)&&"function"!=typeof n){var l=t,s=n,d=i,c=a;let r=(0,o.useConstant)(()=>Object.keys(d)),u=(0,o.useConstant)(()=>({}));for(let t of r)u[t]=e(l,s,d[t],c);return u}let u="function"==typeof n?n:function(...e){let t=!Array.isArray(e[0]),n=t?0:-1,r=e[0+n],i=e[1+n],a=e[2+n],o=e[3+n],l=(0,p.interpolate)(i,a,o);return t?l(r):l}(n,i,a),f=Array.isArray(t)?v(t,u):v([t],([e])=>u(e)),m=Array.isArray(t)?void 0:t.accelerate;return m&&!m.isTransformed&&"function"!=typeof n&&Array.isArray(i)&&a?.clamp!==!1&&(f.accelerate={...m,times:n,keyframes:i,isTransformed:!0,...a?.ease?{ease:a.ease}:{}}),f}(s);let m=l(s());return(0,i.useInsertionEffect)(()=>(function(e,t,n={}){let r,i=e.get(),a=null,o=i,l="string"==typeof i?i.replace(/[\d.-]/g,""):void 0,s=()=>{a&&(a.stop(),a=null),e.animation=void 0},p=()=>{(()=>{let t=f(e.get()),i=f(o);if(t===i)return s();let l=a?a.getGeneratorVelocity():e.getVelocity();s(),a=new d.JSAnimation({keyframes:[t,i],velocity:l,type:"spring",restDelta:.001,restSpeed:.01,...n,onUpdate:r})})(),e.animation=a??void 0,e.events.animationStart?.notify(),a?.then(()=>{e.animation=void 0,e.events.animationComplete?.notify()})};if(e.attach((e,t)=>{o=e,r=e=>{var n,r;return t((n=e,(r=l)?n+r:n))},u.frame.postRender(p)},s),(0,c.isMotionValue)(t)){let r=!0===n.skipInitialAnimation,i=t.on("change",t=>{var n,i,a,o;r?(r=!1,e.jump((n=t,(i=l)?n+i:n),!1)):e.set((a=t,(o=l)?a+o:a))}),a=e.on("destroy",i);return()=>{i(),a()}}return s})(m,e,t),[m,JSON.stringify(t)]),m}(e,{type:"spring",...t})}let x={stiffness:220,damping:24,mass:.45};e.s(["default",0,function(){let e=(0,s.useReducedMotion)(),r=l(-100),a=l(-100),o=g(r,x),d=g(a,x),[c,u]=(0,i.useState)("default");if((0,i.useEffect)(()=>{if(e||window.matchMedia&&window.matchMedia("(pointer: coarse)").matches)return;let t=e=>{r.set(e.clientX),a.set(e.clientY)},n=e=>{u((e=>{if(!e)return"default";if(e.closest?.("[data-cursor='terminal'], pre, code, .font-mono"))return"terminal";if(e.closest?.('a, button, [role="button"], [data-interactive="true"]'))return"interactive";let t=e.tagName;return"P"===t||"LI"===t||"H1"===t||"H2"===t||"H3"===t||"SPAN"===t?"text":"default"})(e.target))},i=()=>u("default");return document.body.addEventListener("mouseover",n),document.body.addEventListener("mouseout",n),window.addEventListener("mousemove",t),window.addEventListener("mouseleave",i),()=>{document.body.removeEventListener("mouseover",n),document.body.removeEventListener("mouseout",n),window.removeEventListener("mousemove",t),window.removeEventListener("mouseleave",i)}},[e,r,a]),e)return null;let f="interactive"===c?36:"text"===c?2:"terminal"===c?12:14,p="text"===c||"terminal"===c?22:f;return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.motion.div,{"aria-hidden":"true",style:{position:"fixed",top:0,left:0,width:f,height:p,borderRadius:"text"===c||"terminal"===c?1:999,background:"default"===c?"rgb(var(--gold-rgb) / 0.18)":"interactive"===c?"rgb(var(--gold-rgb) / 0.22)":"var(--gold)",border:"default"===c||"interactive"===c?"1px solid var(--gold)":"none",boxShadow:"interactive"===c?"0 0 12px rgb(var(--gold-rgb) / 0.5)":"default"===c?"0 0 6px rgb(var(--gold-rgb) / 0.3)":"none",pointerEvents:"none",zIndex:9999,x:o,y:d,translateX:"-50%",translateY:"-50%",transition:"width 200ms ease, height 200ms ease, background 200ms ease, border-radius 200ms ease, box-shadow 200ms ease",animation:"terminal"===c?"cursor-blink 1s steps(2) infinite":"none"}}),"interactive"===c&&(0,t.jsx)(n.motion.div,{"aria-hidden":"true",style:{position:"fixed",top:0,left:0,width:4,height:4,borderRadius:999,background:"var(--gold)",pointerEvents:"none",zIndex:1e4,x:o,y:d,translateX:"-50%",translateY:"-50%"}}),(0,t.jsx)("style",{children:`
        @keyframes cursor-blink {
          0%, 50% { opacity: 1; }
          50.01%, 100% { opacity: 0; }
        }
      `})]})}],60613)},9569,e=>{"use strict";var t=e.i(71645),n=e.i(18566);e.s(["default",0,function(){let e=(0,n.usePathname)();return(0,t.useEffect)(()=>{if("u"<typeof document)return;let t=(e??"/").replace(/^\//,"").split("/")[0]||"home";document.body.dataset.page=t},[e]),null}])},15872,e=>{"use strict";var t=e.i(71645);e.s(["default",0,function(){return(0,t.useEffect)(()=>{let e="color:#D4AF37;font-family:Georgia, serif;font-size:14px;font-style:italic;letter-spacing:0.04em";console.log("%cTITANOS",e+";font-size:32px;font-weight:bold"),console.log("%cLooking under the hood? kyle@titanos.tech if you'd like to talk.",e),console.log("%cABN 34 318 502 254 · https://abr.business.gov.au/ABN/View?id=34318502254","color:#888;font-family:ui-monospace, monospace;font-size:11px"),console.log("%cBuilt by Kyle Deligny with Claude Code, Anthropic's agentic coding tool. 1,700+ automated corpus scans this month.","color:#888;font-family:ui-monospace, monospace;font-size:11px")},[]),null}])},76666,e=>{"use strict";var t=e.i(43476),n=e.i(22016),r=e.i(61664);e.s(["default",0,function(){return(0,t.jsxs)("div",{className:"sticky-mobile-cta",children:[(0,t.jsx)(n.default,{href:r.AUDIT_MESSAGE_HREF,children:"Free consultation + report"}),(0,t.jsx)("style",{children:`
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
            font-weight: 600;
            font-size: 0.95rem;
            letter-spacing: 0.01em;
            text-decoration: none;
            border-radius: var(--radius-lg);
          }
        }
        @media (max-width: 720px) and (prefers-reduced-motion: no-preference) {
          .sticky-mobile-cta a { transition: transform 0.15s ease; }
          .sticky-mobile-cta a:active { transform: scale(0.97); }
        }
      `})]})}])},64115,e=>{"use strict";var t=e.i(71645),n=e.i(18566);let r="https://vault.titanos.tech/api/site-event";function i(e,t){let n=JSON.stringify({event:e,path:t});navigator.sendBeacon?navigator.sendBeacon(r,new Blob([n],{type:"text/plain"})):fetch(r,{method:"POST",headers:{"Content-Type":"text/plain"},body:n,keepalive:!0}).catch(()=>{})}e.s(["default",0,function(){let e=(0,n.usePathname)();return(0,t.useEffect)(()=>{i("pageview",e||"/")},[e]),(0,t.useEffect)(()=>{let t=t=>{let n=t.target?.closest("[data-analytics]");if(!n)return;let r=n.getAttribute("data-analytics");r&&i(r,e||"/")};return document.addEventListener("click",t,!0),document.addEventListener("submit",t,!0),()=>{document.removeEventListener("click",t,!0),document.removeEventListener("submit",t,!0)}},[e]),null}])}]);