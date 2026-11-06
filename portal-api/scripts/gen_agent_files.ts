// Writes the site-side copies of the agent door description. Run: node --experimental-strip-types scripts/gen_agent_files.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { agentCard, toolsJson } from "../src/agent/files.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
mkdirSync(join(root, "public", ".well-known"), { recursive: true });
writeFileSync(join(root, "public", ".well-known", "agent.json"), JSON.stringify(agentCard(), null, 2) + "\n");
writeFileSync(join(root, "lib", "agentTools.generated.json"), JSON.stringify(toolsJson(), null, 2) + "\n");
console.log("agent files written");
