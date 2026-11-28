"use client";

/**
 * DMARC record generator. Runs entirely in the browser: no network request is made and nothing is stored.
 */
import { useId, useMemo, useState } from "react";
import { buildDmarc, type Alignment, type Policy } from "@/lib/dmarcGenerator";

const NOTE_LABEL = { ok: "Good", info: "Note", warn: "Check", error: "Fix" } as const;

export default function Generator() {
  const id = useId();
  const [domain, setDomain] = useState("");
  const [policy, setPolicy] = useState<Policy>("none");
  const [sub, setSub] = useState<Policy | "same">("same");
  const [rua, setRua] = useState("");
  const [pct, setPct] = useState("100");
  const [dkim, setDkim] = useState<Alignment>("r");
  const [spf, setSpf] = useState<Alignment>("r");
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  const pctNum = pct.trim() === "" ? 100 : Number(pct);
  const out = useMemo(
    () => buildDmarc({ domain, policy, subPolicy: sub, rua, pct: pctNum, dkim, spf }),
    [domain, policy, sub, rua, pctNum, dkim, spf],
  );

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied(null), 2500);
  }

  return (
    <div className="dmc-tool" data-dmarc-generator>
      <form className="dmc-gen-form" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="dmc-gen-grid">
          <div>
            <label htmlFor={`${id}-d`}>Your domain (optional)</label>
            <input id={`${id}-d`} className="dmc-field" inputMode="url" autoComplete="off" spellCheck={false} placeholder="yourbusiness.com.au" value={domain} onChange={(e) => setDomain(e.target.value)} />
            <p className="dmc-help">Only used to show the exact name to publish the record at.</p>
          </div>
          <div>
            <label htmlFor={`${id}-p`}>Policy (p)</label>
            <select id={`${id}-p`} className="dmc-field" value={policy} onChange={(e) => setPolicy(e.target.value as Policy)}>
              <option value="none">none: monitor only (start here)</option>
              <option value="quarantine">quarantine: send failing mail to junk</option>
              <option value="reject">reject: refuse failing mail</option>
            </select>
          </div>
          <div className="dmc-gen-wide">
            <label htmlFor={`${id}-r`}>Report mailbox (rua)</label>
            <input id={`${id}-r`} className="dmc-field" type="text" inputMode="email" autoComplete="off" spellCheck={false} placeholder="dmarc-reports@yourbusiness.com.au" value={rua} onChange={(e) => setRua(e.target.value)} />
            <p className="dmc-help">One or more addresses, separated by commas. Use a mailbox someone reads or a report service. Reports are daily XML files, so a shared mailbox is better than a personal inbox.</p>
          </div>
          <div>
            <label htmlFor={`${id}-pc`}>Percentage (pct)</label>
            <input id={`${id}-pc`} className="dmc-field" type="number" min={0} max={100} step={1} inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value)} />
            <p className="dmc-help">How much failing mail the policy covers. 100 is the default and is left out of the record.</p>
          </div>
          <div>
            <label htmlFor={`${id}-s`}>Subdomain policy (sp)</label>
            <select id={`${id}-s`} className="dmc-field" value={sub} onChange={(e) => setSub(e.target.value as Policy | "same")}>
              <option value="same">Same as the main policy</option>
              <option value="none">none</option>
              <option value="quarantine">quarantine</option>
              <option value="reject">reject</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-ad`}>DKIM alignment (adkim)</label>
            <select id={`${id}-ad`} className="dmc-field" value={dkim} onChange={(e) => setDkim(e.target.value as Alignment)}>
              <option value="r">Relaxed (default, suits most businesses)</option>
              <option value="s">Strict</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-as`}>SPF alignment (aspf)</label>
            <select id={`${id}-as`} className="dmc-field" value={spf} onChange={(e) => setSpf(e.target.value as Alignment)}>
              <option value="r">Relaxed (default, suits most businesses)</option>
              <option value="s">Strict</option>
            </select>
          </div>
        </div>
      </form>

      <div className="dmc-gen-out" aria-live="polite">
        <h3>Your DMARC record</h3>
        {out.valid ? (
          <>
            <dl className="dmc-gen-fields">
              <div><dt>Type</dt><dd>TXT</dd></div>
              <div><dt>Name (host)</dt><dd><code data-out-name>{out.host}</code></dd></div>
              <div><dt>Value</dt><dd><code className="dmc-code" data-out-value>{out.value}</code></dd></div>
            </dl>
            <div className="dmc-actions">
              <button type="button" className="pe-btn pe-btn--gold" onClick={() => copy(out.value)}>Copy the value</button>
              <button type="button" className="pe-btn pe-btn--dark" onClick={() => copy(`${out.host} TXT ${out.value}`)}>Copy name and value</button>
              <span className="dmc-live" role="status">{copied === "ok" ? "Copied." : copied === "fail" ? "Copy was blocked by the browser. Select the text and copy it by hand." : ""}</span>
            </div>
            <p className="dmc-help">Some DNS providers add your domain to the name for you. If so, enter just <code>_dmarc</code> as the name. Changes can take from a few minutes to a day to show up.</p>
          </>
        ) : (
          <p className="dmc-error" role="alert">Fix the items marked below and the record will appear.</p>
        )}

        {out.valid ? (
          <>
            <h4 className="dmc-gen-h4">What each part means</h4>
            <ul className="dmc-gen-tags">
              {out.tags.map((t) => (
                <li key={t.tag}><code>{t.tag}={t.value}</code> <span>{t.meaning}</span></li>
              ))}
            </ul>
          </>
        ) : null}

        {out.notes.length ? (
          <ul className="dmc-findings">
            {out.notes.map((n, i) => (
              <li key={i} className={`dmc-finding dmc-finding--${n.level === "ok" ? "good" : n.level === "warn" ? "warn" : n.level === "error" ? "bad" : "unknown"}`}>
                <span className="dmc-pill">{NOTE_LABEL[n.level]}</span>
                <div><p>{n.text}</p></div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
