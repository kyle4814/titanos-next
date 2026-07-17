"use client";

import { useState } from "react";
import OrderForm, { Field } from "@/components/OrderForm";

const INDUSTRIES = [
  "Healthcare / Allied health",
  "Finance & accounting",
  "Legal",
  "Technology / SaaS",
  "Professional services",
  "Real estate",
  "Education",
  "Retail / eCommerce",
  "Trades / field services",
  "Government / NFP",
  "Other",
];

// General patterns, never framed as specific-client results — keeps this
// inside the honesty guardrails while making the form feel like it's
// already thinking about their situation, not just collecting a dropdown.
const INDUSTRY_HINTS: Record<string, string> = {
  "Healthcare / Allied health": "Appointment reminders and intake forms are usually the first thing worth automating here.",
  "Finance & accounting": "Client onboarding and document chasing eat the most hours in this industry, typically.",
  "Legal": "Intake triage and document assembly are the common first wins for legal practices.",
  "Technology / SaaS": "Support ticket triage and lead qualification are usually the biggest time sinks.",
  "Professional services": "Proposal generation and follow-up sequencing tend to be the first thing worth fixing.",
  "Real estate": "Enquiry response speed and listing follow-up are usually where the time goes.",
  "Education": "Enrolment enquiries and parent/student comms are the common starting point.",
  "Retail / eCommerce": "Order status enquiries and inventory reporting are usually the first automatable job.",
  "Trades / field services": "Quote follow-up and job scheduling are usually the biggest wins in this industry.",
  "Government / NFP": "Application triage and reporting are the common starting points here.",
};

function SelectField({
  label,
  name,
  options,
  onChange,
}: {
  label: string;
  name: string;
  options: string[];
  onChange?: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label
        htmlFor={`order-${name}`}
        style={{
          color: "var(--ice)",
          fontSize: "var(--fs-sm)",
          fontWeight: 500,
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <select
        id={`order-${name}`}
        name={name}
        onChange={(e) => onChange?.(e.target.value)}
        style={{
          width: "100%",
          background: "var(--vault-bg, #0a0a0a)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "11px 13px",
          color: "var(--text)",
          fontSize: "var(--fs-sm)",
          boxSizing: "border-box",
        }}
      >
        <option value="">— Select —</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AuditRequestClient() {
  const [industry, setIndustry] = useState("");
  const hint = INDUSTRY_HINTS[industry];

  return (
    <OrderForm
      orderType="audit"
      heading="Tell Me About Your Business First"
      subheading="Takes 2 minutes. Kyle will read it before you talk, then reach out to book your free AI audit call."
      submitLabel="SEND IT TO KYLE →"
      successMessage="Received. Kyle will read it and reach out to book your free AI audit call."
    >
      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />

      <SelectField label="Industry" name="scope_industry" options={INDUSTRIES} onChange={setIndustry} />
      {hint && (
        <p style={{ color: "var(--gold)", fontSize: "var(--fs-xs)", lineHeight: 1.6, margin: "-8px 0 0" }}>
          {hint}
        </p>
      )}

      <Field
        label="What's the most repetitive job in your business?"
        name="scope_manual_tasks"
        as="textarea"
        rows={4}
        placeholder="e.g. Every day someone manually copies leads from our website form into the CRM and emails them to the sales team…"
        hint="Be specific — this is what your audit is built around."
      />

      <Field
        label="What systems / tools do you already use? (optional)"
        name="scope_systems"
        as="textarea"
        rows={2}
        placeholder="e.g. Xero, HubSpot, Gmail, ServiceM8…"
      />
    </OrderForm>
  );
}
