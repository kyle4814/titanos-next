#!/usr/bin/env python3
"""obelisk_killflip_runbook.py - turn the WOULD-FLIP rows of the obelisk kill matrix into ONE batched gate card (f401).

Reads the JSON that `scripts/obelisk_kill_matrix.py --out-json` writes ({head, counts, chunks:[{id, status, gate, ...}]})
and, for every chunk whose status is WOULD-FLIP, emits in KILLFLIP_RUNBOOK.md:
  the exact gate (which of GATE1..GATE5), the exact command or card text Kyle or the commander would run,
  the evidence that would flip the chunk, and what is ALREADY independently verified in code (copied from the matrix).

NOTHING IS EXECUTED. This file imports no process-spawning module; every command is printed inside a fenced block as
text. The runbook is a document, not an action (CORE GATE8: the search dial is open, the action dial goes via the card).

Refusals (fail closed, nothing written):
  exit 1  a chunk in the matrix has status FAILED (a red board never gets a flip card)
  exit 2  structural: unreadable JSON, chunk C1..C10 missing or duplicated, a WOULD-FLIP chunk this script has no gate
          entry for (a new gate must be added here deliberately), the matrix gate text no longer matches the gate entry,
          or no WOULD-FLIP chunk at all
Everything shown is SYNTHETIC / MODELLED: a plan for the gate, never a result.

usage: python3 scripts/obelisk_killflip_runbook.py --matrix board.json [--out KILLFLIP_RUNBOOK.md] [--stdout]
"""
import argparse
import json
import sys

EXPECTED = [f"C{i}" for i in range(1, 11)]
GATE_NAMES = {
    "GATE1": "money / spend",
    "GATE2": "credentials",
    "GATE3": "legal commitment",
    "GATE4": "outbound to a third party / acting as Kyle",
    "GATE5": "irreversible",
}
DEPLOY_CMD = "DEPLOY_APPROVAL_REF=<approved card ref> ./scripts/deploy.sh"

