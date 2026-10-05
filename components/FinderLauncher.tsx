"use client";

// Floating "Find my offer" button on every page. Opens the offline finder in a
// sheet. On mobile it sits above the sticky consultation bar so the two never overlap.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import OfferFinder from "@/components/OfferFinder";

export default function FinderLauncher() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setOpen(false); }, [path]);
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); return; }
      if (e.key !== "Tab" || !sheetRef.current) return;
      // Focus trap: keep Tab inside the sheet.
      const f = Array.from(sheetRef.current.querySelectorAll<HTMLElement>("a[href],button,input,summary"))
        .filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (path === "/find" || path === "/find/") return null;

  return (
    <>
      {!open && (
        <button ref={btnRef} type="button" className="finder-fab" onClick={() => setOpen(true)} aria-haspopup="dialog">
          Find my offer
        </button>
      )}
      {(
        <div ref={sheetRef} hidden={!open} className="finder-sheet" role="dialog" aria-modal="true" aria-label="Offer finder">
          <div className="finder-sheet-head">
            <strong>Find my offer</strong>
            <button ref={closeRef} type="button" className="finder-close" onClick={() => { setOpen(false); btnRef.current?.focus(); }}>
              Close
            </button>
          </div>
          <div className="finder-sheet-body"><OfferFinder compact /></div>
        </div>
      )}
      <style>{`
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
      `}</style>
    </>
  );
}
