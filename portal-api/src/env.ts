// Bindings the Worker receives. Mirrors the live titanos-api Worker (bundle backup, 2026-08-08) so the
// portal can reuse its D1 database and Stripe secrets; new bindings are added here, never read ad hoc.
export interface D1Statement {
  bind(...args: unknown[]): D1Statement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}
export interface D1BatchResult { meta: { changes: number } }
export interface D1Like {
  prepare(sql: string): D1Statement;
  // Real D1: statements run in order inside ONE implicit transaction (all or nothing).
  batch(stmts: D1Statement[]): Promise<D1BatchResult[]>;
}
export interface Env {
  DB?: D1Like;                 // D1 database (same one the live titanos-api uses)
  STRIPE_MODE?: string;        // "test" | "live"; anything else is treated as "test"
  TITANOS_SITE_ORIGIN?: string;
  STRIPE_SECRET_KEY?: string;      // never echoed
  STRIPE_WEBHOOK_SECRET?: string;  // never echoed
  INTERNAL_API_SECRET?: string;    // never echoed
}
