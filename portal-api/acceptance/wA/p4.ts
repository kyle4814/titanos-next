import { make } from "../../test/harness.ts";
const out: string[] = []; const rec = (id: string, held: boolean, note: string) => out.push(`${held ? "HELD  " : "BREACH"} ${id}: ${note}`);
const h = make();
// login token double-spend race
await h.req("POST", "/auth/request", { body: { email: "race@x.example.com" } });
const tok = h.mailer.outbox.at(-1)!.text.match(/token=(ll_[0-9a-f]+)/)![1];
const rs = await Promise.all(Array.from({ length: 8 }, () => h.req("POST", "/auth/verify", { body: { token: tok } })));
rec("AUTH-token-race", rs.filter((r) => r.status === 200).length === 1, `8 concurrent verifies of one token -> ${rs.filter((r) => r.status === 200).length} sessions`);
// login rate limit variants
let sent = 0; for (const e of ["r@x.example.com", "R@x.example.com", " r@x.example.com ", "r+1@x.example.com", "r+2@x.example.com", "r@X.EXAMPLE.COM"]) for (let i = 0; i < 4; i++) { const r = await h.req("POST", "/auth/request", { body: { email: e } }); if (r.status === 202) sent++; }
rec("AUTH-rate-limit-casing", sent <= 5 + 8, `${sent} mails accepted across case variants of one inbox (limit 5/h per normalised email; +tags count as separate inboxes by design)`);
// unknown email vs known: identical response?
const k = await h.req("POST", "/auth/request", { body: { email: "race@x.example.com" } }); const u = await h.req("POST", "/auth/request", { body: { email: "nobody-xyz@x.example.com" } });
rec("AUTH-enum", k.status === u.status && (await k.text()) === (await u.text()), `${k.status}/${u.status}`);
// token oddities
for (const t of [null, 1, "ll_", "ll_zz", "", "ll_" + "0".repeat(10000), { $ne: 1 }]) { const r = await h.req("POST", "/auth/verify", { body: { token: t } }); if (r.status === 200 || r.status >= 500) rec("AUTH-weird-token", false, `${JSON.stringify(t).slice(0, 30)} -> ${r.status}`); }
// session oddities
for (const s of ["ss_", "ss_" + "0".repeat(64), "ss_0 ", "Bearer", "ss_%00"]) { const r = await h.req("GET", "/me", { token: s }); if (r.status !== 401) rec("AUTH-weird-session", false, `${s} -> ${r.status}`); }
// purchase / refund / cancel IDOR + race
const A = await h.login("a@pay.example.com"), B = await h.login("b@pay.example.com");
const { d } = await h.verifiedDomain(A.session, "pay.example.com.au");
await h.req("POST", "/checkout", { token: A.session, body: { product: "compliance_pack", domain: "pay.example.com.au" } }); const { purchase } = await h.pay("compliance_pack");
const idor = await h.req("POST", "/refunds", { token: B.session, body: { purchaseId: purchase.id } }); rec("PAY-refund-idor", idor.status === 404, `${idor.status}`);
const inv = await h.j(await h.req("GET", "/invoices", { token: A.session })); const ii = await h.req("GET", `/invoices/${inv.invoices[0].id}`, { token: B.session }); rec("PAY-invoice-idor", ii.status === 404, `${ii.status}`);
const rr = await Promise.all(Array.from({ length: 6 }, () => h.req("POST", "/refunds", { token: A.session, body: { purchaseId: purchase.id } })));
const refundCalls = (h.billing as any).calls?.filter((c: any) => c.op === "refund") ?? [];
rec("PAY-refund-race", refundCalls.length <= 1, `6 concurrent refunds -> ${rr.map((r) => r.status).join(",")} ; provider refund calls=${refundCalls.length}`);
const rr2 = await h.req("POST", "/refunds", { token: A.session, body: { purchaseId: purchase.id } }); rec("PAY-refund-again", (await rr2.clone().json() as any).status !== "refunded" || rr2.status >= 400, `${rr2.status} ${await rr2.text()}`);
// subscription cancel IDOR & minimum term
await h.req("POST", "/checkout", { token: A.session, body: { product: "ai_growth" } }); await h.pay("ai_growth");
const subs = [...h.store.subs.values()]; const cx = await h.req("POST", `/subscriptions/${subs[0].id}/cancel`, { token: B.session }); rec("PAY-cancel-idor", cx.status === 404, `${cx.status}`);
const cmine = await h.j(await h.req("POST", `/subscriptions/${subs[0].id}/cancel`, { token: A.session })); rec("PAY-min-term", cmine.effectiveAt >= h.clock.t + 80 * 86400_000, `retainer cancel effective in ${(cmine.effectiveAt - h.clock.t) / 86400_000 | 0} days (3-month minimum)`);
// webhook duplicate race
const before = (await h.j(await h.req("GET", "/invoices", { token: A.session }))).invoices.length;
await h.req("POST", "/checkout", { token: A.session, body: { product: "monitor_monthly", domain: "pay.example.com.au" } });
const p2 = [...h.store.purchases.values()].filter((p) => p.productId === "monitor_monthly").at(-1)!;
const evs = await Promise.all(Array.from({ length: 6 }, () => h.webhook("checkout.session.completed", { id: p2.checkoutId, payment_status: "paid", payment_intent: "pi_x", customer: "cus_x", subscription: "sub_x" }, { id: "evt_same" })));
const after = (await h.j(await h.req("GET", "/invoices", { token: A.session }))).invoices.length;
rec("WH-dup-race", after - before === 1, `6 concurrent same-id webhooks -> ${after - before} invoice(s)`);
// export contains no foreign data / secrets
const ex = JSON.stringify(await h.j(await h.req("GET", "/account/export", { token: A.session }))); rec("EXPORT-no-hash", !/"hash"|ss_[0-9a-f]{20}|tk_[0-9a-f]{20}/.test(ex), "");
// delete then reuse
const del = await h.req("DELETE", "/account", { token: A.session, body: { confirm: "DELETE" } }); const me = await h.req("GET", "/me", { token: A.session }); rec("DEL-session-dead", me.status === 401, `delete ${del.status}, then /me ${me.status}`);
const re = await h.login("a@pay.example.com"); const lst = await h.j(await h.req("GET", "/domains", { token: re.session })); rec("DEL-no-resurrect", lst.domains.length === 0 && re.account.id !== A.account.id, "re-signup gets a fresh empty account");
// body/size/method fuzz
for (const [m, p] of [["PUT", "/me"], ["GET", "/market/jobs/../../me"], ["GET", "//me"], ["GET", "/ME"], ["POST", "/stripe/webhook"]]) { const r = await h.req(m, p, { token: re.session }); if (r.status >= 500) rec("FUZZ-" + m + p, false, `${r.status}`); }
const big = await h.req("POST", "/domains", { token: re.session, body: { domain: "a".repeat(70000) } }); rec("FUZZ-big", big.status === 413 || big.status === 400, `${big.status}`);
console.log(out.join("\n"));
