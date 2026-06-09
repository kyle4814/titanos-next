/**
 * TerminalSnippet — AES-19 product-evidence visual.
 *
 * Renders a small gold-on-black monospace block that LOOKS like a CLI
 * scan output. Used on /scan to show prospects what we actually ship
 * before they ask for one. Content is redacted (target domain blanked)
 * and entries trace to real fingerprints we routinely surface — not a
 * fabricated finding.
 */

const LINES: Array<{ kind: "cmd" | "out" | "ok" | "warn"; text: string }> = [
  { kind: "cmd",  text: "$ nmap -sV -p- -T4 [redacted].com.au" },
  { kind: "out",  text: "  PORT      STATE  SERVICE   VERSION" },
  { kind: "warn", text: "  3306/tcp  open   mysql     MySQL 5.7.23  (CVE-2023-22094 KEX)" },
  { kind: "out",  text: "  443/tcp   open   ssl/http  nginx 1.18.0 (TLSv1.3 OK)" },
  { kind: "warn", text: "  21/tcp    open   ftp       cleartext auth — exposed" },
  { kind: "ok",   text: "  → 90-day responsible-disclosure window opened" },
];

export default function TerminalSnippet() {
  return (
    <div
      aria-label="Example external scan output — redacted"
      role="figure"
      style={{
        background: "var(--vault-bg)",
        border: "1px solid var(--gold-dim)",
        borderRadius: "var(--radius-md)",
        padding: "18px 22px",
        fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, monospace",
        fontSize: "var(--fs-sm)",
        lineHeight: 1.7,
        boxShadow: "0 1px 0 rgb(var(--gold-rgb) / 0.06) inset",
        position: "relative",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: "var(--gold-dim)",
          fontSize: "var(--fs-xs)",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        EXAMPLE OUTPUT · REDACTED
      </div>
      {LINES.map((l, i) => (
        <div
          key={i}
          style={{
            color:
              l.kind === "cmd"
                ? "var(--ice)"
                : l.kind === "warn"
                ? "var(--warn)"
                : l.kind === "ok"
                ? "var(--ok)"
                : "var(--text)",
            whiteSpace: "pre",
            overflowX: "auto",
          }}
        >
          {l.text}
        </div>
      ))}
      <p
        style={{
          marginTop: 12,
          color: "var(--dim)",
          fontFamily: "var(--font-body), system-ui, sans-serif",
          fontSize: "var(--fs-xs)",
          lineHeight: 1.6,
        }}
      >
        Every line is a real fingerprint pattern we surface. Findings on your scan
        are anchored to a reproducible nmap command and matched to NVD.
      </p>
    </div>
  );
}
