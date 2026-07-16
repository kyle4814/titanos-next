"use client";

import { useSearchParams } from "next/navigation";
import OrderForm, { Field } from "@/components/OrderForm";
import { DISPLAY } from "@/lib/pricing";

const TIERS = [
  { value: "growth", label: `AI Growth Partner — ${DISPLAY.AI_GROWTH_PARTNER} (${DISPLAY.AI_RETAINER_MIN})` },
  { value: "ops", label: `AI Ops Partner — ${DISPLAY.AI_OPS_PARTNER} (${DISPLAY.AI_RETAINER_MIN})` },
  { value: "embedded", label: `Embedded AI Partner — ${DISPLAY.AI_EMBEDDED_PARTNER} (${DISPLAY.AI_RETAINER_MIN})` },
  { value: "not_sure", label: "Not sure yet — start with the free AI audit" },
];

const BUDGETS = [
  "Under AU$2,000 (pilot range)",
  "AU$2,000 – AU$5,000",
  "AU$5,000 – AU$10,000",
  "AU$10,000 – AU$20,000",
  "AU$20,000 – AU$50,000",
  "AU$50,000+",
  "Not sure yet",
];

const TIMELINES = [
  "Within 2 weeks",
  "Within 4 weeks",
  "Within 2 months",
  "Within 6 months",
  "No hard deadline",
];

function SelectField({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[] | string[];
  defaultValue?: string;
}) {
  const opts = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
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
        defaultValue={defaultValue ?? ""}
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
        {!defaultValue && <option value="">— Select —</option>}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function OrderAiClient() {
  const params = useSearchParams();
  const rawTier = params.get("tier") ?? "";
  const validTiers = new Set(TIERS.map((t) => t.value));
  const defaultTier = validTiers.has(rawTier) ? rawTier : "not_sure";

  const heading = "AI Partnership — Enquiry";

  const subheading = `Tell Kyle what's most repetitive in your business. He'll confirm the tier that fits — Growth ${DISPLAY.AI_GROWTH_PARTNER}, Ops ${DISPLAY.AI_OPS_PARTNER}, Embedded ${DISPLAY.AI_EMBEDDED_PARTNER} — all ${DISPLAY.AI_RETAINER_MIN}. Month 1 is the build, months 2-3 optimise, then it's month-to-month.`;

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
        heading={heading}
        subheading={subheading}
        submitLabel="SUBMIT AI PARTNERSHIP ENQUIRY →"
        successMessage="Received. Kyle will review your scope and respond with a proposal within 1 business day."
      >
        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />

        <SelectField
          label="Which tier fits?"
          name="scope_tier"
          options={TIERS}
          defaultValue={defaultTier}
        />

        <Field
          label="What do you do manually that takes the most time?"
          name="scope_manual_tasks"
          as="textarea"
          rows={4}
          placeholder="e.g. We manually triage 200 support emails a day, copy data between three systems every morning, and write weekly reports from spreadsheets…"
          hint="Be specific. The more detail, the sharper the first system I build in month 1."
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
