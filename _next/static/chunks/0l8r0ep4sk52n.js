(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,42724,e=>{"use strict";var t=e.i(43476),r=e.i(22016),a=e.i(18566);e.i(47167);var n=e.i(71645),o=e.i(31178),i=e.i(47414),l=e.i(74008),s=e.i(21476),d=e.i(72846),c=n,u=e.i(37806);function f(e,t){if("function"==typeof e)return e(t);null!=e&&(e.current=t)}class p extends c.Component{getSnapshotBeforeUpdate(e){let t=this.props.childRef.current;if((0,d.isHTMLElement)(t)&&e.isPresent&&!this.props.isPresent&&!1!==this.props.pop){let e=t.offsetParent,r=(0,d.isHTMLElement)(e)&&e.offsetWidth||0,a=(0,d.isHTMLElement)(e)&&e.offsetHeight||0,n=getComputedStyle(t),o=this.props.sizeRef.current;o.height=parseFloat(n.height),o.width=parseFloat(n.width),o.top=t.offsetTop,o.left=t.offsetLeft,o.right=r-o.width-o.left,o.bottom=a-o.height-o.top,o.direction=n.direction}return null}componentDidUpdate(){}render(){return this.props.children}}function m({children:e,isPresent:r,anchorX:a,anchorY:o,root:i,pop:l}){let s=(0,c.useId)(),d=(0,c.useRef)(null),h=(0,c.useRef)({width:0,height:0,top:0,left:0,right:0,bottom:0,direction:"ltr"}),{nonce:b}=(0,c.useContext)(u.MotionConfigContext),v=function(...e){return n.useCallback(function(...e){return t=>{let r=!1,a=e.map(e=>{let a=f(e,t);return r||"function"!=typeof a||(r=!0),a});if(r)return()=>{for(let t=0;t<a.length;t++){let r=a[t];"function"==typeof r?r():f(e[t],null)}}}}(...e),e)}(d,e.props?.ref??e?.ref);return(0,c.useInsertionEffect)(()=>{let{width:e,height:t,top:n,left:c,right:u,bottom:f,direction:p}=h.current;if(r||!1===l||!d.current||!e||!t)return;let m="rtl"===p,v="left"===a?m?`right: ${u}`:`left: ${c}`:m?`left: ${c}`:`right: ${u}`,x="bottom"===o?`bottom: ${f}`:`top: ${n}`;d.current.dataset.motionPopId=s;let g=document.createElement("style");b&&(g.nonce=b);let y=i??document.head;return y.appendChild(g),g.sheet&&g.sheet.insertRule(`
          [data-motion-pop-id="${s}"] {
            position: absolute !important;
            width: ${e}px !important;
            height: ${t}px !important;
            ${v}px !important;
            ${x}px !important;
          }
        `),()=>{d.current?.removeAttribute("data-motion-pop-id"),y.contains(g)&&y.removeChild(g)}},[r]),(0,t.jsx)(p,{isPresent:r,childRef:d,sizeRef:h,pop:l,children:!1===l?e:c.cloneElement(e,{ref:v})})}let h=({children:e,initial:r,isPresent:a,onExitComplete:o,custom:l,presenceAffectsLayout:d,mode:c,anchorX:u,anchorY:f,root:p})=>{let h=(0,i.useConstant)(b),v=(0,n.useId)(),x=!0,g=(0,n.useMemo)(()=>(x=!1,{id:v,initial:r,isPresent:a,custom:l,onExitComplete:e=>{for(let t of(h.set(e,!0),h.values()))if(!t)return;o&&o()},register:e=>(h.set(e,!1),()=>h.delete(e))}),[a,h,o]);return d&&x&&(g={...g}),(0,n.useMemo)(()=>{h.forEach((e,t)=>h.set(t,!1))},[a]),n.useEffect(()=>{a||h.size||!o||o()},[a]),e=(0,t.jsx)(m,{pop:"popLayout"===c,isPresent:a,anchorX:u,anchorY:f,root:p,children:e}),(0,t.jsx)(s.PresenceContext.Provider,{value:g,children:e})};function b(){return new Map}var v=e.i(64978);let x=e=>e.key||"";function g(e){let t=[];return n.Children.forEach(e,e=>{(0,n.isValidElement)(e)&&t.push(e)}),t}let y=({children:e,custom:r,initial:a=!0,onExitComplete:s,presenceAffectsLayout:d=!0,mode:c="sync",propagate:u=!1,anchorX:f="left",anchorY:p="top",root:m})=>{let[b,y]=(0,v.usePresence)(u),w=(0,n.useMemo)(()=>g(e),[e]),k=u&&!b?[]:w.map(x),j=(0,n.useRef)(!0),S=(0,n.useRef)(w),E=(0,i.useConstant)(()=>new Map),C=(0,n.useRef)(new Set),[T,I]=(0,n.useState)(w),[F,P]=(0,n.useState)(w);(0,l.useIsomorphicLayoutEffect)(()=>{j.current=!1,S.current=w;for(let e=0;e<F.length;e++){let t=x(F[e]);k.includes(t)?(E.delete(t),C.current.delete(t)):!0!==E.get(t)&&E.set(t,!1)}},[F,k.length,k.join("-")]);let A=[];if(w!==T){let e=[...w];for(let t=0;t<F.length;t++){let r=F[t],a=x(r);k.includes(a)||(e.splice(t,0,r),A.push(r))}return"wait"===c&&A.length&&(e=A),P(g(e)),I(w),null}let{forceRender:M}=(0,n.useContext)(o.LayoutGroupContext);return(0,t.jsx)(t.Fragment,{children:F.map(e=>{let n=x(e),o=(!u||!!b)&&(w===F||k.includes(n));return(0,t.jsx)(h,{isPresent:o,initial:(!j.current||!!a)&&void 0,custom:r,presenceAffectsLayout:d,mode:c,root:m,onExitComplete:o?void 0:()=>{if(C.current.has(n)||!E.has(n))return;C.current.add(n),E.set(n,!0);let e=!0;E.forEach(t=>{t||(e=!1)}),e&&(M?.(),P(S.current),u&&y?.(),s&&s())},anchorX:f,anchorY:p,children:e},n)})})};var w=e.i(46932),k=e.i(72328),j=e.i(74080),S=e.i(61664),E=e.i(25616);let C=[{label:"Find your offer",href:"/find",external:!1},{label:"All offers",href:"/offers",external:!1},{label:"Products and courses",href:"/products",external:!1},{label:"Case studies",href:"/case-studies",external:!1},{label:"Free consultation",href:"/audit",external:!1},{label:"AI Partnership",href:"/ai-delivery",external:!1},{label:"Compliance",href:"/compliance",external:!1},{label:"Monitor",href:"/monitor",external:!1},{label:"Blog",href:"/blog",external:!1},{label:"Black Ice",href:"/black-ice",external:!1},{label:"Leads",href:"/leads",external:!1},{label:"Free Scan",href:"/scan",external:!1},{label:"Evidence Pack",href:"/our-evidence-pack",external:!1},{label:"Refer & Earn",href:"/refer",external:!1},{label:"Methodology",href:"/methodology",external:!1},{label:"Costs",href:"/costs",external:!1},{label:"Speed",href:"/speed",external:!1},{label:"Efficiency",href:"/efficiency",external:!1},{label:"Parallax",href:"/parallax",external:!1},{label:"Investors",href:"/investors",external:!1},{label:"Mission",href:"/mission",external:!1},{label:"Proof",href:"/proof",external:!1},{label:"About",href:"/about",external:!1},{label:"Contact",href:"/contact",external:!1}],T=[{label:"Find offer",href:"/find",external:!1},{label:"Offers",href:"/offers",external:!1},{label:"Cases",href:"/case-studies",external:!1},{label:"AI",href:"/ai-delivery",external:!1},{label:"Compliance",href:"/compliance",external:!1},{label:"Monitor",href:"/monitor",external:!1},{label:"Blog",href:"/blog",external:!1},{label:"About",href:"/about",external:!1}],I=["/audit"],F=C.filter(e=>!T.some(t=>t.href===e.href)&&!I.includes(e.href)),P={"/products":{group:"Tools",blurb:"Guides, templates and short courses to keep"},"/scan":{group:"Tools",blurb:"Free email security check"},"/our-evidence-pack":{group:"Tools",blurb:"What a TITANOS report looks like"},"/leads":{group:"Tools",blurb:"Verified local leads"},"/black-ice":{group:"Company",blurb:"How we work, calm and exact"},"/methodology":{group:"Company",blurb:"How every figure is sourced"},"/costs":{group:"Company",blurb:"Every price, every cost, all the maths"},"/investors":{group:"Company",blurb:"What your money builds"},"/mission":{group:"Company",blurb:"Time back for people, money back to the world"},"/parallax":{group:"Company",blurb:"The simplest way to bring AI in"},"/proof":{group:"Company",blurb:"Public code, test logs, a replayable build"},"/efficiency":{group:"Company",blurb:"Every efficiency figure, before and after, with its method"},"/speed":{group:"Company",blurb:"Fast because it is code, precise because it is checked"},"/refer":{group:"Company",blurb:"Introduce a business, get rewarded"},"/contact":{group:"Company",blurb:"Talk to Kyle directly"}},A=["Tools","Company","More"];function M({open:e,reduce:r}){let a=.22*!r,n=[.4,0,.2,1];return(0,t.jsxs)("span",{"aria-hidden":"true",style:{position:"relative",display:"inline-block",width:18,height:14},children:[(0,t.jsx)(w.motion.span,{animate:e?{rotate:45,top:6}:{rotate:0,top:0},transition:{duration:a,ease:n},style:{position:"absolute",top:0,left:0,right:0,height:1.5,background:"var(--gold)",transformOrigin:"center"}}),(0,t.jsx)(w.motion.span,{animate:e?{opacity:0}:{opacity:1},transition:{duration:a,ease:n},style:{position:"absolute",top:6,left:0,right:0,height:1.5,background:"var(--gold)"}}),(0,t.jsx)(w.motion.span,{animate:e?{rotate:-45,top:6}:{rotate:0,top:12},transition:{duration:a,ease:n},style:{position:"absolute",top:12,left:0,right:0,height:1.5,background:"var(--gold)",transformOrigin:"center"}})]})}function N({label:e,href:a,external:o}){let i=(0,k.useReducedMotion)(),[l,s]=(0,n.useState)(!1),[d,c]=(0,n.useState)(!1),u=(0,t.jsxs)(w.motion.span,{animate:{color:d?"#F5D575":l?"#B9F2FF":"#777777"},transition:{duration:.18*!i},style:{position:"relative",display:"inline-block",fontSize:"var(--fs-sm)",fontFamily:"var(--font-body), system-ui, sans-serif"},children:[e,(0,t.jsx)(w.motion.span,{"aria-hidden":"true",animate:{width:l&&!i?"100%":"0%"},transition:{duration:.18*!i,ease:[.4,0,.2,1]},style:{position:"absolute",left:0,bottom:-3,height:1,background:"var(--gold)"}})]}),f={onMouseEnter:()=>s(!0),onMouseLeave:()=>s(!1),onClick:()=>{i||(c(!0),window.setTimeout(()=>c(!1),180))},style:{marginLeft:20,padding:"8px 4px",display:"inline-block",textDecoration:"none"}};return o?(0,t.jsx)("a",{href:a,target:"_blank",rel:"noopener noreferrer",...f,children:u}):(0,t.jsx)(r.default,{href:a,...f,children:u})}function z(){let[e,o]=(0,n.useState)(!1),i=(0,n.useRef)(null),l=(0,n.useRef)(null),s=(0,n.useId)(),d=(0,a.usePathname)(),c=function(e=F){let t=A.map(e=>({title:e,items:[]}));for(let r of e){let e=P[r.href];t.find(t=>t.title===(e?.group??"More")).items.push({...r,blurb:e?.blurb})}return t.filter(e=>e.items.length>0)}();return(0,n.useEffect)(()=>o(!1),[d]),(0,n.useEffect)(()=>{if(!e)return;let t=e=>{"Escape"===e.key&&(o(!1),l.current?.focus())},r=e=>{i.current?.contains(e.target)||o(!1)};return document.addEventListener("keydown",t),document.addEventListener("mousedown",r),()=>{document.removeEventListener("keydown",t),document.removeEventListener("mousedown",r)}},[e]),(0,t.jsxs)("div",{ref:i,className:"nav-more",onBlur:t=>{e&&!i.current?.contains(t.relatedTarget)&&o(!1)},children:[(0,t.jsxs)("button",{ref:l,type:"button",className:"nav-more-btn","aria-expanded":e,"aria-controls":s,onClick:t=>{let r=!e;o(r),r&&0===t.detail&&window.setTimeout(()=>i.current?.querySelector(".nav-more-item")?.focus(),0)},children:["More",(0,t.jsx)("svg",{className:"nav-more-chev",width:"10",height:"6",viewBox:"0 0 10 6",fill:"none","aria-hidden":"true",children:(0,t.jsx)("path",{d:"M1 1l4 4 4-4",stroke:"currentColor",strokeWidth:"1.4",strokeLinecap:"round",strokeLinejoin:"round"})})]}),e&&(0,t.jsx)("div",{id:s,className:"nav-more-panel",children:c.map(e=>(0,t.jsxs)("div",{children:[(0,t.jsx)("p",{className:"nav-more-title",children:e.title}),(0,t.jsx)("ul",{style:{listStyle:"none",margin:0,padding:0},children:e.items.map(e=>(0,t.jsx)("li",{children:(0,t.jsxs)(r.default,{href:e.href,className:"nav-more-item",onClick:()=>o(!1),children:[(0,t.jsx)("span",{style:{paddingTop:6},children:(0,t.jsx)(E.default,{size:10,pulse:!1})}),(0,t.jsxs)("span",{children:[(0,t.jsx)("span",{className:"nav-more-label",children:e.label}),e.blurb&&(0,t.jsx)("span",{className:"nav-more-blurb",children:e.blurb})]})]})},e.href))})]},e.title))})]})}e.s(["default",0,function(){let e=(0,k.useReducedMotion)(),[a,o]=(0,n.useState)(!1),[i,l]=(0,n.useState)(!1),[s,d]=(0,n.useState)(!1),[c,u]=(0,n.useState)(!1);return(0,n.useEffect)(()=>u(!0),[]),(0,n.useEffect)(()=>{if(e)o(!0);else if("1"===window.sessionStorage.getItem("titanos.vault.entranceShown"))o(!0);else{let e=window.setTimeout(()=>o(!0),800);return()=>window.clearTimeout(e)}},[e]),(0,n.useEffect)(()=>{let e=window.matchMedia("(max-width: 1024px)"),t=()=>d(e.matches);return t(),e.addEventListener("change",t),()=>e.removeEventListener("change",t)},[]),(0,n.useEffect)(()=>{if(!i)return;let e=e=>{"Escape"===e.key&&l(!1)};document.addEventListener("keydown",e);let t=document.body.style.overflow;return document.body.style.overflow="hidden",()=>{document.removeEventListener("keydown",e),document.body.style.overflow=t}},[i]),(0,n.useEffect)(()=>{!s&&i&&l(!1)},[s,i]),(0,t.jsxs)(w.motion.nav,{initial:{opacity:0,y:-8},animate:{opacity:+!!a,y:a?0:-8},transition:{duration:.5*!e,ease:[0,0,.2,1]},style:{position:"sticky",top:0,zIndex:30,padding:"20px",borderBottom:"1px solid var(--border)",background:"rgb(10 7 7 / 0.85)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"},children:[(0,t.jsxs)("div",{className:"container-vault",style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12},children:[(0,t.jsx)(r.default,{href:"/","aria-label":"TITANOS home",className:"font-wordmark",style:{color:"var(--gold)",fontSize:"var(--fs-lg)",textDecoration:"none",letterSpacing:"0.06em"},children:"TITANOS"}),(0,t.jsxs)("div",{className:"nav-desktop-links",style:{display:"flex",alignItems:"center"},children:[T.map(e=>(0,t.jsx)(N,{...e},e.href)),(0,t.jsx)(z,{}),(0,t.jsxs)(r.default,{href:S.AUDIT_MESSAGE_HREF,style:{marginLeft:18,padding:"8px 16px",background:"var(--gold)",color:"var(--vault-black, #0a0a0a)",fontFamily:"var(--font-body), system-ui, sans-serif",fontWeight:700,fontSize:"var(--fs-sm)",borderRadius:999,textDecoration:"none",whiteSpace:"nowrap"},children:[(0,t.jsx)("span",{className:"nav-cta-long",children:"Message Kyle for a free consultation and report"}),(0,t.jsx)("span",{className:"nav-cta-short",children:"Free consultation"})]})]}),(0,t.jsx)("button",{type:"button",className:"nav-burger","aria-label":i?"Close menu":"Open menu","aria-expanded":i,"aria-controls":"nav-drawer",onClick:()=>l(e=>!e),style:{background:"transparent",border:"1px solid var(--gold-dim)",borderRadius:"var(--radius-sm)",padding:"10px 12px",cursor:"pointer",color:"var(--gold)",display:"none",alignItems:"center",justifyContent:"center",position:"relative",width:44,height:40},children:(0,t.jsx)(M,{open:i,reduce:!!e})})]}),c&&(0,j.createPortal)((0,t.jsx)(y,{children:i&&(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(w.motion.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.2*!e},onClick:()=>l(!1),style:{position:"fixed",inset:0,background:"rgb(5 3 3 / 0.7)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",zIndex:1040,pointerEvents:"auto"},"aria-hidden":"true"},"overlay"),(0,t.jsxs)(w.motion.div,{id:"nav-drawer",role:"dialog","aria-modal":"true","aria-label":"Site navigation",initial:{x:"100%"},animate:{x:0},exit:{x:"100%"},transition:{duration:.32*!e,ease:[.4,0,.2,1]},style:{position:"fixed",top:0,right:0,bottom:0,width:"min(86vw, 360px)",maxWidth:"100vw",background:"linear-gradient(180deg, var(--vault-warm), var(--vault-black))",borderLeft:"1px solid var(--gold)",boxShadow:"-20px 0 60px rgb(0 0 0 / 0.6)",zIndex:1050,display:"flex",flexDirection:"column",padding:"32px 28px",overflowY:"auto",WebkitOverflowScrolling:"touch"},children:[(0,t.jsx)("span",{"aria-hidden":"true",style:{position:"absolute",top:0,bottom:0,left:-1,width:1,background:"linear-gradient(180deg, transparent, var(--gold), transparent)",opacity:.7}}),(0,t.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:32},children:[(0,t.jsx)("span",{className:"font-wordmark",style:{color:"var(--gold)",fontSize:"var(--fs-lg)",letterSpacing:"0.06em"},children:"TITANOS"}),(0,t.jsx)("button",{type:"button",onClick:()=>l(!1),"aria-label":"Close menu",style:{background:"transparent",border:0,color:"var(--gold)",fontSize:"1.6rem",fontFamily:"var(--font-display), Georgia, serif",cursor:"pointer",padding:"8px 12px",lineHeight:1},children:"✕"})]}),(0,t.jsx)(r.default,{href:S.AUDIT_MESSAGE_HREF,onClick:()=>l(!1),style:{display:"flex",alignItems:"center",justifyContent:"center",minHeight:44,background:"var(--gold)",color:"var(--vault-black, #0a0a0a)",fontFamily:"var(--font-body), system-ui, sans-serif",fontWeight:700,fontSize:"var(--fs-sm)",borderRadius:999,textDecoration:"none",marginBottom:24},children:"Message Kyle for a free consultation and report"}),(0,t.jsx)("nav",{children:(0,t.jsx)("ul",{style:{listStyle:"none",padding:0,margin:0},children:C.map(e=>(0,t.jsx)("li",{style:{marginBottom:8},children:e.external?(0,t.jsxs)("a",{href:e.href,target:"_blank",rel:"noopener noreferrer",onClick:()=>l(!1),className:"drawer-link",children:[(0,t.jsx)(E.default,{size:12,pulse:!1}),(0,t.jsx)("span",{children:e.label})]}):(0,t.jsxs)(r.default,{href:e.href,onClick:()=>l(!1),className:"drawer-link",children:[(0,t.jsx)(E.default,{size:12,pulse:!1}),(0,t.jsx)("span",{children:e.label})]})},e.href))})}),(0,t.jsxs)("div",{className:"font-mono",style:{marginTop:"auto",paddingTop:32,fontSize:"var(--fs-xs)",color:"var(--dim)",letterSpacing:"0.12em",textTransform:"uppercase",lineHeight:1.7,borderTop:"1px solid var(--border)"},children:["ABN 34 318 502 254",(0,t.jsx)("br",{}),"kyle@titanos.tech"]})]},"drawer")]})}),document.body),(0,t.jsx)("style",{children:`
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
        @media (max-width: 1024px) {
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
      `})]})}],42724)},56691,e=>{"use strict";var t=e.i(43476),r=e.i(46965),a=e.i(22016),n=e.i(16730);let o=[{heading:"Services",links:[{label:"Free consultation + report",href:"/audit"},{label:"AI Partnership",href:"/ai-delivery"},{label:"Monitor",href:"/monitor"},{label:"Compliance",href:"/compliance"},{label:"Leads & Intelligence",href:"/leads"},{label:"Free Scan",href:"/scan"},{label:"Find your offer",href:"/find"},{label:"All offers",href:"/offers"},{label:"Sectors",href:"/sectors"},{label:"Courses",href:"/courses"}]},{heading:"Proof",links:[{label:`${(0,r.dec)("estate_ey")} engineer-years`,href:"/engineering"},{label:"Methodology",href:"/methodology"},{label:"Black Ice doctrine",href:"/black-ice"},{label:"Our scan",href:"/scan#self-scan"},{label:"Evidence pack",href:"/our-evidence-pack"},{label:"How fast it was built",href:"/speed"},{label:"Free AI Readiness Guide (PDF)",href:"/ai-readiness-guide.pdf",external:!0},{label:"Blog",href:"/blog"},{label:"Efficiency, measured",href:"/efficiency"},{label:"How it works",href:"/how-it-works"},{label:"The learning loop",href:"/learning-loop"},{label:"Security and privacy",href:"/security"},{label:"FAQ",href:"/faq"},{label:"The deep field",href:"/deep-field"},{label:"Image credits",href:"/credits"}]},{heading:"Company",links:[{label:"About",href:"/about"},{label:"Contact",href:"/contact"},{label:"Message Kyle",href:"/contact"},{label:"Privacy",href:"/privacy"},{label:"Terms",href:"/terms"}]}];function i({l:e}){let r={color:"var(--dim)",padding:"4px 0",display:"inline-block",minHeight:28};return e.external?(0,t.jsx)("a",{href:e.href,target:"_blank",rel:"noopener noreferrer",style:r,children:e.label}):(0,t.jsx)(a.default,{href:e.href,style:r,children:e.label})}e.s(["default",0,function(){return(0,t.jsxs)("footer",{style:{padding:"56px 20px 44px",borderTop:"1px solid var(--border)",color:"var(--dim)",fontSize:"var(--fs-sm)",position:"relative",zIndex:1},children:[(0,t.jsxs)("div",{className:"container-vault",children:[(0,t.jsxs)("div",{className:"footer-columns",children:[(0,t.jsxs)("div",{className:"footer-identity",children:[(0,t.jsx)("div",{style:{fontFamily:"var(--font-display), Georgia, serif",letterSpacing:"0.1em",color:"var(--gold)",fontSize:"var(--fs-h4)",marginBottom:10},children:"TITANOS"}),(0,t.jsxs)("div",{style:{lineHeight:1.8},children:["Kyle Deligny · Brisbane, Australia",(0,t.jsx)("br",{}),"ABN 34 318 502 254"]}),(0,t.jsx)("div",{style:{marginTop:14,paddingTop:14,borderTop:"1px solid var(--border)",fontFamily:"var(--font-display), Georgia, serif",fontStyle:"italic",color:"var(--gold-dim)",fontSize:"var(--fs-sm)",letterSpacing:"0.02em"},children:"Built without asking. Kept honest by what you can check."})]}),o.map(e=>(0,t.jsxs)("nav",{"aria-label":e.heading,children:[(0,t.jsx)("div",{style:{fontFamily:"var(--font-display), Georgia, serif",color:"var(--ice)",fontSize:"var(--fs-xs)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:10},children:e.heading}),(0,t.jsx)("ul",{style:{listStyle:"none",margin:0,padding:0},children:e.links.map(e=>(0,t.jsx)("li",{children:(0,t.jsx)(i,{l:e})},e.href))})]},e.heading))]}),(0,t.jsx)("div",{style:{marginTop:36,paddingTop:18,borderTop:"1px solid var(--border)",fontSize:"var(--fs-xs)",letterSpacing:"0.05em",color:"var(--dim)",textAlign:"center"},children:"I personally review every deliverable before it reaches you · titanos.tech"})]}),(0,t.jsx)(n.SigilSeals,{}),(0,t.jsx)("p",{"aria-hidden":"true",style:{textAlign:"center",fontSize:12,opacity:.6,margin:"10px 0 0"},children:"Every symbol on this site means something. We do not explain them."})]})}])},43439,e=>{"use strict";var t=e.i(43476),r=e.i(46932),a=e.i(70014),n=e.i(72328),o=e.i(71645);let i="titanos.vault.entranceShown";e.s(["default",0,function({playEntrance:e=!1}){let l=(0,n.useReducedMotion)(),s=(0,a.useAnimationControls)(),d=(0,a.useAnimationControls)(),c=(0,o.useRef)(!1);return(0,o.useEffect)(()=>{let t="1"===window.sessionStorage.getItem(i);if(!(e&&!t&&!l)){s.set({top:"8vh",opacity:.2}),d.set({top:"92vh",opacity:.2}),c.current=!0,l&&window.sessionStorage.setItem(i,"1");return}s.set({top:"50vh",opacity:0}),d.set({top:"50vh",opacity:0});let r=!1;return(async()=>{await new Promise(e=>setTimeout(e,200)),r||(await Promise.all([s.start({opacity:.8,transition:{duration:.2,ease:"easeOut"}}),d.start({opacity:.8,transition:{duration:.2,ease:"easeOut"}})]),await new Promise(e=>setTimeout(e,100)),r||(await Promise.all([s.start({top:"30vh",transition:{duration:.8,ease:"easeOut"}}),d.start({top:"55vh",transition:{duration:.8,ease:"easeOut"}})]),await new Promise(e=>setTimeout(e,500)),!r&&(await Promise.all([s.start({top:"8vh",opacity:.2,transition:{duration:.6,ease:"easeOut"}}),d.start({top:"92vh",opacity:.2,transition:{duration:.6,ease:"easeOut"}})]),r||(window.sessionStorage.setItem(i,"1"),c.current=!0))))})(),()=>{r=!0}},[l,e,s,d]),(0,t.jsxs)("div",{"aria-hidden":"true",style:{position:"fixed",inset:0,pointerEvents:"none",zIndex:1,viewTransitionName:"vault-frame"},children:[(0,t.jsx)(r.motion.div,{animate:s,initial:!1,style:{position:"absolute",left:0,width:"100%",height:"1px",background:"var(--gold)",opacity:0}}),(0,t.jsx)(r.motion.div,{animate:d,initial:!1,style:{position:"absolute",left:0,width:"100%",height:"1px",background:"var(--gold)",opacity:0}})]})}])},98541,e=>{"use strict";var t=e.i(43476),r=e.i(71645);e.s(["default",0,function(){let[e,a]=(0,r.useState)(!0);return((0,r.useEffect)(()=>{if("u"<typeof document)return;let e=()=>a("visible"===document.visibilityState);return e(),document.addEventListener("visibilitychange",e),()=>document.removeEventListener("visibilitychange",e)},[]),e)?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("div",{"aria-hidden":"true",className:"vault-mesh",style:{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"},children:[(0,t.jsx)("span",{className:"vault-blob vault-blob-1"}),(0,t.jsx)("span",{className:"vault-blob vault-blob-2"}),(0,t.jsx)("span",{className:"vault-blob vault-blob-3"})]}),(0,t.jsx)("span",{"aria-hidden":"true",className:"vault-specular"}),(0,t.jsx)("style",{children:`
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
      `})]}):null}])},69093,(e,t,r)=>{"use strict";Object.defineProperty(r,"__esModule",{value:!0}),Object.defineProperty(r,"default",{enumerable:!0,get:function(){return d}});let a=e.r(43476),n=e.r(71645),o=e.r(67585),i=e.r(52157);function l(e){return{default:e&&"default"in e?e.default:e}}let s={loader:()=>Promise.resolve(l(()=>null)),loading:null,ssr:!0},d=function(e){let t={...s,...e},r=(0,n.lazy)(()=>t.loader().then(l)),d=t.loading;function c(e){let l=d?(0,a.jsx)(d,{isLoading:!0,pastDelay:!0,error:null}):null,s=!t.ssr||!!t.loading,c=s?n.Suspense:n.Fragment,u=t.ssr?(0,a.jsxs)(a.Fragment,{children:["u"<typeof window?(0,a.jsx)(i.PreloadChunks,{moduleIds:t.modules}):null,(0,a.jsx)(r,{...e})]}):(0,a.jsx)(o.BailoutToCSR,{reason:"next/dynamic",children:(0,a.jsx)(r,{...e})});return(0,a.jsx)(c,{...s?{fallback:l}:{},children:u})}return c.displayName="LoadableComponent",c}},70703,(e,t,r)=>{"use strict";Object.defineProperty(r,"__esModule",{value:!0}),Object.defineProperty(r,"default",{enumerable:!0,get:function(){return n}});let a=e.r(55682)._(e.r(69093));function n(e,t){let r={};"function"==typeof e&&(r.loader=e);let n={...r,...t};return(0,a.default)({...n,modules:n.loadableGenerated?.modules})}("function"==typeof r.default||"object"==typeof r.default&&null!==r.default)&&void 0===r.default.__esModule&&(Object.defineProperty(r.default,"__esModule",{value:!0}),Object.assign(r.default,r),t.exports=r.default)},5506,e=>{"use strict";var t=e.i(43476),r=e.i(70703);let a=(0,r.default)(()=>e.A(48428),{loadableGenerated:{modules:[40454]},ssr:!1}),n=(0,r.default)(()=>e.A(99649),{loadableGenerated:{modules:[10691]},ssr:!1}),o=(0,r.default)(()=>e.A(83361),{loadableGenerated:{modules:[4237]},ssr:!1}),i=(0,r.default)(()=>e.A(23281),{loadableGenerated:{modules:[72653]},ssr:!1}),l=(0,r.default)(()=>e.A(38235),{loadableGenerated:{modules:[23031]},ssr:!1});e.s(["default",0,function(){return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n,{}),(0,t.jsx)(o,{}),(0,t.jsx)(i,{}),(0,t.jsx)(l,{}),(0,t.jsx)(a,{})]})}])},9569,e=>{"use strict";var t=e.i(71645),r=e.i(18566);e.s(["default",0,function(){let e=(0,r.usePathname)();return(0,t.useEffect)(()=>{if("u"<typeof document)return;let t=(e??"/").replace(/^\//,"").split("/")[0]||"home";document.body.dataset.page=t},[e]),null}])},76666,e=>{"use strict";var t=e.i(43476),r=e.i(22016),a=e.i(61664);e.s(["default",0,function(){return(0,t.jsxs)("div",{className:"sticky-mobile-cta",children:[(0,t.jsx)(r.default,{href:a.AUDIT_MESSAGE_HREF,children:"Free consultation + report"}),(0,t.jsx)("style",{children:`
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
      `})]})}])},64115,e=>{"use strict";var t=e.i(71645),r=e.i(18566);let a="https://vault.titanos.tech/api/site-event";function n(e,t){let r=JSON.stringify({event:e,path:t});navigator.sendBeacon?navigator.sendBeacon(a,new Blob([r],{type:"text/plain"})):fetch(a,{method:"POST",headers:{"Content-Type":"text/plain"},body:r,keepalive:!0}).catch(()=>{})}e.s(["default",0,function(){let e=(0,r.usePathname)();return(0,t.useEffect)(()=>{n("pageview",e||"/")},[e]),(0,t.useEffect)(()=>{let t=t=>{let r=t.target?.closest("[data-analytics]");if(!r)return;let a=r.getAttribute("data-analytics");a&&n(a,e||"/")};return document.addEventListener("click",t,!0),document.addEventListener("submit",t,!0),()=>{document.removeEventListener("click",t,!0),document.removeEventListener("submit",t,!0)}},[e]),null}])}]);