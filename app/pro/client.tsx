"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { browserApi, signedIn, errorText, ApiError } from "@/lib/portal";
import { PRO_ERRORS, STATUS_LABEL, aud, claimJob, deliverJob, getBoard, getMyJobs, getPayouts, getRank, joinPro, refreshOnboarding, rescanJob, startOnboarding, disputeJob, type BoardJob, type PayoutsView, type ProJob, type RankView } from "@/lib/pro";

const card = { background: "var(--surface, #111)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column" as const, gap: 10 };
const btn = { padding: "12px 16px", background: "var(--gold)", color: "#000", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", minHeight: 44 };
const ghost = { ...btn, background: "transparent", color: "var(--gold)", border: "1px solid var(--gold)" };
const msgOf = (e: unknown) => (e instanceof ApiError && PRO_ERRORS[e.code]) || errorText(e);

// The Pro seat: job board, my jobs, rank (proven fixes only), payouts (only after a re-scan).
export default function ProClient() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [joined, setJoined] = useState<boolean | null>(null);
  const [board, setBoard] = useState<BoardJob[]>([]);
  const [onboarded, setOnboarded] = useState(false);
  const [mine, setMine] = useState<ProJob[]>([]);
  const [rank, setRank] = useState<RankView | null>(null);
  const [pay, setPay] = useState<PayoutsView | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [display, setDisplay] = useState("");
  const [ok, setOk] = useState(false);

  const run = useCallback(async (fn: () => Promise<void>) => { setBusy(true); setMsg(""); try { await fn(); } catch (e) { setMsg(msgOf(e)); } finally { setBusy(false); } }, []);
  const load = useCallback(async () => {
    const api = browserApi();
    try {
      const b = await getBoard(api); setJoined(true); setBoard(b.jobs); setOnboarded(b.onboarded);
      const [j, r, p] = await Promise.all([getMyJobs(api), getRank(api), getPayouts(api)]); setMine(j.asPro); setRank(r); setPay(p);
    } catch (e) { if (e instanceof ApiError && e.code === "pro_seat_required") setJoined(false); else throw e; }
  }, []);
  useEffect(() => { const s = signedIn(browserApi()); setAuthed(s); if (s) run(load); }, [run, load]);

  if (authed === false) return <main style={{ padding: "60px 20px", maxWidth: 640, margin: "0 auto" }}><h1>Pro seat</h1><p><Link href="/app/login">Sign in</Link> to see hand-raised jobs and your rank.</p></main>;
  if (joined === false) return (
    <main style={{ padding: "60px 20px", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <h1>Join as a pro</h1>
      <p>Owners press &quot;get this fixed&quot; with the scan evidence attached. You claim the job, fix it, and we re-scan. You are paid only after the re-scan shows the fault gone. Your rank counts proven fixes only. Reviews do not exist here.</p>
      <label>Display name <input value={display} onChange={(e) => setDisplay(e.target.value)} maxLength={40} style={{ minHeight: 44 }} /></label>
      <p style={{ margin: 0 }}>Claim fee AU$29 to AU$149 by size. A Pro seat (EXAMPLE AU$149 a month, billed separately) halves it while the seat is paid up; joining here never changes your fee.</p>
      <label><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I accept the <Link href="/terms">terms</Link> and that payment follows proof.</label>
      {msg && <p role="status" style={{ color: "var(--ice)" }}>{msg}</p>}
      <button type="button" style={btn} disabled={busy || !ok} onClick={() => run(async () => { await joinPro(browserApi(), display); await load(); })}>JOIN THE PRO SEAT</button>
    </main>
  );

  return (
    <main style={{ padding: "40px 20px 80px", maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <h1 style={{ margin: 0 }}>Pro seat</h1>
      {msg && <p role="status" style={{ color: "var(--ice)", margin: 0 }}>{msg}</p>}
      {!onboarded && (
        <section style={card} aria-label="Payout setup">
          <strong>Set up payouts</strong>
          <small>Payouts go through Stripe Connect to your own account. You need this before you can claim a job, so we never owe you money we cannot send.</small>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" style={btn} disabled={busy} onClick={() => run(async () => { const r = await startOnboarding(browserApi()); window.location.href = r.url; })}>SET UP PAYOUTS</button>
            <button type="button" style={ghost} disabled={busy} onClick={() => run(async () => { await refreshOnboarding(browserApi()); await load(); })}>I FINISHED SETUP</button>
          </div>
        </section>
      )}
      {rank && (
        <section style={card} aria-label="My rank">
          <strong style={{ fontSize: "var(--fs-h3, 1.4rem)" }}>{rank.display}: {rank.tier}, {rank.points} points</strong>
          <small>{rank.provenFixes} proven fixes, {rank.holding} still holding, {rank.regressed} came back{rank.holdRate !== null ? `, hold rate ${rank.holdRate}%` : ""}. {rank.note}</small>
        </section>
      )}
      <section style={card} aria-label="Job board">
        <h2 style={{ margin: 0 }}>Job board</h2>
        {!board.length && <p style={{ margin: 0 }}>No open jobs right now. Every job here was raised by a verified owner, with the scan attached.</p>}
        {board.map((j) => (
          <div key={j.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            <strong>{j.check} on {j.domainMasked}</strong> <small>({j.severity === "FAIL" ? "important" : "improvement"}, {j.tier})</small>
            <p style={{ margin: "6px 0" }}>You are paid {aud(j.payCents)} after the re-scan confirms the fix. Claim fee {aud(j.claimFeeCents)}. {j.note}</p>
            <button type="button" style={btn} disabled={busy || !onboarded} onClick={() => run(async () => { await claimJob(browserApi(), j.id); await load(); })}>CLAIM THIS JOB</button>
          </div>
        ))}
      </section>
      <section style={card} aria-label="My jobs">
        <h2 style={{ margin: 0 }}>My jobs</h2>
        {!mine.length && <p style={{ margin: 0 }}>No jobs yet.</p>}
        {mine.map((j) => (
          <div key={j.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <strong>{j.check} on {j.domain}: {STATUS_LABEL[j.status] ?? j.status}</strong>
            {j.lastRescan && <small>Last re-scan: {j.lastRescan.status}. {j.lastRescan.detail}</small>}
            {j.proof && <small>Proof: re-scan {j.proof.scanId} shows the fault gone.</small>}
            {j.status === "claimed" && (<>
              <input aria-label="What you changed" placeholder="What you changed" value={note[j.id] ?? ""} onChange={(e) => setNote({ ...note, [j.id]: e.target.value })} style={{ minHeight: 44 }} />
              <button type="button" style={btn} disabled={busy} onClick={() => run(async () => { const r = await deliverJob(browserApi(), j.id, note[j.id] ?? ""); setMsg(r.reproved ? "Re-scan confirmed the fix. Payout started." : "We re-scanned and the fault is still showing. DNS can take a few minutes. Try the re-scan again shortly."); await load(); })}>I FIXED IT, RE-SCAN NOW</button>
            </>)}
            {j.status === "delivered" && <button type="button" style={ghost} disabled={busy} onClick={() => run(async () => { await rescanJob(browserApi(), j.id); await load(); })}>RE-SCAN AGAIN</button>}
            {(j.status === "claimed" || j.status === "delivered") && <button type="button" style={ghost} disabled={busy} onClick={() => run(async () => { await disputeJob(browserApi(), j.id, note[j.id] || "Raised from the pro page"); await load(); })}>RAISE A DISPUTE</button>}
          </div>
        ))}
      </section>
      {pay && (
        <section style={card} aria-label="Payouts">
          <h2 style={{ margin: 0 }}>Payouts</h2>
          <small>Paid {aud(pay.paidCents)}. Waiting for proof {aud(pay.waitingForProofCents)}. Held for review {aud(pay.pendingReviewCents)}. Frozen by a dispute {aud(pay.frozenByDisputeCents)}. {pay.rule}</small>
          {pay.paid.map((p) => <small key={p.jobId}>{p.domain}: {aud(p.amountCents)}</small>)}
        </section>
      )}
    </main>
  );
}
