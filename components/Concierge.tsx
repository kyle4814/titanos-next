"use client";
// F-C6 mount (catalogue lazy-loaded as JSON on first ask: f307). The rules-based concierge router behind a plain form. Zero model calls, zero network: the adapter is a no-op,
// so an unmatched ask is never claimed as saved. Any visitor text is rendered as text by React, never as markup.
import { useRef, useState } from "react";
import { loadAsk } from "@/lib/concierge/lazy";
import type { Ask } from "@/lib/concierge/lazy";
import { viewOf } from "@/lib/concierge/view";
import type { View } from "@/lib/concierge/view";
import s from "./Concierge.module.css";

export default function Concierge() {
  const askRef = useRef<Promise<Ask> | null>(null);   // catalogue JSON is fetched on first ask, then reused
  const [q, setQ] = useState("");
  const [view, setView] = useState<View | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    try {
      if (!askRef.current) askRef.current = loadAsk();
      setView(viewOf(await (await askRef.current)(q, "guest")));
    } catch {
      askRef.current = null;
      setView({ text: "I could not load my shelves just now, and nothing was saved. Please reach a person.", links: [{ label: "Contact a person", href: "/contact" }], saved: false });
    }
  }
  return (
    <section className={s.box} aria-label="Ask the instant assistant">
      <p className={s.note}>Instant assistant. It follows fixed rules and is not a person or an AI model. It points you to a real page, a price or a scan.</p>
      <form onSubmit={submit} className={s.form}>
        <label htmlFor="concierge-q" className={s.label}>What do you need?</label>
        <input id="concierge-q" className={s.input} value={q} maxLength={500} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        <button type="submit" className={s.btn}>Ask</button>
      </form>
      <div aria-live="polite" className={s.out}>
        {view && (
          <>
            <p>{view.text}</p>
            {view.links.length > 0 && <ul>{view.links.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}</ul>}
          </>
        )}
      </div>
    </section>
  );
}
