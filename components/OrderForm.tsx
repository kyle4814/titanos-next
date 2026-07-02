"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { SITE } from "@/lib/config";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = "idle" | "submitting" | "success" | "error";

export type OrderType = "leads" | "compliance" | "ai" | "monitor";

type Props = {
  orderType: OrderType;
  tier?: string;
  heading: string;
  subheading?: string;
  submitLabel?: string;
  successMessage?: string;
  children?: ReactNode; // extra scope fields rendered between shared + submit
};

export default function OrderForm({
  orderType,
  tier,
  heading,
  subheading,
  submitLabel = "SUBMIT ENQUIRY →",
  successMessage,
  children,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [scopeValues, setScopeValues] = useState<Record<string, string>>({});

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "submitting") return;

    const form = e.currentTarget;
    const data = new FormData(form);

    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const phone = String(data.get("phone") ?? "").trim();
    const businessName = String(data.get("business_name") ?? "").trim();
    const website = String(data.get("website") ?? "").trim();

    const next: Record<string, string> = {};
    if (!name) next.name = "Required.";
    if (!email || !EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length) return;

    // Collect all form fields prefixed with "scope_" into the scope object
    const scope: Record<string, string> = {};
    for (const [key, val] of data.entries()) {
      if (key.startsWith("scope_")) {
        const shortKey = key.slice(6);
        scope[shortKey] = String(val).trim();
      }
    }

    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch(SITE.ORDER_SUBMIT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_type: orderType,
          tier: tier ?? scope.tier ?? undefined,
          name,
          email,
          phone: phone || undefined,
          business_name: businessName || undefined,
          website: website || undefined,
          scope,
        }),
      });
      if (!res.ok) throw new Error(`POST ${res.status}`);
      setStatus("success");
      form.reset();
      setScopeValues({});
    } catch {
      setStatus("error");
      setErrorMsg("Submission failed. Try again or email kyle@titanos.tech directly.");
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
          padding: "40px 32px",
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
          RECEIVED.
        </div>
        <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7, margin: 0 }}>
          {successMessage ??
            "Kyle reviews every order personally and will respond within 1 business day."}
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
        padding: "36px 32px",
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
          {heading}
        </h2>
        {subheading && (
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", lineHeight: 1.6, margin: 0 }}>
            {subheading}
          </p>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        <Field label="Your name" name="name" autoComplete="name" required error={errors.name} />
        <Field label="Email" name="email" type="email" autoComplete="email" required error={errors.email} />
        <Field label="Phone (optional)" name="phone" type="tel" autoComplete="tel" />
        <Field label="Business name (optional)" name="business_name" autoComplete="organization" />
      </div>
      <Field label="Website (optional)" name="website" type="url" autoComplete="url" placeholder="yourbusiness.com.au" />

      {/* Scope fields — injected per order type */}
      {children}

      <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", lineHeight: 1.65, margin: "4px 0 0" }}>
        By submitting you consent to receive a scoped proposal plus up to 3 follow-ups over 6 months.
        Reply STOP to anything and you&apos;re suppressed forever. I never sell your data.
      </p>

      <p style={{ color: "var(--ok)", fontSize: "var(--fs-xs)", lineHeight: 1.55, margin: "0 0 4px" }}>
        No charge until you approve the scope and receive an invoice from Kyle.
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
          {status === "submitting" ? "Sending…" : submitLabel}
        </button>
        <span style={{ color: "var(--dim)", fontSize: "var(--fs-xs)" }}>
          Kyle responds within 1 business day.
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

/* ─── Field helper ─────────────────────────────────────────────────────────── */
export function Field({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  required,
  error,
  as = "input",
  rows = 3,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  error?: string;
  as?: "input" | "textarea" | "select";
  rows?: number;
  hint?: string;
  children?: ReactNode;
}) {
  const id = `order-${name}`;
  const labelStyle: React.CSSProperties = {
    color: "var(--ice)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    marginBottom: 6,
    display: "block",
    letterSpacing: "0.01em",
  };
  const fieldStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--vault-bg, #0a0a0a)",
    border: `1px solid ${error ? "var(--warn)" : "var(--border)"}`,
    borderRadius: "var(--radius-sm)",
    padding: "11px 13px",
    color: "var(--text)",
    fontSize: "var(--fs-body)",
    lineHeight: 1.5,
    boxSizing: "border-box",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      {as === "textarea" ? (
        <textarea id={id} name={name} placeholder={placeholder} rows={rows} style={fieldStyle} />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          style={fieldStyle}
        />
      )}
      {hint && (
        <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", marginTop: 4, lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
      {error && (
        <p role="alert" style={{ color: "var(--warn)", fontSize: "var(--fs-xs)", marginTop: 5, lineHeight: 1.5 }}>
          {error}
        </p>
      )}
    </div>
  );
}
