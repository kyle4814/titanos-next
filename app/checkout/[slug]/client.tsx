"use client";

/**
 * Customise -> Negotiate -> Pay. The same pure engine the Worker uses (lib/checkout/engine.mjs) recalculates the price
 * live in the browser; the Worker recomputes it from the raw choices before it creates the Stripe session, so this
 * number is a preview, never an authority. No LLM sets any price.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { SITE } from "@/lib/config";
import { quote, readNeeds, formatCents, MAX_QTY, TERM_PCT, PREPAY_PCT, CASE_STUDY_PCT, CALL_CENTS } from "@/lib/checkout/engine.mjs";

type Sel = { qty: number; priority: boolean; call: boolean; termMonths: number; prepay: boolean; caseStudy: boolean; counterAud: number; needs: string };
const START: Sel = { qty: 1, priority: false, call: false, termMonths: 3, prepay: false, caseStudy: false, counterAud: 0, needs: "" };
const STEPS = ["Customise", "Negotiate", "Pay"];
const ENDPOINT = `${SITE.API_BASE_URL}/negotiate/checkout`;

const card: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px 22px", background: "var(--card)" };
const label: React.CSSProperties = { display: "flex", gap: 12, alignItems: "flex-start", minHeight: 44, padding: "8px 0", color: "var(--text)", cursor: "pointer" };
const btn = (primary: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "14px 28px", minHeight: 48, borderRadius: "var(--radius-sm)",
  border: `1px solid ${primary ? "var(--gold)" : "var(--gold-dim)"}`, color: primary ? "var(--gold)" : "var(--ice)", background: "transparent",
  fontFamily: "var(--font-display), Georgia, serif", fontStyle: "italic", fontSize: "var(--fs-sm)", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
});

export default function CheckoutClient({ slug }: { slug: string }) {
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<Sel>(START);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [failMsg, setFailMsg] = useState("");
  const result = useMemo(() => quote(slug, sel), [slug, sel]);
  const hint = useMemo(() => readNeeds(sel.needs), [sel.needs]);
  if (!result.ok) return null;
  const q = result;
  const recurring = q.cadence !== "one-off";
  const set = (patch: Partial<Sel>) => setSel((s) => ({ ...s, ...patch }));

  const applyHints = () => set(hint.applied);

  const pay = async () => {
    if (state === "busy") return;
    setState("busy");
    setFailMsg("");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ slug, selection: sel, email: email.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || `POST ${res.status}`);
      window.location.href = data.url;
    } catch (e) {
      setState("error");
      setFailMsg(e instanceof Error ? e.message : "error");
    }
  };

  const mail = `mailto:${SITE.KYLE_EMAIL}?subject=${encodeURIComponent(`Order: ${q.name}`)}&body=${encodeURIComponent(`I'd like to order ${q.name} at ${formatCents(q.payNowCents)}.\nScope: ${JSON.stringify(q.selection)}`)}`;
  const per = recurring && !q.selection.prepay ? "/month" : "";

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "var(--space-16) 20px var(--space-16)", display: "grid", gap: 20 }}>
      <header>
        <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          <Link href={`/offers/${slug}`} style={{ color: "var(--ice)" }}>Back to the offer</Link>
        </p>
        <h1 style={{ color: "var(--ice)", margin: "6px 0 4px" }}>{q.name}</h1>
        <ol aria-label="Steps" style={{ display: "flex", gap: 8, listStyle: "none", padding: 0, margin: "10px 0 0", flexWrap: "wrap" }}>
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} style={{ padding: "6px 14px", borderRadius: 999, border: `1px solid ${i === step ? "var(--gold)" : "var(--border)"}`, color: i === step ? "var(--gold)" : "var(--dim)", fontSize: "var(--fs-xs)" }}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>
      </header>

      <section aria-live="polite" aria-label="Your price" style={{ ...card, borderColor: "var(--gold-dim)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <span style={{ color: "var(--dim)" }}>Your price</span>
          <strong style={{ color: "var(--gold)", fontSize: "var(--fs-2xl, 1.8rem)" }}>{formatCents(q.headlineCents)}{recurring ? "/month" : ""}</strong>
        </div>
        {q.headlineCents < q.listedHeadlineCents && <p style={{ color: "var(--dim)", margin: "4px 0 0" }}>Listed {formatCents(q.listedHeadlineCents)}{recurring ? "/month" : ""}. You save {formatCents(q.savingCents)}.</p>}
        <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", color: "var(--text)" }}>
          {q.lines.map((l) => <li key={l.key} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{l.key === "base" ? "Base price" : l.label}</span><span>{formatCents(l.cents)}</span></li>)}
          {q.extras.map((l) => <li key={l.key} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{l.label}</span><span>{formatCents(l.cents)}</span></li>)}
        </ul>
        <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", margin: "10px 0 0" }}>No GST is charged. Today you pay {formatCents(q.payNowCents)}{q.mode === "subscription" ? `, then ${formatCents(q.headlineCents)} each month` : ""}.</p>
      </section>

      {step === 0 && (
        <section style={card} aria-label="Customise">
          <h2 style={{ color: "var(--ice)", marginTop: 0 }}>Choose your scope</h2>
          <label style={{ ...label, flexDirection: "column", gap: 6 }}>
            <span>How many sites, entities or targets? <strong>{sel.qty}</strong> (each extra costs 60% of the base price)</span>
            <input type="range" min={1} max={MAX_QTY} value={sel.qty} onChange={(e) => set({ qty: Number(e.target.value) })} style={{ width: "100%", minHeight: 44 }} aria-label="Quantity" />
          </label>
          <label style={label}><input type="checkbox" checked={sel.priority} onChange={(e) => set({ priority: e.target.checked })} style={{ width: 24, height: 24 }} /><span>{recurring ? "Priority support and turnaround" : "Priority delivery"}</span></label>
          <label style={label}><input type="checkbox" checked={sel.call} onChange={(e) => set({ call: e.target.checked })} style={{ width: 24, height: 24 }} /><span>A walkthrough call, one time ({formatCents(CALL_CENTS)})</span></label>
          <div style={{ marginTop: 14 }}><button type="button" style={btn(true)} onClick={() => setStep(1)}>Next: negotiate</button></div>
        </section>
      )}

      {step === 1 && (
        <section style={card} aria-label="Negotiate">
          <h2 style={{ color: "var(--ice)", marginTop: 0 }}>Make it fit</h2>
          <p style={{ color: "var(--dim)", marginTop: 0 }}>Tell us what you need, or name your number. The price below moves as you choose. The rules are fixed and you can see all of them.</p>
          <label style={{ display: "block", color: "var(--ice)" }}>What do you need? (optional)
            <textarea value={sel.needs} maxLength={400} rows={3} onChange={(e) => set({ needs: e.target.value })} placeholder="For example: 4 sites, we need it this week, budget of 350" style={{ width: "100%", marginTop: 6, padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--text)" }} />
          </label>
          {hint.recognised && <p style={{ margin: "8px 0" }}>We read: {hint.notes.join(", ")}. <button type="button" onClick={applyHints} style={{ ...btn(false), padding: "8px 16px", minHeight: 44 }}>Apply to my choices</button></p>}
          {sel.needs && !hint.recognised && <p style={{ color: "var(--dim)", margin: "8px 0" }}>We could not turn that into options automatically. It goes to Kyle with your order and he reads it himself.</p>}
          {recurring && (
            <fieldset style={{ border: "none", padding: 0, margin: "14px 0 0" }}>
              <legend style={{ color: "var(--ice)" }}>Term</legend>
              {[3, 6, 12].map((t) => (
                <label key={t} style={label}><input type="radio" name="term" checked={sel.termMonths === t} onChange={() => set({ termMonths: t, prepay: t >= 6 ? sel.prepay : false })} style={{ width: 24, height: 24 }} /><span>{t} months{TERM_PCT[t as 3 | 6 | 12] ? `, ${TERM_PCT[t as 3 | 6 | 12]}% off` : " (the minimum)"}</span></label>
              ))}
              <label style={{ ...label, opacity: sel.termMonths >= 6 ? 1 : 0.5 }}><input type="checkbox" disabled={sel.termMonths < 6} checked={sel.prepay} onChange={(e) => set({ prepay: e.target.checked })} style={{ width: 24, height: 24 }} /><span>Pay the whole term up front, a further {PREPAY_PCT}% off</span></label>
            </fieldset>
          )}
          <label style={label}><input type="checkbox" checked={sel.caseStudy} onChange={(e) => set({ caseStudy: e.target.checked })} style={{ width: 24, height: 24 }} /><span>Let us write up the result as a case study, {CASE_STUDY_PCT}% off. You approve every word before anything is published.</span></label>
          <label style={{ display: "block", color: "var(--ice)", marginTop: 10 }}>Your number{recurring ? " per month" : ""} (AU$, optional)
            <input type="number" inputMode="numeric" min={0} value={sel.counterAud || ""} onChange={(e) => set({ counterAud: Number(e.target.value) || 0 })} style={{ display: "block", marginTop: 6, padding: "10px 12px", minHeight: 44, width: 200, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--text)" }} />
          </label>
          {q.message && <p role="status" style={{ color: q.status === "countered" ? "var(--gold)" : "var(--ok)", margin: "12px 0 0" }}>{q.message}</p>}
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)" }}>The lowest price for this scope is {formatCents(q.floorHeadlineCents)}{recurring ? "/month" : ""}, and it needs every give-back above. Nothing goes below it.</p>
          <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <button type="button" style={btn(false)} onClick={() => setStep(0)}>Back</button>
            <button type="button" style={btn(true)} onClick={() => setStep(2)}>Next: review and pay</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section style={card} aria-label="Pay">
          <h2 style={{ color: "var(--ice)", marginTop: 0 }}>Review and pay</h2>
          <p style={{ color: "var(--text)", margin: "0 0 8px" }}>You are buying <strong>{q.name}</strong>{q.selection.qty > 1 ? ` for ${q.selection.qty} units` : ""} at <strong>{formatCents(q.headlineCents)}{per}</strong>. Today: <strong>{formatCents(q.payNowCents)}</strong>.</p>
          {recurring && <p style={{ color: "var(--dim)", marginTop: 0 }}>Monthly offers run for at least {q.termMonths} months and cancel by email after that. No refund for the current month.</p>}
          {q.selection.caseStudy && <p style={{ color: "var(--dim)", marginTop: 0 }}>You agreed we may write this up as a case study. You approve every word first.</p>}
          <label style={{ display: "block", color: "var(--ice)" }}>Your email for the receipt (optional)
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ display: "block", marginTop: 6, padding: "10px 12px", minHeight: 44, width: "100%", maxWidth: 380, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--text)" }} />
          </label>
          <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            <button type="button" style={btn(false)} onClick={() => setStep(1)}>Back</button>
            <button type="button" style={btn(true)} onClick={pay} disabled={state === "busy"} aria-busy={state === "busy" || undefined} data-analytics="negotiated-checkout-pay">
              {state === "busy" ? "Opening checkout…" : `Pay ${formatCents(q.payNowCents)} securely with Stripe`}
            </button>
          </div>
          {state === "error" && (
            <p role="alert" style={{ color: "var(--text)", marginTop: 12 }}>
              Checkout could not open ({failMsg}). <a href={mail} style={{ color: "var(--ice)", textDecoration: "underline" }}>Email Kyle this order</a> and he will send a payment link at this price.
            </p>
          )}
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", marginTop: 12 }}>Payments are handled by Stripe. We never see your card. Nobody is replaced and your own IT stays in charge.</p>
        </section>
      )}
      <noscript><p>JavaScript is needed for live pricing. Email <a href={`mailto:${SITE.KYLE_EMAIL}`}>{SITE.KYLE_EMAIL}</a> to order.</p></noscript>
    </main>
  );
}
