"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  APPETITE, CATEGORIES, DIMENSIONS, DIM_LABEL, SECTORS, SIZE_BANDS, TOOL_CATS, XrayError,
  buildReport, dispHours, g, reportLines,
  type Report, type WorkflowInput,
} from "@/lib/xray/engine";
import {
  PDF_FOOTER_OWN, PDF_FOOTER_SYNTHETIC, PDF_HEADER_OWN, PDF_HEADER_SYNTHETIC, renderPdf,
} from "@/lib/xray/pdf";

// The whole X-Ray runs in this browser tab. No request is made with your answers: there is no fetch,
// no upload, no account, no cookie. Nothing touches storage unless you tick "Keep a draft in this tab"
// (off by default): then a draft lives in sessionStorage so a refresh does not lose it, and it vanishes when the
// tab closes (or when you press "Clear my answers"). That opt-in save and its restore button are the only code
// here that may touch storage (scripts/xray-level0-flow-probe enforces it with throwing traps).

type Wf = {
  name: string; category: string; unknown: boolean; n: string; t0: string; reworkPct: string; reworkMin: string;
  wait: string; handoffs: string; retyped: string; odd: string; steps: string; visibility: string; certainty: string;
};
type Form = {
  example: boolean; label: string; industry: string; size: string; tools: string[]; appetite: string; rate: string; wfs: Wf[];
};

const blankWf = (): Wf => ({
  name: "", category: "", unknown: false, n: "", t0: "", reworkPct: "0", reworkMin: "0", wait: "0", handoffs: "0",
  retyped: "0", odd: "0", steps: "5", visibility: "patchy", certainty: "rough_estimate",
});
const blank = (): Form => ({
  example: false, label: "", industry: "", size: "", tools: [], appetite: "either", rate: "", wfs: [blankWf()],
});

// SYNTHETIC example (the same fictional trades business used to test the estimator).
const EXAMPLE: Form = {
  example: true, label: "Fictional Spark and Pipe Co", industry: "trades", size: "5-19",
  tools: ["accounting", "email", "paper"], appetite: "either", rate: "55",
  wfs: [
    { name: "Job quotes from site visits", category: "quoting", unknown: false, n: "14", t0: "35", reworkPct: "20", reworkMin: "20", wait: "30", handoffs: "2", retyped: "1", odd: "10", steps: "9", visibility: "patchy", certainty: "rough_estimate" },
    { name: "End of job invoicing", category: "invoicing_billing", unknown: false, n: "22", t0: "18", reworkPct: "12", reworkMin: "15", wait: "72", handoffs: "3", retyped: "2", odd: "8", steps: "7", visibility: "blind", certainty: "measured_recently" },
    { name: "Weekly timesheets", category: "job_admin", unknown: false, n: "8", t0: "6", reworkPct: "3", reworkMin: "5", wait: "2", handoffs: "1", retyped: "0", odd: "2", steps: "4", visibility: "clear", certainty: "rough_estimate" },
  ],
};

const TOOL_LABEL: Record<string, string> = {
  paper: "Paper", spreadsheet: "Spreadsheets", email: "Email", accounting: "Accounting software", crm: "Customer list or CRM",
  erp: "Stock or ERP system", booking: "Booking or calendar tool", project: "Job or project tool", other: "Something else",
};
const APPETITE_LABEL: Record<string, string> = {
  quick_fix: "Quick free fixes", automation: "Open to automation", either: "Either, show me both",
};
const SHAPES: Record<string, string[]> = {
  trades: ["Quoting from site visits", "End of job invoicing", "Weekly timesheets"],
  professional_services: ["Client onboarding", "Monthly reporting", "Chasing approvals"],
  wholesale_distribution: ["Supplier orders", "Typing orders into two systems", "Customer enquiries"],
  retail: ["Stock ordering", "End of day reporting", "Online order entry"],
  hospitality: ["Rostering and bookings", "Supplier ordering", "Event enquiries"],
  health_allied: ["Booking and reminders", "Intake forms", "Invoicing"],
  construction: ["Job paperwork", "Variation approvals", "Supplier ordering"],
  other: ["Quotes", "Invoices", "Enquiries"],
};

