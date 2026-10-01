// test_api_contracts.mjs - every form that posts to api.titanos.tech sends the fields its Worker route requires.
//
// Why (2026-10-01): the Monitor buy button posted {plan} while POST /checkout/monitor requires {plan, domain}, so every
// tap returned 400 invalid_domain and fell to the email fallback. The build was green and nothing compared the two.
// This pins each client request body against the route's required fields. Evidence for each REQUIRED list is the
// deployed Worker bundle backup (titanos-state/worker_deployed_backup/titanos-api.bundle.js, line given); when that
// file is on disk the test also re-reads it, so a Worker change that adds a required field shows up here too.
// Run: node scripts/test_api_contracts.mjs   (part of npm test)
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONTRACTS = [
  { route: "/checkout/monitor", client: "components/MonitorCheckoutButton.tsx", required: ["plan", "domain"],
    worker: "invalid_plan / invalid_domain at bundle :11593, :11597" },
  { route: "/order/submit", client: "components/OrderForm.tsx", required: ["order_type", "name", "email"],
    worker: "invalid_order_type / invalid_name / invalid_email at bundle :11839, :11849, :11851" },
  { route: "/scan/request", client: "components/ScanRequestForm.tsx", required: ["domain", "name", "email"],
    worker: "invalid_domain / invalid_name / invalid_email at bundle :12246, :12249, :12252" },
];
const BUNDLE = join(homedir(), "titanos_launch/titanos-state/worker_deployed_backup/titanos-api.bundle.js");

// Top-level keys of the first JSON.stringify({ ... }) passed to a fetch() body in the source.
export function bodyKeys(src) {
  const at = src.indexOf("fetch(");
  if (at < 0) return null;
  const start = src.indexOf("JSON.stringify({", at);
  if (start < 0) return null;
  let i = start + "JSON.stringify(".length, depth = 0, inner = "";
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    if (ch === "}" || ch === ")" || ch === "]") depth--;
    if (depth >= 1) inner += ch;
    if (depth === 0) break;
  }
  const keys = [];
  let d = 0, token = "";
  for (const ch of inner.slice(1) + ",") {          // walk the object's top level only
    if ("{([".includes(ch)) d++;
    if ("})]".includes(ch)) d--;
    if (ch === "," && d === 0) {
      const m = token.trim().match(/^([A-Za-z_$][\w$]*)\s*(:|$)/);
      if (m) keys.push(m[1]);
      token = "";
    } else token += ch;
  }
  return keys;
}

// Fields the Worker route reads and rejects on (body.<field> inside the route handler).
function workerReads(bundle, route) {
  const at = bundle.indexOf(`.post("${route}"`);
  if (at < 0) return null;
  const end = bundle.indexOf("Routes.", at + 10);
  const block = bundle.slice(at, end < 0 ? undefined : end);
  return [...block.matchAll(/body\.([a-z_]+)/g)].map((m) => m[1]);
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"} ${msg}`); };
const bundle = existsSync(BUNDLE) ? readFileSync(BUNDLE, "utf8") : null;
for (const c of CONTRACTS) {
  const keys = bodyKeys(readFileSync(c.client, "utf8"));
  const missing = keys ? c.required.filter((k) => !keys.includes(k)) : c.required;
  ok(keys && missing.length === 0, `${c.client} -> ${c.route} sends ${c.required.join(", ")}${missing.length ? ` (MISSING: ${missing.join(", ")})` : ""}`);
  if (bundle) {
    const reads = workerReads(bundle, c.route);
    ok(reads && c.required.every((k) => reads.includes(k)), `Worker ${c.route} still reads ${c.required.join(", ")} (${c.worker})`);
  }
}
if (!bundle) console.log(`NOTE Worker bundle not on disk (${BUNDLE}): client half checked only`);
// The bug this exists for: the 2026-10-01 button body, which must fail the Monitor contract.
const old = 'const res = await fetch(ENDPOINT, { method: "POST", body: JSON.stringify({ plan }) });';
ok(!bodyKeys(old).includes("domain"), "regression: the pre-fix Monitor body {plan} is caught as missing domain");
ok(JSON.stringify(bodyKeys('fetch(u, { body: JSON.stringify({ a, b: f(x, y), c: { d: 1 } }) })')) === '["a","b","c"]',
  "parser reads top-level keys only (shorthand, calls, nested objects)");
console.log(`== test_api_contracts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
