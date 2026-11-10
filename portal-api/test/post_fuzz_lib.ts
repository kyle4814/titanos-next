// C2 naive-user residual (f182): seeded POST/PUT/DELETE/PATCH route fuzz for the portal-api worker.
// Everything here is synthetic. Routes are ENUMERATED from the router source (src/index.ts, src/enterprise/routes.ts),
// never hand-listed, and the suite fails if a mutating-method line cannot be turned into a route.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
export const ROUTER_FILES = ["index.ts", "enterprise/routes.ts"];
export const MUTATING = ["POST", "PUT", "DELETE", "PATCH"];

export interface Route { method: string; template: string; file: string; line: number }
export interface Enumeration { routes: Route[]; mutatingLines: number; unparsed: { file: string; line: number; text: string }[] }

type Conds = { segs: Map<number, string[]>; path?: string; rest?: string; len?: number; top?: string };
const stripComment = (s: string) => s.replace(/\s\/\/.*$/, "");
const indent = (s: string) => s.length - s.trimStart().length;

function condsOf(line: string, single: boolean): Conds {
  const c: Conds = { segs: new Map() };
  const l = stripComment(line);
  for (const m of l.matchAll(/seg\[(\d)\] === "([^"]+)"/g)) {
    const i = Number(m[1]);
    const cur = c.segs.get(i) ?? [];
    if (!cur.includes(m[2])) cur.push(m[2]);
    c.segs.set(i, cur);
  }
  if (single) for (const [i, v] of c.segs) if (v.length !== 1) c.segs.delete(i);
  const p = l.match(/\bpath === "([^"]+)"/); if (p) c.path = p[1];
  const r = l.match(/\brest === "([^"]+)"/); if (r) c.rest = r[1];
  const n = l.match(/seg\.length === (\d)/); if (n) c.len = Number(n[1]);
  const t = l.match(/\btop === "([^"]+)"/); if (t) c.segs.set(0, [t[1]]);
  return c;
}

export function enumerateRoutes(includeGet = false): Enumeration {
  const routes: Route[] = []; const unparsed: Enumeration["unparsed"] = []; let mutatingLines = 0;
  for (const file of ROUTER_FILES) {
    const lines = readFileSync(join(SRC, file), "utf8").split("\n");
    lines.forEach((raw, idx) => {
      const body = stripComment(raw);
      const mm = [...body.matchAll(/\bm === "(POST|PUT|DELETE|PATCH|GET)"/g)].map((x) => x[1]).filter((x) => includeGet || x !== "GET");
      const notPost = /\bm !== "POST"/.test(body);   // /mcp: everything but POST is refused, so POST is the live method
      if (!mm.length && !notPost) return;
      if (mm.some((x) => x !== "GET") || notPost) mutatingLines++;
      const methods = mm.length ? [...new Set(mm)] : ["POST"];
      // merge this line's conditions with the enclosing block openers (strictly smaller indent, ending in "{")
      const own = condsOf(body, false);
      const merged: Conds = { segs: new Map(own.segs), path: own.path, rest: own.rest, len: own.len };
      let thr = indent(raw);
      for (let j = idx - 1; j >= 0 && thr > 0; j--) {
        const up = lines[j];
        if (!up.trim() || indent(up) >= thr) continue;
        thr = indent(up);
        if (!/\{\s*(\/\/.*)?$/.test(up)) continue;
        const c = condsOf(up, true);
        for (const [i, v] of c.segs) if (!merged.segs.has(i)) merged.segs.set(i, v);
        if (merged.path === undefined && c.path) merged.path = c.path;
      }
      let templates: string[] = [];
      if (merged.path) templates = [merged.path];
      else {
        const parts: string[][] = [];
        let max = -1;
        for (const i of merged.segs.keys()) max = Math.max(max, i);
        const restParts = merged.rest ? merged.rest.split("/") : [];
        if (restParts.length) max = Math.max(max, 1 + restParts.length);
        if (merged.len) max = Math.max(max, merged.len - 1);
        for (let i = 0; i <= max; i++) {
          if (merged.segs.has(i)) parts.push(merged.segs.get(i)!);
          else if (restParts.length && i >= 2) parts.push([restParts[i - 2]]);
          else parts.push([":id"]);
        }
        templates = parts.reduce<string[]>((acc, alts) => acc.flatMap((p) => alts.map((a) => p + "/" + a)), [""]);
      }
      if (!templates.length || templates.some((t) => t === "" || t === "/")) { unparsed.push({ file, line: idx + 1, text: raw.trim() }); return; }
      for (const t of templates) for (const method of methods) routes.push({ method, template: t, file, line: idx + 1 });
    });
  }
  return { routes, mutatingLines, unparsed };
}

// ---------- seeded PRNG (mulberry32): the seed is printed so a failure replays ----------
export function prng(seed: number) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n: number) => Math.floor(next() * n), pick: <T,>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)] };
}

