# Staging deployment

This procedure deploys the reviewed frontend to Cloudflare Workers Static Assets
and reaches FastAPI through a fixed Workers VPC HTTP service and Cloudflare Tunnel.
Workers VPC is beta and accepted for staging. MongoDB stays on its existing volume
and private network; no frontend, backend, Redis, or database public ports are added.
Telegram and public production launch are separate phases.

For this staging deployment, the owner explicitly waived the initial backup and
restore gate on 2026-09-16. Proceed from the completed inventory to step 3 without
claiming recoverability has been verified. Database changes therefore have no
tested recovery copy. Section 2 remains the recommended recovery procedure;
automated off-VPS backups and restoration testing remain production requirements.

## Confirmed VPS topology

Your returned diagnostics confirm the existing Compose project is `compose`, with
configuration `infra/compose/docker-compose.dataset.yml` and secrets at
`infra/secrets/dataset/.env`. MongoDB uses network `compose_default`, alias `mongodb`,
and the bind mount `/srv/lifegoods/mongodb:/data/db`. Its memory limit is already
2 GiB, with about 1.19 GiB used at inspection. The application env example uses
this network and alias. Preserve the anonymous `/data/configdb` volume as well.
The active Dataset Snapshot is `93c2b9bc4919422493f4deadc38a3cbc` with 4,729,202
Source Records. Its unique `uq_off_code` Barcode index already exists. Search is
disabled and no derived search collection or generated-data identity exists.
WiredTiger's current cache is 512 MiB; increase to the planned 1 GiB only after
measurement (the initial backup gate is waived for this staging deployment). The existing `lifegoods_reader` and
`lifegoods_writer` identities already have their intended dataset roles.

## 1. Read-only VPS inventory

Run on the VPS and return the output. Do not run `docker inspect` without the
format below, `docker compose config`, or print environment files: those can expose
credentials. The existing container name is taken from your supplied diagnostics.

```bash
cd /opt/lifegoods
docker inspect compose-mongodb-1 --format '{{json .Mounts}}'
docker inspect compose-mongodb-1 --format '{{json .NetworkSettings.Networks}}'
docker inspect compose-mongodb-1 --format '{{json .Config.Labels}}'
docker inspect compose-mongodb-1 --format '{{.HostConfig.Memory}}'
docker stats --no-stream
free -h
df -h
```

Copy the reviewed `infra/deploy/inspect-mongodb.js` into `/opt/lifegoods`, then:

```bash
docker cp infra/deploy/inspect-mongodb.js compose-mongodb-1:/tmp/inspect-mongodb.js
docker exec compose-mongodb-1 mongosh --quiet --file /tmp/inspect-mongodb.js
```

Expected: mount source, dataset network and MongoDB alias, the original Compose
project/file paths, aggregate sizes, user roles, and Dataset Snapshot manifests.
The script authenticates using the container's existing environment and never
prints credentials or Source Records. If that environment does not contain the
admin credentials, stop and establish an operator login without posting secrets.
Do not infer a Dataset Snapshot identifier from collection names. If repository
manifests are absent, stop and reconcile the import format before any activation.
Also confirm `172.30.85.0/29` does not overlap an existing Docker/private network.
If it overlaps, change the application API subnet and matching trusted `/32`
together before starting containers.

## 2. Backup and restore gate

Before indexes, users, memory configuration, or activation change, verify recovery.
The computer currently has about 111 GiB available; check again before downloading.
Create a temporary MongoDB archive on the VPS only if free disk safely permits it
(the existing 79 GiB free is an estimate, not a guarantee of archive size). Pause
all dataset lifecycle operations while dumping. No application writes exist yet.

Use `mongodump` through the existing MongoDB container with an operator identity.
Run it from an interactive container shell so credential expansion stays inside
that shell; do not paste its expanded command or environment output into chat:

```bash
mkdir -p /opt/lifegoods-backups
chmod 700 /opt/lifegoods-backups
docker exec -it compose-mongodb-1 sh
```

Inside the container:

```bash
mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db lifegoods_off --archive=/tmp/lifegoods-off.archive.gz --gzip
exit
```

Back on the VPS:

