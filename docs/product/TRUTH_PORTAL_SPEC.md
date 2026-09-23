# Truth Portal — Product Specification

## Mission

Build a public-facing verification portal where a person can paste a claim, answer, document excerpt, URL, AI output, or other information and receive an evidence-first assessment.

The product must not pretend to know what cannot be established. Its core output is a structured epistemic state:

- VERIFIED — supported by sufficient primary/independent evidence for the exact claim and scope.
- SUPPORTED — credible evidence exists, but verification is incomplete or indirect.
- CONTRADICTED — reliable evidence conflicts with the claim.
- UNKNOWN — insufficient evidence to establish truth or falsity.
- UNVERIFIABLE — the claim is not presently testable with accessible evidence.
- CONTEXT-DEPENDENT — truth depends on time, jurisdiction, definitions, assumptions, or scenario.
- AI-GENERATED / UNATTRIBUTED — provenance is missing or the content is synthetic; this is a provenance state, not a truth judgment.

## Core user flow

1. User pastes information into the portal.
2. System decomposes it into atomic claims.
3. System identifies required evidence and hidden assumptions.
4. System searches/retrieves relevant sources.
5. Sources are classified by provenance, date, independence and authority.
6. Claims are compared against evidence.
7. System produces a result with confidence in the evidence state, not a fabricated probability of truth.
8. Every conclusion links back to the evidence used.
9. Conflicts and unknowns remain visible.
10. System records a verification receipt so the result can be re-checked later.

## Anti-hallucination contract

The system must:

- separate claim, source, inference, and conclusion;
- never cite a source that was not actually retrieved;
- never invent quotations, statistics, dates, URLs or entities;
- distinguish source text from model interpretation;
- preserve contradictory evidence;
- timestamp volatile claims;
- show when evidence is stale;
- disclose when a result is based on model inference;
- prefer primary sources where available;
- use multiple independent sources for consequential claims when practical;
- return UNKNOWN instead of forcing a binary answer.

## Simulations within simulations

The product explicitly models scenario layers:

- Reality layer — observable events/data.
- Source layer — what a source claims.
- Model layer — what an AI system infers from those sources.
- Simulation layer — hypothetical scenarios generated from assumptions.
- User-belief layer — what the user currently believes or asks.
- Meta layer — whether a statement is about the underlying world, a model, a simulation, or another claim.

Every claim carries a layer and epistemic status so a statement such as "the simulation predicts X" cannot accidentally become "X is true."

## Proposed claim object

~~~text
type Claim = {
  id: string
  text: string
  layer: "reality" | "source" | "model" | "simulation" | "belief" | "meta"
  status:
    | "verified"
    | "supported"
    | "contradicted"
    | "unknown"
    | "unverifiable"
    | "context-dependent"
    | "ai-generated"
  scope?: string
  timeContext?: string
  jurisdiction?: string
  assumptions: string[]
  evidenceIds: string[]
  counterEvidenceIds: string[]
  lastCheckedAt?: string
}
~~~

## MVP

### Portal
- Paste box.
- Optional URL/document input.
- Verify action.
- Claim cards with status.
- Evidence panel.
- Contradictions panel.
- Assumptions panel.
- What would change this result? section.
- Shareable verification receipt.

### Backend
- Claim extraction.
- Retrieval pipeline.
- Source normalization.
- Evidence grading.
- Claim/evidence graph.
- Deterministic receipt generation.
- Re-check scheduling.

### Later
- Browser extension.
- API.
- AI-output checker.
- Organisation verification workspaces.
- Research mode.
- Team evidence rooms.
- Longitudinal claim monitoring.
- Investor-grade evidence exports.

## Product principle

**The product is not a machine that says TRUE. It is a machine that makes the evidence boundary visible.**
