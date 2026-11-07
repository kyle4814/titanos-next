"use client";

/**
 * C1 guest scan. No login, no card. Reads public DNS records for the domain from the
 * visitor's own browser over DNS-over-HTTPS and grades the email-security posture in
 * seconds. Code only: zero model calls. GET THIS FIXED shows the exact records and steps.
 * The domain never leaves the browser except as a public DNS lookup; the button event
 * carries only an event name, a path, a timestamp and an opaque random scan id (SiteAnalytics), never the domain.
 */
import { useEffect, useState, type FormEvent } from "react";
import { newScanId } from "@/lib/beacon";
import { runScan, dohFetch, type ScanResult } from "@/lib/guestscan/scan";
import { buildPlan, type FixPlan } from "@/lib/guestscan/fixes";

const COLOR = { PASS: "var(--ok)", WARN: "#f59e0b", FAIL: "#ef4444", UNKNOWN: "var(--dim)" } as const;

export default function GuestScan() {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<ScanResult | null>(null);
  const [plan, setPlan] = useState<FixPlan | null>(null);
  const [fixOpen, setFixOpen] = useState(false);
  // One opaque id per scan (beacon only; no domain, no personal data). nextId rides on "Check now";
  // when a scan starts it moves to resId (rides on GET THIS FIXED) and a fresh nextId is made.
  const [nextId, setNextId] = useState("");
  const [resId, setResId] = useState("");
  useEffect(() => { setNextId(newScanId()); }, []);

  const go = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr(""); setRes(null); setPlan(null); setFixOpen(false); setBusy(true);
    setResId(nextId); setNextId(newScanId());
    try {
      const r = await runScan(domain, dohFetch());
      setRes(r); setPlan(buildPlan(r));
    } catch (x) {
      setErr((x as Error).message === "invalid_domain" ? "That does not look like a domain. Try something like yourbusiness.com.au" : "The check could not run just now. Please try again in a minute.");
    } finally { setBusy(false); }
  };

  const open = plan && plan.steps.length > 0;
  return (
    <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }} id="instant">
      <form onSubmit={go} style={{ display: "flex", gap: 10, flexWrap: "wrap" }} aria-label="Instant email security check">
        <input
          value={domain} onChange={(e) => setDomain(e.target.value)} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder="yourbusiness.com.au" aria-label="Your domain" required
          style={{ flex: "1 1 220px", minHeight: 48, padding: "0 14px", fontSize: 16, borderRadius: "var(--radius-md)", border: "1px solid rgb(var(--gold-rgb) / 0.3)", background: "transparent", color: "inherit" }}
        />
        <button type="submit" disabled={busy} data-analytics="scan-instant-run" data-scan-id={nextId || undefined} style={{ minHeight: 48, padding: "0 22px", borderRadius: "var(--radius-md)", border: "1px solid rgb(var(--gold-rgb) / 0.6)", background: "rgb(var(--gold-rgb) / 0.12)", color: "inherit", cursor: "pointer" }}>
          {busy ? "Checking..." : "Check now"}
        </button>
      </form>
      <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 10 }}>
        Public DNS records only. Nothing on your servers is touched. No login, no card, no model involved: the same check every time.
      </p>
      {err && <p role="alert" style={{ color: COLOR.FAIL, marginTop: 12 }}>{err}</p>}
      {res && (
        <div aria-live="polite" style={{ marginTop: 20 }}>
          <p style={{ fontSize: "var(--fs-lg)", margin: 0 }}>
            <strong>{res.domain}</strong>: grade <strong>{res.grade}</strong>{res.score >= 0 ? ` (${res.score}/100)` : " (could not read your records just now)"}
            <span style={{ color: "var(--dim)", fontSize: "var(--fs-sm)" }}> · {(res.elapsedMs / 1000).toFixed(1)} s</span>
          </p>
          <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
            {res.findings.map((f) => (
              <li key={f.check} style={{ padding: "8px 0", borderTop: "1px solid rgb(var(--gold-rgb) / 0.12)" }}>
                <span style={{ color: COLOR[f.status], fontWeight: 600 }}>{f.status}</span> <strong>{f.check}</strong>
                <div style={{ color: "var(--dim)", fontSize: "var(--fs-sm)" }}>{f.detail}</div>
              </li>
            ))}
          </ul>
          {open ? (
            <>
              <button type="button" onClick={() => setFixOpen((v) => !v)} aria-expanded={fixOpen} data-analytics="scan-get-fixed" data-scan-id={resId || undefined}
                style={{ minHeight: 52, width: "100%", marginTop: 12, borderRadius: "var(--radius-md)", border: "1px solid rgb(var(--gold-rgb) / 0.8)", background: "rgb(var(--gold-rgb) / 0.18)", color: "inherit", fontSize: 17, fontWeight: 700, cursor: "pointer" }}>
                GET THIS FIXED
              </button>
              {fixOpen && plan && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ margin: 0 }}>
                    {plan.steps.length} fix{plan.steps.length === 1 ? "" : "es"}, ready to apply. By hand that is about {Math.round(plan.minutesByHand / 6) / 10} hours; with these steps about {plan.minutesWithPlan} minutes.
                    <span style={{ color: "var(--dim)", fontSize: "var(--fs-sm)" }}> (Estimates.)</span>
                  </p>
                  <ol style={{ paddingLeft: 20, marginTop: 12 }}>
                    {plan.steps.map((s) => (
                      <li key={s.check} style={{ marginBottom: 16 }}>
                        <strong>{s.title}</strong> <span style={{ color: COLOR[s.severity] }}>{s.severity}</span>
                        {s.record && <pre style={{ overflowX: "auto", fontSize: 13, margin: "8px 0", padding: 10, background: "rgb(var(--gold-rgb) / 0.06)" }}>{`${s.record.type}  ${s.record.host}\n${s.record.value}`}</pre>}
                        <ul style={{ margin: "6px 0" }}>{s.steps.map((t, i) => <li key={i}>{t}</li>)}</ul>
                        <code style={{ fontSize: 13 }}>Check it: {s.verify}</code>
                      </li>
                    ))}
                  </ol>
                  <p>Rather have it done for you? <a href="#request">Ask for a personally reviewed full scan and fix help</a>. No pressure, a no is welcome.</p>
                </div>
              )}
            </>
          ) : res.score >= 0 ? <p style={{ marginTop: 12 }}>Nothing to fix on these checks. Nicely done.</p> : null}
        </div>
      )}
    </div>
  );
}
