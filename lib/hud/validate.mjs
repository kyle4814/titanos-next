// Shape check for the live receipt feed. Returns a clean {generated, items} or null. Pure, so the tests import it too.
const S = (v, n) => typeof v === "string" && v.length > 0 && v.length <= n;
const BAD = /@|https?:|www\.|\/\//i;
export function validateFeed(d) {
  if (!d || typeof d !== "object" || !Array.isArray(d.items) || d.items.length > 60 || !Number.isFinite(d.generated)) return null;
  for (const it of d.items) {
    if (!it || !Number.isFinite(it.t) || !S(it.acct, 2) || !S(it.cat, 16) || !S(it.code, 40) || BAD.test(it.code + it.cat)) return null;
  }
  return { generated: d.generated, items: d.items.map(({ t, acct, cat, code }) => ({ t, acct, cat, code })) };
}
