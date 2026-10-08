"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createEvent, issueTicket, money, setResaleCap, exportPairing, ticketState } from "@/lib/tix";
import { useTix } from "@/components/tix/useTix";
import { qrRGBA } from "@/lib/tixQr";
import { BTN, CARD, H2, INPUT, MUTED } from "@/components/tix/ui";

export default function Organiser() {
  const { st, ready, commit, reset } = useTix();
  const [evName, setEvName] = useState("");
  const [cap, setCap] = useState("120");
  const [owner, setOwner] = useState("");
  const [evId, setEvId] = useState("");
  const [capEdit, setCapEdit] = useState("");
  const [pair, setPair] = useState("");
  const pairCanvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = pairCanvas.current;
    if (!pair || !c) return;
    const q = qrRGBA(pair, 3, 3);
    c.width = q.width;
    c.height = q.height;
    c.getContext("2d")!.putImageData(new ImageData(q.data as Uint8ClampedArray<ArrayBuffer>, q.width, q.height), 0, 0);
  }, [pair]);
  if (!ready || !st) return <p>Loading demo...</p>;
  const sel = evId || st.events[0]?.id || "";

  return (
    <div>
      <h1 style={{ ...H2, fontSize: 26 }}>Organiser panel</h1>
      <p style={MUTED}>One ticket, one real owner, one valid entry. Steps 1 to 3 here, then step 4 is scanning.</p>

      <section style={CARD}>
        <h2 style={H2}>1. Create an event</h2>
        <input style={INPUT} placeholder="Event name" value={evName} onChange={(e) => setEvName(e.target.value)} aria-label="Event name" />
        <input style={INPUT} placeholder="Resale price cap ($)" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} aria-label="Resale cap in dollars" />
        <button style={BTN} onClick={() => { const e = createEvent(st, evName, parseFloat(cap || "0") * 100, Date.now()); setEvId(e.id); setEvName(""); commit(); }}>Create event</button>
      </section>

      {st.events.length > 0 && (
        <section style={CARD}>
          <h2 style={H2}>2. Issue a ticket</h2>
          <select style={INPUT} value={sel} onChange={(e) => setEvId(e.target.value)} aria-label="Event">
            {st.events.map((e) => <option key={e.id} value={e.id}>{e.name} (cap {money(e.resaleCapCents)})</option>)}
          </select>
          <input style={INPUT} placeholder="Fan name" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Fan name" />
          <button style={BTN} onClick={() => { issueTicket(st, sel, owner, Date.now()); setOwner(""); commit(); }}>Issue ticket</button>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input style={{ ...INPUT, marginBottom: 0 }} placeholder="New cap ($)" inputMode="decimal" value={capEdit} onChange={(e) => setCapEdit(e.target.value)} aria-label="New resale cap" />
            <button style={{ ...BTN, width: "auto" }} onClick={() => { if (capEdit) { setResaleCap(st, sel, parseFloat(capEdit) * 100, Date.now()); setCapEdit(""); commit(); } }}>Set cap</button>
          </div>
        </section>
      )}

      {st.tickets.length > 0 && (
        <section style={CARD}>
          <h2 style={H2}>Tickets (open a wallet to show the moving QR)</h2>
          {st.tickets.map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--border)" }}>
              <span>{t.owner} <span style={MUTED}>{t.id}</span></span>
              <span><b>{ticketState(st, t.id)}</b> <Link href={`/demo/tix/wallet?t=${t.id}`} style={{ color: "var(--gold)" }}>wallet</Link></span>
            </div>
          ))}
        </section>
      )}

      {st.events.length > 0 && (
        <section style={CARD}>
          <h2 style={H2}>3. Pair your phone as the gate scanner</h2>
          <p style={MUTED}>Open your phone camera and point it at this code, then tap the link. The phone becomes the scanner for this event. The key travels in the link fragment and never touches a server.</p>
          <button style={BTN} onClick={() => setPair(`${location.origin}${location.pathname.replace(/organiser\/?$/, "")}scan#p=${exportPairing(st, sel)}`)}>Show pairing code</button>
          {pair && (
            <div data-testid="pair" style={{ marginTop: 12, textAlign: "center" }}>
              <div style={{ background: "#fff", padding: 8, borderRadius: 10, width: "fit-content", margin: "0 auto" }}>
                <canvas ref={pairCanvas} aria-label="Pairing QR code" style={{ width: 220, height: 220, imageRendering: "pixelated", display: "block" }} />
              </div>
              <textarea readOnly style={{ ...INPUT, marginTop: 10, height: 80, fontSize: 12 }} value={pair} aria-label="Pairing link" onFocus={(e) => e.currentTarget.select()} />
              <div style={MUTED}>No camera on the other device? Copy this link to it instead.</div>
            </div>
          )}
        </section>
      )}

      <section style={CARD}>
        <h2 style={H2}>Audit log</h2>
        {st.audit.length === 0 && <p style={MUTED}>Nothing yet.</p>}
        <div data-testid="audit" style={{ maxHeight: 260, overflow: "auto", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
          {[...st.audit].reverse().map((a, i) => (
            <div key={i} style={{ padding: "3px 0", borderTop: "1px solid var(--border)" }}>{new Date(a.at).toLocaleTimeString()} <b>{a.kind}</b> {a.detail}</div>
          ))}
        </div>
      </section>
      <button style={{ ...BTN, background: "#222", color: "var(--ice)" }} onClick={() => { if (confirm("Clear all demo data on this device?")) reset(); }}>Reset demo</button>
    </div>
  );
}
