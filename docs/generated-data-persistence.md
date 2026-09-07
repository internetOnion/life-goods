# Isolated Generated-Data Persistence

This document specifies the operational expectations, architecture, schema, credential rotation, backup/restore procedures, and failure diagnosis for durable generated translation artifacts (Issue #84).

## 1. Storage Architecture

Life Goods isolates generated translation artifacts from the external Open Food Facts Dataset Snapshot:

- **Open Food Facts Snapshot Database (`lifegoods_off`)**: Hosted in MongoDB and accessed at runtime strictly via `lifegoods_reader` (read-only role). No runtime process may write to or modify this database.
- **Generated-Data Database (`lifegoods_generated`)**: Dedicated MongoDB database storing durable translation artifacts, leases, cooldowns, and quarantines. Accessed at runtime via `lifegoods_generated` with `readWrite` role solely on this database.
- **Disposable Hot Cache (`Redis`)**: In-memory, non-durable cache for Product Lookup results, rate limits, and hot translation bundles. Redis failures gracefully fall through to MongoDB.

Content addressing (`content_hash + translation_config_fingerprint`) addresses immutable translation bundles. No Barcode-to-artifact mapping or Shopper identifiers are stored, ensuring identical Product texts across different Dataset Snapshots reuse existing artifacts without maintaining Shopper scan history.

## 2. Collections and Indexes

The database contains four collections with strict index constraints:

| Collection | Role | TTL Policy | Key Indexes |
| :--- | :--- | :--- | :--- |
| `translation_artifacts` | Immutable generated translation bundles | **NO TTL** | `uq_translation_artifacts_content_config` (unique: `content_hash`, `translation_config_fingerprint`), `uq_translation_artifacts_artifact_id` (unique: `artifact_id`), `idx_translation_artifacts_created_at`, `idx_translation_artifacts_config_fingerprint` |
| `translation_leases` | Cross-instance single-flight generation leases | **Expires (0s)** | `ttl_translation_leases_expires_at` (`expires_at`, `expireAfterSeconds=0`), `uq_translation_leases_content_config` (unique), `uq_translation_leases_artifact_id` (unique) |
| `translation_cooldowns` | Temporary failure cooldowns | **Expires (0s)** | `ttl_translation_cooldowns_expires_at` (`expires_at`, `expireAfterSeconds=0`), `uq_translation_cooldowns_content_config` (unique), `uq_translation_cooldowns_artifact_id` (unique) |
| `translation_quarantines` | Administrative withdrawals of corrupted artifacts | **NO TTL** | `uq_translation_quarantines_content_config` (unique), `uq_translation_quarantines_artifact_id` (unique), `idx_translation_quarantines_quarantined_at` |

Translation artifacts and quarantines must never have TTL indexes. Leases and cooldowns must have active TTL indexes (`expireAfterSeconds=0`).

## 3. Schema Initialization

Schema creation is repository-owned and explicit. The web application runtime never implicitly creates collections or indexes during startup.

### Operator Commands

Initialize or update schema idempotently:

```bash
pnpm generated-data:init
```

Verify schema and index compliance without modifying the database:

```bash
pnpm generated-data:verify
```

Inspect aggregate storage health and statistics (without printing Product text):

```bash
pnpm generated-data:status
```

Quarantine a corrupted or invalid artifact administratively:

```bash
pnpm generated-data:quarantine -- --artifact-id "<content_hash>:<config_fingerprint>" --reason "Administrative audit withdrawal"
```

Custom database configurations can be provided via options:

```bash
pnpm generated-data:init -- --mongo-uri "mongodb://user:pass@host:27017/lifegoods_generated" --database "lifegoods_generated"
```

The command reports structured JSON to stdout and exits with `0` on success. On incompatible indexes or errors, it outputs a descriptive error to stderr and exits with `1`.

## 4. Cross-Instance Single Flight and Hot Caching

- **Hot Cache (`Redis`)**: Keyed strictly by `translation:artifact:v1:{content_hash}:{config_fingerprint}` without Barcode or Shopper data. Cache miss or Redis outage gracefully falls through to MongoDB.
- **Single-Flight Leases (`translation_leases`)**: Expiring atomic MongoDB leases (`owner_token`, TTL index on `expires_at`). Only one instance generates an artifact while competing requests poll up to their deadline.
- **Failure Cooldowns (`translation_cooldowns`)**: Complete generation failures (`UNAVAILABLE`) write temporary expiring cooldown records, preventing provider hammer.
- **Administrative Quarantine (`translation_quarantines`)**: Corrupted artifacts are withdrawn via quarantine records without mutating original artifact bundles.
- **Fail-Closed Generation Budget**: Project-wide provider rate limiting fails closed on Redis failure, ensuring external quotas and cost bounds are strictly preserved while Product Lookup remains available.

## 5. Credential Rotation

The runtime identity `lifegoods_generated` requires only `readWrite` on `lifegoods_generated`.

### Rotation Procedure

To rotate credentials without application downtime:

1. **Create Alternate User**: Connect as database administrator and create a secondary runtime identity on `lifegoods_generated`:
   ```javascript
   db.getSiblingDB("lifegoods_generated").createUser({
     user: "lifegoods_generated_b",
     pwd: "<new-secure-password>",
     roles: [{ role: "readWrite", db: "lifegoods_generated" }]
   });
   ```
2. **Deploy Application Config**: Update `LIFEGOODS_GENERATED_MONGODB_URI` across application instances to use `lifegoods_generated_b`.
3. **Decommission Old User**: Once all application instances have restarted with the new connection URI, remove the previous user:
   ```javascript
   db.getSiblingDB("lifegoods_generated").dropUser("lifegoods_generated");
   ```

## 5. Backup and Restore Expectations

- **Independent Backup**: `lifegoods_generated` should be backed up independently from `lifegoods_off`. Dataset Snapshot migrations or snapshot imports never overwrite generated artifacts.
- **Selective Retention**:
  - `translation_artifacts` and `translation_quarantines` must be backed up durably.
  - `translation_leases` and `translation_cooldowns` are ephemeral and can be excluded from backups or dropped during restoration without data integrity loss.
- **Backup Command**:
  ```bash
  mongodump --uri="$LIFEGOODS_GENERATED_MONGODB_URI" --collection=translation_artifacts --out=/backups/generated/
  mongodump --uri="$LIFEGOODS_GENERATED_MONGODB_URI" --collection=translation_quarantines --out=/backups/generated/
  ```
- **Restore Verification**: After restoring collections, run `pnpm generated-data:verify` to verify indexes and TTL policies.

## 6. Failure Diagnosis

| Symptom | Cause | Diagnostic & Resolution |
| :--- | :--- | :--- |
| `IncompatibleIndexError: ... must not have automatic TTL` | An index with `expireAfterSeconds` was placed on `translation_artifacts` or `translation_quarantines`. | Run `pnpm generated-data:verify` to identify the conflicting index. Drop the TTL index and re-run `pnpm generated-data:init`. |
| `IncompatibleIndexError: ... incompatible uniqueness` | An index expected to be unique was created without `unique=True`, or vice-versa. | Check `collection.index_information()`. Drop the non-conforming index and run `pnpm generated-data:init`. |
| `OperationFailure: not authorized on lifegoods_generated` | Runtime application identity lacks `readWrite` role on the target database, or is using the `lifegoods_reader` URI. | Check `LIFEGOODS_GENERATED_MONGODB_URI` environment variable. Ensure the user has role `readWrite` on `lifegoods_generated`. |
| `OperationFailure: not authorized on lifegoods_off` | Generated data process attempted to query or write to the snapshot database. | Normal security boundary behavior. Generated storage must not interact with `lifegoods_off`. |
| Leases or cooldowns not expiring | MongoDB TTL background monitor thread is disabled or running on a long sleep interval. | Verify MongoDB server parameters (`ttlMonitorSleepSecs`). Verify index has `expireAfterSeconds: 0`. |

## Translation configuration and isolated tests

The production translation configuration is `v3`, with exact provider/model identity in its fingerprint. It excludes previous configurations and `test-fake` artifacts without deleting them. Complete results are durable; partial results use only the short-lived hot cache. Missing credentials disable generation while allowing compatible stored results to be read.

Real coordinator integration tests require `LIFEGOODS_TEST_GENERATED_MONGODB_URI` with access to the dedicated `lifegoods_generated_test` database and `LIFEGOODS_TEST_REDIS_URL` pointing to a disposable test Redis database. These tests clear their collections and Redis database. They skip without explicit test connections and never default to the application's generated-data store. Run them with `pnpm backend:test:integration`.
