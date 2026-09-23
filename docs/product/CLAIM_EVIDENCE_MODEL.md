# Claim / Evidence Model

## Purpose

Define the common data model for Truth Portal, TitanOS receipts, opportunity intelligence and the investor data room.

## Fundamental separation

A claim is not an evidence item.

An evidence item is not a conclusion.

A model inference is not a fact.

A simulation output is not an observation of reality.

## Evidence record

~~~text
type Evidence = {
  id: string
  sourceType:
    | "primary"
    | "secondary"
    | "dataset"
    | "document"
    | "user-provided"
    | "model-output"
  locator: string
  title?: string
  publisher?: string
  publishedAt?: string
  retrievedAt: string
  excerpt?: string
  hash?: string
  independenceGroup?: string
  reliabilityNotes: string[]
}
~~~

## Verification receipt

Every completed verification should be serialisable as:

~~~text
type VerificationReceipt = {
  id: string
  createdAt: string
  inputHash: string
  claims: Claim[]
  evidence: Evidence[]
  methodVersion: string
  unresolvedQuestions: string[]
  limitations: string[]
}
~~~

## Confidence rule

Do not output a fake numerical probability unless a separately validated statistical model justifies it.

Use explicit evidence states first. If a numerical confidence measure is later introduced, it must be clearly labelled as model confidence and must never be presented as the probability that the claim is true.

## Conflict handling

When reliable sources disagree:
1. preserve both;
2. identify the exact proposition each supports;
3. check dates, definitions, jurisdictions and populations;
4. search for primary evidence;
5. report the conflict;
6. use UNKNOWN or CONTEXT-DEPENDENT when the conflict cannot be resolved.

## Security/privacy

User-provided material may contain sensitive information. The MVP should minimise retention, define deletion controls, avoid unnecessary indexing, and clearly distinguish public-source verification from private-document analysis.
