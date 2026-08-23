---
status: superseded by ADR-0005
---

# ADR 0001: Hybrid Confidence Tiers for Product Ingestion

This Product-level verification-tier decision was superseded after domain modeling showed that identifiers, ingredients, certifications, and other Claims can have different evidence and authority on the same Package Revision. See ADR 0005.

## Context
Packaged food products in Cambodia are predominantly imported from neighboring countries (Thailand, Vietnam, China, etc.) with packaging in foreign languages and high rates of missing barcodes in global open databases. Blocking product display on manual verification would cause high churn when shoppers scan uncatalogued goods in store aisles. Conversely, presenting unverified AI-extracted ingredients as medical-grade truth carries severe health risks (e.g. fatal allergens).

## Decision
We adopt a **three-tier Verification Status** model (`AI_EXTRACTED` -> `COMMUNITY_VERIFIED` -> `OFFICIALLY_VERIFIED`). When an unknown product is scanned, an automated OCR/LLM pipeline provides an instantaneous preview in Khmer clearly badged as `AI_EXTRACTED`. Users can view provenance and ingredients immediately with explicit disclosure that it is pending moderation.

## Considered Options
1. **Fully automated unbadged ingestion**: Low trust, high legal/health liability for translation and allergen errors.
2. **Moderator-gated ingestion only**: High friction, severe cold-start penalty for retail shoppers.
3. **Hybrid confidence tiers**: Immediate value with transparent safety boundaries.

## Consequences
- Every product response payload must include its `verification_status` and disclaimers.
- Backend must support asynchronous background moderation and feedback reporting.
