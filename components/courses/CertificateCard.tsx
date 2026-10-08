"use client";

import { useState } from "react";

export default function CertificateCard({ title, course, disclosure }: { title: string; course: string; disclosure: string }) {
  const [name, setName] = useState("");
  const date = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div>
      <label className="no-print" style={{ display: "block", color: "var(--text)", marginBottom: 18 }}>
        Your name, as you want it printed (it stays in your browser and is never sent anywhere)
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} style={{ display: "block", marginTop: 8, width: "100%", padding: 12, background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }} />
      </label>
      <div style={{ border: "2px solid var(--gold-dim)", borderRadius: "var(--radius-md)", padding: "40px 24px", textAlign: "center", background: "var(--card)" }}>
        <p className="label-system" style={{ color: "var(--gold)" }}>TITANOS</p>
        <h2 style={{ fontFamily: "var(--font-display), Georgia, serif", color: "var(--ice)", margin: "14px 0" }}>{title}</h2>
        <p style={{ color: "var(--text)" }}>This certifies that</p>
        <p style={{ fontFamily: "var(--font-display), Georgia, serif", color: "var(--gold)", fontSize: "var(--fs-h3)", minHeight: 44, margin: "10px 0" }}>{name.trim() || "Your name"}</p>
        <p style={{ color: "var(--text)", lineHeight: 1.7 }}>completed the written course {course} and passed the end-of-course quiz.</p>
        <p style={{ color: "var(--text)", marginTop: 14 }}>{date}</p>
        <p style={{ color: "var(--ice)", fontSize: "var(--fs-sm)", marginTop: 22, lineHeight: 1.7 }}>
          Self-assessed completion record. It is not an accredited qualification. {disclosure}
        </p>
      </div>
      <button type="button" className="no-print label-system" onClick={() => window.print()} style={{ marginTop: 18, padding: "12px 22px", border: "1px solid var(--gold-dim)", background: "var(--card)", color: "var(--gold)", cursor: "pointer" }}>Print or save as PDF</button>
    </div>
  );
}
