// Savings calculator engine tests. Synthetic fixtures only. SAVCALC_MODULE overrides the module (used by the mutation runner).
import path from "node:path";
const mod = process.env.SAVCALC_MODULE ? path.resolve(process.env.SAVCALC_MODULE) : new URL("../lib/savings-calculator.ts", import.meta.url).pathname;
const { calculateSavings, LIMITS } = await import(mod);

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const mk = (o = {}) => ({ headcount: 10, loadedHourlyCostAud: 80, tasks: [{ name: "SYNTHETIC invoice matching", hoursPerWeek: 3 }, { name: "SYNTHETIC report copying", hoursPerWeek: 2 }], currentToolSpendAud: 20000, ...o });

// Golden 1, hand computed: base = 10 x 5 x 46 = 2300 h. hours 690..1610. dollars floor 690x80 = 55200; ceiling 1610x80 + 20000x0.25 = 133800.
// best = 49997 / (133800/12 = 11150) = 4.48; worst = 149997 / (55200/12 = 4600) = 32.61.
const g1 = calculateSavings(mk());
ok(g1.ok, "golden 1 ok");
ok(g1.annualHoursReturned.floor === 690 && g1.annualHoursReturned.ceiling === 1610, "golden 1 hours 690 to 1610");
ok(g1.annualDollarsAud.floor === 55200 && g1.annualDollarsAud.ceiling === 133800, "golden 1 dollars 55200 to 133800");
ok(g1.paybackMonths.bestMonths === 4.48 && g1.paybackMonths.worstMonths === 32.61, "golden 1 payback 4.48 to 32.61 months");

// Golden 2: base = 1 x 1 x 46 = 46 h. hours 13.8..32.2. dollars 1380..3220. best = 49997/268.333 = 186.32; worst = 149997/115 = 1304.32.
const g2 = calculateSavings({ headcount: 1, loadedHourlyCostAud: 100, tasks: [{ name: "SYNTHETIC one task", hoursPerWeek: 1 }], currentToolSpendAud: 0 });
ok(g2.annualHoursReturned.floor === 13.8 && g2.annualHoursReturned.ceiling === 32.2, "golden 2 hours 13.8 to 32.2");
ok(g2.annualDollarsAud.floor === 1380 && g2.annualDollarsAud.ceiling === 3220, "golden 2 dollars 1380 to 3220");
ok(g2.paybackMonths.bestMonths === 186.32 && g2.paybackMonths.worstMonths === 1304.32, "golden 2 payback 186.32 to 1304.32");

// Zero hours gives zero, null payback, never NaN.
const z = calculateSavings(mk({ tasks: [{ name: "SYNTHETIC idle", hoursPerWeek: 0 }], currentToolSpendAud: 0 }));
ok(z.annualHoursReturned.floor === 0 && z.annualHoursReturned.ceiling === 0 && z.annualDollarsAud.ceiling === 0, "zero hours gives zero");
ok(z.paybackMonths.bestMonths === null && z.paybackMonths.worstMonths === null, "zero hours gives null payback");

// Clamp: out-of-range values are pulled in and reported.
const c = calculateSavings(mk({ headcount: 9_999_999, loadedHourlyCostAud: 99999, currentToolSpendAud: 9e12 }));
ok(c.ok && c.inputs.headcount === LIMITS.headcount.max && c.inputs.loadedHourlyCostAud === LIMITS.hourlyCostAud.max && c.inputs.currentToolSpendAud === LIMITS.toolSpendAud.max, "out-of-range inputs are clamped to the limits");
ok(c.clamped.includes("headcount") && c.clamped.includes("loadedHourlyCostAud") && c.clamped.includes("currentToolSpendAud"), "clamped fields are listed");
const lo = calculateSavings(mk({ headcount: 0, loadedHourlyCostAud: 1 }));
ok(lo.ok && lo.inputs.headcount === 1 && lo.inputs.loadedHourlyCostAud === LIMITS.hourlyCostAud.min, "below-range inputs clamp up to the minimum");
const big = calculateSavings(mk({ tasks: Array.from({ length: 5 }, (_, i) => ({ name: `SYNTHETIC t${i}`, hoursPerWeek: 40 })) }));
ok(big.ok && big.weeklyHoursOnNamedTasks === LIMITS.hoursPerWeekTotal.max, "total task hours clamp to 60 a week");

