import Link from "next/link";

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
      <h1
        style={{
          fontFamily: "'Cinzel', serif",
          color: "var(--gold)",
          fontSize: "var(--fs-h2)",
          fontWeight: 700,
          letterSpacing: "0.08em",
          marginBottom: 16,
        }}
      >
        This vault is empty.
      </h1>
      <p
        style={{
          color: "var(--dim)",
          fontSize: "var(--fs-body)",
          maxWidth: 480,
          marginBottom: 32,
          lineHeight: 1.65,
        }}
      >
        The page you’re looking for doesn’t exist — or has been sealed.
      </p>
      <Link
        href="/"
        aria-label="Return to titanos.tech home"
        style={{
          color: "var(--gold)",
          fontFamily: "'Cinzel', serif",
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
