"use client";

// Confirmation: reads the booking id from the URL hash (never sent to a server log), asks the API for the slot, offers the .ics.
import { useEffect, useState } from "react";
import { PORTAL, CONTACT, SITE } from "@/lib/config";
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
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px var(--space-12)", position: "relative", zIndex: 2, color: "var(--ice)", lineHeight: 1.7 }} aria-live="polite">
      {state === "loading" && <p>Checking your booking...</p>}
      {state === "missing" && (
        <p>We could not find that booking. If you just booked, Kyle will still have your details. You can message him on <a href={CONTACT.TELEGRAM_URL} style={{ color: "var(--gold)" }}>Telegram {CONTACT.TELEGRAM_HANDLE}</a> or <a href={`mailto:${SITE.KYLE_EMAIL}`} style={{ color: "var(--gold)" }}>{SITE.KYLE_EMAIL}</a>.</p>
      )}
      {state === "ok" && info && (
        <>
          <p style={{ fontSize: "var(--fs-lg)", color: "var(--gold)", margin: "0 0 6px" }}>You are booked in, {info.name}.</p>
          <p style={{ margin: "0 0 4px" }}><strong>{when(tz)}</strong> (your time)</p>
          {tz !== BRISBANE_TZ && <p style={{ margin: "0 0 14px", color: "var(--dim)" }}>{when(BRISBANE_TZ)} (Brisbane time)</p>}
          <p style={{ margin: "14px 0" }}>Kyle will call you at that time. Before the call he looks at your website and your industry, so the 20 minutes goes on your business and not on introductions.</p>
          <a href={`${PORTAL.API_BASE}/api/book/${info.id}/ics`} download="call-with-kyle.ics" style={{ display: "inline-flex", alignItems: "center", minHeight: 48, padding: "10px 20px", border: "1px solid var(--gold)", borderRadius: "var(--radius-sm, 6px)", color: "var(--gold)", textDecoration: "none" }}>Add to my calendar (.ics)</a>
          <p style={{ margin: "18px 0 0", color: "var(--dim)", fontSize: "var(--fs-sm)" }}>Need to change the time? Message Kyle on <a href={CONTACT.TELEGRAM_URL} style={{ color: "var(--gold)" }}>Telegram {CONTACT.TELEGRAM_HANDLE}</a> or email <a href={`mailto:${SITE.KYLE_EMAIL}`} style={{ color: "var(--gold)" }}>{SITE.KYLE_EMAIL}</a>.</p>
        </>
      )}
    </div>
  );
}
