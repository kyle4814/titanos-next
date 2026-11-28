"use client";

// Confirmation: reads the booking id from the URL hash (never sent to a server log), asks the API for the slot, offers the .ics.
import { useEffect, useState } from "react";
import { PORTAL, CONTACT, SITE } from "@/lib/config";
import "@/components/g4/g4.css";
import { parseConfirmedId, visitorTimeZone, BRISBANE_TZ } from "@/lib/booking-ui";

type Info = { id: string; name: string; startMs: number; endMs: number };
export default function Confirmed() {
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => {
    const id = parseConfirmedId(window.location.hash);
    if (!id) { setState("missing"); return; }
    fetch(`${PORTAL.API_BASE}/api/book/${id}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error("not_found")))).then((j: Info) => { setInfo(j); setState("ok"); }).catch(() => setState("missing"));
  }, []);
  const when = (tz: string) => info ? new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz, timeZoneName: "short" }).format(new Date(info.startMs)) : "";
  const tz = visitorTimeZone();
  return (
    <div className="g4"><div className="g4-book g4-confirm" aria-live="polite">
      {state === "loading" && <p>Checking your booking...</p>}
      {state === "missing" && (
        <p className="pe-card pe-card--pad">We could not find that booking. If you just booked, Kyle will still have your details. You can message him on <a href={CONTACT.TELEGRAM_URL}>Telegram {CONTACT.TELEGRAM_HANDLE}</a> or <a href={`mailto:${SITE.KYLE_EMAIL}`}>{SITE.KYLE_EMAIL}</a>.</p>
      )}
      {state === "ok" && info && (
        <div className="pe-card pe-card--gold pe-card--pad">
          <p className="g4-big">You are booked in, {info.name}.</p>
          <p style={{ margin: "0 0 4px" }}><strong>{when(tz)}</strong> (your time)</p>
          {tz !== BRISBANE_TZ && <p className="g4-mute" style={{ margin: "0 0 14px" }}>{when(BRISBANE_TZ)} (Brisbane time)</p>}
          <p style={{ margin: "14px 0 18px" }}>Kyle will call you at that time. Before the call he looks at your website and your industry, so the 20 minutes goes on your business and not on introductions.</p>
          <a href={`${PORTAL.API_BASE}/api/book/${info.id}/ics`} download="call-with-kyle.ics" className="pe-btn pe-btn--dark">Add to my calendar (.ics)</a>
          <p className="g4-mute" style={{ margin: "18px 0 0", fontSize: "var(--pe-fs-sm)" }}>Need to change the time? Message Kyle on <a href={CONTACT.TELEGRAM_URL}>Telegram {CONTACT.TELEGRAM_HANDLE}</a> or email <a href={`mailto:${SITE.KYLE_EMAIL}`}>{SITE.KYLE_EMAIL}</a>.</p>
        </div>
      )}
    </div></div>
  );
}
