// COPIED from web/f58_c7_agent_d1store-2026-11-06 portal-api/test/fake_d1.ts (itself copied from web/f13_c2_d1store-2026-11-06 f279973b6; both unmerged).
// The same in-memory D1 fake pattern: node:sqlite (real SQLite, D1's engine), async with random yields so concurrent callers interleave.
// TWO CHANGES vs f58: (1) the constructor takes the migration files to apply (this repo has no portal-api/migrations dir; the draft lives in
// lib/concierge/migrations/), (2) D1Like/D1Statement types are the structural twins in lib/concierge/d1log.ts. When the portal-api branches merge,
// delete this copy and import theirs.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { D1Db as D1Like, D1Stmt as D1Statement } from "../lib/concierge/d1log.ts";

export const DRAFT_MIGRATION = fileURLToPath(new URL("../lib/concierge/migrations/DRAFT_unmatched_asks.sql", import.meta.url));

const tick = async () => { for (let i = Math.floor(Math.random() * 3); i >= 0; i--) await new Promise((r) => setImmediate(r)); };

export class FakeD1 implements D1Like {
  db = new DatabaseSync(":memory:");
  log: { sql: string; args: unknown[] }[] = [];
  constructor(migrations: string[] = [DRAFT_MIGRATION]) {
    this.db.exec("PRAGMA foreign_keys = ON");
    for (const f of migrations) this.db.exec(readFileSync(f, "utf8"));
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
