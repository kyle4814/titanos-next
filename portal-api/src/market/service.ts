// C4 Pro seat and marketplace. The flow: an owner who verified a domain presses "get this fixed" (a hand-raised, consented
// job with the scan as evidence) -> funds the job (held on the platform balance) -> a pro claims it (pays the claim fee) ->
// the pro delivers -> WE re-scan -> only a PASS on the same check that was failing pays the pro. Nobody can mark a job proven:
// `reprove` is the single place proof is set, and `releasePayout` refuses without it. Zero model calls anywhere.
import { HttpError, type Deps } from "../service.ts";
import type { Account } from "../store.ts";
import { runScan, type DohFetch, type Finding } from "../../../lib/guestscan/scan.ts";
import { fixFor } from "../../../lib/guestscan/fixes.ts";
import type { JobPayments } from "./payments.ts";
import { type Job, type MarketCard, type MarketStore, type ProProfile, type Tier } from "./store.ts";
import { rankFor, boardOrder, WARRANTY_DAYS } from "./rank.ts";
import { openDispute, importPaid, apply as applyDispute } from "./dispute.ts";
import { judgeAttribution, clawbackFor, mayRaisePayoutCard, proofKey, emailDomain } from "./attribution.ts";
import { randomToken, timingSafeEqual } from "../util.ts";

export interface MarketDeps { store: MarketStore; payments: JobPayments; doh: (domain: string) => DohFetch; internalSecret?: string }
const DAY = 86_400_000;
// EXAMPLE prices (plan D1: AU$29 to AU$149 claim fee by size; the owner's job price is the pro's pay, no take rate on the fix).
export const TIERS: Record<Tier, { priceCents: number; claimFeeCents: number }> = {
  small: { priceCents: 9_900, claimFeeCents: 2_900 }, standard: { priceCents: 24_900, claimFeeCents: 5_900 }, large: { priceCents: 59_900, claimFeeCents: 14_900 },
};
export const SEAT_FEE_FACTOR = 0.5;          // pro seat (AU$149 a month, EXAMPLE) halves the claim fee
export const PAYOUT_REVIEW_CENTS = 50_000;   // a payout at or above this waits for a Kyle tap (GATE1)
export const CLAIM_WINDOW_MS = 7 * DAY, FUNDING_WINDOW_MS = DAY, OPEN_WINDOW_MS = 30 * DAY;
export const MAX_ACTIVE_CLAIMS = 3, MAX_OPEN_JOBS_PER_OWNER = 10, MIN_RESCAN_GAP_MS = 60_000;
const tierOf = (mins: number): Tier => (mins <= 20 ? "small" : mins <= 60 ? "standard" : "large");
const mk = (d: Deps) => { if (!d.market) throw new HttpError(503, "marketplace_unavailable"); return d.market; };
const ev = (j: Job, at: number, kind: string, detail: string) => { j.events.push({ at, kind, detail }); if (j.events.length > 100) j.events.splice(0, j.events.length - 100); };
const feeFor = (p: ProProfile, j: Job) => (p.plan === "seat" ? Math.round(j.claimFeeCents * SEAT_FEE_FACTOR) : j.claimFeeCents);

async function readCheck(m: MarketDeps, d: Deps, domain: string, check: string): Promise<{ id: string; finding: Finding | undefined }> {
  const r = await runScan(domain, m.doh(domain), d.now);
  return { id: `mscan_${d.now()}`, finding: r.findings.find((f) => f.check === check) };
}
const maskDomain = (dom: string) => { const [first, ...rest] = dom.split("."); return `${first[0]}***.${rest.join(".")}`; };
const need = async (m: MarketDeps, id: string) => { const j = await m.store.getJob(id); if (!j) throw new HttpError(404, "not_found"); return j; };
export const isInternal = (d: Deps, header: string | null) => { const s = d.market?.internalSecret; return !!s && !!header && timingSafeEqual(header, s); };

