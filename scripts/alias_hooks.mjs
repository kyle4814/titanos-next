// alias_hooks.mjs - module resolve hook: tsconfig paths "@/*" -> "./*", dependency-free.
// Loaded by scripts/alias_loader.mjs through node:module register(). Runs in the loader worker thread.
// Candidate order for "@/x": x, x.ts, x.tsx, x.mjs, x.js, x/index.ts, x/index.tsx, x/index.mjs, x/index.js.
// An "@/..." specifier that matches no candidate THROWS (ERR_ALIAS_UNRESOLVED); it never falls through silently.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// ALIAS_LOADER_ROOT overrides the alias target (used only by the mutation test to break the map).
const ROOT = process.env.ALIAS_LOADER_ROOT ? path.resolve(process.env.ALIAS_LOADER_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXT = ["", ".ts", ".tsx", ".mjs", ".js"];
const INDEX = ["index.ts", "index.tsx", "index.mjs", "index.js"];
const isFile = (p) => existsSync(p) && statSync(p).isFile();

export function candidates(rest) {
  const base = path.join(ROOT, rest);
  return [...EXT.map((e) => base + e), ...INDEX.map((i) => path.join(base, i))];
}

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
  const rest = specifier.slice(2);
  if (!rest || rest.split("/").includes("..")) {
    const e = new Error(`alias_loader: refusing alias specifier "${specifier}"`); e.code = "ERR_ALIAS_UNRESOLVED"; throw e;
  }
  for (const c of candidates(rest)) {
    if (isFile(c)) return nextResolve(pathToFileURL(c).href, context);
  }
  const e = new Error(`alias_loader: cannot resolve "${specifier}" (alias @/* -> ${ROOT}/*; tried ${candidates(rest).length} candidates)`);
  e.code = "ERR_ALIAS_UNRESOLVED"; throw e;
}
