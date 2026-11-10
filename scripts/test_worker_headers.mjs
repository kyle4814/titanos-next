// f86 gate: the portal-api Worker answers every route with the five security headers (shared portal-api/src/http.ts),
// six header mutants are caught, and headers_lint --worker reports zero FAIL on the real tree. Offline, synthetic data, no deploy.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env, NODE_NO_WARNINGS: "1" };
delete env.NODE_TEST_CONTEXT;
let bad = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) bad++; };

const t = spawnSync(process.execPath, ["--test", "--experimental-strip-types", "test/http_headers.test.ts", "test/http_headers_mutants.test.ts"], { cwd: path.join(root, "portal-api"), encoding: "utf8", env, timeout: 300000 });
const pass = /# pass (\d+)/.exec(t.stdout)?.[1], fail = /# fail (\d+)/.exec(t.stdout)?.[1];
ok(t.status === 0 && fail === "0" && Number(pass) >= 14, `portal-api header suites (pass ${pass}, fail ${fail})`);
if (t.status !== 0) console.log(t.stdout.slice(-2000));

const l = spawnSync(process.execPath, ["scripts/headers_lint.mjs", "--worker", "portal-api/src"], { cwd: root, encoding: "utf8", env });
ok(/\nFAIL: 0\n/.test("\n" + l.stdout), "headers_lint --worker: FAIL 0 (H2/H3/H4/H5 clean; H1/H6/H7 still clean)");
if (/\nFAIL: [1-9]/.test("\n" + l.stdout)) console.log(l.stdout);

if (bad) { console.log(`test_worker_headers: ${bad} FAILED`); process.exit(1); }
console.log("test_worker_headers: all passed");
