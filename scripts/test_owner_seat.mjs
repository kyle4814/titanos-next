// test_owner_seat.mjs - C3: the /app owner page is wired to routes that exist, never words an unproven state as fixed,
// carries no banned dashes, and has no model call. Behaviour (20-fault kill test) lives in portal-api/test/owner*.test.ts.
// Run: node scripts/test_owner_seat.mjs   (part of npm test)
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("ok  ", name); };
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const lib = read("lib/owner.ts"), client = read("app/app/client.tsx"), page = read("app/app/page.tsx"), index = read("portal-api/src/index.ts");

t("page exists, is noindex, canonical /app", () => { assert.match(page, /index: false/); assert.match(page, /titanos\.tech\/app"/); assert.ok(existsSync(new URL("../app/app/client.tsx", import.meta.url))); });
t("every API path the browser calls exists as a Worker route", () => {
  const calls = [...lib.matchAll(/call\(api, "(GET|POST)", `?"?(\/app\/[^`"?]*)/g)].map((m) => [m[1], m[2]]);
  assert.ok(calls.length >= 6, "six calls expected, saw " + calls.length);
  for (const [method, path] of calls) {
    const shape = path.replace(/\$\{[^}]+\}/g, ":id");
    const segs = shape.split("/").filter(Boolean);
    const tail = segs.at(-1);
    if (segs.length === 2) assert.match(index, /seg\.length === 2 && m === "GET"/);
    else if (tail === ":id") assert.match(index, /seg\.length === 3 && m === "GET"/);
    else assert.match(index, new RegExp(`seg\\[3\\] === "${tail === "undo" ? "fixes" : tail}"`), `${method} ${path}`);
  }
});
t("every proof state has a label and none of the labels claims a fix without proof", () => {
  for (const s of ["OPEN", "PROVEN_FIXED", "REGRESSED", "UNKNOWN", "MONITORING"]) assert.match(lib, new RegExp(`${s}: "`));
  const labels = Object.fromEntries([...lib.matchAll(/^\s{2}(\w+): "([^"]+)",?$/gm)].map((m) => [m[1], m[2]]));
  assert.match(labels.PROVEN_FIXED, /re-scan/i);
  for (const k of ["OPEN", "REGRESSED", "UNKNOWN", "MONITORING"]) assert.doesNotMatch(labels[k], /(?<!not )\bfixed\b/i, k);
});
t("auto-fix button says UNDOABLE and an undo control exists; guided quests never get a fix button", () => {
  assert.match(client, /UNDOABLE/); assert.match(client, /UNDO THE LAST CHANGE/); assert.match(client, /q\.kind === "auto"/);
});
t("hours given back are labelled MODELLED on the page", () => { assert.match(client, /MODELLED/); assert.match(lib, /hoursLine/); });
t("signed-out visitors and accounts without a verified domain get a plain next step", () => { assert.match(client, /\/app\/login/); assert.match(client, /No verified domain yet/); });
t("no em or en dashes and no AI-tell words in the owner copy", () => {
  for (const [n, s] of [["lib/owner.ts", lib], ["app/app/client.tsx", client]]) {
    assert.doesNotMatch(s, /[–—]/, n + " has a banned dash");
    assert.doesNotMatch(s, /\b(leverage|robust|holistic|delve|seamless|cutting-edge|streamline|synergy)\b/i, n);
  }
});
t("zero model calls in the owner seat (browser and Worker)", () => {
  for (const f of ["lib/owner.ts", "app/app/client.tsx", "portal-api/src/owner/engine.ts", "portal-api/src/owner/autofix.ts", "portal-api/src/owner/levels.ts", "portal-api/src/owner/service.ts"])
    assert.doesNotMatch(read(f), /anthropic|openai|gemini|claude-|gpt-|messages\.create|chat\.completions/i, f);
});
t("migration 0003 is additive only and never touches the live tables", () => {
  const m = read("portal-api/migrations/0003_owner_seat.sql");
  assert.doesNotMatch(m, /\b(DROP|ALTER)\b/i); assert.match(m, /CREATE TABLE IF NOT EXISTS owner_state/);
  assert.doesNotMatch(m, /\b(orders|scan_requests|subscribers)\b/);
});
console.log(`\ntest_owner_seat: ${passed} passed`);
