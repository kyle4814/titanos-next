"use client";

import { useSearchParams } from "next/navigation";
import { onboardingFor } from "@/lib/checkout/onboarding.mjs";
import { SITE } from "@/lib/config";

type Step = { n: number; title: string; detail: string; intake?: string[] };

export default function SuccessClient() {
  const params = useSearchParams();
  const slug = params.get("slug") ?? "";
  const ob = onboardingFor(slug) as { name: string; steps: Step[] } | null;
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "var(--space-16) 20px", display: "grid", gap: 16 }}>
      <h1 style={{ color: "var(--ice)" }}>Thank you. Here is what happens next.</h1>
      {!ob && (
        <p style={{ color: "var(--text)" }}>
          Your payment went through. Email <a href={`mailto:${SITE.KYLE_EMAIL}`} style={{ color: "var(--ice)" }}>{SITE.KYLE_EMAIL}</a> with the name of what you bought and we will start.
        </p>
      )}
      {ob && (
        <>
          <p style={{ color: "var(--dim)", margin: 0 }}>{ob.name}</p>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {ob.steps.map((s) => (
              <li key={s.n} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "16px 20px", background: "var(--card)" }}>
                <strong style={{ color: "var(--gold)" }}>{s.n}. {s.title}</strong>
                <p style={{ color: "var(--text)", margin: "6px 0 0" }}>{s.detail}</p>
                {s.intake && (
                  <ul style={{ margin: "8px 0 0", color: "var(--text)" }}>
                    {s.intake.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          <p>
            <a href={`mailto:${SITE.KYLE_EMAIL}?subject=${encodeURIComponent(`Start: ${ob.name}`)}`} style={{ color: "var(--ice)", textDecoration: "underline" }}>Send the details by email</a>
          </p>
        </>
      )}
    </main>
  );
}
