---
status: accepted
---

# Keep a future Open Food Facts mirror external and read-only

The MVP will continue using the public Open Food Facts API through the replaceable external-source adapter and persisted snapshots; it will not operate a mirror until pilot measurements show unacceptable availability or cold-lookup latency, approach the configured request budget despite snapshot reuse, or establish a bulk-query requirement. If triggered, the mirror will remain a read-only delivery channel for Open Food Facts as an External Evidence Source: it will store the full food Product documents from official exports in MongoDB, retain OFF attribution and source revisions, cache selected images only on demand, and be queried by a direct read-only adapter in the LifeGoods FastAPI backend. PostgreSQL remains the system of record for reviewed Products, Package Variants, Package Revisions, Claims, Evidence, Preferred Claims, conflicts, and assessments because their provenance and invariants are relational and must not inherit OFF's storage model.

Synchronization will prefer daily increments with periodic full reconciliation, build and validate a versioned dataset before atomically activating it, and retain the active and immediately previous successful versions. A late or failed synchronization continues serving the last successful version with its actual synchronization time and stale status. Normal traffic will not fall back automatically to the public OFF API after mirror cutover; a tightly budgeted, observable operator-controlled emergency switch may enable it temporarily. Visual Product identification, image-similarity infrastructure, and uploads of private shopper Package Captures to OFF remain outside MVP v0.1.
