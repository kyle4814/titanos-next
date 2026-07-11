"use client";

/**
 * ScanRequestForm — Fix 1.
 *
 * Replaces every mailto:kyle@titanos.tech "Request your free scan" CTA
 * with a real POST form. Captures domain, name, email, optional notes,
 * and a static consent line.
 *
 * Backend selection lives in lib/config.ts (FORM_BACKEND). The Flask
 * route this submits to is sketched at ops/flask_scan_request_route.py
 * but not yet deployed — see the handoff. Submissions will fail (and
 * fall back to a visible mailto link) until the route is live.
 *
 * Degradation: a <noscript> block exposes a visible mailto link so
 * users with JS disabled can still reach Kyle.
 */

import { useState, type FormEvent } from "react";
import { SITE } from "@/lib/config";

const SUCCESS_MS = 12_000;

type Status = "idle" | "submitting" | "success" | "error";

// Hostname: at least two labels, each 1-63 chars, alnum or hyphen,
// optional trailing dot. Strips protocol + path before checking.
const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\.?$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normaliseDomain(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./i, "")
    .toLowerCase();
}

function backendUrl(): string {
  if (SITE.FORM_BACKEND === "formspree" && SITE.FORMSPREE_ID) {
    return `https://formspree.io/f/${SITE.FORMSPREE_ID}`;
  }
  return SITE.FLASK_FORM_ENDPOINT;
}

// Single fallback mailto preserved for the error state only. Never
// surfaced in the happy path. Kept consistent with the consent line
// rendered above the submit button so an emailed request carries the
// same terms.
const FALLBACK_MAILTO =
  `mailto:${SITE.KYLE_EMAIL}` +
  `?subject=Scan%20request` +
  `&body=Domain%3A%20%0AYour%20name%3A%20%0AEmail%3A%20%0ANotes%20(optional)%3A%20%0A%0A` +
  `By%20requesting%20a%20scan%20you%20consent%20to%20receive%20your%20report%20plus%20up%20to%203%20related%20follow-ups%20over%206%20months.%20Reply%20STOP%20to%20anything%20and%20you%20are%20suppressed%20forever.`;

export default function ScanRequestForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState("");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "submitting") return;

    const form = e.currentTarget;
    const data = new FormData(form);
    const domainRaw = String(data.get("domain") || "");
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const notes = String(data.get("notes") || "").trim();

    const domain = normaliseDomain(domainRaw);
    const next: Record<string, string> = {};
    if (!domain || !HOSTNAME_RE.test(domain)) {
      next.domain = "Looks like that isn't a domain — try yourbusiness.com.au.";
    }
    if (!name) next.name = "Tell me what to call you.";
    if (!email || !EMAIL_RE.test(email)) {
      next.email = "Need a valid email to send the report.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch(backendUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          domain,
          name,
          email,
          notes,
          source: "titanos.tech/scan",
          submitted_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        throw new Error(`POST ${res.status}`);
      }
      setStatus("success");
      window.setTimeout(() => setStatus("idle"), SUCCESS_MS);
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error && err.message
          ? "Submission failed — the endpoint may be offline."
          : "Submission failed.",
      );
    }
  };

  if (status === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        data-analytics="scan-form-success"
        style={{
          background: "var(--card)",
          border: "1px solid var(--ok)",
          borderRadius: "var(--radius-md)",
          padding: "var(--pad-card)",
          color: "var(--text)",
          fontSize: "var(--fs-body)",
          lineHeight: 1.7,
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
          QUEUED.
        </div>
        Your report lands in your inbox within 2 business days — sent personally,
        not from a sequence.
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      data-analytics="scan-form"
      noValidate
      style={{
        background: "var(--card)",
        border: "1px solid var(--gold-dim)",
        borderRadius: "var(--radius-md)",
        padding: "var(--pad-card)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <Field
        label="Your domain"
        name="domain"
        placeholder="yourbusiness.com.au"
        autoComplete="url"
        required
        error={errors.domain}
      />
      <Field
        label="Your name"
        name="name"
        autoComplete="name"
        required
        error={errors.name}
      />
      <Field
        label="Your email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={errors.email}
      />
      <Field
        label="Anything I should know? (optional)"
        name="notes"
        as="textarea"
      />

      <p
        style={{
          color: "var(--dim)",
          fontSize: "var(--fs-xs)",
          lineHeight: 1.65,
          margin: "4px 0 0",
        }}
      >
        By requesting a scan you consent to receive your report plus up to 3
        related follow-ups over 6 months. Reply STOP to anything and you&apos;re
        suppressed forever. I never sell your data.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <button
          type="submit"
          data-analytics="scan-form-submit"
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
          {status === "submitting" ? "Sending…" : "Request your free scan"}
        </button>
        <span style={{ color: "var(--dim)", fontSize: "var(--fs-xs)" }}>
          Delivered within 2 business days.
        </span>
      </div>

      {status === "error" && (
        <div
          role="alert"
          data-analytics="scan-form-error"
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
          {errorMsg}{" "}
          <a
            href={FALLBACK_MAILTO}
            style={{ color: "var(--ice)", textDecoration: "underline" }}
            data-analytics="scan-form-mailto-fallback"
          >
            Or email me directly →
          </a>
        </div>
      )}

      <noscript>
        <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>
          JavaScript is off, which is fair. Email{" "}
          <a
            href={FALLBACK_MAILTO}
            style={{ color: "var(--ice)", textDecoration: "underline" }}
          >
            {SITE.KYLE_EMAIL}
          </a>{" "}
          with your domain, your name, and anything I should know. Same
          1-business-day SLA.
        </p>
      </noscript>
    </form>
  );
}

/* ─── helpers ───────────────────────────────────────────── */
function Field({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  required,
  error,
  as = "input",
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  error?: string;
  as?: "input" | "textarea";
}) {
  const id = `scan-form-${name}`;
  const labelStyle: React.CSSProperties = {
    color: "var(--ice)",
    fontFamily: "var(--font-body), system-ui, sans-serif",
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
    padding: "12px 14px",
    color: "var(--text)",
    fontSize: "var(--fs-body)",
    fontFamily: "var(--font-body), system-ui, sans-serif",
    lineHeight: 1.5,
  };
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      {as === "textarea" ? (
        <textarea
          id={id}
          name={name}
          placeholder={placeholder}
          rows={3}
          style={fieldStyle}
        />
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
      {error && (
        <p
          style={{
            color: "var(--warn)",
            fontSize: "var(--fs-xs)",
            marginTop: 6,
            lineHeight: 1.5,
          }}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
