// f88: MUTATION CHECK for share.ts. Each mutant is applied to a TEMP COPY of src/ and the invariants suite is run against
// it; the suite must FAIL (mutant caught). The live src/ is never touched. SYNTHETIC data, no network.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MUTANTS: { name: string; file: string; from: string; to: string }[] = [
  { name: "M1 round half up instead of floor", file: "src/enterprise/share.ts", from: "Math.max(0, Math.floor((amountCents * bps) / 10_000))", to: "Math.max(0, Math.round((amountCents * bps) / 10_000))" },
  { name: "M2 remainder dropped (platform share recomputed by floor)", file: "src/enterprise/share.ts", from: "platformCents: grossCents - partnerCents", to: "platformCents: Math.floor((grossCents * (10_000 - bps)) / 10_000)" },
  { name: "M3 replay double-counts (unique key made per-call)", file: "src/enterprise/share.ts", from: "uniq: `commission:${inv.id}`", to: "uniq: `commission:${inv.id}:${randomToken(\"r\", 4)}`" },
  { name: "M4 hold off by one day", file: "src/enterprise/share.ts", from: "export const HOLD_DAYS = 30;", to: "export const HOLD_DAYS = 29;" },
  { name: "M5 cross-tenant sum in statement", file: "src/enterprise/share.ts", from: "x.partnerId === partner.id && ", to: "" },
  { name: "M6 refund can go negative (over-refund not capped)", file: "src/enterprise/share.ts", from: "refundedCents >= total ? commission : Number(", to: "false ? commission : Number(" },
  { name: "M7 hold releases at day 30 exclusive", file: "src/enterprise/store.ts", from: "e.availableAt <= now", to: "e.availableAt < now" },
  { name: "M8 ledgerOf leaks a prefix neighbour", file: "src/enterprise/store.ts", from: "e.partnerId === p).sort", to: "e.partnerId.startsWith(p)).sort" },
];
function runOn(m: (typeof MUTANTS)[number]): Promise<{ caught: boolean; applied: boolean; tail: string }> {
  const dir = mkdtempSync(join(tmpdir(), "f88_mut_"));
  if (!dir || dir === "/" || !dir.includes("f88_mut_")) throw new Error("unsafe temp dir");
  cpSync(join(root, "src"), join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "test"));
  cpSync(join(root, "test/share_ledger_invariants.test.ts"), join(dir, "test/share_ledger_invariants.test.ts"));
  const f = join(dir, m.file), src = readFileSync(f, "utf8");
  const applied = src.includes(m.from);
  writeFileSync(f, src.replace(m.from, m.to));
  return new Promise((res) => {
    let out = "";
    const p = spawn(process.execPath, ["--test", "--experimental-strip-types", "test/share_ledger_invariants.test.ts"], { cwd: dir, stdio: ["ignore", "pipe", "pipe"], env: Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("NODE_TEST"))) });
    p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => { rmSync(dir, { recursive: true, force: true }); res({ caught: code !== 0, applied, tail: code === 0 ? out.slice(-200) : out.split("\n").filter((l) => /^not ok/.test(l)).slice(0, 2).join(" | ") }); });
  });
}

test("every mutant of share.ts is applied and CAUGHT by the invariants suite", async () => {
  const results = await Promise.all(MUTANTS.map(runOn));
  let caught = 0;
  for (const [i, r] of results.entries()) {
    console.log(`SHAREINV MUTANT ${r.caught ? "CAUGHT" : "SURVIVED"} ${MUTANTS[i].name} :: ${r.tail}`);
    assert.ok(r.applied, `${MUTANTS[i].name}: the patch did not apply (share.ts changed shape)`);
    assert.ok(r.caught, `${MUTANTS[i].name} SURVIVED`);
    caught++;
  }
  console.log(`SHAREINV MUTANTS caught=${caught}/${MUTANTS.length}`);
});
