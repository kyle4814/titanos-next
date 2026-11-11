"use client";
// Partner seat: the book of clients (f313). PartnerBookView is purely presentational (state in, markup out) so the render test
// can drive every state; PartnerBook fetches GET /partner/book for the signed-in partner seat. No outreach, no scanning.
import { useEffect, useState } from "react";
import { browserApi } from "@/lib/portal";
import * as ent from "@/lib/portal-ent";
import { LOADING_TEXT, SAMPLE_PAGE, SYNTHETIC_LABEL, bookStateFromError, bookStateFromPage, type BookState } from "@/lib/partner-book-ui";

const box = { border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginTop: 20, background: "var(--surface, #111)", display: "flex", flexDirection: "column", gap: 10 } as const;
const btn = { minHeight: 44, padding: "8px 14px", background: "transparent", color: "var(--ice)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" } as const;

export function PartnerBookView({ state, synthetic = false, onMore }: { state: BookState; synthetic?: boolean; onMore?: () => void }) {
  if (state.kind === "loading") return <section style={box} aria-label="Book of clients" aria-busy="true"><h2 style={{ margin: 0 }}>Book of clients</h2><p role="status" style={{ margin: 0 }}>{LOADING_TEXT}</p></section>;
  if (state.kind === "error") return <section style={box} aria-label="Book of clients"><h2 style={{ margin: 0 }}>Book of clients</h2><p role="alert" data-code={state.code} style={{ margin: 0 }}>{state.text}</p></section>;
  const v = state.view;
  if (!v.ok) return <section style={box} aria-label="Book of clients"><h2 style={{ margin: 0 }}>Book of clients</h2><p role="alert" style={{ margin: 0 }}>{v.message}</p></section>;
  return (
    <section style={box} aria-label="Book of clients">
      <h2 style={{ margin: 0 }}>Book of clients</h2>
      {synthetic && <p style={{ margin: 0 }}><strong>{SYNTHETIC_LABEL}</strong></p>}
      <ul aria-label="Book totals" style={{ display: "flex", gap: 16, flexWrap: "wrap", listStyle: "none", padding: 0, margin: 0 }}>
        <li>Clients: {v.totals.clients}</li><li>Share accrued: {v.totals.accrued}</li><li>Held: {v.totals.held}</li><li>Paid out: {v.totals.paidOut}</li>
        {v.totals.unsourcedCents !== 0 && <li>Not tied to a client: {v.totals.unsourced}</li>}
      </ul>
      {!v.reconciled && <p role="alert" style={{ margin: 0 }}>The rows below do not add up to the ledger total. Do not rely on this list. Email us and we will check it.</p>}
      {v.empty ? <p style={{ margin: 0 }}>{v.emptyText}</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th align="left">Client</th><th align="left">Domain</th><th align="left">Plan</th><th align="left">Status</th><th align="right">Share accrued</th><th align="left">Re-scan proof</th></tr></thead>
          <tbody>
            {v.rows.map((r) => (
              <tr key={r.key} data-unattributed={r.unattributed ? "1" : undefined}>
                <td>{r.client}</td><td>{r.domain}</td><td>{r.plan}</td><td>{r.status}</td><td align="right">{r.share}</td><td>{r.proof}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p style={{ margin: 0 }}>{v.note}</p>
      {v.more && onMore && <button style={btn} onClick={onMore}>Next page</button>}
    </section>
  );
}

export default function PartnerBook({ partnerId }: { partnerId: string }) {
  const [state, setState] = useState<BookState>({ kind: "loading" });
  const [cursor, setCursor] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    ent.book(browserApi(), partnerId, cursor ?? undefined).then((page) => { if (live) setState(bookStateFromPage(page)); }).catch((e) => { if (live) setState(bookStateFromError(e)); });
    return () => { live = false; };
  }, [partnerId, cursor]);
  const next = state.kind === "ready" && state.view.ok && state.view.more ? state.view.nextCursor : null;
  return <PartnerBookView state={state} onMore={next ? () => setCursor(next) : undefined} />;
}

/** The labelled synthetic example, for the public partners page and tests. Reads nothing. */
export function PartnerBookExample() {
  return <PartnerBookView state={bookStateFromPage(SAMPLE_PAGE)} synthetic />;
}
