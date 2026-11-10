# Migration merge plan (f189)

Generated 2026-11-07 by `portal-api/scripts/migration_merge_plan.mjs` from `origin/main`. Read-only: git ls-tree / cat-file only, scratch copy in os.tmpdir, in-memory SQLite. Nothing applied, nothing deployed.

Identity rule: same filename and same blob on two stacked branches is ONE migration. Same filename, different blob is a CONFLICT. Same number, different filename is a COLLISION (renumbered below). Each branch's internal (number, name) order is kept.

## Summary

- Branches scanned: 80 (with migrations)
- Distinct migrations: 22 (present on every scanned branch: 1)
- Number collisions: 5
- Conflicts (same name, different content): 0
- Order cycle: none
- f104 lint on scratch copy: OK (22 migrations, 0 warnings)

## Number collisions

### 0002 (2 files)
- `0002_counter_buckets.sql` on 1 branches: origin/web/f09_site_counter_reader-2026-11-06
- `0002_portal_billing.sql` on 79 branches: origin/web/f100_c2_cancel_term_unify-2026-11-07, origin/web/f101_c2_stripe_period_seed-2026-11-07, origin/web/f102_c4_audit_head_anchor-2026-11-07, (+76 more)

### 0003 (4 files)
- `0003_agent_door.sql` on 47 branches: origin/web/f102_c4_audit_head_anchor-2026-11-07, origin/web/f103_c4_anchor_wire-2026-11-07, origin/web/f104_migration_lint-2026-11-07, (+44 more)
- `0003_enterprise.sql` on 57 branches: origin/web/f102_c4_audit_head_anchor-2026-11-07, origin/web/f103_c4_anchor_wire-2026-11-07, origin/web/f104_migration_lint-2026-11-07, (+54 more)
- `0003_owner_seat.sql` on 46 branches: origin/web/f102_c4_audit_head_anchor-2026-11-07, origin/web/f103_c4_anchor_wire-2026-11-07, origin/web/f104_migration_lint-2026-11-07, (+43 more)
- `0003_refund_cases.sql` on 12 branches: origin/web/f100_c2_cancel_term_unify-2026-11-07, origin/web/f101_c2_stripe_period_seed-2026-11-07, origin/web/f171_c2_webhook_d1_methods-2026-11-07, (+9 more)

### 0004 (4 files)
- `0004_market.sql` on 44 branches: origin/web/f102_c4_audit_head_anchor-2026-11-07, origin/web/f103_c4_anchor_wire-2026-11-07, origin/web/f104_migration_lint-2026-11-07, (+41 more)
- `0004_payouts_lifecycle.sql` on 12 branches: origin/web/f102_c4_audit_head_anchor-2026-11-07, origin/web/f103_c4_anchor_wire-2026-11-07, origin/web/f104_migration_lint-2026-11-07, (+9 more)
- `0004_store_counters.sql` on 3 branches: origin/web/f13_c2_d1store-2026-11-06, origin/web/f171_c2_webhook_d1_methods-2026-11-07, origin/web/f17_c7_idem_reserve-2026-11-06
- `0004_subscription_plan.sql` on 6 branches: origin/web/f172_c2_plan_d1_adapter-2026-11-07, origin/web/f175_c2_plan_cas-2026-11-07, origin/web/f177_c2_stripe_items_period-2026-11-07, (+3 more)

### 0005 (6 files)
- `0005_enterprise_d1.sql` on 1 branches: origin/web/f16_c8_entd1-2026-11-06
- `0005_idem_reservations.sql` on 2 branches: origin/web/f171_c2_webhook_d1_methods-2026-11-07, origin/web/f17_c7_idem_reserve-2026-11-06
- `0005_key_prefix_index.sql` on 4 branches: origin/web/f176_c7_spendcap_mcp_wire-2026-11-07, origin/web/f48_c7_key_trace_rotation-2026-11-06, origin/web/f58_c7_agent_d1store-2026-11-06, (+1 more)
- `0005_market_d1.sql` on 12 branches: origin/web/f102_c4_audit_head_anchor-2026-11-07, origin/web/f103_c4_anchor_wire-2026-11-07, origin/web/f104_migration_lint-2026-11-07, (+9 more)
- `0005_owner_d1.sql` on 4 branches: origin/web/f15_c3_d1ownerstore-2026-11-06, origin/web/f173_c3_undo_d1_rig-2026-11-07, origin/web/f174_c3_undo_concurrency-2026-11-07, (+1 more)
- `0005_subscription_version.sql` on 5 branches: origin/web/f175_c2_plan_cas-2026-11-07, origin/web/f177_c2_stripe_items_period-2026-11-07, origin/web/f181_c2_import_cycle_break-2026-11-07, (+2 more)

