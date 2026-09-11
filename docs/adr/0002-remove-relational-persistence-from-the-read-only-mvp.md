---
status: accepted
---

# Remove relational persistence from the read-only MVP

The read-only MVP has no accounts, owned catalog, contributions, verification records, saved history, or other durable relational data. The completed backend refactor removed PostgreSQL and Alembic, keeps the static Open Food Facts Dataset Snapshot and generated translation data in MongoDB, and keeps Redis disposable for caching and rate limiting. Relational persistence may return only when a concrete durable-data requirement justifies its schema and operational cost; it must be introduced as a new, explicitly accepted design rather than by restoring the removed migration chain.
