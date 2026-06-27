"use client";

import OrderForm, { Field } from "@/components/OrderForm";

const SIZES = [
  "1–5 people",
  "6–20 people",
  "21–50 people",
  "51–200 people",
  "200+ people",
];

const INDUSTRIES = [
  "Healthcare / Allied health",
  "Finance & accounting",
  "Legal",
  "Technology / SaaS",
  "Professional services",
  "Real estate",
  "Education",
  "Retail / eCommerce",
  "Government / NFP",
  "Other",
];

const PLATFORMS = [
  "Website contact forms",
  "CRM (HubSpot, Salesforce, etc.)",
  "AI tools / chatbots",
  "Email marketing (Mailchimp, Klaviyo, etc.)",
  "Booking systems",
  "Patient / client portals",
  "Payment systems",
  "Analytics / tracking",
  "Other",
];

const DRIVERS = [
  "11 December 2026 deadline",
  "Tender / government contract requirement",
  "Client / partner asked for it",
  "Data breach or near-miss",
  "Board / investor requirement",
  "General due diligence",
  "Other",
];

const TIMINGS = [
  "ASAP — I need this within 2 weeks",
  "Within 1 month",
  "Within 3 months",
  "Before December 2026",
  "Just scoping for now",
];

function SelectField({
  label,
  name,
  options,
  hint,
}: {
  label: string;
  name: string;
  options: string[];
  hint?: string;
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
      {hint && (
        <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", marginTop: 4 }}>{hint}</p>
      )}
    </div>
  );
}

export default function OrderComplianceClient() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--vault-bg, #080808)",
        padding: "80px 20px 60px",
      }}
    >
      <OrderForm
        orderType="compliance"
        heading="Compliance AU — Intake"
        subheading="Privacy Act compliance done-with-you in one working call. $5,997 one-time. Kyle reviews this form and sends your invoice within 1 business day."
        submitLabel="SUBMIT COMPLIANCE ORDER →"
        successMessage="Received. Kyle will review your scope and send a Stripe invoice within 1 business day. Pay when you're ready."
      >
        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          <SelectField
            label="Business size"
            name="scope_company_size"
            options={SIZES}
          />
          <SelectField
            label="Industry"
            name="scope_industry"
            options={INDUSTRIES}
          />
        </div>

        <div>
          <label
            htmlFor="order-scope_platforms"
            style={{
              color: "var(--ice)",
              fontSize: "var(--fs-sm)",
              fontWeight: 500,
              display: "block",
              marginBottom: 6,
            }}
          >
            Where do you collect personal data?
          </label>
          <select
            id="order-scope_platforms"
            name="scope_platforms"
            multiple
            size={5}
            style={{
              width: "100%",
              background: "var(--vault-bg, #0a0a0a)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "8px",
              color: "var(--text)",
              fontSize: "var(--fs-sm)",
              boxSizing: "border-box",
            }}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", marginTop: 4 }}>
            Hold Ctrl / Cmd to select multiple.
          </p>
        </div>

        <SelectField
          label="What's driving this now?"
          name="scope_driver"
          options={DRIVERS}
        />

        <SelectField
          label="When do you need this done?"
          name="scope_timing"
          options={TIMINGS}
        />

        <Field
          label="Anything else Kyle should know (optional)"
          name="scope_notes"
          as="textarea"
          rows={2}
          placeholder="Existing privacy policy URL, specific concerns, questions…"
        />
      </OrderForm>
    </main>
  );
}
