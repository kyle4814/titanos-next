// Production mail transport. The Mailer interface (service.ts) is the seam; this file holds the real HTTP provider adapter.
// Default provider: Resend. API shape checked 2026-11-13 against https://resend.com/docs/api-reference/emails/send-email :
// POST https://api.resend.com/emails, header "Authorization: Bearer <key>", JSON body { from, to, subject, text }, 200 returns { id }.
// Only what the Mailer is handed is sent (the login link text and subject), nothing else. The key and the recipient are never logged.
// FAIL LOUD: any failure throws an HttpError, so a login request never reports success for a mail that did not leave.
//   5xx / 429 / network error / timeout -> 503 mail_unavailable (retryable)
//   other 4xx (bad key, unverified sender, rejected address) -> 502 mail_rejected (operator must fix the config)
import type { Mailer } from "./service.ts";
import { HttpError } from "./util.ts";

export const RESEND_URL = "https://api.resend.com/emails";
export const MAIL_TIMEOUT_MS = 8000;
export const MAIL_PROVIDERS = ["resend", "relay"] as const;

export class ResendMailer implements Mailer {
  private key: string; private from: string; private fetchFn: typeof fetch; private timeoutMs: number;
  constructor(key: string, from: string, fetchFn: typeof fetch = fetch, timeoutMs = MAIL_TIMEOUT_MS) {
    this.key = key; this.from = from; this.fetchFn = fetchFn; this.timeoutMs = timeoutMs;
  }
  async send(to: string, subject: string, text: string): Promise<void> {
    let r: Response;
    try {
      r = await this.fetchFn(RESEND_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${this.key}`, "content-type": "application/json" },
        body: JSON.stringify({ from: this.from, to: [to], subject, text }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch { throw new HttpError(503, "mail_unavailable"); }   // network fault or timeout
    if (r.ok) return;
    if (r.status >= 500 || r.status === 429) throw new HttpError(503, "mail_unavailable");
    throw new HttpError(502, "mail_rejected");
  }
}

// RELAY: login mail sent through a Cloudflare service binding to the existing titanos-api Worker, which already holds the verified
// Resend key and sending domain (so the owner supplies no new key). The call is worker-to-worker (never leaves Cloudflare); the shared
// secret is MAIL_RELAY_SECRET (constant-time compared on the receiving side). Plain-text JSON {to, subject, text} only, same retryable-error
// rules as ResendMailer: 5xx / 429 / network / timeout -> 503 mail_unavailable; any other non-2xx (401 bad secret, 4xx refusal) -> 502 mail_rejected.
// The receiving route is specified in OLD_WORKER_MAIL_RELAY_PATCH.md (titanos-api has no internal send route today).
export const RELAY_PATH = "/relay/login-mail";
export interface ServiceBinding { fetch(req: Request): Promise<Response> }
export class RelayMailer implements Mailer {
  private bind: ServiceBinding; private secret: string; private timeoutMs: number;
  constructor(bind: ServiceBinding, secret: string, timeoutMs = MAIL_TIMEOUT_MS) { this.bind = bind; this.secret = secret; this.timeoutMs = timeoutMs; }
  async send(to: string, subject: string, text: string): Promise<void> {
    let r: Response;
    try {
      r = await this.bind.fetch(new Request("https://relay.internal" + RELAY_PATH, {
        method: "POST",
        headers: { authorization: `Bearer ${this.secret}`, "content-type": "application/json" },
        body: JSON.stringify({ to, subject, text }),
        signal: AbortSignal.timeout(this.timeoutMs),
      }));
    } catch { throw new HttpError(503, "mail_unavailable"); }
    if (r.ok) return;
    if (r.status >= 500 || r.status === 429) throw new HttpError(503, "mail_unavailable");
    throw new HttpError(502, "mail_rejected");
  }
}
