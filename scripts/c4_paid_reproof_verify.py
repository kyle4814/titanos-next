#!/usr/bin/env python3
"""C4 independent verifier (f399). Recomputes "100 percent paid, and only after re-proof" from the RAW marketplace ledger
(portal-api/scripts/c4_ledger_dump.ts: jobs, the payments call log, review cards) with a separate implementation. It reads
only the ledger: no oracle, no scenario knowledge, no code or test shared with drill_ten_jobs.mjs, drill_ten_jobs.test.ts
or payout_release.test.ts. All data is SYNTHETIC; the payments log is a Stripe stand-in (no request is ever made).

  python3 scripts/c4_paid_reproof_verify.py                 live: dump the ledger via node, verify it
  python3 scripts/c4_paid_reproof_verify.py --ledger L.jsonl  fixture mode: verify a saved ledger
  python3 scripts/c4_paid_reproof_verify.py --portal-api DIR   live against another copy of portal-api (mutation tests)
Rules, each recomputed per job from the ledger:
  P1 every transfer call names exactly one job, and each job has at most one transfer
  P2 a transferred job is paid, proof.now == PASS, proof.baseline != PASS (a real fault was re-proved), proof.at >= claimedAt,
     payout paid with transferId, payout amount == transfer cents == job price, events show reproved before paid
  P3 paid status without a matching transfer, or a transfer without paid status, is a failure
  P4 every job with a passing proof is paid (100 percent of re-proved jobs paid) and every paid job has a passing proof
  P5 a payout at or over the review line needs a raised then approved payout_review card, raised before the payout
  P7 a passing proof must be backed by the job's own last re-scan: lastRescan.status == PASS at the proof time
  P6 one claim fee per claimed job; no job without a claim has a transfer
Exit 0 = ledger holds (prints the recomputed rates), 1 = a rule broke, 2 = unusable input. The live kill test (real first 10
jobs, live Stripe Connect payouts) stays WOULD-FLIP: GATE2."""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(text):
    meta, jobs, calls, cards = None, {}, [], {}
    for n, raw in enumerate(text.splitlines(), 1):
        raw = raw.strip()
        if not raw or not raw.startswith("{"):
            continue
        try:
            o = json.loads(raw)
        except ValueError:
            raise ValueError(f"line {n}: not JSON")
        t = o.get("t")
        if t == "meta":
            meta = o
        elif t == "job":
            jobs[o["id"]] = o
        elif t == "call":
            calls.append(o)
        elif t == "card":
            cards[o["id"]] = o
    if meta is None or not jobs:
        raise ValueError("ledger has no meta line or no jobs")
    return meta, jobs, calls, cards


