// Test-only fake D1 over node:sqlite (real SQLite, real CHECK and FK enforcement). SYNTHETIC. Applies the migrations in order.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "../src/enterprise/store_d1.ts";

export function applyMigrations(db: DatabaseSync, files: string[]) {
  for (const f of files) db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), "utf8"));
}
export class FakeD1 implements D1Like {
  sql: DatabaseSync; log: string[] = [];
  constructor(files = ["0001_portal_core.sql", "0002_portal_billing.sql", "0003_enterprise.sql", "0004_payouts_lifecycle.sql"]) {
    this.sql = new DatabaseSync(":memory:"); this.sql.exec("PRAGMA foreign_keys = ON");
    applyMigrations(this.sql, files);
  }
  prepare(q: string): D1Stmt {
    const self = this; let params: unknown[] = [];
    const stmt: D1Stmt = {
      bind(...v) { params = v; return stmt; },
      async run() { self.log.push(q); const r = self.sql.prepare(q).run(...(params as any[])); return { meta: { changes: Number(r.changes) } }; },
      async first<T>() { self.log.push(q); return ((self.sql.prepare(q).get(...(params as any[])) as T | undefined) ?? null); },
      async all<T>() { self.log.push(q); return { results: self.sql.prepare(q).all(...(params as any[])) as T[] }; },
    };
    return stmt;
  }
}
