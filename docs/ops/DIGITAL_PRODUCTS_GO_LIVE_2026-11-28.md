# Digital products: go-live runbook (2026-11-28)

Status: BUILT AND TESTED, NOT DEPLOYED. Nothing here has touched live Stripe, live R2, Cloudflare or the live site. Branch `build/digital-products-pipeline-2026-11-28`.

## What was built

The sale path, with no human touch per order:

```
Buy button (static site)
  -> POST /digital/checkout {slug}            Worker creates a Stripe Checkout Session (AUD, price from the Worker's own catalogue)
  -> buyer pays on Stripe
  -> Stripe webhook POST /digital/webhook      signature verified, idempotent on event id, order logged in D1
  -> signed download token (HMAC, 7 days, 5 downloads) emailed to the buyer
  -> GET /digital/download?t=<token>           token + order checked, zip streamed from the PRIVATE R2 bucket
  -> charge.refunded (full) or charge.dispute.created revokes the order, the link answers 410
```

| Piece | Where |
| --- | --- |
| Worker (separate from the portal Worker, own D1 + R2) | `digital-api/` (`wrangler.toml`, `src/`, `migrations/0001_digital.sql`) |
| Catalogue generator (ingests the 19+ `listing.json` files) | `scripts/gen_digital_catalogue.mjs` writes `lib/shop/digital_products.json` and `digital-api/src/catalogue.generated.ts` |
| Shelf on /shop and a page per product | `app/shop/page.tsx` (Digital products section), `app/shop/digital/[slug]/page.tsx`, `components/DigitalBuyButton.tsx`, `app/order/digital/thanks/` |
| R2 upload script (dry run by default) | `digital-api/scripts/upload_to_r2.mjs` |
| Mailer (pluggable, one real adapter: Resend) | `digital-api/src/mailer.ts` |

Why a separate Worker: `titanos-portal-api` refuses live Stripe keys on purpose (`live_key_refused`), and `api.titanos.tech` belongs to the older `titanos-api` Worker. Going live here cannot change either of them. All digital bindings are `DIGITAL_*` so nothing is shared.

Why no existing email path was reused: there is none for transactional mail. The portal only has a test-mode D1 `dev_outbox`, and Instantly is the cold outbound path (not for receipts). So `DigitalMailer` is a one-method interface (`send({to, subject, text, idempotencyKey})`) with one real adapter (Resend). To use another provider, add a class implementing `DigitalMailer` in `mailer.ts` and return it from `mailerFor()`. Nothing else changes.

Security properties (all covered by tests):
- Product files are only in the private R2 bucket. Nothing is in `public/`, `out/` or git. The site shows a SHA-256 checksum, never a URL to the file.
- The price is never read from the client. `POST /digital/checkout` takes a slug; any `price` or `amount` field is ignored.
- Webhook: Stripe signature (HMAC-SHA256, 300 s tolerance), idempotent on event id, test events cannot fulfil a live shop (livemode must match `DIGITAL_STRIPE_MODE`).
- If the email send fails the webhook answers 500 and Stripe retries; the order row is keyed on the Stripe session id so a retry never double-orders or double-emails.
- A full refund or a dispute revokes. A partial refund keeps access. A refund that arrives before its payment is held and applied when the order is created.
- HEAD requests on the link (mail scanners) do not spend a download; GET does. The cap of 5 leaves room for a scanner plus the buyer.
- Checkout is limited to 20 sessions per IP per hour (D1 counter).

## Steps that need Kyle's tap, in order

Everything below is a GATE (money, credentials, deploy). None of it has been done. Run from the repo root of the merged branch unless stated. `npx wrangler` needs `wrangler login` or `CLOUDFLARE_API_TOKEN` in the environment.

1. **Review and merge the branch to main** (GATE5, irreversible-ish). Check the diff; the site deploy in step 10 ships from main. Re-run `node scripts/gen_digital_catalogue.mjs` first if more products arrived, commit the two generated files.
2. **Create the private R2 bucket**
   `npx wrangler r2 bucket create titanos-digital-products`
   Then in the Cloudflare dashboard (R2 > titanos-digital-products > Settings) confirm "Public access" (r2.dev URL) is Disabled and no custom domain is attached. The Worker reads it through its binding; nobody else needs access.
3. **Create the D1 database and apply the migration**
   `npx wrangler d1 create titanos-digital` then paste the printed `database_id` into `digital-api/wrangler.toml` (replace `REPLACE_WITH_ID_FROM_wrangler_d1_create`), commit it.
   `cd digital-api && npx wrangler d1 migrations apply titanos-digital --remote`
4. **Mail: create the sending account** (GATE1/GATE2). Create a Resend account, add and verify `titanos.tech` as a sending domain (it gives SPF and DKIM DNS records; add them to Cloudflare DNS, keep the existing DMARC policy intact), create an API key.
   `cd digital-api && npx wrangler secret put RESEND_API_KEY`
   Uncomment and set `MAIL_FROM = "TITANOS <orders@titanos.tech>"` in `digital-api/wrangler.toml` `[vars]`.
5. **Set the token secret**
   `openssl rand -hex 32 | (cd digital-api && npx wrangler secret put DIGITAL_TOKEN_SECRET)`
   Rotating it later invalidates every outstanding link (acceptable: buyers can be re-sent).
