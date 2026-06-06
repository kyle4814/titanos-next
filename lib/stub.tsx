import Link from "next/link";

/**
 * Minimal placeholder used by Phase-1 stub pages.
 * Phase 2 replaces these with the real per-page builds.
 */
export function stubPage(name: string) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-30) 20px",
        textAlign: "center",
        position: "relative",
        zIndex: 2,
      }}
    >
      <h1
        style={{
          fontFamily: "'Cinzel', serif",
          color: "var(--gold)",
          fontSize: "var(--fs-h2)",
          fontWeight: 700,
          letterSpacing: "0.06em",
          marginBottom: 18,
        }}
      >
        {name} — coming soon
      </h1>
      <p
        style={{
          color: "var(--ice)",
          fontSize: "var(--fs-body)",
          maxWidth: 520,
          marginBottom: 24,
          lineHeight: 1.6,
        }}
      >
        This page is being rebuilt. The live version is still at{" "}
        <a
          href={`https://titanos.tech/${slug(name)}.html`}
          style={{ color: "var(--ice)", borderBottom: "1px solid var(--ice)" }}
        >
          titanos.tech
        </a>
        .
      </p>
      <Link
        href="/"
        style={{
          color: "var(--gold)",
          fontFamily: "'Cinzel', serif",
          letterSpacing: "0.06em",
          fontSize: "var(--fs-sm)",
          padding: "12px 24px",
          border: "1px solid var(--gold-dim)",
          borderRadius: "var(--radius-sm)",
        }}
      >
        ← BACK TO HOME
      </Link>
    </div>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
