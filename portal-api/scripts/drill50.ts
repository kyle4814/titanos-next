// C2 DRILL HARNESS (plan ch.6 C2 kill test: 0 human touches in a 50-run drill).
// Runs N synthetic strangers through: sign up -> verify domain -> checkout -> invoice -> cancel -> refund,
// against the mock adapters (MemoryStore, MockBilling, fake DNS, MockMailer). No live Stripe, DNS or email.
// Every step is recorded. A "human touch" is: an unexpected HTTP status, a thrown error, a step timeout,
// a missing adapter (503 store_unavailable / not_configured), or a review card left open for an operator.
// Usage: node --experimental-strip-types scripts/drill50.ts [--runs 50] [--timeout-ms 5000] [--plant RUN:STEP:KIND]
import { make } from "../test/harness.ts";
import { PRODUCTS } from "../src/catalogue.ts";

export type FaultKind = "status503" | "status500" | "throw" | "timeout" | "needs_human";
export interface Fault { run: number; step: string; kind: FaultKind }
export interface Touch { run: number; step: string; reason: string; detail: string }
export interface DrillResult {
  label: "SYNTHETIC, mock adapters, local only";
  adapterTarget: string; realRun: string;
  runs: number; stepsRecorded: number; touches: number; touchedRuns: number[];
  perStepFailures: Record<string, number>; perStepCounts: Record<string, number>;
  failures: Touch[]; openReviewCards: number; pass: boolean; verdict: string; planted: Fault[];
}
const SUBS = ["monitor_monthly", "monitor_annual", "ai_growth", "ai_ops", "ai_embedded", "leads_retainer"];
export const STEPS = ["signup.request", "signup.verify", "verify_domain.add", "verify_domain.verify", "checkout.start", "checkout.pay", "invoice.list", "invoice.get", "cancel", "refund"] as const;

