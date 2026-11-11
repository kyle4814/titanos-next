"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const DISMISS_KEY = "titanos-proof-declaration-v1";

export default function ProofDeclaration() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Leaving "/" (Back button, a client-side Link) must close the dialog, or its scroll lock and Escape listener
    // would stay live on a page with no visible dialog (independent review 2026-11-10, P1).
    if (pathname !== "/") { setOpen(false); return; }
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY) !== "1") {
        previousFocus.current = document.activeElement as HTMLElement;
        setOpen(true);
      }
    } catch {
      // Storage can be unavailable in private browsing; the dialog remains dismissible.
      setOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
      if (event.key !== "Tab") return;
      const dialog = document.getElementById("titanos-proof-dialog");
      const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? []);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = priorOverflow;
      window.removeEventListener("keydown", handleKey);
      previousFocus.current?.focus();
    };
  }, [open]);

  function dismiss() {
    try { window.sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setOpen(false);
  }

  if (!open || pathname !== "/") return null;

  return (
    <div role="presentation" data-no-print style={{ position:"fixed", inset:0, zIndex:10000, background:"rgba(0,0,0,.88)", display:"grid", placeItems:"center", padding:16 }}>
      <section id="titanos-proof-dialog" role="dialog" aria-modal="true" aria-labelledby="titanos-proof-title"
        style={{ position:"relative", width:"min(100%,720px)", maxHeight:"min(90dvh,850px)", overflowY:"auto", background:"#0c0c0e", color:"#f6f2e9", border:"1px solid #67542d", borderRadius:16, padding:"clamp(22px,5vw,48px)", boxShadow:"0 24px 90px #000" }}>
        <button ref={closeButton} onClick={dismiss} aria-label="Close introduction"
          style={{ position:"absolute", right:16, top:12, border:"1px solid #746342", borderRadius:8, background:"transparent", color:"#f6f2e9", padding:"6px 12px", cursor:"pointer", fontSize:20 }}>×</button>
        <p style={{ color:"#d7b76c", fontSize:12, letterSpacing:3, margin:"0 36px 24px 0" }}>PARALLAX TECHNOLOGIES / TITANOS</p>
        <p style={{ color:"#d7b76c", fontSize:12, letterSpacing:2, marginBottom:12 }}>THE FINAL DECLARATION</p>
        <h2 id="titanos-proof-title" style={{ fontSize:"clamp(30px,6vw,52px)", lineHeight:1.08, margin:"0 0 20px", fontWeight:600 }}>The proof economy starts here.</h2>
        <p style={{ color:"#d2c9b7", fontSize:17, lineHeight:1.65, marginBottom:28 }}>We don't sell hype. We build infrastructure. Explore the engineering evidence, business systems and working demonstrations behind TitanOS.</p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:10, marginBottom:28 }}>
          {[
            ["L10", "Autonomous engineering"],
            ["OBELISK", "Business software"],
            ["ENTERPRISE", "Workflow automation"],
            ["RECEIPTS", "Evidence you can inspect"]
          ].map(([title,detail]) => <div key={title} style={{ padding:16, border:"1px solid #4d412b", borderRadius:9, background:"#171719" }}>
            <strong style={{ display:"block", color:"#d7b76c", marginBottom:6 }}>{title}</strong>
            <span style={{ color:"#c8c0b1", fontSize:13 }}>{detail}</span>
          </div>)}
        </div>
        <p style={{ color:"#bcb3a2", fontSize:14, lineHeight:1.6 }}>Measured claims and supporting sources belong in our public proof archive. No unpublished performance figures are presented as verified.</p>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:22 }}>
          <a href="/proof" onClick={dismiss} style={{ padding:"12px 18px", border:"1px solid #d7b76c", borderRadius:7, color:"#d7b76c", textDecoration:"none", fontWeight:600 }}>Explore the proof</a>
          <button onClick={dismiss} style={{ padding:"12px 20px", background:"#d7b76c", color:"#14110a", border:0, borderRadius:7, cursor:"pointer", fontWeight:700 }}>Enter TitanOS</button>
        </div>
        <p style={{ margin:"20px 0 0", fontSize:12, color:"#a79d8b" }}>No signup required to enter. You can close this introduction at any time.</p>
      </section>
    </div>
  );
}
