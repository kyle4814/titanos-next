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

// Interleaving source: Math.random by default; a suite may swap in a seeded generator (setFakeD1Rand) so a race schedule is replayable.
let rand: () => number = Math.random;
export const setFakeD1Rand = (f: (() => number) | undefined) => { rand = f ?? Math.random; };
const tick = async () => { for (let i = Math.floor(rand() * 3); i >= 0; i--) await new Promise((r) => setImmediate(r)); };

export class FakeD1 implements D1Like {
  db = new DatabaseSync(":memory:");
  log: { sql: string; args: unknown[] }[] = [];
  constructor(o: { fk?: boolean } = {}) {
    this.db.exec(`PRAGMA foreign_keys = ${o.fk === false ? "OFF" : "ON"}`);
    for (const f of MIGRATIONS) this.db.exec(readFileSync(dir + f, "utf8"));
  }
  prepare(sql: string): D1Statement {
    const self = this;
    let args: unknown[] = [];
    const st = {
      sql,
      get args() { return args; },
      bind(...a: unknown[]) { args = a.map((x) => (x === undefined ? null : x)); return st; },
      async first<T>() { await tick(); self.log.push({ sql, args }); return (self.db.prepare(sql).get(...(args as never[])) as T | undefined) ?? null; },
      async all<T>() { await tick(); self.log.push({ sql, args }); return { results: self.db.prepare(sql).all(...(args as never[])) as T[] }; },
      async run() { await tick(); self.log.push({ sql, args }); const r = self.db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } }; },
    };
    return st as unknown as D1Statement;
  }
  async batch(stmts: D1Statement[]) {
    await tick();
    this.db.exec("BEGIN");
    try {
      const out: unknown[] = [];
      for (const s of stmts as unknown as { sql: string; args: unknown[] }[]) { const r = this.db.prepare(s.sql).run(...(s.args as never[])); out.push({ meta: { changes: Number(r.changes) } }); this.log.push({ sql: s.sql, args: s.args }); }
      this.db.exec("COMMIT");
      return out;
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
}
