---
status: accepted
---

# Claim-level provenance instead of Product verification tiers

Product-wide verification badges hide mixed trust: a barcode can be externally sourced, ingredient text AI-extracted, and a certificate authoritative or expired on the same Package Revision. We therefore store each assertion as a Claim with evidence, source, production method, review state, confidence, and history; select Preferred Claims only within a Package Revision; and preserve conflicts. This supersedes ADR 0001 and costs more modeling and moderation complexity in exchange for explanations that do not manufacture certainty.
