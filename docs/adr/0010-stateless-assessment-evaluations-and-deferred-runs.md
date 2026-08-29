---
status: accepted
---

# Stateless Assessment Evaluations and deferred durable runs

Allergen assessments and other safety guidance in the MVP are performed as stateless Assessment Evaluations computed per Package Match request from readable label evidence and an Active Reference Dataset Version, with optional non-durable caching (such as cache-aside in Redis). Durable database `AssessmentRun` persistence and evaluation history tables are deferred until post-MVP or when catalog moderation workflows require them.

This decision maintains strict privacy and architectural simplicity:

1. No shopper identity, dietary preference, scan session, run identifier, or evaluation fingerprint is persisted in the database or exposed in the API contract.
2. The `allergen_assessment` contract is always returned on every candidate. Availability is explicit: `COMPLETED` has a null reason, while `NOT_ASSESSED` reports `FEATURE_DISABLED`, `REFERENCE_UNAVAILABLE`, `EVIDENCE_UNAVAILABLE`, or `ASSESSMENT_FAILED`; Evidence-derived outcomes remain per concept.
3. The evaluation never declares a product safe or allergen-free; absence of evidence is explicitly distinguished from complete readable evidence.
4. Caching is an optional, non-durable performance optimization whose keys include the dataset versions and evidence digest, but no user or session data.
5. Assessment failures are isolated from Package Match availability. Missing or invalid reference releases and evaluation failures remain HTTP 200 candidate responses; Active OFF Dataset Version failures retain the Package Match source-unavailable behavior.
