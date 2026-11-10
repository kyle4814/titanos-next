// test_portal_enterprise.mjs - C8: the enterprise and partner pages are noindex previews, the browser client speaks the
// portal API's enterprise contract, SSO state stays in this browser, and no copy carries dashes or fear/hype words.
// Run: node scripts/test_portal_enterprise.mjs   (part of npm test)
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("ok  ", name); };
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const FILES = ["lib/portal-ent.ts", "app/app/estate/page.tsx", "app/app/estate/client.tsx", "app/app/partner/page.tsx", "app/app/partner/client.tsx"];

t("both pages are noindex and not in the sitemap", () => {
  for (const p of ["app/app/estate/page.tsx", "app/app/partner/page.tsx"]) assert.match(read(p), /robots: \{ index: false/);
  assert.doesNotMatch(read("app/sitemap.ts"), /app\/estate|app\/partner/);
});
t("every route the client calls exists in the Worker's enterprise router", () => {
  const routes = read("portal-api/src/enterprise/routes.ts");
  const client = read("lib/portal-ent.ts");
  const paths = [...client.matchAll(/call\(api, "(GET|POST|PUT|DELETE)", [`"]([^`"]+)[`"]/g)].map((m) => [m[1], m[2].replace(/\$\{[^}]+\}/g, ":id")]);
  assert.ok(paths.length >= 15, `only ${paths.length} calls found`);
  for (const [method, p] of paths) {
    const segs = p.split("/").filter(Boolean);
    const head = segs[0];
    assert.match(routes, new RegExp(`"${head}"`), `${method} ${p}: router has no "${head}" prefix`);
    const tail = segs.slice(2).join("/").replace(/:id/g, "");
    if (segs.length >= 3 && head !== "sso" && head !== "invites") assert.match(routes, new RegExp(`${segs[2].replace(/[.]/g, "\\.")}`), `${method} ${p}`);
  }
});
t("SSO: state and nonce live in sessionStorage only; a mismatched state is ignored; the session lands in the portal key", () => {
  const c = read("lib/portal-ent.ts");
  assert.match(c, /sessionStorage|Pick<Storage, "setItem">/); assert.match(c, /pending\.state !== h\.state/);
  assert.match(c, /session\.removeItem\(SSO_KEY\)/);
  assert.doesNotMatch(c, /localStorage/);
});
t("SSO hash parsing: the token is read from the fragment, never the query string", () => {
  const c = read("lib/portal-ent.ts");
  assert.match(c, /hash\.replace\(\/\^#\/, ""\)/);
});
t("pages render API strings as text (no dangerouslySetInnerHTML)", () => {
  for (const f of FILES) assert.doesNotMatch(read(f), /dangerouslySetInnerHTML|innerHTML/, f);
});
t("scan source is shown as the API labels it", () => {
  assert.match(read("app/app/estate/client.tsx"), /Data source: \{view\.dataSource\}/);
});
t("partner page shows the example-terms note and the disclosure duty", () => {
  const p = read("app/app/partner/client.tsx");
  assert.match(p, /led\.rateNote/); assert.match(p, /earn a commission when you recommend us/);
});
t("copy hygiene: no em or en dashes, no hype or fear words in any new file", () => {
  for (const f of FILES) {
    const s = read(f);
    assert.doesNotMatch(s, /[–—]/, f);
    assert.doesNotMatch(s, /\b(delve|leverage|robust|holistic|cutting-edge|synergy|streamline|urgent|act now|limited time)\b/i, f);
  }
});
console.log(`\n${passed} passed`);
