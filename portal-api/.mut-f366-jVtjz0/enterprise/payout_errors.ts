// C8 f51: permanent vs transient classification of payout transfer errors. PURE: no network, no Stripe.
// A permanent refusal (the destination is invalid, the account is closed, the currency is unsupported) can never succeed on a
// retry, so the retry executor holds it on the first attempt instead of burning every attempt. UNKNOWN is TRANSIENT: a code we
// do not recognise is retried (bounded by maxAttempts), never held on a guess. Only the machine code is read, never the message.
export class PermanentTransferError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) { super(message ?? code); this.name = "PermanentTransferError"; this.code = code; }
}

// Provider error codes known to be final. Stripe-style names; a real adapter maps its own codes onto these or throws
// PermanentTransferError directly.
export const PERMANENT_CODES: ReadonlySet<string> = new Set([
  "invalid_destination", "invalid_account", "account_invalid", "account_closed", "account_not_found",
  "currency_not_supported", "bank_account_closed", "bank_account_invalid", "destination_rejected",
]);

export type ErrorClass = "permanent" | "transient";
export interface Classified { kind: ErrorClass; code: string }

export function classify(err: unknown): Classified {
  if (err instanceof PermanentTransferError) return { kind: "permanent", code: err.code };
  const raw = typeof err === "object" && err !== null ? (err as { code?: unknown }).code : undefined;
  const code = typeof raw === "string" && raw !== "" ? raw.toLowerCase() : "unknown";
  return PERMANENT_CODES.has(code) ? { kind: "permanent", code } : { kind: "transient", code };
}
