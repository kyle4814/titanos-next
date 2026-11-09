"use client";

import { useEffect, useState } from "react";
import { browserApi, errorText, signedIn } from "@/lib/portal";
import * as ent from "@/lib/portal-ent";

const card = { background: "var(--surface, #111)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginTop: 20 } as const;
const input = { padding: "10px 12px", background: "var(--bg, #080808)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8 } as const;
const btn = { padding: "8px 14px", background: "transparent", color: "var(--ice)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" } as const;

// Partner seat: your client portals (metadata only until a client allows sharing), the commission ledger and payouts.
// Rates shown are the ledger's own; they are EXAMPLE terms until the partner terms are signed off.
export default function PartnerClient() {
  const [partner, setPartner] = useState<ent.Tenant | null>(null);
  const [list, setList] = useState<any[]>([]);
  const [led, setLed] = useState<any>(null);
  const [f, setF] = useState({ name: "", slug: "", clientAdminEmail: "" });
  const [msg, setMsg] = useState("");
  const api = () => browserApi();
  const act = async (fn: () => Promise<void>) => { try { setMsg(""); await fn(); } catch (e) { setMsg(errorText(e)); } };
  const load = async (p: ent.Tenant) => { setList((await ent.portals(api(), p.id)).portals); setLed(await ent.ledger(api(), p.id)); };
  useEffect(() => {
    act(async () => {
      if (!signedIn(api())) { setMsg("Sign in first."); return; }
      const p = (await ent.myTenants(api())).tenants.find((t) => t.kind === "partner");
      if (!p) { setMsg("This login is not a partner account yet. Email us to join the partner programme."); return; }
      setPartner(p); await load(p);
    });
  }, []);
  if (!partner) return <main style={{ padding: "100px 20px", maxWidth: 900, margin: "0 auto", color: "var(--text)" }}><h1 style={{ color: "var(--ice)" }}>Partner</h1>{msg && <p role="status">{msg}</p>}</main>;
  return (
    <main style={{ padding: "100px 20px 80px", maxWidth: 900, margin: "0 auto", color: "var(--text)" }}>
      <h1 style={{ color: "var(--ice)" }}>{partner.name}</h1>
      <p>Preview. Your referral code: <code>{partner.refCode}</code>. You must say you earn a commission when you recommend us.</p>
      {msg && <p role="status">{msg}</p>}
      <div style={card}>
        <h2>Client portals</h2>
        {list.length === 0 && <p>No client portals yet.</p>}
        <ul>{list.map((c) => <li key={c.id}>{c.name} ({c.slug}). {c.sharing ? "Sharing their estate with you." : "Not sharing their estate with you."}</li>)}</ul>
        <input aria-label="Client name" style={input} placeholder="Client name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />{" "}
        <input aria-label="Portal address" style={input} placeholder="portal-address" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} />{" "}
        <input aria-label="Client admin email" style={input} placeholder="client admin email" value={f.clientAdminEmail} onChange={(e) => setF({ ...f, clientAdminEmail: e.target.value })} />{" "}
        <button style={btn} onClick={() => act(async () => { await ent.createPortal(api(), partner.id, f); setF({ name: "", slug: "", clientAdminEmail: "" }); await load(partner); })}>Create portal</button>
      </div>
      {led && (
        <div style={card}>
          <h2>Commission ledger</h2>
          <p>Available to pay out: {ent.aud(led.availableCents)}. {led.rateNote}.</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th align="left">Entry</th><th align="left">Source</th><th align="right">Amount</th><th align="left">Rate</th></tr></thead>
            <tbody>{led.entries.map((e: any) => <tr key={e.id}><td>{e.kind}</td><td>{e.source ?? "-"}</td><td align="right">{ent.aud(e.amountCents)}</td><td>{e.rateBps ? `${e.rateBps / 100}% (${e.rateVersion})` : "-"}</td></tr>)}</tbody>
          </table>
          <button style={{ ...btn, marginTop: 12 }} onClick={() => act(async () => { const r = await ent.requestPayout(api(), partner.id); setMsg(r.status === "pending_approval" ? "Payout requested. Larger payouts are approved by Kyle before they are sent." : "Payout sent."); await load(partner); })}>Request payout</button>
        </div>
      )}
    </main>
  );
}
