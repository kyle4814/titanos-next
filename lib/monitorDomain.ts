// Domain rules for the Monitor checkout. Mirrors the Worker's normaliseDomain +
// HOSTNAME_RE (titanos-api, src/checkout) so a bad entry is caught in the
// browser instead of bouncing off a 400 invalid_domain.

export const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\.?$/i;

export function normaliseDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./i, "");
}

export function isValidDomain(input: string): boolean {
  const d = normaliseDomain(input);
  return d.length > 0 && HOSTNAME_RE.test(d);
}
