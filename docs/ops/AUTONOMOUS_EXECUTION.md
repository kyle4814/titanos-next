# TITANOS Autonomous Execution

> Internal control plane for Claude Code. The "Demon" is a red-team/execution metaphor, not an authority to bypass real permissions.

## Objective

Maximise useful verified progress per work chunk while keeping human judgement at the boundary where consequences become external, irreversible, ambiguous, or credentialed.

## Default loop

1. **INSPECT** — read current state, git diff/status, queue, tests, deployment state.
2. **CLASSIFY** — separate observed facts from assumptions; classify work as code, content, research, external action, or human decision.
3. **FRONTIER** — choose the smallest high-leverage task that unlocks the most downstream work.
4. **FORGE** — implement in bounded sequential chunks; reuse existing architecture before adding abstractions.
5. **DEMON** — attack the proposed change: stale assumptions, broken paths, security/privacy, regressions, fake claims, dead code, and hidden coupling.
6. **VERIFY** — run the cheapest sufficient checks first, then broader checks when warranted. Verify the combined result, not just individual edits.
7. **BRICK** — convert the verified result into a reusable artifact: code, test, decision record, template, or runbook.
8. **PERSIST** — commit the coherent brick with a factual message and update the queue/receipt.
9. **RE-INSPECT** — read the new state after persistence; never assume the write landed merely because a command returned success.
10. **REPEAT** — take the next frontier item until a real stop condition is reached.

## Work allocation

Use the user's practical heuristic: **~98% execution, ~1% AI orchestration, ~1% human attention**. This is a target for reducing unnecessary interruptions, not a literal resource guarantee.

The machine should normally handle: inspection, search/reuse, planning, implementation, tests, red-team review, refactors, documentation, queue maintenance, receipts, and re-inspection.

Pause for the human when the task requires: credentials/secrets, legal or contractual commitment, financial transfer or binding investment decision, production/destructive action with material downside, ambiguous product/business judgement, or a fact that cannot be verified from available evidence.

## Speed rules

- Prefer one coherent chunk over repeated micro-prompts.
- Maintain a persistent queue so "next" means **take the next highest-value unblocked item**, not start from zero.
- Use parallel workers only on genuinely disjoint file/dependency sets; reconcile once at the end.
- Never parallelise writes to the same file.
- Verify after reconciliation, not only inside workers.
- Search/reuse before inventing new components, data models, prompts, or pipelines.
- Keep a short receipt after each durable brick: changed, verified, remaining, blocked.

## Stop conditions

Stop the autonomous loop only for one of these:

- **HUMAN_DECISION** — judgement is genuinely required.
- **AUTHORITY** — external permission/credential/approval is required.
- **SECURITY** — continuing could expose secrets or create an unsafe state.
- **RESOURCE** — required tool, account, environment, or compute is unavailable.
- **UNRECOVERABLE** — repeated verification shows the current path is invalid.
- **EMPTY_QUEUE** — no useful unblocked work remains.

Do not stop merely because one subtask failed. Re-plan around recoverable failures and continue.

## Evidence rule

Every important claim is labelled mentally as **observed / local / committed / remote / public / verified**. A successful local build is not proof that production is live. A commit is not proof that deployment occurred. A draft investment document is not proof of eligibility or funding.

## External opportunities / investment

Treat grants, angel outreach, financing, and investment plans as intelligence until the human chooses an external action. Store source URLs, eligibility evidence, dates, requested amounts, assumptions, and verification timestamps. Never fabricate traction, investor interest, eligibility, deadlines, or financial outcomes.
