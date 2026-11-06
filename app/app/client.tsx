"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { browserApi, signedIn, errorText, ApiError } from "@/lib/portal";
import { FIX_RESULT_TEXT, OWNER_ERRORS, STATE_LABEL, badgeLine, getOverview, hoursLine, levelBar, listOwnerDomains, oneTapFix, reportMarkdown, rescan, undoFix, type DomainRow, type OwnerOverview } from "@/lib/owner";

const card = { background: "var(--surface, #111)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column" as const, gap: 10 };
const btn = { padding: "12px 16px", background: "var(--gold)", color: "#000", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", minHeight: 44 };
const ghost = { ...btn, background: "transparent", color: "var(--gold)", border: "1px solid var(--gold)" };
const when = (t: number) => new Date(t).toISOString().slice(0, 16).replace("T", " ") + " UTC";
const msgOf = (e: unknown) => (e instanceof ApiError && OWNER_ERRORS[e.code]) || errorText(e);

// The owner seat: My Level, Findings (with proof state), Quests (one tap), Monitor, Reports, hours given back.
export default function OwnerClient() {
  const [domains, setDomains] = useState<DomainRow[] | null>(null);
  const [id, setId] = useState("");
  const [o, setO] = useState<OwnerOverview | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState("");
  const [lastFix, setLastFix] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true); setMsg("");
    try { await fn(); } catch (e) { setMsg(msgOf(e)); } finally { setBusy(false); }
  }, []);
  useEffect(() => {
    const ok = signedIn(browserApi()); setAuthed(ok);
    if (ok) run(async () => { const r = await listOwnerDomains(browserApi()); setDomains(r.domains); if (r.domains[0]) setId(r.domains[0].id); });
  }, [run]);
  useEffect(() => { if (id) run(async () => setO(await getOverview(browserApi(), id))); }, [id, run]);

  if (authed === false) return <main style={{ padding: "60px 20px", maxWidth: 640, margin: "0 auto" }}><h1>My Level</h1><p><Link href="/app/login">Sign in</Link> to see your Business Level, findings and fixes.</p></main>;
  if (domains && !domains.length) return <main style={{ padding: "60px 20px", maxWidth: 640, margin: "0 auto" }}><h1>My Level</h1><p>No verified domain yet. <Link href="/order/monitor">Verify your domain</Link> to start. Verifying proves the site is yours, so nobody else can look at it as you.</p></main>;

  const fix = (check: string) => run(async () => { const r = await oneTapFix(browserApi(), id, check); setO(r.overview); setLastFix(r.fixId && (r.result === "proven" || r.result === "partial") ? r.fixId : null); setMsg(FIX_RESULT_TEXT[r.result] ?? r.detail); });

  return (
    <main style={{ padding: "40px 20px 80px", maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <h1 style={{ margin: 0 }}>My Level</h1>
      {domains && domains.length > 1 && (
        <label>Domain <select value={id} onChange={(e) => setId(e.target.value)} style={{ minHeight: 44 }}>{domains.map((d) => <option key={d.id} value={d.id}>{d.domain}</option>)}</select></label>
      )}
      {msg && <p role="status" style={{ color: "var(--ice)", margin: 0 }}>{msg}</p>}
      {o && (<>
        <section style={card} aria-label="Business Level">
          <strong style={{ fontSize: "var(--fs-h3, 1.4rem)" }}>{o.domain}: Level {o.level} of 10, {o.levelName}</strong>
          <div role="img" aria-label={`Level ${o.level} of 10`} style={{ display: "flex", gap: 4 }}>{levelBar(o.level).map((on, i) => <span key={i} style={{ flex: 1, height: 10, borderRadius: 3, background: on ? "var(--gold)" : "var(--border)" }} />)}</div>
          {o.next && <small>Next, Level {o.next.level} ({o.next.name}): {o.next.why}.</small>}
          <small>{badgeLine(o)}. {hoursLine(o.hours)}. {o.xp} points earned from proven fixes.</small>
          <small>{o.lastScan ? `Last scan ${when(o.lastScan.at)}, grade ${o.lastScan.grade}.` : "No scan yet."} We read public DNS records only and touch nothing on your servers.</small>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" style={btn} disabled={busy} onClick={() => run(async () => setO(await rescan(browserApi(), id)))}>RE-SCAN NOW</button>
            <button type="button" style={ghost} disabled={busy} onClick={() => run(async () => setReport(await reportMarkdown(browserApi(), id)))}>SHOW MY REPORT</button>
          </div>
        </section>

        <section style={card} aria-label="Quests">
          <h2 style={{ margin: 0 }}>Quests</h2>
          {!o.quests.open.length && <p style={{ margin: 0 }}>Nothing open. Every control we check is passing.</p>}
          {o.quests.open.map((q) => (
            <div key={q.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
              <strong>{q.title}</strong> <small>({q.severity === "FAIL" ? "important" : "improvement"}, {q.xp} points, about {q.minutesWithPlan} min with our plan instead of {q.minutesByHand} by hand; MODELLED)</small>
              <p style={{ margin: "6px 0" }}>{q.evidence}</p>
              {q.kind === "auto"
                ? <button type="button" style={btn} disabled={busy} onClick={() => fix(q.check)}>FIX IT FOR ME (UNDOABLE)</button>
                : <small>Guided: follow the steps on <Link href="/scan">the scan page</Link> or ask for a pro. We do not guess records only your provider knows.</small>}
            </div>
          ))}
          {lastFix && <button type="button" style={ghost} disabled={busy} onClick={() => run(async () => { setO(await undoFix(browserApi(), id, lastFix)); setLastFix(null); setMsg("Undone. The exact previous records are back."); })}>UNDO THE LAST CHANGE</button>}
        </section>

        <section style={card} aria-label="Findings">
          <h2 style={{ margin: 0 }}>Findings and proof</h2>
          {o.findings.map((f) => (
            <div key={f.check} style={{ display: "flex", gap: 12, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
              <strong style={{ minWidth: 80 }}>{f.check}</strong>
              <span style={{ color: f.state === "REGRESSED" ? "#f87171" : f.state === "OPEN" ? "var(--gold)" : "#4ade80" }}>{STATE_LABEL[f.state]}{f.unreadable ? " (last scan could not read it)" : ""}</span>
              <small style={{ flexBasis: "100%", wordBreak: "break-word" }}>{f.detail}</small>
            </div>
          ))}
        </section>

        <section style={card} aria-label="Monitor">
          <h2 style={{ margin: 0 }}>Stays-fixed monitor</h2>
          <p style={{ margin: 0 }}>{o.monitor.active ? "On. We re-scan every day and tell you the moment a fix stops holding." : "Off. You can re-scan by hand any time. The monitor re-scans daily and emails you if a fix stops holding."} {!o.monitor.active && <Link href="/order/monitor">Turn on the monitor</Link>}</p>
          {o.events.slice(0, 8).map((e, i) => <small key={i}>{when(e.at)}: {e.detail}</small>)}
        </section>

        {report && <section style={card} aria-label="Report"><h2 style={{ margin: 0 }}>Report</h2><pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{report}</pre></section>}
      </>)}
    </main>
  );
}
