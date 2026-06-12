# UPDATE_MONTHLY

Bump these two values in `lib/config.ts` on the first of each month.
Stale scarcity is worse than none.

- `CURRENT_BOOKING_MONTH` → the next month with open compliance capacity.
- `MONTHLY_COMPLIANCE_SLOTS` → honest slot count (4 unless capacity changed).

Rebuild + push gh-pages.
