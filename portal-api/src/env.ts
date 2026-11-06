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
  STRIPE_MODE?: string;        // "test" | "live"; anything else is treated as "test"
  TITANOS_SITE_ORIGIN?: string;
  STRIPE_SECRET_KEY?: string;      // never echoed
  STRIPE_WEBHOOK_SECRET?: string;  // never echoed
  INTERNAL_API_SECRET?: string;    // never echoed
}
