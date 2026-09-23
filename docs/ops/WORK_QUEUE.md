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
- STATE: DONE
- DOMAIN: opportunity
- OUTCOME: track grants, programs, partnerships and other externally sourced opportunities with evidence, eligibility, deadline and next-action fields.
- FILES: docs/opportunities/*
- VERIFY: committed on branch; schema includes source, eligibility, deadline, evidence and verification state.
- HUMAN GATE: submission/acceptance decisions remain human-owned.
- RECEIPT: opportunity pipeline created; no external eligibility claim promoted beyond VERIFY.

### INV-001 — Angel/investor data room spine
- STATE: DONE
- DOMAIN: investor
- OUTCOME: one canonical index for company facts, traction evidence, product/system proof, use of funds, capital plan and investor questions.
- FILES: docs/investors/*
- VERIFY: committed on branch; unknown financial/traction fields remain explicit TODOs.
- HUMAN GATE: valuation, securities terms, investor selection and commitments.
- RECEIPT: investor data-room spine created without inventing metrics.

### OPS-001 — Autonomous next command
- STATE: DONE
- DOMAIN: ops
- OUTCOME: Claude Code can invoke one command that loads the control plane, selects the next unblocked frontier item, executes it, verifies it, persists it, and re-inspects before continuing.
- FILES: .claude/commands/next.md, docs/ops/AUTONOMOUS_EXECUTION.md, CLAUDE.md
- VERIFY: committed on branch; command contract contains inspect → frontier → forge → verify → persist → re-inspect and explicit stop conditions.
- HUMAN GATE: only the gates defined by the control plane.
- RECEIPT: next command wired into repo instructions.

### PERF-001 — Fast verification path
- STATE: VERIFY
- DOMAIN: ops
- OUTCOME: add a cheap preflight that catches TypeScript/config/static-policy failures before an expensive production build.
- FILES: package.json
- VERIFY: scripts now expose typecheck, verify:fast and verify:build; runtime execution still needs to be run in Claude Code/local environment.
- HUMAN GATE: none.

### OP-002 — Primary-source opportunity verification
- STATE: READY
- DOMAIN: opportunity
- OUTCOME: re-check each live opportunity against its canonical source before it becomes submission-ready.
- FILES: docs/opportunities/*
- VERIFY: source URL, current eligibility, amount, deadline and application requirements recorded with a verification date.
- HUMAN GATE: final submission.

### INV-002 — Evidence-backed investor pack
- STATE: READY
- DOMAIN: investor
- OUTCOME: populate the data room from actual books, product evidence and live system receipts, then produce a concise investor narrative without unsupported claims.
- FILES: docs/investors/*
- VERIFY: every metric has a source and period; unknowns remain marked.
- HUMAN GATE: financing terms and external distribution.

### TRUTH-001 — Truth Portal foundation
- STATE: READY
- DOMAIN: product
- OUTCOME: build the first portal where pasted claims can be decomposed, evidence-linked and returned as VERIFIED / SUPPORTED / CONTRADICTED / UNKNOWN / UNVERIFIABLE / CONTEXT-DEPENDENT without collapsing model output into reality.
- FILES: docs/product/TRUTH_PORTAL_SPEC.md, docs/product/CLAIM_EVIDENCE_MODEL.md, app/truth/*
- VERIFY: claim/evidence schema tests; MVP UI renders atomic claims, evidence and unresolved questions.
- HUMAN GATE: none for prototype; privacy, legal and high-impact deployment gates remain explicit.

### INVEST-003 — Truth Portal investment case
- STATE: READY
- DOMAIN: investor
- OUTCOME: validate target users, high-value verification jobs, alternatives, willingness to pay, technical feasibility, privacy/security requirements and unit economics before making investor-facing claims.
- FILES: docs/investors/INVESTMENT_AGENDA.md, docs/investors/*
- VERIFY: each claim has source/date/evidence state; hypotheses are separated from facts.
- HUMAN GATE: financing terms, investor outreach and representations.

## Queue hygiene

When an item reaches DONE, append a one-line receipt with commit SHA and verification result, then add the next highest-value unblocked item. Do not delete history; completed work is part of the system's memory.
