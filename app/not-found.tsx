import Link from "next/link";
import { OmegaSeal } from "@/components/Myth";

export default function NotFound() {
  return (
    <main
      style={{
        position: "relative",
        zIndex: 2,
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-30) 20px",
        textAlign: "center",
      }}
    >
      <OmegaSeal caption="This edge of the system has nothing behind it." />
      <h1
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontStyle: "italic",
          fontWeight: 400,
          color: "var(--ice)",
          fontSize: "var(--fs-h3)",
          marginTop: 28,
          marginBottom: 12,
        }}
      >
        There&apos;s nothing built here.
      </h1>
      <p
        style={{
          color: "var(--dim)",
          fontSize: "var(--fs-body)",
          maxWidth: "var(--maxw-prose)",
          marginBottom: 32,
          lineHeight: 1.65,
        }}
      >
        The page you were looking for doesn&apos;t exist, or was retired. Nothing to fix on
        your end — just a wrong turn.
      </p>
      <Link
        href="/"
        aria-label="Return to titanos.tech home"
        style={{
          color: "var(--gold)",
          fontFamily: "var(--font-display), Georgia, serif",
          letterSpacing: "0.08em",
          fontSize: "var(--fs-sm)",
          padding: "14px 28px",
          border: "1px solid var(--gold)",
          borderRadius: "var(--radius-sm)",
          textDecoration: "none",
          textTransform: "uppercase",
        }}
      >
        Return to titanos.tech →
      </Link>
    </main>
  );
}
