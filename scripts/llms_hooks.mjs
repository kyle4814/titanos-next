// llms_hooks.mjs - resolve hook for test_llms_visibility: the "@/" alias (shared with alias_hooks.mjs) plus extensionless
// relative imports inside lib/, which Next resolves but raw Node does not.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { resolve as aliasResolve } from "./alias_hooks.mjs";

const isFile = (p) => existsSync(p) && statSync(p).isFile();
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:") && !path.extname(specifier)) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    for (const c of [".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"].map((e) => base + e)) {
      if (isFile(c)) return nextResolve(pathToFileURL(c).href, context);
    }
  }
  return aliasResolve(specifier, context, nextResolve);
}

// Next imports JSON without an attribute; Node needs one. Serve .json as a JSON module.
export async function load(url, context, nextLoad) {
  if (url.endsWith(".json") && !context.importAttributes?.type) return nextLoad(url, { ...context, importAttributes: { type: "json" } });
  return nextLoad(url, context);
}
