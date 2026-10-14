"use client";

import s from "./Home.module.css";

type Item = { title: string; body: string };
const SPAN = ["wide", "", "", "", "", "tall", "tall"];

/** Bento version of the "what we build" list. Same titles, same words. Cursor spotlight is a CSS var set on pointermove. */
export default function BentoGrid({ items }: { items: Item[] }) {
  return (
    <div className={s.bento}>
      {items.map((w, i) => (
        <div
          key={w.title}
          className={`${s.tile} ${SPAN[i] ? s[SPAN[i]] : ""}`}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
            e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
          }}
        >
          <h3 style={{ fontFamily: "var(--font-body), system-ui, sans-serif", color: "var(--ice)", fontSize: "var(--fs-lg)", fontWeight: 600, lineHeight: 1.35 }}>{w.title}</h3>
          <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.65 }}>{w.body}</p>
        </div>
      ))}
    </div>
  );
}
