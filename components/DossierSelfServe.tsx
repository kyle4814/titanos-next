"use client";

/**
 * C8 self-serve dossier request. States: idle, awaiting_txt, verified, queued, ready.
 * Runs on the in-memory adapter (preview): no network, no model, no live scan. The ownership gate is a
 * DNS TXT record, the same shape as the portal's. Output is a synthetic, labelled sample.
 */
import { useMemo, useRef, useState, type FormEvent } from "react";
import { memoryAdapter, DossierError, ERROR_COPY, type DossierRequest, type SyntheticDossier, type DossierAdapter } from "@/lib/dossier-selfserve/core";

// Preview resolver: the record "appears" on the second check, so every state can be walked through.
function previewAdapter(): DossierAdapter {
  const seen = new Map<string, number>();
  return memoryAdapter({
    resolver: { async txt(name) { const n = (seen.get(name) ?? 0) + 1; seen.set(name, n); return n >= 2 ? ["titanos-verify=preview"] : []; } },
    newToken: () => "preview",
    readyAfterMs: 1500,
  });
}

export default function DossierSelfServe({ adapter }: { adapter?: DossierAdapter }) {
  const ad = useMemo(() => adapter ?? previewAdapter(), [adapter]);
  const [domain, setDomain] = useState("");
  const [req, setReq] = useState<DossierRequest | null>(null);
  const [out, setOut] = useState<SyntheticDossier | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setErr(""); setBusy(true);
    try { await fn(); } catch (x) { setErr(ERROR_COPY[(x instanceof DossierError ? x.code : "dns_lookup_failed")]); } finally { setBusy(false); }
  };
  const start = (e: FormEvent) => { e.preventDefault(); void run(async () => { setOut(null); setReq(await ad.start(domain)); }); };
  const verify = () => req && void run(async () => setReq(await ad.verify(req.id)));
  const queue = () => req && void run(async () => {
    const q = await ad.queue(req.id); setReq(q);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      const p = await ad.poll(q.id); setReq(p);
      if (p.phase === "ready") { if (timer.current) clearInterval(timer.current); setOut(await ad.result(p.id)); }
    }, 500);
  });

  const btn = { minHeight: 48, padding: "0 22px", borderRadius: "var(--radius-md)", border: "1px solid rgb(var(--gold-rgb) / 0.6)", background: "rgb(var(--gold-rgb) / 0.12)", color: "inherit", cursor: "pointer" } as const;
  return (
    <div id="dossiers" data-phase={req?.phase ?? "idle"} style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
      <form onSubmit={start} style={{ display: "flex", gap: 10, flexWrap: "wrap" }} aria-label="Request a dossier">
        <input value={domain} onChange={(e) => setDomain(e.target.value)} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder="yourbusiness.com.au" aria-label="Your domain" required disabled={!!req && req.phase !== "idle"}
          style={{ flex: "1 1 220px", minHeight: 48, padding: "0 14px", fontSize: 16, borderRadius: "var(--radius-md)", border: "1px solid rgb(var(--gold-rgb) / 0.3)", background: "transparent", color: "inherit" }} />
        <button type="submit" disabled={busy || !!req} style={btn}>Request a dossier</button>
      </form>
      <p style={{ fontSize: "var(--fs-sm)", color: "var(--dim)", marginTop: 10 }}>
        We only prepare a dossier for a domain you control, proved with one public DNS record. Public records only. Nothing on your servers is touched.
      </p>
      {err && <p role="alert" style={{ color: "#ef4444", marginTop: 12 }}>{err}</p>}
      {req?.phase === "awaiting_txt" && (
        <div aria-live="polite" style={{ marginTop: 16 }}>
          <p><strong>Step 1: prove you control {req.domain}.</strong> Add this TXT record at your DNS host:</p>
          <pre style={{ overflowX: "auto" }}>{`Name:  ${req.record.name}\nType:  TXT\nValue: ${req.record.value}`}</pre>
          <button type="button" onClick={verify} disabled={busy} style={btn}>{busy ? "Checking..." : "I have added it, check now"}</button>
        </div>
      )}
      {req?.phase === "verified" && (
        <div aria-live="polite" style={{ marginTop: 16 }}>
          <p><strong>{req.domain} is verified.</strong> Ready to queue your dossier.</p>
          <button type="button" onClick={queue} disabled={busy} style={btn}>Queue my dossier</button>
        </div>
      )}
      {req?.phase === "queued" && <p aria-live="polite" style={{ marginTop: 16 }}><strong>Queued.</strong> Your dossier for {req.domain} is being prepared.</p>}
      {req?.phase === "ready" && out && (
        <div aria-live="polite" style={{ marginTop: 16 }}>
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)" }}><strong>{out.label}</strong></p>
          <h3>Dossier for {out.domain}</h3>
          {out.sections.map((s) => <section key={s.heading}><h4>{s.heading}</h4><p>{s.body}</p></section>)}
        </div>
      )}
    </div>
  );
}
