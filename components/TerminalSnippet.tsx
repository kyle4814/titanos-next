"use client";

/**
 * TerminalSnippet — AES-19 product-evidence visual.
 *
 * Renders a small gold-on-black monospace block that LOOKS like a CLI
 * scan output. Used on /scan to show prospects what I actually ship
 * before they ask for one. Content is redacted (target domain blanked)
 * and entries trace to real fingerprints routinely surfaced — not a
 * fabricated finding.
 *
 * EOL framing is intentional. The earlier draft paired MySQL 5.7.23
 * with CVE-2023-22094 (which is an Oracle Database Server CVE — not a
 * MySQL CVE) and tacked "KEX" (SSH terminology) onto the MySQL line.
 * Pairing a specific CVE to a specific version without a checked NVD
 * match is fabrication. Stating "EOL, unsupported, public CVEs apply"
 * is verifiable from version + vendor support calendars alone.
 *
 * Port scope matches the documented "standard 15-port external sweep"
 * referenced on /scan ("WHAT'S INSIDE THE REPORT"). Do not change one
 * without changing the other.
 *
 * Motion: the command line types character-by-character, then output
 * lines print one at a time — the way a real terminal behaves. The
 * full text is always in the DOM (untyped spans at opacity 0) so the
 * animation causes zero layout shift and crawlers/no-JS see all of it.
 * Triggered once via IntersectionObserver; prefers-reduced-motion
 * renders the settled state with a steady (non-blinking) cursor.
 */

import { useEffect, useRef, useState } from "react";

const LINES: Array<{ kind: "cmd" | "out" | "ok" | "warn"; text: string }> = [
  { kind: "cmd",  text: "$ nmap -sV --top-ports 15 [redacted].com.au" },
  { kind: "out",  text: "  PORT      STATE  SERVICE   VERSION" },
  { kind: "out",  text: "  443/tcp   open   ssl/http  nginx 1.18.0  (TLSv1.3 OK · cert 41d to expiry)" },
  { kind: "warn", text: "  3306/tcp  open   mysql     MySQL 5.7.42  -> EOL Oct 2023, unsupported, public CVEs apply" },
  { kind: "warn", text: "  21/tcp    open   ftp       vsftpd        -> cleartext auth, exposed to public internet" },
];

const CMD_CHAR_MS = 22;   // typing cadence on the command line
const OUT_LINE_MS = 170;  // pause between printed output lines
const CMD_PAUSE_MS = 350; // beat between Enter and first output line

const LINE_COLOR: Record<(typeof LINES)[number]["kind"], string> = {
  cmd: "var(--ice)",
  out: "var(--text)",
  ok: "var(--ok)",
  warn: "var(--warn)",
};

// progress = chars revealed on line 0 while typing, then 1000 + n for
// "command done, n output lines printed". DONE means everything shown.
const DONE = 1000 + (LINES.length - 1);

export default function TerminalSnippet() {
  // SSR + no-JS render the settled state; the effect below rewinds and
  // replays only when motion is allowed and the block scrolls into view.
  const [progress, setProgress] = useState(DONE);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const playedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = rootRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || playedRef.current) return;
        playedRef.current = true;
        io.disconnect();

        const timers: ReturnType<typeof setTimeout>[] = [];
        const cmdLen = LINES[0].text.length;
        for (let c = 0; c <= cmdLen; c++) {
          timers.push(setTimeout(() => setProgress(c), c * CMD_CHAR_MS));
        }
        const outStart = cmdLen * CMD_CHAR_MS + CMD_PAUSE_MS;
        for (let n = 1; n < LINES.length; n++) {
          timers.push(
            setTimeout(() => setProgress(1000 + n), outStart + (n - 1) * OUT_LINE_MS),
          );
        }
        (el as HTMLElement & { _timers?: typeof timers })._timers = timers;
      },
      { threshold: 0.35 },
    );

    setProgress(0);
    io.observe(el);
    return () => {
      io.disconnect();
      const timers = (el as HTMLElement & { _timers?: ReturnType<typeof setTimeout>[] })._timers;
      timers?.forEach(clearTimeout);
    };
  }, []);

  const cmdChars = progress >= 1000 ? LINES[0].text.length : progress;
  const outShown = progress >= 1000 ? progress - 1000 : 0;
  const done = progress >= DONE;
  // Cursor sits at the typing position, then at the end of the last
  // printed line, and keeps blinking after the run completes.
  const cursorLine = progress < 1000 ? 0 : Math.min(outShown, LINES.length - 1);

  return (
    <div
      ref={rootRef}
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
        boxShadow:
          "0 1px 0 rgb(var(--gold-rgb) / 0.06) inset, 0 0 32px rgb(var(--gold-rgb) / 0.05)",
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
      {/* One shared scroll container so long lines pan together on
          mobile instead of each line growing its own scrollbar. */}
      <div className="term-scroll" style={{ overflowX: "auto" }}>
        <div style={{ minWidth: "max-content" }}>
          {LINES.map((l, i) => {
            const isCmd = i === 0;
            const shownChars = isCmd ? cmdChars : outShown >= i ? l.text.length : 0;
            return (
              <div
                key={i}
                className="term-line"
                style={{ color: LINE_COLOR[l.kind], whiteSpace: "pre" }}
              >
                <span>{l.text.slice(0, shownChars)}</span>
                {i === cursorLine && (
                  <span className={done ? "term-cursor term-cursor-idle" : "term-cursor"} aria-hidden="true">
                    ▋
                  </span>
                )}
                {/* Untyped remainder holds the layout — invisible, not absent. */}
                <span style={{ opacity: 0 }} aria-hidden="true">
                  {l.text.slice(shownChars)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p
        style={{
          marginTop: 12,
          color: "var(--dim)",
          fontFamily: "var(--font-body), system-ui, sans-serif",
          fontSize: "var(--fs-xs)",
          lineHeight: 1.6,
        }}
      >
        Every line is a real fingerprint pattern I surface. Findings on your scan
        are anchored to a reproducible nmap command and matched to NVD.
      </p>
    </div>
  );
}
