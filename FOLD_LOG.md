# FOLD_LOG 2026-11-11
base origin/web/obelisk-int3-2026-11-07 4d31b19ef
merged 43 of 86 candidates; 8 via json/css auto-resolve (pkgmerge). Skipped (conflicts needing decision): see final report; list in /dev/shm/klinge/pass2.out

Gate tooling: scripts/cloud_build.sh copied from origin/main 64ee2e299 into staging (absent on the int3 target) so the gate runs on the exact committed staging SHA. Land only on a pass for the pushed head SHA.

f382 merge 1148766a8 reverted (coordinator decision): superseded by main 1b38ce14e proof regen. ledger.json conflict on revert resolved keeping the fold (post-f382 regen) side.

Tap-target/CSS group reverted (coordinator decision): f385, f392, f405 (both), f411 merges; f410 and f413 were already unmerged (conflicts). Reason: homepage 32117 px > budget 31500; budget kept.

f372 merge 8830d55fa reverted (bisect build 2): footer column suspected of pushing homepage over 31500 px. Note: target tip does not contain test_home_height (from f370), so its number is unreadable without f370.
