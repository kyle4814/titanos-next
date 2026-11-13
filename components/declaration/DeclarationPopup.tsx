"use client";

// The first thing a visitor sees: a dismissable summary of the Final Business Declaration.
// - Closes with the X button or Esc; dismissal is remembered in localStorage (try/catch: private modes can throw,
//   then it simply shows once per page load and never errors).
// - role="dialog" aria-modal, focus moves in, Tab is trapped, focus returns to the opener on close.
// - Not shown on /declaration itself. The same content is a normal crawlable page at /declaration.
// - Motion is a short CSS entrance and is switched off under prefers-reduced-motion.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { DECLARATION_DATE, DECLARATION_PATH, DEFAULT_TAG, DISMISS_KEY, HEADLINE, WHO } from "@/lib/declaration";
import { Achievements, CaseList, CourseCards, PdfButton } from "./Parts";
import SubscribeForm from "./SubscribeForm";
import s from "./declaration.module.css";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Browsers driven by automation (navigator.webdriver) are not visitors: skip the popup so site probes and browser tests are not blocked by it.
 *  ?declaration=show forces it on, which is how the popup's own browser test sees it. Real visitors and crawlers are unaffected. */
function suppressedForAutomation(): boolean {
  try { return navigator.webdriver === true && new URLSearchParams(window.location.search).get("declaration") !== "show"; } catch { return false; }
}
function wasDismissed(): boolean {
  try { return window.localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}
function rememberDismissed(): void {
  try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage blocked: shown again next load, never an error */ }
}

export default function DeclarationPopup() {
  const path = usePathname() ?? "";
  const onDeclaration = path === DECLARATION_PATH || path.startsWith(DECLARATION_PATH + "/");
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (onDeclaration) { setOpen(false); return; }
    if (!suppressedForAutomation() && !wasDismissed()) { opener.current = document.activeElement; setOpen(true); }
  }, [onDeclaration]);

  const close = useCallback(() => {
    rememberDismissed();
    setOpen(false);
    const el = opener.current;
    if (el instanceof HTMLElement) el.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>("[data-close]")?.focus();
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Escape works wherever focus is (for example after a click on the overlay), not only inside the dialog.
  useEffect(() => {
    if (!open) return;
    const onDocKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onDocKey);
    return () => document.removeEventListener("keydown", onDocKey);
  }, [open, close]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") { e.stopPropagation(); close(); return; }
    if (e.key !== "Tab" || !dialog.current) return;
    const nodes = Array.from(dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.tabIndex >= 0 && (n.offsetParent !== null || n === document.activeElement));
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  if (!open || onDeclaration) return null;
  return (
    <div className={s.overlay} data-declaration-popup data-no-print>
      <div ref={dialog} className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="decl-title" onKeyDown={onKeyDown}>
        <button type="button" className={s.close} data-close aria-label="Close the declaration" onClick={close}>×</button>
        <p className={s.eyebrow}>Declaration · {DECLARATION_DATE}</p>
        <h2 id="decl-title" className={s.title}>{HEADLINE}</h2>
        {WHO.map((w) => <p key={w} className={s.p}>{w}</p>)}
        <div className={s.row}>
          <Link className={s.btn} href={DECLARATION_PATH} onClick={rememberDismissed}>Read the full declaration</Link>
          <PdfButton secondary />
        </div>

        <h3 className={s.h2}>Key achievements</h3>
        <Achievements limit={5} />

        <h3 className={s.h2}>Case studies</h3>
        <CaseList compact />

        <h3 className={s.h2}>Courses</h3>
        <CourseCards />

        <h3 className={s.h2}>Daily artifacts</h3>
        <SubscribeForm tag={DEFAULT_TAG} source="declaration-popup" />
      </div>
    </div>
  );
}