const LABEL: CSSProperties = { color: "var(--ice)", fontSize: 14, display: "block", marginBottom: 4 };
const HINT: CSSProperties = { color: "var(--dim)", fontSize: 13, marginTop: 4, lineHeight: 1.5 };
const INPUT: CSSProperties = {
  width: "100%", padding: "10px 12px", background: "#000", color: "var(--ice)", border: "1px solid var(--border)",
  borderRadius: 8, fontSize: 16, minHeight: 44,
};
const CARD: CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 12, padding: "20px 18px", marginBottom: 18, background: "rgba(0,0,0,0.35)",
};
const GRID: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 };
const H3: CSSProperties = {
  fontFamily: "var(--font-display), Georgia, serif", color: "var(--gold)", fontSize: "var(--fs-h3)",
  letterSpacing: "0.06em", margin: "0 0 12px",
};
const BTN: CSSProperties = {
  padding: "12px 18px", minHeight: 44, borderRadius: 8, border: "1px solid var(--border)", background: "transparent",
  color: "var(--ice)", fontSize: 15, cursor: "pointer",
};
const BTN_PRIMARY: CSSProperties = { ...BTN, border: "1px solid var(--gold)", color: "var(--gold)" };
const P: CSSProperties = { color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "0 0 12px" };
const KEY = "titanos.xray.draft.v1";

const numOrNull = (s: string) => (s.trim() === "" ? NaN : Number(s));

function toInput(f: Form, asOf: string) {
  const workflows: WorkflowInput[] = f.wfs.map((w) => {
    const unknown = w.unknown;
    return {
      name: w.name, category: w.category,
      n_per_week: unknown ? null : numOrNull(w.n), t0_min: unknown ? null : numOrNull(w.t0),
      rework_pct: numOrNull(w.reworkPct), rework_min: numOrNull(w.reworkMin), wait_hours: numOrNull(w.wait),
      handoffs: numOrNull(w.handoffs), systems_retyped: numOrNull(w.retyped), exception_pct: numOrNull(w.odd),
      steps: numOrNull(w.steps), visibility: w.visibility, certainty: unknown ? "dont_know" : w.certainty,
    };
  });
  return {
    synthetic: f.example, as_of: asOf, business_label: f.label.trim() || (f.example ? "Fictional Business" : "Your business"),
    industry: f.industry, size_band: f.size, tools: f.tools, appetite: f.appetite,
    hourly_rate: f.rate.trim() === "" ? null : Number(f.rate), workflows,
  };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={LABEL}>{label}</span>
      {children}
      {hint && <span style={{ ...HINT, display: "block" }}>{hint}</span>}
    </label>
  );
}

function Level({ lvl }: { lvl: string }) {
  const n = lvl === "HIGH" ? 3 : lvl === "MED" ? 2 : 1;
  return (
    <span aria-label={`level ${lvl}`} style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[1, 2, 3].map((i) => (
        <span key={i} aria-hidden style={{ width: 18, height: 8, borderRadius: 2, background: i <= n ? "var(--gold)" : "var(--border)" }} />
      ))}
      <strong style={{ marginLeft: 6, fontSize: 13, color: "var(--ice)" }}>{lvl}</strong>
    </span>
  );
}

