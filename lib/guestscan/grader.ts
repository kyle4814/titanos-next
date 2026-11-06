// The planted-fixture grader: runs the scanner over every fixture and scores it.
import { runScan } from "./scan.ts";
import { FIXTURES, fakeDoh } from "./fixtures.ts";

export async function gradeFixtures() {
  const misses: string[] = [];
  let total = 0, hit = 0;
  for (const fx of FIXTURES) {
    const r = await runScan(fx.domain, fakeDoh(fx.world).fetch);
    for (const [check, want] of Object.entries(fx.expect)) {
      total++;
      const got = r.findings.find((x) => x.check === check)?.status;
      if (got === want) hit++; else misses.push(`${fx.id}: ${check} want ${want} got ${got}`);
    }
    if (fx.grade) { total++; if (r.grade === fx.grade) hit++; else misses.push(`${fx.id}: grade want ${fx.grade} got ${r.grade}`); }
  }
  return { total, hit, pct: total ? (hit / total) * 100 : 0, misses, fixtures: FIXTURES.length };
}
