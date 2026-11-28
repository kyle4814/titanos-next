// LOCAL end-to-end against a real workerd runtime (wrangler dev --local). Never touches Cloudflare or Stripe: it signs Stripe-shaped
// test events with a FAKE secret, reads the parked email from the LOCAL D1, downloads from the LOCAL R2 and checks the bytes.
//
//   cd digital-api
//   W=<path to wrangler 4>   P=<scratch dir for local state, outside the repo>
//   $W d1 migrations apply titanos-digital --local --persist-to $P
//   $W r2 object put titanos-digital-products/products/essential-eight-workbook/essential-eight-workbook.zip --file <that zip> --local --persist-to $P
//   $W dev --local --port 8799 --persist-to $P --var DIGITAL_WEBHOOK_SECRET:whsec_local_fake_secret_0001 \
//        DIGITAL_TOKEN_SECRET:local-token-secret-0123456789abcdef DIGITAL_STRIPE_SECRET_KEY:sk_test_local_fake DIGITAL_DEV_OUTBOX:1 &
//   E2E_WRANGLER=$W E2E_PERSIST=$P E2E_ZIP=<that zip> node scripts/e2e_local.mjs
import { createHmac, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const BASE = process.env.E2E_BASE || "http://localhost:8799";
const SECRET = process.env.E2E_WEBHOOK_SECRET || "whsec_local_fake_secret_0001";
const W = process.env.E2E_WRANGLER, P = process.env.E2E_PERSIST, ZIP = process.env.E2E_ZIP;
if (!W || !P || !ZIP) { console.error("set E2E_WRANGLER, E2E_PERSIST, E2E_ZIP (see the header)"); process.exit(2); }
const slug = "essential-eight-workbook";
let n = 0; const ok = (m) => { n++; console.log(`PASS ${m}`); };

const sign = (body) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex")}`; };
const post = (event, secretOverride) => { const body = JSON.stringify(event); return fetch(`${BASE}/digital/webhook`, { method: "POST", body, headers: { "stripe-signature": secretOverride ?? sign(body), "content-type": "application/json" } }); };
const d1 = (sql) => { const r = spawnSync(W, ["d1", "execute", "titanos-digital", "--local", "--persist-to", P, "--json", "--command", sql], { encoding: "utf8" }); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout)[0].results; };

const run = String(Date.now());
const session = `cs_test_local${run}`, pi = `pi_local${run}`;
const completed = { id: `evt_local_${run}`, type: "checkout.session.completed", livemode: false, data: { object: { id: session, payment_status: "paid", payment_intent: pi, amount_total: 4900, currency: "aud", customer_details: { email: "buyer@example.com" }, metadata: { kind: "digital", slug } } } };

assert.equal((await post(completed, "t=1,v1=bad")).status, 400); ok("bad signature rejected (400) on workerd");
const r1 = await post(completed); assert.equal(r1.status, 200); assert.deepEqual(await r1.json(), { result: "emailed" }); ok("signed checkout.session.completed fulfils the order");
assert.deepEqual(await (await post(completed)).json(), { result: "duplicate" }); ok("duplicate event id is a no-op");
const box = d1(`SELECT to_addr, body FROM digital_outbox WHERE body LIKE '%${session.slice(-8)}%' OR to_addr = 'buyer@example.com' ORDER BY id DESC LIMIT 5`);
const mails = d1("SELECT COUNT(*) AS n FROM digital_outbox WHERE to_addr = 'buyer@example.com'");
assert.ok(box.length >= 1); ok(`one email parked for the buyer (${mails[0].n} in the outbox in total)`);
const link = /(http\S+\/digital\/download\?t=\S+)/.exec(box[0].body)[1];
const dl = await fetch(link.replace(/^https?:\/\/[^/]+/, BASE));
assert.equal(dl.status, 200); assert.equal(dl.headers.get("content-type"), "application/zip");
const got = Buffer.from(await dl.arrayBuffer()), want = readFileSync(ZIP);
assert.equal(createHash("sha256").update(got).digest("hex"), createHash("sha256").update(want).digest("hex")); ok(`download streams the exact ${want.length} bytes from local R2`);
const ordCount = d1(`SELECT downloads, status FROM digital_orders WHERE session_id = '${session}'`)[0];
assert.equal(ordCount.downloads, 1); ok("download counted in the order log");
const refund = { id: `evt_local_r_${run}`, type: "charge.refunded", livemode: false, data: { object: { id: "ch_x", payment_intent: pi, refunded: true, amount: 4900, amount_refunded: 4900 } } };
assert.deepEqual(await (await post(refund)).json(), { result: "revoked" }); ok("charge.refunded revokes the order");
const after = await fetch(link.replace(/^https?:\/\/[^/]+/, BASE)); assert.equal(after.status, 410); ok("the link now answers 410 link_revoked");
console.log(`${n} PASS (real workerd, local D1, local R2, fake Stripe secret)`);
