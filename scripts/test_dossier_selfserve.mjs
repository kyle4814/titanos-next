// C8 self-serve dossier UI kill tests. node --experimental-strip-types scripts/test_dossier_selfserve.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import * as core from "../lib/dossier-selfserve/core.ts";
import * as c2 from "../portal-api/src/dns.ts";
const { memoryAdapter, DossierError, syntheticDossier, SYNTHETIC_LABEL, ERROR_COPY } = core;

let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log("ok  ", name); };
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const code = async (p) => { try { await p; } catch (e) { return e.code ?? "other:" + e.message; } return "none"; };
const mk = (zone = {}, o = {}) => { const clock = { t: 1000 }; const z = zone; return { clock, z, ad: memoryAdapter({ resolver: { async txt(n) { if (z.__fail) throw new Error("x"); return z[n] ?? []; } }, now: () => clock.t, readyAfterMs: 500, ...o }) }; };

await t("parity with the C2 verify code: normaliseDomain and record shapes", () => {
  for (const d of ["Example.COM.au", "https://a.b.com/x", "1.2.3.4", "foo", "a_b.com", "x.test", "x".repeat(300) + ".com", "", null, 5])
    assert.equal(core.normaliseDomain(d), c2.normaliseDomain(d), String(d));
  assert.equal(core.verifyRecordName("a.com"), c2.verifyRecordName("a.com"));
  assert.equal(core.verifyRecordValue("tok"), c2.verifyRecordValue("tok"));
});
await t("state idle -> awaiting_txt shows the TXT record", async () => {
  const { ad } = mk(); const r = await ad.start("https://Acme.com.au/");
  assert.equal(r.phase, "awaiting_txt"); assert.equal(r.domain, "acme.com.au");
  assert.equal(r.record.name, "_titanos-verify.acme.com.au"); assert.match(r.record.value, /^titanos-verify=/);
});
await t("invalid domains are rejected", async () => {
  const { ad } = mk();
  for (const d of ["", "nodot", "1.2.3.4", "localhost.local", "a b.com"]) assert.equal(await code(ad.start(d)), "invalid_domain", d);
});
await t("gate: queue before verify is refused", async () => {
  const { ad } = mk(); const r = await ad.start("acme.com");
  assert.equal(await code(ad.queue(r.id)), "not_verified");
});
await t("gate: record absent -> txt_not_found, phase stays awaiting_txt", async () => {
  const { ad } = mk(); const r = await ad.start("acme.com");
  assert.equal(await code(ad.verify(r.id)), "txt_not_found");
  assert.equal((await ad.poll(r.id)).phase, "awaiting_txt");
});
await t("gate: wrong token value is refused", async () => {
  const { ad, z } = mk(); const r = await ad.start("acme.com");
  z[r.record.name] = ["titanos-verify=someoneelse"];
  assert.equal(await code(ad.verify(r.id)), "txt_not_found");
});
await t("gate: resolver failure -> dns_lookup_failed (UNKNOWN, never verified)", async () => {
  const { ad, z } = mk(); const r = await ad.start("acme.com"); z.__fail = true;
  assert.equal(await code(ad.verify(r.id)), "dns_lookup_failed");
  assert.equal((await ad.poll(r.id)).phase, "awaiting_txt");
});
await t("verified -> queued -> ready, with timestamps; ready only after the delay", async () => {
  const { ad, z, clock } = mk(); const r = await ad.start("acme.com");
  z[r.record.name] = [r.record.value];
  const v = await ad.verify(r.id); assert.equal(v.phase, "verified"); assert.equal(v.verifiedAt, 1000);
  assert.equal(await code(ad.result(r.id)), "not_ready");
  clock.t = 2000; const q = await ad.queue(r.id); assert.equal(q.phase, "queued"); assert.equal(q.queuedAt, 2000);
  clock.t = 2499; assert.equal((await ad.poll(r.id)).phase, "queued"); assert.equal(await code(ad.result(r.id)), "not_ready");
  clock.t = 2500; const p = await ad.poll(r.id); assert.equal(p.phase, "ready"); assert.equal(p.readyAt, 2500);
});
await t("ready output is synthetic and labelled", async () => {
  const { ad, z, clock } = mk(); const r = await ad.start("acme.com");
  z[r.record.name] = [r.record.value]; await ad.verify(r.id); await ad.queue(r.id); clock.t += 600;
  const d = await ad.result(r.id);
  assert.equal(d.synthetic, true); assert.equal(d.label, SYNTHETIC_LABEL); assert.match(d.label, /SYNTHETIC/); assert.ok(d.sections.length >= 3);
});
await t("idempotent: verify/queue twice does not move a phase backwards or restamp", async () => {
  const { ad, z, clock } = mk(); const r = await ad.start("acme.com");
  z[r.record.name] = [r.record.value]; await ad.verify(r.id); clock.t = 1500;
  const a = await ad.queue(r.id); clock.t = 1600; const b = await ad.queue(r.id);
  assert.equal(a.queuedAt, b.queuedAt); assert.equal((await ad.verify(r.id)).phase, "queued");
});
await t("unknown id -> not_found; snapshots cannot mutate adapter state", async () => {
  const { ad } = mk(); assert.equal(await code(ad.poll("nope")), "not_found");
  const r = await ad.start("acme.com"); r.phase = "ready"; r.record.value = "x";
  assert.equal((await ad.poll(r.id)).phase, "awaiting_txt"); assert.match((await ad.poll(r.id)).record.value, /^titanos-verify=/);
});
await t("two requests get distinct tokens", async () => {
  const { ad } = mk(); const a = await ad.start("a.com"), b = await ad.start("b.com");
  assert.notEqual(a.token, b.token); assert.notEqual(a.id, b.id);
});
await t("every error code has user copy", () => {
  for (const k of ["invalid_domain", "txt_not_found", "dns_lookup_failed", "not_verified", "not_found", "not_ready"]) assert.ok(ERROR_COPY[k]);
});
await t("no model, no network, no outbound in the C8 files; passive only", () => {
  const FORBID = /anthropic|openai|claude|gpt-|gemini|llm|fetch\(|XMLHttpRequest|sendBeacon|nmap|WebSocket/i;
  for (const f of ["lib/dossier-selfserve/core.ts", "components/DossierSelfServe.tsx"]) assert.doesNotMatch(read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""), FORBID, f);
});
await t("copy: zero em/en dashes in the C8 files and page", () => {
  const D = new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]`);
  for (const f of ["lib/dossier-selfserve/core.ts", "components/DossierSelfServe.tsx", "app/enterprise/page.tsx"]) assert.doesNotMatch(read(f), D, f);
});
await t("the page mounts the component at #dossiers and stays noindex", () => {
  const p = read("app/enterprise/page.tsx"); assert.match(p, /<DossierSelfServe \/>/); assert.match(p, /index: false/);
  assert.match(read("components/DossierSelfServe.tsx"), /id="dossiers"/);
});
await t("UI renders every state's marker", () => {
  const c = read("components/DossierSelfServe.tsx");
  for (const m of ["awaiting_txt", "verified", "queued", "ready", "SYNTHETIC|out\\.label", "role=\"alert\""]) assert.match(c, new RegExp(m));
});
console.log(`PASS ${passed}`);
