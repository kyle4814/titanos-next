// A local D1 stand-in backed by node:sqlite (real SQLite, the same engine D1 runs). It applies the REAL migration files
// every file in migrations/ from migrations/, with foreign keys ON, so the adapter is exercised against the production schema.
// Async on purpose: every call yields to the event loop first (random 0..2 ticks) so that interleavings between
// concurrent callers actually happen. A read-then-write adapter loses races here; a single-statement one cannot.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { D1Like, D1Statement } from "../src/env.ts";

const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
export const MIGRATIONS = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();

export type Rng = () => number;
// Seeded schedule (f175): mulberry32. Same seed = same sequence of yields, so an interleaving can be replayed.
export const seeded = (seed: number): Rng => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
// Interleaving source: Math.random by default; a suite may swap in a seeded generator (setFakeD1Rand) so a race schedule is replayable.
let rand: () => number = Math.random;
export const setFakeD1Rand = (f: (() => number) | undefined) => { rand = f ?? Math.random; };

export class FakeD1 implements D1Like {
  db = new DatabaseSync(":memory:");
  log: { sql: string; args: unknown[] }[] = [];
  rng: Rng;
  constructor(rng: Rng = () => rand()) {
    this.rng = rng;
    this.db.exec("PRAGMA foreign_keys = ON");
    for (const f of MIGRATIONS) this.db.exec(readFileSync(dir + f, "utf8"));
  }
  async tick() { for (let i = Math.floor(this.rng() * 4); i >= 0; i--) await new Promise((r) => setImmediate(r)); }
  prepare(sql: string): D1Statement {
    const self = this;
    let args: unknown[] = [];
    const st = {
      sql,
      get args() { return args; },
      bind(...a: unknown[]) { args = a.map((x) => (x === undefined ? null : x)); return st; },
      async first<T>() { await self.tick(); self.log.push({ sql, args }); return (self.db.prepare(sql).get(...(args as never[])) as T | undefined) ?? null; },
      async all<T>() { await self.tick(); self.log.push({ sql, args }); return { results: self.db.prepare(sql).all(...(args as never[])) as T[] }; },
      async run() { await self.tick(); self.log.push({ sql, args }); const r = self.db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } }; },
    };
    return st as unknown as D1Statement;
  }
  async batch(stmts: D1Statement[]) {
    await this.tick();
    this.db.exec("BEGIN");
    try {
      const out: unknown[] = [];
      for (const s of stmts as unknown as { sql: string; args: unknown[] }[]) { const r = this.db.prepare(s.sql).run(...(s.args as never[])); out.push({ meta: { changes: Number(r.changes) } }); this.log.push({ sql: s.sql, args: s.args }); }
      this.db.exec("COMMIT");
      return out;
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
}
