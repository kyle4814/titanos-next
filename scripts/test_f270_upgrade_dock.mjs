// f270: the /agents upgrade dock. Pure module (lib/upgrade-dock.ts) + the section that renders it.
// Run: node --experimental-strip-types scripts/test_f270_upgrade_dock.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as dock from "../lib/upgrade-dock.ts";
import { PRICING, formatAUD, formatMonthly } from "../lib/pricing.ts";

const { upgradeOptions } = dock;
const kinds = (i) => upgradeOptions(i).map((o) => o.kind);
const base = { plan: "ai_embedded", creditsRemaining: 100000, spendCapCredits: null, keyScopes: ["scan:read"], calls30d: [{ tool: "domain_check", count: 10 }] };

test("topup: low cover offers the smallest pack that covers 30 days, priced from the pack table, not reversible", () => {
  const o = upgradeOptions({ ...base, creditsRemaining: 100, calls30d: [{ tool: "domain_check", count: 600 }] }); // 3000 credits / 30 d = 100 a day, 1 day cover
  assert.deepEqual(o.map((x) => x.kind), ["topup"]);
  assert.equal(o[0].id, "credits_10000");               // 3000 needed: 2000 is too small, 10000 is the smallest that covers
  assert.equal(o[0].priceAud, formatAUD(100));
  assert.equal(o[0].reversible, false);
  assert.equal(o[0].action.kind, "coming");              // no live checkout for credits: honest "coming"
});
test("topup: healthy cover offers nothing", () => {
  assert.deepEqual(kinds({ ...base, creditsRemaining: 100000 }), []);
});
test("zero credits: top-up leads even with no calls, and says the balance is empty", () => {
  const o = upgradeOptions({ ...base, creditsRemaining: 0, calls30d: [] });
  assert.equal(o[0].kind, "topup");
  assert.equal(o[0].id, "credits_2000");
  assert.match(o[0].reason, /empty/);
});
test("scope widening: a denied call whose scope the key lacks is offered, free and reversible", () => {
  const o = upgradeOptions({ ...base, calls30d: [{ tool: "explain_finding", count: 2, denied: 2 }] });
  const s = o.find((x) => x.kind === "scope_widening");
  assert.ok(s); assert.equal(s.id, "scope:explain:model"); assert.equal(s.priceAud, null); assert.equal(s.reversible, true);
  assert.match(s.reason, /2 calls were refused/);
});
test("scope widening: not offered when the key already holds the scope, or nothing was denied", () => {
  assert.equal(kinds({ ...base, keyScopes: ["explain:model"], calls30d: [{ tool: "explain_finding", count: 2, denied: 2 }] }).includes("scope_widening"), false);
  assert.equal(kinds({ ...base, calls30d: [{ tool: "explain_finding", count: 2 }] }).includes("scope_widening"), false);
});
test("denied calls were never charged: they do not count as credit use", () => {
  assert.equal(dock.creditsUsed30d([{ tool: "explain_finding", count: 3, denied: 3 }]), 0);
  assert.equal(dock.creditsUsed30d([{ tool: "domain_check", count: 4 }, { tool: "explain_finding", count: 3, denied: 1 }]), 4 * 5 + 2 * 25);
});
test("cap raise: offered at the warn ratio of the cap, free and reversible, and not below it", () => {
  const at = { ...base, spendCapCredits: 500, calls30d: [{ tool: "domain_check", count: 80 }] }; // 400 of 500 = 0.8
  const o = upgradeOptions(at).find((x) => x.kind === "cap_raise");
  assert.ok(o); assert.equal(o.priceAud, null); assert.equal(o.reversible, true);
  assert.equal(kinds({ ...at, calls30d: [{ tool: "domain_check", count: 79 }] }).includes("cap_raise"), false);
  assert.equal(kinds({ ...at, spendCapCredits: null }).includes("cap_raise"), false);
});
test("next tier: priced from lib/pricing.ts, 3-month minimum, links to /pricing, not reversible", () => {
  const cases = [["none", "AI_GROWTH_PARTNER", "ai_growth"], ["ai_growth", "AI_OPS_PARTNER", "ai_ops"], ["ai_ops", "AI_EMBEDDED_PARTNER", "ai_embedded"]];
  for (const [plan, key, id] of cases) {
    const t = upgradeOptions({ ...base, plan }).find((x) => x.kind === "next_tier");
    assert.ok(t, plan); assert.equal(t.id, id); assert.equal(t.priceAud, formatMonthly(PRICING[key]));
    assert.equal(t.reversible, false); assert.deepEqual(t.action, { kind: "link", href: "/pricing" });
    assert.match(t.reason, /3-month minimum/);
  }
});
test("top tier with healthy credits, cap and scopes: no upgrade at all", () => {
  assert.deepEqual(upgradeOptions(base), []);
  assert.equal(dock.nextTier("ai_embedded"), null);
});
test("order: top-up, scope widening, cap raise, next tier; deterministic", () => {
  const all = { plan: "none", creditsRemaining: 0, spendCapCredits: 100, keyScopes: [], calls30d: [{ tool: "explain_finding", count: 5, denied: 5 }, { tool: "domain_check", count: 20 }] };
  assert.deepEqual(kinds(all), ["topup", "scope_widening", "cap_raise", "next_tier"]);
  assert.deepEqual(upgradeOptions(all), upgradeOptions(structuredClone(all)));
});
test("garbage numbers never throw or produce NaN prices", () => {
  const o = upgradeOptions({ ...base, creditsRemaining: NaN, spendCapCredits: -5, calls30d: [{ tool: "nope", count: -1 }, { tool: "domain_check", count: Infinity }] });
  for (const x of o) assert.ok(x.priceAud === null || /^AU\$[\d,]+(\/mo)?$/.test(x.priceAud), x.priceAud);
});
test("credit packs mirror portal-api/src/agent/credits.ts exactly (no invented price)", () => {
  const src = fs.readFileSync("portal-api/src/agent/credits.ts", "utf8");
  const real = [...src.matchAll(/id: "(credits_\d+)", credits: (\d+), amountCents: (\d+)/g)].map((m) => ({ id: m[1], credits: +m[2], amountCents: +m[3] }));
  assert.equal(real.length, 3);
  assert.deepEqual(dock.CREDIT_PACKS.map((p) => ({ ...p })), real);
});
test("MUTATION: flipping LOW_COVER_DAYS or CAP_WARN_RATIO breaks a test", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "f270mut-"));
  try {
    for (const f of ["pricing.ts", "agentTools.generated.json"]) fs.copyFileSync(path.join("lib", f), path.join(dir, f));
    const src = fs.readFileSync("lib/upgrade-dock.ts", "utf8");
    const run = async (name, from, to) => {
      assert.ok(src.includes(from), `${name}: anchor text present`);
      const f = path.join(dir, `${name}.ts`); fs.writeFileSync(f, src.replace(from, to));
      return import(f);
    };
    const low = { ...base, creditsRemaining: 100, calls30d: [{ tool: "domain_check", count: 600 }] };   // 1 day cover: must offer top-up
    const near = { ...base, creditsRemaining: 100000, calls30d: [{ tool: "domain_check", count: 10 }] }; // 1500/mo... cover 100000/1.67 days: must NOT offer top-up
    const m1 = await run("m1", "LOW_COVER_DAYS = 14", "LOW_COVER_DAYS = 0");
    assert.equal(m1.upgradeOptions(low).some((o) => o.kind === "topup"), false, "mutant 1 loses the top-up the real module gives");
    assert.equal(upgradeOptions(low).some((o) => o.kind === "topup"), true);
    const m2 = await run("m2", "LOW_COVER_DAYS = 14", "LOW_COVER_DAYS = 100000000");
    assert.equal(m2.upgradeOptions(near).some((o) => o.kind === "topup"), true, "mutant 2 invents a top-up");
    assert.equal(upgradeOptions(near).some((o) => o.kind === "topup"), false);
    const capIn = { ...base, spendCapCredits: 500, calls30d: [{ tool: "domain_check", count: 80 }] };
    const m3 = await run("m3", "CAP_WARN_RATIO = 0.8", "CAP_WARN_RATIO = 0.9");
    assert.equal(m3.upgradeOptions(capIn).some((o) => o.kind === "cap_raise"), false);
    assert.equal(upgradeOptions(capIn).some((o) => o.kind === "cap_raise"), true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test("source contract: the section renders the module output (page -> UpgradeDock -> upgradeOptions) and is marked built", () => {
  const page = fs.readFileSync("app/agents/page.tsx", "utf8");
  const comp = fs.readFileSync("components/UpgradeDock.tsx", "utf8");
  const anch = fs.readFileSync("app/agents/anchors.ts", "utf8");
  assert.match(comp, /import \{ upgradeOptions[^}]*\} from "@\/lib\/upgrade-dock"/);
  assert.match(comp, /upgradeOptions\(input\)/);
  assert.match(comp, /options\.map\(/);
  assert.match(page, /<UpgradeDock input=\{SYNTHETIC_EXAMPLE\} example \/>/);
  assert.match(page, /extras=\{\{ "upgrade-dock": /);
  assert.match(anch, /id: "upgrade-dock"[^}]*status: "live"/s);
  assert.doesNotMatch(anch, /Coming, not built yet/);
  const sa = fs.readFileSync("components/SeatAnchors.tsx", "utf8");
  assert.match(sa, /extras\?\.\[r\.id\]/);
  assert.match(sa, /Coming, not built yet/); // other seats still say coming
  assert.equal(fs.existsSync("lib/upgrade-dock.ts"), true);
});
test("no billing, network or clock in the pure module", () => {
  const src = fs.readFileSync("lib/upgrade-dock.ts", "utf8").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /\bfetch\(|Date\.now|new Date|Math\.random|stripe|process\.env|XMLHttpRequest/i);
});
test("client copy: no em or en dash, no urgency or fear words, no stray hardcoded dollar in the module or component", () => {
  const texts = ["lib/upgrade-dock.ts", "components/UpgradeDock.tsx", "app/agents/anchors.ts"].map((f) => fs.readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, ""));
  for (const t of texts) { assert.doesNotMatch(t, /[–—]/); assert.doesNotMatch(t, /\b(urgent|hurry|last chance|act now|limited time|expires?|don't miss|risk of)\b/i); assert.doesNotMatch(t, /\$\d/); }
  const rendered = [];
  for (const i of [dock.SYNTHETIC_EXAMPLE, { ...base, creditsRemaining: 0, calls30d: [] }]) for (const o of upgradeOptions(i)) rendered.push(o.title, o.reason);
  for (const r of rendered) assert.doesNotMatch(r, /[–—]|urgent|hurry|last chance/i);
});
