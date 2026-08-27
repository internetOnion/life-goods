---
status: accepted
---

# Keep a future Open Food Facts mirror external and read-only

Public Open Food Facts API availability and cold-lookup behavior triggered the local-data threshold. The first implementation will therefore serve a manually imported, full global OFF Dataset Version from MongoDB through a direct read-only FastAPI adapter. The immutable source document and dataset manifest provide external Evidence; OFF attribution and source revisions remain intact. PostgreSQL stores separately versioned assessment reference data for MVP-1 and remains the future system of record for post-MVP reviewed Products, Package Variants, Package Revisions, Claims, Evidence, Preferred Claims, conflicts, and assessments; it does not duplicate OFF delivery snapshots.

An operator streams an official export into an immutable version, validates its integrity, counts, unique barcode index, and known Package probes, then atomically selects the Active OFF Dataset Version. The active and immediately previous versions support rollback. The active version is served indefinitely with its actual retrieval date; it never falls back to the public OFF product API. Scheduled increments, periodic reconciliation, provider deployment, image binary mirroring, visual Product identification, image similarity, and uploads of private shopper Package Captures to OFF remain deferred.
