import { runScan, dohFetch } from "../../../lib/guestscan/scan.ts";
const seen: string[] = [];
(globalThis as any).fetch = async (u: any) => { seen.push(String(u)); const url = new URL(String(u)); const n = url.searchParams.get("name"), t = url.searchParams.get("type"); return new Response(JSON.stringify({ Status: 0, Answer: t === "TXT" && n === "acme.example.com.au" ? [{ name: n, type: 16, data: '"v=spf1 -all"' }] : [] }), { headers: { "content-type": "application/dns-json" } }); };
const t0 = performance.now(); const r: any = await runScan("acme.example.com.au", dohFetch()); const ms = performance.now() - t0;
const hosts = [...new Set(seen.map((u) => new URL(u).host))];
console.log("hosts contacted:", hosts, "requests:", seen.length, "grade", r.grade, "modelCalls field", r.modelCalls, "ms", ms.toFixed(0));
console.log("model-ish host contacted:", hosts.some((h) => /anthropic|openai|googleapis|cohere|mistral|groq|together|huggingface/i.test(h)));
