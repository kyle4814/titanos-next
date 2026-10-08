"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import Link from "next/link";
import { SENTENCE, verifyAndRecord, type Verdict } from "@/lib/tix";
import { useTix } from "@/components/tix/useTix";
import { BTN, CARD, H2, INPUT, MUTED } from "@/components/tix/ui";

const COLOUR: Record<string, string> = { ADMIT: "#0f7a3a", DUPLICATE: "#b36b00", EXPIRED: "#8a6d00", FAKE: "#a11a1a" };

export default function Scanner() {
  const { st, ready, commit, reset } = useTix();
  const video = useRef<HTMLVideoElement>(null);
  const work = useRef<HTMLCanvasElement>(null);
  const busy = useRef(false);
  const lastTok = useRef({ t: "", at: 0 });
  const [cam, setCam] = useState<"off" | "on" | "error">("off");
  const [camMsg, setCamMsg] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [manual, setManual] = useState("");

  const check = useCallback(async (tok: string) => {
    if (!st || busy.current) return;
    const t = Date.now();
    if (tok === lastTok.current.t && t - lastTok.current.at < 3000) return; // same frame burst
    busy.current = true;
    lastTok.current = { t: tok, at: t };
    try {
      setVerdict(await verifyAndRecord(st, tok, t));
      commit();
    } finally {
      busy.current = false;
    }
  }, [st, commit]);

  const stream = useRef<MediaStream | null>(null);
  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      stream.current = s;
      if (video.current) { video.current.srcObject = s; await video.current.play(); }
      setCam("on");
    } catch (e) {
      setCam("error");
      setCamMsg(e instanceof Error ? e.message : "Camera unavailable");
    }
  };
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  useEffect(() => {
    if (cam !== "on") return;
    let raf = 0;
    const tick = () => {
      const v = video.current, c = work.current;
      if (v && c && v.readyState >= 2 && v.videoWidth) {
        const w = 480, h = Math.round((480 * v.videoHeight) / v.videoWidth);
        c.width = w; c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(v, 0, 0, w, h);
        const hit = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
        if (hit?.data) check(hit.data);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cam, check]);

  if (!ready || !st) return <p>Loading demo...</p>;

  return (
    <div>
      <h1 style={{ ...H2, fontSize: 26 }}>Gate scanner</h1>
      <section style={CARD}>
        <video ref={video} playsInline muted style={{ width: "100%", borderRadius: 8, background: "#000", display: cam === "on" ? "block" : "none" }} />
        <canvas ref={work} style={{ display: "none" }} />
        {cam !== "on" && <button style={BTN} onClick={start}>Start camera</button>}
        {cam === "error" && <p role="alert" style={{ marginTop: 10 }}>Camera not available ({camMsg}). Use the paste box below.</p>}
        {st.events.length === 0
          ? <p role="status" data-testid="unpaired" style={MUTED}>Not paired yet. On the computer open the <Link href="/demo/tix/organiser" style={{ color: "var(--gold)" }}>organiser page</Link>, create an event and show the pairing code, then open it with this phone camera.</p>
          : <p data-testid="paired" style={MUTED}>Paired for: <b>{st.events[0].name}</b>. Point the camera at a fan wallet QR.</p>}
      </section>

      <section data-testid="verdict" style={{ ...CARD, textAlign: "center", background: verdict ? COLOUR[verdict.result] : "#0b0b0b", minHeight: 120 }}>
        {verdict ? (
          <>
            <div style={{ fontSize: 44, fontWeight: 800, color: "#fff" }}>{verdict.result}</div>
            {verdict.ticket && <div style={{ color: "#fff" }}>{verdict.ticket.owner}</div>}
            {verdict.result === "DUPLICATE" && verdict.firstScanAt && <div style={{ color: "#fff" }}>First scanned at {new Date(verdict.firstScanAt).toLocaleTimeString()}</div>}
            <div data-testid="sentence" style={{ color: "#fff", fontSize: 15, marginTop: 6 }}>{SENTENCE[verdict.result]}</div>
          </>
        ) : <div style={MUTED}>Waiting for a scan.</div>}
      </section>

      <section style={CARD}>
        <h2 style={H2}>No camera? Paste a code</h2>
        <input style={INPUT} placeholder="TIX1...." value={manual} onChange={(e) => setManual(e.target.value)} aria-label="Ticket code" />
        <button style={BTN} onClick={() => { lastTok.current = { t: "", at: 0 }; check(manual); }}>Verify code</button>
      </section>
      <button style={{ ...BTN, background: "#222", color: "var(--ice)" }} onClick={() => { if (confirm("Clear scan history and pairing on this device?")) { setVerdict(null); lastTok.current = { t: "", at: 0 }; reset(); } }}>Reset scanner</button>
    </div>
  );
}
