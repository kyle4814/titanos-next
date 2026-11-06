// A local D1 stand-in backed by node:sqlite (real SQLite, the engine D1 runs). Applies EVERY real migration file in migrations/
// in order, foreign keys ON. SYNTHETIC: in-memory only, nothing live. Async on purpose: each call yields 1..3 event-loop ticks
// (random) before it runs, so interleavings between concurrent callers really happen. A read-then-write adapter loses races
// here; a single-statement one cannot. (Same shape as the f13 FakeD1; this branch is based on f204, which predates it.)
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { D1Like, D1Statement } from "../src/env.ts";

const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
export const MIGRATIONS = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const tick = async () => { for (let i = Math.floor(Math.random() * 3); i >= 0; i--) await new Promise((r) => setImmediate(r)); };

export class FakeD1 implements D1Like {
  db = new DatabaseSync(":memory:");
  log: { sql: string; args: unknown[] }[] = [];
  constructor() {
    this.db.exec("PRAGMA foreign_keys = ON");
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
}
