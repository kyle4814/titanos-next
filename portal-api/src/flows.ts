// The 16 self-serve flows (plan line 1504: scan, read, sign up, verify a domain, buy, cancel, refund, hire, get paid,
// dispute, docs, status, API keys, invoices, data export, account deletion). The source says 14 elsewhere; this list
// is the 16 NAMED in the plan, and test/flows.test.ts pins the count at 16 so a silent edit fails.
export interface Flow { id: string; owner: "C2" | "C1" | "C4" | "static"; route?: string }
export const FLOWS: Flow[] = [
  { id: "scan", owner: "C1" }, { id: "read", owner: "C1" },
  { id: "signup", owner: "C2", route: "POST /auth/request + /auth/verify" },
  { id: "verify_domain", owner: "C2", route: "POST /domains, POST /domains/:id/verify" },
  { id: "buy", owner: "C2", route: "POST /checkout" },
  { id: "cancel", owner: "C2", route: "POST /subscriptions/:id/cancel" },
  { id: "refund", owner: "C2", route: "POST /refunds" },
  { id: "hire", owner: "C4", route: "POST /market/jobs (get this fixed), POST /pro/jobs/:id/claim" }, { id: "get_paid", owner: "C4", route: "GET /pro/payouts; payout only after re-scan" }, { id: "dispute", owner: "C4", route: "POST /market/jobs/:id/dispute" },
  { id: "docs", owner: "static", route: "/trust and /terms pages" },
  { id: "status", owner: "C2", route: "GET /health" },
  { id: "api_keys", owner: "C2", route: "POST/GET/DELETE /keys" },
  { id: "invoices", owner: "C2", route: "GET /invoices, GET /invoices/:id" },
  { id: "data_export", owner: "C2", route: "GET /account/export" },
  { id: "account_deletion", owner: "C2", route: "DELETE /account" },
];
