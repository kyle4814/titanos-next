"use client";
import { useId, useState } from "react";
import { PROVIDERS, buildRecord, analyse, LIMIT, type Policy } from "./spf";

const tokens = (s: string) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
const DOMAIN = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/i;
const IPISH = /^[0-9a-f:.\/]+$/i;
const MARK = { ok: "OK", warn: "Check", fail: "Fix" } as const;

export default function SpfBuilder() {
  const uid = useId();
  const [picked, setPicked] = useState<string[]>(["google"]);
  const [extra, setExtra] = useState("");
  const [ips, setIps] = useState("");
  const [useMx, setUseMx] = useState(false);
  const [policy, setPolicy] = useState<Policy>("~all");
  const [override, setOverride] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const ipList = tokens(ips).filter((t) => IPISH.test(t));
  const built = buildRecord({
    providerIds: picked,
    extraIncludes: tokens(extra).filter((t) => DOMAIN.test(t)),
    ip4: ipList.filter((t) => !t.includes(":")),
    ip6: ipList.filter((t) => t.includes(":")),
    useMx,
    policy,
  });
  const record = override ?? built;
  const a = analyse(record);
  const toggle = (id: string) => { setOverride(null); setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); };
  const copy = async () => { try { await navigator.clipboard.writeText(record); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } };
  const pct = Math.min(100, (a.lookups / LIMIT) * 100);

  return (
    <div className="spf-tool">
      <form className="spf-card spf-card--in" onSubmit={(e) => e.preventDefault()} aria-label="Build your record">
        <h2>1. Pick what sends your email</h2>
        <ul className="spf-prov">
          {PROVIDERS.map((p) => (
            <li key={p.id}>
              <label>
                <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
                <span>{p.name}<span className="spf-tag">{p.status === "provider-doc" ? "From provider docs" : p.status === "third-party" ? "Third-party guides" : "No include published"}</span>
                  <small>{p.use}{p.include ? ` (include:${p.include})` : ""}</small></span>
              </label>
              <p className="spf-note">{p.note} <a href={p.source.url} rel="noopener noreferrer">{p.source.label}</a></p>
            </li>
          ))}
        </ul>
        <div className="spf-field">
          <label htmlFor={`${uid}-extra`}>Other include domains</label>
          <input id={`${uid}-extra`} value={extra} onChange={(e) => { setOverride(null); setExtra(e.target.value); }} placeholder="example: mail.yourprovider.com" autoCapitalize="none" spellCheck={false} />
          <p>Any other service that sends as you. Use the exact domain from that service&apos;s own SPF instructions. Separate several with spaces.</p>
        </div>
        <div className="spf-field">
          <label htmlFor={`${uid}-ips`}>Your own server IP addresses</label>
          <input id={`${uid}-ips`} value={ips} onChange={(e) => { setOverride(null); setIps(e.target.value); }} placeholder="example: 203.0.113.10 or 203.0.113.0/28" autoCapitalize="none" spellCheck={false} />
          <p>An office server, scanner or website host that sends mail. IP addresses cost no lookups.</p>
        </div>
        <div className="spf-field">
          <label><input type="checkbox" checked={useMx} onChange={(e) => { setOverride(null); setUseMx(e.target.checked); }} style={{ width: 20, minHeight: 0, marginRight: 10, accentColor: "#d4af37" }} />Also allow the servers in my MX record</label>
          <p>Only if your own mail servers also send. It costs one lookup.</p>
        </div>
        <div className="spf-field">
          <label htmlFor={`${uid}-pol`}>What to do with everything else</label>
          <select id={`${uid}-pol`} value={policy} onChange={(e) => { setOverride(null); setPolicy(e.target.value as Policy); }}>
            <option value="~all">~all: soft fail (start here)</option>
            <option value="-all">-all: hard fail (once every sender is listed)</option>
          </select>
        </div>
      </form>

      <section className="spf-card spf-card--out" aria-labelledby={`${uid}-out`} aria-live="polite">
        <h2 id={`${uid}-out`}>2. Your record and lookup count</h2>
        <div className="spf-field">
          <label htmlFor={`${uid}-rec`}>SPF record (edit it, or paste one you already have)</label>
          <textarea id={`${uid}-rec`} value={record} onChange={(e) => setOverride(e.target.value)} spellCheck={false} autoCapitalize="none" />
        </div>
        <button type="button" className="spf-btn" onClick={copy}>{copied ? "Copied" : "Copy record"}</button>{" "}
        {override !== null && <button type="button" className="spf-btn" onClick={() => setOverride(null)}>Rebuild from my choices</button>}
        <p className={`spf-meter spf-meter--${a.lookups > LIMIT ? "fail" : a.lookups >= 8 ? "warn" : "ok"}`}>{a.lookups}<small> of {LIMIT} lookups written directly</small></p>
        <div className={`spf-bar spf-bar--${a.lookups > LIMIT ? "fail" : a.lookups >= 8 ? "warn" : "ok"}`} role="img" aria-label={`${a.lookups} of ${LIMIT} lookups`}><i style={{ width: `${pct}%` }} /></div>
        <ul className="spf-find">
          {a.findings.map((f, i) => <li key={i} className={f.level}><b>{MARK[f.level]}</b>{f.text}</li>)}
        </ul>
        <p className="spf-note" style={{ marginLeft: 0, marginTop: 14 }}>Publish it as one TXT record on the exact domain you send from, at your domain host. A domain may have only one SPF record. Nothing you type here leaves your browser.</p>
      </section>
    </div>
  );
}
