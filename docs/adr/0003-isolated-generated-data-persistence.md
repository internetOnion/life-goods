---
status: accepted
---

# Isolated generated-data persistence

Khmer Translation requires durable, reproducible persistence for machine-generated artifacts without compromising the read-only integrity of the Open Food Facts Dataset Snapshot.

Three storage strategies were evaluated:

1. **Redis-only regeneration**: Relying solely on Redis treats translation storage as disposable cache. While operationally simple, any cache eviction or Redis restart forces repeated external translation provider calls for every viewed Product. This creates Shopper-facing latency spikes, risks rapid API quota and budget exhaustion, and leaves the application vulnerable to upstream provider outages even for previously translated items.
2. **Writes inside the Open Food Facts database**: Co-locating generated translations alongside Open Food Facts collections violates the core boundary that the Dataset Snapshot is an immutable, strictly read-only external source. It broadens the runtime identity's database permissions, risks corrupting or mutating raw source records, blurs source provenance with machine-generated presentation text, and tightly couples artifact retention to snapshot lifecycle operations (imports, rollbacks, and prunes).
3. **Isolated generated-data persistence**: Establishing a separate MongoDB database (`lifegoods_generated`) with a dedicated runtime identity provides durable persistence while keeping the Open Food Facts Dataset Snapshot connection strictly read-only. Content-addressed translation bundles survive snapshot activations and rollbacks, allowing identical Product text across snapshots to reuse existing artifacts without storing Barcodes or Shopper histories. The runtime identity holds least-privilege `readWrite` access solely on `lifegoods_generated` and zero access to `lifegoods_off`.

Life Goods adopts isolated generated-data persistence in a separate MongoDB database. Schema initialization is repository-owned and executed through an explicit, idempotent operator command rather than implicit web application startup.
