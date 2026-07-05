"use client";

import OrderForm, { Field } from "@/components/OrderForm";
import { DISPLAY, PRICING } from "@/lib/pricing";

const PLANS = [
  { value: "monthly", label: `Monthly — ${DISPLAY.MONITOR_MONTHLY}` },
  {
    value: "annual",
    label: `Annual — ${DISPLAY.MONITOR_ANNUAL} (save AU$${
      PRICING.MONITOR_MONTHLY * 12 - PRICING.MONITOR_ANNUAL
    }/yr)`,
  },
];

export default function OrderMonitorClient() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--vault-bg, #080808)",
        padding: "80px 20px 60px",
      }}
    >
      <OrderForm
        orderType="monitor"
        heading="Monthly Security Monitor — Enquiry"
        subheading="Monthly security check for your business. You get an email when something changes. Kyle reviews this and sends your invoice within 1 business day."
        submitLabel="SUBMIT MONITOR ORDER →"
        successMessage="Received. Kyle will send your Stripe invoice within 1 business day — pay when you're ready, monitoring starts same day."
      >
        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />

        <div>
          <label
            style={{
              color: "var(--ice)",
              fontSize: "var(--fs-sm)",
              fontWeight: 500,
              display: "block",
              marginBottom: 10,
            }}
          >
            Plan
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PLANS.map((p) => (
              <label
                key={p.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "var(--text)",
                  fontSize: "var(--fs-body)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="scope_plan"
                  value={p.value}
                  defaultChecked={p.value === "monthly"}
                  style={{ accentColor: "var(--gold)" }}
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        <Field
          label="Website(s) to monitor (one per line)"
          name="scope_websites"
          as="textarea"
          rows={3}
          placeholder={"yourbusiness.com.au\napp.yourbusiness.com.au"}
          hint="Domain names only, no https://. Multiple domains monitored under the same subscription."
        />

        <Field
          label="Any specific security concerns? (optional)"
          name="scope_concerns"
          as="textarea"
          rows={2}
          placeholder="e.g. Previous breach, upcoming PCI audit, client contractual requirement…"
        />
      </OrderForm>
    </main>
  );
}
