// Regression (2026-11-28 deploy refusal): the cloud runner builds from `git archive` (no .git), so every git-derived
// sitemap lastmod vanished and test_tech_seo failed at 195/208. Guard both halves of the fix: routes.ts falls back to
// SOURCE_DATE_EPOCH when git gives no date, and cloud_build.sh exports the source commit's epoch to the remote build.
// (The end-to-end check is test_tech_seo itself, which runs on the runner against the real no-.git tree.)
import fs from "node:fs";
import assert from "node:assert/strict";
const routes = fs.readFileSync("lib/routes.ts", "utf8");
const cb = fs.readFileSync("scripts/cloud_build.sh", "utf8");
assert.match(routes, /if \(!headDate && \/\^\\d\+\$\/\.test\(process\.env\.SOURCE_DATE_EPOCH/, "routes.ts: no SOURCE_DATE_EPOCH fallback in repoHeadDate");
assert.match(cb, /SRC_EPOCH="\$\(git show -s --format=%ct "\$SRC"\)"/, "cloud_build.sh: does not compute the source commit epoch");
assert.match(cb, /export SOURCE_DATE_EPOCH="\$EPOCH"/, "cloud_build.sh: does not export SOURCE_DATE_EPOCH on the runner");
// behaviour of the fallback expression itself
const f = (env, gitDate) => { let d = gitDate; if (!d && /^\d+$/.test(env || "")) d = new Date(Number(env) * 1000); return d; };
assert.equal(f("1764320000", undefined).toISOString(), "2025-11-28T08:53:20.000Z");
assert.equal(f("", undefined), undefined);
assert.equal(f("abc", undefined), undefined);
console.log("PASS lastmod fallback without git (routes.ts + cloud_build.sh)");
