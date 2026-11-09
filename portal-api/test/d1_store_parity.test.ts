// f345: structural parity. Every method on the Store interface (src/store.ts) must be implemented by D1Store ITSELF (an own prototype method,
// not an inherited one: D1Store extends nothing, so a method it lacks is a method the Worker cannot call). The missing list must be empty.
// Parallel fills that add a Store method without adding the D1 statement fail HERE, naming the method, before a merge hides it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { D1Store } from "../src/d1store.ts";

export const interfaceMethods = (src: string): string[] => {
  const m = /export interface Store \{([\s\S]*?)\n\}/.exec(src);
  if (!m) throw new Error("Store interface not found in src/store.ts");
  const names = [...m[1].split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n").matchAll(/^\s{2}(\w+)\s*\(/gm)].map((x) => x[1]);
  return [...new Set(names)];
};
export const missingOn = (cls: { prototype: object }, methods: string[]): string[] =>
  methods.filter((n) => !Object.prototype.hasOwnProperty.call(cls.prototype, n) || typeof (cls.prototype as Record<string, unknown>)[n] !== "function");

const SRC = readFileSync(fileURLToPath(new URL("../src/store.ts", import.meta.url)), "utf8");

test("the Store interface is parsed (guards the parser: a regex that finds nothing would pass vacuously)", () => {
  const ms = interfaceMethods(SRC);
  assert.ok(ms.length >= 60, `only ${ms.length} methods parsed`);
  for (const must of ["casPurchase", "keysByPrefix", "acquireLease", "anonymiseAccount", "putAccount"]) assert.ok(ms.includes(must), must);
});

test("D1PARITY: D1Store implements every Store method (missing list is empty)", () => {
  const missing = missingOn(D1Store, interfaceMethods(SRC));
  assert.deepEqual(missing, [], `D1Store lacks ${missing.length} Store method(s): ${missing.join(", ")}`);
});

test("the checker bites: a class missing one method and one inherited-only method are both reported", () => {
  const ms = interfaceMethods(SRC);
  class Short { }
  assert.equal(missingOn(Short, ms).length, ms.length);
  const proto: Record<string, unknown> = {}; for (const m of ms) proto[m] = () => 0;
  class Child { } Object.setPrototypeOf(Child.prototype, proto);
  assert.equal(missingOn(Child, ms).length, ms.length, "inherited methods do not count");
  class Full { } for (const m of ms) Object.defineProperty(Full.prototype, m, { value: () => 0, configurable: true });
  assert.deepEqual(missingOn(Full, ms), []);
  delete (Full.prototype as Record<string, unknown>)[ms[3]];
  assert.deepEqual(missingOn(Full, ms), [ms[3]]);
});
