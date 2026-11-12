// Guards the f72 miss taxonomy: totals reconcile, holdout/dev files untouched (sha256), output deterministic, no tuning surface.
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { taxonomy, analyse, causeOf, CAUSES } from "./concierge_miss_taxonomy.mjs";
const root = new URL("..", import.meta.url).pathname;
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(root + p)).digest("hex");
const files = ["lib/concierge/holdout.tsv", "lib/concierge/dev.tsv", "lib/concierge/router.ts", "lib/concierge/portal.ts"];
const before = files.map(sha);
let pass = 0, fail = 0;
const t = (n, ok, d = "") => { if (ok) pass++; else { fail++; console.log("FAIL", n, d); } };
const a = JSON.stringify(taxonomy()), b = JSON.stringify(taxonomy()), T = JSON.parse(a);
const lines = (p) => fs.readFileSync(root + p, "utf8").split("\n").filter(Boolean).length;
t("holdout totals reconcile to 120 rows", T.holdout.n === 120 && lines("lib/concierge/holdout.tsv") === 120, String(T.holdout.n));
t("dev totals reconcile to the dev file rows", T.dev.n === lines("lib/concierge/dev.tsv"), String(T.dev.n));
for (const k of ["holdout", "dev"]) {
  const s = T[k], cells = Object.values(s.matrix).flatMap((r) => Object.values(r)).reduce((x, y) => x + y, 0);
  t(`${k}: matrix cells sum to n`, cells === s.n, `${cells} vs ${s.n}`);
  t(`${k}: diagonal + off-diagonal = n`, s.n - s.offDiagonal === Object.entries(s.matrix).reduce((x, [e, r]) => x + (r[e] || 0), 0));
  t(`${k}: cause counts sum to misses`, Object.values(s.causes).reduce((x, y) => x + y, 0) === s.misses);
  t(`${k}: right + misses = n`, s.right + s.misses === s.n);
  t(`${k}: shelf-pair counts <= misses`, s.pairs.reduce((x, p) => x + p.n, 0) <= s.misses);
  t(`${k}: top10 has at most 10 and sorted desc`, s.top10.length <= 10 && s.top10.every((p, i, arr) => !i || arr[i - 1].n >= p.n));
  t(`${k}: top5 diagnoses are DESIGN ONLY text`, s.top5.length <= 5 && s.top5.every((p) => /^DESIGN ONLY/.test(p.recommendation) && p.diagnosis.length > 20));
}
t("holdout accuracy on the int3 router: 78/120 (f65 measured 76; hand merge 77; F-434 ask-router +1)", T.holdout.right === 78, String(T.holdout.right));
t("matrix is deterministic across two runs (byte identical)", a === b);
t("CLI --json output equals in-process output", JSON.stringify(JSON.parse(execFileSync("node", ["--experimental-strip-types", root + "scripts/concierge_miss_taxonomy.mjs", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\n$/, ""))) === a);
const after = files.map(sha);
t("holdout.tsv byte-identical (sha256 before and after)", before[0] === after[0]);
t("dev.tsv, router.ts and portal.ts byte-identical", before.slice(1).every((h, i) => h === after[i + 1]));
t("script opens no file for writing", !/writeFile|appendFile|createWriteStream|openSync/.test(fs.readFileSync(root + "scripts/concierge_miss_taxonomy.mjs", "utf8")));
t("mutant: a planted miss changes the causes", analyse([{ seat: "guest", expect: "portal:scan", got: "none", ok: false }]).causes.unmatched === 1);
t("cause classes cover every miss shape", causeOf({ ok: false, expect: "none", got: "portal:scan" }) === "off-topic matched" && causeOf({ ok: false, expect: "ask", got: "portal:scan" }) === "ask not raised" && causeOf({ ok: false, expect: "a", got: "b" }) === "wrong shelf" && CAUSES.length === 5);
console.log(`concierge miss taxonomy: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
