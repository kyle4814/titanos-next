# Digital products: what is left (2026-11-28)

State: storage (KV, 19 zips) and the code are built and tested. The Worker deploy was BLOCKED by the permission layer in the build session (`wrangler deploy` denied twice), so it is not yet live. Nothing can be bought until it deploys.

Stripe key probe (STRIPE_RESTRICTED_KEY, rk_live, read-only plus empty-body POSTs that create nothing): checkout sessions list 200, webhook_endpoints list 200, products list 200, prices list 200. POST /v1/checkout/sessions and POST /v1/webhook_endpoints with empty bodies returned 400 validation errors (not 403), so the key can create sessions and webhook endpoints. Reading a session by id is covered by the same read permission.

Checkout is configured ON (`DIGITAL_CHECKOUT_ENABLED = "true"`, live mode, Kyle: "Just keep checkout on"). The buyer is safe without a webhook: the success page retrieves the session from Stripe server-side and shows the download link immediately (tested with no webhook secret set).

1. Deploy the Worker (one command):
   `cd /home/tech2/titanos_launch/wt-digital-products/digital-api && env -u CLOUDFLARE_API_TOKEN npx wrangler deploy`
   Note the printed `https://titanos-digital.<sub>.workers.dev`. Then check `/health` and `/digital/download?t=bad` (expect 403).
2. Point the site at it: set `DIGITAL_API_BASE` in `lib/shop/digital_api.ts` to that origin and add the origin to `connect-src` in `app/layout.tsx` (or add the `api.titanos.tech/digital/*` route, see wrangler.toml), then deploy the site so /shop shows the shelf.

Refund/dispute revocation needs the webhook (the key can create it, so an agent can do it after step 1):
- URL `<worker origin>/digital/webhook`, events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created`; store the whsec as the Worker secret `DIGITAL_WEBHOOK_SECRET`.
- Or by hand: Stripe dashboard > Developers > Webhooks > Add endpoint with the URL and events above, then `npx wrangler secret put DIGITAL_WEBHOOK_SECRET`.

Email: install the cron line from `ocean/digital_products_2026-11-28/CRON_LINE.txt` (fill in the workers.dev subdomain). Until then buyers get the link on the success page only.
