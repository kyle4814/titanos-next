"use client";

import { useCallback, useEffect, useState } from "react";
import { browserApi, errorText, signedIn } from "@/lib/portal";
import * as ent from "@/lib/portal-ent";

const card = { background: "var(--surface, #111)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginTop: 20 } as const;
const input = { padding: "10px 12px", background: "var(--bg, #080808)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8 } as const;
const btn = { padding: "8px 14px", background: "transparent", color: "var(--ice)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" } as const;

// Estate view for an enterprise or client tenant. Every figure here comes from the API; the scan source is shown as the
// API labels it (SYNTHETIC until the real scanner is wired), never rewritten into something firmer.
export default function EstateClient() {
  const [tenants, setTenants] = useState<ent.Tenant[]>([]);
  const [tid, setTid] = useState("");
  const [view, setView] = useState<any>(null);
  const [rec, setRec] = useState<any>(null);
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [slug, setSlug] = useState("");
  const [msg, setMsg] = useState("");
  const api = () => browserApi();
  const act = async (fn: () => Promise<void>) => { try { setMsg(""); await fn(); } catch (e) { setMsg(errorText(e)); } };

  const load = useCallback(async (id: string) => { await act(async () => setView(await ent.estate(api(), id))); }, []);
  useEffect(() => {
    act(async () => {
      const done = await ent.finishSso(api(), window.location.hash, window.sessionStorage);
      if (done) window.history.replaceState(null, "", window.location.pathname);
      if (!signedIn(api())) { setMsg("Sign in with your email link from any order page, or use single sign-on below."); return; }
      const r = await ent.myTenants(api());
      const list = r.tenants.filter((t) => t.kind !== "partner");
      setTenants(list);
      const first = done?.tenantId ?? list[0]?.id;
      if (first) { setTid(first); await load(first); }
    });
  }, [load]);

  const me = tenants.find((t) => t.id === tid);
  const admin = me?.role === "admin";
  return (
    <main style={{ padding: "100px 20px 80px", maxWidth: 900, margin: "0 auto", color: "var(--text)" }}>
      <h1 style={{ color: "var(--ice)" }}>Estate</h1>
      <p>Preview. Findings shown here are labelled with their source. Nothing is scanned until you prove you own the domain.</p>
      {msg && <p role="status">{msg}</p>}
      <div style={card}>
        <h2>Single sign-on</h2>
        <input aria-label="Organisation address" style={input} placeholder="organisation address" value={slug} onChange={(e) => setSlug(e.target.value.trim().toLowerCase())} />{" "}
        <button style={btn} onClick={() => act(async () => { window.location.href = await ent.startSso(api(), slug, window.sessionStorage); })}>Sign in with SSO</button>
      </div>
      {tenants.length > 1 && <select aria-label="Organisation" style={{ ...input, marginTop: 20 }} value={tid} onChange={(e) => { setTid(e.target.value); load(e.target.value); }}>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
      {view && (
        <div style={card}>
          <h2>{view.tenant.name}</h2>
          <p>{view.totals.verified} of {view.totals.assets} domains verified. Critical {view.totals.critical}, high {view.totals.high}, medium {view.totals.medium}, low {view.totals.low}. Average score {view.totals.averageScore ?? "n/a"}.</p>
          <p style={{ opacity: 0.8 }}>Data source: {view.dataSource}</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th align="left">Domain</th><th align="left">Group</th><th>Grade</th><th>Findings</th><th /></tr></thead>
            <tbody>{view.assets.map((a: any) => (
              <tr key={a.id}><td>{a.label}</td><td>{a.group}</td><td align="center">{a.grade ?? "not verified"}</td>
                <td align="center">{a.verified ? a.findings.critical + a.findings.high + a.findings.medium + a.findings.low : "-"}</td>
                <td>{!a.verified && admin && <button style={btn} onClick={() => act(async () => { await ent.verifyAsset(api(), tid, a.id); await load(tid); })}>Verify</button>}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {admin && (<>
        <div style={card}>
          <h2>Add a domain</h2>
          <input aria-label="Domain" style={input} placeholder="example.com.au" value={domain} onChange={(e) => setDomain(e.target.value)} />{" "}
          <button style={btn} onClick={() => act(async () => { setRec((await ent.addAsset(api(), tid, domain)).record); await load(tid); })}>Add</button>
          {rec && <p>Publish a TXT record named <code>{rec.name}</code> with the value <code>{rec.value}</code>, then press Verify.</p>}
        </div>
        <div style={card}>
          <h2>Invite a member</h2>
          <input aria-label="Email" style={input} placeholder="name@company.com.au" value={email} onChange={(e) => setEmail(e.target.value)} />{" "}
          <select aria-label="Role" style={input} value={role} onChange={(e) => setRole(e.target.value)}><option>viewer</option><option>analyst</option><option>admin</option></select>{" "}
          <button style={btn} onClick={() => act(async () => { await ent.invite(api(), tid, email, role); setMsg("Invite sent. It is valid for 7 days."); })}>Invite</button>
        </div>
      </>)}
    </main>
  );
}
