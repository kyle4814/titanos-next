#!/usr/bin/env node
// C8 f314 mutation check for the enterprise construction point. Plants each mutant, runs test/ent_context.test.ts, expects FAIL (killed).
// Always restores the original bytes. Run: node scripts/mutate_ent_context.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const api = join(dirname(fileURLToPath(import.meta.url)), "..", "portal-api");
const E = "src/ent_context.ts", D = "src/build_deps.ts";
const T = ["test/ent_context.test.ts"];
const M = [
  // drop one dep (one mutant per member of the returned object)
  [E, "drop dep: book", ", book, estateCache: s.cache", ", estateCache: s.cache"],
  [E, "drop dep: estateCache", "estateCache: s.cache, refreshLimiter", "refreshLimiter"],
  [E, "drop dep: refreshLimiter", ", refreshLimiter: s.limiter,", ","],
  [E, "drop dep: sealKeys", "sealKeys, selfDeal,", "selfDeal,"],
  [E, "drop dep: selfDeal", "sealKeys, selfDeal, book", "sealKeys, book"],
  [E, "drop dep: payoutLookup", "payouts: seams.payouts, payoutLookup: seams.payoutLookup,", "payouts: seams.payouts,"],
  [E, "drop dep: internalSecret", "internalSecret: env.INTERNAL_API_SECRET,", ""],
  [E, "drop dep: approvals", "approvals: seams.approvals(db, env), ", ""],
  [D, "wiring dropped: build_deps never assigns ent", "    ent, entError, store, billing:", "    entError, store, billing:"],
  // swap the tenant/isolation key: one cache and limiter for every DB binding on the isolate
  [E, "swap key: one shared cache for all DBs", "shared.get(db)", "shared.get(globalThis as object)"],
  [E, "swap key: shared.set under a constant", "shared.set(db, s)", "shared.set(globalThis as object, s)"],
  // default tenant
  [E, "default tenant: store seeded at construction", "store: seams.storeFactory(db, env),", 'store: (() => { const st = seams.storeFactory!(db, env); void st.putTenant({ id: "ten_default", kind: "enterprise", name: "default", slug: "default" } as never); return st; })(),'],
  [E, "default tenant: SQL run at construction", "const book = makeBookFacts(env);", "const book = makeBookFacts(env); void db.prepare(\"SELECT 1\").first();"],
  // swallow a binding error
  [E, "swallow: missing seal keys tolerated", 'if (!env.ENT_SEAL_KEYS) throw new EntBuildError("missing_binding", "ENT_SEAL_KEYS");', ""],
  [E, "swallow: bad seal JSON becomes an empty keyring", 'try { k = JSON.parse(raw); } catch { throw new EntBuildError("bad_binding", "ENT_SEAL_KEYS"); }', 'try { k = JSON.parse(raw); } catch { return { current: "", keys: {} }; }'],
  [E, "swallow: missing internal secret tolerated", 'if (!env.INTERNAL_API_SECRET) throw new EntBuildError("missing_binding", "INTERNAL_API_SECRET");', ""],
  [E, "swallow: missing store seam tolerated", 'if (!seams.storeFactory) throw new EntBuildError("adapter_unavailable", "store");', ""],
  [E, "swallow: missing accounts seam tolerated", 'if (!selfDeal) throw new EntBuildError("adapter_unavailable", "accounts");', ""],
  [E, "swallow: missing idp tolerated", 'if (!idp) throw new EntBuildError("adapter_unavailable", "idp");', ""],
  [D, "swallow: build_deps drops the reason", "entError = e.message;", "entError = undefined;"],
  [D, "swallow: build_deps catches everything", "if (!(e instanceof EntBuildError)) throw e; entError = e.message;", "entError = e instanceof EntBuildError ? e.message : undefined;"],
  [D, "rethrow: a typed refusal takes the whole portal down", "if (!(e instanceof EntBuildError)) throw e; entError = e.message;", "throw e;"],
  [E, "error text carries the value", 'constructor(reason: EntBuildReason, binding: string) { super(`${reason}:${binding}`);', 'constructor(reason: EntBuildReason, binding: string) { super(`${reason}:${binding}:${JSON.stringify(arguments)}`);'],
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
