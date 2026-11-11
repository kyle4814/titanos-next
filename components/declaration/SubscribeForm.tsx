"use client";

// Mailing-list signup for the declaration. Capture only: the backend stores the address and tags, nothing is sent.
// A hidden honeypot field catches bots. Failure shows a plain message with the contact address, never a fake success.
import { useId, useState, type FormEvent } from "react";
import { CONSENT_LINE, DEFAULT_TAG, SUBSCRIBE_ENDPOINT } from "@/lib/declaration";
import s from "./declaration.module.css";

type State = "idle" | "sending" | "ok" | "err";

export default function SubscribeForm({ tag = DEFAULT_TAG, source = "declaration", label = "Join the mailing list" }: { tag?: string; source?: string; label?: string }) {
  const id = useId();
  const [state, setState] = useState<State>("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    if (!email) { setState("err"); setMsg("Please enter your email address."); return; }
    setState("sending"); setMsg("");
    try {
      const r = await fetch(SUBSCRIBE_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, tags: Array.from(new Set([DEFAULT_TAG, tag])), source, consent: true, website: String(f.get("website") ?? "") }),
      });
      if (r.ok) { setState("ok"); setMsg("You are on the list. Thank you."); return; }
      if (r.status === 400) { setState("err"); setMsg("That email address does not look right. Please check it."); return; }
      if (r.status === 429) { setState("err"); setMsg("Too many tries from this connection. Please try again in a little while."); return; }
      throw new Error("status " + r.status);
    } catch {
      setState("err"); setMsg("We could not save that just now. Email kyle@titanos.tech and we will add you by hand.");
    }
  }

  return (
    <form className={s.form} onSubmit={onSubmit} noValidate data-subscribe-tag={tag}>
      <label htmlFor={id + "-e"} className={s.small}>Email address</label>
      <div className={s.formRow}>
        <input id={id + "-e"} name="email" type="email" inputMode="email" autoComplete="email" required placeholder="you@example.com" className={s.input} aria-describedby={id + "-c"} />
        <button type="submit" className={s.btn} disabled={state === "sending" || state === "ok"}>{state === "sending" ? "Sending" : label}</button>
      </div>
      <div className={s.hp} aria-hidden="true"><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <p id={id + "-c"} className={s.small} style={{ margin: 0 }}>{CONSENT_LINE}</p>
      <p role="status" aria-live="polite" className={`${s.msg} ${state === "ok" ? s.ok : state === "err" ? s.err : ""}`}>{msg}</p>
    </form>
  );
}
