// C8 f426 mutation test: break the tenant guard, the GET-only guard, the role floor and the no-provider flag one at a time;
// the route suite (portal-api/test/payout_attention_route.test.ts) must FAIL for every mutant. Restores each file afterwards.
// Run: node scripts/mutate_payout_attention.mjs   (exit 1 if any mutant survives)
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const PA = join(dirname(fileURLToPath(import.meta.url)), "..", "portal-api");
const SVC = "src/enterprise/service.ts", RT = "src/enterprise/routes.ts", VIEW = "src/enterprise/payout_held_view.ts";
const mutants = [
  ["M1 tenant taken from the query string, not the path seat", RT, 'json(await s.payoutAttention(d, ctx, pid))', 'json(await s.payoutAttention(d, ctx, new URL(req.url).searchParams.get("tenantId") ?? pid))'],
  ["M2 attention route also answers POST", RT, 'rest === "payouts/attention" && m === "GET"', 'rest === "payouts/attention"'],
  ["M3 retry-plan route also answers POST", RT, 'rest === "payouts/retry-plan" && m === "GET"', 'rest === "payouts/retry-plan"'],
  ["M4 role floor lowered from admin to viewer", SVC, 'access(d, ctx, pid, "admin", "partner");\n  const items =', 'access(d, ctx, pid, "viewer", "partner");\n  const items ='],
  ["M5 partner-kind check dropped", SVC, 'access(d, ctx, pid, "admin", "partner");\n  const plan', 'access(d, ctx, pid, "admin");\n  const plan'],
  ["M6 held rows get planned", VIEW, 'if (p.status === "held") { plan.skipped.push', 'if (false) { plan.skipped.push'],
  ["M7 retry-plan skips the membership check (plans for the path id)", SVC, 'const { tenant } = await access(d, ctx, pid, "admin", "partner");\n  const plan = await planRetriesForTenant(ent(d).store, tenant.id);', 'const tenant = { id: pid };\n  const plan = await planRetriesForTenant(ent(d).store, tenant.id);'],
  ["M8 wouldCallProvider flipped to true in the response", SVC, 'executes: false, wouldCallProvider: false, cardNeeded: "GATE1/GATE2", note: ATTENTION_NOTE, count', 'executes: false, wouldCallProvider: true, cardNeeded: "GATE1/GATE2", note: ATTENTION_NOTE, count'],
];
let survived = 0;
for (const [name, file, from, to] of mutants) {
  const path = join(PA, file), orig = readFileSync(path, "utf8");
  if (!orig.includes(from)) { console.log(`ERROR ${name}: anchor not found`); survived++; continue; }
  writeFileSync(path, orig.replace(from, to));
  let r; try { r = spawnSync("node", ["--test", "--experimental-strip-types", "test/payout_attention_route.test.ts"], { cwd: PA, encoding: "utf8" }); } finally { writeFileSync(path, orig); }
  const killed = r.status !== 0;
  console.log(`${killed ? "KILLED  " : "SURVIVED"} ${name}`);
  if (!killed) survived++;
}
console.log(`${mutants.length - survived}/${mutants.length} killed`);
process.exit(survived ? 1 : 0);
