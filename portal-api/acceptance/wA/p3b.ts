import { make } from "../../test/harness.ts";
const h = make(); const s = await h.login("k@ag.example.com");
for (const sc of [["admin","*"], ["catalogue:read","admin"], [], undefined, "scan:read", ["scan:read","scan:read"]]) {
  const r = await h.req("POST", "/keys", { token: s.session, body: sc === undefined ? {} : { scopes: sc } }); const b = await r.json() as any; console.log(JSON.stringify(sc), r.status, JSON.stringify({scopes:b.scopes, error:b.error}));
}
const k = await (await h.req("POST", "/keys", { token: s.session, body: { scopes: ["catalogue:read"] } })).json() as any;
const tl = await (await h.req("POST", "/mcp", { token: k.key, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } })).json() as any;
console.log(tl.result.tools.map((t: any) => t.name));
