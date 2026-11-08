"use client";
// F-C6 mount. The rules-based concierge router behind a plain form. Zero model calls, zero network: the adapter is a no-op,
// so an unmatched ask is never claimed as saved. Any visitor text is rendered as text by React, never as markup.
import { useMemo, useState } from "react";
import { makeAsk } from "@/lib/concierge/catalogue";
import { viewOf } from "@/lib/concierge/view";
import type { View } from "@/lib/concierge/view";
import s from "./Concierge.module.css";

export default function Concierge() {
  const ask = useMemo(() => makeAsk(), []);
  const [q, setQ] = useState("");
  const [view, setView] = useState<View | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setView(viewOf(await ask(q, "guest")));
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
