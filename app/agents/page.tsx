import type { Metadata } from "next";
import SeatAnchors from "@/components/SeatAnchors";
import { ANCHORS } from "./anchors";
import tools from "@/lib/agentTools.generated.json";

// Preview page for the agent door (C7). noindex until the API is deployed and a real agent has been issued a receipt.
export const metadata: Metadata = {
  title: "Agent door: tools, keys and credits | TITANOS",
  description: "The tool catalogue, scoped API keys, metered credits and agent card for software that calls TITANOS. Preview: built and tested locally.",
  alternates: { canonical: "https://titanos.tech/agents" },
  robots: { index: false, follow: true },
};

export default function AgentsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-24">
      <h1 className="text-4xl font-semibold">The agent door</h1>
      <p className="mt-4 text-lg">
        Software can call TITANOS the way a person would use the site: passive checks on public records, a priced catalogue and a receipt for every call.
        Status: <strong>preview</strong>. The tools below are built and tested locally with synthetic data. The live endpoint is not deployed yet, so no key can be issued today.
      </p>
      <h2 className="mt-12 text-2xl font-semibold">How it works</h2>
      <ul className="mt-4 list-disc space-y-2 pl-6">
        <li>MCP over HTTP at <code>https://api.titanos.tech/mcp</code> once deployed. Describe it with the agent card at <code>/.well-known/agent.json</code>.</li>
        <li>Scoped API keys: you create a key in your account, choose its scopes, and it is shown once. We store only a hash.</li>
        <li>Metered credits: 1 credit = AU$0.01 (example rate). The one model-backed tool runs on your own model key (sent per call, never stored) or on credits you have prepaid. We never run a paid model call on credit we have not been paid for.</li>
        <li>Receipts: every call returns an id, the tool, a hash of the input and output, the credits used and a signature you can check. A failed call is not charged.</li>
        <li>Passive only: public DNS records, nothing is probed or touched.</li>
      </ul>
      <h2 className="mt-12 text-2xl font-semibold">Tool catalogue</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr><th className="py-2 pr-4">Tool</th><th className="py-2 pr-4">What it does</th><th className="py-2 pr-4">Scope</th><th className="py-2">Credits per call</th></tr></thead>
          <tbody>
            {tools.tools.map((t) => (
              <tr key={t.name} className="border-t border-white/10 align-top">
                <td className="py-2 pr-4"><code>{t.name}</code></td><td className="py-2 pr-4">{t.description}</td><td className="py-2 pr-4"><code>{t.scope}</code></td><td className="py-2">{t.credits}{t.modelBacked ? " (or 0 with your own key)" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SeatAnchors rows={ANCHORS} />
    </main>
  );
}
