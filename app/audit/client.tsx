"use client";

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

function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: string[];
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
  return (
    <OrderForm
      orderType="audit"
      heading="Request Your Free AI Audit"
      subheading="Takes 2 minutes. I'll personally review it and send your report within 1 business day."
      submitLabel="GET MY FREE AI AUDIT →"
      successMessage="Received. I'll personally review it and send your report within 1 business day."
    >
      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />

      <SelectField label="Industry" name="scope_industry" options={INDUSTRIES} />

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