function save(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function XrayWizard() {
  const [f, setF] = useState<Form>(blank);
  const [asOf, setAsOf] = useState("");
  const [restored, setRestored] = useState(false);
  const [keep, setKeep] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setAsOf(new Date().toISOString().slice(0, 10));
  }, []);
  // OPT-IN SAVE: the only automatic storage write, and only while the box is ticked.
  useEffect(() => {
    if (!keep) return;
    try { sessionStorage.setItem(KEY, JSON.stringify(f)); } catch { /* storage blocked: fine */ }
  }, [f, keep]);
  // OPT-IN RESTORE: runs only when the person presses the button.
  const restore = () => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as Form;
        if (d && Array.isArray(d.wfs) && d.wfs.length >= 1 && d.wfs.length <= 5) { setF(d); setRestored(true); }
      }
    } catch { /* a blocked or corrupt draft is just ignored */ }
  };
  const keepToggle = (on: boolean) => {
    setKeep(on);
    if (!on) { try { sessionStorage.removeItem(KEY); } catch { /* */ } }
  };

  const { report, error } = useMemo<{ report: Report | null; error: string }>(() => {
    if (!asOf) return { report: null, error: "" };
    try {
      return { report: buildReport(toInput(f, asOf)), error: "" };
    } catch (e) {
      return { report: null, error: e instanceof XrayError ? e.message : "Check your answers." };
    }
  }, [f, asOf]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const setWf = (i: number, patch: Partial<Wf>) => setF((s) => ({ ...s, wfs: s.wfs.map((w, j) => (j === i ? { ...w, ...patch } : w)) }));
  const toggleTool = (t: string) => set("tools", f.tools.includes(t) ? f.tools.filter((x) => x !== t) : [...f.tools, t]);
  const clear = () => { setF(blank()); setShown(false); setRestored(false); if (keep) { try { sessionStorage.removeItem(KEY); } catch { /* */ } } };

  const downloadPdf = () => {
    if (!report) return;
    const syn = report.synthetic as boolean;
    const bytes = renderPdf(reportLines(report), syn ? PDF_HEADER_SYNTHETIC : PDF_HEADER_OWN, syn ? PDF_FOOTER_SYNTHETIC : PDF_FOOTER_OWN);
    save(syn ? "titanos-xray-SYNTHETIC-DEMO.pdf" : "titanos-xray-estimate.pdf", bytes as BlobPart, "application/pdf");
  };
  const downloadJson = () => report && save("titanos-xray-opportunity-contract.json", JSON.stringify(report, null, 1) + "\n", "application/json");

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <div role="note" style={{ ...CARD, borderColor: "var(--gold)" }}>
        <h2 style={H3}>PRIVATE BY DESIGN</h2>
        <p style={{ ...P, marginBottom: 0 }}>
          Your answers are worked out inside this page, on your device. Nothing is sent, saved on our side, or scanned. There
          is no login. Nothing is kept unless you tick <strong>Keep a draft in this tab</strong>. If you do, the draft stays in this tab only so a refresh does not lose your place, and it disappears when you
          close the tab or press <strong>Clear my answers</strong>.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <button type="button" style={BTN} onClick={() => { setF(EXAMPLE); setShown(true); setRestored(false); }}>
          Try the SYNTHETIC example
        </button>
        <button type="button" style={BTN} onClick={clear}>Clear my answers</button>
        <label style={{ ...BTN, display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={keep} onChange={(e) => keepToggle(e.target.checked)} />
          Keep a draft in this tab (optional)
        </label>
        {keep && <button type="button" style={BTN} onClick={restore}>Restore my saved draft</button>}
      </div>
      {restored && <p role="status" style={HINT}>We restored your saved draft from this tab. Press Clear my answers to start fresh.</p>}
      {f.example && (
        <p role="status" style={{ ...P, color: "var(--gold)" }}>
          SYNTHETIC EXAMPLE: a fictional trades business with made-up answers. Edit anything to see the result move, or clear it and enter your own.
        </p>
      )}

      <form onSubmit={(e) => { e.preventDefault(); setShown(true); }} noValidate>
        <fieldset style={{ ...CARD, margin: "0 0 18px" }}>
          <legend style={{ ...H3, padding: "0 8px" }}>1. YOUR BUSINESS</legend>
          <div style={GRID}>
            <Field label="What kind of business?">
              <select style={INPUT} value={f.industry} onChange={(e) => set("industry", e.target.value)}>
                <option value="">Choose one</option>
                {Object.entries(SECTORS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="How many people work in it?">
              <select style={INPUT} value={f.size} onChange={(e) => set("size", e.target.value)}>
                <option value="">Choose one</option>
                {SIZE_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="A nickname for the report (optional)" hint="Plain words only. No names, emails or phone numbers.">
              <input style={INPUT} maxLength={40} value={f.label} onChange={(e) => set("label", e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Value of an hour of staff time, in AU$ (optional)" hint="Only used for one labelled line. Leave empty to skip.">
              <input style={INPUT} type="number" inputMode="decimal" min={0} max={500} value={f.rate} onChange={(e) => set("rate", e.target.value)} />
            </Field>
          </div>
          <div style={{ marginTop: 16 }}>
            <span style={LABEL}>Which tools do you use today? (pick any)</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TOOL_CATS.map((t) => (
                <label key={t} style={{ ...BTN, display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={f.tools.includes(t)} onChange={() => toggleTool(t)} />
                  {TOOL_LABEL[t]}
                </label>
              ))}
            </div>
            <p style={HINT}>Categories only. You never need to name a product.</p>
          </div>
          <div style={{ marginTop: 16 }}>
            <span style={LABEL}>What would you prefer?</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {APPETITE.map((a) => (
                <label key={a} style={{ ...BTN, display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                  <input type="radio" name="appetite" checked={f.appetite === a} onChange={() => set("appetite", a)} />
                  {APPETITE_LABEL[a]}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        {f.wfs.map((w, i) => (
          <fieldset key={i} style={{ ...CARD, margin: "0 0 18px" }}>
            <legend style={{ ...H3, padding: "0 8px" }}>{i + 2}. TASK {i + 1}: WHAT TAKES MORE OF YOUR WEEK THAN IT SHOULD?</legend>
            <div style={GRID}>
              <Field label="Describe the task in a few words" hint="Example below. Use your own words.">
                <input style={INPUT} maxLength={80} value={w.name} onChange={(e) => setWf(i, { name: e.target.value })} autoComplete="off" list={`shapes-${i}`} />
                <datalist id={`shapes-${i}`}>{(SHAPES[f.industry] ?? SHAPES.other).map((s) => <option key={s} value={s} />)}</datalist>
              </Field>
              <Field label="What sort of work is it?">
                <select style={INPUT} value={w.category} onChange={(e) => setWf(i, { category: e.target.value })}>
                  <option value="">Choose one</option>
                  {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
              <Field label="How many times a week?" hint="A rough number is fine.">
                <input style={INPUT} type="number" inputMode="decimal" min={0} max={5000} disabled={w.unknown} value={w.n} onChange={(e) => setWf(i, { n: e.target.value })} />
              </Field>
              <Field label="Active minutes each time?" hint="Hands-on time only, not waiting.">
                <input style={INPUT} type="number" inputMode="decimal" min={0} max={600} disabled={w.unknown} value={w.t0} onChange={(e) => setWf(i, { t0: e.target.value })} />
              </Field>
            </div>
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", margin: "12px 0", color: "var(--ice)" }}>
              <input type="checkbox" checked={w.unknown} onChange={(e) => setWf(i, { unknown: e.target.checked })} />
              I do not know these two numbers yet (you will get a small measuring exercise instead of a guess)
            </label>
            <details>
              <summary style={{ color: "var(--ice)", cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>
                Optional detail: rework, waiting, handoffs (sharpens the seven dimensions)
              </summary>
              <div style={{ ...GRID, marginTop: 12 }}>
                <Field label="Jobs needing a redo or correction (%)"><input style={INPUT} type="number" min={0} max={100} value={w.reworkPct} onChange={(e) => setWf(i, { reworkPct: e.target.value })} /></Field>
                <Field label="Minutes a redo takes"><input style={INPUT} type="number" min={0} max={600} value={w.reworkMin} onChange={(e) => setWf(i, { reworkMin: e.target.value })} /></Field>
                <Field label="Hours a job waits on others" hint="Elapsed time. Kept apart from staff hours."><input style={INPUT} type="number" min={0} max={720} value={w.wait} onChange={(e) => setWf(i, { wait: e.target.value })} /></Field>
                <Field label="Handoffs between people"><input style={INPUT} type="number" min={0} max={20} value={w.handoffs} onChange={(e) => setWf(i, { handoffs: e.target.value })} /></Field>
                <Field label="Other places the same detail is typed"><input style={INPUT} type="number" min={0} max={10} value={w.retyped} onChange={(e) => setWf(i, { retyped: e.target.value })} /></Field>
                <Field label="Odd cases that need special handling (%)"><input style={INPUT} type="number" min={0} max={100} value={w.odd} onChange={(e) => setWf(i, { odd: e.target.value })} /></Field>
                <Field label="Steps from start to finish"><input style={INPUT} type="number" min={1} max={50} value={w.steps} onChange={(e) => setWf(i, { steps: e.target.value })} /></Field>
                <Field label="Can you see where each job is?">
                  <select style={INPUT} value={w.visibility} onChange={(e) => setWf(i, { visibility: e.target.value })}>
                    <option value="clear">Yes, clearly</option><option value="patchy">Partly</option><option value="blind">Not really</option>
                  </select>
                </Field>
                <Field label="How sure are these numbers?">
                  <select style={INPUT} value={w.certainty} onChange={(e) => setWf(i, { certainty: e.target.value })}>
                    <option value="measured_recently">Measured recently</option><option value="rough_estimate">Rough estimate</option>
                  </select>
                </Field>
              </div>
            </details>
            {f.wfs.length > 1 && (
              <button type="button" style={{ ...BTN, marginTop: 12 }} onClick={() => set("wfs", f.wfs.filter((_, j) => j !== i))}>Remove this task</button>
            )}
          </fieldset>
        ))}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          {f.wfs.length < 5 && <button type="button" style={BTN} onClick={() => set("wfs", [...f.wfs, blankWf()])}>Add another task (up to 5)</button>}
          <button type="submit" style={BTN_PRIMARY}>Show my X-Ray</button>
        </div>
      </form>

      <div aria-live="polite">
        {shown && error && <p role="alert" style={{ ...P, color: "var(--gold)" }}>Still needed: {error}.</p>}
        {shown && report && <Result report={report} onPdf={downloadPdf} onJson={downloadJson} />}
      </div>
    </div>
  );
}

function Result({ report, onPdf, onJson }: { report: Report; onPdf: () => void; onJson: () => void }) {
  const wfs = report.workflows as Report[];
  return (
    <section aria-label="Your X-Ray" style={{ marginTop: 24 }}>
      <div style={{ ...CARD, borderColor: "var(--gold)" }}>
        <h2 style={H3}>{report.synthetic ? "SYNTHETIC DEMO RESULT" : "YOUR RESULT"}</h2>
        <p style={{ ...P, fontWeight: 700 }}>{report.banner}</p>
        <p style={P}>{report.executive_summary}</p>
        {report.totals && (
          <p style={P}>
            All scored tasks together, low / base / high: {g(dispHours(report.totals.low))} / {g(dispHours(report.totals.base))} /{" "}
            {g(dispHours(report.totals.high))} hours a week (ESTIMATE). {report.totals_note}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" style={BTN_PRIMARY} onClick={onPdf}>Download the PDF</button>
          <button type="button" style={BTN} onClick={onJson}>Download the data (JSON)</button>
        </div>
        <p style={HINT}>The PDF is built in this tab. Every page says ESTIMATE, not measured{report.synthetic ? " and SYNTHETIC DEMO" : ""}. No email is asked for.</p>
      </div>

      {wfs.map((w) => (
        <article key={w.id} style={CARD}>
          <h3 style={H3}>{w.id}: {w.name}</h3>
          {w.status !== "SCORED" ? (
            <>
              <p style={P}>{w.hypothesis}</p>
              <p style={P}><strong>Measure first:</strong> {w.measurement}</p>
            </>
          ) : (
            <>
              <p style={P}>{w.hypothesis} <em>It would be wrong if {w.falsify}.</em></p>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
                <caption style={{ ...HINT, textAlign: "left", marginBottom: 6 }}>Seven dimensions, shown separately and never as one score</caption>
                <tbody>
                  {DIMENSIONS.map((d) => (
                    <tr key={d} style={{ borderBottom: "1px solid var(--border)" }}>
                      <th scope="row" style={{ textAlign: "left", padding: "8px 8px 8px 0", color: "var(--ice)", fontSize: 13, whiteSpace: "nowrap" }}>{DIM_LABEL[d]}</th>
                      <td style={{ padding: "8px 8px 8px 0" }}><Level lvl={w.dimensions[d].level} /></td>
                      <td style={{ padding: "8px 0", color: "var(--dim)", fontSize: 13 }}>{w.dimensions[d].basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ ...P, color: "var(--gold)" }}><strong>Weekly capacity scenarios (ESTIMATE, not measured)</strong></p>
              <ul style={{ ...P, paddingLeft: 22 }}>
                {w.scenarios.map((s: Report) => (
                  <li key={s.scenario}>
                    {s.scenario.toUpperCase()}: about {g(s.hours_display)} hours a week (time cut ASSUMED {Math.round(s.reduction_assumed * 100)}%, adoption ASSUMED {s.adoption_assumed}, upkeep ASSUMED {s.overhead_min_assumed} min a week).
                  </li>
                ))}
              </ul>
              <p style={HINT}>You reported {g(w.queue_hours_elapsed)} elapsed hours of waiting per job. That is queue time, not staff time, and it is not added to the hours above. Capacity freed is not cash saved.</p>
              <p style={{ ...P, color: "var(--gold)", marginTop: 14 }}><strong>Three ways forward, equal weight</strong></p>
              <ol style={{ ...P, paddingLeft: 22 }}>
                <li><strong>Free, do it yourself:</strong><ul>{w.classes.FREE_DIY.map((x: string) => <li key={x}>{x}</li>)}</ul></li>
                <li><strong>Existing software:</strong> {w.classes.EXISTING_SOFTWARE}</li>
                <li><strong>Optional TITANOS:</strong> {w.classes.OPTIONAL_TITANOS}</li>
              </ol>
              {w.do_nothing_reasonable && <p style={P}><strong>Doing nothing is a reasonable choice here:</strong> the base case is under one hour a week.</p>}
              <p style={HINT}>Readiness: {w.feasibility.level} ({w.feasibility.why}). {w.risk.note}</p>
              <p style={P}><strong>Seven-day test:</strong> {w.experiment_7_day.protocol} {w.experiment_7_day.decision}</p>
            </>
          )}
        </article>
      ))}

      {report.monday_plan.length > 0 && (
        <div style={CARD}>
          <h3 style={H3}>MONDAY MORNING PLAN</h3>
          <ol style={{ ...P, paddingLeft: 22 }}>
            {report.monday_plan.map((m: Report, i: number) => (
              <li key={i}>{m.action} ({m.workflow}). Owner: {m.owner}. About {m.time_needed_min} minutes. Check: {m.success_metric}.</li>
            ))}
          </ol>
        </div>
      )}

      <div style={CARD}>
        <h3 style={H3}>HOW THIS WAS WORKED OUT</h3>
        <p style={P}>Formula: <code>{report.method.formula}</code></p>
        <p style={P}>Fictional worked example: {report.method.worked_example_fictional}.</p>
        <ul style={{ ...P, paddingLeft: 22 }}>{report.method.statements.map((s: string) => <li key={s}>{s}</li>)}</ul>
        <ul style={{ ...P, paddingLeft: 22 }}>{report.limitations.map((s: string) => <li key={s}>{s}</li>)}</ul>
      </div>
    </section>
  );
}
