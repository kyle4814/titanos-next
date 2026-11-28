"use client";

/**
 * Email spoofing checker. Runs entirely in the browser: public DNS lookups through Cloudflare's
 * DNS-over-HTTPS JSON endpoint, then plain-English results. Nothing is stored and nothing is sent to titanos.tech.
 */
import { useId, useRef, useState } from "react";
import { runCheck, summaryText, type Finding, type FullResult } from "@/lib/emailSpoofCheck";

const LABEL: Record<Finding["severity"], string> = { good: "Good", warn: "Tidy up", bad: "Fix this", unknown: "Unknown" };

function Findings({ items }: { items: Finding[] }) {
  return (
    <ul className="dmc-findings">
      {items.map((f, i) => (
        <li key={i} className={`dmc-finding dmc-finding--${f.severity}`}>
          <span className="dmc-pill">{LABEL[f.severity]}</span>
          <div>
            <h4>{f.title}</h4>
            <p>{f.detail}</p>
            {f.fix ? <p className="dmc-fix"><strong>What to do.</strong> {f.fix}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Checker() {
  const inputId = useId();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FullResult | null>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setCopied(null);
    try {
      const r = await runCheck(value, (url, init) => fetch(url, { ...init, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" }));
      if ("error" in r) {
        setResult(null);
        setError(r.error);
      } else {
        setResult(r);
        setTimeout(() => resultRef.current?.focus(), 50);
      }
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(summaryText(result));
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }

  return (
    <div className="dmc-tool">
      <form onSubmit={onSubmit} className="dmc-form" noValidate>
        <label htmlFor={inputId}>Your business domain (the part after the @ in your email address)</label>
        <div className="dmc-row">
          <input
            id={inputId}
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="yourbusiness.com.au"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-describedby={`${inputId}-help`}
          />
          <button type="submit" className="pe-btn pe-btn--gold pe-btn--lg" disabled={busy}>
            {busy ? "Checking..." : "Check my domain"}
          </button>
        </div>
        <p id={`${inputId}-help`} className="dmc-help">Public DNS records only. Nothing is stored, and nothing is sent to us.</p>
      </form>

      <div role="status" aria-live="polite" className="dmc-live">
        {busy ? "Reading public DNS records. This takes a few seconds." : ""}
        {error ? <span className="dmc-error">{error}</span> : null}
      </div>

      {result ? (
        <div ref={resultRef} tabIndex={-1} className="dmc-result" aria-label={`Results for ${result.domain}`}>
          <div className={`dmc-verdict dmc-verdict--${result.verdict.level}`}>
            <p className="pe-kicker">Result for {result.domain}</p>
            <h3>{result.verdict.headline}</h3>
            <p><strong>Can someone send email pretending to be this business?</strong> {result.verdict.answer}</p>
          </div>

          <section aria-labelledby="dmc-r-dmarc">
            <h3 id="dmc-r-dmarc">DMARC: what receivers do with fake mail</h3>
            {result.dmarc.record ? <code className="dmc-code">{result.dmarc.record}</code> : null}
            <Findings items={result.dmarc.findings} />
          </section>
          <section aria-labelledby="dmc-r-spf">
            <h3 id="dmc-r-spf">SPF: which servers may send for you</h3>
            {result.spf.record ? <code className="dmc-code">{result.spf.record}</code> : null}
            {result.spf.found ? <p className="dmc-meta">DNS lookups used: {result.spf.lookupsAtLeast ? "at least " : ""}{result.spf.lookups} of 10 allowed.</p> : null}
            <Findings items={result.spf.findings} />
          </section>
          <section aria-labelledby="dmc-r-dkim">
            <h3 id="dmc-r-dkim">DKIM: the signature on your mail</h3>
            <p className="dmc-meta">Checked {result.dkim.checked} common selector names. {result.mx.provider ? `Your mail appears to be hosted with ${result.mx.provider}.` : ""}</p>
            <Findings items={result.dkim.findings} />
          </section>

          <div className="dmc-actions">
            <button type="button" className="pe-btn pe-btn--dark" onClick={copy}>Copy a summary for your IT person</button>
            <button type="button" className="pe-btn pe-btn--dark" onClick={() => window.print()}>Print this result</button>
            <span role="status" aria-live="polite" className="dmc-meta">{copied === "ok" ? "Copied. Paste it into an email." : copied === "fail" ? "Your browser blocked copying. Use Print instead." : ""}</span>
          </div>
          <p className="dmc-meta">Checked {result.checkedAt.slice(0, 10)}. A passing result describes the public records on that day; it does not guarantee delivery or that no one will ever spoof you.</p>
        </div>
      ) : null}
    </div>
  );
}
