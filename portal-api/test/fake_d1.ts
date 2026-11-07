// A local D1 stand-in on node:sqlite (real SQLite, D1's engine). Applies the REAL migration files from migrations/
// 0001..0003 + 0004_market + 0005_market_d1 (the f13 0004_store_counters is independent and not needed here).
// Async on purpose: every call yields first (random 0..2 ticks) so concurrent callers genuinely interleave.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { D1Like, D1Statement } from "../src/env.ts";

const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
export const MIGRATIONS = readdirSync(dir).filter((f) => /^000[1-5].*\.sql$/.test(f)).sort();
const tick = async () => { for (let i = Math.floor(Math.random() * 3); i >= 0; i--) await new Promise((r) => setImmediate(r)); };

export class FakeD1 implements D1Like {
  db = new DatabaseSync(":memory:");
  log: { sql: string; args: unknown[] }[] = [];
  constructor(o: { fk?: boolean } = {}) {
    this.db.exec(`PRAGMA foreign_keys = ${o.fk === false ? "OFF" : "ON"}`);
    for (const f of MIGRATIONS) this.db.exec(readFileSync(dir + f, "utf8"));
  }
  prepare(sql: string): D1Statement {
    const self = this; let args: unknown[] = [];
    const st = {
      sql, get args() { return args; },
      bind(...a: unknown[]) { args = a.map((x) => (x === undefined ? null : x)); return st; },
      async first<T>() { await tick(); self.log.push({ sql, args }); return (self.db.prepare(sql).get(...(args as never[])) as T | undefined) ?? null; },
      async all<T>() { await tick(); self.log.push({ sql, args }); return { results: self.db.prepare(sql).all(...(args as never[])) as T[] }; },
      async run() { await tick(); self.log.push({ sql, args }); const r = self.db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } }; },
    };
    return st as unknown as D1Statement;
  }
}