// Typed errors, never NaN.
const errs = [
  [null, "NOT_AN_OBJECT"], ["x", "NOT_AN_OBJECT"],
  [mk({ headcount: NaN }), "NOT_A_NUMBER"], [mk({ headcount: Infinity }), "NOT_A_NUMBER"], [mk({ loadedHourlyCostAud: "80" }), "NOT_A_NUMBER"],
  [mk({ headcount: -3 }), "NEGATIVE"], [mk({ currentToolSpendAud: -1 }), "NEGATIVE"],
  [mk({ tasks: "no" }), "TASKS_NOT_AN_ARRAY"], [mk({ tasks: [{ name: " ", hoursPerWeek: 1 }] }), "TASK_NAME_MISSING"],
  [mk({ tasks: [{ name: "SYNTHETIC a", hoursPerWeek: NaN }] }), "NOT_A_NUMBER"], [mk({ tasks: [{ name: "SYNTHETIC a", hoursPerWeek: -2 }] }), "NEGATIVE"],
];
for (const [inp, code] of errs) { const r = calculateSavings(inp); ok(r.ok === false && r.error.code === code, `bad input returns ${code}`); }

// Copy rules: nobody replaced, no em or en dashes, no job-removal claims.
const text = JSON.stringify([g1.method, g1.disclaimer, g1.label, g1.paybackMonths.note]);
ok(!/[—–]/.test(text), "copy has zero em or en dashes");
ok(/nobody is replaced/i.test(g1.disclaimer) && !/jobs? (removed|cut|saved)|redundan|headcount reduction/i.test(text), "copy says nobody is replaced and claims no job removal");
ok(g1.method.includes("headcount 10") && g1.method.includes("AU$49997"), "output carries its inputs and formula string");

// Properties.
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const finite = (r) => [r.annualHoursReturned.floor, r.annualHoursReturned.ceiling, r.annualDollarsAud.floor, r.annualDollarsAud.ceiling, r.weeklyHoursOnNamedTasks].every(Number.isFinite)
  && [r.paybackMonths.bestMonths, r.paybackMonths.worstMonths].every((v) => v === null || Number.isFinite(v));
let bad = 0, order = 0, ranOk = 0;
for (let i = 0; i < 1000; i++) {
  const wild = [() => rnd() * 1e6, () => rnd() * 100, () => -rnd() * 10, () => NaN, () => Infinity, () => 0, () => rnd() * 1e15];
  const pick = () => wild[Math.floor(rnd() * wild.length)]();
  const r = calculateSavings({ headcount: pick(), loadedHourlyCostAud: pick(), currentToolSpendAud: pick(), tasks: Array.from({ length: Math.floor(rnd() * 8) }, (_, k) => ({ name: `SYNTHETIC f${k}`, hoursPerWeek: pick() })) });
  if (r.ok) { ranOk++; if (!finite(r)) bad++; if (r.annualHoursReturned.floor > r.annualHoursReturned.ceiling || r.annualDollarsAud.floor > r.annualDollarsAud.ceiling) order++; }
  else if (!r.error || typeof r.error.code !== "string") bad++;
}
ok(bad === 0 && ranOk > 30, `fuzz of 1000 inputs: no NaN or Infinity, typed errors only (${ranOk} valid runs)`);
ok(order === 0, "floor <= ceiling across the fuzz");

let mono = true;
for (let h = 0; h < 40; h++) {
  const a = calculateSavings(mk({ tasks: [{ name: "SYNTHETIC m", hoursPerWeek: h }] })), b = calculateSavings(mk({ tasks: [{ name: "SYNTHETIC m", hoursPerWeek: h + 1 }] }));
  if (b.annualHoursReturned.floor < a.annualHoursReturned.floor || b.annualDollarsAud.ceiling < a.annualDollarsAud.ceiling) mono = false;
}
ok(mono, "monotonic in hours");
mono = true;
for (let n = 1; n < 400; n += 7) {
  const a = calculateSavings(mk({ headcount: n })), b = calculateSavings(mk({ headcount: n + 1 }));
  if (b.annualHoursReturned.ceiling < a.annualHoursReturned.ceiling || b.annualDollarsAud.floor < a.annualDollarsAud.floor) mono = false;
}
ok(mono, "monotonic in headcount");
for (let k = 0; k < 50; k++) { const r = calculateSavings(mk({ headcount: 1 + Math.floor(rnd() * 500), loadedHourlyCostAud: 15 + rnd() * 400 })); if (r.annualHoursReturned.floor > r.annualHoursReturned.ceiling) mono = false; }
ok(mono, "floor <= ceiling on valid inputs");

console.log(fail ? `FAILED ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
