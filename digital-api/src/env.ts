// Bindings the digital Worker receives. All DIGITAL_* names are this Worker's own: it shares nothing with titanos-portal-api,
// so going live here never changes how the portal Worker behaves. Secrets are never echoed or logged.
export interface D1Statement {
  bind(...args: unknown[]): D1Statement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ meta?: { changes?: number } } | unknown>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}
export interface D1Like { prepare(sql: string): D1Statement }
export interface R2ObjectLike { body: ReadableStream | null; size: number; httpEtag?: string }
export interface R2Like { get(key: string): Promise<R2ObjectLike | null> }
export interface KVLike { get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null> }
export interface Env {
  DB?: D1Like;                       // D1 database "titanos-digital": order log, idempotency, rate limit
  DIGITAL_FILES?: KVLike;            // Workers KV namespace holding the zips as binary values at products/<slug>.zip (used while R2 is not enabled)
  DIGITAL_BUCKET?: R2Like;           // PRIVATE R2 bucket holding the zips (never public, no r2.dev, no custom domain)
  DIGITAL_CHECKOUT_ENABLED?: string; // must be exactly "true" for POST /digital/checkout to create a session; anything else = 503 checkout_disabled
  DIGITAL_STRIPE_MODE?: string;      // "test" | "live"; anything else is treated as "test"
  DIGITAL_STRIPE_SECRET_KEY?: string;// sk_test_ or sk_live_ (restricted rk_ keys work): must match the mode
  DIGITAL_WEBHOOK_SECRET?: string;   // whsec_..., the signing secret of the /digital/webhook endpoint
  DIGITAL_TOKEN_SECRET?: string;     // 32+ random chars: signs download tokens
  SITE_ORIGIN?: string;              // https://titanos.tech (CORS, Stripe return URLs)
  DIGITAL_PUBLIC_ORIGIN?: string;    // origin the emailed download link points at; default: the origin the webhook arrived on
  RESEND_API_KEY?: string;           // mail adapter "resend"
  MAIL_FROM?: string;                // e.g. "TITANOS <orders@titanos.tech>" (a Resend-verified sender)
  MAIL_REPLY_TO?: string;            // default kyle@titanos.tech
  DIGITAL_DEV_OUTBOX?: string;       // "1" + mode test: park mail in digital_outbox instead of sending
}
