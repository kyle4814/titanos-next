// Machine-readable descriptions of the agent door, all generated from the ONE tool list (tools.ts).
// scripts/gen_agent_files.ts writes them into the site (public/.well-known/agent.json, lib/agentTools.generated.json);
// a test fails if the committed copies drift from this output.
import { TOOLS, publicTool } from "./tools.ts";

export const MCP_URL = "https://api.titanos.tech/mcp";
export function agentCard(siteOrigin = "https://titanos.tech", apiOrigin = "https://api.titanos.tech") {
  return {
    name: "TITANOS",
    description: "Passive, public-record email-security checks and a priced catalogue for small businesses, callable by software. Every call returns a signed receipt.",
    url: siteOrigin,
    status: "preview",
    statusNote: "Built and tested locally with synthetic data. The MCP endpoint is not deployed yet, so no live key can be issued today.",
    provider: { organization: "TITANOS", url: siteOrigin },
    documentationUrl: `${siteOrigin}/agents`,
    protocols: [{ type: "mcp", transport: "streamable-http-post", protocolVersion: "2025-03-26", url: `${apiOrigin}/mcp` }],
    authentication: { schemes: ["bearer"], description: "Create a scoped API key in your TITANOS account. Send it as Authorization: Bearer tk_... Keys are shown once and stored only as a hash.", header: "Authorization" },
    billing: {
      model: "metered credits",
      unit: "1 credit = AU$0.01 (example rate)",
      byok: "Model-backed tools accept your own model key in the x-model-key header (never stored, never logged) and then cost 0 credits.",
      prepaid: "Otherwise a call debits prepaid credits. TITANOS never runs a paid model call on credit it has not been paid for.",
    },
    guarantees: ["Passive public DNS only; no active scanning of any domain.", "Zero model calls except explain_finding.", "Each call returns a receipt (id, tool, input hash, output hash, credits, HMAC signature) you can verify.", "A failed call is not charged."],
    tools: TOOLS.map(publicTool),
    updatedFor: "2026-11-06",
  };
}
export function toolsJson() {
  return { generatedFrom: "portal-api/src/agent/tools.ts", tools: TOOLS.map(publicTool) };
}
