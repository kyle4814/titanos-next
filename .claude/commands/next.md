# TITANOS NEXT

Run the TitanOS autonomous work loop for the next useful brick.

1. Read CLAUDE.md, AGENTS.md, docs/ops/AUTONOMOUS_EXECUTION.md, and docs/ops/WORK_QUEUE.md.
2. Inspect git status/diff and the current repository state before changing anything.
3. Select the highest-value READY item whose dependencies are satisfied. Do not ask the operator to choose unless there is a genuine HUMAN_DECISION gate.
4. Search/reuse existing code and docs before creating new architecture.
5. Execute the item in bounded chunks. Parallelise only disjoint work; reconcile before verification.
6. DEMON: attack assumptions, security/privacy, stale claims, regressions, dead paths, and accidental scope expansion.
7. VERIFY the combined result with the cheapest sufficient checks, then broader checks when warranted.
8. Persist a coherent brick and update the queue with a factual receipt.
9. Re-inspect the post-write state and continue to the next unblocked item in the same invocation when safe.
10. Stop only on HUMAN_DECISION, AUTHORITY, SECURITY, RESOURCE, UNRECOVERABLE, or EMPTY_QUEUE.

When a human gate is reached, output only a compact handoff: **WHAT / WHY / EXACT ACTION NEEDED / EVIDENCE**.

Never invent metrics, eligibility, funding, customer traction, investor interest, deployment state, or verification results. Distinguish local, committed, remote, public, and verified state.
