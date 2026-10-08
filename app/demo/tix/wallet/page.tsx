"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { WINDOW_MS, checkResale, makeToken, ticketState } from "@/lib/tix";
import { qrRGBA } from "@/lib/tixQr";
import { useTix } from "@/components/tix/useTix";
import { BTN, CARD, H2, INPUT, MUTED } from "@/components/tix/ui";

function Wallet() {
  const { st, ready, commit } = useTix();
  const params = useSearchParams();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [now, setNow] = useState(0);
  const [token, setToken] = useState("");
  const [price, setPrice] = useState("");
  const [resaleMsg, setResaleMsg] = useState("");

  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, []);

  const wanted = params.get("t");
  const ticket = st ? st.tickets.find((t) => t.id === wanted) || st.tickets[st.tickets.length - 1] : undefined;
  const win = Math.floor(now / WINDOW_MS);

  useEffect(() => {
    if (!st || !ticket || !now) return;
    let dead = false;
    makeToken(st.key, ticket, now).then((tk) => {
      if (dead) return;
      setToken(tk);
      const c = canvas.current;
      if (!c) return;
      const q = qrRGBA(tk, 5, 3);
      c.width = q.width;
      c.height = q.height;
      c.getContext("2d")!.putImageData(new ImageData(q.data as Uint8ClampedArray<ArrayBuffer>, q.width, q.height), 0, 0);
    });
    return () => { dead = true; };
    // regenerate only when the 15 s window (or ticket) changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win, ticket?.id, st?.key]);

  if (!ready || !st) return <p>Loading demo...</p>;
  if (!ticket) {
    return <div style={CARD}><h2 style={H2}>No ticket yet</h2><p>Create an event and issue a ticket in the <Link href="/demo/tix" style={{ color: "var(--gold)" }}>organiser panel</Link>.</p></div>;
  }
  const ev = st.events.find((e) => e.id === ticket.eventId);
  const left = WINDOW_MS - (now % WINDOW_MS);
  const frac = left / WINDOW_MS;
  const state = ticketState(st, ticket.id);
  const R = 34, C = 2 * Math.PI * R;

  return (
    <div>
      <h1 style={{ ...H2, fontSize: 26 }}>Fan wallet</h1>
      <section style={{ ...CARD, textAlign: "center" }}>
        <div style={MUTED}>{ev?.name}</div>
        <div style={{ fontSize: 22, margin: "4px 0 10px" }}>{ticket.owner}</div>
        <span data-testid="state" style={{ display: "inline-block", padding: "4px 12px", borderRadius: 99, fontWeight: 700, background: state === "USED" ? "#5a1a1a" : "#12361f", color: state === "USED" ? "#ff9a9a" : "#7dffa8" }}>
          {state === "USED" ? "USED" : "VALID, LIVE"}
        </span>
        <div style={{ background: "#fff", padding: 10, borderRadius: 10, margin: "14px auto", width: "fit-content" }}>
          <canvas ref={canvas} aria-label="Rotating ticket QR code" style={{ width: 240, height: 240, imageRendering: "pixelated", display: "block" }} />
        </div>
        <svg width="80" height="80" viewBox="0 0 80 80" role="img" aria-label={`Code refreshes in ${Math.ceil(left / 1000)} seconds`}>
          <circle cx="40" cy="40" r={R} fill="none" stroke="#333" strokeWidth="6" />
          <circle cx="40" cy="40" r={R} fill="none" stroke="#d4af37" strokeWidth="6" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 40 40)" />
          <text x="40" y="46" textAnchor="middle" fill="#fff" fontSize="20" data-testid="countdown">{Math.ceil(left / 1000)}</text>
        </svg>
        <div style={MUTED}>New code every 15 seconds. A screenshot stops working.</div>
        <div data-testid="token" style={{ ...MUTED, fontSize: 11, wordBreak: "break-all", marginTop: 8 }}>{token}</div>
      </section>

      <section style={CARD}>
        <h2 style={H2}>List for resale</h2>
        <p style={MUTED}>Capped at {ev ? `$${(ev.resaleCapCents / 100).toFixed(2)}` : "n/a"} by the organiser. Demo only: nothing is sold.</p>
        <input style={INPUT} placeholder="Asking price ($)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Asking price" />
        <button style={BTN} onClick={() => {
          const r = checkResale(st, ticket.id, Math.round(parseFloat(price || "0") * 100), Date.now());
          setResaleMsg(r.ok ? "Allowed: at or under the cap." : `Blocked: over the organiser's cap of $${(r.capCents / 100).toFixed(2)}.`);
          commit();
        }}>Check price</button>
        {resaleMsg && <p role="status" style={{ marginTop: 10 }}>{resaleMsg}</p>}
      </section>
    </div>
  );
}

export default function WalletPage() {
  return <Suspense fallback={<p>Loading demo...</p>}><Wallet /></Suspense>;
}