def verify(meta, jobs, calls, cards):
    f = []
    line = meta.get("review_line_cents", 50000)
    transfers = {}
    for c in calls:
        if c["op"] == "transfer":
            transfers.setdefault(c["args"].get("group"), []).append(c)
    for g, cs in transfers.items():
        if g not in jobs:
            f.append(f"P1 transfer for unknown job {g}")
        if len(cs) > 1:
            f.append(f"P1 job {g} has {len(cs)} transfers")
    kinds = lambda j: [e["kind"] for e in j.get("events", [])]
    for jid, j in jobs.items():
        pr, po, k = j.get("proof"), j.get("payout"), kinds(j)
        proven = bool(pr) and pr.get("now") == "PASS"
        paid = j.get("status") == "paid"
        has_t = jid in transfers
        if has_t and not paid:
            f.append(f"P3 job {jid} has a transfer but status {j.get('status')}")
        if paid and not has_t:
            f.append(f"P3 job {jid} is paid with no transfer")
        if has_t:
            if not proven:
                f.append(f"P2 job {jid} was transferred with no passing proof")
            else:
                if pr.get("baseline") == "PASS":
                    f.append(f"P2 job {jid} proof baseline was already PASS (nothing was re-proved)")
                lr = j.get("lastRescan") or {}
                if lr.get("status") != "PASS" or lr.get("at") != pr.get("at"):
                    f.append(f"P7 job {jid} proof is not backed by a passing re-scan (lastRescan {lr.get('status')} at {lr.get('at')} vs proof at {pr.get('at')})")
                if j.get("claimedAt") is None or pr.get("at", 0) < j["claimedAt"]:
                    f.append(f"P2 job {jid} proof predates the claim")
            t = transfers[jid][0]
            if not po or po.get("status") != "paid" or not po.get("transferId"):
                f.append(f"P2 job {jid} transferred but payout not recorded paid with a transfer id")
            else:
                if not (po.get("amountCents") == t["args"].get("cents") == j.get("priceCents")):
                    f.append(f"P2 job {jid} amounts differ: payout {po.get('amountCents')} transfer {t['args'].get('cents')} price {j.get('priceCents')}")
                if pr and po.get("at", 0) < pr.get("at", 0):
                    f.append(f"P2 job {jid} payout time precedes proof time")
            if "reproved" not in k or "paid" not in k or k.index("reproved") > k.index("paid"):
                f.append(f"P2 job {jid} events do not show reproved before paid")
            if j.get("priceCents", 0) >= line:
                cs = [c for c in cards.values() if c.get("jobId") == jid and c.get("kind") == "payout_review"]
                ok = any(c.get("resolved") and c.get("outcome") == "approve" for c in cs)
                if not ok:
                    f.append(f"P5 job {jid} paid {j.get('priceCents')} (>= {line}) with no approved payout_review card")
                elif "payout_review" not in k or k.index("payout_review") > k.index("paid"):
                    f.append(f"P5 job {jid} review card not raised before the payout")
        if proven and not paid:
            f.append(f"P4 job {jid} has a passing proof but is {j.get('status')}, not paid")
        if paid and not proven:
            f.append(f"P4 job {jid} is paid with no passing proof")
        if not j.get("claimedAt") and has_t:
            f.append(f"P6 job {jid} transferred without ever being claimed")
    fees = {}
    for c in calls:
        if c["op"] == "claim_fee":
            fees[c["args"].get("pro")] = fees.get(c["args"].get("pro"), 0) + 1
    claimed = [j for j in jobs.values() if j.get("claimedAt")]
    n_fee = sum(1 for c in calls if c["op"] == "claim_fee")
    if n_fee != len(claimed):
        f.append(f"P6 claim fees {n_fee} != claimed jobs {len(claimed)}")
    proven = [j for j in jobs.values() if j.get("proof") and j["proof"].get("now") == "PASS"]
    paid = [j for j in jobs.values() if j.get("status") == "paid"]
    stats = dict(jobs=len(jobs), proven=len(proven), paid=len(paid), transfers=sum(len(v) for v in transfers.values()),
                 paid_with_proof=sum(1 for j in paid if j in proven))
    return f, stats


def main(argv):
    args = list(argv)
    try:
        if "--ledger" in args:
            i = args.index("--ledger")
            text = open(args[i + 1], encoding="utf8").read()
        else:
            api = args[args.index("--portal-api") + 1] if "--portal-api" in args else os.path.join(ROOT, "portal-api")
            r = subprocess.run(["node", "--experimental-strip-types", "scripts/c4_ledger_dump.ts"], cwd=api,
                               capture_output=True, text=True, timeout=300)
            if r.returncode != 0:
                print(f"C4VERIFY unusable: ledger dump exit {r.returncode}: {r.stderr.strip()[-200:]}", file=sys.stderr)
                return 2
            text = r.stdout
        meta, jobs, calls, cards = load(text)
    except (OSError, IndexError, ValueError, KeyError, subprocess.SubprocessError) as e:
        print(f"C4VERIFY unusable: {e}", file=sys.stderr)
        return 2
    fails, s = verify(meta, jobs, calls, cards)
    if fails:
        for x in fails:
            print("BROKEN " + x)
        print(f"C4VERIFY FAILED {len(fails)} rule break(s)")
        return 1
    rate = 100 * s["paid_with_proof"] // max(s["paid"], 1) if s["paid"] else 0
    print(f"C4VERIFY OK jobs={s['jobs']} re-proved={s['proven']} paid={s['paid']} transfers={s['transfers']} "
          f"paid-with-proof={s['paid_with_proof']}/{s['paid']} ({rate}%), re-proved paid {s['proven']}/{s['proven']}; "
          f"unproven jobs {s['jobs'] - s['proven']} got no transfer (synthetic, mock Stripe; live kill test stays WOULD-FLIP: GATE2)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
