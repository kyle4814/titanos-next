"use client";

import { useCallback, useEffect, useState } from "react";
import { browserApi, call, errorText, signOut, signedIn } from "@/lib/portal";

const btn = { padding: "8px 14px", background: "transparent", color: "var(--ice)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" } as const;
const REFUND_TEXT: Record<string, string> = {
  outside_14_days: "This is outside the 14-day refund window, so Kyle reviews it personally and replies by email.",
  deliverable_issued: "A deliverable has already been issued, so Kyle reviews it personally and replies by email.",
  monitor_no_refund_current_period: "Monitor is not refunded for the current period. Cancel to stop future charges. Kyle will review anything unusual.",
  scope_terms_apply: "Refund terms for this offer are in your written scope, so Kyle reviews it personally and replies by email.",
  already_refunded: "Already refunded.",
};
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

export default function BillingClient() {
  const [data, setData] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    try { const [b, i] = await Promise.all([call(browserApi(), "GET", "/billing"), call(browserApi(), "GET", "/invoices")]); setData(b); setInvoices(i.invoices); }
    catch (e) { setMsg(errorText(e)); }
  }, []);
  useEffect(() => { if (signedIn(browserApi())) load(); else setMsg("Sign in from any order page to see your billing."); }, [load]);

  const act = async (fn: () => Promise<string>) => { try { setMsg(await fn()); await load(); } catch (e) { setMsg(errorText(e)); } };
  const cancel = (id: string) => act(async () => { const r = await call(browserApi(), "POST", `/subscriptions/${id}/cancel`); return `Cancellation scheduled. Service ends ${new Date(r.effectiveAt).toLocaleDateString("en-AU")}.`; });
  const refund = (id: string) => act(async () => { const r = await call(browserApi(), "POST", "/refunds", { purchaseId: id }); return r.status === "refunded" ? "Refunded in full. It reaches your card in 5 to 10 business days." : REFUND_TEXT[r.reason] ?? "Sent for review."; });
  const invoice = async (id: string) => { try { const t = await call(browserApi(), "GET", `/invoices/${id}`); const w = window.open("", "_blank"); if (w) { w.document.write(`<pre>${esc(String(t))}</pre>`); w.document.close(); } } catch (e) { setMsg(errorText(e)); } };
  const exportData = async () => { try { const j = await call(browserApi(), "GET", "/account/export"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(j, null, 2)], { type: "application/json" })); a.download = "titanos-my-data.json"; a.click(); } catch (e) { setMsg(errorText(e)); } };
  const del = () => { if (window.confirm("Delete your account? Subscriptions are cancelled and your details are erased. Invoices are kept without your email, as tax law requires.")) act(async () => { await call(browserApi(), "DELETE", "/account", { confirm: "DELETE" }); signOut(browserApi()); setData(null); return "Account deleted."; }); };

  return (
    <main style={{ padding: "100px 20px 80px", maxWidth: 760, margin: "0 auto", color: "var(--text)" }}>
      <h1 style={{ color: "var(--ice)" }}>Billing</h1>
      {msg && <p role="status">{msg}</p>}
      {data && (<>
        <h2>Purchases</h2>
        {data.purchases.length === 0 && <p>No purchases yet.</p>}
        {data.purchases.map((p: any) => {
          const sub = data.subscriptions.find((s: any) => s.purchaseId === p.id);
          return (
            <div key={p.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
              <span>{p.productId.replace(/_/g, " ")} · AU${(p.amountCents / 100).toFixed(2)} · {p.status}{sub?.cancelAt ? ` · ends ${new Date(sub.cancelAt).toLocaleDateString("en-AU")}` : ""}</span>
              <span style={{ display: "flex", gap: 8 }}>
                {sub && !sub.cancelAt && !sub.cancelledAt && <button style={btn} onClick={() => cancel(sub.id)}>Cancel</button>}
                {p.status === "paid" && <button style={btn} onClick={() => refund(p.id)}>Request refund</button>}
              </span>
            </div>
          );
        })}
        {data.portalUrl && <p><a href={data.portalUrl}>Update your card on Stripe</a></p>}
        <h2>Invoices</h2>
        {invoices.length === 0 && <p>No invoices yet.</p>}
        {invoices.map((i) => (<p key={i.id}><button style={btn} onClick={() => invoice(i.id)}>{i.number}</button> AU${(i.amountCents / 100).toFixed(2)}</p>))}
        <h2>Your data</h2>
        <p style={{ display: "flex", gap: 10 }}><button style={btn} onClick={exportData}>Download my data</button><button style={{ ...btn, color: "#ff6b6b" }} onClick={del}>Delete my account</button></p>
      </>)}
    </main>
  );
}
