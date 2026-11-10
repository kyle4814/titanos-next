"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { browserApi, call, signedIn } from "@/lib/portal";
import { SITE } from "@/lib/config";
import { CAP_DEFAULTS, CAP_MAX, KeysController, SCOPE_IDS, SCOPE_LABELS } from "@/lib/keysPage";

const btn = { padding: "8px 14px", background: "transparent", color: "var(--ice)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" } as const;
const box = { border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 10 } as const;
const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

export default function KeysClient() {
  const ctl = useMemo(() => new KeysController((m, p, b) => call(browserApi(), m, p, b as any), SITE.KYLE_EMAIL, () => signedIn(browserApi())), []);
  const s = useSyncExternalStore(ctl.subscribe, ctl.getState, ctl.getState);
  const [scopes, setScopes] = useState<string[]>(["catalogue:read"]);
  const [daily, setDaily] = useState(String(CAP_DEFAULTS.daily));
  const [total, setTotal] = useState(String(CAP_DEFAULTS.total));
  const [copied, setCopied] = useState(false);
  useEffect(() => { ctl.load(); return () => ctl.dismissFresh(); }, [ctl]); // leaving the page forgets the secret
  const toggle = (id: string) => setScopes((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const copy = async () => { if (s.fresh) { try { await navigator.clipboard.writeText(s.fresh.secret); setCopied(true); } catch { setCopied(false); } } };

  return (
    <main style={{ padding: "100px 20px 80px", maxWidth: 760, margin: "0 auto", color: "var(--text)" }}>
      <h1 style={{ color: "var(--ice)" }}>API keys</h1>
      <p>Keys let software call TITANOS on your account, for example an AI agent using the <a href="/agents">agent door</a>. Each key has its own permissions and its own spending limit. Credits are priced at an example rate of AU$0.01 each until pricing is final.</p>
      {s.message && <p role="status">{s.message}</p>}
      {s.status === "loading" && <p role="status">Loading your keys.</p>}
      {s.status === "signedout" && <p>Sign in from any <a href="/order/monitor">order page</a> to manage your keys.</p>}
      {s.status === "closed" && <p data-state="closed">API keys are not open yet. Nothing has been created and nothing can be spent.</p>}
      {s.status === "ready" && (<>
        {s.fresh && (
          <section aria-label="New key" style={{ ...box, borderColor: "var(--ice)" }}>
            <h2>Your new key</h2>
            <p>Copy it now. For your safety we keep only a fingerprint, so we cannot show it again.</p>
            <input readOnly aria-label="New API key" value={s.fresh.secret} onFocus={(e) => e.currentTarget.select()} style={{ width: "100%", padding: 8, fontFamily: "monospace" }} />
            <p style={{ display: "flex", gap: 10 }}>
              <button style={btn} onClick={copy}>{copied ? "Copied" : "Copy key"}</button>
              <button style={btn} onClick={() => { setCopied(false); ctl.dismissFresh(); }}>I have saved it</button>
            </p>
          </section>
        )}
        <h2>Your keys</h2>
        {s.keys.length === 0 && <p>No keys yet.</p>}
        {s.keys.map((k) => (
          <div key={k.id} data-key-id={k.id} data-revoked={k.revoked} style={{ ...box, opacity: k.revoked ? 0.6 : 1 }}>
            <p><code>{k.prefix ?? "(older key)"}</code> · {k.revoked ? "revoked" : "active"} · created {new Date(k.createdAt).toLocaleDateString("en-AU")}</p>
            <p>Permissions: {k.scopes.map((x) => SCOPE_LABELS[x] ?? x).join(", ") || "none"}</p>
            <p>Spent today {k.spentToday} of {k.capDaily} credits · spent in total {k.spentTotal} of {k.capTotal} credits</p>
            {!k.revoked && <CapForm k={k} onSave={(c) => ctl.setCaps(k.id, c)} onRevoke={() => { if (window.confirm("Revoke this key? Software using it stops working straight away.")) ctl.revoke(k.id); }} />}
          </div>
        ))}
        <h2>Create a key</h2>
        <fieldset style={box}>
          <legend>Permissions</legend>
          {SCOPE_IDS.map((id) => (<label key={id} style={{ display: "block" }}><input type="checkbox" checked={scopes.includes(id)} onChange={() => toggle(id)} /> {SCOPE_LABELS[id]}</label>))}
        </fieldset>
        <p style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <label>Daily limit (credits) <input inputMode="numeric" value={daily} onChange={(e) => setDaily(e.target.value)} style={{ width: 110 }} /></label>
          <label>Total limit (credits) <input inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} style={{ width: 130 }} /></label>
        </p>
        <p>Limits stop a leaked or runaway key spending more than you chose. Daily resets at midnight UTC. Maximum {CAP_MAX.daily} a day and {CAP_MAX.total} in total.</p>
        <button style={btn} onClick={() => { setCopied(false); ctl.create(scopes, { capDaily: num(daily), capTotal: num(total) }); }}>Create key</button>
      </>)}
    </main>
  );
}

function CapForm({ k, onSave, onRevoke }: { k: { capDaily: number; capTotal: number }; onSave: (c: { capDaily?: number; capTotal?: number }) => void; onRevoke: () => void }) {
  const [d, setD] = useState(String(k.capDaily)); const [t, setT] = useState(String(k.capTotal));
  return (
    <p style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <label>Daily <input inputMode="numeric" value={d} onChange={(e) => setD(e.target.value)} style={{ width: 90 }} /></label>
      <label>Total <input inputMode="numeric" value={t} onChange={(e) => setT(e.target.value)} style={{ width: 110 }} /></label>
      <button style={btn} onClick={() => onSave({ capDaily: num(d), capTotal: num(t) })}>Save limits</button>
      <button style={{ ...btn, color: "#ff6b6b" }} onClick={onRevoke}>Revoke</button>
    </p>
  );
}
