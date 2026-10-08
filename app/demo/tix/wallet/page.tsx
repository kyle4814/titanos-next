"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { WINDOW_MS, checkResale, makeToken, tamper, ticketState } from "@/lib/tix";
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
  const [copy, setCopy] = useState<{ tok: string; at: number } | null>(null);
  const [forged, setForged] = useState("");
  const copyCanvas = useRef<HTMLCanvasElement>(null);
  const forgedCanvas = useRef<HTMLCanvasElement>(null);
  const paint = (c: HTMLCanvasElement | null, text: string) => {
    if (!c) return;
    const q = qrRGBA(text, 4, 3);
    c.width = q.width;
    c.height = q.height;
    c.getContext("2d")!.putImageData(new ImageData(q.data as Uint8ClampedArray<ArrayBuffer>, q.width, q.height), 0, 0);
  };
  useEffect(() => { if (copy) paint(copyCanvas.current, copy.tok); }, [copy]);
  useEffect(() => { if (forged) paint(forgedCanvas.current, forged); }, [forged]);

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

      <section style={CARD} data-testid="cheat">
        <h2 style={H2}>Try to cheat it</h2>
        <p style={MUTED}><b>1. Screenshot.</b> Save a copy of the live code, wait until the countdown has run through two refreshes, then scan the copy: it is refused.</p>
        <button style={BTN} onClick={() => setCopy({ tok: token, at: Date.now() })}>Save a screenshot copy</button>
        {copy && (
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <div style={{ background: "#fff", padding: 8, borderRadius: 10, width: "fit-content", margin: "0 auto" }}>
              <canvas ref={copyCanvas} data-testid="copy-qr" aria-label="Screenshot copy of the ticket QR" style={{ width: 180, height: 180, imageRendering: "pixelated", display: "block" }} />
            </div>
            <div data-testid="copy-age" style={MUTED}>{now - copy.at >= 2 * WINDOW_MS ? "Stale now. Scan this copy: it should read EXPIRED." : `Wait ${Math.ceil((2 * WINDOW_MS - (now - copy.at)) / 1000)} s until this copy is stale, then scan it.`}</div>
          </div>
        )}
        <p style={{ ...MUTED, marginTop: 14 }}><b>2. Second entry.</b> Scan the live code above twice: the second scan reads DUPLICATE with the time of the first.</p>
        <p style={MUTED}><b>3. Forgery.</b> Show a code that has been altered by one character.</p>
        <button style={BTN} onClick={() => setForged(tamper(token))}>Show a forged code</button>
        {forged && (
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <div style={{ background: "#fff", padding: 8, borderRadius: 10, width: "fit-content", margin: "0 auto" }}>
              <canvas ref={forgedCanvas} data-testid="forged-qr" aria-label="Forged ticket QR" style={{ width: 180, height: 180, imageRendering: "pixelated", display: "block" }} />
            </div>
            <div style={MUTED}>Scan this one: it should read FAKE.</div>
          </div>
        )}
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
