"use client";

import { useState, type FormEvent } from "react";
import { SITE } from "@/lib/config";
import { Field } from "./OrderForm";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ABN_RE = /^\d{11}$/;

type Status = "idle" | "submitting" | "success" | "error";

export default function ReferForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [portalUrl, setPortalUrl] = useState("");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "submitting") return;

    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const abn = String(data.get("abn") ?? "").trim().replace(/\s/g, "");

    const next: Record<string, string> = {};
    if (!name) next.name = "Required.";
    if (!email || !EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    if (abn && !ABN_RE.test(abn)) next.abn = "ABN is 11 digits — leave blank if you don't have one handy yet.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch(SITE.PARTNER_SIGNUP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, abn: abn || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || `POST ${res.status}`);
      setPortalUrl(json.portal_url);
      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error && err.message ? err.message : "Signup failed. Try again or email kyle@titanos.tech directly.");
    }
  };

  if (status === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          background: "var(--card)",
          border: "1px solid var(--ok)",
          borderRadius: "var(--radius-md)",
          padding: "var(--pad-card)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-lg)",
            letterSpacing: "0.06em",
            marginBottom: 12,
          }}
        >
          Application received.
        </div>
        <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7, margin: "0 0 16px" }}>
          Kyle reviews every partner application personally. Save your portal link below — it&apos;s
          the only way back in, so bookmark it or email it to yourself now.
        </p>
        <p
          style={{
            wordBreak: "break-all",
            background: "var(--vault-bg, rgba(0,0,0,0.15))",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 16px",
          }}
        >
          <a href={portalUrl} style={{ color: "var(--gold)" }}>
            {portalUrl}
          </a>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      style={{
        background: "var(--card)",
        border: "1px solid var(--gold-dim)",
        borderRadius: "var(--radius-md)",
        padding: "var(--pad-card)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        maxWidth: 640,
        margin: "0 auto",
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-lg)",
            letterSpacing: "0.06em",
            margin: "0 0 6px",
          }}
        >
          Apply to the partner network
        </h2>
        <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", lineHeight: 1.6, margin: 0 }}>
          Referral / commission-only. Independent contractor, your own ABN, no exclusivity, no
          set hours. No joining fee — ever.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Your name" name="name" autoComplete="name" required error={errors.name} />
        <Field label="Email" name="email" type="email" autoComplete="email" required error={errors.email} />
      </div>
      <Field
        label="ABN (optional for now)"
        name="abn"
        placeholder="11 digits, no spaces"
        error={errors.abn}
        hint="You'll need a valid ABN before your first commission payout — you can add it later from your portal."
      />

      <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", lineHeight: 1.65, margin: "4px 0 0" }}>
        Commission is paid only on real closed revenue you introduce — never for recruiting
        other partners. Full terms are shown in your portal once you sign up.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <button
          type="submit"
          disabled={status === "submitting"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "14px 28px",
            minHeight: 48,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--gold)",
            color: status === "submitting" ? "var(--dim)" : "var(--gold)",
            background: "transparent",
            fontFamily: "var(--font-display), Georgia, serif",
            fontStyle: "italic",
            fontSize: "var(--fs-sm)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: status === "submitting" ? "wait" : "pointer",
          }}
        >
          {status === "submitting" ? "Applying…" : "APPLY →"}
        </button>
        <span style={{ color: "var(--dim)", fontSize: "var(--fs-xs)" }}>
          Kyle reviews and approves applications personally.
        </span>
      </div>

      {status === "error" && (
        <div
          role="alert"
          style={{
            background: "rgb(var(--gold-rgb) / 0.06)",
            border: "1px solid var(--warn)",
            borderRadius: "var(--radius-sm)",
            padding: "14px 16px",
            color: "var(--text)",
            fontSize: "var(--fs-sm)",
            lineHeight: 1.6,
          }}
        >
          {errorMsg}
        </div>
      )}
    </form>
  );
}
