// test_portal_checkout.mjs - C2: the four /order pages are a checkout path, not an enquiry form; the browser client talks
// the portal API's contract; the catalogue the pages offer matches the product ids the Worker sells.
// Run: node scripts/test_portal_checkout.mjs   (part of npm test)
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("ok  ", name); };
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

const PAGES = ["monitor", "compliance", "ai", "leads"];
for (const p of PAGES) {
  t(`order/${p}: uses PortalCheckout, no OrderForm, no mailto`, () => {
    const c = read(`app/order/${p}/client.tsx`), pg = read(`app/order/${p}/page.tsx`);
    assert.match(c, /PortalCheckout/); assert.doesNotMatch(c, /OrderForm/);
    assert.doesNotMatch(c + pg, /mailto:/);
    assert.doesNotMatch(pg, /Enquiry →/);
  });
}
const worker = read("portal-api/src/catalogue.ts");
const workerIds = new Set([...worker.matchAll(/^\s{2}(\w+): \{ id: "(\w+)"/gm)].map((m) => m[2]));
t("every product id the pages sell exists in the Worker catalogue (and keeps its domain rule)", () => {
  for (const p of PAGES) {
    const c = read(`app/order/${p}/client.tsx`);
    for (const m of c.matchAll(/id: "(\w+)", label: .*?needsDomain: (true|false)/g)) {
      assert.ok(workerIds.has(m[1]), `${p}: ${m[1]} not sold by the Worker`);
      const line = worker.split("\n").find((l) => l.includes(`id: "${m[1]}"`));
      assert.match(line, new RegExp(`needsVerifiedDomain: ${m[2]}`), `${m[1]} domain rule differs from the Worker`);
    }
  }
});
t("client posts the field names the Worker reads (email, token, domain, product, purchaseId, confirm)", () => {
  const lib = read("lib/portal.ts"), idx = read("portal-api/src/index.ts");
  for (const [route, field] of [["/auth/request", "email"], ["/auth/verify", "token"], ["/domains", "domain"], ["/checkout", "product"], ["/checkout", "domain"]]) {
    assert.ok(lib.includes(route), route);
    assert.ok(new RegExp(`\\b${field}\\b`).test(lib), field);
  }
  assert.match(idx, /\(await body\(req\)\)\.email/); assert.match(idx, /\.token\)/); assert.match(idx, /b\.product, b\.domain/);
  assert.match(read("app/app/billing/client.tsx"), /purchaseId/); assert.match(idx, /body\(req\)\)\.purchaseId/);
  assert.match(read("app/app/billing/client.tsx"), /confirm: "DELETE"/); assert.match(idx, /\.confirm\)/);
});
t("the login token lives in the URL fragment and is stripped after use", () => {
  const c = read("app/app/login/client.tsx"); assert.match(c, /location\.hash/); assert.match(c, /replaceState/);
  assert.match(read("portal-api/src/service.ts"), /\/app\/login#token=/);
});
t("portal pages are noindex and not in the sitemap", () => {
  for (const p of ["app/app/login/page.tsx", "app/app/billing/page.tsx"]) assert.match(read(p), /robots: \{ index: false/);
  assert.doesNotMatch(read("app/sitemap.ts"), /\/app\//);
});
t("CSP connect-src already allows the API origin the client calls", () => {
  assert.match(read("app/layout.tsx"), /connect-src 'self'( https:\/\/cloudflare-dns\.com)? https:\/\/api\.titanos\.tech/); // C1 added the DoH host ahead of the API
  assert.match(read("lib/config.ts"), /PORTAL = \{\s*API_BASE: "https:\/\/api\.titanos\.tech"/);
});
t("no em dashes or en dashes in the new client-facing files", () => {
  for (const p of ["components/PortalCheckout.tsx", "lib/portal.ts", "app/app/login/client.tsx", "app/app/billing/client.tsx", ...PAGES.flatMap((x) => [`app/order/${x}/client.tsx`, `app/order/${x}/page.tsx`])])
    assert.doesNotMatch(read(p), /[–—]/, p);
});
t("the Worker never calls a live Stripe key from a non-live mode (guard present)", () => {
  assert.match(read("portal-api/src/stripe.ts"), /stripe_key_mode_mismatch/);
});
console.log(`\n${passed} passed`);
