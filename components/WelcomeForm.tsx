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

const input = {
  width: "100%", padding: "12px 14px", background: "var(--card)", color: "var(--text)",
  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", font: "inherit",
} as const;

export default function WelcomeForm({ offerName }: { offerName: string }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = [...FIELDS.map((f) => `${f.label}: ${vals[f.name] ?? ""}`), `Anything we should know: ${vals.notes ?? ""}`].join("\n");
    window.location.href = `mailto:kyle@titanos.tech?subject=${encodeURIComponent(`Onboarding: ${offerName}`)}&body=${encodeURIComponent(body)}`;
  };
  return (
    <form onSubmit={submit} style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto", display: "grid", gap: 14 }}>
      {FIELDS.map((f) => (
        <label key={f.name} style={{ color: "var(--ice)", fontSize: "var(--fs-sm)" }}>
          {f.label}{f.required ? " *" : ""}
          <input style={input} type={f.type ?? "text"} required={f.required} value={vals[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} />
        </label>
      ))}
      <label style={{ color: "var(--ice)", fontSize: "var(--fs-sm)" }}>
        Anything we should know
        <textarea style={{ ...input, minHeight: 100 }} value={vals.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </label>
      <button type="submit" style={{ padding: "14px 20px", background: "var(--gold)", color: "var(--vault-black, #0a0a0a)", border: 0, borderRadius: 999, fontWeight: 700, cursor: "pointer" }}>
        SEND TO KYLE →
      </button>
    </form>
  );
}