export async function runDrill(opts: { runs?: number; timeoutMs?: number; faults?: Fault[]; adapterTarget?: string } = {}): Promise<DrillResult> {
  const runs = opts.runs ?? 50, timeoutMs = opts.timeoutMs ?? 5000, faults = opts.faults ?? [];
  const h = make(); // fresh mock stack for the whole drill; each run uses fresh strangers
  const products = Object.keys(PRODUCTS);
  const failures: Touch[] = [], counts: Record<string, number> = {}, fails: Record<string, number> = {};
  let steps = 0, run = 0, cardsSeen = 0;
  const touch = (step: string, reason: string, detail: string) => { failures.push({ run, step, reason, detail }); fails[step] = (fails[step] ?? 0) + 1; };

  // one recorded step: timeout, thrown error, unexpected status, missing adapter and injected faults all count
  async function step(label: string, fn: () => Promise<Response>, expect = 200): Promise<any | undefined> {
    steps++; counts[label] = (counts[label] ?? 0) + 1;
    const fault = faults.find((f) => f.run === run && f.step === label);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      let call: Promise<Response>;
      if (fault?.kind === "throw") throw new Error("planted failure");
      else if (fault?.kind === "timeout") call = new Promise<Response>(() => {});
      else if (fault?.kind === "status503") call = Promise.resolve(new Response('{"error":"store_unavailable"}', { status: 503 }));
      else if (fault?.kind === "status500") call = Promise.resolve(new Response('{"error":"boom"}', { status: 500 }));
      else call = fn();
      const r = await Promise.race([call, new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error("step_timeout")), timeoutMs); })]);
      const body = await r.json().catch(() => ({}));
      if (r.status === 503 || /store_unavailable|not_configured|needs_human/.test(JSON.stringify(body))) { touch(label, "missing_adapter_or_needs_human", `${r.status} ${JSON.stringify(body).slice(0, 120)}`); return undefined; }
      if (r.status !== expect) { touch(label, "unexpected_status", `${r.status} expected ${expect}`); return undefined; }
      if (fault?.kind === "needs_human") { touch(label, "needs_human_state", "planted"); return undefined; }
      return body;
    } catch (e: any) {
      touch(label, e?.message === "step_timeout" ? "timeout" : "thrown", String(e?.message ?? e).slice(0, 120));
      return undefined;
    } finally { if (timer) clearTimeout(timer); }
  }

  for (run = 0; run < runs; run++) {
    const email = `drill${run}@drill${run}.com.au`, domain = `drill${run}.com.au`;
    const pid = products[run % products.length];
    await step("signup.request", () => h.req("POST", "/auth/request", { body: { email } }), 202);
    const lt = h.mailer.outbox.filter((m) => m.to === email).at(-1)?.text.match(/token=(ll_[0-9a-f]+)/)?.[1];
    const v = lt ? await step("signup.verify", () => h.req("POST", "/auth/verify", { body: { token: lt } })) : (touch("signup.verify", "missing_adapter_or_needs_human", "no login mail delivered"), undefined);
    const session: string | undefined = v?.session;
    if (!session) continue; // downstream steps cannot run without a session: the touch is already recorded
    const d = await step("verify_domain.add", () => h.req("POST", "/domains", { token: session, body: { domain } }), 201);
    if (d) h.dns.zone[d.record.name] = [d.record.value]; // the stranger publishes the TXT record
    if (d) await step("verify_domain.verify", () => h.req("POST", `/domains/${d.id}/verify`, { token: session }));
    for (const p of [pid, "compliance_pack"]) {
      const c = await step("checkout.start", () => h.req("POST", "/checkout", { token: session, body: { product: p, domain } }), 201);
      if (!c) continue;
      await step("checkout.pay", async () => (await h.pay(p)).res); // Stripe's signed webhook, simulated
    }
    const inv = await step("invoice.list", () => h.req("GET", "/invoices", { token: session }));
    if (inv?.invoices?.[0]) await step("invoice.get", () => h.req("GET", `/invoices/${inv.invoices[0].id}`, { token: session }));
    else if (inv) touch("invoice.get", "missing_invoice", "no invoice after payment");
    const bill = await h.j(await h.req("GET", "/billing", { token: session }));
    for (const s of bill.subscriptions ?? []) await step("cancel", () => h.req("POST", `/subscriptions/${s.id}/cancel`, { token: session }));
    const comp = (bill.purchases ?? []).find((p: any) => p.productId === "compliance_pack");
    h.clock.t += 3 * 86_400_000; // day 3, inside the 14-day window
    if (comp) {
      const rf = await step("refund", () => h.req("POST", "/refunds", { token: session, body: { purchaseId: comp.id } }));
      if (rf && rf.status !== "refunded") touch("refund", "needs_human_state", `status ${rf.status}`);
    } else touch("refund", "missing_purchase", "no compliance purchase to refund");
    const open = (await h.store.openCards()).length;
    if (open > cardsSeen) { touch("refund", "review_card_opened", `${open - cardsSeen} card(s) for an operator`); cardsSeen = open; }
  }
  const cards = (await h.store.openCards()).length;
  const touchedRuns = [...new Set(failures.map((f) => f.run))];
  const pass = failures.length === 0 && cards === 0;
  return {
    label: "SYNTHETIC, mock adapters, local only", adapterTarget: opts.adapterTarget ?? "web/w2_c2account-2026-11-06 portal-api (MemoryStore, MockBilling, fakeResolver, MockMailer)",
    realRun: "PENDING LIVE (real D1, test-mode Stripe, real DNS and mail are not built or authorised)",
    runs, stepsRecorded: steps, touches: failures.length, touchedRuns, perStepFailures: fails, perStepCounts: counts,
    failures, openReviewCards: cards, pass, planted: faults,
    verdict: pass ? `DRILL50 PASS ${runs} runs, 0 touches` : `DRILL50 FAIL ${failures.length} touches in runs [${touchedRuns.join(",")}]`,
  };
}

if (process.argv[1]?.endsWith("drill50.ts")) {
  const a = process.argv.slice(2), get = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const faults: Fault[] = a.flatMap((x, i) => (x === "--plant" ? [(() => { const [r, s, k] = a[i + 1].split(":"); return { run: +r, step: s, kind: k as FaultKind }; })()] : []));
  const res = await runDrill({ runs: +(get("--runs") ?? 50), timeoutMs: +(get("--timeout-ms") ?? 5000), faults });
  console.log(JSON.stringify(res, null, 2));
  console.log(res.verdict);
  process.exit(res.pass ? 0 : 1);
}
