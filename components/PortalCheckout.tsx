"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addDomain, browserApi, errorText, requestLogin, signedIn, startCheckout, verifyDomain } from "@/lib/portal";

export interface CheckoutProduct { id: string; label: string; needsDomain: boolean }

const box = { background: "var(--surface, #111)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column" as const, gap: 16 };
const input = { width: "100%", padding: "12px 14px", background: "var(--bg, #080808)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, fontSize: "var(--fs-body)" };
const btn = { padding: "14px 18px", background: "var(--gold)", color: "#000", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: "var(--fs-body)" };

// One path for every paid offer: sign in by email link, prove the domain (where the offer touches one), pay on Stripe.
export default function PortalCheckout({ heading, products }: { heading: string; products: CheckoutProduct[] }) {
  const [product, setProduct] = useState(products[0].id);
  const [step, setStep] = useState<"email" | "sent" | "buy">("email");
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [record, setRecord] = useState<{ id: string; name: string; value: string; verified: boolean } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = products.find((p) => p.id === product)!;
  const blocked = chosen.needsDomain && !record?.verified;

  useEffect(() => { if (signedIn(browserApi())) setStep("buy"); }, []);

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setMsg("");
    try { await fn(); } catch (e) { setMsg(errorText(e)); } finally { setBusy(false); }
  }
  const sendLink = () => run(async () => { await requestLogin(browserApi(), email.trim()); setStep("sent"); });
  const addDom = () => run(async () => { const d = await addDomain(browserApi(), domain); setRecord({ id: d.id, name: d.record.name, value: d.record.value, verified: d.verified }); });
  const check = () => run(async () => { const d = await verifyDomain(browserApi(), record!.id); setRecord({ ...record!, verified: d.verified }); });
  const pay = () => run(async () => { const r = await startCheckout(browserApi(), product, chosen.needsDomain ? domain : undefined); window.location.href = r.checkoutUrl; });

  return (
    <div style={{ padding: "40px 20px 60px" }}>
      <div style={box}>
        <h2 style={{ color: "var(--ice)", margin: 0 }}>{heading}</h2>
        <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <legend style={{ color: "var(--ice)", marginBottom: 8 }}>Choose</legend>
          {products.map((p) => (
            <label key={p.id} style={{ display: "flex", gap: 10, color: "var(--text)", cursor: "pointer" }}>
              <input type="radio" name="product" value={p.id} checked={product === p.id} onChange={() => setProduct(p.id)} style={{ accentColor: "var(--gold)" }} />
              {p.label}
            </label>
          ))}
        </fieldset>

        {step === "email" && (<>
          <label style={{ color: "var(--ice)" }}>Your email
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbusiness.com.au" style={{ ...input, marginTop: 6 }} />
          </label>
          <button type="button" onClick={sendLink} disabled={busy} style={btn}>EMAIL ME A LOGIN LINK →</button>
          <small style={{ color: "var(--muted, #999)" }}>No password. One login for scans, billing and invoices.</small>
        </>)}

        {step === "sent" && (
          <p style={{ color: "var(--text)", margin: 0 }}>Check your inbox for a login link (valid 15 minutes). Open it in this browser, then come back to this page to pay.</p>
        )}

        {step === "buy" && (<>
          {chosen.needsDomain && (<>
            <label style={{ color: "var(--ice)" }}>Domain you own
              <input value={domain} onChange={(e) => { setDomain(e.target.value); setRecord(null); }} placeholder="yourbusiness.com.au" style={{ ...input, marginTop: 6 }} />
            </label>
            {!record && <button type="button" onClick={addDom} disabled={busy || !domain} style={btn}>GET MY VERIFICATION RECORD</button>}
            {record && !record.verified && (<>
              <p style={{ color: "var(--text)", margin: 0 }}>Add this DNS TXT record, then check. It proves the site is yours, so nobody else can order work on your domain.</p>
              <pre style={{ ...input, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{`Type: TXT\nName: ${record.name}\nValue: ${record.value}`}</pre>
              <button type="button" onClick={check} disabled={busy} style={btn}>CHECK MY RECORD</button>
            </>)}
            {record?.verified && <p style={{ color: "var(--gold)", margin: 0 }}>Domain verified.</p>}
          </>)}
          <button type="button" onClick={pay} disabled={busy || blocked} style={{ ...btn, opacity: busy || blocked ? 0.5 : 1 }}>PAY SECURELY WITH STRIPE →</button>
          <small style={{ color: "var(--muted, #999)" }}>Stripe takes your card; we never see it. Refunds and cancellation follow the <Link href="/terms">terms</Link>. <Link href="/app/billing">Billing, invoices and your data</Link>.</small>
        </>)}
        {msg && <p role="alert" style={{ color: "#ff6b6b", margin: 0 }}>{msg}</p>}
      </div>
    </div>
  );
}
