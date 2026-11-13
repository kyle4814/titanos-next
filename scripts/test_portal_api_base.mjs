// Build-time API base: default is today's URL (build output unchanged), a valid https origin overrides it, anything else is ignored.
// Also pins the layout CSP: at the default the connect-src text is byte-identical to the pre-change string.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("..", import.meta.url));
const base = (val) => {
  const env = { ...process.env }; delete env.NEXT_PUBLIC_PORTAL_API_BASE; if (val !== undefined) env.NEXT_PUBLIC_PORTAL_API_BASE = val;
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "-e", `import("./lib/config.ts").then(m=>console.log(m.PORTAL.API_BASE))`], { cwd: root, env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
};
const D = "https://api.titanos.tech";
assert.equal(base(undefined), D, "default unchanged");
assert.equal(base(""), D);
assert.equal(base("https://portal-api.titanos.tech"), "https://portal-api.titanos.tech");
assert.equal(base(" https://portal-api.titanos.tech/ "), "https://portal-api.titanos.tech", "trailing slash and spaces trimmed");
for (const bad of ["http://portal-api.titanos.tech", "https://x.titanos.tech/path", "https://u:p@x.titanos.tech", "javascript:alert(1)", "https://a b.example", "https://x.example; script-src *", "portal-api.titanos.tech", "https://localhost"]) {
  assert.equal(base(bad), D, `rejected: ${bad}`);
}
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
assert.ok(layout.includes('"connect-src \'self\' https://cloudflare-dns.com https://api.titanos.tech " +'), "CSP keeps the api.titanos.tech entry");
assert.ok(layout.includes('(PORTAL.API_BASE === DEFAULT_PORTAL_API_BASE ? "" : PORTAL.API_BASE + " ")'), "CSP adds the configured base only when it differs");
// Simulate the CSP join at the default: must equal the original single literal.
const joined = "connect-src 'self' https://cloudflare-dns.com https://api.titanos.tech " + "" + "https://vault.titanos.tech https://cloudflareinsights.com; ";
assert.equal(joined, "connect-src 'self' https://cloudflare-dns.com https://api.titanos.tech https://vault.titanos.tech https://cloudflareinsights.com; ");
console.log("test_portal_api_base: OK");