# Per chunk: the gates, the card, the commands (printed, never run), the flip evidence.
# `match` must appear in the matrix gate text for that chunk (so a changed gate in the matrix is noticed, exit 2).
GATES = {
    "C1": {
        "match": "LIVE TRAFFIC",
        "gates": ["GATE5"],
        "gates_if": {"GATE4": "only if Kyle or the commander drives the first 1,000 scans through outreach or a post (a third party sees it)"},
        "what": "Deploy the guest scan and the GET THIS FIXED button to titanos.tech, then let the first 1,000 real scans arrive.",
        "why": "The kill test is behavioural: at least 3% of the first 1,000 scans press the button. No code run can supply real visitors.",
        "cost": "AU$0 (static export, existing host). Time: however long 1,000 real scans take.",
        "reversible": "The deploy force-pushes the public site (irreversible as an act); the previous build can be redeployed. The counter data stays.",
        "commands": [
            ("1. Kyle approves the deploy card, then the deploy runs (deploy.sh refuses without an approved ref, a clean main and HEAD == origin/main):", DEPLOY_CMD),
            ("2. When the live counter reaches 1,000 scans, export the events and tally (no network, no model calls):", "node scripts/funnel_killtest.mjs events.ndjson"),
        ],
        "flip": "funnel_killtest.mjs prints a verdict other than PENDING_LIVE on the first 1,000 scans with presses * 100 >= 3 * 1000. Needs the beacon to send scanId (the code header says so); until then press events cannot be tied to scans.",
    },
    "C4": {
        "match": "GATE2",
        "gates": ["GATE2", "GATE1", "GATE3"],
        "gates_if": {},
        "what": "Create live Stripe Connect for pros (platform account, Connect onboarding, payout transfers) and run the first 10 real jobs.",
        "why": "The kill test is 100% of the first 10 jobs paid only after re-proof. Code proves the rule against MockPayments; only real jobs prove the rails.",
        "cost": "Stripe fees per payout and per Connect account (confirm the live rate card before approving). Platform float for payouts is a GATE1 amount.",
        "reversible": "Accepting Stripe's Connect terms is a legal commitment (GATE3); a paid transfer cannot be recalled by us. Test mode first is fully reversible.",
        "commands": [
            ("CARD NEEDED (Stripe, GATE2, never created by this script): ", "CARD NEEDED: create Stripe Connect platform (test mode first), restricted API key scoped to Connect transfers and account links, webhook endpoint for transfer.* events; route the key to ~/.titanos_env only."),
            ("Local drill the live run must match (synthetic, in-memory, already green):", "node scripts/drill_ten_jobs.mjs"),
        ],
        "flip": "Ten real jobs in the ledger, each payout transfer id present only for a job with a recorded re-proof, zero transfers for unproven jobs; drill_ten_jobs.mjs shape (PAY10 OK) reproduced from the real ledger.",
    },
    "C5": {
        "match": "DEPLOY",
        "gates": ["GATE5"],
        "gates_if": {},
        "what": "Deploy so 1,000 graded shelves are live, then count ungraded shelves on the live catalogue.",
        "why": "The kill test is 1,000 shelves live with 0 ungraded. The grader and the scale drill run locally; 'live' needs the site deployed.",
        "cost": "AU$0.",
        "reversible": "Same as C1: the deploy is a public force-push; the prior build can be redeployed. Batch with the C1 deploy so one card covers both.",
        "commands": [
            ("1. Deploy (the same single approval as C1):", DEPLOY_CMD),
            ("2. Re-run the local scale check against the build that shipped:", "node --experimental-strip-types --no-warnings scripts/c5_ungraded_verify.mjs 1000"),
        ],
        "flip": "1,000 shelves reachable on the live site and the ungraded count is 0, read from the live catalogue (not the local build).",
    },
    "C7": {
        "match": "LIVE TRAFFIC",
        "gates": ["GATE5", "GATE2", "GATE4"],
        "gates_if": {},
        "what": "Deploy the agent door (Worker plus D1), issue 10 test-mode keys, and have 10 EXTERNAL agents each call a tool and get a receipt.",
        "why": "The kill test is 10 external agents calling a tool and receiving a receipt. The 10 synthetic clients prove the path in-process; external is the point.",
        "cost": "AU$0 in test mode (no live billing). Any live credit charge is a separate GATE1 card.",
        "reversible": "Deploy as C1. Test-mode keys can be revoked. Inviting third parties to call the door is GATE4 (acting as Kyle, third parties see it).",
        "commands": [
            ("CARD NEEDED (keys, GATE2, never created by this script): ", "CARD NEEDED: mint 10 test-mode agent keys (scoped, metered, revocable) for the deployed door; route to ~/.titanos_env only."),
            ("Deploy the Worker and D1 (after the deploy card is approved):", DEPLOY_CMD),
            ("Live scorecard, refused unless AGENTS10_LIVE_OK=1 so no stray BASE_URL generates traffic:", "AGENTS10_LIVE_OK=1 BASE_URL=https://api.titanos.tech SITE_URL=https://titanos.tech AGENT_KEYS=<10 test keys> node --experimental-strip-types portal-api/scripts/agents10.ts"),
        ],
        "flip": "A scorecard of 10 distinct external client identities, each with a verified receipt signature and an idempotent replay (same receipt, no second charge), from calls the commander did not make itself.",
    },
    "C10": {
        "match": "LIVE TRAFFIC",
        "gates": ["GATE5"],
        "gates_if": {},
        "what": "Start the pinned 24 h chaos and load soak on the whole portal. A green board flips the VAL8 gate, which releases all outbound.",
        "why": "The kill test is a green board for 24 h, then the gate flips. The soak runner is localhost-only and tested; the 24 h run is the later GO.",
        "cost": "AU$0 cash. Compute: one machine for 24 h; run on the build whose SHA is recorded as the matrix head.",
        "reversible": "The soak itself is reversible (stop it). The VAL8 flip it can trigger is irreversible in effect (outbound opens), so it is the gated step.",
        "commands": [
            ("1. Confirm the build under soak is the matrix head, then start the soak (localhost targets only, the runner refuses anything else):", "node scripts/soak_harness.mjs --duration 86400 --interval 60 --rps 50 --out state/soak/board.json"),
            ("2. Judge the board and the drift guard (read-only):", "bash scripts/test_soak_drift_guard.sh"),
        ],
        "flip": "The S-board JSON shows every row green for the full 24 h window on the pinned SHA, with the drift guard clean; the VAL8 flip is then Kyle's card, not the script's.",
    },
}


class Refuse(Exception):
    def __init__(self, code, msg):
        super().__init__(msg)
        self.code = code


def clean(text):
    """Strip dashes the house style bans (em, en) and collapse whitespace; the runbook carries none."""
    s = str(text if text is not None else "")
    s = s.replace("—", ", ").replace("–", "-").replace("−", "-")
    return " ".join(s.split())


def load_chunks(raw):
    chunks = raw.get("chunks") if isinstance(raw, dict) else raw
    if not isinstance(chunks, list) or not chunks:
        raise Refuse(2, "matrix has no chunks list (expected obelisk_kill_matrix.py --out-json output)")
    ids = [c.get("id") for c in chunks if isinstance(c, dict)]
    if len(ids) != len(chunks):
        raise Refuse(2, "matrix chunk entry is not an object")
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        raise Refuse(2, f"duplicate chunk rows in matrix: {dup}")
    missing = [i for i in EXPECTED if i not in ids]
    if missing:
        raise Refuse(2, f"matrix is missing chunk(s) {missing} (the board needs exactly C1..C10)")
    extra = [i for i in ids if i not in EXPECTED]
    if extra:
        raise Refuse(2, f"unexpected chunk rows: {extra}")
    return sorted(chunks, key=lambda c: int(c["id"][1:]))