```bash
docker cp compose-mongodb-1:/tmp/lifegoods-off.archive.gz /opt/lifegoods-backups/lifegoods-off.archive.gz
chmod 600 /opt/lifegoods-backups/lifegoods-off.archive.gz
sha256sum /opt/lifegoods-backups/lifegoods-off.archive.gz
```

Download through your existing SSH/Tailscale connection to this computer. Substitute
its authorized SSH target; do not share a private key. `scp` works on macOS, Linux,
and Windows OpenSSH:

```bash
scp VPS_SSH_TARGET:/opt/lifegoods-backups/lifegoods-off.archive.gz ./lifegoods-off.archive.gz
```

Verify the downloaded SHA-256 with this portable command:

```bash
node -e "const fs=require('node:fs'),c=require('node:crypto');const h=c.createHash('sha256');fs.createReadStream('lifegoods-off.archive.gz').on('data',d=>h.update(d)).on('end',()=>console.log(h.digest('hex')))"
```

Restore on this computer into an isolated temporary container, with adequate disk
space for archive plus restored storage and index builds. Replace
`REPLACE_ABSOLUTE_BACKUP_DIRECTORY` with the directory containing the downloaded
archive; quote the complete mount argument if the path contains spaces:

```bash
docker run -d --name lifegoods-backup-restore --network none --mount "type=bind,source=REPLACE_ABSOLUTE_BACKUP_DIRECTORY,target=/backup,readonly" mongo:8.2 --bind_ip 127.0.0.1
docker exec lifegoods-backup-restore mongorestore --archive=/backup/lifegoods-off.archive.gz --gzip --nsFrom 'lifegoods_off.*' --nsTo 'lifegoods_off_restore.*'
docker exec lifegoods-backup-restore mongosh --quiet lifegoods_off_restore --eval 'db.getCollectionNames().forEach(n => print(JSON.stringify({name:n,count:db.getCollection(n).countDocuments({}),indexes:db.getCollection(n).getIndexes()})))'
```

Use a previously unused container name. This container has no network access or
published ports and restores only into `lifegoods_off_restore`. Match
collection counts, index definitions, Dataset Snapshot manifests and active pointer
against the inventory. Run the repository's dataset read path and known Product
Lookup probes against the restored copy. Never restore into the VPS application
database. Remove only this temporary container after verification with
`docker rm -f -v lifegoods-backup-restore`; retain the archive. Do not change VPS database structures until restoration succeeds. If
local space is inadequate, obtain external backup/restore storage first.
Remove temporary VPS archive copies only after the downloaded copy and restoration
are verified. Retain the off-VPS archive. Automatic remote backups are a production
launch requirement, not completed by this initial archive.

## 3. Build and prepare the application

Run the manually dispatched **Build reviewed staging backend** GitHub workflow
at the reviewed commit. It publishes
`ghcr.io/internetonion/life-goods-backend:<full-commit-sha>`. PRs do not publish images
or automatically deploy frontends against paid AI features. Record the prior image
reference for rollback. Authenticate Docker using a read-only registry token if
GHCR is private, through `docker login --password-stdin`.

Copy `.env.example` to `infra/secrets/app-staging/.env`, restrict permissions to 600,
and substitute the inventoried dataset network/MongoDB alias and strong credentials.
URL-encode passwords in MongoDB and Redis URIs. Keep the provider key empty until
provider-side quotas are configured. `LIFEGOODS_BACKEND_IMAGE` must identify the
reviewed commit; pin the cloudflared image to a released version or digest.
Never reuse localhost development credentials.

On the VPS, use `mongosh` as the existing admin to create an identity with only
`read` on `lifegoods_off` if no suitable reader exists. Create a separate identity
with only `readWrite` on `lifegoods_generated`; use `passwordPrompt()` rather than
putting passwords in command history. Do not rotate existing team credentials.

The new application stack uses the existing external dataset network. It owns no
MongoDB service or volume:

```bash
docker compose --project-name lifegoods-app-staging --env-file infra/secrets/app-staging/.env -f infra/compose/docker-compose.app-staging.yml pull
docker compose --project-name lifegoods-app-staging --env-file infra/secrets/app-staging/.env -f infra/compose/docker-compose.app-staging.yml run --rm --no-deps backend uv run --no-sync python -m lifegoods.generated_data.cli init
docker compose --project-name lifegoods-app-staging --env-file infra/secrets/app-staging/.env -f infra/compose/docker-compose.app-staging.yml run --rm --no-deps backend uv run --no-sync python -m lifegoods.generated_data.cli verify
```

