# Open Food Facts Dataset Operations

LifeGoods serves barcode lookups from one Active OFF Dataset Version in MongoDB. This is a dated, unreviewed External Evidence Source, not a synchronized mirror or reviewed catalog. Project catalog lookup is disabled by default until a separate review system is approved; setting `LIFEGOODS_PROJECT_CATALOG_ENABLED=true` is reserved for controlled development and tests.

## Local services

Start MongoDB with its separate reader and writer accounts:

```bash
docker compose -f infra/compose.yaml up -d mongodb
```

The FastAPI defaults use the read-only `lifegoods_reader` account. Dataset commands use the `lifegoods_writer` account through the `pnpm off:dataset -- …` wrapper.

## Import and activation

The full global export is large and is not required for ordinary tests. Import it only when sufficient MongoDB disk capacity and temporary import headroom have been confirmed:

```bash
pnpm off:dataset -- import-url
pnpm off:dataset -- list
pnpm off:dataset -- activate VERSION_ID
```

`import-url` streams the official compressed JSONL response without retaining the archive. It hashes the received compressed bytes, keeps full Product documents, creates a unique `code` index, and refuses READY status for malformed records, duplicate codes, count mismatches, missing probes, an incomplete gzip stream, or index failure.

Activation changes one metadata pointer atomically. An interrupted or failed import cannot replace the active collection. The immediately previous active version remains available:

```bash
pnpm off:dataset -- rollback
```

Remove versions other than the active and immediately previous versions only through the explicit command:

```bash
pnpm off:dataset -- prune
```

## Cutover gate

Alembic migration `0003` permanently deletes the legacy PostgreSQL `external_sources`, `external_snapshots`, and `external_field_evidence` tables. Before applying it to any environment containing evidence that must be retained:

1. Export and verify the required rows and raw JSON.
2. Complete and validate a MongoDB import.
3. Activate the selected OFF Dataset Version.
4. Smoke-test a known match, a dated no-match, and partial reviewed results during a simulated MongoDB outage.
5. Apply the PostgreSQL migration.

Migration `0003` has no automatic downgrade. Recovery requires the pre-cutover backup.

## Pilot deployment

Use separate MongoDB credentials for the FastAPI reader and operator writer. Persist the MongoDB volume, monitor disk and connection failures, and keep the database private to the backend network. No managed provider, scheduled refresh, public OFF product API fallback, or image-binary mirror is configured in this phase.
