# f200 unpaid-fund recheck (2026-11-07, synthetic data, nothing deployed)
Soak: `node --experimental-strip-types acceptance/wA/soak.ts 120 31`, same box, load ~20/8, time-bounded so ops differ per variant.
| variant | commit | ops | fundedWhileUnpaid | paidFromUnpaidFunding |
|---|---|---|---|---|
| base | 2411ea1fd | 42,003 | 10 | 1 |
| f21 alone | d47a48d0f | 38,209 | 0 | 0 |
| f29 alone | f26fc5f00 | 110,417 | 21 | 5 |
| f21+f29 | merge (clean) | 111,803 | 0 | 0 |
Extra: f21+f29 seeds 7 and 99 (60 s) paidFromUnpaidFunding 0. Seed 7 showed fundedWhileUnpaid 1: harness false positive (job went awaiting_funds -> cancelled by sweep/clock jump, fundedAt and paymentIntent undefined). soak.ts now excludes "cancelled".
Files soak_*_seed31_120s.json are the raw outputs (base/f29 used the unpatched counter).
