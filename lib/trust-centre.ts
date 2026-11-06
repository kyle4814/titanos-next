import data from "./trust-centre.json";

export type TrustState = "BUILT_TESTED" | "PLANNED" | "OPEN";
export type TrustEvidence =
  | { kind: "file"; path: string; anchor: string; detail: string }
  | { kind: "external"; ref: string; detail: string };
export type TrustClaim = { id: string; claim: string; state: TrustState; evidence: TrustEvidence };

export const TRUST_AS_OF: string = data.asOf;
export const OSG1_LINE: string = data.osg1.line;
export const STATE_MEANING = data.states as Record<TrustState, string>;
export const TRUST_CLAIMS = data.claims as TrustClaim[];
