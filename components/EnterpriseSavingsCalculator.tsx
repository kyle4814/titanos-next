"use client";
import { useState } from "react";
import { calculateSavings } from "@/lib/savings-calculator";
import { buildSavingsView } from "@/lib/savings-view";

// Enterprise savings calculator (plan chapter 6, C8). Client-side only: no network, no model call, nothing is sent.
// Output is hours given back to the team on the tasks named. Nobody is replaced.
// The starting values are an EXAMPLE, not a quote and not a claim about your organisation.
const EXAMPLE = { headcount: "20", cost: "75", hours: "4", spend: "30000" };

export default function EnterpriseSavingsCalculator() {
  const [f, setF] = useState(EXAMPLE);
  const set = (k: keyof typeof EXAMPLE) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
  const view = buildSavingsView(
    calculateSavings({
      headcount: num(f.headcount),
      loadedHourlyCostAud: num(f.cost),
      tasks: [{ name: "Repeat tasks", hoursPerWeek: num(f.hours) }],
      currentToolSpendAud: num(f.spend),
    }),
  );
  const field = { display: "flex", flexDirection: "column", gap: 4, minWidth: 180 } as const;
  const input = { minHeight: 44, padding: "0 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "inherit" } as const;
  return (
    <div data-savings-calculator style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0 }}><strong>Example numbers.</strong> The starting values below are an example. Change them to yours. Nothing you type leaves this page.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label style={field}>People on the team
          <input inputMode="numeric" value={f.headcount} onChange={set("headcount")} style={input} />
        </label>
        <label style={field}>Loaded hourly cost (AU$)
          <input inputMode="decimal" value={f.cost} onChange={set("cost")} style={input} />
        </label>
        <label style={field}>Hours a week each person spends on repeat tasks
          <input inputMode="decimal" value={f.hours} onChange={set("hours")} style={input} />
        </label>
        <label style={field}>Current yearly tool spend (AU$)
          <input inputMode="decimal" value={f.spend} onChange={set("spend")} style={input} />
        </label>
      </div>
      <div aria-live="polite" data-savings-output>
        {view.kind === "error" ? (
          <p role="alert" data-savings-error style={{ margin: 0 }}>{view.message}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ margin: 0 }}><strong data-savings-hours>{view.hoursBand}</strong></p>
            <p style={{ margin: 0 }} data-savings-dollars>Worth about {view.dollarsBand} at your loaded hourly cost, from the floor to the ceiling of the band.</p>
            <p style={{ margin: 0 }} data-savings-payback>{view.payback} {view.paybackNote}</p>
            <p style={{ margin: 0 }} data-savings-method><small>Method: {view.method}</small></p>
            {view.notes.length > 0 && (
              <ul data-savings-notes style={{ margin: 0 }}>{view.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            )}
            <p style={{ margin: 0 }}><small>{view.disclaimer}</small></p>
            <p style={{ margin: 0 }}><small>{view.label}</small></p>
          </div>
        )}
      </div>
    </div>
  );
}