def check_refusals(chunks):
    failed = [c["id"] for c in chunks if c.get("status") == "FAILED"]
    if failed:
        raise Refuse(1, f"matrix has FAILED chunk(s) {failed}: no flip card for a red board (fix the code proof first)")
    flips = [c for c in chunks if c.get("status") == "WOULD-FLIP"]
    if not flips:
        raise Refuse(2, "matrix has no WOULD-FLIP chunk: nothing to put on a card")
    for c in flips:
        g = GATES.get(c["id"])
        if not g:
            raise Refuse(2, f"{c['id']} is WOULD-FLIP but this script has no gate entry for it (add one deliberately)")
        if g["match"] not in (c.get("gate") or ""):
            raise Refuse(2, f"{c['id']}: matrix gate text {c.get('gate')!r} no longer contains {g['match']!r}; review the gate entry")
    return flips


def verified_lines(c):
    out = [f"matrix status {c.get('status')}"]
    r = c.get("result")
    if r:
        out.append(f"primary proof exit {r.get('exit')} in {r.get('seconds')}s: {clean(r.get('tail'))}")
    v = c.get("verifier_result")
    if v:
        out.append(f"independent verifier exit {v.get('exit')} in {v.get('seconds')}s")
    if c.get("verification"):
        out.append("code INDEPENDENTLY VERIFIED (the live kill test is a separate matter)")
    else:
        out.append("no independent verifier recorded in the matrix for this chunk")
    return out


def render(flips, board_head):
    L = []
    w = L.append
    w("# Obelisk kill-flip runbook")
    w("")
    w("SYNTHETIC / MODELLED. This document was generated from the kill matrix JSON. Nothing in it was executed, nothing is outbound, "
      "no Stripe object exists, no deploy happened. Every command below is text for a human or the commander to run after approval.")
    w("")
    w(f"Matrix head: `{clean(board_head or 'UNKNOWN')}`. WOULD-FLIP chunks on this card: {', '.join(c['id'] for c in flips)}.")
    w("")
    w("## The one batched card (CORE EXEC9)")
    w("")
    w("| Chunk | Gate(s) | What | Approve |")
    w("|---|---|---|---|")
    for c in flips:
        g = GATES[c["id"]]
        w(f"| {c['id']} | {', '.join(g['gates'])} | {clean(g['what'])} | approve / deny |")
    w("")
    w("Shared steps: C1, C5 and C7 all start from the same deploy. One deploy approval covers them; keep it as one line on the card.")
    w("")
    for c in flips:
        g = GATES[c["id"]]
        w(f"## {c['id']}: {clean(c.get('chunk'))}")
        w("")
        w(f"- Kill test (plan): {clean(c.get('kill'))}")
        w(f"- Matrix gate: {clean(c.get('gate'))}")
        w("- Gate: " + "; ".join(f"{x} ({GATE_NAMES[x]})" for x in g["gates"]))
        for k, why in g["gates_if"].items():
            w(f"- Conditional: {k} ({GATE_NAMES[k]}) {clean(why)}")
        w("")
        w("Card text:")
        w("")
        w(f"- WHAT: {clean(g['what'])}")
        w(f"- WHY: {clean(g['why'])}")
        w(f"- COST: {clean(g['cost'])}")
        w(f"- REVERSIBLE: {clean(g['reversible'])}")
        w("")
        w("Commands (printed, never run by this script):")
        w("")
        for label, cmd in g["commands"]:
            w(clean(label))
            w("")
            w("```")
            w(cmd)
            w("```")
            w("")
        w(f"Evidence that flips it: {clean(g['flip'])}")
        w("")
        w("Already independently verified in code (from the matrix, fresh exit codes):")
        w("")
        for line in verified_lines(c):
            w(f"- {line}")
        if c.get("command"):
            w("")
            w("Code proof command:")
            w("")
            w("```")
            w(str(c["command"]))
            w("```")
        if c.get("verifier"):
            w("")
            w("Independent verifier command:")
            w("")
            w("```")
            w(str(c["verifier"]))
            w("```")
        w("")
    return "\n".join(L).rstrip() + "\n"


def build(raw):
    chunks = load_chunks(raw)
    flips = check_refusals(chunks)
    head = raw.get("head") if isinstance(raw, dict) else None
    return render(flips, head), [c["id"] for c in flips]


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--matrix", required=True, help="JSON from obelisk_kill_matrix.py --out-json")
    ap.add_argument("--out", default="KILLFLIP_RUNBOOK.md")
    ap.add_argument("--stdout", action="store_true", help="print instead of writing a file")
    a = ap.parse_args(argv)
    try:
        with open(a.matrix) as f:
            raw = json.load(f)
        md, ids = build(raw)
    except Refuse as e:
        print(f"KILLFLIP REFUSED {e}", file=sys.stderr)
        return e.code
    except (OSError, ValueError) as e:
        print(f"KILLFLIP REFUSED unreadable matrix: {e}", file=sys.stderr)
        return 2
    if a.stdout:
        sys.stdout.write(md)
    else:
        with open(a.out, "w") as f:
            f.write(md)
    print(f"KILLFLIP OK {len(ids)} WOULD-FLIP chunks: {','.join(ids)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
