# TITANOS Work Queue

Persistent queue for autonomous Claude Code operation. Keep entries small enough to verify, but large enough to produce a meaningful brick.

## Queue protocol

Priority = **impact × dependency-unlock × reuse × evidence quality ÷ risk × effort**.

For each item record:

- **ID** — stable short identifier
- **STATE** — READY / ACTIVE / BLOCKED / VERIFY / DONE
- **DOMAIN** — code / product / growth / security / opportunity / investor / ops
- **OUTCOME** — what changes in the real system
- **FILES** — expected touch points
- **VERIFY** — cheapest sufficient proof
- **HUMAN GATE** — only when genuinely required

## Active frontier

### OP-001 — Opportunity intelligence control plane
- STATE: READY
- DOMAIN: opportunity
- OUTCOME: track grants, programs, partnerships and other externally sourced opportunities with evidence, eligibility, deadline and next-action fields.
- FILES: docs/opportunities/*
- VERIFY: schema is internally consistent and every opportunity has a source + verification date.
- HUMAN GATE: submission/acceptance decisions remain human-owned.

### INV-001 — Angel/investor data room spine
- STATE: READY
- DOMAIN: investor
- OUTCOME: one canonical index for company facts, traction evidence, product/system proof, use of funds, capital plan and investor questions.
- FILES: docs/investors/*
- VERIFY: no invented metrics; every factual claim points to an evidence source or is marked TODO.
- HUMAN GATE: valuation, securities terms, investor selection and commitments.

### OPS-001 — Autonomous next command
- STATE: READY
- DOMAIN: ops
- OUTCOME: Claude Code can invoke one command that loads the control plane, selects the next unblocked frontier item, executes it, verifies it, persists it, and re-inspects before continuing.
- FILES: .claude/commands/next.md, docs/ops/AUTONOMOUS_EXECUTION.md
- VERIFY: command prompt contains explicit inspect → frontier → forge → verify → persist → re-inspect loop and stop conditions.
- HUMAN GATE: only the gates defined by the control plane.

### PERF-001 — Fast verification path
- STATE: READY
- DOMAIN: ops
- OUTCOME: add a cheap preflight that catches TypeScript/config/static-policy failures before an expensive production build.
- FILES: package.json, scripts/*
- VERIFY: fast path fails deterministically on a deliberate type/config violation in a temporary worktree.
- HUMAN GATE: none.

## Queue hygiene

When an item reaches DONE, append a one-line receipt with commit SHA and verification result, then add the next highest-value unblocked item. Do not delete history; completed work is part of the system's memory.