export const CAP = 64 * 1024;
export const CANARY = ["sk", "live", "FUZZCANARY0123456789abcdefABCDEF"].join("_");   // built at runtime so no secret-shaped literal sits in the repo (GitHub push protection)   // secret-shaped, synthetic, must never be echoed
export const CANARY2 = ["whsec", "FUZZCANARY9876543210zyxwvu"].join("_");

// ---------- body generators ----------
export interface BodyCase { label: string; raw: string | Uint8Array | undefined }
const pad = (n: number, ch = "a") => ch.repeat(n);
export function structuralBodies(): BodyCase[] {
  const wrap = (len: number) => { const pre = '{"a":"', post = '"}'; return pre + pad(len - pre.length - post.length) + post; };
  return [
    { label: "no body", raw: undefined },
    { label: "empty string", raw: "" },
    { label: "whitespace", raw: "  \n\t " },
    { label: "null", raw: "null" },
    { label: "true", raw: "true" },
    { label: "number", raw: "123" },
    { label: "string", raw: '"hello"' },
    { label: "array", raw: "[]" },
    { label: "array of objects", raw: '[{"a":1},{"b":2}]' },
    { label: "empty object", raw: "{}" },
    { label: "truncated json", raw: '{"email":"a@b.co' },
    { label: "trailing comma", raw: '{"a":1,}' },
    { label: "single quotes", raw: "{'a':1}" },
    { label: "NaN literal", raw: '{"a":NaN}' },
    { label: "BOM prefix", raw: '﻿{"a":1}' },
    { label: "invalid utf8 bytes", raw: new Uint8Array([0x7b, 0x22, 0xff, 0xfe, 0xc3, 0x28, 0x22, 0x3a, 0x31, 0x7d]) },
    { label: "NUL bytes", raw: "{\u0000}" },
    { label: "html", raw: "<html><script>alert(1)</script></html>" },
    { label: "form encoded", raw: "email=a%40b.co&x=1" },
    { label: "body exactly at cap (65536 chars)", raw: wrap(CAP) },
    { label: "body one under cap", raw: wrap(CAP - 1) },
    { label: "body one over cap (65537 chars)", raw: wrap(CAP + 1) },
    { label: "body 1MB", raw: wrap(1_048_576) },
    { label: "deep array nesting 4000", raw: "[".repeat(4000) + "]".repeat(4000) },
    { label: "deep object nesting 2000", raw: '{"a":'.repeat(2000) + "1" + "}".repeat(2000) },
    { label: "duplicate keys last wins", raw: '{"email":"a@b.co","email":null,"product":1,"product":"x"}' },
    { label: "__proto__ pollution", raw: '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}' },
    { label: "huge exponent", raw: '{"n":1e999,"m":-1e999}' },
    { label: "canary in unknown field", raw: JSON.stringify({ zzz: CANARY, token: CANARY, secret: CANARY2 }) },
  ];
}
const WEIRD_STRINGS = [
  "", " ", pad(300), pad(5000), pad(CAP - 40), "é".repeat(200), "𝕏😀".repeat(500), "\u0000", "a\u0000b", "\u001b[31mred\u001b[0m", "\r\nX-Injected: 1", "‮gnp.exe", "​‌‍",
  "../../etc/passwd", "..%2f..%2fetc", "<script>alert(1)</script>", "'; DROP TABLE accounts;--", "${7*7}{{7*7}}", "__proto__", "constructor", "0", "-1", "NaN", "Infinity", "null", "undefined",
  "a@b", "@", "a@b.c", "x".repeat(300) + "@example.com", "ll_", "ll_" + "0".repeat(48), "ss_nothex", "tk_" + "0".repeat(48), "https://evil.test/", "javascript:alert(1)", CANARY, CANARY2,
];
const WEIRD_VALUES: unknown[] = [null, true, false, 0, -1, 1.5, 2 ** 53, [], [null], {}, { a: 1 }, ["a"], [[[]]], [{}], 12345678901234567890];
// field names are scraped from the source so a new field joins the fuzz without a hand edit
export function fieldNames(): string[] {
  const out = new Set<string>(["email", "token", "domain", "product", "scopes", "check", "purchaseId", "pack", "confirm", "note", "reason", "outcome", "enabled", "role", "receipt", "id", "name"]);
  for (const f of ["index.ts", "service.ts", "enterprise/routes.ts", "enterprise/service.ts", "market/service.ts", "owner/service.ts", "agent/mcp.ts", "agent/credits.ts"]) {
    const s = readFileSync(join(SRC, f), "utf8");
    for (const m of s.matchAll(/\b(?:b|body|input|msg|params|args)\??\.([a-zA-Z_]\w{1,24})\b/g)) out.add(m[1]);
    for (const m of s.matchAll(/\(await body\(req\)\)\.(\w+)/g)) out.add(m[1]);
    for (const m of s.matchAll(/\bb: \{([^}]+)\}/g)) for (const k of m[1].matchAll(/(\w+)\??:/g)) out.add(k[1]);
  }
  for (const bad of ["length", "then", "map", "push", "constructor", "toString", "prototype", "status", "ok"]) out.delete(bad);
  return [...out].sort();
}
export function fieldBodies(r: ReturnType<typeof prng>, fields: string[], n: number): BodyCase[] {
  const out: BodyCase[] = [];
  for (let i = 0; i < n; i++) {
    const kind = r.int(4);
    if (kind === 0) { const f = r.pick(fields), v = r.pick(WEIRD_VALUES); out.push({ label: `field ${f}=${JSON.stringify(v)}`, raw: JSON.stringify({ [f]: v }) }); }
    else if (kind === 1) { const f = r.pick(fields), v = r.pick(WEIRD_STRINGS); out.push({ label: `field ${f}=str(${v.length}) ${JSON.stringify(v.slice(0, 20))}`, raw: JSON.stringify({ [f]: v }) }); }
    else if (kind === 2) { const f = r.pick(fields), v = r.pick(WEIRD_STRINGS), w = r.pick(WEIRD_VALUES); out.push({ label: `duplicate ${f}`, raw: `{${JSON.stringify(f)}:${JSON.stringify(v)},${JSON.stringify(f)}:${JSON.stringify(w)}}` }); }
    else { const o: Record<string, unknown> = {}; for (let k = 0; k < 3 + r.int(4); k++) o[r.pick(fields)] = r.next() < 0.5 ? r.pick(WEIRD_STRINGS) : r.pick(WEIRD_VALUES); out.push({ label: "multi-field " + Object.keys(o).join(","), raw: JSON.stringify(o) }); }
  }
  return out;
}
export const WEIRD_IDS = [pad(3000), "é\u0000", "%00", "..", "%2e%2e", "a b", "𝕏😀", "ten_" + "z".repeat(40), "' OR 1=1", CANARY];

