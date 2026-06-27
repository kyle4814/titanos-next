"use client";

export default function PdfViewer({
  src,
  label,
  fallbackHref,
}: {
  src: string;
  label?: string;
  fallbackHref?: string;
}) {
  return (
    <div style={{ width: "100%", minHeight: 600, position: "relative" }}>
      <iframe
        src={src}
        title={label ?? "PDF viewer"}
        aria-label={label}
        style={{ width: "100%", height: 700, border: "none", display: "block" }}
      />
      {fallbackHref && (
        <p
          style={{
            textAlign: "center",
            fontSize: "var(--fs-sm)",
            color: "var(--dim)",
            marginTop: 8,
          }}
        >
          Can&apos;t see the PDF?{" "}
          <a
            href={fallbackHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--gold)", textDecoration: "underline" }}
          >
            Open directly →
          </a>
        </p>
      )}
    </div>
  );
}
