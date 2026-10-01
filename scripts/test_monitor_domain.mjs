// node --experimental-strip-types scripts/test_monitor_domain.mjs  (.mjs so next build does not type-check it)
// Guards the 2026-10-01 bug: the Monitor button posted {plan} only and the
// Worker answered 400 invalid_domain, so no buyer could reach Stripe.
import { readFileSync } from "node:fs";
import { isValidDomain, normaliseDomain, HOSTNAME_RE } from "../lib/monitorDomain.ts";

let fails = 0;
const eq = (name, got, want) => {
  if (got !== want) { fails++; console.error(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

eq("strip scheme+www+path", normaliseDomain(" HTTPS://www.Example.com.au/contact "), "example.com.au");
eq("plain", normaliseDomain("titanos.tech"), "titanos.tech");
for (const ok of ["titanos.tech", "https://www.plumber.com.au/", "a-b.co.nz"]) eq(`valid ${ok}`, isValidDomain(ok), true);
for (const bad of ["", "   ", "localhost", "not a domain", "http://", "-bad-.com", "x.c"]) eq(`invalid ${JSON.stringify(bad)}`, isValidDomain(bad), false);

// The button must send the domain with the plan.
const btn = readFileSync(new URL("../components/MonitorCheckoutButton.tsx", import.meta.url), "utf8");
eq("button posts domain", /JSON\.stringify\(\{\s*plan,\s*domain:/.test(btn), true);

// Parity with the deployed Worker bundle, when the backup is on this machine.
const bundle = new URL("../../titanos-state/worker_deployed_backup/titanos-api.bundle.js", import.meta.url);
try {
  const src = readFileSync(bundle, "utf8");
  eq("regex matches Worker", src.includes(`var HOSTNAME_RE = ${HOSTNAME_RE.toString()};`), true);
} catch {
  console.log("SKIP worker parity (bundle backup not present)");
}

if (fails) { console.error(`${fails} failure(s)`); process.exit(1); }
console.log("PASS test_monitor_domain");