// ---------- pro seat ----------
export async function joinPro(d: Deps, a: Account, b: { acceptTerms?: unknown; display?: unknown; plan?: unknown }) {
  const m = mk(d);
  if (b.acceptTerms !== true) throw new HttpError(400, "terms_required");
  const display = typeof b.display === "string" && /^[\w .&'-]{2,40}$/.test(b.display.trim()) ? b.display.trim() : `Pro ${a.id.slice(-4)}`;
  const plan = b.plan === "seat" ? "seat" : "payg";   // the seat's AU$149 a month billing is a C2 product: NOT wired here, see receipt
  const had = await m.store.getPro(a.id);
  const p: ProProfile = had ?? { accountId: a.id, joinedAt: d.now(), onboarded: false, plan, display };
  if (had) { p.display = display; p.plan = plan; }
  await m.store.putPro(p);
  if (a.seat !== "pro") await d.store.putAccount({ ...a, seat: "pro" });
  return presentPro(p);
}
const presentPro = (p: ProProfile) => ({ accountId: p.accountId, display: p.display, plan: p.plan, onboarded: p.onboarded, connectLinked: !!p.connectAccountId });
async function requirePro(d: Deps, a: Account): Promise<ProProfile> {
  const p = await mk(d).store.getPro(a.id);
  if (a.seat !== "pro" || !p) throw new HttpError(403, "pro_seat_required");
  return p;
}
export async function onboard(d: Deps, a: Account) {
  const m = mk(d); const p = await requirePro(d, a);
  const r = await m.payments.onboardingLink(a.id, a.email, p.connectAccountId, `${d.siteOrigin}/pro?onboarded=1`, `${d.siteOrigin}/pro?refresh=1`);
  p.connectAccountId = r.connectAccountId; await m.store.putPro(p);
  return { url: r.url };
}
export async function refreshOnboarding(d: Deps, a: Account) {
  const m = mk(d); const p = await requirePro(d, a);
  p.onboarded = !!p.connectAccountId && (await m.payments.accountReady(p.connectAccountId)); await m.store.putPro(p);
  return presentPro(p);
}

// ---------- owner: hand-raise ----------
export async function createJob(d: Deps, a: Account, b: { domainId?: unknown; check?: unknown }) {
  const m = mk(d);
  if (typeof b.domainId !== "string" || typeof b.check !== "string" || !/^[A-Z-]{2,8}$/.test(b.check)) throw new HttpError(400, "invalid_request");
  const dom = await d.store.domainById(b.domainId);
  if (!dom || dom.accountId !== a.id) throw new HttpError(404, "not_found");
  if (!dom.verifiedAt) throw new HttpError(403, "domain_not_verified");   // only the proven owner of a domain can hire work on it
  const live = (j: Job) => !["cancelled", "refunded", "paid"].includes(j.status);
  if ((await m.store.jobsByOwner(a.id, true)).filter(live).length >= MAX_OPEN_JOBS_PER_OWNER) throw new HttpError(429, "too_many_open_jobs");
  if ((await m.store.jobsByDomain(dom.id, true)).some((j) => j.check === b.check && live(j))) throw new HttpError(409, "job_already_open_for_this_check");
  const { id: scanId, finding } = await readCheck(m, d, dom.domain, b.check);
  if (!finding) throw new HttpError(400, "unknown_check");
  if (finding.status !== "FAIL" && finding.status !== "WARN") throw new HttpError(409, finding.status === "PASS" ? "nothing_to_fix" : "cannot_read_check");
  const plan = fixFor(finding, dom.domain);
  const tier = tierOf(plan?.minutesByHand ?? 60), t = TIERS[tier], now = d.now();
  const id = randomToken("job", 10);
  const j: Job = {
    id, ownerAccountId: a.id, domainId: dom.id, domain: dom.domain, check: b.check, severity: finding.status, tier, priceCents: t.priceCents, claimFeeCents: t.claimFeeCents,
    status: "awaiting_funds", createdAt: now, updatedAt: now, baseline: { at: now, status: finding.status, detail: finding.detail }, abandonedBy: [], rescans: 0, warrantyChecks: 0, events: [],
    observations: [{ at: now, status: finding.status, src: "baseline" }], ownerEmailDomain: emailDomain(a.email),
  };
  const co = await m.payments.createJobCheckout({ jobId: id, ownerEmail: a.email, ownerAccountId: a.id, amountCents: j.priceCents, name: `TITANOS job: fix ${b.check} on ${dom.domain}`, successUrl: `${d.siteOrigin}/app?job=${id}`, cancelUrl: `${d.siteOrigin}/app`, idempotencyKey: `job_${id}` });
  j.checkoutId = co.id; ev(j, now, "created", `${finding.status} ${b.check} (${scanId}), tier ${tier}`);
  await m.store.putJob(j);
  return { job: presentOwner(j), payUrl: co.url };
}
// Called from the verified Stripe webhook (checkout.session.completed with metadata.market_job_id). Idempotent.
export async function confirmFunded(d: Deps, o: { jobId: string; checkoutId: string; paymentIntent?: string; amountTotal?: number; payerFingerprint?: string }): Promise<"funded" | "ignored"> {
  const m = mk(d); const j = await m.store.getJob(o.jobId);
  if (!j || j.status !== "awaiting_funds" || j.checkoutId !== o.checkoutId) return "ignored";
  if (o.amountTotal !== undefined && o.amountTotal !== j.priceCents) return "ignored";   // wrong amount never opens a job
  j.status = "open"; j.fundedAt = d.now(); j.updatedAt = j.fundedAt; j.paymentIntent = o.paymentIntent; if (o.payerFingerprint) j.payerFp = o.payerFingerprint; ev(j, j.fundedAt, "funded", "payment held on the platform balance");
  return (await m.store.transition(["awaiting_funds"], j)) ? "funded" : "ignored";
}
export async function cancelJob(d: Deps, a: Account, id: string) {
  const m = mk(d); const j = await need(m, id);
  if (j.ownerAccountId !== a.id) throw new HttpError(404, "not_found");
  if (j.status !== "open" && j.status !== "awaiting_funds") throw new HttpError(409, "cannot_cancel_after_claim");   // after a claim the way out is a dispute
  return refundAndClose(d, j, "cancelled", "owner cancelled before any claim");
}
async function refundAndClose(d: Deps, j: Job, to: "cancelled" | "refunded", why: string) {
  const m = mk(d); const from = j.status; const funded = !!j.fundedAt && !!j.paymentIntent;
  j.status = to; j.updatedAt = d.now(); ev(j, j.updatedAt, to, why);
  if (!(await m.store.transition([from], j))) throw new HttpError(409, "state_changed");
  if (funded) { try { j.refundRef = (await m.payments.refundHold(j.paymentIntent!, j.priceCents, `refund_${j.id}`)).id; await m.store.putJob(j); } catch { ev(j, d.now(), "refund_failed", "refund call failed; will retry via sweep"); await m.store.putJob(j); } }
  return presentOwner(j);
}

// ---------- pro: board, claim, deliver ----------
export async function board(d: Deps, a: Account) {
  const m = mk(d); const p = await requirePro(d, a);
  const jobs = (await m.store.jobsByStatus(["open"], true)).filter((j) => j.ownerAccountId !== a.id).sort((x, y) => y.createdAt - x.createdAt);
  return { jobs: jobs.map((j) => ({ id: j.id, domainMasked: maskDomain(j.domain), check: j.check, severity: j.severity, tier: j.tier, payCents: j.priceCents, claimFeeCents: feeFor(p, j), postedAt: j.createdAt, note: "Hand-raised by the verified owner. The full domain shows after you claim." })), onboarded: p.onboarded, activeClaims: (await m.store.jobsByPro(a.id, true)).filter((j) => j.status === "claimed" || j.status === "delivered").length };
}
export async function claim(d: Deps, a: Account, id: string) {
  const m = mk(d); const p = await requirePro(d, a); let j = await need(m, id);
  if (!p.onboarded || !p.connectAccountId) throw new HttpError(403, "payout_onboarding_required");   // never owe a payout we cannot make
  if (j.ownerAccountId === a.id) throw new HttpError(403, "cannot_claim_own_job");
  const dom = await d.store.verifiedOwnerOf(j.domain);
  if (dom?.accountId === a.id) throw new HttpError(403, "cannot_claim_own_job");
  if (j.status !== "open") throw new HttpError(409, "job_not_open");
  const all = await m.store.jobsByPro(a.id, true);
  if (all.filter((x) => (x.status === "claimed" || x.status === "delivered")).length >= MAX_ACTIVE_CLAIMS) throw new HttpError(429, "too_many_active_claims");
  // fresh read: if the fault is already gone (the owner fixed it themselves) nobody is paid for it.
  const { finding } = await readCheck(m, d, j.domain, j.check);
  if (finding?.status === "PASS") { j = await need(m, id); if (j.status === "open") await refundAndClose(d, j, "refunded", "already fixed before any claim (fresh scan PASS)"); throw new HttpError(409, "already_fixed"); }
  j = await need(m, id);
  const now = d.now(), fee = feeFor(p, j);
  (j.observations ??= []).push({ at: now, status: finding?.status ?? "UNKNOWN", src: "claim" }); j.proEmailDomain = emailDomain(a.email);
  j.status = "claimed"; j.proAccountId = a.id; j.claimedAt = now; j.claimDeadline = now + CLAIM_WINDOW_MS; j.updatedAt = now; ev(j, now, "claimed", `claim fee ${fee} cents`);
  if (!(await m.store.transition(["open"], j))) throw new HttpError(409, "job_not_open");   // the loser of a race stops here, charged nothing
  try { const cf = await m.payments.chargeClaimFee(a.id, p.connectAccountId, fee, `claimfee_${j.id}`); j.claimFeeRef = cf.id; if ((cf as { fingerprint?: string }).fingerprint) j.proPayerFp = (cf as { fingerprint?: string }).fingerprint; await m.store.putJob(j); }
  catch { j.status = "open"; j.proAccountId = undefined; j.claimedAt = undefined; j.claimDeadline = undefined; ev(j, d.now(), "claim_failed", "claim fee not collected, job reopened"); await m.store.transition(["claimed"], j); throw new HttpError(402, "claim_fee_failed"); }
  return presentPro2(j);
}
export async function deliver(d: Deps, a: Account, id: string, note: unknown) {
  const m = mk(d); await requirePro(d, a); const j = await need(m, id);
  if (j.proAccountId !== a.id) throw new HttpError(404, "not_found");
  if (j.status !== "claimed") throw new HttpError(409, "job_not_claimed");
  const text = typeof note === "string" ? note.trim().slice(0, 2000) : "";
  if (text.length < 3) throw new HttpError(400, "delivery_note_required");
  j.status = "delivered"; j.deliveredAt = d.now(); j.deliveryNote = text; j.updatedAt = j.deliveredAt; ev(j, j.deliveredAt, "delivered", "pro says done; waiting for our re-scan, not their word");
  if (!(await m.store.transition(["claimed"], j))) throw new HttpError(409, "state_changed");
  return rescan(d, a, id, true);   // the proof attempt starts at once; a pass pays, a fail leaves it delivered
}

// ---------- THE proof: re-scan ----------
// Either party may ask for a re-scan (rate limited). The scan is ours. The only way status becomes `reproved`.
export async function rescan(d: Deps, a: Account | "system", id: string, first = false) {
  const m = mk(d); const j = await need(m, id);
  if (a !== "system" && a.id !== j.ownerAccountId && a.id !== j.proAccountId) throw new HttpError(404, "not_found");
  const reopen = j.status === "reproved" && !!j.payoutDenied && !j.payout;   // a denied payout card may be answered only by a NEW re-scan
  if (j.status !== "delivered" && !reopen) throw new HttpError(409, "nothing_to_reprove");
  const now = d.now();
  if (a !== "system" && !first && j.lastRescan && now - j.lastRescan.at < MIN_RESCAN_GAP_MS) throw new HttpError(429, "rescan_too_soon");
  const { id: scanId, finding } = await readCheck(m, d, j.domain, j.check);
  j.rescans++; j.lastRescan = { at: now, status: finding?.status ?? "UNKNOWN", detail: finding?.detail ?? "check not returned" };
  (j.observations ??= []).push({ at: now, status: j.lastRescan.status, src: "rescan" }); if (j.observations.length > 60) j.observations.splice(0, j.observations.length - 60);
  if (finding?.status === "PASS" && (j.baseline.status === "FAIL" || j.baseline.status === "WARN")) {
    // F-C4(a): the pass must follow the pro's recorded delivery. Owner-side evidence is read from the owner seat's own event log.
    const ownerEvents = (await d.owner?.store.get(j.domainId))?.events ?? [];
    const verdict = judgeAttribution(j, ownerEvents);
    if (!verdict.pay) {
      if (!j.attribution) ev(j, now, "attribution_withheld", `${verdict.reason}${verdict.evidenceSrc ? ` (${verdict.evidenceSrc})` : ""}: the fix was observed before the pro's delivery, so no pay and no rank`);
      j.attribution = { verdict: "withheld", reason: verdict.reason, evidenceAt: verdict.evidenceAt, evidenceSrc: verdict.evidenceSrc, at: j.attribution?.at ?? now };
      await m.store.putJob(j);
      return { job: presentPro2(j), reproved: false, payout: null as null };
    }
    const from = j.status as "delivered" | "reproved";
    j.status = "reproved"; j.updatedAt = now; j.proof = { scanId, at: now, baseline: j.baseline.status, now: "PASS", detail: finding.detail }; ev(j, now, "reproved", `re-scan ${scanId}: ${j.check} ${j.baseline.status} to PASS`);
    if (!(await m.store.transition([from], j))) throw new HttpError(409, "state_changed");
    const payout = await releasePayout(d, j.id);
    return { job: presentPro2((await need(m, j.id))), reproved: true, payout };
  }
  ev(j, now, "rescan_failed", `re-scan ${scanId}: ${j.check} is ${j.lastRescan.status}, not PASS`); await m.store.putJob(j);
  return { job: presentPro2(j), reproved: false, payout: null as null };
}

// ---------- payout: refuses without proof ----------
export async function releasePayout(d: Deps, id: string, approvedCardId?: string): Promise<{ status: string; amountCents: number }> {
  const m = mk(d); const j = await need(m, id);
  if (j.status !== "reproved" || !j.proof || j.proof.now !== "PASS" || !j.proAccountId) throw new HttpError(409, "payout_requires_reproof");   // THE rule
  const pro = await m.store.getPro(j.proAccountId);
  if (!pro?.connectAccountId || !pro.onboarded) throw new HttpError(409, "payout_onboarding_required");
  const amount = j.priceCents;
  if (amount >= PAYOUT_REVIEW_CENTS && !approvedCardId) {
    if (!j.payout && !mayRaisePayoutCard(j)) return { status: "denied", amountCents: amount };   // F-C4(d): denied on this proof; only a new re-scan reopens it
    if (!j.payout) {
      const card: MarketCard = { id: randomToken("mc", 8), kind: "payout_review", jobId: j.id, reason: `payout ${amount} cents to ${j.proAccountId}, over the ${PAYOUT_REVIEW_CENTS} cent review line, re-proof ${j.proof.scanId}`, createdAt: d.now(), resolved: false };
      await m.store.putCard(card); j.payout = { status: "pending_review", amountCents: amount, cardId: card.id }; ev(j, d.now(), "payout_review", "held for owner approval (GATE1)"); await m.store.putJob(j);
    }
    return { status: "pending_review", amountCents: amount };
  }
  const prior = structuredClone(j);
  j.status = "paid"; j.payout = { status: "paid", amountCents: amount, at: d.now() }; j.updatedAt = d.now();
  if (!(await m.store.transition(["reproved"], j))) throw new HttpError(409, "state_changed");   // a second caller cannot pay twice
  try { const t = await m.payments.transfer(pro.connectAccountId, amount, j.id, `payout_${j.id}`); j.payout.transferId = t.id; ev(j, d.now(), "paid", `transfer ${t.id}`); await m.store.putJob(j); }
  catch { await m.store.transition(["paid"], prior); const again = await need(m, id); ev(again, d.now(), "payout_failed", "transfer failed; job stays reproved, retry via sweep"); await m.store.putJob(again); return { status: "failed", amountCents: amount }; }
  return { status: "paid", amountCents: amount };
}

// ---------- dispute ----------
export async function dispute(d: Deps, a: Account, id: string, reason: unknown) {
  const m = mk(d); const j = await need(m, id);
  if (j.ownerAccountId !== a.id && j.proAccountId !== a.id) throw new HttpError(404, "not_found");
  if (j.status !== "claimed" && j.status !== "delivered") throw new HttpError(409, "cannot_dispute_in_this_state");
  const text = typeof reason === "string" ? reason.trim().slice(0, 1000) : "";
  if (text.length < 5) throw new HttpError(400, "reason_required");
  const card: MarketCard = { id: randomToken("mc", 8), kind: "dispute", jobId: j.id, reason: text, createdAt: d.now(), resolved: false };
  const prior = j.status as "claimed" | "delivered";
  j.disputeCase = openDispute({ jobId: j.id, amountCents: j.priceCents, at: d.now(), actor: a.id, eventId: `open_${j.id}_${d.now()}`, reason: text, proofAt: j.proof?.at });
  j.status = "disputed"; j.dispute = { at: d.now(), by: a.id, reason: text, priorStatus: prior, cardId: card.id }; j.updatedAt = d.now(); ev(j, d.now(), "disputed", "funds stay held; payout is frozen");
  if (!(await m.store.transition([prior], j))) throw new HttpError(409, "state_changed");
  await m.store.putCard(card);
  return presentOwner(j);
}
// f99: drive the case through the machine. Evidence is the dispute reason (the machine needs EVIDENCE before a resolution); an illegal edge throws and nothing is written.
function closeCase(d: Deps, j: Job, kind: "RESOLVE_REFUND" | "RESOLVE_PAID") {
  let c = j.disputeCase; if (!c) return;   // legacy job disputed before f99: no case, old behaviour
  const at = Math.max(d.now(), c.audit[c.audit.length - 1].at);
  if (c.state === "OPEN") { const r = applyDispute(c, { eventId: `ev_${j.id}`, kind: "SUBMIT_EVIDENCE", at, actor: "system", detail: j.dispute?.reason ?? "dispute reason" }); if (!r.ok) throw new HttpError(409, r.reason); c = r.case; }
  const r = applyDispute(c, { eventId: `res_${j.id}`, kind, at, actor: "kyle" }); if (!r.ok) throw new HttpError(409, r.reason); j.disputeCase = r.case;
}
function archiveCase(j: Job) { if (j.disputeCase) { (j.disputeArchive ??= []).push(j.disputeCase); j.disputeCase = undefined; } }   // resumed: the job is back in play, the audit is kept
// Internal (Kyle's tap, GATE1/GATE3). A resolution can refund the owner or put the job back in play. There is NO outcome that pays the pro:
// money to a pro only ever flows through releasePayout, which needs a re-scan PASS.
export async function resolveCard(d: Deps, cardId: string, outcome: string) {
  const m = mk(d); const c = await m.store.getCard(cardId);
  if (!c || c.resolved) throw new HttpError(404, "not_found");
  const j = await need(m, c.jobId);
  if (c.kind === "dispute") {
    if (j.status !== "disputed") throw new HttpError(409, "state_changed");
    if (outcome === "refund_owner") { closeCase(d, j, "RESOLVE_REFUND"); await refundAndClose(d, j, "refunded", "dispute resolved: owner refunded"); }
    else if (outcome === "resume") { archiveCase(j); j.status = j.dispute!.priorStatus; j.dispute!.resolvedAt = d.now(); j.dispute!.outcome = "resume"; await m.store.transition(["disputed"], j); }
    else throw new HttpError(400, "invalid_outcome");
  } else if (c.kind === "clawback_review") {
    // Ledger only: approving marks the entry as awaiting a transfer. The money movement itself is a separate GATE1 act, never made here.
    const cb = j.clawbacks?.find((x) => x.id === `cb_${j.id}`); if (!cb || cb.status !== "recorded") throw new HttpError(409, "state_changed");
    if (outcome === "approve") cb.status = "approved_awaiting_transfer"; else if (outcome === "deny") cb.status = "waived"; else throw new HttpError(400, "invalid_outcome");
    ev(j, d.now(), "clawback_" + cb.status, "ledger entry only, no money moved"); await m.store.putJob(j);
  } else {
    if (outcome === "approve") { if (j.payout?.cardId !== c.id) throw new HttpError(409, "state_changed"); await releasePayout(d, j.id, c.id); }
    else if (outcome === "deny") { j.payout = undefined; j.payoutDenied = { at: d.now(), cardId: c.id, proofKey: proofKey(j) }; ev(j, d.now(), "payout_denied", "payout denied at review; job stays reproved"); await m.store.putJob(j); }
    else throw new HttpError(400, "invalid_outcome");
  }
  c.resolved = true; c.outcome = outcome; await m.store.putCard(c);
  return { ok: true };
}

// ---------- scheduled (a Worker cron trigger, owner-approved deploy; NOT scheduled today) ----------
export async function sweep(d: Deps) {
  const m = mk(d); const now = d.now(); const r = { reopened: 0, cancelled: 0, retriedRefunds: 0, retriedPayouts: 0, watched: 0 };
  const due = (j: Job) => (j.status === "claimed" && !!j.claimDeadline) || (j.status === "awaiting_funds" && now - j.createdAt > FUNDING_WINDOW_MS)
    || (j.status === "open" && !!j.fundedAt && now - j.fundedAt > OPEN_WINDOW_MS) || ((j.status === "cancelled" || j.status === "refunded") && !!j.fundedAt && !!j.paymentIntent && !j.refundRef)
    || (j.status === "reproved" && !!j.proof && !j.payout);   // a claimed job is always due: inside its deadline it is watched (F-C4a), past it it is reopened
  // read-only view picks the jobs that need work; only those are fetched as private copies (a sweep over a big board must not clone every job)
  for (const v of await m.store.jobsByStatus(["claimed", "awaiting_funds", "open", "cancelled", "refunded", "reproved"], true)) {   // every status sweep acts on; paid/disputed never matched
    if (!due(v)) continue; const j = await m.store.getJob(v.id); if (!j) continue;
    if (j.status === "claimed" && j.claimDeadline && now <= j.claimDeadline) {
      // F-C4(a): watch a claimed job. A PASS seen here, before any delivery, is a fix the pro has not delivered (the owner or a third party made it).
      try { const { finding } = await readCheck(m, d, j.domain, j.check); (j.observations ??= []).push({ at: now, status: finding?.status ?? "UNKNOWN", src: "watch" }); if (j.observations.length > 60) j.observations.splice(0, j.observations.length - 60); await m.store.putJob(j); r.watched++; } catch { /* a failed read is not an observation */ }
    } else if (j.status === "claimed" && j.claimDeadline && now > j.claimDeadline) {
      j.abandonedBy.push(j.proAccountId!); ev(j, now, "claim_expired", `no delivery by ${new Date(j.claimDeadline).toISOString()}`);
      j.status = "open"; j.proAccountId = undefined; j.claimedAt = undefined; j.claimDeadline = undefined; j.updatedAt = now;
      if (await m.store.transition(["claimed"], j)) r.reopened++;
    } else if (j.status === "awaiting_funds" && now - j.createdAt > FUNDING_WINDOW_MS) { await refundAndClose(d, j, "cancelled", "never funded in 24 hours"); r.cancelled++; }
    else if (j.status === "open" && j.fundedAt && now - j.fundedAt > OPEN_WINDOW_MS) { await refundAndClose(d, j, "cancelled", "no pro claimed in 30 days"); r.cancelled++; }
    else if ((j.status === "cancelled" || j.status === "refunded") && j.fundedAt && j.paymentIntent && !j.refundRef) { try { j.refundRef = (await m.payments.refundHold(j.paymentIntent, j.priceCents, `refund_${j.id}`)).id; await m.store.putJob(j); r.retriedRefunds++; } catch { /* stays queued */ } }
    else if (j.status === "reproved" && j.proof && !j.payout) { const p = await releasePayout(d, j.id).catch(() => null); if (p?.status === "paid") r.retriedPayouts++; }
  }
  return r;
}
// F-C4(c): a regression after pay writes ONE ledger entry and raises ONE GATE1 card. No money moves in this file for a clawback.
async function recordClawback(m: MarketDeps, j: Job, now: number) {
  const cb = clawbackFor(j, now); if (!cb) return;
  // f99: the machine must agree (paid job enters RESOLVED_PAID at proof.at, REGRESSION inside the window); it keeps the hash-chained record. Disagreement writes nothing.
  const paidAt = Math.max(j.payout?.at ?? j.proof!.at, j.proof!.at);
  const imp = importPaid({ jobId: j.id, amountCents: cb.amountCents, proofAt: j.proof!.at, paidAt, actor: j.proAccountId!, eventId: `paid_${j.id}` });
  const reg = applyDispute(imp, { eventId: `reg_${j.id}`, kind: "REGRESSION", at: Math.max(now, paidAt, j.regressedAt!), actor: "warranty_sweep", regressedAt: j.regressedAt });
  if (!reg.ok) return;
  j.disputeCase = reg.case;
  (j.clawbacks ??= []).push(cb); ev(j, now, "clawback_recorded", `ledger entry ${cb.id} for ${cb.amountCents} cents; transfer needs a GATE1 tap`);
  await m.store.putJob(j);
  await m.store.putCard({ id: randomToken("mc", 8), kind: "clawback_review", jobId: j.id, reason: `warranty regression after pay: ${cb.reason}. Ledger entry ${cb.id}, ${cb.amountCents} cents. Approving marks it awaiting transfer; no money moves.`, createdAt: now, resolved: false });
}
// Warranty: for 30 days after a proof, a re-scan that shows the fault back marks the fix as regressed (rank loses it).
export async function warrantySweep(d: Deps) {
  const m = mk(d); const now = d.now(); const out = { checked: 0, regressed: 0, held: 0, clawbacks: 0 };
  for (const v of await m.store.jobsByStatus(["paid", "reproved"], true)) {
    const bf = v.regressedAt && v.status === "paid" && !v.clawbacks?.length;   // backfill: regressed before the ledger existed
    if (!bf && (!v.proof || v.regressedAt || v.warrantyOkAt)) continue; const j = await m.store.getJob(v.id); if (!j) continue;
    if (bf) { await recordClawback(m, j, now); out.clawbacks++; continue; }
    const { finding } = await readCheck(m, d, j.domain, j.check); out.checked++; j.warrantyChecks++;
    if (finding && (finding.status === "FAIL" || finding.status === "WARN")) { j.regressedAt = now; ev(j, now, "regressed", `${j.check} is ${finding.status} again ${Math.floor((now - j.proof.at) / DAY)} days after proof`); out.regressed++; if (j.status === "paid") { await recordClawback(m, j, now); out.clawbacks++; } }
    else if (now - j.proof.at >= WARRANTY_DAYS * DAY && finding?.status === "PASS") { j.warrantyOkAt = now; ev(j, now, "warranty_held", `held ${WARRANTY_DAYS} days`); out.held++; }
    await m.store.putJob(j);
  }
  return out;
}

// ---------- views ----------
function presentOwner(j: Job) {
  return { id: j.id, domain: j.domain, check: j.check, severity: j.severity, tier: j.tier, priceCents: j.priceCents, status: j.status, createdAt: j.createdAt, claimed: !!j.proAccountId, deliveredAt: j.deliveredAt ?? null, proof: j.proof ?? null, lastRescan: j.lastRescan ?? null, payout: j.payout ? { status: j.payout.status, amountCents: j.payout.amountCents } : null, dispute: j.dispute ? { reason: j.dispute.reason, outcome: j.dispute.outcome ?? null } : null, regressedAt: j.regressedAt ?? null, events: j.events.slice(-20) };
}
function presentPro2(j: Job) {
  return { id: j.id, domain: j.domain, check: j.check, severity: j.severity, tier: j.tier, payCents: j.priceCents, status: j.status, claimDeadline: j.claimDeadline ?? null, deliveredAt: j.deliveredAt ?? null, rescans: j.rescans, lastRescan: j.lastRescan ?? null, proof: j.proof ?? null, payout: j.payout ? { status: j.payout.status, amountCents: j.payout.amountCents } : null, regressedAt: j.regressedAt ?? null, events: j.events.slice(-20) };
}
export async function myJobs(d: Deps, a: Account) {
  const m = mk(d);
  return { asOwner: (await m.store.jobsByOwner(a.id, true)).map(presentOwner), asPro: (await m.store.jobsByPro(a.id, true)).map(presentPro2) };
}
export async function payouts(d: Deps, a: Account) {
  const m = mk(d); await requirePro(d, a); const mine = await m.store.jobsByPro(a.id, true);
  const sum = (f: (j: Job) => boolean) => mine.filter(f).reduce((s, j) => s + j.priceCents, 0);
  return {
    paidCents: sum((j) => j.status === "paid"), pendingReviewCents: sum((j) => j.status === "reproved" && j.payout?.status === "pending_review"),
    waitingForProofCents: sum((j) => j.status === "claimed" || j.status === "delivered"), frozenByDisputeCents: sum((j) => j.status === "disputed"),
    paid: mine.filter((j) => j.status === "paid").map((j) => ({ jobId: j.id, domain: j.domain, amountCents: j.priceCents, transferId: j.payout?.transferId ?? null, at: j.payout?.at ?? null })),
    rule: "A payout is released only after our re-scan shows the fault gone.",
  };
}
export async function myRank(d: Deps, a: Account) { const m = mk(d); const p = await requirePro(d, a); return { display: p.display, ...rankFor(a.id, await m.store.jobsTouchingPro(a.id, true)) }; }
export async function leaderboard(d: Deps) {
  const m = mk(d); const rows = [];
  for (const p of await m.store.allPros()) { const r = rankFor(p.accountId, await m.store.jobsTouchingPro(p.accountId, true)); if (r.provenFixes > 0) rows.push({ accountId: p.accountId, display: p.display, points: r.points, tier: r.tier, provenFixes: r.provenFixes, holdRate: r.holdRate }); }
  rows.sort(boardOrder); return { rows: rows.slice(0, 50).map(({ accountId: _a, ...pub }) => pub), basis: "Proven fixes only: a re-scan showed the fault gone. No reviews, no ratings." };
}
export async function marketExport(d: Deps, a: Account) {
  if (!d.market) return {};
  const st = d.market.store;
  return { marketJobsAsOwner: (await st.jobsByOwner(a.id, true)).map(presentOwner), marketJobsAsPro: (await st.jobsByPro(a.id, true)).map(presentPro2), proProfile: (await d.market.store.getPro(a.id)) ?? null };
}
export async function hasActiveMarketJobs(d: Deps, a: Account): Promise<boolean> {
  if (!d.market) return false;
  const st = d.market.store, active = ["open", "claimed", "delivered", "disputed", "awaiting_funds"];
  return (await st.jobsByOwner(a.id, true)).some((j) => active.includes(j.status)) || (await st.jobsByPro(a.id, true)).some((j) => active.includes(j.status) || j.status === "reproved");
}