Expected generated schema results: `INITIALIZED`, then `VERIFIED`. These commands
need the generated identity provisioned explicitly; fresh-volume init scripts do
not run again on your existing MongoDB volume.

Use an operator/writer identity for dataset lifecycle commands; FastAPI always
uses the reader. Set `LIFEGOODS_DATASET_OPERATOR_URI` privately in the VPS terminal
environment. Do not save it in the application env file or print it. The operator
wrapper reads the URI from the environment rather than putting it in process
arguments. The commands below use your confirmed active Dataset Snapshot identifier:

```bash
docker compose --project-name lifegoods-app-staging --env-file infra/secrets/app-staging/.env -f infra/compose/docker-compose.app-staging.yml run --rm --no-deps -e LIFEGOODS_DATASET_OPERATOR_URI backend uv run --no-sync python -m lifegoods.open_food_facts.operator list
docker compose --project-name lifegoods-app-staging --env-file infra/secrets/app-staging/.env -f infra/compose/docker-compose.app-staging.yml run --rm --no-deps -e LIFEGOODS_DATASET_OPERATOR_URI backend uv run --no-sync python -m lifegoods.open_food_facts.operator reindex-search 93c2b9bc4919422493f4deadc38a3cbc
docker compose --project-name lifegoods-app-staging --env-file infra/secrets/app-staging/.env -f infra/compose/docker-compose.app-staging.yml run --rm --no-deps -e LIFEGOODS_DATASET_OPERATOR_URI backend uv run --no-sync python -m lifegoods.open_food_facts.operator revalidate 93c2b9bc4919422493f4deadc38a3cbc
docker compose --project-name lifegoods-app-staging --env-file infra/secrets/app-staging/.env -f infra/compose/docker-compose.app-staging.yml run --rm --no-deps -e LIFEGOODS_DATASET_OPERATOR_URI backend uv run --no-sync python -m lifegoods.open_food_facts.operator activate 93c2b9bc4919422493f4deadc38a3cbc
```

`reindex-search` enables search for a lookup-only manifest and builds the derived
collection. Run commands sequentially without public traffic, tracking disk/RAM.
Stop on validation failure; do not automatically use `--accept-source-issues`,
delete records, prune or reimport the dataset. If ingredient matching is enabled,
also run the operator wrapper's `import-ingredient-taxonomy` command to load the
pinned packaged taxonomy; otherwise disable the matcher explicitly.

After the backup gate, or the explicit staging waiver above, apply `infra/deploy/mongodb-staging.override.yml` alongside
the exact ORIGINAL dataset Compose file, env file and project discovered in step 1.
Confirm the rendered volume and Tailscale binding remain identical before restarting
MongoDB. For your confirmed topology, after cache inspection and measurement:

```bash
docker compose --project-name compose --env-file infra/secrets/dataset/.env -f infra/compose/docker-compose.dataset.yml -f infra/deploy/mongodb-staging.override.yml up -d mongodb
```

Do not run this if the current cache is already appropriately sized or if the
VPS's original dataset file has changed mounts or bindings since inspection. This starts a 1 GiB WiredTiger cache and 2 GiB memory limit. Do not run the
legacy whole-site staging/production stacks: they own different MongoDB volumes.

## 4. Tunnel and frontend

Create a Cloudflare Tunnel for staging and an HTTP Workers VPC service targeting
`172.30.85.2` on port `8000`, using that Tunnel. Bind only this service to the Worker;
do not expose MongoDB or Redis through VPC. Store the Tunnel token in
`infra/secrets/app-staging/tunnel-token` (ignored by Git). Make the file readable by
the pinned cloudflared container's runtime UID and otherwise inaccessible. Enable private-network routing for Workers VPC in the Tunnel. Create the service
with `pnpm exec wrangler vpc service create lifegoods-staging-api --type http
--tunnel-id REPLACE_TUNNEL_ID --ipv4 172.30.85.2 --http-port 8000`. No published hostname or
public VPS API port is needed.

Start the stack, initially without the AI key:

