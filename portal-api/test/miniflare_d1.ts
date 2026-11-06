// A D1 binding from a REAL local miniflare (workerd + its D1 implementation), offered through the same shape as FakeD1 (D1Like + log).
// OPTIONAL: miniflare is never a dependency of this package. It is found via MINIFLARE_DIR (a dir holding node_modules/miniflare) or a
// few known local installs; when absent, miniflareAvailable() is false and suites skip. Nothing here touches Cloudflare: workerd runs locally, in memory.
// Isolation: one shared Miniflare, a pool of POOL named D1 databases; each `new MiniflareD1()` takes the next one (round robin) and resets it
// (drops every table, re-applies the real migrations). Construction is synchronous like FakeD1; the reset is awaited lazily before the first call.
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import { MIGRATIONS } from "./fake_d1.ts";
import type { D1Like, D1Statement } from "../src/env.ts";

const POOL = 8;
const MIG_DIR = new URL("../migrations/", import.meta.url);
// MINIFLARE_DIR, when set, is the ONLY place looked in (point it at an empty dir to force the skip path).
const CANDIDATES = () => (process.env.MINIFLARE_DIR ? [process.env.MINIFLARE_DIR] : ["/tmp/f196_scratch", `${homedir()}/mcm-design-v2`]);

export function findMiniflare(): string | undefined {
  for (const d of CANDIDATES()) { try { return createRequire(d + "/").resolve("miniflare"); } catch { /* next */ } }
  return undefined;
}
export const miniflareAvailable = () => findMiniflare() !== undefined;

type Raw = { prepare(sql: string): { bind(...a: unknown[]): any; first(): Promise<any>; all(): Promise<{ results: any[] }>; run(): Promise<{ meta: { changes: number } }> }; batch(s: any[]): Promise<any[]>; exec(sql: string): Promise<unknown> };
let mf: any, dbs: Raw[] = [], next = 0, boot: Promise<void> | undefined;
async function start() {
  const path = findMiniflare(); if (!path) throw new Error("miniflare not found (set MINIFLARE_DIR)");
  const { Miniflare } = await import(pathToFileURL(path).href);
  const names = Array.from({ length: POOL }, (_, i) => `DB${i}`);
  mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok'); } }", d1Databases: Object.fromEntries(names.map((n) => [n, n])) });
  await mf.ready;
  dbs = await Promise.all(names.map((n) => mf.getD1Database(n)));
}
export const startMiniflare = () => (boot ??= start());
export async function stopMiniflare() { if (mf) { await mf.dispose(); mf = undefined; dbs = []; boot = undefined; next = 0; } }

// Migrations hold no string literal containing "--" or ";" (asserted by the suite passing); comments are stripped to end of line.
const stmts = (sql: string) => sql.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n").split(";").map((s) => s.trim()).filter(Boolean);

async function reset(raw: Raw) {
  const objs = (await raw.prepare("SELECT name, type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all()).results;
  let left = objs.filter((o) => o.type === "table").map((o) => o.name as string);
  for (let guard = 0; left.length && guard < 20; guard++) { // children first: a parent with child rows refuses to drop, so retry
    const still: string[] = [];
    for (const t of left) { try { await raw.prepare(`DROP TABLE "${t}"`).run(); } catch { still.push(t); } }
    left = still;
  }
  if (left.length) throw new Error("could not reset tables: " + left.join());
  for (const f of MIGRATIONS) for (const s of stmts(readFileSync(new URL(f, MIG_DIR), "utf8"))) await raw.prepare(s).run();
}

export class MiniflareD1 implements D1Like {
  log: { sql: string; args: unknown[] }[] = [];
  private slot = next++ % POOL;
  private ready: Promise<Raw>;
  constructor() {
    // Reset waits behind any earlier reset of the same slot via the shared boot promise; the suites run one test at a time per file.
    this.ready = startMiniflare().then(async () => { const raw = dbs[this.slot]; await reset(raw); return raw; });
  }
  prepare(sql: string): D1Statement {
    const self = this; let args: unknown[] = [];
    const st = {
      sql,
      get args() { return args; },
      bind(...a: unknown[]) { args = a.map((x) => (x === undefined ? null : x)); return st; },
      async first<T>() { const r = await self.ready; self.log.push({ sql, args }); return ((await r.prepare(sql).bind(...args).first()) as T | null) ?? null; },
      async all<T>() { const r = await self.ready; self.log.push({ sql, args }); return { results: (await r.prepare(sql).bind(...args).all()).results as T[] }; },
      async run() { const r = await self.ready; self.log.push({ sql, args }); const x = await r.prepare(sql).bind(...args).run(); return { meta: { changes: Number(x.meta.changes) } }; },
    };
    return st as unknown as D1Statement;
  }
  async batch(stmts: D1Statement[]) {
    const r = await this.ready; const ss = stmts as unknown as { sql: string; args: unknown[] }[];
    ss.forEach((s) => this.log.push({ sql: s.sql, args: s.args }));
    return (await r.batch(ss.map((s) => r.prepare(s.sql).bind(...s.args)))).map((x) => ({ meta: { changes: Number(x.meta.changes) } }));
  }
}
