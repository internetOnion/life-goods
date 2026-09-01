---
status: accepted
---

# Remove relational persistence from the read-only MVP

The read-only MVP has no accounts, owned catalog, contributions, verification records, saved history, or other durable relational data. The backend refactor will remove PostgreSQL and Alembic, keep the static Open Food Facts Dataset Snapshot in MongoDB, and keep Redis disposable for caching and rate limiting. Relational persistence may return only when a concrete durable-data requirement justifies its schema and operational cost; the existing migration chain must be removed atomically with its obsolete models, tests, configuration, and infrastructure rather than deleted on its own.