### 0006 (4 files)
- `0006_agent_d1.sql` on 3 branches: origin/web/f176_c7_spendcap_mcp_wire-2026-11-07, origin/web/f58_c7_agent_d1store-2026-11-06, origin/web/f98_c7_credit_ledger_invariants-2026-11-07
- `0006_audit_anchor.sql` on 6 branches: origin/web/f102_c4_audit_head_anchor-2026-11-07, origin/web/f103_c4_anchor_wire-2026-11-07, origin/web/f104_migration_lint-2026-11-07, (+3 more)
- `0006_owner_state_rev.sql` on 1 branches: origin/web/f185_c3_undo_state_cas-2026-11-07
- `0006_webhook_held_facts.sql` on 1 branches: origin/web/f171_c2_webhook_d1_methods-2026-11-07


## Conflicts

none

## Resolved conflicts (explicit --prefer)

- `0004_market.sql`: kept blob 86b2da9674; variants: 86b2da9674 on 10 branches (origin/web/f102_c4_audit_head_anchor-2026-11-07, origin/web/f103_c4_anchor_wire-2026-11-07, origin/web/f104_migration_lint-2026-11-07, ...) vs c511b22746 on 34 branches (origin/web/f173_c3_undo_d1_rig-2026-11-07, origin/web/f174_c3_undo_concurrency-2026-11-07, origin/web/f176_c7_spendcap_mcp_wire-2026-11-07, ...)

## Content edits required before merge (--strip)

- `0006_webhook_held_facts.sql`: remove lines matching `ALTER TABLE subscriptions ADD COLUMN plan_json` (duplicate of a column added by another migration in the set; renumbering cannot fix a repeated ALTER)

## Proposed apply order

| New | Old name | Renamed | On branches |
|---|---|---|---|
| `0001_portal_core.sql` | `0001_portal_core.sql` | no | 80 |
| `0002_counter_buckets.sql` | `0002_counter_buckets.sql` | no | 1 |
| `0003_portal_billing.sql` | `0002_portal_billing.sql` | yes | 79 |
| `0004_agent_door.sql` | `0003_agent_door.sql` | yes | 47 |
| `0005_enterprise.sql` | `0003_enterprise.sql` | yes | 57 |
| `0006_owner_seat.sql` | `0003_owner_seat.sql` | yes | 46 |
| `0007_refund_cases.sql` | `0003_refund_cases.sql` | yes | 12 |
| `0008_market.sql` | `0004_market.sql` | yes | 44 |
| `0009_payouts_lifecycle.sql` | `0004_payouts_lifecycle.sql` | yes | 12 |
| `0010_store_counters.sql` | `0004_store_counters.sql` | yes | 3 |
| `0011_subscription_plan.sql` | `0004_subscription_plan.sql` | yes | 6 |
| `0012_enterprise_d1.sql` | `0005_enterprise_d1.sql` | yes | 1 |
| `0013_idem_reservations.sql` | `0005_idem_reservations.sql` | yes | 2 |
| `0014_key_prefix_index.sql` | `0005_key_prefix_index.sql` | yes | 4 |
| `0015_market_d1.sql` | `0005_market_d1.sql` | yes | 12 |
| `0016_owner_d1.sql` | `0005_owner_d1.sql` | yes | 4 |
| `0017_subscription_version.sql` | `0005_subscription_version.sql` | yes | 5 |
| `0018_agent_d1.sql` | `0006_agent_d1.sql` | yes | 3 |
| `0019_audit_anchor.sql` | `0006_audit_anchor.sql` | yes | 6 |
| `0020_owner_state_rev.sql` | `0006_owner_state_rev.sql` | yes | 1 |
| `0021_webhook_held_facts.sql` | `0006_webhook_held_facts.sql` | yes | 1 |
| `0022_dispute_case.sql` | `0007_dispute_case.sql` | yes | 1 |

