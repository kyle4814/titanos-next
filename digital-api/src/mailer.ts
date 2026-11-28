// Pluggable transactional mailer. The site had no transactional transport (the portal only has a test-mode D1 dev outbox and
// the cold-email path is Instantly, which is not for receipts), so this defines one small interface and ONE real adapter (Resend).
// To use another provider, add a class implementing DigitalMailer and return it from mailerFor(). Nothing else changes.
import type { Env } from "./env.ts";
import type { DigitalStore } from "./store.ts";

export interface MailMessage { to: string; subject: string; text: string; idempotencyKey: string }
export interface DigitalMailer { send(m: MailMessage): Promise<void> }
export class MailerUnavailable extends Error { constructor() { super("mailer_unavailable"); } }

export const unavailableMailer: DigitalMailer = { async send() { throw new MailerUnavailable(); } };

// Test double: records every message, sends nothing.
export class MockMailer implements DigitalMailer {
  outbox: MailMessage[] = []; failNext = 0;
  async send(m: MailMessage) { if (this.failNext > 0) { this.failNext--; throw new Error("mail_down"); } this.outbox.push(m); }
}

// Adapter 1: Resend (https://resend.com/docs/api-reference/emails/send-email). The Idempotency-Key header makes a retried send safe.
export class ResendMailer implements DigitalMailer {
  private apiKey: string; private from: string; private replyTo: string; private fetchFn: typeof fetch;
  constructor(apiKey: string, from: string, replyTo: string, fetchFn: typeof fetch = fetch) { this.apiKey = apiKey; this.from = from; this.replyTo = replyTo; this.fetchFn = fetchFn; }
  async send(m: MailMessage): Promise<void> {
    const r = await this.fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json", "idempotency-key": m.idempotencyKey },
      body: JSON.stringify({ from: this.from, to: [m.to], reply_to: this.replyTo, subject: m.subject, text: m.text }),
    });
    if (!r.ok) throw new Error(`resend_${r.status}`);
  }
}

// Test-mode only: park the message in D1 (digital_outbox) so a run with no mail account can still be inspected.
export class DevOutboxMailer implements DigitalMailer {
  private store: DigitalStore; private now: () => number;
  constructor(store: DigitalStore, now: () => number) { this.store = store; this.now = now; }
  async send(m: MailMessage) { await this.store.parkMail(m.to, m.subject, m.text, this.now()); }
}

export function mailerFor(env: Env, store: DigitalStore, now: () => number, fetchFn?: typeof fetch): DigitalMailer {
  if (env.RESEND_API_KEY && env.MAIL_FROM) return new ResendMailer(env.RESEND_API_KEY, env.MAIL_FROM, env.MAIL_REPLY_TO || "kyle@titanos.tech", fetchFn);
  if (env.DIGITAL_DEV_OUTBOX === "1" && env.DIGITAL_STRIPE_MODE !== "live") return new DevOutboxMailer(store, now);
  return unavailableMailer;
}
