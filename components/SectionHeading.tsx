"use client";

import { type ReactNode } from "react";
import VaultKeyhole from "./VaultKeyhole";

export default function SectionHeading({
  title,
  lead,
  showKeyhole = true,
}: {
  title: ReactNode;
  lead?: ReactNode;
  showKeyhole?: boolean;
}) {
  return (
    <div style={{ textAlign: "center", marginBottom: 42, position: "relative", zIndex: 2 }}>
      <h2
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontWeight: 400,
          fontStyle: "italic",
          fontSize: "var(--fs-h2)",
          color: "var(--gold)",
          letterSpacing: "0.02em",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {showKeyhole && <VaultKeyhole />}
        {title}
      </h2>
      <div
        aria-hidden="true"
        style={{
          width: 60,
          height: 2,
          background:
            "linear-gradient(90deg, transparent, var(--ice), transparent)",
          margin: "18px auto 0",
        }}
      />
      {lead && (
        <p
          style={{
            color: "var(--ice)",
            fontSize: "var(--fs-body)",
            maxWidth: "var(--maxw-prose)",
            margin: "18px auto 0",
            lineHeight: 1.7,
          }}
        >
          {lead}
        </p>
      )}
    </div>
  );
}
