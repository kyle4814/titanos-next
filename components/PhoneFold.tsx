"use client";

/**
 * PhoneFold (C10 site quality): shows the first `keep` children at phone width and folds the rest
 * behind one button. Markup and copy are untouched, every child stays in the DOM (crawlers, anchors,
 * and the built-page gates still see it); only CSS hides the tail, and only at 640 px and below.
 * On wider screens the button is hidden and nothing is folded. Rules live in globals.css (.pfold).
 */

import { useState, type ReactNode } from "react";

type Props = {
  as?: "div" | "ul";
  className?: string;
  keep: number;
  label: string;
  children: ReactNode;
};

export default function PhoneFold({ as = "div", className, keep, label, children }: Props) {
  const [open, setOpen] = useState(false);
  const Tag = as;
  return (
    <>
      <Tag className={className} data-pfold={open ? "open" : "closed"} data-keep={keep}>
        {children}
      </Tag>
      <button type="button" className="pfold__btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? "Show fewer" : label}
      </button>
    </>
  );
}
