import Link from "next/link";
import { upgradeOptions, type DockInput } from "@/lib/upgrade-dock";

// Renders the output of lib/upgrade-dock.ts. Server component: no state, no fetch, no model call, no billing call.
// Until accounts are live the page passes a labelled synthetic example; a real account passes its own numbers.
export default function UpgradeDock({ input, example }: { input: DockInput; example?: boolean }) {
  const options = upgradeOptions(input);
  return (
    <div data-upgrade-dock style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {example ? <small data-dock-example>Example account with made-up numbers, so you can see how the dock reads. Your own options appear here once your key is live.</small> : null}
      {options.length === 0 ? <p style={{ margin: 0 }}>Nothing to upgrade. You are on the top tier and your credits and scopes cover the last 30 days.</p> : (
        <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {options.map((o) => (
            <li key={o.id} data-dock-option={o.kind}>
              <strong>{o.title}</strong>{o.priceAud ? <> <span data-dock-price>{o.priceAud}</span></> : <> <span data-dock-price>No charge</span></>}
              <p style={{ margin: "4px 0" }}>{o.reason}</p>
              <small>{o.reversible ? "You can undo this later." : "Not refundable once bought."} </small>
              {o.action.kind === "link" && o.action.href
                ? <Link href={o.action.href} style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>See the plan</Link>
                : <small data-dock-coming>Coming, not built yet</small>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
