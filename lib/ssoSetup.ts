// SSO setup steps for /enterprise#sso (plan chapter 6, C8, line 1496).
// The shape mirrors the config the OIDC engine consumes: portal-api/src/enterprise/types.ts SsoConfig and
// oidc.ts OidcExpect. Every value in SYNTHETIC_CONFIG is invented and labelled; no identity provider is contacted
// and no credential exists here. scripts/test_sso_section.mjs fails if a field name drifts from the engine.
export const SSO_CONFIG_FIELDS = ["issuer", "clientId", "allowedDomains", "defaultRole"] as const;
export type SsoConfigField = (typeof SSO_CONFIG_FIELDS)[number];

// The client secret is deliberately not a displayed field: it is sealed at rest (seal.ts) and never shown back.
export const SSO_SYNTHETIC_CONFIG: Record<SsoConfigField, string> = {
  issuer: "https://idp.example.invalid/tenant-demo",
  clientId: "synthetic-client-id",
  allowedDomains: "example.invalid",
  defaultRole: "viewer",
};

export type SsoStep = { n: number; title: string; field: SsoConfigField | null; text: string };

export const SSO_STEPS: SsoStep[] = [
  { n: 1, title: "Register the portal at your identity provider", field: null,
    text: "Create an OpenID Connect application for your group. Your provider gives you an issuer address and a client identifier. Nothing is sent to us at this step." },
  { n: 2, title: "Give us the issuer", field: "issuer",
    text: "The issuer must match the iss claim in every token exactly. Tokens from any other issuer are refused." },
  { n: 3, title: "Give us the client identifier", field: "clientId",
    text: "Tokens must be issued for this client. A token minted for a different application is refused, including when it lists several audiences." },
  { n: 4, title: "List the email domains you own", field: "allowedDomains",
    text: "Only people whose verified email sits on one of these domains can sign in. Your group stays in charge of who is on the list." },
  { n: 5, title: "Pick the default role", field: "defaultRole",
    text: "New sign-ins get viewer or analyst. Admin is never granted by single sign-on; an existing admin grants it by hand." },
  { n: 6, title: "Test a sign-in", field: null,
    text: "A test sign-in runs every check below. The client secret, where your provider uses one, is sealed with authenticated encryption and bound to your tenant, so a copy cannot be replayed under another tenant." },
];

export const SSO_CHECKS: string[] = [
  "Signature algorithm pinned to RS256 before any key is looked up; none, shared-secret and elliptic-curve tokens are refused",
  "Signing key chosen by key identifier from your provider's published key set; weak keys are ignored",
  "One refetch of the key set on an unknown key identifier, rate limited, so a rotation works and junk cannot hammer your provider",
  "Issuer, audience, expiry, not-before and issued-at checked with a small clock allowance",
  "Nonce matched to the sign-in that started it",
  "Email must be marked verified by your provider",
];

export const SSO_STATE_NOTE =
  "Built and tested against generated keys. No live identity provider is connected yet and SAML is not built; connecting your provider is arranged on a call.";
