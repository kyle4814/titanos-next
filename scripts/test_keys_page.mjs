// test_keys_page.mjs - f23: the signed-in Keys page is wired to the existing /keys API, is private, and is honest.
// Run: node scripts/test_keys_page.mjs   (part of npm test). Behaviour is tested in portal-api/test/keyspage.test.ts.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("ok  ", name); };
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const FILES = ["app/app/keys/page.tsx", "app/app/keys/client.tsx", "lib/keysPage.ts"];

t("page is noindex, not in the sitemap, canonical is /app/keys", () => {
  const pg = read("app/app/keys/page.tsx");
  assert.match(pg, /robots: \{ index: false, follow: false \}/); assert.match(pg, /https:\/\/titanos\.tech\/app\/keys/);
  assert.doesNotMatch(read("app/sitemap.ts"), /\/app\//);
});
t("client calls exactly the routes the Worker serves (GET/POST /keys, PATCH/DELETE /keys/:id)", () => {
  const lib = read("lib/keysPage.ts"), idx = read("portal-api/src/index.ts");
  for (const m of [/"GET", "\/keys"/, /"POST", "\/keys"/, /"DELETE", `\/keys\/\$\{/, /"PATCH", `\/keys\/\$\{/]) assert.match(lib, m);
  assert.match(idx, /path === "\/keys" && m === "POST"/); assert.match(idx, /path === "\/keys" && m === "GET"/);
  assert.match(idx, /seg\[0\] === "keys" && seg\.length === 2 && m === "PATCH"/); assert.match(idx, /seg\[0\] === "keys" && seg\.length === 2 && m === "DELETE"/);
});
t("the page uses the same portal call and session as the order and billing pages (no second client)", () => {
  const c = read("app/app/keys/client.tsx"); assert.match(c, /from "@\/lib\/portal"/); assert.match(c, /browserApi\(\)/);
  assert.doesNotMatch(c, /\bfetch\(/);
});
t("secret handling: input is read-only, no storage, no logging, not in a URL, cleared on leave", () => {
  const c = read("app/app/keys/client.tsx"), lib = read("lib/keysPage.ts");
  assert.match(c, /readOnly/); assert.match(c, /dismissFresh\(\); \}, \[ctl\]/);
  for (const src of [c, lib]) assert.doesNotMatch(src, /console\.|localStorage\.setItem|sessionStorage|document\.cookie|history\.(push|replace)State/);
  assert.doesNotMatch(c, /fresh\.secret[^\n]*(href|location|searchParams)/);
});
t("closed state: the page shows 'not open yet' and renders no create form unless the store answered", () => {
  const c = read("app/app/keys/client.tsx"); assert.match(c, /status === "closed"/); assert.match(c, /not open yet/);
  assert.match(c, /status === "ready" && \(<>/);
});
t("billing and the agent door link to the page", () => {
  assert.match(read("app/app/billing/client.tsx"), /href="\/app\/keys"/); assert.match(read("app/agents/page.tsx"), /href="\/app\/keys"/);
});
t("client-facing copy: no em or en dashes, no AI-tell words", () => {
  for (const p of FILES) { const s = read(p); assert.doesNotMatch(s, /[–—]/, p); assert.doesNotMatch(s, /\b(delve|leverage|robust|holistic|landscape|cutting-edge|synergy|ecosystem|streamline)\b/i, p); }
});
console.log(`\n${passed} passed`);
