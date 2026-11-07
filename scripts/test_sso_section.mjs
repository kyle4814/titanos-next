// f278: /enterprise#sso renders the SSO setup steps from the OIDC engine's config shape (portal-api/src/enterprise),
// with synthetic labelled data only. Fails if a displayed field drifts from the engine, if the section is flipped to
// Built while the f262 anchor gate is red, or if the copy carries a dash, a credential or a live address.
// Source checks always; with `--built out` also checks the exported HTML.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const mod = await import(new URL("../lib/ssoSetup.ts", import.meta.url).href);
const { SSO_CONFIG_FIELDS, SSO_SYNTHETIC_CONFIG, SSO_STEPS, SSO_CHECKS, SSO_STATE_NOTE } = mod;
const types = fs.readFileSync("portal-api/src/enterprise/types.ts", "utf8");
const oidc = fs.readFileSync("portal-api/src/enterprise/oidc.ts", "utf8");
const cfg = types.match(/export interface SsoConfig \{([^}]*)\}/)?.[1] ?? "";
const cfgFields = [...cfg.matchAll(/(\w+)\??:/g)].map((m) => m[1]);
const expect = oidc.match(/export interface OidcExpect \{([^}]*)\}/)?.[1] ?? "";
const expFields = [...expect.matchAll(/(\w+)\??:/g)].map((m) => m[1]);
ok(cfgFields.length > 4 && expFields.includes("issuer"), "engine SsoConfig and OidcExpect parsed from portal-api source");
for (const f of SSO_CONFIG_FIELDS) ok(cfgFields.includes(f), `displayed field ${f} exists in the engine SsoConfig`);
ok(!SSO_CONFIG_FIELDS.includes("secret") && !("secret" in SSO_SYNTHETIC_CONFIG), "the client secret is never a displayed field");
ok(["issuer", "clientId"].every((f) => expFields.includes(f)), "issuer and clientId are the fields the verifier checks (OidcExpect)");
ok(JSON.stringify(Object.keys(SSO_SYNTHETIC_CONFIG)) === JSON.stringify([...SSO_CONFIG_FIELDS]), "synthetic config has exactly the displayed fields");
const fieldsInSteps = SSO_STEPS.map((s) => s.field).filter(Boolean);
ok(JSON.stringify(fieldsInSteps) === JSON.stringify([...SSO_CONFIG_FIELDS]), "every config field has exactly one step, in order");
ok(SSO_STEPS.every((s, i) => s.n === i + 1), "step numbers run in sequence");
const roles = types.match(/export type Role = ([^;]*);/)?.[1].match(/"(\w+)"/g)?.map((x) => x.replace(/"/g, "")) ?? [];
ok(roles.includes(SSO_SYNTHETIC_CONFIG.defaultRole) && SSO_SYNTHETIC_CONFIG.defaultRole !== "admin", "synthetic default role is a real non-admin role");
ok(/defaultRole: Exclude<Role, "admin">/.test(types), "engine forbids admin as the SSO default role (matches step copy)");
ok(/alg !== "RS256"|"RS256"/.test(oidc) && SSO_CHECKS[0].includes("RS256"), "RS256 pin is in the engine and in the copy");
ok(/MIN_MODULUS_BITS\s*=\s*2048/.test(oidc), "engine weak-key floor still present (copy says weak keys are ignored)");
ok(/refetchCooldownMs/.test(oidc) && /nonce/.test(oidc) && /email_verified/.test(oidc), "engine still has refetch cooldown, nonce and email_verified checks the copy lists");
ok(/seal/.test(fs.readFileSync("portal-api/src/enterprise/seal.ts", "utf8")) && /AES-GCM/.test(fs.readFileSync("portal-api/src/enterprise/seal.ts", "utf8")), "seal.ts is AES-GCM (copy says sealed with authenticated encryption)");
for (const [k, v] of Object.entries(SSO_SYNTHETIC_CONFIG)) if (k !== "defaultRole" && k !== "clientId") ok(/\.invalid(\/|$)/.test(v), `synthetic ${k} uses the reserved .invalid domain`);
ok(/synthetic/i.test(SSO_SYNTHETIC_CONFIG.clientId), "synthetic client id is self-labelled");
const comp = fs.readFileSync("components/SsoSetup.tsx", "utf8");
ok(/Synthetic example, not a live tenant/.test(comp), "component labels the example as synthetic");
ok(!/fetch\(|useState|"use client"|process\.env|localStorage/.test(comp + fs.readFileSync("lib/ssoSetup.ts", "utf8")), "server component: no fetch, state, env or storage");
const copy = [SSO_STATE_NOTE, ...SSO_STEPS.flatMap((s) => [s.title, s.text]), ...SSO_CHECKS];
ok(copy.every((t) => !/[–—]/.test(t)), "SSO copy has no em or en dash");
ok(!/(secret|token|key)\s*[:=]\s*["'][A-Za-z0-9_-]{16,}/i.test(comp + JSON.stringify(SSO_SYNTHETIC_CONFIG)), "no credential-looking literal");
ok(/not built/i.test(SSO_STATE_NOTE) && /No live identity provider/i.test(SSO_STATE_NOTE), "state note keeps the SAML and no-live-IdP limits");
// the Built flip is allowed only while the f262 anchor gate passes
const anchors = fs.readFileSync("app/enterprise/anchors.ts", "utf8");
const sso = anchors.match(/id: "sso"[^]*?status: "(\w+)"/)?.[1];
const gate = spawnSync("node", ["scripts/test_f262_anchors.mjs"], { encoding: "utf8" });
ok(gate.status === 0, "f262 anchor gate passes");
ok(sso === "live" ? gate.status === 0 : true, "sso marked Built only with a green f262 anchor gate");
ok(sso === "live", "sso anchor is marked Built");
ok(/data-sso-setup/.test(comp) && /DETAIL/.test(fs.readFileSync("components/SeatAnchors.tsx", "utf8")), "SeatAnchors renders SsoSetup inside the sso section");
const lint = "/home/tech2/klinge-kernel/bin/content_lint.py";
if (fs.existsSync(lint)) {
  const tmp = fs.mkdtempSync("/tmp/f278-lint-"); const f = path.join(tmp, "copy.txt");
  fs.writeFileSync(f, copy.join("\n\n") + "\n");
  const r = spawnSync("python3", [lint, "--no-cta", f], { encoding: "utf8" });
  ok(r.status === 0, "content_lint --no-cta CLEAN on SSO copy" + (r.status ? " :: " + (r.stdout + r.stderr).slice(0, 300) : ""));
  fs.rmSync(tmp, { recursive: true, force: true });
} else console.log("NOTE content_lint absent, lint check skipped");
const bi = process.argv.indexOf("--built");
if (bi > 0) {
  const out = process.argv[bi + 1];
  const f = [path.join(out, "enterprise.html"), path.join(out, "enterprise", "index.html")].find(fs.existsSync);
  ok(!!f, "/enterprise exported");
  if (f) {
    const html = fs.readFileSync(f, "utf8");
    const sec = html.match(/<section[^>]* id="sso"[^]*?<\/section>/)?.[0] ?? "";
    ok(sec.length > 0, "sso section present once");
    ok((html.match(/<div[^>]* data-sso-setup=/g) || []).length === 1, "setup block appears exactly once");
    ok(/Built/.test(sec) && !/Coming, not built yet/.test(sec), "sso section marker reads Built");
    for (const s of SSO_STEPS) ok(sec.includes(s.title.replace(/&/g, "&amp;")), `step ${s.n} rendered`);
    ok(/Synthetic example, not a live tenant/.test(sec) && sec.includes("idp.example.invalid"), "synthetic example rendered and labelled");
    ok(!/[–—]/.test(sec.replace(/<[^>]+>/g, " ")), "rendered section has no dash");
    ok(/<section[^>]* id="estate"/.test(html) && html.includes("Coming, not built yet"), "other sections still honest Coming");
  }
}
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