6. **Upload the zips** (dry run first; it checks every zip's SHA-256 against the catalogue):
   `node digital-api/scripts/upload_to_r2.mjs`
   then `DIGITAL_UPLOAD_CONFIRM=yes node digital-api/scripts/upload_to_r2.mjs --apply`
   Objects land at `products/<slug>/<slug>.zip`, which is the key the Worker reads.
7. **Deploy the Worker in TEST mode first** (GATE5). `digital-api/wrangler.toml` ships with `DIGITAL_STRIPE_MODE = "test"`.
   `npx wrangler secret put DIGITAL_STRIPE_SECRET_KEY` with a **test** key (`sk_test_...`, or a restricted key with only "Checkout Sessions: Write"), then
   `cd digital-api && npx wrangler deploy`. Note the printed `https://titanos-digital.<subdomain>.workers.dev` origin.
8. **Register the webhook** in the Stripe dashboard (test mode first): Developers > Webhooks > Add endpoint
   URL `https://titanos-digital.<subdomain>.workers.dev/digital/webhook`
   Events to send: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created`.
   Copy the signing secret (`whsec_...`) and run `npx wrangler secret put DIGITAL_WEBHOOK_SECRET`. Until it is set the endpoint answers 503 and Stripe simply retries.
9. **Point the site at the Worker.** Either:
   - (preferred) in `digital-api/wrangler.toml` uncomment the `routes = [...]` line (`api.titanos.tech/digital/*`) and `DIGITAL_PUBLIC_ORIGIN = "https://api.titanos.tech"`, redeploy, and confirm `curl https://api.titanos.tech/health` still answers as before (the path route sits in front of `titanos-api` for `/digital/*` only; if Cloudflare rejects the route because the hostname is a Custom Domain of the other Worker, use the next option); or
   - set `DIGITAL_API_BASE` in `lib/shop/digital.ts` to the workers.dev origin and add that origin to `connect-src` in `app/layout.tsx`.
10. **Deploy the site** (the normal deploy of main: `DEPLOY_NOW.sh`), so /shop shows the Digital products shelf and the Buy buttons call the Worker.
11. **Test-mode rehearsal** (no money moves): buy the cheapest product with Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC. Confirm: email arrives, link downloads the zip, the order is in the log (queries below), then refund it in the Stripe test dashboard and confirm the link now says "link_revoked" (410).
12. **Go live** (GATE1/GATE2): in the Stripe dashboard create a **live** restricted key ("Checkout Sessions: Write" only) and a **live** webhook endpoint with the same URL and the same four events.
    `npx wrangler secret put DIGITAL_STRIPE_SECRET_KEY` (live key), `npx wrangler secret put DIGITAL_WEBHOOK_SECRET` (live whsec), set `DIGITAL_STRIPE_MODE = "live"` in `digital-api/wrangler.toml`, commit, `npx wrangler deploy`.
    Then one real purchase of the AU$29 product with your own card, confirm the email and download, and refund it. (Stripe keeps its processing fee on a refund, a few cents to about AU$1.)

## Decisions only Kyle can make (not invented here)

- **Refund policy wording.** The product pages say a refunded or disputed order stops working and link to /terms; they do not promise a refund window. Digital goods still carry the Australian Consumer Law guarantees. Decide the policy and add it to /terms before step 12.
- **Sender address** (`orders@titanos.tech` is a suggestion).
- **Whether `api.titanos.tech/digital/*` or the workers.dev origin is used** (step 9).

## Operating it

Look at orders (read only):
`cd digital-api && npx wrangler d1 execute titanos-digital --remote --command "SELECT id, slug, email, amount_cents, status, downloads, emailed_at, created_at FROM digital_orders ORDER BY created_at DESC LIMIT 20"`

A paid order with no `emailed_at` means the mail failed. Stripe retries the webhook for up to 3 days; to force it, Stripe dashboard > Developers > Webhooks > the event > Resend. A paid order for a product no longer in the catalogue is logged and never emailed (`order_logged_unknown_product`): re-add the product, regenerate, deploy, then resend the event.

A buyer lost their email: resend the event from Stripe (the order is not duplicated). A buyer hit the 5-download cap: `UPDATE digital_orders SET downloads = 0 WHERE id = '<order id>'` through `wrangler d1 execute --remote`.

Adding or changing products: put the zip and `listing.json` in the products directory, run `node scripts/gen_digital_catalogue.mjs`, commit, upload (`upload_to_r2.mjs`), `wrangler deploy` the Worker (it carries the prices) and deploy the site.

Rollback: `cd digital-api && npx wrangler rollback`, or disable the Stripe webhook endpoint, or remove the route. Buy buttons then show "Checkout couldn't open" with an email fallback. R2 files stay private throughout.

## Known limits

- The download count includes a download that the buyer abandons half way (a Range or resume request counts as one). A file missing in R2 does not cost the buyer a download.
- Revocation is per order row, not per token: the token itself cannot be recalled, but the Worker checks the row on every download.
- The thank-you page polls `GET /digital/order` and shows only a state, never the email address or the link.
- Not exercised against Stripe's real API: checkout session creation (tests use a fake Stripe) and the Resend adapter (tests use a fake fetch). Both are covered by the test-mode rehearsal in step 11. Everything else, including webhook signature, token, D1, R2 streaming, refund revocation, was run on a real workerd runtime locally (`digital-api/scripts/e2e_local.mjs`).
