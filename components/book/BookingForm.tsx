"use client";

// The booking page's slot picker and form. Plain fetch to our own portal-api (/api/slots, /api/book): no third-party scheduler.
// If the API cannot be reached the page says so and offers Telegram and email, so a visitor is never stuck.
import { useCallback, useEffect, useMemo, useState } from "react";
import { PORTAL, CONTACT, SITE } from "@/lib/config";
import "@/components/g4/g4.css";
import { groupSlots, visitorTimeZone, bookingError, confirmedHref, BRISBANE_TZ, type ApiSlot } from "@/lib/booking-ui";

type Load = { state: "loading" } | { state: "ready"; slots: ApiSlot[] } | { state: "error" };

export default function BookingForm() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [tz, setTz] = useState(BRISBANE_TZ);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    try {
      const r = await fetch(`${PORTAL.API_BASE}/api/slots`, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error("slots_" + r.status);
      const j = (await r.json()) as { slots?: ApiSlot[] };
      setLoad({ state: "ready", slots: Array.isArray(j.slots) ? j.slots : [] });
    } catch { setLoad({ state: "error" }); }
  }, []);
  useEffect(() => { setTz(visitorTimeZone()); void fetchSlots(); }, [fetchSlots]);

  const days = useMemo(() => (load.state === "ready" ? groupSlots(load.slots, tz) : []), [load, tz]);
  const activeDay = days.find((d) => d.key === day) ?? days[0];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!slot) { setErr("Please pick a time first."); return; }
    const f = new FormData(e.currentTarget);
    const body = {
      slot, name: String(f.get("name") ?? ""), business: String(f.get("business") ?? ""), email: String(f.get("email") ?? ""),
      phone: String(f.get("phone") ?? ""), eatsWeek: String(f.get("eatsWeek") ?? ""), website: String(f.get("website") ?? ""),
    };
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${PORTAL.API_BASE}/api/book`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
      if (r.status === 201 && j.id) { window.location.assign(confirmedHref(j.id)); return; }
      if (r.status === 201) { setErr("Thanks. If you do not hear from Kyle, please message him on Telegram."); return; }
      setErr(bookingError(j.error));
      if (j.error === "slot_taken" || j.error === "invalid_slot") { setSlot(null); void fetchSlots(); }
    } catch { setErr(bookingError(undefined)); }
    finally { setBusy(false); }
  }

  const telegram = <a href={CONTACT.TELEGRAM_URL}>Telegram {CONTACT.TELEGRAM_HANDLE}</a>;
  const email = <a href={`mailto:${SITE.KYLE_EMAIL}`}>{SITE.KYLE_EMAIL}</a>;

  return (
    <div className="g4"><div className="g4-book">
      <h2>1. Pick a time</h2>
      <p className="pe-muted" style={{ fontSize: "var(--pe-fs-sm)", lineHeight: 1.6, margin: "0 0 16px" }}>
        20 minutes, Monday to Friday afternoons. Times show in your time zone ({tz.replace(/_/g, " ")}) with Brisbane time beside each one.
      </p>
      <div aria-live="polite">
        {load.state === "loading" && <p className="pe-muted">Loading times...</p>}
        {load.state === "error" && (
          <p className="pe-card pe-card--pad" style={{ lineHeight: 1.7 }}>
            The booking times did not load just now. You can still reach Kyle directly: {telegram} or {email}.
          </p>
        )}
        {load.state === "ready" && days.length === 0 && (
          <p className="pe-card pe-card--pad" style={{ lineHeight: 1.7 }}>No times are open right now. Message Kyle on {telegram} or {email} and he will find one.</p>
        )}
      </div>
      {activeDay && (
        <>
          <div role="group" aria-label="Day" className="g4-chips">
            {days.map((d) => (
              <button key={d.key} type="button" className="g4-chip" aria-pressed={d.key === activeDay.key} onClick={() => { setDay(d.key); setSlot(null); }}>{d.label}</button>
            ))}
          </div>
          <div role="group" aria-label={`Times on ${activeDay.label}`} className="g4-times">
            {activeDay.slots.map((s) => (
              <button key={s.iso} type="button" className="g4-chip" aria-pressed={slot === s.iso} onClick={() => setSlot(s.iso)}>
                {s.local}
                <small>Brisbane {s.brisbane}</small>
              </button>
            ))}
          </div>
        </>
      )}

      <h2>2. Your details</h2>
      <form onSubmit={submit} noValidate={false} className="g4-form pe-card pe-card--pad">
        <div className="pe-field"><label htmlFor="bk-name">Your name</label><input id="bk-name" name="name" type="text" autoComplete="name" required maxLength={100} /></div>
        <div className="pe-field"><label htmlFor="bk-business">Your business</label><input id="bk-business" name="business" type="text" autoComplete="organization" required maxLength={120} /></div>
        <div className="pe-field"><label htmlFor="bk-email">Email</label><input id="bk-email" name="email" type="email" autoComplete="email" required maxLength={254} /></div>
        <div className="pe-field"><label htmlFor="bk-phone">Phone (optional)</label><input id="bk-phone" name="phone" type="tel" autoComplete="tel" maxLength={24} /></div>
        <div className="pe-field"><label htmlFor="bk-eats">What eats your week?</label><textarea id="bk-eats" name="eatsWeek" required maxLength={1000} rows={4} style={{ resize: "vertical" }} /></div>
        {/* Honeypot: invisible to people and to the keyboard, bots fill it. A filled value is dropped on the server. */}
        <div aria-hidden="true" className="g4-hp">
          <label htmlFor="bk-website">Leave this empty</label>
          <input id="bk-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <p className="g4-fine">
          Kyle sees only what you type here. Your details are used to confirm this call and nothing else, and no one is added to a list. A no is always welcome.
        </p>
        <div role="alert" className="g4-err">{err}</div>
        <button type="submit" className="pe-btn pe-btn--gold pe-btn--lg g4-submit" disabled={busy || load.state !== "ready" || days.length === 0}>
          {busy ? "Booking..." : "Book my call"}
        </button>
      </form>
    </div></div>
  );
}
