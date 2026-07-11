"use client";

import { useSearchParams } from "next/navigation";
import OrderForm, { Field } from "@/components/OrderForm";
import { DISPLAY } from "@/lib/pricing";

const TIERS = [
  { value: "pilot", label: `Automation Pilot — ${DISPLAY.AI_PILOT_FLOOR} (one task, fixed scope)` },
  { value: "build", label: `Full Build — ${DISPLAY.AI_BUILD_FLOOR} (full custom AI system)` },
  { value: "retainer", label: `Ops Retainer — ${DISPLAY.AI_OPS_RETAINER} (post-build only)` },
  { value: "not_sure", label: "Not sure yet — start with the free scoping call" },
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
  const isPilot = defaultTier === "pilot";

  const heading = isPilot
    ? "AI Automation Pilot — Enquiry"
    : "AI Implementation — Enquiry";

  const subheading = isPilot
    ? `Tell Kyle the single manual task you want automated as a fixed-scope pilot (${DISPLAY.AI_PILOT_FLOOR}). He confirms scope and sends an invoice; you see it working before committing to anything bigger.`
    : `Tell Kyle what manual task is eating your team's week. He scopes the rung that fits — pilot ${DISPLAY.AI_PILOT_FLOOR.toLowerCase()}, full build ${DISPLAY.AI_BUILD_FLOOR.toLowerCase()} — and sends an invoice.`;

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
        submitLabel={isPilot ? "SUBMIT PILOT ENQUIRY →" : "SUBMIT AI ORDER →"}
        successMessage="Received. Kyle will review your scope and respond with a proposal or invoice within 1 business day."
      >
        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />

        <SelectField
          label="Which rung fits?"
          name="scope_tier"
          options={TIERS}
          defaultValue={defaultTier}
        />

        <Field
          label={
            isPilot
              ? "Which single manual task do you want automated?"
              : "What do you do manually that takes the most time?"
          }
          name="scope_manual_tasks"
          as="textarea"
          rows={4}
          placeholder={
            isPilot
              ? "e.g. Every morning I copy new Xero invoices into our CRM by hand and email a summary to the team…"
              : "e.g. We manually triage 200 support emails a day, copy data between three systems every morning, and write weekly reports from spreadsheets…"
          }
          hint={
            isPilot
              ? "One specific task. The tighter the scope, the faster the pilot ships."
              : "Be specific. The more detail, the sharper the scope."
          }
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
