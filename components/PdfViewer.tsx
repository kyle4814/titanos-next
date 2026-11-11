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
        // f421: Chromium never matches :focus / :focus-visible / :focus-within on the parent for a focused iframe, so no CSS
        // ring can show here. When a keyboard-reachable "Open directly" link is supplied it is the keyboard route to the PDF,
        // so the frame is taken out of the Tab order instead of being a stop with no visible indicator.
        tabIndex={fallbackHref ? -1 : undefined}
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
