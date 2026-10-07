(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,42724,e=>{"use strict";var t=e.i(43476),r=e.i(22016),n=e.i(18566);e.i(47167);var a=e.i(71645),i=e.i(31178),o=e.i(47414),l=e.i(74008),s=e.i(21476),d=e.i(72846),c=a,u=e.i(37806);function f(e,t){if("function"==typeof e)return e(t);null!=e&&(e.current=t)}class p extends c.Component{getSnapshotBeforeUpdate(e){let t=this.props.childRef.current;if((0,d.isHTMLElement)(t)&&e.isPresent&&!this.props.isPresent&&!1!==this.props.pop){let e=t.offsetParent,r=(0,d.isHTMLElement)(e)&&e.offsetWidth||0,n=(0,d.isHTMLElement)(e)&&e.offsetHeight||0,a=getComputedStyle(t),i=this.props.sizeRef.current;i.height=parseFloat(a.height),i.width=parseFloat(a.width),i.top=t.offsetTop,i.left=t.offsetLeft,i.right=r-i.width-i.left,i.bottom=n-i.height-i.top,i.direction=a.direction}return null}componentDidUpdate(){}render(){return this.props.children}}function m({children:e,isPresent:r,anchorX:n,anchorY:i,root:o,pop:l}){let s=(0,c.useId)(),d=(0,c.useRef)(null),h=(0,c.useRef)({width:0,height:0,top:0,left:0,right:0,bottom:0,direction:"ltr"}),{nonce:v}=(0,c.useContext)(u.MotionConfigContext),x=function(...e){return a.useCallback(function(...e){return t=>{let r=!1,n=e.map(e=>{let n=f(e,t);return r||"function"!=typeof n||(r=!0),n});if(r)return()=>{for(let t=0;t<n.length;t++){let r=n[t];"function"==typeof r?r():f(e[t],null)}}}}(...e),e)}(d,e.props?.ref??e?.ref);return(0,c.useInsertionEffect)(()=>{let{width:e,height:t,top:a,left:c,right:u,bottom:f,direction:p}=h.current;if(r||!1===l||!d.current||!e||!t)return;let m="rtl"===p,x="left"===n?m?`right: ${u}`:`left: ${c}`:m?`left: ${c}`:`right: ${u}`,b="bottom"===i?`bottom: ${f}`:`top: ${a}`;d.current.dataset.motionPopId=s;let g=document.createElement("style");v&&(g.nonce=v);let y=o??document.head;return y.appendChild(g),g.sheet&&g.sheet.insertRule(`
          [data-motion-pop-id="${s}"] {
            position: absolute !important;
            width: ${e}px !important;
            height: ${t}px !important;
            ${x}px !important;
            ${b}px !important;
          }
        `),()=>{d.current?.removeAttribute("data-motion-pop-id"),y.contains(g)&&y.removeChild(g)}},[r]),(0,t.jsx)(p,{isPresent:r,childRef:d,sizeRef:h,pop:l,children:!1===l?e:c.cloneElement(e,{ref:x})})}let h=({children:e,initial:r,isPresent:n,onExitComplete:i,custom:l,presenceAffectsLayout:d,mode:c,anchorX:u,anchorY:f,root:p})=>{let h=(0,o.useConstant)(v),x=(0,a.useId)(),b=!0,g=(0,a.useMemo)(()=>(b=!1,{id:x,initial:r,isPresent:n,custom:l,onExitComplete:e=>{for(let t of(h.set(e,!0),h.values()))if(!t)return;i&&i()},register:e=>(h.set(e,!1),()=>h.delete(e))}),[n,h,i]);return d&&b&&(g={...g}),(0,a.useMemo)(()=>{h.forEach((e,t)=>h.set(t,!1))},[n]),a.useEffect(()=>{n||h.size||!i||i()},[n]),e=(0,t.jsx)(m,{pop:"popLayout"===c,isPresent:n,anchorX:u,anchorY:f,root:p,children:e}),(0,t.jsx)(s.PresenceContext.Provider,{value:g,children:e})};function v(){return new Map}var x=e.i(64978);let b=e=>e.key||"";function g(e){let t=[];return a.Children.forEach(e,e=>{(0,a.isValidElement)(e)&&t.push(e)}),t}let y=({children:e,custom:r,initial:n=!0,onExitComplete:s,presenceAffectsLayout:d=!0,mode:c="sync",propagate:u=!1,anchorX:f="left",anchorY:p="top",root:m})=>{let[v,y]=(0,x.usePresence)(u),w=(0,a.useMemo)(()=>g(e),[e]),k=u&&!v?[]:w.map(b),j=(0,a.useRef)(!0),E=(0,a.useRef)(w),S=(0,o.useConstant)(()=>new Map),C=(0,a.useRef)(new Set),[T,A]=(0,a.useState)(w),[M,F]=(0,a.useState)(w);(0,l.useIsomorphicLayoutEffect)(()=>{j.current=!1,E.current=w;for(let e=0;e<M.length;e++){let t=b(M[e]);k.includes(t)?(S.delete(t),C.current.delete(t)):!0!==S.get(t)&&S.set(t,!1)}},[M,k.length,k.join("-")]);let I=[];if(w!==T){let e=[...w];for(let t=0;t<M.length;t++){let r=M[t],n=b(r);k.includes(n)||(e.splice(t,0,r),I.push(r))}return"wait"===c&&I.length&&(e=I),F(g(e)),A(w),null}let{forceRender:N}=(0,a.useContext)(i.LayoutGroupContext);return(0,t.jsx)(t.Fragment,{children:M.map(e=>{let a=b(e),i=(!u||!!v)&&(w===M||k.includes(a));return(0,t.jsx)(h,{isPresent:i,initial:(!j.current||!!n)&&void 0,custom:r,presenceAffectsLayout:d,mode:c,root:m,onExitComplete:i?void 0:()=>{if(C.current.has(a)||!S.has(a))return;C.current.add(a),S.set(a,!0);let e=!0;S.forEach(t=>{t||(e=!1)}),e&&(N?.(),F(E.current),u&&y?.(),s&&s())},anchorX:f,anchorY:p,children:e},a)})})};var w=e.i(46932),k=e.i(72328),j=e.i(74080),E=e.i(61664),S=e.i(25616);let C=[{label:"Find your offer",href:"/find",external:!1},{label:"All offers",href:"/offers",external:!1},{label:"Case studies",href:"/case-studies",external:!1},{label:"Free consultation",href:"/audit",external:!1},{label:"AI Partnership",href:"/ai-delivery",external:!1},{label:"Compliance",href:"/compliance",external:!1},{label:"Monitor",href:"/monitor",external:!1},{label:"Blog",href:"/blog",external:!1},{label:"Black Ice",href:"/black-ice",external:!1},{label:"Leads",href:"/leads",external:!1},{label:"Free Scan",href:"/scan",external:!1},{label:"Evidence Pack",href:"/our-evidence-pack",external:!1},{label:"Refer & Earn",href:"/refer",external:!1},{label:"Methodology",href:"/methodology",external:!1},{label:"Costs",href:"/costs",external:!1},{label:"Speed",href:"/speed",external:!1},{label:"About",href:"/about",external:!1},{label:"Contact",href:"/contact",external:!1}],T=[{label:"Find offer",href:"/find",external:!1},{label:"Offers",href:"/offers",external:!1},{label:"Cases",href:"/case-studies",external:!1},{label:"AI",href:"/ai-delivery",external:!1},{label:"Compliance",href:"/compliance",external:!1},{label:"Monitor",href:"/monitor",external:!1},{label:"Blog",href:"/blog",external:!1},{label:"About",href:"/about",external:!1}],A=["/audit"],M=C.filter(e=>!T.some(t=>t.href===e.href)&&!A.includes(e.href)),F={"/scan":{group:"Tools",blurb:"Free email security check"},"/our-evidence-pack":{group:"Tools",blurb:"What a TITANOS report looks like"},"/leads":{group:"Tools",blurb:"Verified local leads"},"/black-ice":{group:"Company",blurb:"How we work, calm and exact"},"/methodology":{group:"Company",blurb:"How every figure is sourced"},"/costs":{group:"Company",blurb:"Every price, every cost, all the maths"},"/speed":{group:"Company",blurb:"Fast because it is code, precise because it is checked"},"/refer":{group:"Company",blurb:"Introduce a business, get rewarded"},"/contact":{group:"Company",blurb:"Talk to Kyle directly"}},I=["Tools","Company","More"];function N({open:e,reduce:r}){let n=.22*!r,a=[.4,0,.2,1];return(0,t.jsxs)("span",{"aria-hidden":"true",style:{position:"relative",display:"inline-block",width:18,height:14},children:[(0,t.jsx)(w.motion.span,{animate:e?{rotate:45,top:6}:{rotate:0,top:0},transition:{duration:n,ease:a},style:{position:"absolute",top:0,left:0,right:0,height:1.5,background:"var(--gold)",transformOrigin:"center"}}),(0,t.jsx)(w.motion.span,{animate:e?{opacity:0}:{opacity:1},transition:{duration:n,ease:a},style:{position:"absolute",top:6,left:0,right:0,height:1.5,background:"var(--gold)"}}),(0,t.jsx)(w.motion.span,{animate:e?{rotate:-45,top:6}:{rotate:0,top:12},transition:{duration:n,ease:a},style:{position:"absolute",top:12,left:0,right:0,height:1.5,background:"var(--gold)",transformOrigin:"center"}})]})}function L({label:e,href:n,external:i}){let o=(0,k.useReducedMotion)(),[l,s]=(0,a.useState)(!1),[d,c]=(0,a.useState)(!1),u=(0,t.jsxs)(w.motion.span,{animate:{color:d?"#F5D575":l?"#B9F2FF":"#777777"},transition:{duration:.18*!o},style:{position:"relative",display:"inline-block",fontSize:"var(--fs-sm)",fontFamily:"var(--font-body), system-ui, sans-serif"},children:[e,(0,t.jsx)(w.motion.span,{"aria-hidden":"true",animate:{width:l&&!o?"100%":"0%"},transition:{duration:.18*!o,ease:[.4,0,.2,1]},style:{position:"absolute",left:0,bottom:-3,height:1,background:"var(--gold)"}})]}),f={onMouseEnter:()=>s(!0),onMouseLeave:()=>s(!1),onClick:()=>{o||(c(!0),window.setTimeout(()=>c(!1),180))},style:{marginLeft:20,padding:"8px 4px",display:"inline-block",textDecoration:"none"}};return i?(0,t.jsx)("a",{href:n,target:"_blank",rel:"noopener noreferrer",...f,children:u}):(0,t.jsx)(r.default,{href:n,...f,children:u})}function z(){let[e,i]=(0,a.useState)(!1),o=(0,a.useRef)(null),l=(0,a.useRef)(null),s=(0,a.useId)(),d=(0,n.usePathname)(),c=function(e=M){let t=I.map(e=>({title:e,items:[]}));for(let r of e){let e=F[r.href];t.find(t=>t.title===(e?.group??"More")).items.push({...r,blurb:e?.blurb})}return t.filter(e=>e.items.length>0)}();return(0,a.useEffect)(()=>i(!1),[d]),(0,a.useEffect)(()=>{if(!e)return;let t=e=>{"Escape"===e.key&&(i(!1),l.current?.focus())},r=e=>{o.current?.contains(e.target)||i(!1)};return document.addEventListener("keydown",t),document.addEventListener("mousedown",r),()=>{document.removeEventListener("keydown",t),document.removeEventListener("mousedown",r)}},[e]),(0,t.jsxs)("div",{ref:o,className:"nav-more",onBlur:t=>{e&&!o.current?.contains(t.relatedTarget)&&i(!1)},children:[(0,t.jsxs)("button",{ref:l,type:"button",className:"nav-more-btn","aria-expanded":e,"aria-controls":s,onClick:t=>{let r=!e;i(r),r&&0===t.detail&&window.setTimeout(()=>o.current?.querySelector(".nav-more-item")?.focus(),0)},children:["More",(0,t.jsx)("svg",{className:"nav-more-chev",width:"10",height:"6",viewBox:"0 0 10 6",fill:"none","aria-hidden":"true",children:(0,t.jsx)("path",{d:"M1 1l4 4 4-4",stroke:"currentColor",strokeWidth:"1.4",strokeLinecap:"round",strokeLinejoin:"round"})})]}),e&&(0,t.jsx)("div",{id:s,className:"nav-more-panel",children:c.map(e=>(0,t.jsxs)("div",{children:[(0,t.jsx)("p",{className:"nav-more-title",children:e.title}),(0,t.jsx)("ul",{style:{listStyle:"none",margin:0,padding:0},children:e.items.map(e=>(0,t.jsx)("li",{children:(0,t.jsxs)(r.default,{href:e.href,className:"nav-more-item",onClick:()=>i(!1),children:[(0,t.jsx)("span",{style:{paddingTop:6},children:(0,t.jsx)(S.default,{size:10,pulse:!1})}),(0,t.jsxs)("span",{children:[(0,t.jsx)("span",{className:"nav-more-label",children:e.label}),e.blurb&&(0,t.jsx)("span",{className:"nav-more-blurb",children:e.blurb})]})]})},e.href))})]},e.title))})]})}e.s(["default",0,function(){let e=(0,k.useReducedMotion)(),[n,i]=(0,a.useState)(!1),[o,l]=(0,a.useState)(!1),[s,d]=(0,a.useState)(!1),[c,u]=(0,a.useState)(!1);return(0,a.useEffect)(()=>u(!0),[]),(0,a.useEffect)(()=>{if(e)i(!0);else if("1"===window.sessionStorage.getItem("titanos.vault.entranceShown"))i(!0);else{let e=window.setTimeout(()=>i(!0),800);return()=>window.clearTimeout(e)}},[e]),(0,a.useEffect)(()=>{let e=window.matchMedia("(max-width: 720px)"),t=()=>d(e.matches);return t(),e.addEventListener("change",t),()=>e.removeEventListener("change",t)},[]),(0,a.useEffect)(()=>{if(!o)return;let e=e=>{"Escape"===e.key&&l(!1)};document.addEventListener("keydown",e);let t=document.body.style.overflow;return document.body.style.overflow="hidden",()=>{document.removeEventListener("keydown",e),document.body.style.overflow=t}},[o]),(0,a.useEffect)(()=>{!s&&o&&l(!1)},[s,o]),(0,t.jsxs)(w.motion.nav,{initial:{opacity:0,y:-8},animate:{opacity:+!!n,y:n?0:-8},transition:{duration:.5*!e,ease:[0,0,.2,1]},style:{position:"sticky",top:0,zIndex:30,padding:"20px",borderBottom:"1px solid var(--border)",background:"rgb(10 7 7 / 0.85)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"},children:[(0,t.jsxs)("div",{className:"container-vault",style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12},children:[(0,t.jsx)(r.default,{href:"/","aria-label":"TITANOS home",className:"font-wordmark",style:{color:"var(--gold)",fontSize:"var(--fs-lg)",textDecoration:"none",letterSpacing:"0.06em"},children:"TITANOS"}),(0,t.jsxs)("div",{className:"nav-desktop-links",style:{display:"flex",alignItems:"center"},children:[T.map(e=>(0,t.jsx)(L,{...e},e.href)),(0,t.jsx)(z,{}),(0,t.jsxs)(r.default,{href:E.AUDIT_MESSAGE_HREF,style:{marginLeft:18,padding:"8px 16px",background:"var(--gold)",color:"var(--vault-black, #0a0a0a)",fontFamily:"var(--font-body), system-ui, sans-serif",fontWeight:700,fontSize:"var(--fs-sm)",borderRadius:999,textDecoration:"none",whiteSpace:"nowrap"},children:[(0,t.jsx)("span",{className:"nav-cta-long",children:"Message Kyle for a free consultation and report"}),(0,t.jsx)("span",{className:"nav-cta-short",children:"Free consultation"})]})]}),(0,t.jsx)("button",{type:"button",className:"nav-burger","aria-label":o?"Close menu":"Open menu","aria-expanded":o,"aria-controls":"nav-drawer",onClick:()=>l(e=>!e),style:{background:"transparent",border:"1px solid var(--gold-dim)",borderRadius:"var(--radius-sm)",padding:"10px 12px",cursor:"pointer",color:"var(--gold)",display:"none",alignItems:"center",justifyContent:"center",position:"relative",width:44,height:40},children:(0,t.jsx)(N,{open:o,reduce:!!e})})]}),c&&(0,j.createPortal)((0,t.jsx)(y,{children:o&&(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(w.motion.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.2*!e},onClick:()=>l(!1),style:{position:"fixed",inset:0,background:"rgb(5 3 3 / 0.7)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",zIndex:1040,pointerEvents:"auto"},"aria-hidden":"true"},"overlay"),(0,t.jsxs)(w.motion.div,{id:"nav-drawer",role:"dialog","aria-modal":"true","aria-label":"Site navigation",initial:{x:"100%"},animate:{x:0},exit:{x:"100%"},transition:{duration:.32*!e,ease:[.4,0,.2,1]},style:{position:"fixed",top:0,right:0,bottom:0,width:"min(86vw, 360px)",maxWidth:"100vw",background:"linear-gradient(180deg, var(--vault-warm), var(--vault-black))",borderLeft:"1px solid var(--gold)",boxShadow:"-20px 0 60px rgb(0 0 0 / 0.6)",zIndex:1050,display:"flex",flexDirection:"column",padding:"32px 28px",overflowY:"auto",WebkitOverflowScrolling:"touch"},children:[(0,t.jsx)("span",{"aria-hidden":"true",style:{position:"absolute",top:0,bottom:0,left:-1,width:1,background:"linear-gradient(180deg, transparent, var(--gold), transparent)",opacity:.7}}),(0,t.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:32},children:[(0,t.jsx)("span",{className:"font-wordmark",style:{color:"var(--gold)",fontSize:"var(--fs-lg)",letterSpacing:"0.06em"},children:"TITANOS"}),(0,t.jsx)("button",{type:"button",onClick:()=>l(!1),"aria-label":"Close menu",style:{background:"transparent",border:0,color:"var(--gold)",fontSize:"1.6rem",fontFamily:"var(--font-display), Georgia, serif",cursor:"pointer",padding:"8px 12px",lineHeight:1},children:"✕"})]}),(0,t.jsx)(r.default,{href:E.AUDIT_MESSAGE_HREF,onClick:()=>l(!1),style:{display:"flex",alignItems:"center",justifyContent:"center",minHeight:44,background:"var(--gold)",color:"var(--vault-black, #0a0a0a)",fontFamily:"var(--font-body), system-ui, sans-serif",fontWeight:700,fontSize:"var(--fs-sm)",borderRadius:999,textDecoration:"none",marginBottom:24},children:"Message Kyle for a free consultation and report"}),(0,t.jsx)("nav",{children:(0,t.jsx)("ul",{style:{listStyle:"none",padding:0,margin:0},children:C.map(e=>(0,t.jsx)("li",{style:{marginBottom:8},children:e.external?(0,t.jsxs)("a",{href:e.href,target:"_blank",rel:"noopener noreferrer",onClick:()=>l(!1),className:"drawer-link",children:[(0,t.jsx)(S.default,{size:12,pulse:!1}),(0,t.jsx)("span",{children:e.label})]}):(0,t.jsxs)(r.default,{href:e.href,onClick:()=>l(!1),className:"drawer-link",children:[(0,t.jsx)(S.default,{size:12,pulse:!1}),(0,t.jsx)("span",{children:e.label})]})},e.href))})}),(0,t.jsxs)("div",{className:"font-mono",style:{marginTop:"auto",paddingTop:32,fontSize:"var(--fs-xs)",color:"var(--dim)",letterSpacing:"0.12em",textTransform:"uppercase",lineHeight:1.7,borderTop:"1px solid var(--border)"},children:["ABN 34 318 502 254",(0,t.jsx)("br",{}),"kyle@titanos.tech"]})]},"drawer")]})}),document.body),(0,t.jsx)("style",{children:`
        .nav-desktop-links {
          display: flex;
          gap: 0;
          white-space: nowrap;
          flex-wrap: nowrap;
        }
        .nav-desktop-links a { white-space: nowrap; }
        .nav-cta-short { display: none; }
        @media (max-width: 1180px) {
          .nav-cta-long { display: none; }
          .nav-cta-short { display: inline; }
        }
        @media (max-width: 900px) {
          .nav-desktop-links a[href="/blog"] { display: none; }
        }
        .nav-more { position: relative; margin-left: 20px; }
        .nav-more-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 4px; background: transparent; border: 0; cursor: pointer; line-height: inherit;
          color: var(--dim); font-size: var(--fs-sm);
          font-family: var(--font-body), system-ui, sans-serif;
          transition: color 180ms ease;
        }
        .nav-more-btn:hover, .nav-more-btn[aria-expanded="true"] { color: var(--ice); }
        .nav-more-btn:focus-visible { outline: 1px solid var(--gold); outline-offset: 3px; border-radius: 2px; }
        .nav-more-chev { transition: transform 180ms ease; }
        .nav-more-btn[aria-expanded="true"] .nav-more-chev { transform: rotate(180deg); }
        .nav-more-panel {
          position: absolute; top: calc(100% + 14px); right: -40px; z-index: 40;
          display: grid; grid-auto-flow: column; grid-auto-columns: minmax(230px, 1fr);
          gap: 32px; min-width: 560px; padding: 22px 30px 18px;
          background: linear-gradient(180deg, var(--vault-warm), var(--vault-black));
          border: 1px solid var(--gold-dim);
          border-top: 1px solid var(--gold);
          border-radius: var(--radius-md);
          box-shadow: 0 24px 60px rgb(0 0 0 / 0.65), 0 0 0 1px rgb(0 0 0 / 0.4);
        }
        .nav-more-panel::before {
          content: ""; position: absolute; top: -1px; left: 12%; right: 12%; height: 1px;
          background: linear-gradient(90deg, transparent, var(--gold-bright), transparent);
        }
        @media (prefers-reduced-motion: no-preference) {
          .nav-more-panel { animation: navMoreFade 160ms ease-out; }
        }
        @keyframes navMoreFade { from { opacity: 0; } to { opacity: 1; } }
        .nav-more-title {
          margin: 0 0 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border);
          font-family: var(--font-mono), ui-monospace, monospace; font-size: var(--fs-xs);
          letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold-dim);
        }
        .nav-more-item {
          display: flex; align-items: flex-start; gap: 10px; padding: 9px 8px;
          border-radius: var(--radius-sm); text-decoration: none; color: var(--ice);
          transition: background 160ms ease, color 160ms ease;
        }
        .nav-more-item:hover, .nav-more-item:focus-visible {
          background: rgb(var(--gold-rgb) / 0.08); outline: none;
        }
        .nav-more-item:focus-visible { box-shadow: inset 0 0 0 1px var(--gold-dim); }
        .nav-more-item:hover .nav-more-label, .nav-more-item:focus-visible .nav-more-label { color: var(--gold); }
        .nav-more-label {
          display: block; font-family: var(--font-display), Georgia, serif;
          font-style: italic; font-size: var(--fs-lg); line-height: 1.2; transition: color 160ms ease;
        }
        .nav-more-blurb {
          display: block; margin-top: 2px; font-size: var(--fs-xs); color: var(--dim);
          font-family: var(--font-body), system-ui, sans-serif;
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
      `})]})}],42724)},56691,e=>{"use strict";var t=e.i(43476),r=e.i(22016);let n=[{heading:"Services",links:[{label:"Free consultation + report",href:"/audit"},{label:"AI Partnership",href:"/ai-delivery"},{label:"Monitor",href:"/monitor"},{label:"Compliance",href:"/compliance"},{label:"Leads & Intelligence",href:"/leads"},{label:"Free Scan",href:"/scan"},{label:"Find your offer",href:"/find"},{label:"All offers",href:"/offers"}]},{heading:"Proof",links:[{label:"44 engineer-years",href:"/engineering"},{label:"Methodology",href:"/methodology"},{label:"Black Ice doctrine",href:"/black-ice"},{label:"Our scan",href:"/scan#self-scan"},{label:"Evidence pack",href:"/our-evidence-pack"},{label:"Free AI Readiness Guide (PDF)",href:"/ai-readiness-guide.pdf",external:!0},{label:"Blog",href:"/blog"}]},{heading:"Company",links:[{label:"About",href:"/about"},{label:"Contact",href:"/contact"},{label:"Message Kyle",href:"/contact"},{label:"Privacy",href:"/privacy"},{label:"Terms",href:"/terms"}]}];function a({l:e}){let n={color:"var(--dim)",padding:"4px 0",display:"inline-block",minHeight:28};return e.external?(0,t.jsx)("a",{href:e.href,target:"_blank",rel:"noopener noreferrer",style:n,children:e.label}):(0,t.jsx)(r.default,{href:e.href,style:n,children:e.label})}e.s(["default",0,function(){return(0,t.jsx)("footer",{style:{padding:"56px 20px 44px",borderTop:"1px solid var(--border)",color:"var(--dim)",fontSize:"var(--fs-sm)",position:"relative",zIndex:1},children:(0,t.jsxs)("div",{className:"container-vault",children:[(0,t.jsxs)("div",{className:"footer-columns",children:[(0,t.jsxs)("div",{className:"footer-identity",children:[(0,t.jsx)("div",{style:{fontFamily:"var(--font-display), Georgia, serif",letterSpacing:"0.1em",color:"var(--gold)",fontSize:"var(--fs-h4)",marginBottom:10},children:"TITANOS"}),(0,t.jsxs)("div",{style:{lineHeight:1.8},children:["Kyle Deligny · Brisbane, Australia",(0,t.jsx)("br",{}),"ABN 34 318 502 254"]}),(0,t.jsx)("div",{style:{marginTop:14,paddingTop:14,borderTop:"1px solid var(--border)",fontFamily:"var(--font-display), Georgia, serif",fontStyle:"italic",color:"var(--gold-dim)",fontSize:"var(--fs-sm)",letterSpacing:"0.02em"},children:"Built without asking. Kept honest by what you can check."})]}),n.map(e=>(0,t.jsxs)("nav",{"aria-label":e.heading,children:[(0,t.jsx)("div",{style:{fontFamily:"var(--font-display), Georgia, serif",color:"var(--ice)",fontSize:"var(--fs-xs)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:10},children:e.heading}),(0,t.jsx)("ul",{style:{listStyle:"none",margin:0,padding:0},children:e.links.map(e=>(0,t.jsx)("li",{children:(0,t.jsx)(a,{l:e})},e.href))})]},e.heading))]}),(0,t.jsx)("div",{style:{marginTop:36,paddingTop:18,borderTop:"1px solid var(--border)",fontSize:"var(--fs-xs)",letterSpacing:"0.05em",color:"var(--dim)",textAlign:"center"},children:"I personally review every deliverable before it reaches you · titanos.tech"})]})})}])},43439,e=>{"use strict";var t=e.i(43476),r=e.i(46932),n=e.i(70014),a=e.i(72328),i=e.i(71645);let o="titanos.vault.entranceShown";e.s(["default",0,function({playEntrance:e=!1}){let l=(0,a.useReducedMotion)(),s=(0,n.useAnimationControls)(),d=(0,n.useAnimationControls)(),c=(0,i.useRef)(!1);return(0,i.useEffect)(()=>{let t="1"===window.sessionStorage.getItem(o);if(!(e&&!t&&!l)){s.set({top:"8vh",opacity:.2}),d.set({top:"92vh",opacity:.2}),c.current=!0,l&&window.sessionStorage.setItem(o,"1");return}s.set({top:"50vh",opacity:0}),d.set({top:"50vh",opacity:0});let r=!1;return(async()=>{await new Promise(e=>setTimeout(e,200)),r||(await Promise.all([s.start({opacity:.8,transition:{duration:.2,ease:"easeOut"}}),d.start({opacity:.8,transition:{duration:.2,ease:"easeOut"}})]),await new Promise(e=>setTimeout(e,100)),r||(await Promise.all([s.start({top:"30vh",transition:{duration:.8,ease:"easeOut"}}),d.start({top:"55vh",transition:{duration:.8,ease:"easeOut"}})]),await new Promise(e=>setTimeout(e,500)),!r&&(await Promise.all([s.start({top:"8vh",opacity:.2,transition:{duration:.6,ease:"easeOut"}}),d.start({top:"92vh",opacity:.2,transition:{duration:.6,ease:"easeOut"}})]),r||(window.sessionStorage.setItem(o,"1"),c.current=!0))))})(),()=>{r=!0}},[l,e,s,d]),(0,t.jsxs)("div",{"aria-hidden":"true",style:{position:"fixed",inset:0,pointerEvents:"none",zIndex:1,viewTransitionName:"vault-frame"},children:[(0,t.jsx)(r.motion.div,{animate:s,initial:!1,style:{position:"absolute",left:0,width:"100%",height:"1px",background:"var(--gold)",opacity:0}}),(0,t.jsx)(r.motion.div,{animate:d,initial:!1,style:{position:"absolute",left:0,width:"100%",height:"1px",background:"var(--gold)",opacity:0}})]})}])},98541,e=>{"use strict";var t=e.i(43476),r=e.i(71645);e.s(["default",0,function(){let[e,n]=(0,r.useState)(!0);return((0,r.useEffect)(()=>{if("u"<typeof document)return;let e=()=>n("visible"===document.visibilityState);return e(),document.addEventListener("visibilitychange",e),()=>document.removeEventListener("visibilitychange",e)},[]),e)?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("div",{"aria-hidden":"true",className:"vault-mesh",style:{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"},children:[(0,t.jsx)("span",{className:"vault-blob vault-blob-1"}),(0,t.jsx)("span",{className:"vault-blob vault-blob-2"}),(0,t.jsx)("span",{className:"vault-blob vault-blob-3"})]}),(0,t.jsx)("span",{"aria-hidden":"true",className:"vault-specular"}),(0,t.jsx)("style",{children:`
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
      `})]}):null}])},22688,e=>{"use strict";var t=e.i(43476),r=e.i(71645);function n(e,t,r=!1){return{x:Math.random()*e,y:r?t+40*Math.random():Math.random()*t,r:.5+ +Math.random(),o:.05+.1*Math.random(),vy:-(.05+.25*Math.random()),vx:(Math.random()-.5)*.1}}e.s(["default",0,function(){let e=(0,r.useRef)(null);return(0,r.useEffect)(()=>{if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;let t=e.current;if(!t)return;let r=t.getContext("2d");if(!r)return;let a=(getComputedStyle(document.documentElement).getPropertyValue("--gold-rgb").trim()||"212 175 55").split(/\s+/).join(","),i=e=>`rgba(${a},${e})`,o=t.width=window.innerWidth,l=t.height=window.innerHeight,s=Math.min(window.devicePixelRatio||1,2),d=()=>{o=window.innerWidth,l=window.innerHeight,t.width=o*s,t.height=l*s,t.style.width=o+"px",t.style.height=l+"px",r.setTransform(s,0,0,s,0,0)};d(),window.addEventListener("resize",d);let c=Array.from({length:30},()=>n(o,l)),u={x:-9999,y:-9999},f=e=>{u.x=e.clientX,u.y=e.clientY};window.addEventListener("mousemove",f);let p=0,m=()=>{for(let e of(r.clearRect(0,0,o,l),c)){let t=u.x-e.x,a=u.y-e.y,s=t*t+a*a;s<22500&&s>1&&(e.x+=6e-4*t,e.y+=6e-4*a),e.x+=e.vx,e.y+=e.vy,e.y<-10&&Object.assign(e,n(o,l,!0)),e.x<-10&&(e.x=o+10),e.x>o+10&&(e.x=-10),r.beginPath(),r.arc(e.x,e.y,e.r,0,2*Math.PI),r.fillStyle=i(e.o),r.fill()}p=requestAnimationFrame(m)};return p=requestAnimationFrame(m),()=>{cancelAnimationFrame(p),window.removeEventListener("resize",d),window.removeEventListener("mousemove",f)}},[]),(0,t.jsx)("canvas",{ref:e,"aria-hidden":"true",style:{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}})}])},60613,e=>{"use strict";var t=e.i(43476),r=e.i(46932),n=e.i(86427),a=e.i(71645),i=e.i(37806),o=e.i(47414);function l(e){let t=(0,o.useConstant)(()=>(0,n.motionValue)(e)),{isStatic:r}=(0,a.useContext)(i.MotionConfigContext);if(r){let[,r]=(0,a.useState)(e);(0,a.useEffect)(()=>t.on("change",r),[])}return t}var s=e.i(72328),d=e.i(83352),c=e.i(83411),u=e.i(87022);function f(e){return"number"==typeof e?e:parseFloat(e)}var p=e.i(44230),m=e.i(74008);function h(e,t){let r=l(t()),n=()=>r.set(t());return n(),(0,m.useIsomorphicLayoutEffect)(()=>{let t=()=>u.frame.preRender(n,!1,!0),r=e.map(e=>e.on("change",t));return()=>{r.forEach(e=>e()),(0,u.cancelFrame)(n)}}),r}function v(e,t){let r=(0,o.useConstant)(()=>[]);return h(e,()=>{r.length=0;let n=e.length;for(let t=0;t<n;t++)r[t]=e[t].get();return t(r)})}function x(e,t={}){return function(e,t={}){let{isStatic:r}=(0,a.useContext)(i.MotionConfigContext),s=()=>(0,c.isMotionValue)(e)?e.get():e;if(r)return function e(t,r,a,i){if("function"==typeof t){let e;return n.collectMotionValues.current=[],t(),e=h(n.collectMotionValues.current,t),n.collectMotionValues.current=void 0,e}if(void 0!==a&&!Array.isArray(a)&&"function"!=typeof r){var l=t,s=r,d=a,c=i;let n=(0,o.useConstant)(()=>Object.keys(d)),u=(0,o.useConstant)(()=>({}));for(let t of n)u[t]=e(l,s,d[t],c);return u}let u="function"==typeof r?r:function(...e){let t=!Array.isArray(e[0]),r=t?0:-1,n=e[0+r],a=e[1+r],i=e[2+r],o=e[3+r],l=(0,p.interpolate)(a,i,o);return t?l(n):l}(r,a,i),f=Array.isArray(t)?v(t,u):v([t],([e])=>u(e)),m=Array.isArray(t)?void 0:t.accelerate;return m&&!m.isTransformed&&"function"!=typeof r&&Array.isArray(a)&&i?.clamp!==!1&&(f.accelerate={...m,times:r,keyframes:a,isTransformed:!0,...i?.ease?{ease:i.ease}:{}}),f}(s);let m=l(s());return(0,a.useInsertionEffect)(()=>(function(e,t,r={}){let n,a=e.get(),i=null,o=a,l="string"==typeof a?a.replace(/[\d.-]/g,""):void 0,s=()=>{i&&(i.stop(),i=null),e.animation=void 0},p=()=>{(()=>{let t=f(e.get()),a=f(o);if(t===a)return s();let l=i?i.getGeneratorVelocity():e.getVelocity();s(),i=new d.JSAnimation({keyframes:[t,a],velocity:l,type:"spring",restDelta:.001,restSpeed:.01,...r,onUpdate:n})})(),e.animation=i??void 0,e.events.animationStart?.notify(),i?.then(()=>{e.animation=void 0,e.events.animationComplete?.notify()})};if(e.attach((e,t)=>{o=e,n=e=>{var r,n;return t((r=e,(n=l)?r+n:r))},u.frame.postRender(p)},s),(0,c.isMotionValue)(t)){let n=!0===r.skipInitialAnimation,a=t.on("change",t=>{var r,a,i,o;n?(n=!1,e.jump((r=t,(a=l)?r+a:r),!1)):e.set((i=t,(o=l)?i+o:i))}),i=e.on("destroy",a);return()=>{a(),i()}}return s})(m,e,t),[m,JSON.stringify(t)]),m}(e,{type:"spring",...t})}let b={stiffness:220,damping:24,mass:.45};e.s(["default",0,function(){let e=(0,s.useReducedMotion)(),n=l(-100),i=l(-100),o=x(n,b),d=x(i,b),[c,u]=(0,a.useState)("default");if((0,a.useEffect)(()=>{if(e||window.matchMedia&&window.matchMedia("(pointer: coarse)").matches)return;let t=e=>{n.set(e.clientX),i.set(e.clientY)},r=e=>{u((e=>{if(!e)return"default";if(e.closest?.("[data-cursor='terminal'], pre, code, .font-mono"))return"terminal";if(e.closest?.('a, button, [role="button"], [data-interactive="true"]'))return"interactive";let t=e.tagName;return"P"===t||"LI"===t||"H1"===t||"H2"===t||"H3"===t||"SPAN"===t?"text":"default"})(e.target))},a=()=>u("default");return document.body.addEventListener("mouseover",r),document.body.addEventListener("mouseout",r),window.addEventListener("mousemove",t),window.addEventListener("mouseleave",a),()=>{document.body.removeEventListener("mouseover",r),document.body.removeEventListener("mouseout",r),window.removeEventListener("mousemove",t),window.removeEventListener("mouseleave",a)}},[e,n,i]),e)return null;let f="interactive"===c?36:"text"===c?2:"terminal"===c?12:14,p="text"===c||"terminal"===c?22:f;return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(r.motion.div,{"aria-hidden":"true",style:{position:"fixed",top:0,left:0,width:f,height:p,borderRadius:"text"===c||"terminal"===c?1:999,background:"default"===c?"rgb(var(--gold-rgb) / 0.18)":"interactive"===c?"rgb(var(--gold-rgb) / 0.22)":"var(--gold)",border:"default"===c||"interactive"===c?"1px solid var(--gold)":"none",boxShadow:"interactive"===c?"0 0 12px rgb(var(--gold-rgb) / 0.5)":"default"===c?"0 0 6px rgb(var(--gold-rgb) / 0.3)":"none",pointerEvents:"none",zIndex:9999,x:o,y:d,translateX:"-50%",translateY:"-50%",transition:"width 200ms ease, height 200ms ease, background 200ms ease, border-radius 200ms ease, box-shadow 200ms ease",animation:"terminal"===c?"cursor-blink 1s steps(2) infinite":"none"}}),"interactive"===c&&(0,t.jsx)(r.motion.div,{"aria-hidden":"true",style:{position:"fixed",top:0,left:0,width:4,height:4,borderRadius:999,background:"var(--gold)",pointerEvents:"none",zIndex:1e4,x:o,y:d,translateX:"-50%",translateY:"-50%"}}),(0,t.jsx)("style",{children:`
        @keyframes cursor-blink {
          0%, 50% { opacity: 1; }
          50.01%, 100% { opacity: 0; }
        }
      `})]})}],60613)},9569,e=>{"use strict";var t=e.i(71645),r=e.i(18566);e.s(["default",0,function(){let e=(0,r.usePathname)();return(0,t.useEffect)(()=>{if("u"<typeof document)return;let t=(e??"/").replace(/^\//,"").split("/")[0]||"home";document.body.dataset.page=t},[e]),null}])},15872,e=>{"use strict";var t=e.i(71645);e.s(["default",0,function(){return(0,t.useEffect)(()=>{let e="color:#D4AF37;font-family:Georgia, serif;font-size:14px;font-style:italic;letter-spacing:0.04em";console.log("%cTITANOS",e+";font-size:32px;font-weight:bold"),console.log("%cLooking under the hood? kyle@titanos.tech if you'd like to talk.",e),console.log("%cABN 34 318 502 254 · https://abr.business.gov.au/ABN/View?id=34318502254","color:#888;font-family:ui-monospace, monospace;font-size:11px"),console.log("%cBuilt by Kyle Deligny with Claude Code, Anthropic's agentic coding tool.","color:#888;font-family:ui-monospace, monospace;font-size:11px")},[]),null}])},76666,e=>{"use strict";var t=e.i(43476),r=e.i(22016),n=e.i(61664);e.s(["default",0,function(){return(0,t.jsxs)("div",{className:"sticky-mobile-cta",children:[(0,t.jsx)(r.default,{href:n.AUDIT_MESSAGE_HREF,children:"Free consultation + report"}),(0,t.jsx)("style",{children:`
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
      `})]})}])},64115,e=>{"use strict";var t=e.i(71645),r=e.i(18566);let n="https://vault.titanos.tech/api/site-event";function a(e,t){let r=JSON.stringify({event:e,path:t});navigator.sendBeacon?navigator.sendBeacon(n,new Blob([r],{type:"text/plain"})):fetch(n,{method:"POST",headers:{"Content-Type":"text/plain"},body:r,keepalive:!0}).catch(()=>{})}e.s(["default",0,function(){let e=(0,r.usePathname)();return(0,t.useEffect)(()=>{a("pageview",e||"/")},[e]),(0,t.useEffect)(()=>{let t=t=>{let r=t.target?.closest("[data-analytics]");if(!r)return;let n=r.getAttribute("data-analytics");n&&a(n,e||"/")};return document.addEventListener("click",t,!0),document.addEventListener("submit",t,!0),()=>{document.removeEventListener("click",t,!0),document.removeEventListener("submit",t,!0)}},[e]),null}])},90926,e=>{"use strict";var t=e.i(43476),r=e.i(71645),n=e.i(18566),a=e.i(87226);e.s(["default",0,function(){let e=(0,n.usePathname)(),[i,o]=(0,r.useState)(!1),l=(0,r.useRef)(null),s=(0,r.useRef)(null);(0,r.useEffect)(()=>{o(!1)},[e]);let d=(0,r.useRef)(null);return((0,r.useEffect)(()=>{if(!i)return;l.current?.focus();let e=e=>{if("Escape"===e.key){o(!1),s.current?.focus();return}if("Tab"!==e.key||!d.current)return;let t=Array.from(d.current.querySelectorAll("a[href],button,input,summary")).filter(e=>!e.hasAttribute("disabled")&&null!==e.offsetParent);if(!t.length)return;let r=t[0],n=t[t.length-1];e.shiftKey&&document.activeElement===r?(e.preventDefault(),n.focus()):e.shiftKey||document.activeElement!==n||(e.preventDefault(),r.focus())};return document.addEventListener("keydown",e),()=>document.removeEventListener("keydown",e)},[i]),"/find"===e||"/find/"===e)?null:(0,t.jsxs)(t.Fragment,{children:[!i&&(0,t.jsx)("button",{ref:s,type:"button",className:"finder-fab",onClick:()=>o(!0),"aria-haspopup":"dialog",children:"Find my offer"}),(0,t.jsxs)("div",{ref:d,hidden:!i,className:"finder-sheet",role:"dialog","aria-modal":"true","aria-label":"Offer finder",children:[(0,t.jsxs)("div",{className:"finder-sheet-head",children:[(0,t.jsx)("strong",{children:"Find my offer"}),(0,t.jsx)("button",{ref:l,type:"button",className:"finder-close",onClick:()=>{o(!1),s.current?.focus()},children:"Close"})]}),(0,t.jsx)("div",{className:"finder-sheet-body",children:(0,t.jsx)(a.default,{compact:!0})})]}),(0,t.jsx)("style",{children:`
        .finder-sheet[hidden] { display: none; }
        .finder-fab { position: fixed; right: 20px; bottom: 20px; z-index: 45; min-height: 44px; padding: 10px 20px; background: var(--gold); color: var(--vault-black, #0a0a0a); border: 1px solid var(--gold); border-radius: 999px; font: inherit; font-weight: 600; font-size: 0.95rem; cursor: pointer; box-shadow: 0 4px 18px rgb(0 0 0 / 0.5); }
        .finder-fab:focus-visible, .finder-close:focus-visible { outline: 3px solid var(--gold-bright, #F5D575); outline-offset: 3px; }
        .finder-sheet { position: fixed; right: 20px; bottom: 20px; z-index: 60; width: min(440px, calc(100vw - 24px)); max-height: min(78vh, 720px); display: flex; flex-direction: column; background: var(--vault-black, #0b0908); border: 1px solid var(--gold-dim); border-radius: var(--radius-lg); box-shadow: 0 10px 40px rgb(0 0 0 / 0.7); }
        .finder-sheet-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--gold-dim); color: var(--gold); }
        .finder-close { min-height: 44px; padding: 6px 14px; background: transparent; color: var(--ice); border: 1px solid var(--gold-dim); border-radius: 999px; font: inherit; cursor: pointer; }
        .finder-sheet-body { overflow-y: auto; padding: 14px 16px 18px; }
        @media (max-width: 720px) {
          .finder-fab { right: 12px; bottom: calc(76px + env(safe-area-inset-bottom)); min-height: 44px; padding: 8px 14px; font-size: 0.85rem; }
          body { padding-bottom: 72px; }
          .finder-sheet { left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); width: auto; max-height: 86vh; }
        }
      `})]})}])}]);