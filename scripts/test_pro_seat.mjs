// test_pro_seat.mjs - C4: the /pro page and the owner's "get a pro" button are wired to routes that exist, the copy never
// promises payment before proof, there is no review or rating anywhere, no banned dashes and no model call.
// Behaviour (hire, claim, deliver, re-scan proof, payout, rank, the first-10-jobs drill) lives in portal-api/test/market*.test.ts.
// Run: node scripts/test_pro_seat.mjs   (part of npm test)
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("ok  ", name); };
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const lib = read("lib/pro.ts"), client = read("app/pro/client.tsx"), page = read("app/pro/page.tsx"), index = read("portal-api/src/index.ts"), owner = read("app/app/client.tsx");

t("page exists, is noindex, canonical /pro", () => { assert.match(page, /index: false/); assert.match(page, /titanos\.tech\/pro"/); assert.ok(existsSync(new URL("../app/pro/client.tsx", import.meta.url))); });
t("every API path the browser calls exists as a Worker route with the same method", () => {
  const calls = [...lib.matchAll(/call\(api, "(GET|POST)", [`"](\/(?:pro|market)\/[^`"]*)[`"]/g)].map((m) => [m[1], m[2].replace(/\$\{[^}]+\}/g, ":id")]);
  assert.ok(calls.length >= 13, "13 calls expected, saw " + calls.length);
  for (const [method, path] of calls) {
    const segs = path.split("/").filter(Boolean);
    const probe = path === "/pro/join" || path === "/pro/board" || path === "/pro/rank" || path === "/pro/payouts" || path === "/pro/onboarding" || path === "/pro/onboarding/refresh" || path === "/market/jobs" || path === "/market/leaderboard"
      ? `path === "${path}" && m === "${method}"`
      : `seg[0] === "${segs[0]}" && seg[1] === "jobs" && seg[3] === "${segs[3]}" && m === "${method}"`;
    assert.ok(index.includes(probe), `${method} ${path} -> ${probe}`);
  }
});
t("field names posted match what the Worker reads (domainId, check, note, reason, acceptTerms)", () => {
  for (const f of ["domainId", "check", "note", "reason", "acceptTerms"]) assert.match(lib, new RegExp(`\\b${f}\\b`), f);
  const svc = read("portal-api/src/market/service.ts");
  for (const f of ["b.domainId", "b.check", "b.acceptTerms"]) assert.ok(svc.includes(f), f);
  assert.match(index, /\(await body\(req\)\)\.note/); assert.match(index, /\(await body\(req\)\)\.reason/);
});
t("no review, rating or stars control exists on the page or in the client lib", () => {
  assert.doesNotMatch(client + lib, /\b(stars?|rating|reviewJob|leaveReview|testimonial)\b/i);
  assert.match(client, /Reviews do not exist here/);
});
t("every job status has a label and none says paid or fixed without the re-scan wording", () => {
  for (const s of ["awaiting_funds", "open", "claimed", "delivered", "reproved", "paid", "disputed", "cancelled", "refunded"]) assert.match(lib, new RegExp(`\\b${s}: "`), s);
  const block = lib.slice(lib.indexOf("STATUS_LABEL"), lib.indexOf("PRO_ERRORS"));
  const labels = Object.fromEntries([...block.matchAll(/(\w+): "([^"]+)"/g)].map((m) => [m[1], m[2]]));
  assert.match(labels.paid, /re-scan/i); assert.match(labels.reproved, /re-scan/i); assert.match(labels.delivered, /not yet confirmed/i);
  for (const k of ["open", "claimed", "delivered", "disputed"]) assert.doesNotMatch(labels[k], /\bpaid\b/i, k);
});
t("claim and payout copy promises payment only AFTER the re-scan", () => {
  assert.match(client, /after the re-scan confirms the fix/); assert.match(client, /paid only after|payment follows proof/i); assert.match(owner, /PAID ONLY AFTER RE-SCAN/);
});
t("owner page hire button posts to hireAPro and a guided quest still gets no auto-fix button", () => {
  assert.match(owner, /hireAPro\(browserApi\(\), id, q\.check\)/); assert.match(owner, /q\.kind === "auto"/);
});
t("pro page needs payout setup before the claim button works", () => { assert.match(client, /disabled=\{busy \|\| !onboarded\}/); });
t("no em or en dashes, no model call, no secret in the new client files", () => {
  for (const [n, c] of [["lib/pro.ts", lib], ["app/pro/client.tsx", client], ["app/pro/page.tsx", page]]) {
    assert.doesNotMatch(c, /[–—]/, n); assert.doesNotMatch(c, /anthropic|openai|sk_live|sk_test|whsec_/i, n);
  }
});
t("the browser never sends a plan: the seat discount is a server-side entitlement (f44)", () => {
  assert.doesNotMatch(lib.split("\n").filter((l) => l.includes("/pro/join")).join(""), /plan/); assert.doesNotMatch(client, /setPlan|value="seat"/);
  assert.match(read("portal-api/src/market/service.ts"), /isActiveSeat/); assert.doesNotMatch(read("portal-api/src/market/service.ts"), /\.plan\b|b\.plan/);
});
console.log(`PASS ${passed} tests`);
