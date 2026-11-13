import type { EntStore } from "./enterprise/store.ts";
import type { PayoutProvider } from "./enterprise/types.ts";
import type { TransferLookup } from "./enterprise/payout_sweep.ts";
// Bindings the Worker receives. Mirrors the live titanos-api Worker (bundle backup, 2026-08-08) so the
// portal can reuse its D1 database and Stripe secrets; new bindings are added here, never read ad hoc.
export interface D1Statement {
  bind(...args: unknown[]): D1Statement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ meta?: { changes?: number } } | unknown>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}
export interface D1Like {
  prepare(sql: string): D1Statement;
  batch?(stmts: D1Statement[]): Promise<unknown[]>; // D1 batch = one implicit transaction, all or nothing
}
// The payout side of the scheduled tick. Absent = the tick is a labelled no-op. A real Stripe Connect adapter is GATE1/GATE2.
export interface PayoutsBinding {
  store: EntStore;
  transfer: PayoutProvider & Partial<TransferLookup>;
  lookup?: TransferLookup;
  maxRows?: number;
}
// The payout side of the scheduled tick. Absent = the tick is a labelled no-op. A real Stripe Connect adapter is GATE1/GATE2.
export interface PayoutsBinding {
  store: EntStore;
  transfer: PayoutProvider & Partial<TransferLookup>;
  lookup?: TransferLookup;
  maxRows?: number;
}
export interface Env {
  payouts?: PayoutsBinding;    // injected adapter set (mock in tests); never built from secrets here
  DB?: D1Like;                 // D1 database (same one the live titanos-api uses)
  DRAIN_TICK_ENABLED?: string; // f334: shop drain tick runs only when exactly "1"; absent = off
  STRIPE_MODE?: string;        // "test" | "live"; anything else is treated as "test"
  TITANOS_SITE_ORIGIN?: string;
  STRIPE_SECRET_KEY?: string;      // never echoed
  STRIPE_WEBHOOK_SECRET?: string;  // never echoed
  INTERNAL_API_SECRET?: string;    // never echoed
  SSO_SEAL_KEYS?: string;          // JSON keyring for sealing SSO client secrets (never echoed); absent = SSO config answers 503
  RECEIPT_SECRET?: string;         // HMAC secret that signs agent receipts (never echoed)
  LIVE_BILLING_ARMED?: string;     // "yes-YYYY-MM-DD": the explicit arming word live Stripe mode requires (build_deps.ts assertLiveArmed)
  MAIL_RELAY?: { fetch(req: Request): Promise<Response> };   // service binding to the titanos-api Worker (MAIL_PROVIDER="relay")
  MAIL_RELAY_SECRET?: string;      // shared bearer secret for the relay route (never echoed)
  MAIL_PROVIDER?: string;          // "relay" | "resend"; unset = DEV_OUTBOX / 503 behaviour unchanged
  RESEND_API_KEY?: string;         // never echoed
  MAIL_FROM?: string;              // sender address for login mail, on a domain verified with the provider
  TITANOS_EXTRA_ORIGINS?: string;  // optional comma list of additional browser origins CORS may echo (e.g. https://www.titanos.tech)
  LOGIN_IP_LIMIT?: string;         // optional: login-link requests allowed per client IP per hour (default 10)
  LOGIN_GLOBAL_LIMIT?: string;     // optional: login-link requests allowed in total per hour (default 200)
  DEV_OUTBOX?: string;            // TEST MODE only: "1" parks outgoing mail in the dev_outbox table (0025); refused when STRIPE_MODE is "live"
  ESTATE_KV?: { get(key: string): Promise<string | null>; put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> };  // C8 f321: optional KV namespace for the estate cache + refresh limiter; absent = Memory adapters
}
