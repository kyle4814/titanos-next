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
  ESTATE_KV?: { get(key: string): Promise<string | null>; put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> };  // C8 f321: optional KV namespace for the estate cache + refresh limiter; absent = Memory adapters
}
