# D1 local wire (x1_d1_worker_local, 2026-11-07)

NOT DEPLOYED. Nothing here touches Cloudflare, Stripe or any real key. Everything runs on this machine.

## What exists
- `src/d1/store.ts` D1Store (accounts, sessions, billing, keys, agent credits and receipts), `src/market/d1store.ts`, `src/enterprise/d1store.ts`; the owner and counter D1 stores already existed.
- `src/d1/deps.ts` `buildDeps(env)`: the Worker's dependency set. No `DB` binding = every route but /health stays 503. Anything needing a credential (mail, Stripe, IdP, payouts, DNS write) fails closed with a named error unless `LOCAL_DEV=1`.
- `src/worker.ts` the entry module (workerd rejects an entry that exports anything but handlers; `index.ts` exports helpers for the tests).
- `migrations/0006_d1_wire.sql` closes the schema gaps the adapters found (sso client_key, ledger hold flags, tenant brand_public, payouts 'sending' state, market card 'clawback_review').
- Tests: `npm test` (memory) and `npm run test:d1` (the SAME 360 suite tests over real SQLite with every migration, FKs on) plus `test/d1_store.test.ts` (races).

## Run it
    cp .dev.vars.example .dev.vars        # fixture values only
    npm run dev:local                     # migrations apply --local, then wrangler dev --local on :8817
    DEVLOG=<that log> scripts/local_e2e.sh

## Transcript (wrangler 4.158.0, Miniflare D1, session and key values redacted)
```
GET   /health                -> 200 {"ok":true,"service":"titanos-portal-api","version":"0.1.0","stripe_mode":"test","db":"ok"}
GET   /catalogue             -> 200 {"products":[{"id":"monitor_monthly","name":"Titanos Monitor (monthly)","amountCents":14900,"currency":"aud","mode
POST  /auth/request          -> 202 {"ok":true}
POST  /auth/verify           -> 200 {"session":"ss_<redacted>","account":{"id":"acc_44b31554ae35349676371e5b","email":"e2e+1793999378@example.invali
GET   /me                    -> 200 {"id":"acc_44b31554ae35349676371e5b","email":"e2e+<ts>@example.invalid","seat":"owner"}
POST  /domains               -> 201 {"id":"dom_db31eec9877c6a45","domain":"e2e-fixture.com.au","verified":false,"record":{"type":"TXT","name":"_titano
GET   /domains               -> 200 {"domains":[{"id":"dom_db31eec9877c6a45","domain":"e2e-fixture.com.au","verified":false}]}
POST  /checkout              -> 201 {"purchaseId":"pur_791ad25e0eb777f9","checkoutUrl":"https://checkout.mock.invalid/cs_test_555652b61cb5fd484423e044
GET   /billing               -> 200 {"purchases":[{"id":"pur_791ad25e0eb777f9","accountId":"acc_44b31554ae35349676371e5b","productId":"leads_growth","
POST  /keys                  -> 201 {"id":"key_97a0790da738","key":"tk_<redacted>","scopes":["catalogue:read"],"note":"Shown once. Store it now."}
GET   /keys                  -> 200 {"keys":[{"id":"key_97a0790da738","scopes":["catalogue:read"],"createdAt":1793999380969,"revoked":false}]}
POST  /keys                  -> 201 {"id":"key_1a901d8c9894","key":"tk_<redacted>","scopes":["catalogue:read"],"note":"Shown once. Store it now."}
POST  /mcp                   -> 200 {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\"result\":{\"products\":[{\"id\":\"monitor_m
GET   /agent/credits         -> 200 {"balance":0,"entries":[]}
GET   /me                    -> 401 {"error":"unauthenticated"}
e2e failures: 0
```

After killing and restarting `wrangler dev --local`, the same session still answered `GET /me` 200 and `GET /billing` 200 (rows persisted in .wrangler/state).

## CARD NEEDED (owner taps, nothing done here)
- Create the live D1 database and paste its id over `REPLACE_WITH_LIVE_D1_ID` in wrangler.toml, then apply migrations 0001..0006 remotely (GATE2 and GATE5). 0006 drops and rebuilds `payouts` and `market_cards`: only safe while those tables are empty.
- Set Worker secrets STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, INTERNAL_API_SECRET, RECEIPT_SECRET, SEAL_KEY (GATE2).
- Choose and provision a mail provider so `Mailer` has a real implementation (login links cannot be sent without one; today it fails closed with 500).
- First enterprise IdP: wire `createOidcVerifier` with a per-tenant JWKS fetch policy (today the non-local IdP verifier fails closed).
- Payout provider and DNS zone credentials for auto-fix (both fail closed).
