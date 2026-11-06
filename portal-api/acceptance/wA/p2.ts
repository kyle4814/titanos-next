import { rig } from "../../test/market_harness.ts";
const r = rig();
const own = await r.owner("own@m.example.com", "fix.example.com.au"); const pro = await r.pro("pro@m.example.com");
const jid = (await r.hire(own)).job.id; await r.claim(pro.session, jid); await r.deliver(pro.session, jid); r.fix("fix.example.com.au");
const rs = [];
for (let i = 0; i < 4; i++) { r.h.clock.t += 120_000; rs.push(await Promise.all([r.h.req("POST", `/market/jobs/${jid}/rescan`, { token: pro.session }), r.h.req("POST", `/market/jobs/${jid}/rescan`, { token: own.session }), r.internal("POST", "/internal/market/sweep")])); }
const tr = r.payments.calls.filter((c: any) => c.op === "transfer");
console.log("transfers", tr.length, JSON.stringify(r.payments.calls.map((c:any)=>c.op)));
// pay then regress: clawback?
r.unfix("fix.example.com.au"); const w = await r.internal("POST", "/internal/market/sweep"); console.log("warranty", JSON.stringify(await w.json()));
const lb = await (await r.h.req("GET", "/market/leaderboard")).json(); console.log("lb", JSON.stringify(lb));
