#!/usr/bin/env node
// C8 f318 mutation check for the production IdpVerifier and its wiring. Plants each mutant, runs test/idp_verifier.test.ts, expects FAIL (killed).
// Always restores the original bytes. Run: node scripts/mutate_idp_verifier.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const api = join(dirname(fileURLToPath(import.meta.url)), "..", "portal-api");
const V = "src/enterprise/idp_verifier.ts", E = "src/ent_context.ts", O = "src/enterprise/oidc.ts";
const T = ["test/idp_verifier.test.ts"];
const M = [
  // issuer pinning
  [V, "pin: unpinned issuer allowed (falls back to issuer as url)", "if (!url) throw new SsoError(\"bad_issuer\");", "const url2 = url ?? cfg.issuer;"],
  [V, "pin: url map built without the safety filter", "filter(([iss, u]) => isSafeJwksUrl(iss) && isSafeJwksUrl(u))", "filter(() => true)"],
  [V, "pin: only the url is checked, not the issuer", "isSafeJwksUrl(iss) && isSafeJwksUrl(u)", "isSafeJwksUrl(u)"],
  [V, "pin: http accepted", 'p.protocol === "https:"', 'p.protocol.startsWith("http")'],
  [V, "pin: credentials accepted", "!p.username && !p.password && ", ""],
  [V, "pin: fragment accepted", "&& !p.hash", ""],
  // TTL
  [V, "ttl: never expires", "if (st && nowMs - st.loadedAt >= ttl)", "if (false)"],
  [V, "ttl: off by one (strictly greater)", "nowMs - st.loadedAt >= ttl)", "nowMs - st.loadedAt > ttl + 1000000)"],
  [V, "ttl: floor removed (0 allowed)", "60_000, 86_400_000);\n  const cooldown", "0, 86_400_000);\n  const cooldown"],
  // bounded refetch
  [V, "cooldown: not passed to the verifier (default used)", "skewSec: skew, refetchCooldownMs: cooldown,", "skewSec: skew,"],
  [V, "cooldown: floor removed", "cooldown = clamp(opts.refetchCooldownMs, IDP_DEFAULTS.refetchCooldownMs, 1_000,", "cooldown = clamp(opts.refetchCooldownMs, IDP_DEFAULTS.refetchCooldownMs, -1,"],
  [O, "refetch: cooldown check removed (storm)", "nowMs - c.fetchedAt >= cooldown", "true"],
  [O, "refetch: fetchedAt not stamped before a failing fetch", "c.fetchedAt = nowMs;  ", "  "],
  // failure handling
  [V, "backoff: never applied", "if (st.failedAt !== undefined && clock - st.failedAt < backoff) throw", "if (false) throw"],
  [V, "backoff: failure not recorded", "catch { st.failedAt = clock; throw", "catch { throw"],
  [V, "fail open: fetch error returns an empty key set", "catch { st.failedAt = clock; throw new SsoError(\"jwks_unavailable\"); }", "catch { st.failedAt = clock; return { keys: [] }; }"],
  [V, "shape: non-array keys accepted", "!Array.isArray((doc as Jwks).keys)", "false"],
  [V, "bound: key count uncapped", "doc.keys.slice(0, maxKeys)", "doc.keys"],
  [V, "coalesce: every caller fetches", "let p = inflight.get(url);", "let p: Promise<Jwks> | undefined = undefined;"],
  // skew
  [V, "skew: unbounded", "skewSec, IDP_DEFAULTS.skewSec, 0, 300)", "skewSec, IDP_DEFAULTS.skewSec, 0, 1e9)"],
  [V, "skew: not passed to the verifier", "skewSec: skew, refetchCooldownMs", "refetchCooldownMs"],
  [V, "skew: 0 treated as default", "typeof v === \"number\" && Number.isFinite(v) ?", "typeof v === \"number\" && Number.isFinite(v) && v !== 0 ?"],
  // audience, issuer, alg, signature (in the f25 verifier the wrapper depends on)
  [O, "alg: HS256 allowed", 'header.alg !== "RS256"', 'header.alg !== "RS256" && header.alg !== "HS256"'],
  [O, "alg: check removed (none passes to key stage)", 'if (!isObj(header) || header.alg !== "RS256") throw new SsoError("bad_alg");', 'if (!isObj(header)) throw new SsoError("bad_alg");'],
  [O, "iss: not compared", 'if (c.iss !== exp.issuer) throw new SsoError("bad_issuer");', ""],
  [O, "aud: not compared (string)", 'if (aud !== exp.clientId) throw new SsoError("bad_audience");', ""],
  [O, "aud: multi-aud without azp accepted", "if (aud.length > 1 && c.azp !== exp.clientId) throw new SsoError(\"bad_audience\");", ""],
  [O, "exp: not checked", 'c.exp + skew <= now) throw new SsoError("expired");', "false) throw new SsoError(\"expired\");"],
  [O, "signature: not checked", 'if (!ok) throw new SsoError("bad_signature");', ""],
  [O, "email_verified: not required", 'if (c.email_verified !== true) throw new SsoError("email_not_verified");', ""],
  // wiring
  [E, "wire: idp built without the binding (fetchJwks alone builds it)", "const idp = seams.idp ?? (idpUrls ?", "const idp = seams.idp ?? (true ?"],
  [E, "wire: refusal removed", 'if (!idp) throw new EntBuildError("adapter_unavailable", "idp");', ""],
  [E, "wire: binding parse skipped (raw JSON used)", "env.IDP_JWKS_URIS ? parseIdpJwksUris(env.IDP_JWKS_URIS) : undefined", "env.IDP_JWKS_URIS ? JSON.parse(env.IDP_JWKS_URIS) : undefined"],
  [E, "wire: parse accepts empty map", "if (!e.length || !e.every(", "if (!e.every("],
  [E, "wire: parse accepts http urls", "isSafeJwksUrl(iss) && isSafeJwksUrl(u))) throw", "true))) throw"],
  [E, "wire: injected fetchFn ignored", "seams.fetchFn ?? fetch", "fetch"],
  [E, "wire: injected fetchJwks ignored", "seams.fetchJwks ?? httpJwksFetcher", "httpJwksFetcher(fetch) ?? httpJwksFetcher"],
  [E, "wire: seams.idp no longer wins", "const idp = seams.idp ?? (", "const idp = (idpUrls ? undefined : seams.idp) ?? ("],
  // http fetcher
  [V, "http: redirects followed", 'redirect: "error"', 'redirect: "follow"'],
  [V, "http: non-200 accepted", "if (res.status !== 200) throw", "if (false) throw"],
  [V, "http: size cap removed", "if (text.length > maxBytes) throw", "if (false) throw"],
  [V, "http: unsafe url fetched", "if (!isSafeJwksUrl(url)) throw new Error(\"unsafe_url\");", ""],
  [V, "http: doc shape unchecked", "if (!doc || typeof doc !== \"object\" || !Array.isArray(doc.keys)) throw new Error(\"bad_document\");", ""],
];
const read = (f) => readFileSync(join(api, f), "utf8");
const origs = new Map(); for (const f of new Set(M.map((m) => m[0]))) origs.set(f, read(f));
const restore = () => { for (const [f, s] of origs) writeFileSync(join(api, f), s); };
const run = () => spawnSync("node", ["--test", "--experimental-strip-types", ...T], { cwd: api, encoding: "utf8", timeout: 600000, env: { ...process.env, NODE_TEST_CONTEXT: undefined } });
let killed = 0; const survived = [], skipped = [];
try {
  const base = run();
  if (base.status !== 0) { console.error("BASELINE FAILS"); process.exitCode = 2; throw new Error("baseline"); }
  for (const [f, name, from, to] of M) {
    const src = origs.get(f);
    if (!src.includes(from)) { skipped.push(name); console.log("SKIP (pattern not found)", name); continue; }
    writeFileSync(join(api, f), src.replace(from, to));
    const r = run(); restore();
    if (r.status !== 0) { killed++; console.log("killed  ", name); } else { survived.push(name); console.log("SURVIVED", name); }
  }
} catch (e) { if (e.message !== "baseline") throw e; } finally { restore(); }
console.log(`mutants: ${killed} killed, ${survived.length} survived, ${skipped.length} skipped of ${M.length}`);
if (survived.length || skipped.length) process.exitCode = 1;
