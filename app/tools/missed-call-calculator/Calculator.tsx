"use client";
import { useId, useState } from "react";
import { calculate, EXAMPLE, type Inputs } from "./calc";

const aud = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(Math.round(n));
const num1 = (n: number) => new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format(n);

type Field = { key: keyof Inputs; label: string; hint: string; unit: string; min: number; max: number; step: number };
const FIELDS: Field[] = [
  { key: "callsPerWeek", label: "Calls a week", hint: "All inbound calls from new and existing customers. Count a normal week from your phone log.", unit: "calls", min: 0, max: 10000, step: 1 },
  { key: "missedPct", label: "Share missed", hint: "Calls that rang out or went to voicemail, as a percentage. Your phone's call history shows this.", unit: "%", min: 0, max: 100, step: 1 },
  { key: "jobValue", label: "Average job value", hint: "What a typical won job invoices, in dollars. Use your own average, not a best case.", unit: "$", min: 0, max: 10000000, step: 10 },
  { key: "closePct", label: "Close rate", hint: "Of the enquiries you do answer, the share that become paid jobs.", unit: "%", min: 0, max: 100, step: 1 },
  { key: "weeksPerYear", label: "Weeks you take calls a year", hint: "52 less holidays and shutdowns.", unit: "weeks", min: 0, max: 52, step: 1 },
  { key: "recoverPct", label: "Missed callers you could win back", hint: "Only used for the second figure. Your own guess at the share you would win back by replying within minutes. There is no industry figure behind the example.", unit: "%", min: 0, max: 100, step: 1 },
];

export default function Calculator() {
  const uid = useId();
  const [v, setV] = useState<Record<keyof Inputs, string>>(() => Object.fromEntries(Object.entries(EXAMPLE).map(([k, n]) => [k, String(n)])) as Record<keyof Inputs, string>);
  const parsed = Object.fromEntries(Object.entries(v).map(([k, s]) => [k, s.trim() === "" ? 0 : Number(s)])) as Inputs;
  const r = calculate(parsed);
  const isExample = (Object.keys(EXAMPLE) as (keyof Inputs)[]).every((k) => Number(v[k]) === EXAMPLE[k]);

  return (
    <div className="mc-calc">
      <form className="mc-inputs" onSubmit={(e) => e.preventDefault()} aria-label="Your numbers">
        <div className="mc-inputs__head">
          <h2>Your numbers</h2>
          <button type="button" className="mc-link" onClick={() => setV(Object.fromEntries(Object.entries(EXAMPLE).map(([k, n]) => [k, String(n)])) as Record<keyof Inputs, string>)}>Reset to the example</button>
        </div>
        {isExample && <p className="mc-flag" role="note">These are example numbers, not industry statistics. Replace every one with your own.</p>}
        {FIELDS.map((f) => {
          const id = `${uid}-${f.key}`;
          return (
            <div className="mc-field" key={f.key}>
              <label htmlFor={id}>{f.label} <span>({f.unit})</span></label>
              <input id={id} name={f.key} type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step} value={v[f.key]} aria-describedby={`${id}-h`} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
              <p id={`${id}-h`}>{f.hint}</p>
            </div>
          );
        })}
      </form>

      <section className="mc-out" aria-labelledby={`${uid}-out`} aria-live="polite">
        <h2 id={`${uid}-out`}>Value at risk from missed calls</h2>
        <p className="mc-big">{aud(r.monthly)}<small> a month</small></p>
        <p className="mc-big mc-big--sub">{aud(r.yearly)}<small> a year</small></p>
        <dl className="mc-steps">
          <div><dt>Missed calls a week</dt><dd>{num1(r.missedPerWeek)}</dd></div>
          <div><dt>Jobs those calls would have become</dt><dd>{num1(r.lostJobsPerWeek)} a week</dd></div>
          <div><dt>Job value at risk</dt><dd>{aud(r.weekly)} a week</dd></div>
          <div><dt>If you won back {num1(Math.min(100, Math.max(0, parsed.recoverPct)))}%</dt><dd>{aud(r.recoveredMonthly)} a month, {aud(r.recoveredYearly)} a year</dd></div>
        </dl>
        <p className="mc-note">Working: calls a week x share missed x close rate x average job value, times the weeks you work, divided by 12 for the month. Revenue, not profit: take off materials, labour and travel before you treat it as money in your pocket. It is a ceiling, because some missed callers ring someone else regardless or call back on their own.</p>
      </section>
    </div>
  );
}
