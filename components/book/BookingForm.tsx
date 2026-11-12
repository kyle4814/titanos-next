"use client";

// The booking page's slot picker and form. Plain fetch to our own portal-api (/api/slots, /api/book): no third-party scheduler.
// If the API cannot be reached the page says so and offers Telegram and email, so a visitor is never stuck.
import { useCallback, useEffect, useMemo, useState } from "react";
import { PORTAL, CONTACT, SITE } from "@/lib/config";
import { groupSlots, visitorTimeZone, bookingError, confirmedHref, BRISBANE_TZ, type ApiSlot } from "@/lib/booking-ui";

const field: React.CSSProperties = {
  width: "100%", minHeight: 48, padding: "10px 14px", fontSize: 16, lineHeight: 1.4, color: "var(--text)",
  background: "rgb(var(--gold-rgb) / 0.04)", border: "1px solid rgb(var(--gold-rgb) / 0.35)", borderRadius: "var(--radius-sm, 6px)", boxSizing: "border-box",
};
const label: React.CSSProperties = { display: "block", color: "var(--ice)", fontSize: "var(--fs-sm)", margin: "0 0 6px" };
const chip = (on: boolean): React.CSSProperties => ({
  minHeight: 48, minWidth: 48, padding: "8px 14px", fontSize: "var(--fs-sm)", cursor: "pointer", borderRadius: 999,
  color: on ? "var(--vault-black, #0a0a0a)" : "var(--ice)", background: on ? "var(--gold)" : "transparent",
  border: `1px solid ${on ? "var(--gold)" : "rgb(var(--gold-rgb) / 0.4)"}`, fontWeight: on ? 700 : 400,
});

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

  const telegram = <a href={CONTACT.TELEGRAM_URL} style={{ color: "var(--gold)" }}>Telegram {CONTACT.TELEGRAM_HANDLE}</a>;
  const email = <a href={`mailto:${SITE.KYLE_EMAIL}`} style={{ color: "var(--gold)" }}>{SITE.KYLE_EMAIL}</a>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px var(--space-12)", position: "relative", zIndex: 2 }}>
      <h2 style={{ fontSize: "var(--fs-h3, 1.5rem)", color: "var(--gold)", margin: "0 0 8px" }}>1. Pick a time</h2>
      <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", lineHeight: 1.6, margin: "0 0 14px" }}>
        20 minutes, Monday to Friday afternoons. Times show in your time zone ({tz.replace(/_/g, " ")}) with Brisbane time beside each one.
      </p>
      <div aria-live="polite">
        {load.state === "loading" && <p style={{ color: "var(--dim)" }}>Loading times...</p>}
        {load.state === "error" && (
          <p style={{ color: "var(--ice)", lineHeight: 1.7 }}>
            The booking times did not load just now. You can still reach Kyle directly: {telegram} or {email}.
          </p>
        )}
        {load.state === "ready" && days.length === 0 && (
          <p style={{ color: "var(--ice)", lineHeight: 1.7 }}>No times are open right now. Message Kyle on {telegram} or {email} and he will find one.</p>
        )}
      </div>
      {activeDay && (
        <>
          <div role="group" aria-label="Day" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 12px" }}>
            {days.map((d) => (
              <button key={d.key} type="button" aria-pressed={d.key === activeDay.key} style={chip(d.key === activeDay.key)} onClick={() => { setDay(d.key); setSlot(null); }}>{d.label}</button>
            ))}
          </div>
          <div role="group" aria-label={`Times on ${activeDay.label}`} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, margin: "0 0 22px" }}>
            {activeDay.slots.map((s) => (
              <button key={s.iso} type="button" aria-pressed={slot === s.iso} style={{ ...chip(slot === s.iso), borderRadius: "var(--radius-sm, 6px)", lineHeight: 1.3 }} onClick={() => setSlot(s.iso)}>
                {s.local}
                <span style={{ display: "block", fontSize: "var(--fs-xs)", fontWeight: 400, opacity: 0.85 }}>Brisbane {s.brisbane}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <h2 style={{ fontSize: "var(--fs-h3, 1.5rem)", color: "var(--gold)", margin: "8px 0 8px" }}>2. Your details</h2>
      <form onSubmit={submit} noValidate={false} style={{ display: "grid", gap: 14 }}>
        <div><label htmlFor="bk-name" style={label}>Your name</label><input id="bk-name" name="name" type="text" autoComplete="name" required maxLength={100} style={field} /></div>
        <div><label htmlFor="bk-business" style={label}>Your business</label><input id="bk-business" name="business" type="text" autoComplete="organization" required maxLength={120} style={field} /></div>
        <div><label htmlFor="bk-email" style={label}>Email</label><input id="bk-email" name="email" type="email" autoComplete="email" required maxLength={254} style={field} /></div>
        <div><label htmlFor="bk-phone" style={label}>Phone (optional)</label><input id="bk-phone" name="phone" type="tel" autoComplete="tel" maxLength={24} style={field} /></div>
        <div><label htmlFor="bk-eats" style={label}>What eats your week?</label><textarea id="bk-eats" name="eatsWeek" required maxLength={1000} rows={4} style={{ ...field, resize: "vertical" }} /></div>
        {/* Honeypot: invisible to people and to the keyboard, bots fill it. A filled value is dropped on the server. */}
        <div aria-hidden="true" style={{ position: "absolute", left: -10000, top: "auto", width: 1, height: 1, overflow: "hidden" }}>
          <label htmlFor="bk-website">Leave this empty</label>
          <input id="bk-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", lineHeight: 1.6, margin: 0 }}>
          Kyle sees only what you type here. Your details are used to confirm this call and nothing else, and no one is added to a list. A no is always welcome.
        </p>
        <div role="alert" style={{ color: "var(--warn)", fontSize: "var(--fs-sm)", minHeight: err ? undefined : 0 }}>{err}</div>
        <button type="submit" disabled={busy || load.state !== "ready" || days.length === 0} style={{ ...chip(true), minHeight: 52, borderRadius: "var(--radius-sm, 6px)", fontSize: "var(--fs-body)", opacity: busy ? 0.7 : 1 }}>
          {busy ? "Booking..." : "Book my call"}
        </button>
      </form>
    </div>
  );
}
