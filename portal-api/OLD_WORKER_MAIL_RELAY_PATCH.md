# Patch for the OLD Worker `titanos-api`: a login-mail relay route (NOT applied; the old Worker's repo was not touched)

Why: `portal-api` can send login mail through a Cloudflare service binding to `titanos-api`, which already holds the Resend key (`RESEND_API_KEY`) and sends from a verified `titanos.tech` address. The old Worker has no route that sends arbitrary or login mail today (checked 2026-11-13 in the only copy on disk, the 2026-08-08 deployed-bundle backup `titanos_launch/titanos-state/worker_deployed_backup/titanos-api.bundle.js`: every `sendResend` caller is an order, scan or invoice notification). Worker secrets cannot be read back, so the key cannot be copied to `portal-api`; a relay is the way to use it without asking the owner for a new key.

## What the old Worker does today (read from the bundle; the live Worker may have drifted since 2026-08-08)

- `sendResend(env, msg)`: `POST https://api.resend.com/emails`, `Authorization: Bearer ${env.RESEND_API_KEY}`, JSON body `msg`, throws `resend <status>: <first 200 chars>` on non-2xx.
- From addresses used: `Titanos Orders <kyle@titanos.tech>`, `Kyle Deligny <kyle@titanos.tech>`, `Titanos Scan Inbox <kyle@titanos.tech>` (the scan route's own `OPERATOR_EMAIL2` is the same address). So the sending domain is `titanos.tech`, already verified with Resend if those mails arrive today (UNVERIFIED from here: no live call was made).
- `/internal/*` routes are guarded by a constant-time `Bearer ${INTERNAL_API_SECRET}` check. That secret is also placed in a `?secret=` admin URL that the Worker emails to the operator, so it is a poor choice to reuse across Workers. This patch uses a NEW dedicated secret, `MAIL_RELAY_SECRET`, set on both Workers.

## The route (add next to `internalRoutes`, OUTSIDE the `/internal/*` middleware so it uses its own secret)

```js
// Login-mail relay for titanos-portal-api. Own secret, fixed sender, fixed template: it cannot be used to send anything else.
const LOGIN_TEXT_RE = /^Open this link within 15 minutes to sign in:\nhttps:\/\/titanos\.tech\/app\/login#token=ll_[0-9a-f]{16,128}\nIf you did not ask for this, ignore it\.$/;
const RELAY_EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z][A-Za-z0-9-]{1,62}$/;
function relayAuthOk(c) {
  const h = c.req.header("authorization") ?? "";
  if (!h.startsWith("Bearer ")) return false;
  const supplied = h.slice(7), expected = c.env.MAIL_RELAY_SECRET;
  if (!expected || supplied.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < supplied.length; i++) diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
relayRoutes.post("/relay/login-mail", async (c) => {
  if (!relayAuthOk(c)) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  let b; try { b = await c.req.json(); } catch { return new Response(JSON.stringify({ error: "bad_json" }), { status: 400 }); }
  if (typeof b?.to !== "string" || !RELAY_EMAIL_RE.test(b.to) || b.subject !== "Your TITANOS login link" || typeof b.text !== "string" || !LOGIN_TEXT_RE.test(b.text))
    return new Response(JSON.stringify({ error: "bad_request" }), { status: 400 });
  await sendResend(c.env, { from: `TITANOS <${OPERATOR_EMAIL}>`, to: b.to, subject: b.subject, text: b.text });   // 5xx on a provider failure, so portal-api retries
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
// and mount it: app.route("/", relayRoutes);   (const relayRoutes = new Hono2();)
```

`sendResend` throws on a provider failure; make sure the route returns a 5xx in that case (Hono's default for an uncaught throw is 500, which `portal-api` treats as retryable). Do not log `b.to` or `b.text`.

## Ordered steps (all MACHINE; the first two write to the live old Worker, so they need the owner's deploy approval, not a new key)

1. Apply the route above to the real `titanos-api` source (only a minified bundle backup exists in this workspace; find or rebuild the source first) and test it against the bundle build.
2. `openssl rand -hex 32 | npx wrangler secret put MAIL_RELAY_SECRET --name titanos-api`, then deploy `titanos-api`. Existing routes are unchanged; Monitor customers are served by the same Worker, so deploy with the owner's go and keep the previous version id for `wrangler rollback`.
3. Set the SAME value on `titanos-portal-api` without ever displaying it (generate once, pipe to both `wrangler secret put` commands from the same shell variable, then `unset` it).
4. In `portal-api/wrangler.toml` uncomment the `[[services]]` block and set `MAIL_PROVIDER = "relay"`.

## Can `INTERNAL_API_SECRET` be reused instead?

Technically the old Worker would accept it, but (a) its value cannot be read back from either Worker, so the owner would have to supply or reset it, which is the thing we are avoiding; (b) the old Worker emails it inside an admin URL, so it has already left Cloudflare. A new random `MAIL_RELAY_SECRET` is the answer: nothing for the owner to supply.

## Rollback

Remove the `[[services]]` block and `MAIL_PROVIDER = "relay"`, redeploy `titanos-portal-api` (login mail falls back to refusing, or to `resend` if its key is set). The extra route on `titanos-api` is inert without the secret; remove it on that Worker's next deploy.
