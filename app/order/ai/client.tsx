"use client";

import OrderForm, { Field } from "@/components/OrderForm";

const BUDGETS = [
  "Under $5,000",
  "$5,000 – $10,000",
  "$10,000 – $20,000",
  "$20,000 – $50,000",
  "$50,000+",
  "Not sure yet",
];

const TIMELINES = [
  "Within 4 weeks",
  "Within 2 months",
  "Within 6 months",
  "No hard deadline",
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

export default function OrderAiClient() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--vault-bg, #080808)",
        padding: "80px 20px 60px",
      }}
    >
      <OrderForm
        orderType="ai"
        heading="AI Implementation — Intake"
        subheading="Tell Kyle what you do manually. He scopes the build, sends an invoice, and eliminates the work. From $4,997."
        submitLabel="SUBMIT AI ORDER →"
        successMessage="Received. Kyle will review your scope and respond with a proposal or invoice within 1 business day."
      >
        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />

        <Field
          label="What do you do manually that takes the most time?"
          name="scope_manual_tasks"
          as="textarea"
          rows={4}
          placeholder="e.g. We manually triage 200 support emails a day, copy data between three systems every morning, and write weekly reports from spreadsheets…"
          hint="Be specific. The more detail, the sharper the scope."
        />

        <Field
          label="What systems / tools are involved?"
          name="scope_systems"
          as="textarea"
          rows={2}
          placeholder="e.g. HubSpot, Xero, Gmail, our internal PostgreSQL database, Slack…"
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <SelectField label="Approximate budget" name="scope_budget" options={BUDGETS} />
          <SelectField label="Timeline" name="scope_timeline" options={TIMELINES} />
        </div>

        <Field
          label="Anything else Kyle should know (optional)"
          name="scope_notes"
          as="textarea"
          rows={2}
          placeholder="Previous attempts, constraints, questions…"
        />
      </OrderForm>
    </main>
  );
}
