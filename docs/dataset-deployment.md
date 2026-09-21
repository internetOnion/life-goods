# Dataset-only VPS deployment

The dataset-only deployment runs MongoDB without the frontend, backend,
PostgreSQL, or Redis. It is intended for a small team using a private Tailscale
network; MongoDB must never be exposed on the VPS public address.

Create the deployment secrets and set `LIFEGOODS_MONGO_BIND_IP` to the VPS
Tailscale address:

```bash
cp infra/secrets/dataset/.env.example infra/secrets/dataset/.env
docker compose --env-file infra/secrets/dataset/.env \
  -f infra/compose/docker-compose.dataset.yml up -d
```

Import a local full Open Food Facts JSONL gzip export with Barcode lookup only.
This retains the complete Source Records and the required unique Barcode index,
but skips the optional full-text and country search indexes:

```bash
uv run --project backend python -m lifegoods.open_food_facts.cli \
  --mongo-uri "mongodb://lifegoods_writer:REPLACE@vps.tailnet.ts.net:27017/lifegoods_off?authSource=lifegoods_off" \
  import-file /path/to/openfoodfacts-products.jsonl.gz --lookup-only
uv run --project backend python -m lifegoods.open_food_facts.cli \
  --mongo-uri "mongodb://lifegoods_writer:REPLACE@vps.tailnet.ts.net:27017/lifegoods_off?authSource=lifegoods_off" \
  list
uv run --project backend python -m lifegoods.open_food_facts.cli \
  --mongo-uri "mongodb://lifegoods_writer:REPLACE@vps.tailnet.ts.net:27017/lifegoods_off?authSource=lifegoods_off" \
  activate <version_id>
```

The importer stores the export checksum and Dataset Snapshot metadata in
MongoDB. Keep the original compressed export and checksum outside the VPS as
the recovery copy. `import-file` streams decompression and does not create a
second uncompressed file.

## Recover a completed import with source-data issues

Imports remain strict by default. After reviewing a completed failed Dataset
Snapshot, run `revalidate <version_id> --accept-source-issues` through the same
CLI and MongoDB connection to explicitly accept its malformed-record, duplicate
code, and missing-schema counts as warnings. This reuses the stored collection;
it does not download again, restore skipped records, or resolve duplicate records.
The counts and timestamped acceptance remain in the manifest and validation history.
Incomplete imports are rejected. Record-count reconciliation, database counts,
schema-version presence, unique Barcode indexing, and probe checks still apply.
The stored export checksum is retained, not recomputed from MongoDB.
Activate separately only after successful revalidation. Local integrity checks
do not verify Open Food Facts Source Records.
