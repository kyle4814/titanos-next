"use client";

import { useState } from "react";

const FIELDS: { name: string; label: string; type?: string; required?: boolean }[] = [
  { name: "business", label: "Business name", required: true },
  { name: "contact", label: "Contact name", required: true },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "phone", label: "Phone" },
  { name: "website", label: "Website or domain" },
  { name: "sector", label: "Trade or sector" },
  { name: "postcode", label: "Postcode" },
];

const label = { color: "var(--pe-text)", fontSize: "var(--pe-fs-sm, 0.9rem)", fontWeight: 600, display: "grid", gap: 6 } as const;

export default function WelcomeForm({ offerName }: { offerName: string }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = [...FIELDS.map((f) => `${f.label}: ${vals[f.name] ?? ""}`), `Anything we should know: ${vals.notes ?? ""}`].join("\n");
    window.location.href = `mailto:kyle@titanos.tech?subject=${encodeURIComponent(`Onboarding: ${offerName}`)}&body=${encodeURIComponent(body)}`;
  };
  return (
    <form onSubmit={submit} className="pe-card pe-card--pad" style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto", display: "grid", gap: 16 }}>
      {FIELDS.map((f) => (
        <label key={f.name} style={label}>
          {f.label}{f.required ? " *" : ""}
          <input type={f.type ?? "text"} required={f.required} value={vals[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} />
        </label>
      ))}
      <label style={label}>
        Anything we should know
        <textarea style={{ minHeight: 110 }} value={vals.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </label>
      <button type="submit" className="pe-btn pe-btn--gold pe-btn--lg" style={{ justifySelf: "start" }}>
        SEND TO KYLE →
      </button>
    </form>
  );
}