// ---------- state snapshot (deep, order-stable) ----------
export function snapshot(...roots: unknown[]): string {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return typeof v === "function" ? undefined : v;
    if (seen.has(v as object)) return "[cycle]";
    seen.add(v as object);
    if (v instanceof Map) return { __map: [...v.entries()].map(([k, x]) => [walk(k), walk(x)]) };
    if (v instanceof Set) return { __set: [...v.values()].map(walk) };
    if (Array.isArray(v)) return v.map(walk);
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) { const w = walk((v as any)[k]); if (w !== undefined) o[k] = w; }
    return o;
  };
  return JSON.stringify(roots.map(walk));
}

// ---------- the verdict on one response ----------
export interface Observed { status: number | null; ctype: string; text: string; threw?: string; hung?: boolean; stateChanged: boolean; wrongMethod?: boolean; rpc?: boolean }
// f367: JSON-RPC 2.0 requires the response `id` to equal the request id, so POST /mcp (method_not_found, invalid_request) echoes exactly that one member.
// The exemption is deliberately the narrowest possible: a parseable JSON-RPC 2.0 object, the TOP-LEVEL `id` member only, nothing nested, nothing else.
export function stripRpcId(text: string): string {
  try {
    const j = JSON.parse(text);
    if (j && typeof j === "object" && !Array.isArray(j) && j.jsonrpc === "2.0" && "id" in j) { const { id: _id, ...rest } = j; return JSON.stringify(rest); }
  } catch { /* not JSON: nothing exempt, the whole text is checked */ }
  return text;
}
const LEAK_RES: [string, RegExp][] = [
  ["stack frame", /\n?\s+at [\w$.<>\[\] ]+ \(|\bat file:\/\//],
  ["file path", /(?:\/home\/|\/Users\/|\/tmp\/|\/var\/|\/usr\/|node_modules|[A-Za-z]:\\\\)/],
  ["source file ref", /\.(?:ts|js|mjs):\d+/],
  ["error class", /\b(?:TypeError|ReferenceError|RangeError|SyntaxError|AssertionError|Cannot read prop|is not a function|is not iterable|undefined \(reading)\b/],
  ["secret-shaped", /\b(?:sk_(?:live|test)_|rk_(?:live|test)_|whsec_|pk_live_)[A-Za-z0-9]{6,}/],
];
export function judge(o: Observed, sent: { canaries: string[]; secrets: string[] }, strip: (t: string) => string = stripRpcId): string[] {
  const bad: string[] = [];
  if (o.threw) bad.push(`THREW (the worker turns this into a 500): ${o.threw.slice(0, 120)}`);
  if (o.hung) bad.push("HANG (no response in time)");
  if (o.status !== null) {
    if (o.status >= 500) bad.push(`5xx status ${o.status}`);
    if (o.status >= 400) {
      if (!/json/.test(o.ctype)) bad.push(`error not JSON (content-type "${o.ctype}")`);
      else { try { const j = JSON.parse(o.text); if (typeof j?.error !== "string" && typeof j?.error?.message !== "string") bad.push("error JSON has no string error field"); } catch { bad.push("error body is not parseable JSON"); } }
      if (o.stateChanged) bad.push("STATE CHANGED on a rejected request");
    }
    if (o.wrongMethod && !(o.status >= 400 && o.status < 500)) bad.push(`wrong method answered ${o.status}, expected 4xx`);
  }
  for (const [n, re] of LEAK_RES) { if (o.status !== null && o.status >= 400 && re.test(o.text)) bad.push(`LEAK ${n}: ${(o.text.match(re) ?? [""])[0].slice(0, 60)}`); }
  const echoed = o.rpc ? strip(o.text) : o.text;   // only /mcp responses get the JSON-RPC id exemption
  for (const c of [...sent.canaries, ...sent.secrets]) if (c && echoed.includes(c)) bad.push(`ECHO of secret-shaped string ${c.slice(0, 12)}...`);
  return bad;
}
