"use client";

import { useSearchParams } from "next/navigation";
import OrderForm, { Field } from "@/components/OrderForm";

const TIERS = [
  { value: "starter", label: "Starter — 250 leads" },
  { value: "growth", label: "Growth — 1,000 leads" },
  { value: "campaign", label: "Full Campaign" },
  { value: "retainer", label: "Ongoing Retainer" },
];

const INDUSTRIES = [
  "Professional services", "Healthcare / Allied health", "Trades & construction",
  "Finance & accounting", "Legal", "Real estate", "Technology", "Education",
  "Hospitality", "Retail", "Manufacturing", "Other",
];

const REGIONS = [
  "Australia-wide", "NSW / ACT", "VIC / TAS", "QLD", "SA / NT", "WA", "NZ",
];

export default function OrderLeadsClient() {
  const params = useSearchParams();
  const defaultTier = params.get("tier") ?? "starter";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--vault-bg, #080808)",
        padding: "80px 20px 60px",
      }}
    >
      <OrderForm
        orderType="leads"
        heading="Verified AU Leads — Enquiry"
        subheading="Tell Kyle what type of business you're trying to reach. He builds the verified list — you focus on the work, not the prospecting."
        submitLabel="SUBMIT LEADS ENQUIRY →"
        successMessage="Received. Kyle will review your target profile and come back with a scoped list proposal within 1 business day."
      >
        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />

        <div>
          <label
            htmlFor="order-scope_tier"
            style={{
              color: "var(--ice)",
              fontSize: "var(--fs-sm)",
              fontWeight: 500,
              display: "block",
              marginBottom: 6,
            }}
          >
            Package
          </label>
          <select
            id="order-scope_tier"
            name="scope_tier"
            defaultValue={defaultTier}
            style={{
              width: "100%",
              background: "var(--vault-bg, #0a0a0a)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "11px 13px",
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              boxSizing: "border-box",
            }}
          >
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="order-scope_industries"
            style={{
              color: "var(--ice)",
              fontSize: "var(--fs-sm)",
              fontWeight: 500,
              display: "block",
              marginBottom: 6,
            }}
          >
            Target industries
          </label>
          <select
            id="order-scope_industries"
            name="scope_industries"
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
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", marginTop: 4 }}>
            Hold Ctrl / Cmd to select multiple.
          </p>
        </div>

        <div>
          <label
            htmlFor="order-scope_regions"
            style={{
              color: "var(--ice)",
              fontSize: "var(--fs-sm)",
              fontWeight: 500,
              display: "block",
              marginBottom: 6,
            }}
          >
            Target regions
          </label>
          <select
            id="order-scope_regions"
            name="scope_regions"
            multiple
            size={4}
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
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <Field
          label="Decision-maker title (e.g. Practice Manager, Head of Growth)"
          name="scope_decision_maker"
          placeholder="e.g. Practice Manager"
        />

        <Field
          label="What should they do? (Your ideal use case in 1–2 sentences)"
          name="scope_use_case"
          as="textarea"
          rows={3}
          placeholder="e.g. Book a discovery call with our compliance team. We work with Allied Health businesses…"
        />

        <Field
          label="Anything else Kyle should know"
          name="scope_notes"
          as="textarea"
          rows={2}
        />
      </OrderForm>
    </main>
  );
}
