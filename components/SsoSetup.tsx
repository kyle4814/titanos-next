import { SSO_STEPS, SSO_CHECKS, SSO_SYNTHETIC_CONFIG, SSO_STATE_NOTE } from "@/lib/ssoSetup";

// Server component for /enterprise#sso. Static: no state, no fetch, no model call, no credential.
export default function SsoSetup() {
  const mono = { fontFamily: "var(--font-mono, monospace)", fontSize: 14, overflowX: "auto", margin: 0 } as const;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-sso-setup="">
      <p style={{ margin: 0 }}>{SSO_STATE_NOTE}</p>
      <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
        {SSO_STEPS.map((s) => (
          <li key={s.n}><strong>{s.title}.</strong> {s.text}</li>
        ))}
      </ol>
      <h3 style={{ margin: 0 }}>What the sign-in check covers</h3>
      <ul style={{ margin: 0, paddingLeft: 20 }}>{SSO_CHECKS.map((c) => <li key={c}>{c}</li>)}</ul>
      <h3 style={{ margin: 0 }}>Example settings</h3>
      <p style={{ margin: 0 }}><small>Synthetic example, not a live tenant. The address is reserved and cannot resolve.</small></p>
      <pre style={mono} aria-label="Synthetic example SSO settings">{JSON.stringify(SSO_SYNTHETIC_CONFIG, null, 2)}</pre>
    </div>
  );
}