## Per-branch contribution

| Branch | Migrations |
|---|---|
| origin/web/f09_site_counter_reader-2026-11-06 | 2 |
| origin/web/f100_c2_cancel_term_unify-2026-11-07 | 3 |
| origin/web/f101_c2_stripe_period_seed-2026-11-07 | 3 |
| origin/web/f102_c4_audit_head_anchor-2026-11-07 | 9 |
| origin/web/f103_c4_anchor_wire-2026-11-07 | 9 |
| origin/web/f104_migration_lint-2026-11-07 | 9 |
| origin/web/f10_c2_drill50-2026-11-06 | 2 |
| origin/web/f13_c2_d1store-2026-11-06 | 4 |
| origin/web/f14_c3_monitor_cron-2026-11-06 | 3 |
| origin/web/f15_c3_d1ownerstore-2026-11-06 | 4 |
| origin/web/f16_c8_entd1-2026-11-06 | 4 |
| origin/web/f171_c2_webhook_d1_methods-2026-11-07 | 7 |
| origin/web/f172_c2_plan_d1_adapter-2026-11-07 | 4 |
| origin/web/f173_c3_undo_d1_rig-2026-11-07 | 7 |
| origin/web/f174_c3_undo_concurrency-2026-11-07 | 7 |
| origin/web/f175_c2_plan_cas-2026-11-07 | 5 |
| origin/web/f176_c7_spendcap_mcp_wire-2026-11-07 | 8 |
| origin/web/f177_c2_stripe_items_period-2026-11-07 | 5 |
| origin/web/f178_c4_migration_pair_discover-2026-11-07 | 9 |
| origin/web/f17_c7_idem_reserve-2026-11-06 | 5 |
| origin/web/f181_c2_import_cycle_break-2026-11-07 | 5 |
| origin/web/f182_c2_post_route_fuzz-2026-11-07 | 6 |
| origin/web/f183_c2_cas_all_paths-2026-11-07 | 5 |
| origin/web/f184_c4_union_ts_compiler-2026-11-07 | 9 |
| origin/web/f185_c3_undo_state_cas-2026-11-07 | 8 |
| origin/web/f186_c2_markpaid_dup_schedule-2026-11-07 | 5 |
| origin/web/f187_c4_dispute_case_d1-2026-11-07 | 10 |
| origin/web/f18_c4_marketd1-2026-11-06 | 5 |
| origin/web/f19_c7_key_spend_cap-2026-11-06 | 3 |
| origin/web/f20_c3_spf_proof-2026-11-06 | 6 |
| origin/web/f21_c4_unpaid_fund-2026-11-06 | 6 |
| origin/web/f22_c9_figure_lint-2026-11-06 | 6 |
| origin/web/f23_c7_keys_page-2026-11-06 | 3 |
| origin/web/f24_c8_partner_xacct-2026-11-06 | 3 |
| origin/web/f25_c8_oidc_rs256-2026-11-06 | 3 |
| origin/web/f27_c7_scope_idem_args-2026-11-06 | 6 |
| origin/web/f28_c4_attribution_washtrade-2026-11-06 | 6 |
| origin/web/f29_c4_alljobs_index-2026-11-06 | 6 |
| origin/web/f30_c8_estate_scan-2026-11-06 | 3 |
| origin/web/f31_c8_payout_card_builder-2026-11-06 | 3 |
| origin/web/f32_c2_refund_card-2026-11-06 | 2 |
| origin/web/f34_c8_estate_cache-2026-11-06 | 3 |
| origin/web/f35_c3_spf_nested_includes-2026-11-06 | 6 |
| origin/web/f36_c2_refund_service_wire-2026-11-06 | 3 |
| origin/web/f38_c3_spf_nested_wire-2026-11-06 | 6 |
| origin/web/f39_c7_mcp_jsonrpc_error-2026-11-06 | 6 |
| origin/web/f40_c8_payout_approve_transition-2026-11-06 | 3 |
| origin/web/f42_c8_payout_resume_sweep-2026-11-06 | 3 |
| origin/web/f43_c7_mcp_413_jsonrpc-2026-11-06 | 6 |
| origin/web/f44_c4_seat_entitlement-2026-11-06 | 4 |
| origin/web/f46_c8_payout_retry_executor-2026-11-06 | 3 |
| origin/web/f47_c2_sixteen_flows_matrix-2026-11-06 | 6 |
| origin/web/f48_c7_key_trace_rotation-2026-11-06 | 7 |
| origin/web/f49_c7_ten_agents_harness-2026-11-06 | 6 |
| origin/web/f50_c8_held_payout_routes-2026-11-06 | 3 |
| origin/web/f51_c8_payout_permanent_error-2026-11-06 | 3 |
| origin/web/f52_portal_typecheck_gate-2026-11-06 | 6 |
| origin/web/f53_c2_terms_flow_test-2026-11-06 | 6 |
| origin/web/f54_c8_held_payout_release_refund-2026-11-06 | 3 |
| origin/web/f57_c8_payout_tick-2026-11-06 | 3 |
| origin/web/f58_c7_agent_d1store-2026-11-06 | 8 |
| origin/web/f59_c8_payout_d1_adapter-2026-11-06 | 4 |
| origin/web/f62_c3_twenty_faults_drill-2026-11-06 | 6 |
| origin/web/f63_c4_ten_jobs_drill-2026-11-06 | 8 |
| origin/web/f64_c8_cross_tenant_route_matrix-2026-11-06 | 8 |
| origin/web/f68_c9_disclosure_policy-2026-11-06 | 6 |
| origin/web/f69_c3_report_trace-2026-11-06 | 6 |
| origin/web/f75_c1_model_calls_meter-2026-11-06 | 6 |
| origin/web/f81_c10_soak_portal_run-2026-11-06 | 6 |
| origin/web/f84_c2_account_export_erase-2026-11-06 | 6 |
| origin/web/f86_c9_worker_shared_headers-2026-11-07 | 8 |
| origin/web/f88_c8_share_ledger_invariants-2026-11-07 | 3 |
| origin/web/f90_c7_tool_receipt_coverage-2026-11-07 | 6 |
| origin/web/f91_c4_rank_property_suite-2026-11-07 | 6 |
| origin/web/f92_c2_webhook_order_suite-2026-11-07 | 3 |
| origin/web/f95_c3_undo_property_suite-2026-11-07 | 6 |
| origin/web/f96_c2_plan_change_proration-2026-11-07 | 3 |
| origin/web/f97_c4_job_dispute_warranty-2026-11-07 | 8 |
| origin/web/f98_c7_credit_ledger_invariants-2026-11-07 | 8 |
| origin/web/f99_c4_dispute_wire-2026-11-07 | 8 |

## Regenerate

```
node --disable-warning=ExperimentalWarning portal-api/scripts/migration_merge_plan.mjs --repo /home/tech2/titanos_launch/titanos-next --glob '^origin/web/f.*-2026-11-0[67]$' --prefer 0004_market.sql=86b2da9 --strip '0006_webhook_held_facts.sql=ALTER TABLE subscriptions ADD COLUMN plan_json' --out docs/MIGRATION_MERGE_PLAN.md --json docs/MIGRATION_MERGE_PLAN.json
```

## WOULD-FLIP

A branch added after this plan that carries a migration changes the set: re-run with `--check portal-api/MIGRATION_MERGE_PLAN.json` (or `docs/MIGRATION_MERGE_PLAN.json`); it exits 4 if the set or order differs from the committed plan. Renaming applies only when the stacks merge (GATE5); this plan renames nothing on any branch.
