@AGENTS.md

@docs/ops/AUTONOMOUS_EXECUTION.md
@docs/ops/WORK_QUEUE.md

## Operator command

When the operator says **next**, execute the TitanOS control-plane loop defined above and use .claude/commands/next.md as the compact execution contract.

The default is autonomous continuation across multiple safe work chunks. Stop only at a declared human/authority/security/resource/unrecoverable/empty-queue gate.