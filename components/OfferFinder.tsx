"use client";

// Offline offer finder: a guided chat that asks three questions and hands back
// the right offers with links. No network, no AI call; scoring lives in
// lib/offers/finder.ts and reads only the offer data shipped with the site.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ALL_OFFERS, availability, AVAILABILITY_TEXT, buyHref } from "@/lib/offers";
import { formatOfferPrice } from "@/lib/offers/types";
import {
  BUDGET_OPTIONS, NEED_OPTIONS, WHO_OPTIONS, inferFromText, recommend, understood,
  type Budget, type Need, type Who,
} from "@/lib/offers/finder";
import { AUDIT_MESSAGE_HREF } from "@/lib/config";

type Msg = { from: "bot" | "me"; text: string };

const label = <T extends string>(opts: { id: T; label: string }[], id: T) =>
  opts.find((o) => o.id === id)?.label ?? id;

export default function OfferFinder({ compact = false }: { compact?: boolean }) {
  const [who, setWho] = useState<Who | null>(null);
  const [need, setNeed] = useState<Need | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState("");
  const [hint, setHint] = useState("");
  const [log, setLog] = useState<Msg[]>([]);
  const lastRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  const step = who === null ? 0 : need === null ? 1 : budget === null ? 2 : 3;

  const result = useMemo(
    () =>
      step === 3
        ? recommend({ who: who!, need: need!, budget: budget!, text }, { offers: ALL_OFFERS, availability })
        : null,
    [step, who, need, budget, text],
  );

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    // Move focus only when the results appear; typing and chip taps keep their own focus.
    if (step === 3) lastRef.current?.focus({ preventScroll: false });
  }, [step]);

  function say(...m: Msg[]) { setLog((l) => [...l, ...m]); }

  function pickWho(w: Who, shown?: string) {
    setWho(w);
    say({ from: "me", text: shown ?? label(WHO_OPTIONS, w) });
  }
  function pickNeed(n: Need, shown?: string) {
    setNeed(n);
    say({ from: "me", text: shown ?? label(NEED_OPTIONS, n) });
  }
  function pickBudget(b: Budget, shown?: string) {
    setBudget(b);
    say({ from: "me", text: shown ?? label(BUDGET_OPTIONS, b) });
  }

  function submitText(e: React.FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) { setHint("Type a few words, or pick one of the buttons."); return; }
    setHint("");
    setDraft("");
    setText((p) => (p ? p + " " + t : t));
    const g = inferFromText(t);
    const msgs: Msg[] = [{ from: "me", text: t }];
    if (!understood(t)) msgs.push({ from: "bot", text: "I did not recognise that, so I will start from safe defaults. Pick a button to narrow it down." });
    // Use what the words tell us for the current question; otherwise fall back to a neutral answer.
    if (step === 0) { setWho(g.who ?? "unsure"); if (g.need && need === null) setNeed(g.need); }
    else if (step === 1) { setNeed(g.need ?? "explore"); }
    else if (step === 2) { setBudget(g.budget ?? "under100"); }
    say(...msgs);
  }

  function reset() {
    setWho(null); setNeed(null); setBudget(null); setText(""); setDraft(""); setLog([]);
  }

  const question =
    step === 0 ? "Hi, I am the TITANOS offer finder. It takes about 30 seconds and nothing leaves your device. Who are you?"
    : step === 1 ? "Thanks. What do you most want help with?"
    : step === 2 ? "Last one. What budget feels comfortable? A no is always fine."
    : "Here is what fits you best.";
  const options =
    step === 0 ? WHO_OPTIONS : step === 1 ? NEED_OPTIONS : step === 2 ? BUDGET_OPTIONS : [];

  return (
    <div className={`finder${compact ? " finder-compact" : ""}`}>
      <div className="finder-log" role="log" aria-live="polite" aria-relevant="additions">
        {log.map((m, i) => (
          <div key={i} className={`bubble ${m.from}`}>{m.text}</div>
        ))}
        <div className="bubble bot" id="finder-q" tabIndex={-1} ref={lastRef}>{question}</div>
      </div>

      {step < 3 && (
        <>
          <div className="chips" role="group" aria-labelledby="finder-q">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                className="chip"
                onClick={() =>
                  step === 0 ? pickWho(o.id as Who) : step === 1 ? pickNeed(o.id as Need) : pickBudget(o.id as Budget)
                }
              >
                {o.label}
              </button>
            ))}
          </div>
          <form className="textrow" onSubmit={submitText}>
            <label htmlFor="finder-text" className="sr-only">Or tell us in your own words</label>
            <input
              id="finder-text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Or tell us in your own words"
              autoComplete="off"
              maxLength={200}
            />
            <button type="submit" className="chip send">Send</button>
          </form>
          {hint && <p className="hint" role="status">{hint}</p>}
        </>
      )}

      {result && (
        <div className="results">
          {result.top.map((o) => {
            const av = availability(o);
            const href = buyHref(o);
            return (
              <article key={o.slug} className="rcard">
                <header>
                  <strong>{o.name}</strong>
                  <span className={`badge ${av === "SOON" ? "soon" : "open"}`}>{AVAILABILITY_TEXT[av].pill}</span>
                </header>
                <p className="bluf">{o.bluf}</p>
                <div className="price">{formatOfferPrice(o)}{av === "SOON" ? " (launching soon, register interest on the page)" : ""}</div>
                <p className="why"><span>Why this fits you:</span> {result.reason[o.slug]}</p>
                <div className="actions">
                  <Link className="btn ghost" href={`/offers/${o.slug}`} aria-label={`See the page for ${o.name}`}>See the page</Link>
                  {href && <a className="btn solid" href={href} aria-label={`Buy ${o.name} now`}>Buy now</a>}
                </div>
              </article>
            );
          })}
          {result.also.length > 0 && (
            <details className="also">
              <summary>Also worth a look</summary>
              <ul>
                {result.also.map((o) => (
                  <li key={o.slug}><Link href={`/offers/${o.slug}`}>{o.name}</Link> <span>{formatOfferPrice(o)} ({AVAILABILITY_TEXT[availability(o)].pill})</span></li>
                ))}
              </ul>
            </details>
          )}
          <div className="actions foot">
            <button type="button" className="btn ghost" onClick={reset}>Start over</button>
            <Link className="btn ghost" href="/offers">See all offers</Link>
            <Link className="btn ghost" href="/scan#request">Free check first</Link>
            <Link className="btn ghost" href={AUDIT_MESSAGE_HREF}>Talk to Kyle</Link>
          </div>
        </div>
      )}

      <style>{`
        .finder { max-width: 720px; margin: 0 auto; text-align: left; }
        .finder-log { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
        .bubble { max-width: 88%; padding: 12px 16px; border-radius: var(--radius-lg); font-size: var(--fs-body); line-height: 1.55; outline: none; }
        .bubble.bot { background: var(--card); border: 1px solid var(--gold-dim); color: var(--text); align-self: flex-start; }
        .bubble.me { background: rgb(var(--gold-rgb) / 0.14); border: 1px solid var(--gold-dim); color: var(--ice); align-self: flex-end; }
        .bubble:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
        .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
        .chip { min-height: 44px; padding: 8px 16px; background: transparent; color: var(--ice); border: 1px solid var(--gold-dim); border-radius: 999px; font: inherit; font-size: var(--fs-sm); cursor: pointer; text-align: left; }
        .chip:hover { border-color: var(--gold); color: var(--gold); }
        .chip:focus-visible, .btn:focus-visible, .finder input:focus-visible, .also summary:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
        .textrow { display: flex; gap: 8px; }
        .textrow input { flex: 1; min-width: 0; min-height: 44px; padding: 8px 14px; background: var(--card); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-md); font: inherit; font-size: 16px; }
        .chip.send { background: var(--gold); color: var(--vault-black, #0a0a0a); border-color: var(--gold); font-weight: 600; }
        .results { display: grid; gap: 14px; margin-top: 6px; }
        .rcard { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 18px 20px; }
        .rcard header { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; flex-wrap: wrap; }
        .rcard strong { color: var(--gold); font-family: var(--font-display), Georgia, serif; }
        .badge { font-size: var(--fs-xs); border-radius: 999px; padding: 2px 10px; border: 1px solid var(--border); color: var(--dim); white-space: nowrap; }
        .badge.open { color: var(--ok); border-color: var(--ok); }
        .rcard .bluf { color: var(--text); font-size: var(--fs-sm); line-height: 1.6; margin: 10px 0 6px; }
        .rcard .price { color: var(--ice); font-size: var(--fs-sm); }
        .rcard .why { color: var(--dim); font-size: var(--fs-sm); line-height: 1.6; margin: 8px 0 0; }
        .rcard .why span { color: var(--ice); }
        .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
        .actions.foot { justify-content: center; }
        .btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 8px 18px; border-radius: var(--radius-lg); font: inherit; font-size: var(--fs-sm); font-weight: 600; text-decoration: none; cursor: pointer; }
        .btn.solid { background: var(--gold); color: var(--vault-black, #0a0a0a); border: 1px solid var(--gold); }
        .btn.ghost { background: transparent; color: var(--ice); border: 1px solid var(--gold-dim); }
        .btn.ghost:hover { border-color: var(--gold); color: var(--gold); }
        .also { color: var(--dim); font-size: var(--fs-sm); }
        .also summary { cursor: pointer; color: var(--ice); min-height: 32px; }
        .also ul { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 6px; }
        .hint { color: var(--dim); font-size: var(--fs-sm); margin: 8px 0 0; }
        .also a { color: var(--ice); text-decoration: underline; }
        .also li span { color: var(--dim); margin-left: 8px; }
        @media (max-width: 480px) { .bubble { max-width: 96%; } .textrow { flex-direction: row; } }
      `}</style>
    </div>
  );
}
