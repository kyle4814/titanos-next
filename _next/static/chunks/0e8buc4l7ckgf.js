(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,42724,e=>{"use strict";var t=e.i(43476),a=e.i(22016),r=e.i(18566),n=e.i(88653),i=e.i(24511),o=e.i(72328),l=e.i(71645),s=e.i(74080),d=e.i(61664),c=e.i(25616);let u=[{label:"Find your offer",href:"/find",external:!1},{label:"All offers",href:"/offers",external:!1},{label:"Products and courses",href:"/products",external:!1},{label:"Case studies",href:"/case-studies",external:!1},{label:"Free consultation",href:"/audit",external:!1},{label:"AI Partnership",href:"/ai-delivery",external:!1},{label:"Compliance",href:"/compliance",external:!1},{label:"Monitor",href:"/monitor",external:!1},{label:"Blog",href:"/blog",external:!1},{label:"Black Ice",href:"/black-ice",external:!1},{label:"Leads",href:"/leads",external:!1},{label:"Free Scan",href:"/scan",external:!1},{label:"Evidence Pack",href:"/our-evidence-pack",external:!1},{label:"Refer & Earn",href:"/refer",external:!1},{label:"Methodology",href:"/methodology",external:!1},{label:"Costs",href:"/costs",external:!1},{label:"Speed",href:"/speed",external:!1},{label:"Live HUD",href:"/hud",external:!1},{label:"Efficiency",href:"/efficiency",external:!1},{label:"Parallax",href:"/parallax",external:!1},{label:"Investors",href:"/investors",external:!1},{label:"Mission",href:"/mission",external:!1},{label:"Proof",href:"/proof",external:!1},{label:"About",href:"/about",external:!1},{label:"Contact",href:"/contact",external:!1}],p=[{label:"Find offer",href:"/find",external:!1},{label:"Offers",href:"/offers",external:!1},{label:"Case studies",href:"/case-studies",external:!1},{label:"AI",href:"/ai-delivery",external:!1},{label:"Compliance",href:"/compliance",external:!1},{label:"Monitor",href:"/monitor",external:!1},{label:"Blog",href:"/blog",external:!1},{label:"About",href:"/about",external:!1}],m=["/audit"],f=u.filter(e=>!p.some(t=>t.href===e.href)&&!m.includes(e.href)),h={"/products":{group:"Tools",blurb:"Guides, templates and short courses to keep"},"/scan":{group:"Tools",blurb:"Free email security check"},"/our-evidence-pack":{group:"Tools",blurb:"What a TITANOS report looks like"},"/leads":{group:"Tools",blurb:"Verified local leads"},"/black-ice":{group:"Company",blurb:"How we work, calm and exact"},"/methodology":{group:"Company",blurb:"How every figure is sourced"},"/costs":{group:"Company",blurb:"Every price, every cost, all the maths"},"/investors":{group:"Company",blurb:"What your money builds"},"/mission":{group:"Company",blurb:"Time back for people, proven worldwide"},"/parallax":{group:"Company",blurb:"The simplest way to bring AI in"},"/proof":{group:"Company",blurb:"Public code, test logs, a replayable build"},"/efficiency":{group:"Company",blurb:"Every efficiency figure, before and after, with its method"},"/hud":{group:"Company",blurb:"Live build counter, gauge and receipt feed"},"/speed":{group:"Company",blurb:"Fast because it is code, precise because it is checked"},"/refer":{group:"Company",blurb:"Introduce a business, get rewarded"},"/contact":{group:"Company",blurb:"Talk to Kyle directly"}},b=["Tools","Company","More"];function g({open:e,reduce:a}){let r=.22*!a,n=[.4,0,.2,1];return(0,t.jsxs)("span",{"aria-hidden":"true",style:{position:"relative",display:"inline-block",width:18,height:14},children:[(0,t.jsx)(i.m.span,{animate:e?{rotate:45,top:6}:{rotate:0,top:0},transition:{duration:r,ease:n},style:{position:"absolute",top:0,left:0,right:0,height:1.5,background:"var(--gold)",transformOrigin:"center"}}),(0,t.jsx)(i.m.span,{animate:e?{opacity:0}:{opacity:1},transition:{duration:r,ease:n},style:{position:"absolute",top:6,left:0,right:0,height:1.5,background:"var(--gold)"}}),(0,t.jsx)(i.m.span,{animate:e?{rotate:-45,top:6}:{rotate:0,top:12},transition:{duration:r,ease:n},style:{position:"absolute",top:12,left:0,right:0,height:1.5,background:"var(--gold)",transformOrigin:"center"}})]})}function v({label:e,href:r,external:n}){let s=(0,o.useReducedMotion)(),[d,c]=(0,l.useState)(!1),[u,p]=(0,l.useState)(!1),m=(0,t.jsxs)(i.m.span,{animate:{color:u?"#F5D575":d?"#B9F2FF":"#777777"},transition:{duration:.18*!s},style:{position:"relative",display:"inline-block",fontSize:"var(--fs-sm)",fontFamily:"var(--font-body), system-ui, sans-serif"},children:[e,(0,t.jsx)(i.m.span,{"aria-hidden":"true",animate:{width:d&&!s?"100%":"0%"},transition:{duration:.18*!s,ease:[.4,0,.2,1]},style:{position:"absolute",left:0,bottom:-3,height:1,background:"var(--gold)"}})]}),f={onMouseEnter:()=>c(!0),onMouseLeave:()=>c(!1),onClick:()=>{s||(p(!0),window.setTimeout(()=>p(!1),180))},style:{marginLeft:20,padding:"8px 4px",display:"inline-block",textDecoration:"none"}};return n?(0,t.jsx)("a",{href:r,target:"_blank",rel:"noopener noreferrer",...f,children:m}):(0,t.jsx)(a.default,{href:r,...f,children:m})}function x(){let[e,n]=(0,l.useState)(!1),i=(0,l.useRef)(null),o=(0,l.useRef)(null),s=(0,l.useId)(),d=(0,r.usePathname)(),u=function(e=f){let t=b.map(e=>({title:e,items:[]}));for(let a of e){let e=h[a.href];t.find(t=>t.title===(e?.group??"More")).items.push({...a,blurb:e?.blurb})}return t.filter(e=>e.items.length>0)}();return(0,l.useEffect)(()=>n(!1),[d]),(0,l.useEffect)(()=>{if(!e)return;let t=e=>{"Escape"===e.key&&(n(!1),o.current?.focus())},a=e=>{i.current?.contains(e.target)||n(!1)};return document.addEventListener("keydown",t),document.addEventListener("mousedown",a),()=>{document.removeEventListener("keydown",t),document.removeEventListener("mousedown",a)}},[e]),(0,t.jsxs)("div",{ref:i,className:"nav-more",onBlur:t=>{e&&!i.current?.contains(t.relatedTarget)&&n(!1)},children:[(0,t.jsxs)("button",{ref:o,type:"button",className:"nav-more-btn","aria-expanded":e,"aria-controls":s,onClick:t=>{let a=!e;n(a),a&&0===t.detail&&window.setTimeout(()=>i.current?.querySelector(".nav-more-item")?.focus(),0)},children:["More",(0,t.jsx)("svg",{className:"nav-more-chev",width:"10",height:"6",viewBox:"0 0 10 6",fill:"none","aria-hidden":"true",children:(0,t.jsx)("path",{d:"M1 1l4 4 4-4",stroke:"currentColor",strokeWidth:"1.4",strokeLinecap:"round",strokeLinejoin:"round"})})]}),e&&(0,t.jsx)("div",{id:s,className:"nav-more-panel",children:u.map(e=>(0,t.jsxs)("div",{children:[(0,t.jsx)("p",{className:"nav-more-title",children:e.title}),(0,t.jsx)("ul",{style:{listStyle:"none",margin:0,padding:0},children:e.items.map(e=>(0,t.jsx)("li",{children:(0,t.jsxs)(a.default,{href:e.href,className:"nav-more-item",onClick:()=>n(!1),children:[(0,t.jsx)("span",{style:{paddingTop:6},children:(0,t.jsx)(c.default,{size:10,pulse:!1})}),(0,t.jsxs)("span",{children:[(0,t.jsx)("span",{className:"nav-more-label",children:e.label}),e.blurb&&(0,t.jsx)("span",{className:"nav-more-blurb",children:e.blurb})]})]})},e.href))})]},e.title))})]})}e.s(["default",0,function(){let e=(0,o.useReducedMotion)(),[r,m]=(0,l.useState)(!1),[f,h]=(0,l.useState)(!1),[b,y]=(0,l.useState)(!1),[w,k]=(0,l.useState)(!1);return(0,l.useEffect)(()=>k(!0),[]),(0,l.useEffect)(()=>{if(e)m(!0);else if("1"===window.sessionStorage.getItem("titanos.vault.entranceShown"))m(!0);else{let e=window.setTimeout(()=>m(!0),800);return()=>window.clearTimeout(e)}},[e]),(0,l.useEffect)(()=>{let e=window.matchMedia("(max-width: 1024px)"),t=()=>y(e.matches);return t(),e.addEventListener("change",t),()=>e.removeEventListener("change",t)},[]),(0,l.useEffect)(()=>{if(!f)return;let e=e=>{"Escape"===e.key&&h(!1)};document.addEventListener("keydown",e);let t=document.body.style.overflow;return document.body.style.overflow="hidden",()=>{document.removeEventListener("keydown",e),document.body.style.overflow=t}},[f]),(0,l.useEffect)(()=>{!b&&f&&h(!1)},[b,f]),(0,t.jsxs)(i.m.nav,{initial:{opacity:0,y:-8},animate:{opacity:+!!r,y:r?0:-8},transition:{duration:.5*!e,ease:[0,0,.2,1]},style:{position:"sticky",top:0,zIndex:30,padding:"20px",borderBottom:"1px solid var(--border)",background:"rgb(10 7 7 / 0.85)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"},children:[(0,t.jsxs)("div",{className:"container-vault",style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12},children:[(0,t.jsx)(a.default,{href:"/","aria-label":"TITANOS home",className:"font-wordmark",style:{color:"var(--gold)",fontSize:"var(--fs-lg)",textDecoration:"none",letterSpacing:"0.06em"},children:"TITANOS"}),(0,t.jsxs)("div",{className:"nav-desktop-links",style:{display:"flex",alignItems:"center"},children:[p.map(e=>(0,t.jsx)(v,{...e},e.href)),(0,t.jsx)(x,{}),(0,t.jsxs)(a.default,{href:d.AUDIT_MESSAGE_HREF,style:{marginLeft:18,padding:"8px 16px",background:"var(--gold)",color:"var(--vault-black, #0a0a0a)",fontFamily:"var(--font-body), system-ui, sans-serif",fontWeight:700,fontSize:"var(--fs-sm)",borderRadius:999,textDecoration:"none",whiteSpace:"nowrap"},children:[(0,t.jsx)("span",{className:"nav-cta-long",children:"Message Kyle for a free consultation and report"}),(0,t.jsx)("span",{className:"nav-cta-short",children:"Free consultation"})]})]}),(0,t.jsx)("button",{type:"button",className:"nav-burger","aria-label":f?"Close menu":"Open menu","aria-expanded":f,"aria-controls":"nav-drawer",onClick:()=>h(e=>!e),style:{background:"transparent",border:"1px solid var(--gold-dim)",borderRadius:"var(--radius-sm)",padding:"10px 12px",cursor:"pointer",color:"var(--gold)",display:"none",alignItems:"center",justifyContent:"center",position:"relative",width:44,height:40},children:(0,t.jsx)(g,{open:f,reduce:!!e})})]}),w&&(0,s.createPortal)((0,t.jsx)(n.AnimatePresence,{children:f&&(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(i.m.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.2*!e},onClick:()=>h(!1),style:{position:"fixed",inset:0,background:"rgb(5 3 3 / 0.7)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",zIndex:1040,pointerEvents:"auto"},"aria-hidden":"true"},"overlay"),(0,t.jsxs)(i.m.div,{id:"nav-drawer",role:"dialog","aria-modal":"true","aria-label":"Site navigation",initial:{x:"100%"},animate:{x:0},exit:{x:"100%"},transition:{duration:.32*!e,ease:[.4,0,.2,1]},style:{position:"fixed",top:0,right:0,bottom:0,width:"min(86vw, 360px)",maxWidth:"100vw",background:"linear-gradient(180deg, var(--vault-warm), var(--vault-black))",borderLeft:"1px solid var(--gold)",boxShadow:"-20px 0 60px rgb(0 0 0 / 0.6)",zIndex:1050,display:"flex",flexDirection:"column",padding:"32px 28px",overflowY:"auto",WebkitOverflowScrolling:"touch"},children:[(0,t.jsx)("span",{"aria-hidden":"true",style:{position:"absolute",top:0,bottom:0,left:-1,width:1,background:"linear-gradient(180deg, transparent, var(--gold), transparent)",opacity:.7}}),(0,t.jsxs)("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:32},children:[(0,t.jsx)("span",{className:"font-wordmark",style:{color:"var(--gold)",fontSize:"var(--fs-lg)",letterSpacing:"0.06em"},children:"TITANOS"}),(0,t.jsx)("button",{type:"button",onClick:()=>h(!1),"aria-label":"Close menu",style:{background:"transparent",border:0,color:"var(--gold)",fontSize:"1.6rem",fontFamily:"var(--font-display), Georgia, serif",cursor:"pointer",padding:"8px 12px",lineHeight:1},children:"✕"})]}),(0,t.jsx)(a.default,{href:d.AUDIT_MESSAGE_HREF,onClick:()=>h(!1),style:{display:"flex",alignItems:"center",justifyContent:"center",minHeight:44,padding:"12px 22px",textAlign:"center",lineHeight:1.3,background:"var(--gold)",color:"var(--vault-black, #0a0a0a)",fontFamily:"var(--font-body), system-ui, sans-serif",fontWeight:700,fontSize:"var(--fs-sm)",borderRadius:22,textDecoration:"none",marginBottom:24},children:"Message Kyle for a free consultation and report"}),(0,t.jsx)("nav",{children:(0,t.jsx)("ul",{style:{listStyle:"none",padding:0,margin:0},children:u.map(e=>(0,t.jsx)("li",{style:{marginBottom:8},children:e.external?(0,t.jsxs)("a",{href:e.href,target:"_blank",rel:"noopener noreferrer",onClick:()=>h(!1),className:"drawer-link",children:[(0,t.jsx)(c.default,{size:12,pulse:!1}),(0,t.jsx)("span",{children:e.label})]}):(0,t.jsxs)(a.default,{href:e.href,onClick:()=>h(!1),className:"drawer-link",children:[(0,t.jsx)(c.default,{size:12,pulse:!1}),(0,t.jsx)("span",{children:e.label})]})},e.href))})}),(0,t.jsxs)("div",{className:"font-mono",style:{marginTop:"auto",paddingTop:32,fontSize:"var(--fs-xs)",color:"var(--dim)",letterSpacing:"0.12em",textTransform:"uppercase",lineHeight:1.7,borderTop:"1px solid var(--border)"},children:["ABN 34 318 502 254",(0,t.jsx)("br",{}),"kyle@titanos.tech"]})]},"drawer")]})}),document.body),(0,t.jsx)("style",{children:`
        .nav-desktop-links {
          display: flex;
          gap: 0;
          white-space: nowrap;
          flex-wrap: nowrap;
        }
        .nav-desktop-links a { white-space: nowrap; }
        .nav-desktop-links .nav-more-panel a { white-space: normal; }   /* dropdown items are links inside the strip: let them wrap */
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
          display: grid; grid-auto-flow: column; grid-auto-columns: minmax(230px, 280px); white-space: normal; /* the strip's nowrap must not reach the panel: blurbs wrap inside their column */
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
        .nav-more-item > span:first-child { flex: 0 0 12px; }   /* fixed icon column: every label starts on the same line */
        .nav-more-item > span:last-child { flex: 1 1 auto; min-width: 0; }
        .nav-more-blurb {
          display: block; margin-top: 2px; overflow-wrap: anywhere; font-size: var(--fs-xs); color: var(--dim);
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
      `})]})}],42724)},56691,e=>{"use strict";var t=e.i(43476),a=e.i(46965),r=e.i(22016),n=e.i(16730);let i=[{heading:"Services",links:[{label:"Free consultation + report",href:"/audit"},{label:"AI Partnership",href:"/ai-delivery"},{label:"Monitor",href:"/monitor"},{label:"Compliance",href:"/compliance"},{label:"Leads & Intelligence",href:"/leads"},{label:"Free Scan",href:"/scan"},{label:"Find your offer",href:"/find"},{label:"All offers",href:"/offers"},{label:"Sectors",href:"/sectors"},{label:"Courses",href:"/courses"}]},{heading:"Proof",links:[{label:`${(0,a.dec)("estate_ey")} engineer-years`,href:"/engineering"},{label:"Case studies",href:"/case-studies"},{label:"Methodology",href:"/methodology"},{label:"Black Ice doctrine",href:"/black-ice"},{label:"Our scan",href:"/scan#self-scan"},{label:"Evidence pack",href:"/our-evidence-pack"},{label:"How fast it was built",href:"/speed"},{label:"Live HUD",href:"/hud"},{label:"Free AI Readiness Guide (PDF)",href:"/ai-readiness-guide.pdf",external:!0},{label:"Blog",href:"/blog"},{label:"Efficiency, measured",href:"/efficiency"},{label:"How it works",href:"/how-it-works"},{label:"The learning loop",href:"/learning-loop"},{label:"Security and privacy",href:"/security"},{label:"FAQ",href:"/faq"},{label:"The deep field",href:"/deep-field"},{label:"Image credits",href:"/credits"}]},{heading:"Company",links:[{label:"About",href:"/about"},{label:"Contact",href:"/contact"},{label:"Message Kyle",href:"/contact"},{label:"Privacy",href:"/privacy"},{label:"Terms",href:"/terms"}]}];function o({l:e}){let a={color:"var(--dim)",padding:0,display:"inline-flex",alignItems:"center",minHeight:44};return e.external?(0,t.jsx)("a",{href:e.href,target:"_blank",rel:"noopener noreferrer",style:a,children:e.label}):(0,t.jsx)(r.default,{href:e.href,style:a,children:e.label})}e.s(["default",0,function(){return(0,t.jsxs)("footer",{style:{padding:"56px 20px 44px",borderTop:"1px solid var(--border)",color:"var(--dim)",fontSize:"var(--fs-sm)",position:"relative",zIndex:1},children:[(0,t.jsxs)("div",{className:"container-vault",children:[(0,t.jsxs)("div",{className:"footer-columns",children:[(0,t.jsxs)("div",{className:"footer-identity",children:[(0,t.jsx)("div",{style:{fontFamily:"var(--font-display), Georgia, serif",letterSpacing:"0.1em",color:"var(--gold)",fontSize:"var(--fs-h4)",marginBottom:10},children:"TITANOS"}),(0,t.jsxs)("div",{style:{lineHeight:1.8},children:["Kyle Deligny · Brisbane, Australia",(0,t.jsx)("br",{}),"ABN 34 318 502 254"]}),(0,t.jsx)("div",{style:{marginTop:14,paddingTop:14,borderTop:"1px solid var(--border)",fontFamily:"var(--font-display), Georgia, serif",fontStyle:"italic",color:"var(--gold-dim)",fontSize:"var(--fs-sm)",letterSpacing:"0.02em"},children:"Built without asking. Kept honest by what you can check."})]}),i.map(e=>(0,t.jsxs)("nav",{"aria-label":e.heading,children:[(0,t.jsx)("div",{style:{fontFamily:"var(--font-display), Georgia, serif",color:"var(--ice)",fontSize:"var(--fs-xs)",letterSpacing:"0.16em",textTransform:"uppercase",marginBottom:10},children:e.heading}),(0,t.jsx)("ul",{style:{listStyle:"none",margin:0,padding:0},children:e.links.map(e=>(0,t.jsx)("li",{children:(0,t.jsx)(o,{l:e})},e.href))})]},e.heading))]}),(0,t.jsx)("div",{style:{marginTop:36,paddingTop:18,borderTop:"1px solid var(--border)",fontSize:"var(--fs-xs)",letterSpacing:"0.05em",color:"var(--dim)",textAlign:"center"},children:"I personally review every deliverable before it reaches you · titanos.tech"})]}),(0,t.jsx)(n.SigilSeals,{}),(0,t.jsx)("p",{"aria-hidden":"true",style:{textAlign:"center",fontSize:12,opacity:.6,margin:"10px 0 0"},children:"Every symbol on this site means something. We do not explain them."})]})}])},43439,e=>{"use strict";var t=e.i(43476),a=e.i(24511),r=e.i(70014),n=e.i(72328),i=e.i(71645);let o="titanos.vault.entranceShown";e.s(["default",0,function({playEntrance:e=!1}){let l=(0,n.useReducedMotion)(),s=(0,r.useAnimationControls)(),d=(0,r.useAnimationControls)(),c=(0,i.useRef)(!1);return(0,i.useEffect)(()=>{let t="1"===window.sessionStorage.getItem(o);if(!(e&&!t&&!l)){s.set({top:"8vh",opacity:.2}),d.set({top:"92vh",opacity:.2}),c.current=!0,l&&window.sessionStorage.setItem(o,"1");return}s.set({top:"50vh",opacity:0}),d.set({top:"50vh",opacity:0});let a=!1;return(async()=>{await new Promise(e=>setTimeout(e,200)),a||(await Promise.all([s.start({opacity:.8,transition:{duration:.2,ease:"easeOut"}}),d.start({opacity:.8,transition:{duration:.2,ease:"easeOut"}})]),await new Promise(e=>setTimeout(e,100)),a||(await Promise.all([s.start({top:"30vh",transition:{duration:.8,ease:"easeOut"}}),d.start({top:"55vh",transition:{duration:.8,ease:"easeOut"}})]),await new Promise(e=>setTimeout(e,500)),!a&&(await Promise.all([s.start({top:"8vh",opacity:.2,transition:{duration:.6,ease:"easeOut"}}),d.start({top:"92vh",opacity:.2,transition:{duration:.6,ease:"easeOut"}})]),a||(window.sessionStorage.setItem(o,"1"),c.current=!0))))})(),()=>{a=!0}},[l,e,s,d]),(0,t.jsxs)("div",{"aria-hidden":"true",style:{position:"fixed",inset:0,pointerEvents:"none",zIndex:1,viewTransitionName:"vault-frame"},children:[(0,t.jsx)(a.m.div,{animate:s,initial:!1,style:{position:"absolute",left:0,width:"100%",height:"1px",background:"var(--gold)",opacity:0}}),(0,t.jsx)(a.m.div,{animate:d,initial:!1,style:{position:"absolute",left:0,width:"100%",height:"1px",background:"var(--gold)",opacity:0}})]})}])},98541,e=>{"use strict";var t=e.i(43476),a=e.i(71645);e.s(["default",0,function(){let[e,r]=(0,a.useState)(!0);return((0,a.useEffect)(()=>{if("u"<typeof document)return;let e=()=>r("visible"===document.visibilityState);return e(),document.addEventListener("visibilitychange",e),()=>document.removeEventListener("visibilitychange",e)},[]),e)?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("div",{"aria-hidden":"true",className:"vault-mesh",style:{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"},children:[(0,t.jsx)("span",{className:"vault-blob vault-blob-1"}),(0,t.jsx)("span",{className:"vault-blob vault-blob-2"}),(0,t.jsx)("span",{className:"vault-blob vault-blob-3"})]}),(0,t.jsx)("span",{"aria-hidden":"true",className:"vault-specular"}),(0,t.jsx)("style",{children:`
        /* No filter: blur() here (was 120px on a 60vmax layer): it forced a ~350 ms/frame
           raster on desktop (measured 383 -> 33 ms median frame). The gradient carries the soft edge itself. */
        .vault-blob {
          position: absolute;
          width: 60vmax;
          height: 60vmax;
          border-radius: 50%;
          opacity: 0.18;
          will-change: transform;
        }
        .vault-blob-1 {
          background: radial-gradient(circle, var(--gold-warm) 0%, color-mix(in srgb, var(--gold-warm) 55%, transparent) 25%, color-mix(in srgb, var(--gold-warm) 18%, transparent) 45%, transparent 70%);
          top: -20vmax;
          left: -20vmax;
          animation: vault-drift-1 40s linear infinite;
        }
        .vault-blob-2 {
          background: radial-gradient(circle, var(--gold-cool) 0%, color-mix(in srgb, var(--gold-cool) 55%, transparent) 25%, color-mix(in srgb, var(--gold-cool) 18%, transparent) 45%, transparent 70%);
          bottom: -25vmax;
          right: -20vmax;
          animation: vault-drift-2 56s linear infinite;
          opacity: 0.14;
        }
        .vault-blob-3 {
          background: radial-gradient(circle, var(--ember) 0%, color-mix(in srgb, var(--ember) 55%, transparent) 25%, color-mix(in srgb, var(--ember) 18%, transparent) 42%, transparent 66%);
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
      `})]}):null}])},5506,e=>{"use strict";var t=e.i(43476),a=e.i(70703);let r=(0,a.default)(()=>e.A(48428),{loadableGenerated:{modules:[40454]},ssr:!1}),n=(0,a.default)(()=>e.A(99649),{loadableGenerated:{modules:[10691]},ssr:!1}),i=(0,a.default)(()=>e.A(83361),{loadableGenerated:{modules:[4237]},ssr:!1}),o=(0,a.default)(()=>e.A(23281),{loadableGenerated:{modules:[72653]},ssr:!1}),l=(0,a.default)(()=>e.A(22555),{loadableGenerated:{modules:[45137]},ssr:!1}),s=(0,a.default)(()=>e.A(38235),{loadableGenerated:{modules:[23031]},ssr:!1});e.s(["default",0,function(){return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n,{}),(0,t.jsx)(i,{}),(0,t.jsx)(o,{}),(0,t.jsx)(s,{}),(0,t.jsx)(r,{}),(0,t.jsx)(l,{})]})}])},58184,e=>{"use strict";var t=e.i(43476),a=e.i(44113);let r=()=>e.A(62790).then(e=>e.domAnimation);e.s(["default",0,function({children:e}){return(0,t.jsx)(a.LazyMotion,{features:r,children:e})}])},9569,e=>{"use strict";var t=e.i(71645),a=e.i(18566);e.s(["default",0,function(){let e=(0,a.usePathname)();return(0,t.useEffect)(()=>{if("u"<typeof document)return;let t=(e??"/").replace(/^\//,"").split("/")[0]||"home";document.body.dataset.page=t},[e]),null}])},76666,e=>{"use strict";var t=e.i(43476),a=e.i(22016),r=e.i(61664);e.s(["default",0,function(){return(0,t.jsxs)("div",{className:"sticky-mobile-cta",children:[(0,t.jsx)(a.default,{href:r.AUDIT_MESSAGE_HREF,children:"Free consultation + report"}),(0,t.jsx)("style",{children:`
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
      `})]})}])},64115,e=>{"use strict";var t=e.i(71645),a=e.i(18566);let r="https://vault.titanos.tech/api/site-event";function n(e,t){let a=JSON.stringify({event:e,path:t});navigator.sendBeacon?navigator.sendBeacon(r,new Blob([a],{type:"text/plain"})):fetch(r,{method:"POST",headers:{"Content-Type":"text/plain"},body:a,keepalive:!0}).catch(()=>{})}e.s(["default",0,function(){let e=(0,a.usePathname)();return(0,t.useEffect)(()=>{n("pageview",e||"/")},[e]),(0,t.useEffect)(()=>{let t=t=>{let a=t.target?.closest("[data-analytics]");if(!a)return;let r=a.getAttribute("data-analytics");r&&n(r,e||"/")};return document.addEventListener("click",t,!0),document.addEventListener("submit",t,!0),()=>{document.removeEventListener("click",t,!0),document.removeEventListener("submit",t,!0)}},[e]),null}])},28271,e=>{"use strict";var t=e.i(43476),a=e.i(71645);let r="titanos.music",n="/audio/underworld-loop.mp3";e.s(["default",0,function(){let e=(0,a.useRef)(null),i=(0,a.useRef)(null),o=(0,a.useRef)("wa"),l=(0,a.useRef)(null),[s,d]=(0,a.useState)(!1),[c,u]=(0,a.useState)(!1);(0,a.useEffect)(()=>{try{u("on"===window.localStorage.getItem(r))}catch{}return()=>{l.current&&window.clearTimeout(l.current);let e=i.current;if(e){try{e.source?.stop()}catch{}e.ctx.close().catch(()=>void 0),i.current=null}}},[]);let p=e=>{try{window.localStorage.setItem(r,e)}catch{}},m=()=>{let t=e.current;return t?(o.current="el",t.volume=.35,t.play().then(()=>d(!0))):Promise.reject(Error("no audio"))};return(0,t.jsxs)("div",{className:"music-toggle",children:[(0,t.jsx)("audio",{ref:e,src:n,loop:!0,preload:"none"}),(0,t.jsx)("button",{type:"button",onClick:()=>{let t;if(s){(()=>{if(d(!1),"el"===o.current)return e.current?.pause();let t=i.current;if(!t)return;let a=t.ctx.currentTime;t.gain.gain.cancelScheduledValues(a),t.gain.gain.setValueAtTime(t.gain.gain.value,a),t.gain.gain.linearRampToValueAtTime(0,a+.3);let r=t.source;t.source=null,l.current&&window.clearTimeout(l.current),l.current=window.setTimeout(()=>{try{r?.stop()}catch{}t.source||t.ctx.suspend().catch(()=>void 0)},350)})(),p("off"),u(!1);return}l.current&&(window.clearTimeout(l.current),l.current=null);let a="wa"===o.current?(()=>{if(i.current)return i.current;let e=window,t=e.AudioContext||e.webkitAudioContext;if(!t||"function"!=typeof fetch)return null;try{let e=new t,a=e.createGain();return a.gain.value=0,a.connect(e.destination),i.current={ctx:e,gain:a,buffer:null,loading:null,source:null},i.current}catch{return null}})():null;(a?(t=a.ctx.resume(),!a.loading&&(a.loading=fetch(n).then(e=>{if(!e.ok)throw Error("fetch "+e.status);return e.arrayBuffer()}).then(e=>new Promise((t,r)=>{a.ctx.decodeAudioData(e,t,r)})),a.loading.catch(()=>{a.loading=null})),Promise.all([t,a.loading]).then(([,e])=>{let t,r;if(a.buffer=e,a.source)return;let n=a.ctx.createBufferSource(),[i,l]=(r=(t=e.duration>31.28425)?31.297270833333332:e.duration,[.023020833333333334*!!t,Math.min(r,e.duration)]);n.buffer=e,n.loop=!0,n.loopStart=i,n.loopEnd=l,n.connect(a.gain),n.start(0,i),a.source=n;let s=a.ctx.currentTime;a.gain.gain.cancelScheduledValues(s),a.gain.gain.setValueAtTime(a.gain.gain.value,s),a.gain.gain.linearRampToValueAtTime(.35,s+.3),o.current="wa",d(!0)})).catch(()=>m()):m()).then(()=>{p("on"),u(!1)}).catch(()=>d(!1))},"data-ready":c&&!s?"true":void 0,"aria-pressed":s,"aria-label":s?"Pause background music":"Play background music",title:s?"Pause music":"Play music",children:(0,t.jsxs)("svg",{viewBox:"0 0 24 24",width:"20",height:"20",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:[(0,t.jsx)("path",{d:"M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"}),s?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)("path",{d:"M15.5 9a4 4 0 0 1 0 6"}),(0,t.jsx)("path",{d:"M18 6.5a7.5 7.5 0 0 1 0 11"})]}):(0,t.jsx)("path",{d:"M16 9.5l5 5M21 9.5l-5 5"})]})}),(0,t.jsx)("style",{children:`
        .music-toggle {
          position: fixed;
          left: 14px;
          bottom: 14px;
          z-index: 45;
        }
        .music-toggle button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          padding: 0;
          cursor: pointer;
          color: var(--gold);
          background: rgb(10 7 7 / 0.82);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid var(--gold-dim);
          border-radius: 50%;
        }
        .music-toggle button[data-ready="true"] {
          border-color: var(--gold);
        }
        .music-toggle button[aria-pressed="true"] {
          border-color: var(--gold);
          box-shadow: 0 0 12px rgb(var(--gold-rgb) / 0.35);
        }
        .music-toggle button { border-color: var(--gold); }
        @supports (animation-timeline: scroll()) {
          @media (max-width: 720px) and (prefers-reduced-motion: no-preference) {
            @keyframes music-reveal { from { opacity: 0; pointer-events: none; } to { opacity: 1; pointer-events: auto; } }
            .music-toggle { opacity: 0; pointer-events: none; animation: music-reveal linear both; animation-timeline: scroll(root block); animation-range: 40vh 70vh; }
            .music-toggle:focus-within { opacity: 1; pointer-events: auto; }
          }
        }
        @media (max-width: 720px) {
          .music-toggle { bottom: calc(76px + env(safe-area-inset-bottom)); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .music-toggle button { transition: transform 0.15s ease, box-shadow 0.2s ease; }
          .music-toggle button:active { transform: scale(0.94); }
        }
      `})]})}])}]);