```bash
docker compose --project-name lifegoods-app-staging --env-file infra/secrets/app-staging/.env -f infra/compose/docker-compose.app-staging.yml up -d
docker compose --project-name lifegoods-app-staging --env-file infra/secrets/app-staging/.env -f infra/compose/docker-compose.app-staging.yml ps
```

Backend should become healthy after Dataset Snapshot/search/schema preparation.
Redis should be healthy. FastAPI accepts forwarded identity only from the Tunnel
container's fixed address; Uvicorn's own proxy parsing is disabled. Redis has no
published port, no persistent client/rate-limit state, and `noeviction` so cache
pressure cannot evict admission state. Paid operations fail closed on Redis errors.

Configure provider-side quotas for the existing translation and extraction models
before adding the Gemini key privately to `.env`. Recreate the backend to load it.
Staging config applies five translation admissions/minute, two photo extraction
requests/client/minute, and the existing single active photo request. These are
admission limits, not a global spending cap.

On your computer, authenticate Wrangler to the Cloudflare account. Build the
reviewed frontend and set the returned VPC service ID in your terminal environment
(the ID is not a password):

```bash
pnpm exec wrangler login
pnpm build
pnpm staging:frontend:deploy
```

`staging:frontend:deploy` requires `LIFEGOODS_VPC_SERVICE_ID`, creates temporary
local configuration, and deletes it afterward. Shell-specific environment syntax
is deliberately not embedded in package commands. Before publishing you can run
`pnpm staging:frontend:deploy --dry-run`. Set the returned workers.dev origin in
backend allowed origins, then recreate the backend if needed.

Sources: [Workers VPC service configuration](https://developers.cloudflare.com/workers-vpc/configuration/vpc-services/),
[private API example](https://developers.cloudflare.com/workers-vpc/examples/private-api/),
[static SPA routing](https://developers.cloudflare.com/workers/static-assets/).

## 5. Acceptance and rollback

Run the normal verification set plus `pnpm staging:proxy:test`. Start the provided disposable local services and run their fixed-target runner:

```bash
docker compose --project-name lifegoods-staging-tests -f infra/compose/docker-compose.test.yml up -d --wait
pnpm staging:integration:test
docker compose --project-name lifegoods-staging-tests -f infra/compose/docker-compose.test.yml down -v
```

Run real service integration tests only against dedicated local test databases and an isolated Redis instance: coordinator tests flush Redis. Never target the VPS dataset or staging
Redis for the integration suite. Configure the documented `LIFEGOODS_TEST_*` reader,
writer, generated MongoDB and Redis settings before `pnpm backend:test:integration`.
Some existing generated-data tests use ordinary `LIFEGOODS_*` settings; those must
also target isolated test databases with least-privilege test credentials.

Through workers.dev verify `/`, `/compare`, and Product deep links; successful and
missing Product Lookup, Product Search/pagination, images, Khmer Translation and
photo comparison. Check near-limit valid photo requests, oversized/chunked uploads,
invalid images, spoofed forwarding headers, rate limits, provider failure and Tunnel
disconnection. Operational `/api/health/*` and docs must return 404 publicly. Probe
health only from the VPS/container network. Inspect no request bodies or personal
fields in ordinary logs; Worker observability and Uvicorn access logs are disabled.

Manually test camera permissions, Barcode decoding, typed entry and photo capture
on Android and iOS browsers. This cannot be established by unit tests.

Measure cold/warm lookup and search latency at five concurrent Shoppers, excluding
paid AI calls from load generation. Collect aggregate status/latency, disk usage,
container memory, OOM counts and swap activity. Stop on OOM, crashes or sustained
swapping and adjust capacity before accepting staging. Record results; do not
claim the existing 4 GiB VPS meets production load without measurements.

Restart backend/Redis/Tunnel containers and verify recovery. Disconnect the Tunnel
and verify sanitized 502 responses; reconnect and verify requests recover. For
application rollback, set the previous commit image in `.env`, pull and recreate
only backend. Select the prior Worker deployment in Cloudflare dashboard for frontend rollback. Do not roll back or replace the Dataset Snapshot as part
of an application rollback. Record image and Worker version IDs for every release.

Public production requires automated off-VPS backups and a restore drill, aggregate
health alerts, provider spending controls, review of measured capacity, and a
separate production deployment. Staging availability is not production acceptance.
