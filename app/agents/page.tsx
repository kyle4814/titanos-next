import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import SeatAnchors from "@/components/SeatAnchors";
import UpgradeDock from "@/components/UpgradeDock";
import { SYNTHETIC_EXAMPLE } from "@/lib/upgrade-dock";
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
    <main>
      <PageHero
        badge="Preview"
        title="The agent door"
        sub="Software can call TITANOS the way a person would use the site: passive checks on public records, a priced catalogue and a receipt for every call. Status: preview. The tools below are built and tested locally with synthetic data. The live endpoint is not deployed yet, so no key can be issued today."
      />
      <div className="pe-page">
        <section className="pe-section" aria-labelledby="agents-how">
          <div className="pe-section__head">
            <h2 id="agents-how">How it works</h2>
            <p>Passive checks, scoped keys, metered credits and a signed receipt for every call.</p>
          </div>
          <div className="pe-card pe-card--pad"><ul className="pe-prose" style={{ maxWidth: "none", margin: 0, listStyle: "disc", display: "grid", gap: 10 }}>
            <li>MCP over HTTP at <code>https://api.titanos.tech/mcp</code> once deployed. Describe it with the agent card at <code>/.well-known/agent.json</code>.</li>
            <li>Scoped API keys: you create a key in your account (on the <a href="/app/keys">API keys page</a>), choose its scopes and spending limit, and it is shown once. We store only a hash.</li>
            <li>Metered credits: 1 credit = AU$0.01 (example rate). The one model-backed tool runs on your own model key (sent per call, never stored) or on credits you have prepaid. We never run a paid model call on credit we have not been paid for.</li>
            <li>Receipts: every call returns an id, the tool, a hash of the input and output, the credits used and a signature you can check. A failed call is not charged.</li>
            <li>Passive only: public DNS records, nothing is probed or touched.</li>
          </ul></div>
        </section>
        <section className="pe-section" aria-labelledby="agents-tools">
          <div className="pe-section__head">
            <h2 id="agents-tools">Tool catalogue</h2>
          </div>
          <div className="pe-table-wrap">
            <table>
              <thead><tr><th>Tool</th><th>What it does</th><th>Scope</th><th>Credits per call</th></tr></thead>
              <tbody>
                {tools.tools.map((t) => (
                  <tr key={t.name}>
                    <td><code>{t.name}</code></td><td>{t.description}</td><td><code>{t.scope}</code></td><td>{t.credits}{t.modelBacked ? " (or 0 with your own key)" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <SeatAnchors rows={ANCHORS} extras={{ "upgrade-dock": <UpgradeDock input={SYNTHETIC_EXAMPLE} example /> }} />
      </div>
    </main>
  );
}
