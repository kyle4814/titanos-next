"use client";
// F-C6 mount. The rules-based concierge router behind a plain form. Zero model calls, zero network: the adapter is a no-op,
// so an unmatched ask is never claimed as saved. Any visitor text is rendered as text by React, never as markup.
import { useRef, useState } from "react";
import { viewOf } from "@/lib/concierge/view";
import type { View } from "@/lib/concierge/view";
import s from "./Concierge.module.css";

async function loadAsk() { return (await import("@/lib/concierge/catalogue")).makeAsk(); }

export default function Concierge() {
  // The catalogue (every offer shelf, ~57 KB gz) loads on the first Ask, not with the page: keeps /faq under the 250 KB first-load budget.
  const askRef = useRef<Awaited<ReturnType<typeof loadAsk>> | null>(null);
  const [q, setQ] = useState("");
  const [view, setView] = useState<View | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    askRef.current ??= await loadAsk();
    setView(viewOf(await askRef.current(q, "guest")));
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
