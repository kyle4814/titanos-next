// alias_loader.mjs - use as: node --import ./scripts/alias_loader.mjs --experimental-strip-types <test>
// Registers scripts/alias_hooks.mjs so a test can import TypeScript files that use the tsconfig alias "@/*".
import { register } from "node:module";
register("./alias_hooks.mjs", import.meta.url);
